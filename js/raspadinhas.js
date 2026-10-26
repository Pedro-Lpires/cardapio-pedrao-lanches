/**
 * Raspadinhas: configuração, concessão, validade, revelação e uso em compra posterior. Regras e transações ficam junto das ações correspondentes.
 *
 * Organização e caminhos: consulte GUIA-DO-CODIGO.md.
 */
"use strict";
function elegibilidadeRaspadinha(regra, cliente, compra, agora = Date.now()) {
  if (
    !regra.ativa ||
    regra.modo !== "automatico" ||
    agora < Number(regra.inicioEm || 0) ||
    (regra.fimEm && agora > regra.fimEm)
  )
    return false;
  if (Number(compra.pagoEm || 0) < Number(regra.criadoEm || 0)) return false;
  if (
    regra.publico === "nivel" &&
    String(cliente.nivelCliente || "Sem nível")
      .toLowerCase()
      .replace(/^lenda$/, "imortal") !==
      String(regra.nivel)
        .toLowerCase()
        .replace(/^lenda$/, "imortal")
  )
    return false;
  if (regra.publico === "cliente" && compra.clienteId !== regra.clienteId) return false;
  return (
    Math.round(Number(compra.valorPago || 0) * 100) >=
      Math.round(Number(regra.minimoCompra || 0) * 100) && Number(compra.valorPago) > 0
  );
}
function comprasRaspadinha(colecao, id, r) {
  if (r.cancelado || /cancelad/i.test(r.status || "")) return [];
  if (colecao === "pedidos") {
    if (
      /local/i.test(r.tipo || "") ||
      !(r.pagamentoConfirmado === true || /^pago$/i.test(r.status || ""))
    )
      return [];
    const clienteId = r.clienteId || r.telefoneCliente || r.telefone;
    if (!clienteId) return [];
    return [
      {
        clienteId: String(clienteId).replace(/\D/g, ""),
        valorPago: Math.max(
          0,
          Number(r.valorPago ?? r.valorTotal ?? 0) - Number(r.taxaEntrega || 0),
        ),
        pagoEm: r.pagamentoConfirmadoEm || r.pagoEm || r.dataMs || 0,
        origem: colecao + "/" + id,
      },
    ];
  }
  const partes = r.pagamentos || [];
  if (partes.some((p) => p.forma))
    return r.clienteId && r.status === "Fechada"
      ? [
          {
            clienteId: r.clienteId,
            valorPago: Number(r.valorPago ?? r.valorFinal ?? 0),
            pagoEm: r.fechadoEm,
            origem: colecao + "/" + id,
          },
        ]
      : [];
  const clientes = new Map();
  for (const p of partes) {
    if (!p.clienteId) continue;
    const c = clientes.get(p.clienteId) || {
      clienteId: p.clienteId,
      valorPago: 0,
      pagoEm: 0,
      origem: colecao + "/" + id,
    };
    c.valorPago += Number(p.valorPago ?? p.valor ?? 0);
    c.pagoEm = Math.max(c.pagoEm, Number(p.pagoEm || 0));
    clientes.set(p.clienteId, c);
  }
  return [...clientes.values()];
}
function validarUsoRaspadinha(r, agora = Date.now()) {
  if (r.status !== "disponivel")
    throw Error(
      r.status === "usada" ? "Esta raspadinha já foi usada." : "Esta raspadinha foi cancelada.",
    );
  if (Number(r.expiraEm) <= agora) throw Error("Esta raspadinha venceu.");
}
function codigoRaspadinha() {
  const bytes = new Uint8Array(10);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}
