/* Rank por compras pagas no mês civil de Cuiabá. Bônus R$10/300 permanece separado. */
const metasRankMensalUI = [
  ["Bronze", 0],
  ["Prata", 40000],
  ["Ouro", 70000],
  ["Diamante", 120000],
  ["Imortal", 160000],
];
function competenciaRankMensalUI(data = Date.now()) {
  const d = data?.toMillis ? data.toMillis() : data;
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Cuiaba",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date(d));
  return p.find((x) => x.type === "year").value + "-" + p.find((x) => x.type === "month").value;
}
function anteriorRankMensalUI(mes) {
  const [a, m] = mes.split("-").map(Number);
  return `${m === 1 ? a - 1 : a}-${String(m === 1 ? 12 : m - 1).padStart(2, "0")}`;
}
function nivelValorRankMensalUI(centavos) {
  return (
    [...metasRankMensalUI].reverse().find(([, v]) => Number(centavos || 0) >= v)?.[0] || "Bronze"
  );
}
function nivelRankMensalUI(cliente, agora = Date.now()) {
  if (!cliente?.fidelidadeAtiva) return "Sem nível";
  const mes = competenciaRankMensalUI(agora),
    saldos = cliente.rankMensal?.meses || {};
  if (
    cliente.rankManual?.competencia === mes &&
    metasRankMensalUI.some(([n]) => n === cliente.rankManual.nivel)
  )
    return cliente.rankManual.nivel;
  // O mês anterior sustenta o nível; o atual permite subir antes da próxima virada.
  return nivelValorRankMensalUI(
    Math.max(Number(saldos[mes] || 0), Number(saldos[anteriorRankMensalUI(mes)] || 0)),
  );
}
function ajusteRankAdminUI(nivel, agora = Date.now()) {
  if (!nivel || nivel === "automatico") return null;
  if (!metasRankMensalUI.some(([n]) => n === nivel)) throw Error("Escolha um rank válido.");
  return { nivel, competencia: competenciaRankMensalUI(agora), editadoEm: agora };
}
function opcoesRankAdminUI(cliente) {
  const manual =
    cliente.rankManual?.competencia === competenciaRankMensalUI()
      ? cliente.rankManual.nivel
      : "automatico";
  return (
    '<option value="automatico"' +
    (manual === "automatico" ? " selected" : "") +
    ">Avaliação automática</option>" +
    metasRankMensalUI
      .map(([n]) => `<option value="${n}"${n === manual ? " selected" : ""}>${n}</option>`)
      .join("")
  );
}
function eventoRankMensalUI(data, centavos) {
  if (!data || !Number.isFinite(new Date(data?.toMillis ? data.toMillis() : data).getTime()))
    return null;
  return { mes: competenciaRankMensalUI(data), centavos };
}
function eventosRankPedidoMensalUI(pedido, regras = null) {
  const cents = regras?.centavos || centavosOperacao;
  const recebimentos = regras?.recebimentos || recebimentosPedidoOperacao;
  if (
    pedido.cancelado ||
    /cancelad/i.test(pedido.status || "") ||
    pedido.comandaId ||
    pedido.vinculadoComanda ||
    pedido.mesa ||
    /local/i.test(pedido.tipo || "")
  )
    return [];
  let descontoFrete = Math.min(
    cents(pedido.taxaEntrega),
    Math.max(0, cents(pedido.descontoCupomTaxa) + cents(pedido.descontoCreditoEntrega)),
  );
  const fretePago = Math.max(0, cents(pedido.taxaEntrega) - descontoFrete);
  let limite = Math.max(0, cents(pedido.valorTotal) - fretePago);
  return recebimentos(pedido)
    .map((r) => {
      const descontoNestaTaxa = Math.min(descontoFrete, cents(r.taxaEntrega));
      descontoFrete -= descontoNestaTaxa;
      const valor = Math.min(
        limite,
        Math.max(0, cents(r.valor) - Math.max(0, cents(r.taxaEntrega) - descontoNestaTaxa)),
      );
      limite -= valor;
      return eventoRankMensalUI(r.pagoEm, valor);
    })
    .filter((e) => e && e.centavos > 0);
}
function eventosRankComandaMensalUI(comanda, clienteId, regras = null) {
  const cents = regras?.centavos || centavosOperacao;
  if (comanda.cancelado || /cancelad/i.test(comanda.status || "")) return [];
  const partes = (comanda.pagamentos || []).filter((p) => p.id && p.valorQuitado != null);
  if (partes.length)
    return partes
      .filter((p) => String(p.clienteId || "") === String(clienteId))
      .map((p) => eventoRankMensalUI(p.pagoEm, Math.max(0, cents(p.valorPago ?? p.valor))))
      .filter(Boolean);
  if (comanda.status !== "Fechada" || String(comanda.clienteId || "") !== String(clienteId))
    return [];
  return [
    eventoRankMensalUI(
      comanda.fechadoEm || comanda.pagoEm,
      Math.max(0, cents(comanda.valorPago ?? comanda.valorFinal ?? comanda.valorTotal)),
    ),
  ].filter(Boolean);
}
// Preparar antes de qualquer escrita da transação; executar a função devolvida no final.
async function prepararRankMensalUI(t, lancamentos, agora = Date.now()) {
  const grupos = new Map();
  for (const l of lancamentos.filter((l) => l.clienteId)) {
    const id = String(l.clienteId);
    if (!grupos.has(id)) grupos.set(id, []);
    grupos.get(id).push(l);
  }
  const escritas = [];
  for (const [id, lista] of grupos) {
    const ref = db.collection("clientes").doc(id),
      doc = await t.get(ref);
    if (!doc.exists) continue;
    const c = doc.data(),
      meses = { ...c.rankMensal?.meses };
    let mudou = !c.rankMensal;
    for (const l of new Map(lista.map((l) => [l.chave, l])).values()) {
      const lr = db.collection("rankMovimentos").doc(encodeURIComponent(id + "|" + l.chave));
      const ld = await t.get(lr),
        antes = ld.exists ? ld.data().eventos || [] : [];
      const eventos = l.eventos.filter(
        (e) => /^\d{4}-\d{2}$/.test(e.mes) && Number.isSafeInteger(e.centavos) && e.centavos > 0,
      );
      if (serializarOperacao(antes) === serializarOperacao(eventos)) continue;
      for (const e of antes) meses[e.mes] = Math.max(0, Number(meses[e.mes] || 0) - e.centavos);
      for (const e of eventos) meses[e.mes] = Number(meses[e.mes] || 0) + e.centavos;
      escritas.push(["set", lr, { clienteId: id, chave: l.chave, eventos, atualizadoEm: agora }]);
      mudou = true;
    }
    const rankMensal = {
      ...c.rankMensal,
      versao: 1,
      meses,
      avaliadoEm: agora,
      competencia: competenciaRankMensalUI(agora),
    };
    const nivelCliente = nivelRankMensalUI({ ...c, rankMensal }, agora);
    if (
      mudou ||
      c.nivelCliente !== nivelCliente ||
      c.rankMensal?.competencia !== rankMensal.competencia
    )
      escritas.push(["update", ref, { rankMensal, nivelCliente }]);
  }
  return () => {
    for (const [modo, ref, patch] of escritas) t[modo](ref, patch);
  };
}
function lancamentosComandaRankMensalUI(id, comanda) {
  const clientes = new Set(
    [comanda.clienteId, ...(comanda.pagamentos || []).map((p) => p.clienteId)].filter(Boolean),
  );
  return [...clientes].map((clienteId) => ({
    clienteId,
    chave: "comandas_" + id,
    eventos: eventosRankComandaMensalUI(comanda, clienteId),
  }));
}
const sincronizacoesRankMensalUI = new Map();
async function sincronizarRankMensalClienteUI(id, forcar = false) {
  if (!id) return null;
  if (typeof checkoutProtegidoUI !== "undefined" && (await checkoutProtegidoUI.ativo())) {
    const { cliente } = await checkoutProtegidoUI.perfil();
    if (String(cliente.telefone) !== String(id))
      throw Error("A conta mudou durante a conferência do rank.");
    return cliente;
  }
  if (sincronizacoesRankMensalUI.has(id)) return sincronizacoesRankMensalUI.get(id);
  const tarefa = (async () => {
    const ref = db.collection("clientes").doc(String(id)),
      doc = await ref.get();
    if (!doc.exists) return null;
    const c = doc.data();
    if (!c.rankMensal?.importadoEm || forcar) {
      // Uma migração por conta: recupera recebimentos antigos documentados, sem usar gasto acumulado.
      const [pedidos, comandas, historico] = await Promise.all([
        db.collection("pedidos").where("clienteId", "==", String(id)).get(),
        db.collection("comandas").where("clienteId", "==", String(id)).get(),
        db.collection("historicoPagamentosClientes").where("clienteId", "==", String(id)).get(),
      ]);
      const origens = new Map(
        comandas.docs.map((d) => ["comandas/" + d.id, { chave: d.id, colecao: "comandas" }]),
      );
      for (const h of historico.docs)
        if (h.data().comandaId)
          origens.set("comandas/" + h.data().comandaId, {
            chave: h.data().comandaId,
            colecao: "comandas",
          });
      for (const p of pedidos.docs)
        origens.set("pedidos/" + p.id, { chave: p.id, colecao: "pedidos" });
      for (const { chave, colecao } of origens.values()) {
        const origem = db.collection(colecao).doc(chave);
        await db.runTransaction(async (t) => {
          const atual = await t.get(origem);
          if (!atual.exists) return;
          const r = atual.data();
          if (colecao === "pedidos" && String(r.clienteId) !== String(id)) return;
          const eventos =
            colecao === "pedidos"
              ? eventosRankPedidoMensalUI(r)
              : eventosRankComandaMensalUI(r, id);
          const mesAtual = competenciaRankMensalUI();
          if (
            !forcar &&
            !eventos.some((e) => [mesAtual, anteriorRankMensalUI(mesAtual)].includes(e.mes))
          )
            return;
          const salvar = await prepararRankMensalUI(t, [
            { clienteId: id, chave: colecao + "_" + chave, eventos },
          ]);
          salvar();
        });
      }
    }
    await db.runTransaction(async (t) => {
      const atual = await t.get(ref);
      if (!atual.exists) return;
      const r = atual.data();
      const rankMensal = {
        versao: 1,
        meses: { ...r.rankMensal?.meses },
        importadoEm: r.rankMensal?.importadoEm || Date.now(),
        competencia: competenciaRankMensalUI(),
        avaliadoEm: Date.now(),
      };
      const nivelCliente = nivelRankMensalUI({ ...r, rankMensal });
      if (
        r.nivelCliente !== nivelCliente ||
        r.rankMensal?.competencia !== rankMensal.competencia ||
        !r.rankMensal?.importadoEm
      )
        t.update(ref, { rankMensal, nivelCliente });
    });
    return (await ref.get()).data();
  })();
  sincronizacoesRankMensalUI.set(id, tarefa);
  try {
    return await tarefa;
  } finally {
    sincronizacoesRankMensalUI.delete(id);
  }
}
function htmlRankMensalUI(cliente) {
  if (!cliente?.fidelidadeAtiva) return "";
  if (!cliente.rankMensal?.importadoEm)
    return '<p class="rank-mensal-pendente-ui" role="status">Conferindo suas compras pagas…</p>';
  const mes = competenciaRankMensalUI();
  const valor = Number(cliente.rankMensal.meses?.[mes] || 0);
  const nivel = nivelRankMensalUI(cliente);
  const indice = metasRankMensalUI.findIndex(([n]) => n === nivel);
  const proximo = metasRankMensalUI[indice + 1];
  const progresso = proximo
    ? "Faltam <strong>" +
      moedaOperacao(Math.max(0, proximo[1] - valor) / 100) +
      "</strong> para chegar ao <strong>" +
      proximo[0] +
      "</strong>."
    : "Você chegou ao <strong>Imortal</strong>, nosso rank mais alto!";
  return (
    '<section class="rank-mensal-ui" aria-label="Rank mensal"><p class="rank-mensal-meta-ui">' +
    progresso +
    "</p><p>Seu rank é reavaliado no início de cada mês pelas compras pagas do mês anterior. Durante o mês, você pode subir ao atingir a próxima meta.</p><p>Lanches, combos, bebidas, batatas, acréscimos e molhos pagos contam após descontos. Frete e pedidos cancelados ficam fora.</p></section>"
  );
}
let clienteRankMensalPerfilUI = null;
function abrirRankMensalPerfilUI() {
  const cliente = clienteRankMensalPerfilUI;
  if (!cliente?.fidelidadeAtiva) return;
  const aberta = document.getElementById("rank-mensal-janela-ui");
  if (aberta) return;
  const dialog = document.createElement("dialog");
  dialog.id = "rank-mensal-janela-ui";
  dialog.className = "rank-mensal-janela-ui";
  dialog.setAttribute("aria-labelledby", "rank-mensal-titulo-ui");
  dialog.innerHTML =
    '<div class="rank-mensal-topo-ui"><h3 id="rank-mensal-titulo-ui">Seu rank · ' +
    nivelRankMensalUI(cliente) +
    '</h3><button type="button" class="rank-mensal-x-ui" aria-label="Fechar informações do rank">×</button></div><div class="rank-mensal-conteudo-ui">' +
    htmlRankMensalUI(cliente) +
    '</div><a href="#beneficios-do-rank" class="rank-mensal-beneficios-ui" aria-haspopup="dialog">Benefícios</a><button type="button" class="rank-mensal-entendi-ui">Entendi</button>';
  dialog.querySelector(".rank-mensal-x-ui").onclick = () => dialog.close();
  dialog.querySelector(".rank-mensal-entendi-ui").onclick = () => dialog.close();
  dialog.querySelector(".rank-mensal-beneficios-ui").onclick = (e) => {
    e.preventDefault();
    abrirBeneficiosRankPerfilUI();
  };
  dialog.addEventListener("close", () => dialog.remove(), { once: true });
  document.body.append(dialog);
  dialog.showModal();
  dialog.querySelector(".rank-mensal-entendi-ui").focus({ preventScroll: true });
}
function atualizarCartaoRankMensalPerfilUI(cliente) {
  clienteRankMensalPerfilUI = {
    ...cliente,
    telefone:
      cliente.telefone ||
      (typeof contaBeneficiosPedraoUI !== "undefined" ? contaBeneficiosPedraoUI : ""),
  };
  const nivel = nivelRankMensalUI(cliente);
  for (const campo of document.querySelectorAll("#perfil-dado-nivel, .nivel-cliente-ui")) {
    campo.textContent = nivel;
    campo.dataset.nivel = nivel.toLowerCase();
    if (campo.tagName === "BUTTON") {
      campo.disabled = !cliente?.fidelidadeAtiva;
      campo.setAttribute("aria-haspopup", "dialog");
      campo.setAttribute("aria-label", "Ver informações do rank " + nivel);
    }
  }
  const avatar = document.getElementById("perfil-logado-avatar");
  if (avatar && typeof aplicarAvatarClienteUI === "function")
    aplicarAvatarClienteUI(avatar, cliente);
  let holder = document.getElementById("rank-mensal-perfil-ui");
  const linha = document.getElementById("perfil-dado-nivel")?.parentElement;
  if (!holder && linha) {
    holder = document.createElement("div");
    holder.id = "rank-mensal-perfil-ui";
    linha.after(holder);
  }
  // Os holders do perfil recebem somente o saldo de benefícios; detalhes do rank ficam na janela.
  const dialog = document.getElementById("rank-mensal-janela-ui");
  if (dialog) {
    if (!cliente?.fidelidadeAtiva) dialog.close();
    else {
      dialog.querySelector("h3").textContent = "Seu rank · " + nivel;
      dialog.querySelector(".rank-mensal-conteudo-ui").innerHTML = htmlRankMensalUI(cliente);
    }
  }
  if (typeof atualizarBeneficiosPerfilUI === "function")
    atualizarBeneficiosPerfilUI(clienteRankMensalPerfilUI).catch(console.error);
}
let pararRelogioRankMensalUI = null;
function acompanharViradaRankMensalUI(id) {
  pararRelogioRankMensalUI?.();
  let parado = false,
    timer;
  const agendar = () => {
    const [ano, mes] = competenciaRankMensalUI().split("-").map(Number);
    const proximo = `${mes === 12 ? ano + 1 : ano}-${String(mes === 12 ? 1 : mes + 1).padStart(2, "0")}-01T00:00:00-04:00`;
    timer = setTimeout(
      async () => {
        if (parado) return;
        try {
          await sincronizarRankMensalClienteUI(id);
        } catch (e) {
          console.error(e);
        }
        if (!parado) agendar();
      },
      Math.min(2147480000, Math.max(1000, Date.parse(proximo) - Date.now() + 100)),
    );
  };
  const retomar = () => {
    if (!document.hidden && !parado) sincronizarRankMensalClienteUI(id).catch(console.error);
  };
  document.addEventListener("visibilitychange", retomar);
  sincronizarRankMensalClienteUI(id).catch(console.error);
  agendar();
  pararRelogioRankMensalUI = () => {
    parado = true;
    clearTimeout(timer);
    document.removeEventListener("visibilitychange", retomar);
  };
}
if (typeof module !== "undefined" && module.exports)
  module.exports = {
    competenciaRankMensalUI,
    nivelRankMensalUI,
    nivelValorRankMensalUI,
    anteriorRankMensalUI,
    eventosRankPedidoMensalUI,
    eventosRankComandaMensalUI,
    ajusteRankAdminUI,
    opcoesRankAdminUI,
  };