function codigoCurtoRaspadinha(nome) {
  const prefixo = String(nome || "RP")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z]/gi, "")
    .toUpperCase()
    .slice(0, 2)
    .padEnd(2, "X");
  const sorteio = new Uint32Array(1);
  crypto.getRandomValues(sorteio);
  return prefixo + String(sorteio[0] % 100000).padStart(5, "0");
}
async function localizarCodigoRaspadinha(codigo) {
  const valor = String(codigo || "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]/g, "");
  let id = valor;
  if (/^[A-Z]{2}\d{5}$/.test(valor)) {
    const mapa = await db.collection("codigosRaspadinhas").doc(valor).get();
    if (mapa.exists) id = mapa.data().raspadinhaId;
  }
  const ref = db.collection("raspadinhas").doc(id);
  return { ref, doc: await ref.get() };
}
async function concederRaspadinha(
  regraId,
  clienteId,
  origem = null,
  recuperar = false,
  tentativa = 0,
) {
  const agora = Date.now(),
    codigo = codigoRaspadinha();
  const regraRef = db.collection("campanhasRaspadinhas").doc(regraId),
    clienteRef = db.collection("clientes").doc(clienteId),
    ticketRef = db.collection("raspadinhas").doc(codigo);
  const chave = origem ? encodeURIComponent(regraId + "|" + origem + "|" + clienteId) : codigo;
  const concessaoRef = db.collection("concessoesRaspadinhas").doc(chave);
  const source = origem ? db.doc(origem) : null;
  try {
    return await db.runTransaction(async (t) => {
      const [rd, cd, concessao, sd] = await Promise.all([
        t.get(regraRef),
        t.get(clienteRef),
        t.get(concessaoRef),
        source ? t.get(source) : Promise.resolve(null),
      ]);
      if (concessao.exists) return null;
      if (!rd.exists || !cd.exists) throw Error("Regra ou cliente não encontrado.");
      const regra = rd.data(),
        cliente = cd.data();
      const codigoCurto = codigoCurtoRaspadinha(regra.nome);
      const codigoRef = db.collection("codigosRaspadinhas").doc(codigoCurto);
      const codigoExistente = await t.get(codigoRef);
      if (codigoExistente.exists) throw Error("RASPA_CODIGO_REPETIDO");
      if (!regra.ativa) throw Error("Esta campanha está pausada.");
      if (source) {
        const [colecao, id] = origem.split("/");
        const compra = sd?.exists
          ? comprasRaspadinha(colecao, id, sd.data()).find((c) => c.clienteId === clienteId)
          : null;
        if (
          !compra ||
          !elegibilidadeRaspadinha(
            regra,
            cliente,
            compra,
            recuperar ? Number(compra.pagoEm) : agora,
          )
        )
          return null;
      }
      const ticket = {
        codigo: codigoCurto,
        imagemPremio: regra.imagemPremio || "",
        clienteId,
        clienteNome: cliente.nome || "",
        campanhaId: regraId,
        premio: regra.premio,
        termos: regra.termos || "",
        minimoResgate: Number(regra.minimoResgate || 0),
        criadoEm: agora,
        expiraEm: agora + Number(regra.validadeDias || 7) * 86400000,
        status: "disponivel",
        origem: origem || "manual",
      };
      t.set(ticketRef, ticket);
      t.set(codigoRef, { raspadinhaId: codigo, clienteId, criadoEm: agora });
      t.set(concessaoRef, {
        codigo,
        clienteId,
        campanhaId: regraId,
        origem: origem || "manual",
        criadoEm: agora,
      });
      t.set(clienteRef.collection("mensagens").doc("raspa-" + codigo), {
        tipo: "admin",
        remetente: "admin",
        texto: `Chegou coisa boa pra você, ${cliente.nome || "cliente"}!`,
        raspadinhaId: codigo,
        raspadinhaStatus: "disponivel",
        data: new Date(agora).toISOString(),
        lida: false,
      });
      return codigo;
    });
  } catch (erro) {
    if (erro.message === "RASPA_CODIGO_REPETIDO" && tentativa < 9)
      return concederRaspadinha(regraId, clienteId, origem, recuperar, tentativa + 1);
    throw erro;
  }
}
async function verificarRaspadinhasCompra(colecao, id, dadosSnapshot = null, recuperar = false) {
  const doc = dadosSnapshot
    ? { exists: true, data: () => dadosSnapshot }
    : await db.collection(colecao).doc(id).get();
  if (!doc.exists) return;
  const compras = comprasRaspadinha(colecao, id, doc.data());
  if (!compras.length) return;
  const regras = await db.collection("campanhasRaspadinhas").where("ativa", "==", true).get();
  for (const c of compras) {
    const cliente = await db.collection("clientes").doc(c.clienteId).get();
    if (!cliente.exists) continue;
    for (const regra of regras.docs)
      if (
        elegibilidadeRaspadinha(
          regra.data(),
          cliente.data(),
          c,
          recuperar ? Number(c.pagoEm) : Date.now(),
        )
      )
        await concederRaspadinha(regra.id, c.clienteId, c.origem, recuperar);
  }
}
function dialogoRaspadinhaUI(titulo) {
  const d = document.createElement("dialog");
  d.className = "ui-caixa";
  const h = document.createElement("h2");
  h.textContent = titulo;
  const x = document.createElement("button");
  x.className = "ui-x";
  x.textContent = "×";
  x.setAttribute("aria-label", "Fechar raspadinha");
  x.onclick = () => d.close();
  d.append(x, h);
  d.addEventListener("close", () => d.remove(), { once: true });
  document.body.append(d);
  d.showModal();
  return d;
}
async function registrarRevelacaoRaspadinha(codigo, clienteId) {
  const ref = db.collection("raspadinhas").doc(codigo);
  await db.runTransaction(async (t) => {
    const doc = await t.get(ref);
    if (!doc.exists || doc.data().clienteId !== clienteId)
      throw new Error("Raspadinha não encontrada nesta conta.");
    if (!doc.data().reveladaEm) t.update(ref, { reveladaEm: Date.now() });
  });
}
async function abrirRaspadinhaCliente(codigo) {
  if (typeof clienteLogado === "undefined" || !clienteLogado)
    return avisoOperacao("Entre na sua conta para consultar a raspadinha.");
  const doc = await db.collection("raspadinhas").doc(codigo).get();
  if (!doc.exists || doc.data().clienteId !== clienteLogado.telefone)
    return avisoOperacao("Raspadinha não encontrada nesta conta.");
  const r = doc.data(),
    d = dialogoRaspadinhaUI("Sua raspadinha");
  const chaveRevelada = "raspa-revelada:" + clienteLogado.telefone + ":" + codigo;
  let revelada = !!r.reveladaEm || r.status === "usada";
  try {
    revelada = revelada || localStorage.getItem(chaveRevelada) === "sim";
  } catch {}
  d.insertAdjacentHTML(
    "beforeend",
    `<div class="raspa-personagem-ui" hidden></div><div class="raspa-cartao"><div><strong>Você ganhou ${escaparOperacao(r.premio)}!</strong>${r.imagemPremio && /^(https:\/\/|images\/)/i.test(r.imagemPremio) ? `<img class="raspa-premio-imagem" src="${escaparOperacao(r.imagemPremio)}" alt="${escaparOperacao(r.premio)}">` : ""}</div><canvas width="600" height="360" aria-label="Raspe para revelar seu prêmio"></canvas></div><p id="raspa-codigo" hidden>Código do prêmio: <strong>${escaparOperacao(r.codigo)}</strong></p><p id="raspa-revelacao-status" role="status"></p><button type="button" id="revelar-raspa">Revelar prêmio</button><p>${r.status === "usada" ? "Prêmio já utilizado." : r.status === "cancelada" ? "Prêmio cancelado." : Date.now() >= r.expiraEm ? "Prêmio vencido." : "Disponível até " + new Date(r.expiraEm).toLocaleDateString("pt-BR")}</p><p>Próxima compra mínima: ${moedaOperacao(r.minimoResgate)}.</p><details class="raspa-condicoes-ui"><summary>Condições deste prêmio</summary><p class="raspa-termos">${escaparOperacao(r.termos)}</p></details>`,
  );
  let revelando = false;
  async function revelar(animar = true) {
    if (revelando) return;
    revelando = true;
    const personagem = d.querySelector(".raspa-personagem-ui");
    if (personagem && typeof htmlPersonagemRecompensaPedraoUI === "function") {
      personagem.innerHTML = htmlPersonagemRecompensaPedraoUI("premio");
      personagem.hidden = false;
      if (animar) {
        d.classList.add("raspa-recompensa-animada-ui");
        personagem.scrollIntoView({ block: "nearest" });
      }
    }
    d.querySelector("canvas")?.remove();
    d.querySelector(".raspa-cartao > div")?.removeAttribute("aria-hidden");
    d.querySelector(".raspa-cartao").classList.add("raspa-revelada");
    d.querySelector("#revelar-raspa").hidden = true;
    d.querySelector("#raspa-codigo").hidden = false;
    try {
      localStorage.setItem(chaveRevelada, "sim");
    } catch {}
    if (!r.reveladaEm) {
      try {
        await registrarRevelacaoRaspadinha(codigo, clienteLogado.telefone);
        r.reveladaEm = Date.now();
      } catch {
        d.querySelector("#raspa-revelacao-status").textContent =
          "Prêmio revelado neste aparelho. Não foi possível sincronizar agora.";
      }
    }
  }
  if (revelada) {
    await revelar(false);
    return;
  }
  const canvas = d.querySelector("canvas"),
    ctx = canvas.getContext("2d");
  d.querySelector(".raspa-cartao > div")?.setAttribute("aria-hidden", "true");
  ctx.fillStyle = "#e60016";
  ctx.fillRect(0, 0, 600, 360);
  ctx.fillStyle = "#fff";
  ctx.font = "bold 30px Arial";
  ctx.textAlign = "center";
  ctx.fillText("Raspe aqui", 300, 285);
  const logo = new Image();
  logo.onload = () => {
    if (canvas.isConnected) {
      ctx.drawImage(logo, 235, 70, 130, 130);
    }
  };
  logo.src = "images/logo-trailer.webp";
  let raspando = false;
  function raspar(e) {
    if (!raspando) return;
    const b = canvas.getBoundingClientRect();
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.arc(
      ((e.clientX - b.left) * 600) / b.width,
      ((e.clientY - b.top) * 360) / b.height,
      32,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
  canvas.onpointerdown = (e) => {
    raspando = true;
    canvas.setPointerCapture(e.pointerId);
    raspar(e);
  };
  canvas.onpointermove = raspar;
  canvas.onpointerup = canvas.onpointercancel = () => {
    raspando = false;
    const pixels = ctx.getImageData(0, 0, 600, 360).data;
    let apagados = 0,
      total = 0;
    for (let i = 3; i < pixels.length; i += 64) {
      total++;
      if (pixels[i] < 128) apagados++;
    }
    if (apagados / total > 0.35) revelar();
  };
  d.querySelector("#revelar-raspa").onclick = revelar;
}
async function resgatarRaspadinha(codigo, clienteId, referencia = "") {
  const { ref } = await localizarCodigoRaspadinha(codigo);
  codigo = ref.id;
  return db.runTransaction(async (t) => {
    const doc = await t.get(ref);
    if (!doc.exists) throw Error("Código não encontrado.");
    const r = doc.data();
    if (r.clienteId !== clienteId) throw Error("O código pertence a outro cliente.");
    validarUsoRaspadinha(r);
    if (!/^(pedidos|comandas)\/[^/]+$/.test(referencia))
      throw Error("Selecione a nova compra para resgatar.");
    if (referencia === r.origem) throw Error("Este prêmio só vale em uma compra seguinte.");
    const usoRef = db
      .collection("resgatesRaspadinhas")
      .doc(encodeURIComponent(clienteId + "|" + referencia));
    const [compraDoc, uso] = await Promise.all([t.get(db.doc(referencia)), t.get(usoRef)]);
    if (uso.exists)
      throw Error(
        "Esta compra já resgatou uma raspadinha. Guarde a outra para uma próxima compra.",
      );
    const [colecao, id] = referencia.split("/");
    const compra = compraDoc.exists
      ? comprasRaspadinha(colecao, id, compraDoc.data()).find((c) => c.clienteId === clienteId)
      : null;
    if (
      !compra ||
      Number(compra.pagoEm) < Number(r.criadoEm) ||
      Math.round(compra.valorPago * 100) < Math.round(Number(r.minimoResgate || 0) * 100)
    )
      throw Error(
        "A nova compra precisa ter pagamento confirmado e atingir o mínimo após descontos, sem entrega.",
      );
    t.set(usoRef, { codigo, clienteId, compra: referencia, usadaEm: Date.now() });
    t.update(ref, {
      status: "usada",
      usadaEm: Date.now(),
      referenciaResgate: referencia,
      validacao: "compra_confirmada",
      atendente: sessionStorage.getItem("atendenteNome") || "Painel",
    });
    // Atualiza a mensagem na mesma transação, sem consultas periódicas do cliente.
    t.set(
      db
        .collection("clientes")
        .doc(clienteId)
        .collection("mensagens")
        .doc("raspa-" + codigo),
      {
        raspadinhaStatus: "usada",
      },
      { merge: true },
    );
    return r.premio;
  });
}
async function comprasParaResgateRaspadinha(r) {
  const opcoes = [];
  for (const colecao of ["pedidos", "comandas"]) {
    const s = await db.collection(colecao).get();
    for (const d of s.docs) {
      const c = comprasRaspadinha(colecao, d.id, d.data()).find((c) => c.clienteId === r.clienteId);
      if (
        c &&
        c.origem !== r.origem &&
        Number(c.pagoEm) >= Number(r.criadoEm) &&
        Math.round(c.valorPago * 100) >= Math.round(Number(r.minimoResgate || 0) * 100)
      )
        opcoes.push({
          valor: c.origem,
          texto:
            (colecao === "comandas"
              ? "Comanda · Mesa " + (d.data().mesa || "")
              : "Pedido " + (d.data().numero || d.id.slice(0, 6))) +
            " · " +
            moedaOperacao(c.valorPago),
        });
    }
  }
  return opcoes;
}
async function abrirResgateRaspadinha(somenteConsultar = false) {
  const d = dialogoRaspadinhaUI(somenteConsultar ? "Validar prêmio" : "Entregar prêmio");
  d.classList.add("raspa-consulta-atendente");
  d.insertAdjacentHTML(
    "beforeend",
    '<p>Confira a nova compra e os termos antes de confirmar. Para entrega, o cliente informa o código ao atendente.</p><form><label>Nome do cliente<input name="nome" required></label><label>Código da raspadinha<input name="codigo" required autocomplete="off"></label><button>Consultar prêmio</button></form><div class="raspa-resultado" role="status"></div>',
  );
  d.querySelector("form").onsubmit = async (e) => {
    e.preventDefault();
    const resultado = d.querySelector(".raspa-resultado");
    try {
      const codigo = d.querySelector("[name=codigo]").value.trim().toUpperCase();
      const { doc } = await localizarCodigoRaspadinha(codigo);
      if (!doc.exists) throw Error("Código não encontrado.");
      const r = doc.data();
      const normalizar = (s) =>
        String(s)
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .trim()
          .toLowerCase();
      if (normalizar(r.clienteNome) !== normalizar(d.querySelector("[name=nome]").value))
        throw Error("O nome não corresponde ao dono deste prêmio.");
      validarUsoRaspadinha(r);
      if (somenteConsultar) {
        resultado.innerHTML = `<div class="raspa-destinatario-ui"><strong>${escaparOperacao(r.premio)}</strong><p>${escaparOperacao(r.clienteNome)} · ${escaparOperacao(r.codigo)}</p><p>Prêmio disponível até ${new Date(r.expiraEm).toLocaleDateString("pt-BR")}.</p><p>Compra mínima para usar: ${moedaOperacao(r.minimoResgate)}.</p><p>${escaparOperacao(r.termos)}</p><p>Esta consulta não registra a entrega. Use “Entregar prêmio” quando entregar ao cliente.</p></div>`;
        return;
      }
      const compras = await comprasParaResgateRaspadinha(r);
      resultado.innerHTML = `<h3>${escaparOperacao(r.premio)}</h3><p>${escaparOperacao(r.clienteNome)} · ${escaparOperacao(r.codigo)}</p><p>Mínimo da nova compra: ${moedaOperacao(r.minimoResgate)} · Válida até ${new Date(r.expiraEm).toLocaleDateString("pt-BR")}</p><p class="raspa-termos">${escaparOperacao(r.termos)}</p><label>Nova compra confirmada<select id="raspa-referencia"><option value="">Selecione a compra</option>${compras.map((c) => `<option value="${escaparOperacao(c.valor)}">${escaparOperacao(c.texto)}</option>`).join("")}</select></label><label><input id="raspa-conferido" type="checkbox"> Conferi a compra mínima e os termos</label><button id="raspa-usar" disabled>Usou · confirmar entrega do prêmio</button>`;
      resultado.querySelector("#raspa-conferido").onchange = (e) =>
        (resultado.querySelector("#raspa-usar").disabled = !e.target.checked);
      resultado.querySelector("#raspa-usar").onclick = async () => {
        const b = resultado.querySelector("#raspa-usar");
        b.disabled = true;
        try {
          const premio = await resgatarRaspadinha(
            codigo,
            r.clienteId,
            resultado.querySelector("#raspa-referencia").value.trim(),
          );
          resultado.textContent = "Uso registrado. Entregue: " + premio;
        } catch (err) {
          resultado.textContent = err.message;
        }
      };
    } catch (err) {
      resultado.textContent = err.message;
    }
  };
}
function ajudaRaspadinhaUI(titulo, texto) {
  const botao = document.createElement("button");
  botao.type = "button";
  botao.className = "raspa-ajuda-botao-ui";
  botao.textContent = "?";
  botao.setAttribute("aria-label", "Ajuda: " + titulo);
  botao.onclick = (e) => {
    e.preventDefault();
    const d = dialogoRaspadinhaUI(titulo);
    d.classList.add("raspa-ajuda-janela-ui");
    const p = document.createElement("p");
    p.textContent = texto;
    d.append(p);
  };
  return botao;
}
function abrirPainelRaspadinhaUI(id, titulo) {
  const painel = document.getElementById(id);
  if (!painel) return;
  const d = abrirJanelaElementoUI(painel, titulo);
  d.classList.add("raspa-janela-admin-ui");
  if (id === "raspa-regras-painel") listarRegrasRaspadinha().catch(avisoOperacao);
}
function montarRaspadinhasAdmin() {
  const area = document.getElementById("area-admin-avancada");
  if (!area) return;
  const s = document.createElement("section");
  s.id = "raspadinhas-admin";
  s.innerHTML = `
    <h2>Raspadinhas</h2>
    <p>Crie campanhas, acompanhe os prêmios e recupere emissões pendentes.</p>
    <form id="form-regra-raspa" class="raspa-painel-bloco">
      <h3>Campanha</h3>
      <input id="raspa-regra-id" type="hidden">
      <label>Nome da campanha<input id="raspa-nome" required></label>
      <label>Como emitir<select id="raspa-modo"><option value="manual">Manual</option><option value="automatico">Automática</option></select></label>
      <p class="raspa-ajuda">Automática: ao confirmar um pagamento, o sistema confere o público e o valor da compra. Manual: você escolhe o cliente e confirma a emissão.</p>
      <label>Quem pode receber<select id="raspa-publico"><option value="todos">Todos os clientes com conta</option><option value="nivel">Por nível</option><option value="cliente">Um cliente</option></select></label>
      <label id="raspa-label-nivel" hidden>Nível<select id="raspa-nivel"><option>Bronze</option><option>Prata</option><option>Ouro</option><option>Diamante</option><option>Imortal</option><option>Sem nível</option></select></label>
      <label id="raspa-label-cliente" hidden>Telefone ou código CDA<input id="raspa-cliente-regra"></label>
      <label>Compra mínima para ganhar (R$)<input id="raspa-minimo" type="number" min="0" step="0.01" value="100" required></label>
      <p class="raspa-ajuda">Valor pago em uma compra, após descontos e sem taxa de entrega. Não soma pedidos diferentes.</p>
      <label>Prêmio<input id="raspa-premio" required placeholder="Ex.: uma batata frita média"></label>
      <label>Imagem do prêmio (opcional)<input id="raspa-imagem" placeholder="images/batata.webp ou link https://..."></label>
      <label>Compra mínima para resgatar (R$)<input id="raspa-resgate" type="number" min="0" step="0.01" value="20" required></label>
      <p class="raspa-ajuda">O prêmio é usado em outra compra confirmada. Cada código só pode ser resgatado uma vez.</p>
      <label>Validade do prêmio (dias)<input id="raspa-dias" type="number" min="1" max="3650" value="7" required></label>
      <label>Início da campanha<input id="raspa-inicio" type="date"></label>
      <label>Fim da campanha (opcional)<input id="raspa-fim" type="date"></label>
      <label>Condições para o cliente<textarea id="raspa-termos" rows="4" required placeholder="Descreva o prêmio e as condições para usar."></textarea></label>
      <label class="raspa-check"><input id="raspa-ativa" type="checkbox" checked> Campanha ativa</label>
      <div class="raspa-painel-acoes"><button type="submit">Salvar</button><button type="button" onclick="limparRegraRaspadinha()">Nova campanha</button></div>
    </form>
    <section class="raspa-painel-bloco"><h3>Campanhas cadastradas</h3><div id="raspa-regras"></div></section>
    <section class="raspa-painel-bloco"><h3>Emissão manual</h3><p class="raspa-ajuda">Escolha a campanha e informe o cliente. Confira se ele já recebeu o prêmio dessa compra antes de emitir manualmente.</p>
      <label>Campanha<select id="raspa-campanha-manual"></select></label>
      <label>Telefone ou código CDA<input id="raspa-manual-cliente" oninput="limparDestinatarioRaspaManual()"></label>
      <button type="button" onclick="consultarDestinatarioRaspaManual()">Buscar cliente</button>
      <p id="raspa-manual-status" role="status" aria-live="polite">Busque o cliente para conferir o nome antes de emitir.</p>
      <button type="button" id="raspa-manual-emitir" disabled onclick="emitirRaspadinhaManual()">Emitir</button>
    </section>
    <section class="raspa-painel-bloco"><h3>Prêmios do cliente</h3><p class="raspa-ajuda">Consulte os prêmios disponíveis e os códigos já usados.</p>
      <label>Telefone ou código CDA<input id="raspa-busca-cliente"></label>
      <button type="button" onclick="consultarRaspadinhasAdmin()">Consultar</button><div id="raspa-tickets"></div>
    </section>
    <section class="raspa-painel-bloco"><h3>Entregar prêmio</h3><p class="raspa-ajuda">Confira o código apresentado pelo cliente. Confirmar o resgate marca a raspadinha como usada.</p><button type="button" onclick="abrirResgateRaspadinha()">Validar código</button></section>
    <section class="raspa-painel-bloco"><h3>Conferir emissões automáticas</h3><p class="raspa-ajuda">Recupera compras pagas que ficaram pendentes, inclusive de dias anteriores. Processa pequenos lotes e salva o progresso. Se houver falha, continua do ponto seguro, sem duplicar prêmios.</p><button type="button" id="raspa-conferir" onclick="conferirEmissoesRaspadinha()">Conferir</button><p id="raspa-recuperacao-status" role="status" aria-live="polite">A recuperação também funciona com o painel do atendente aberto.</p></section>
    <p id="raspa-status" role="status" aria-live="polite"></p>
  `;
  // As mesmas ações e campos ficam em janelas, sem duplicar formulários ou IDs.
  s.querySelector(":scope > p:not([id])")?.remove();
  const paineis = [...s.querySelectorAll(".raspa-painel-bloco")];
  const nomes = [
    "Criar raspadinha",
    "Raspadinhas cadastradas",
    "Emissão manual",
    "Prêmios do cliente",
    "Entregar prêmio",
    "Conferir emissões automáticas",
  ];
  const ids = [
    "form-regra-raspa",
    "raspa-regras-painel",
    "raspa-manual-painel",
    "raspa-cliente-painel",
    "raspa-entrega-painel",
    "raspa-automatica-painel",
  ];
  const guardados = document.createElement("div");
  guardados.hidden = true;
  const menu = document.createElement("nav");
  menu.className = "raspa-menu-ui";
  menu.setAttribute("aria-label", "Ações de raspadinhas");
  paineis.forEach((painel, i) => {
    painel.id = ids[i];
    painel.classList.add("raspa-painel-ui");
    guardados.append(painel);
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = nomes[i];
    b.onclick = () =>
      i === 4 ? abrirResgateRaspadinha() : abrirPainelRaspadinhaUI(ids[i], nomes[i]);
    if (i === 4) {
      const validar = document.createElement("button");
      validar.type = "button";
      validar.textContent = "Validar prêmio";
      validar.onclick = () => abrirResgateRaspadinha(true);
      menu.append(validar);
    }
    menu.append(b);
  });
  s.querySelectorAll(".raspa-ajuda").forEach((p) => {
    const anterior = p.previousElementSibling;
    const titulo = anterior?.firstChild?.textContent?.trim() || "Como funciona";
    const ajuda = ajudaRaspadinhaUI(titulo, p.textContent.trim());
    if (anterior?.matches("label,h3")) {
      anterior.append(ajuda);
      p.remove();
    } else p.replaceWith(ajuda);
  });
  // Os painéis já saíram de s, por isso recebem a mesma transformação.
  guardados.querySelectorAll(".raspa-ajuda").forEach((p) => {
    const anterior = p.previousElementSibling;
    const ajuda = ajudaRaspadinhaUI(
      anterior?.firstChild?.textContent?.trim() || "Como funciona",
      p.textContent.trim(),
    );
    if (anterior?.matches("label,h3")) {
      anterior.append(ajuda);
      p.remove();
    } else p.replaceWith(ajuda);
  });
  for (const [id, titulo, texto] of [
    [
      "imagem",
      "Imagem do prêmio",
      "Use o endereço direto HTTPS de uma imagem pública, ou um arquivo já publicado no site, por exemplo images/bebidas/coca-lata.png. Links de páginas e caminhos C:\\ do computador não são imagens públicas.",
    ],
    [
      "termos",
      "Condições exibidas ao cliente",
      "Este texto aparece para o cliente na raspadinha. Escreva as condições reais: prêmio, compra mínima, validade e outras regras. Textos de teste também aparecem para ele.",
    ],
    [
      "dias",
      "Validade do prêmio",
      "Quantidade de dias que o cliente terá para usar o prêmio, contada a partir da emissão da raspadinha.",
    ],
    [
      "inicio",
      "Início da campanha",
      "A emissão automática só considera compras pagas a partir do início da campanha e depois do seu cadastro.",
    ],
    [
      "fim",
      "Fim da campanha",
      "Após esta data, a campanha deixa de emitir automaticamente. Prêmios já emitidos mantêm a própria validade.",
    ],
    [
      "publico",
      "Quem pode receber",
      "Na automática, este filtro é conferido no pagamento: todos, um nível ou uma conta específica. Na manual, você escolhe e confirma a conta que receberá.",
    ],
    [
      "ativa",
      "Campanha ativa",
      "Uma campanha pausada não emite novos prêmios. Prêmios que já foram enviados continuam com seus estados e validades.",
    ],
  ]) {
    const campo = guardados.querySelector("#raspa-" + id);
    campo?.closest("label")?.append(ajudaRaspadinhaUI(titulo, texto));
  }
  guardados.querySelector("#raspa-termos").closest("label").firstChild.textContent =
    "Condições exibidas ao cliente";
  guardados.querySelector("#raspa-recuperacao-status").textContent =
    "Pronto para conferir pagamentos.";
  s.append(menu, guardados);
  area.prepend(s);
  document.getElementById("form-regra-raspa").onsubmit = (e) => {
    e.preventDefault();
    salvarRegraRaspadinha();
  };
  document.getElementById("raspa-publico").onchange = () => {
    const v = document.getElementById("raspa-publico").value;
    document.getElementById("raspa-label-nivel").hidden = v !== "nivel";
    document.getElementById("raspa-label-cliente").hidden = v !== "cliente";
    document.getElementById("raspa-cliente-regra").disabled = v !== "cliente";
  };
  document.getElementById("raspa-manual-status").classList.add("raspa-destinatario-ui");
  document.getElementById("raspa-tickets").classList.add("raspa-tickets-ui");
  document.getElementById("raspa-imagem").type = "text";
  const statusForm = document.createElement("p");
  statusForm.id = "raspa-form-status";
  statusForm.setAttribute("role", "status");
  document.getElementById("form-regra-raspa").append(statusForm);
}
function acessoAdminRaspa() {
  if (typeof adminAvancadoLiberado === "undefined" || !adminAvancadoLiberado)
    throw Error("Abra a administração avançada primeiro.");
}
async function buscarClienteRaspa(chave) {
  if (!/^(?:\d{4}|\d{11})$/.test(chave.trim()))
    throw Error("Informe um CDA de 4 números ou um celular de 11 números com DDD.");
  const telefone = chave.replace(/\D/g, "");
  if (telefone.length === 11) {
    const d = await db.collection("clientes").doc(telefone).get();
    if (d.exists) return { id: d.id, ...d.data() };
  }
  const s = await db.collection("clientes").where("codigoAtivacao", "==", chave.trim()).get();
  if (s.size !== 1) throw Error("Cliente não encontrado ou código ambíguo. Use o telefone.");
  return { id: s.docs[0].id, ...s.docs[0].data() };
}
function limparRegraRaspadinha() {
  document.getElementById("form-regra-raspa").reset();
  document.getElementById("raspa-regra-id").value = "";
  document.getElementById("raspa-publico").onchange();
}
async function conferirEmissoesRaspadinha() {
  try {
    acessoAdminRaspa();
    await recuperarPendenciasRaspadinha();
  } catch (erro) {
    atualizarStatusRecuperacaoRaspadinha(
      "Não foi possível conferir agora. O progresso já salvo será mantido. " + erro.message,
    );
  }
}
async function salvarRegraRaspadinha() {
  try {
    acessoAdminRaspa();
    const v = (id) => document.getElementById("raspa-" + id).value;
    const publico = v("publico");
    const clienteId =
      publico === "cliente" ? (await buscarClienteRaspa(v("cliente-regra"))).id : null;
    const regra = {
      nome: v("nome").trim(),
      modo: v("modo"),
      publico,
      nivel: v("nivel"),
      clienteId,
      minimoCompra: Number(v("minimo")),
      premio: v("premio").trim(),
      imagemPremio: v("imagem").trim(),
      minimoResgate: Number(v("resgate")),
      validadeDias: Number(v("dias")),
      termos: v("termos").trim(),
      ativa: document.getElementById("raspa-ativa").checked,
      inicioEm: v("inicio") ? new Date(v("inicio") + "T00:00:00-04:00").getTime() : 0,
      fimEm: v("fim") ? new Date(v("fim") + "T23:59:59-04:00").getTime() : null,
      atualizadoEm: Date.now(),
    };
    if (
      regra.imagemPremio &&
      !/^(https:\/\/[^\s<>"']+|images\/[^\s<>"'\\]+)$/i.test(regra.imagemPremio)
    )
      throw Error("Use uma imagem pública HTTPS ou um caminho do site começando por images/.");
    if (
      !regra.nome ||
      !regra.premio ||
      !regra.termos ||
      !Number.isFinite(regra.minimoCompra) ||
      regra.minimoCompra < 0 ||
      !Number.isFinite(regra.minimoResgate) ||
      regra.minimoResgate < 0 ||
      !Number.isInteger(regra.validadeDias) ||
      regra.validadeDias < 1 ||
      regra.validadeDias > 3650 ||
      (regra.fimEm && regra.fimEm < regra.inicioEm)
    )
      throw Error("Confira os valores, o prêmio, os termos e as datas.");
    const id = v("regra-id");
    if (!id) regra.criadoEm = Date.now();
    await db
      .collection("campanhasRaspadinhas")
      .doc(id || undefined)
      .set(regra, { merge: true });
    limparRegraRaspadinha();
    await listarRegrasRaspadinha();
    document.getElementById("raspa-status").textContent = "Campanha salva.";
    document.getElementById("raspa-form-status").textContent =
      "Campanha salva. Ela já aparece em Raspadinhas cadastradas.";
  } catch (e) {
    document.getElementById("raspa-status").textContent = e.message;
    document.getElementById("raspa-form-status").textContent = e.message;
  }
}
let regrasRaspadinhaUI = [];
async function listarRegrasRaspadinha() {
  const s = await db.collection("campanhasRaspadinhas").get();
  regrasRaspadinhaUI = s.docs.map((d) => ({ id: d.id, ...d.data() }));
  const box = document.getElementById("raspa-regras");
  if (!box) return;
  box.innerHTML =
    regrasRaspadinhaUI
      .map(
        (r) =>
          `<article class="registro-operacao"><strong>${escaparOperacao(r.nome)}</strong><p>${escaparOperacao(r.premio)} · ${r.ativa ? "Ativa" : "Pausada"} · ${escaparOperacao(r.modo)}</p><button onclick="editarRegraRaspadinha('${r.id}')">Editar</button><button onclick="pausarRegraRaspadinha('${r.id}')">${r.ativa ? "Pausar" : "Ativar"}</button><button onclick="excluirRegraRaspadinha('${r.id}')">Excluir campanha</button></article>`,
      )
      .join("") || "<p>Nenhuma campanha.</p>";
  document.getElementById("raspa-campanha-manual").innerHTML = regrasRaspadinhaUI
    .filter((r) => r.ativa)
    .map((r) => `<option value="${r.id}">${escaparOperacao(r.nome)}</option>`)
    .join("");
}
function editarRegraRaspadinha(id) {
  const r = regrasRaspadinhaUI.find((r) => r.id === id);
  if (!r) return;
  const campos = {
    "regra-id": r.id,
    nome: r.nome,
    modo: r.modo,
    publico: r.publico,
    nivel: r.nivel === "Lenda" ? "Imortal" : r.nivel,
    "cliente-regra": r.clienteId || "",
    minimo: r.minimoCompra,
    premio: r.premio,
    imagem: r.imagemPremio || "",
    resgate: r.minimoResgate,
    dias: r.validadeDias,
    termos: r.termos,
    inicio: r.inicioEm ? diaCuiabaRaspa(r.inicioEm) : "",
    fim: r.fimEm ? diaCuiabaRaspa(r.fimEm) : "",
  };
  for (const [k, v] of Object.entries(campos)) document.getElementById("raspa-" + k).value = v;
  document.getElementById("raspa-ativa").checked = r.ativa;
  document.getElementById("raspa-publico").onchange();
  abrirPainelRaspadinhaUI("form-regra-raspa", "Editar raspadinha");
}
function diaCuiabaRaspa(ms) {
  return new Date(ms - 14400000).toISOString().slice(0, 10);
}
async function pausarRegraRaspadinha(id) {
  try {
    acessoAdminRaspa();
    const r = regrasRaspadinhaUI.find((r) => r.id === id);
    await db.collection("campanhasRaspadinhas").doc(id).update({ ativa: !r.ativa });
    await listarRegrasRaspadinha();
  } catch (e) {
    avisoOperacao(e.message);
  }
}
async function excluirRegraRaspadinha(id) {
  try {
    acessoAdminRaspa();
    if (
      !(await confirmarOperacao(
        "Excluir esta campanha? Os prêmios já emitidos continuam consultáveis.",
      ))
    )
      return;
    await db.collection("campanhasRaspadinhas").doc(id).delete();
    await listarRegrasRaspadinha();
  } catch (e) {
    avisoOperacao(e.message);
  }
}
let destinatarioRaspaManual = null;
function limparDestinatarioRaspaManual() {
  destinatarioRaspaManual = null;
  document.getElementById("raspa-manual-emitir").disabled = true;
  document.getElementById("raspa-manual-status").textContent =
    "Busque o cliente para conferir o nome antes de emitir.";
}
async function consultarDestinatarioRaspaManual() {
  const campo = document.getElementById("raspa-manual-cliente");
  const chave = campo.value.trim();
  limparDestinatarioRaspaManual();
  const status = document.getElementById("raspa-manual-status");
  try {
    acessoAdminRaspa();
    if (!chave) throw Error("Informe telefone com DDD ou código CDA.");
    status.textContent = "Buscando cliente…";
    const cliente = await buscarClienteRaspa(chave);
    if (campo.value.trim() !== chave) return;
    destinatarioRaspaManual = { ...cliente, chave };
    status.textContent = "Cliente encontrado: " + cliente.nome + "\nCelular: " + cliente.id;
    document.getElementById("raspa-manual-emitir").disabled = false;
  } catch (erro) {
    status.textContent = erro.message;
  }
}
async function emitirRaspadinhaManual() {
  const status = document.getElementById("raspa-manual-status");
  const botao = document.getElementById("raspa-manual-emitir");
  try {
    acessoAdminRaspa();
    const chave = document.getElementById("raspa-manual-cliente").value.trim();
    if (!destinatarioRaspaManual || destinatarioRaspaManual.chave !== chave) {
      limparDestinatarioRaspaManual();
      return;
    }
    botao.disabled = true;
    const c = await buscarClienteRaspa(chave);
    const id = document.getElementById("raspa-campanha-manual").value;
    const r = regrasRaspadinhaUI.find((r) => r.id === id);
    if (!r || !r.ativa) throw Error("Selecione uma campanha ativa.");
    if (!(await confirmarOperacao("Emitir " + r.premio + " para " + c.nome + " (" + c.id + ")?")))
      return;
    const ticketId = await concederRaspadinha(id, c.id);
    const ticket = await db.collection("raspadinhas").doc(ticketId).get();
    status.textContent =
      "Prêmio enviado para " +
      c.nome +
      "\nCelular: " +
      c.id +
      "\nCódigo da raspadinha: " +
      ticket.data().codigo;
  } catch (erro) {
    status.textContent = erro.message;
  } finally {
    botao.disabled = !destinatarioRaspaManual;
  }
}
async function consultarRaspadinhasAdmin() {
  try {
    acessoAdminRaspa();
    const c = await buscarClienteRaspa(document.getElementById("raspa-busca-cliente").value.trim());
    const s = await db.collection("raspadinhas").where("clienteId", "==", c.id).get();
    document.getElementById("raspa-tickets").innerHTML =
      `<header class="raspa-cliente-resumo-ui"><h3>${escaparOperacao(c.nome)}</h3><p>Celular: ${escaparOperacao(c.id)}</p><p>${s.size} raspadinha(s) encontrada(s)</p></header>` +
      (s.empty
        ? "<p>Esta conta ainda não recebeu raspadinhas.</p>"
        : s.docs
            .map((d) => {
              const r = d.data();
              const estado =
                r.status === "usada"
                  ? "Usada"
                  : r.status === "cancelada"
                    ? "Cancelada"
                    : Number(r.expiraEm) <= Date.now()
                      ? "Vencida"
                      : "Disponível";
              return `<article class="registro-operacao"><strong>${escaparOperacao(r.premio)}</strong><p>Código: <b>${escaparOperacao(r.codigo)}</b></p><p>Status: ${estado}</p><p>Válida até ${new Date(r.expiraEm).toLocaleDateString("pt-BR")}</p><button onclick="alterarTicketRaspadinha('${d.id}','cancelar')">Cancelar prêmio</button><button onclick="alterarTicketRaspadinha('${d.id}','validade')">Alterar validade</button><button onclick="alterarTicketRaspadinha('${d.id}','reabrir')">Corrigir uso / reabrir</button></article>`;
            })
            .join(""));
  } catch (e) {
    document.getElementById("raspa-tickets").textContent = e.message;
  }
}
async function alterarTicketRaspadinha(id, acao) {
  try {
    acessoAdminRaspa();
    let patch = {
      status: acao === "cancelar" ? "cancelada" : "disponivel",
      corrigidaEm: Date.now(),
    };
    if (acao === "validade") {
      const dias = Number(
        await solicitarEntradaOperacao("Nova validade a partir de hoje, em dias:"),
      );
      if (!Number.isInteger(dias) || dias < 1 || dias > 3650)
        return avisoOperacao("Informe de 1 a 3650 dias.");
      patch = { expiraEm: Date.now() + dias * 86400000, corrigidaEm: Date.now() };
    } else if (
      !(await confirmarOperacao(
        acao === "reabrir"
          ? "Reabrir este prêmio? O cliente poderá utilizá-lo novamente."
          : "Cancelar este prêmio?",
      ))
    )
      return;
    await db.collection("raspadinhas").doc(id).update(patch);
    await consultarRaspadinhasAdmin();
  } catch (e) {
    avisoOperacao(e.message);
  }
}
document.addEventListener("DOMContentLoaded", () => {
  montarRaspadinhasAdmin();
  if (document.getElementById("raspadinhas-admin")) {
    organizarModulosAdminUI();
    document
      .getElementById("raspadinhas-admin")
      .closest("details")
      ?.addEventListener("toggle", () => {
        if (document.getElementById("raspadinhas-admin").closest("details").open)
          listarRegrasRaspadinha().catch(
            (e) => (document.getElementById("raspa-status").textContent = e.message),
          );
      });
  }
  const menu = document.querySelector(".menu-atendente");
  if (menu) {
    const b = document.createElement("button");
    b.textContent = "Raspadinha · validar prêmio";
    b.onclick = abrirResgateRaspadinha;
    menu.append(b);
  }
  // Somente pagamentos recentes; o histórico completo fica na conferência manual.
  if (menu || document.getElementById("raspadinhas-admin")) iniciarPagamentosRaspadinha();
});

// Cada origem é serializada; eventos simultâneos de pagamento não duplicam a conferência.
const conferenciasRaspadinha = new Map();
const assinaturasCompraRaspadinha = new Map();
let paradasPagamentosRaspadinha = [];
let viradaPagamentosRaspadinha = null;
function conferirPagamentoRecenteRaspadinha(colecao, id, dados = null) {
  const chave = colecao + "/" + id;
  const anterior = conferenciasRaspadinha.get(chave) || Promise.resolve();
  const tarefa = anterior
    .catch(() => {})
    .then(async () => {
      const atual = dados || (await db.collection(colecao).doc(id).get()).data();
      if (!atual) return;
      const compras = comprasRaspadinha(colecao, id, atual);
      if (!compras.length) return;
      const assinatura = JSON.stringify(compras);
      if (assinaturasCompraRaspadinha.get(chave) === assinatura) return;
      await verificarRaspadinhasCompra(colecao, id, atual);
      assinaturasCompraRaspadinha.set(chave, assinatura);
    })
    .catch((erro) => console.error("Raspadinha pendente de conferência:", erro.message));
  conferenciasRaspadinha.set(chave, tarefa);
  tarefa.finally(() => {
    if (conferenciasRaspadinha.get(chave) === tarefa) conferenciasRaspadinha.delete(chave);
  });
  return tarefa;
}
function pararPagamentosRaspadinha() {
  pararRecuperacaoRaspadinha();
  paradasPagamentosRaspadinha.forEach((parar) => parar());
  paradasPagamentosRaspadinha = [];
  clearTimeout(viradaPagamentosRaspadinha);
}
function iniciarPagamentosRaspadinha() {
  pararPagamentosRaspadinha();
  assinaturasCompraRaspadinha.clear();
  agendarRecuperacaoRaspadinha(1000);
  const janela = janelaOperacionalOperacao();
  for (const [colecao, campo] of [
    ["pedidos", "pagamentoConfirmadoEm"],
    ["comandas", "fechadoEm"],
    ["historicoPagamentosClientes", "criadoEmMs"],
  ]) {
    const parar = db
      .collection(colecao)
      .where(campo, ">=", janela.inicio)
      .onSnapshot(
        (snap) => {
          for (const mudanca of snap.docChanges()) {
            if (mudanca.type === "removed") continue;
            const dados = mudanca.doc.data();
            if (colecao === "historicoPagamentosClientes") {
              if (dados.comandaId) conferirPagamentoRecenteRaspadinha("comandas", dados.comandaId);
            } else {
              conferirPagamentoRecenteRaspadinha(colecao, mudanca.doc.id, dados);
            }
          }
        },
        (erro) =>
          console.error("Não foi possível acompanhar pagamentos de raspadinhas:", erro.message),
      );
    paradasPagamentosRaspadinha.push(parar);
  }
  viradaPagamentosRaspadinha = setTimeout(
    iniciarPagamentosRaspadinha,
    Math.max(1000, janela.fim - Date.now() + 100),
  );
}
if (typeof window !== "undefined") window.addEventListener("pagehide", pararPagamentosRaspadinha);
if (typeof window !== "undefined")
  window.addEventListener("pageshow", (evento) => {
    if (
      evento.persisted &&
      (document.querySelector(".menu-atendente") || document.getElementById("raspadinhas-admin"))
    )
      iniciarPagamentosRaspadinha();
  });
