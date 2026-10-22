/**
 * Navegação: uma etapa por vez, histórico do atendente, Voltar/X e organização dos módulos. Aparência em css/navegacao.css.
 *
 * Organização e caminhos: consulte GUIA-DO-CODIGO.md.
 */
"use strict";
let perfilModoUI = "home";
let contadorModulosUI = 0;
function voltarPerfilUI() {
  abrirPerfilModo(
    perfilModoUI === "editar" && typeof clienteLogado !== "undefined" && clienteLogado
      ? "logado"
      : "home",
  );
}
function atualizarPublicoCampanhaUI() {
  const s = document.getElementById("campanha-publico");
  if (!s) return;
  document.getElementById("campanha-rank").closest("label").hidden = s.value !== "rank";
  document.getElementById("campanha-cliente").closest("label").hidden = s.value !== "cliente";
}
function acoesRegistroUI(colecao, id, entrega = false) {
  const a = `'${colecao}','${escaparOperacao(id)}'`;
  return `<div class="operacao-acoes ui-acoes-pedido"><button onclick="abrirDestinoPedidoUI('cozinha',${a})">Cozinha</button>${entrega ? `<button onclick="abrirDestinoPedidoUI('motoboy',${a})">Motoboy</button>` : ""}<button title="Imprimir conferência" aria-label="Imprimir conferência" onclick="imprimirRegistroOperacao(${a},'geral')">Imprimir</button></div>`;
}
const telasAtendenteUI = [
  "area-consumo-local",
  "area-mesa-atendente",
  "area-comanda-atendente",
  "area-produtos-comanda",
  "area-entrega-atendente",
  "area-retirada-atendente",
  "area-chamados-mesa-atendente",
  "central-operacao",
];
let pilhaAtendenteUI = [],
  profundidadeUI = 0,
  voltandoUI = false;
let navegacaoAtendenteUI = 0;
function ocultarTelasAtendenteUI() {
  telasAtendenteUI.forEach((id) => {
    const e = document.getElementById(id);
    if (e) {
      e.hidden = true;
      e.style.display = "none";
    }
  });
}
function fecharFluxoAtendenteUI() {
  navegacaoAtendenteUI++;
  document.getElementById("carregamento-etapa-atendente")?.remove();
  pilhaAtendenteUI = [];
  ocultarTelasAtendenteUI();
  document.querySelector(".menu-atendente").hidden = false;
  window.scrollTo(0, 0);
}
async function voltarFluxoAtendenteUI() {
  if (profundidadeUI) return fecharFluxoAtendenteUI();
  const pagamento =
    /^(abrirFechamento|abrirPagamento|abrirIdentificacao|abrirBeneficios|abrirFormaPagamento)/;
  const rota = [...pilhaAtendenteUI]
    .reverse()
    .find((r) => r.nome === "abrirComandaVisual" || pagamento.test(r.nome));
  if (rota?.args[0]) {
    const doc = await lerComPrazoUI(db.collection("comandas").doc(rota.args[0]).get());
    if (!doc.exists || doc.data().status !== "Aberta") {
      limparHistoricoComandaUI(rota.args[0]);
    } else if (
      pagamento.test(pilhaAtendenteUI.at(-1)?.nome || "") &&
      pilhaAtendenteUI.at(-1)?.nome !== "abrirFechamentoComanda" &&
      !pilhaAtendenteUI.slice(0, -1).some((r) => pagamento.test(r.nome))
    ) {
      pilhaAtendenteUI = pilhaAtendenteUI.filter((r) => !pagamento.test(r.nome));
      return abrirFechamentoComanda(rota.args[0]);
    }
  }
  pilhaAtendenteUI.pop();
  const anterior = pilhaAtendenteUI.at(-1);
  if (!anterior) return fecharFluxoAtendenteUI();
  voltandoUI = true;
  try {
    await window[anterior.nome](...anterior.args);
  } finally {
    voltandoUI = false;
  }
}
function limparHistoricoComandaUI(id) {
  pilhaAtendenteUI = pilhaAtendenteUI.filter((r) => r.args[0] !== id);
}
function reiniciarHistoricoPagamentoUI(id) {
  pilhaAtendenteUI = pilhaAtendenteUI.filter(
    (r) =>
      r.args[0] !== id ||
      !/^(abrirPagamento|abrirIdentificacao|abrirBeneficios|abrirFormaPagamento)/.test(r.nome),
  );
}
async function fecharEtapaAtendenteUI() {
  const rota = pilhaAtendenteUI.at(-1);
  if (["abrirConsumoLocal", "abrirComandasAbertas"].includes(rota?.nome))
    return fecharFluxoAtendenteUI();
  if (rota?.nome === "abrirMesaAtendente") return abrirConsumoLocal();
  if (
    /^(abrirFechamento|abrirPagamento|abrirIdentificacao|abrirBeneficios|abrirFormaPagamento)/.test(
      rota?.nome || "",
    ) &&
    rota.args[0]
  ) {
    const doc = await lerComPrazoUI(db.collection("comandas").doc(rota.args[0]).get());
    if (!doc.exists || doc.data().status !== "Aberta") return voltarFluxoAtendenteUI();
    const id = rota.args[0];
    reiniciarHistoricoPagamentoUI(id);
    return rota.nome === "abrirFechamentoComanda"
      ? abrirComandaVisual(id)
      : abrirFechamentoComanda(id);
  }
  return voltarFluxoAtendenteUI();
}
function cabecalhoEtapaUI(area) {
  area.querySelector(".ui-navegacao")?.remove();
  const nav = document.createElement("div");
  nav.className = "ui-navegacao";
  nav.innerHTML =
    '<button class="ui-voltar" onclick="voltarFluxoAtendenteUI()">← Voltar</button><button class="ui-x" aria-label="Fechar etapa atual" onclick="fecharEtapaAtendenteUI()">×</button>';
  area.prepend(nav);
  if (
    area.id === "area-produtos-comanda" &&
    typeof comandaAbertaAtual !== "undefined" &&
    comandaAbertaAtual
  ) {
    const comandaId = comandaAbertaAtual;
    nav.querySelector(".ui-x").onclick = () => abrirComandaVisual(comandaId);
    nav.querySelector(".ui-x").setAttribute("aria-label", "Fechar itens e voltar à comanda");
  }
  if (area.id === "central-operacao" && (tipoCentralOperacao || idCentralOperacao)) {
    const anterior = idCentralOperacao ? tipoCentralOperacao : null;
    nav.querySelector(".ui-voltar").onclick = () => abrirCentralOperacao(anterior);
    nav.querySelector(".ui-x").onclick = () => abrirCentralOperacao();
    nav.querySelector(".ui-x").setAttribute("aria-label", "Fechar categoria");
  }
  area.querySelectorAll("button").forEach((b) => {
    if (
      !b.closest(".ui-navegacao") &&
      (/voltar (para |à |aos )?(comanda|mesa|produtos)/i.test(b.textContent) ||
        /^[←⬅]?\s*voltar$/i.test(b.textContent.trim()))
    ) {
      b.hidden = true;
    }
    if (b.classList.contains("ui-x") && !b.closest(".ui-navegacao")) b.hidden = true;
  });
  area.querySelectorAll("div[style]").forEach((d) => {
    if (d.style.overflowX === "auto") d.classList.add("ui-categorias");
  });
}
function instalarNavegacaoAtendenteUI() {
  if (!document.querySelector(".menu-atendente")) return;
  const rotas = {
    abrirConsumoLocal: "area-consumo-local",
    abrirMesaAtendente: "area-mesa-atendente",
    abrirComandaVisual: "area-comanda-atendente",
    abrirBuscaProdutos: "area-produtos-comanda",
    abrirPainelProduto: "area-produtos-comanda",
    abrirEntregaAtendente: "area-entrega-atendente",
    criarNovoPedidoEntrega: "area-entrega-atendente",
    continuarNovoPedidoEntrega: "area-entrega-atendente",
    abrirMontagemPedidoEntrega: "area-entrega-atendente",
    abrirProdutosPedidoEntrega: "area-entrega-atendente",
    abrirRetiradaAtendente: "area-retirada-atendente",
    criarNovoPedidoRetirada: "area-retirada-atendente",
    continuarNovoPedidoRetirada: "area-retirada-atendente",
    abrirMontagemPedidoRetirada: "area-retirada-atendente",
    abrirProdutosPedidoRetirada: "area-retirada-atendente",
    abrirComandasAbertas: "area-consumo-local",
    abrirChamadosMesaAtendente: "area-chamados-mesa-atendente",
    abrirCentralOperacao: "central-operacao",
  };
  for (const nome of [
    "abrirFechamentoComanda",
    "abrirPagamentoTudoJunto",
    "abrirPagamentoSeparado",
    "abrirPagamentoSeparadoPorValor",
    "abrirIdentificacaoPagamentoSeparado",
    "abrirBeneficiosPagamentoSeparado",
    "abrirFormaPagamentoSeparado",
  ])
    rotas[nome] = "area-comanda-atendente";
  rotas.abrirPedidosParaVincularNaMesa = "area-mesa-atendente";
  rotas.voltarListaEntregas = "area-entrega-atendente";
  rotas.voltarListaRetirada = "area-retirada-atendente";
  for (const [nome, id] of Object.entries(rotas)) {
    const original = window[nome];
    if (typeof original !== "function") continue;
    window[nome] = async function (...args) {
      if (profundidadeUI) return original.apply(this, args);
      const navegacao = ++navegacaoAtendenteUI;
      if (nome === "abrirConsumoLocal" && !voltandoUI) pilhaAtendenteUI = [];
      if (nome === "abrirCentralOperacao" && !args[1] && !voltandoUI)
        pilhaAtendenteUI = pilhaAtendenteUI.filter(
          (r) => r.nome !== "abrirCentralOperacao" || (args[0] && !r.args[0] && !r.args[1]),
        );
      if (
        !voltandoUI &&
        ["abrirBuscaProdutos", "abrirComandaVisual", "abrirMesaAtendente"].includes(nome)
      ) {
        const indice = pilhaAtendenteUI.findLastIndex(
          (r) => r.nome === nome && r.args[0] === args[0],
        );
        if (indice >= 0) pilhaAtendenteUI = pilhaAtendenteUI.slice(0, indice);
      }
      ocultarTelasAtendenteUI();
      document.querySelector(".menu-atendente").hidden = true;
      const carregando = document.createElement("section");
      carregando.id = "carregamento-etapa-atendente";
      carregando.className = "carregamento-etapa-ui";
      carregando.innerHTML = htmlCarregandoUI("Carregando…");
      cabecalhoEtapaUI(carregando);
      document.body.append(carregando);
      if (nome === "abrirComandaVisual" && typeof areaDestinoComandaAtual !== "undefined")
        areaDestinoComandaAtual = null;
      profundidadeUI++;
      try {
        await original.apply(this, args);
      } catch (e) {
        ocultarTelasAtendenteUI();
        document.querySelector(".menu-atendente").hidden = false;
        avisoOperacao("Não foi possível abrir esta etapa: " + e.message);
        return;
      } finally {
        carregando.remove();
        profundidadeUI--;
      }
      if (navegacao !== navegacaoAtendenteUI) {
        ocultarTelasAtendenteUI();
        document.querySelector(".menu-atendente").hidden = false;
        return;
      }
      let alvo = nome === "abrirPainelProduto" ? "area-comanda-atendente" : id;
      if (nome === "abrirPainelProduto" && typeof contextoPainelProduto !== "undefined") {
        if (contextoPainelProduto === "entrega") alvo = "area-entrega-atendente";
        if (contextoPainelProduto === "retirada") alvo = "area-retirada-atendente";
      }
      const area = document.getElementById(alvo);
      if (!area) return;
      ocultarTelasAtendenteUI();
      area.hidden = false;
      area.style.display = "block";
      document.querySelector(".menu-atendente").hidden = true;
      if (!voltandoUI) {
        const ultima = pilhaAtendenteUI.at(-1);
        const nomeRota =
          nome === "continuarNovoPedidoEntrega"
            ? "abrirMontagemPedidoEntrega"
            : nome === "continuarNovoPedidoRetirada"
              ? "abrirMontagemPedidoRetirada"
              : nome;
        const argsRota = nomeRota !== nome ? [] : args;
        if (nome === "abrirCentralOperacao" && args[1] && /MontagemPedido/.test(ultima?.nome || ""))
          pilhaAtendenteUI = [
            {
              nome: args[0] === "Entrega" ? "abrirEntregaAtendente" : "abrirRetiradaAtendente",
              args: [],
            },
          ];
        if (ultima?.nome === nomeRota && JSON.stringify(ultima.args) === JSON.stringify(argsRota))
          pilhaAtendenteUI.pop();
        pilhaAtendenteUI.push({ nome: nomeRota, args: argsRota });
      }
      cabecalhoEtapaUI(area);
      if (
        /^(abrirFechamento|abrirPagamento|abrirIdentificacao|abrirBeneficios|abrirFormaPagamento)/.test(
          nome,
        )
      ) {
        const pagamento = area.querySelector("#area-fechamento-comanda");
        if (pagamento) {
          Array.from(area.children).forEach((e) => {
            if (e !== pagamento && !e.classList.contains("ui-navegacao")) e.hidden = true;
          });
          pagamento.hidden = false;
          pagamento.style.display = "block";
          pagamento.style.marginTop = "0";
        }
      }
      if (nome === "abrirComandaVisual" && !area.querySelector(".ui-acoes-pedido"))
        area
          .querySelector(".ui-navegacao")
          .insertAdjacentHTML("afterend", acoesRegistroUI("comandas", args[0]));
      if (nome === "abrirMesaAtendente") {
        const numero = Number(area.dataset.mesaNumero);
        if (Number.isInteger(numero)) {
          const box = document.createElement("div");
          box.className = "operacao-acoes";
          box.innerHTML = `<button onclick="abrirCozinhaMesaUI(${numero})">Cozinha</button><button onclick="imprimirMesaOperacao(${numero},'geral')">Mesa · imprimir geral</button>`;
          area.append(box);
        }
      }
      if (nome === "abrirEntregaAtendente" || nome === "abrirRetiradaAtendente") {
        const b = document.createElement("button");
        b.textContent =
          nome === "abrirEntregaAtendente" ? "Ver pedidos de entrega" : "Ver pedidos de retirada";
        b.onclick = () =>
          abrirPedidosTipoUI(nome === "abrirEntregaAtendente" ? "Entrega" : "Retirada");
        area.append(b);
      }
      if (area.classList.contains("central-etapa-modal")) area.scrollTop = 0;
      else window.scrollTo(0, 0);
    };
  }
  if (typeof abrirComandaPelaLista === "function")
    window.abrirComandaPelaLista = async (id, numeroMesa) => {
      const s = await db.collection("mesas").where("numero", "==", Number(numeroMesa)).get();
      if (s.empty) return avisoOperacao("Mesa não encontrada.");
      mesaAbertaAtual = s.docs[0].id;
      await abrirComandaVisual(id);
    };
  window.novaComandaMesa = async (mesaId) => {
    const nome = await dialogoOperacao("Nova comanda", "text", false, {
      label: "Nome do cliente",
      botao: "Criar comanda",
    });
    if (!nome?.trim()) return;
    try {
      const mesa = await db.collection("mesas").doc(mesaId).get();
      if (!mesa.exists) throw Error("Mesa não encontrada.");
      const ref = db.collection("comandas").doc();
      const b = db.batch();
      b.set(ref, {
        cliente: nome.trim(),
        mesa: mesa.data().numero,
        status: "Aberta",
        atendenteId: localStorage.getItem("atendenteId"),
        atendenteNome: localStorage.getItem("atendenteNome"),
        criadoEm: Date.now(),
        itens: [],
        valorTotal: 0,
      });
      b.update(mesa.ref, { ocupada: true });
      await b.commit();
      await abrirComandaVisual(ref.id);
    } catch (e) {
      avisoOperacao("Não foi possível abrir a comanda: " + e.message);
    }
  };
}
async function enviarMesaCozinhaUI(mesa) {
  const snap = await db
    .collection("comandas")
    .where("mesa", "==", mesa)
    .where("status", "==", "Aberta")
    .get();
  for (const d of snap.docs) await confirmarProducaoOperacao("comandas", d.id, true);
  avisoOperacao("Itens novos enviados à tela da cozinha.");
}
async function abrirPedidosTipoUI(tipo) {
  await abrirCentralOperacao(tipo);
}
function organizarModulosAdminUI() {
  if (!document.getElementById("ui-fundo-modulo")) {
    const fundo = document.createElement("div");
    fundo.id = "ui-fundo-modulo";
    fundo.setAttribute("aria-hidden", "true");
    fundo.onclick = () =>
      document
        .querySelectorAll("details.ui-modulo[open]")
        .forEach((modulo) => (modulo.open = false));
    document.body.append(fundo);
  }
  document
    .querySelectorAll(
      ".admin-body main section:not(.ui-modulo section),#financeiro-conteudo>section",
    )
    .forEach((s) => {
      if (
        s.closest(".ui-modulo") ||
        s.id === "financeiro-login" ||
        s.classList.contains("central-operacao") ||
        s.querySelector("#dia-financeiro") ||
        s.parentElement.closest("section")
      )
        return;
      const h = s.querySelector("h2,h3");
      if (!h) return;
      const d = document.createElement("details");
      d.className = "ui-modulo";
      const summary = document.createElement("summary");
      summary.textContent = h.textContent;
      const descricao = [
        [
          /pedidos recentes/i,
          "Consulte os pedidos e imprima para cozinha, entregador ou conferência.",
        ],
        [/online/i, "Veja as contas que estão usando o sistema."],
        [/fidelidade/i, "Consulte contas, histórico, códigos e benefícios."],
        [/campanhas/i, "Escolha o público e envie avisos ou cupons às contas."],
        [/raspadinhas/i, "Configure campanhas, emita e acompanhe prêmios."],
        [/produtos/i, "Crie, edite, fotografe, pause ou exclua itens do cardápio."],
        [/adicionais/i, "Configure opções extras, preços e disponibilidade."],
        [/cupons/i, "Crie descontos e defina as condições de uso."],
        [/atendentes/i, "Gerencie os funcionários e seus códigos de acesso."],
        [/fiscal/i, "Abra para consultar ou preparar os dados da emissão."],
        [/mensagens|suporte/i, "Consulte chamados e converse com os clientes."],
      ].find(([re]) => re.test(h.textContent));
      const desc = document.createElement("small");
      desc.textContent = descricao?.[1] || "Abra para consultar e configurar esta função.";
      summary.append(desc);
      desc.id = "descricao-modulo-ui-" + ++contadorModulosUI;
      summary.setAttribute("aria-label", h.textContent.trim());
      summary.setAttribute("aria-describedby", desc.id);
      const x = document.createElement("button");
      x.className = "ui-x ui-fechar-modulo";
      x.textContent = "×";
      x.setAttribute("aria-label", "Fechar " + h.textContent.trim());
      x.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        d.open = false;
      };
      summary.append(x);
      s.before(d);
      d.append(summary, s);
      h.hidden = true;
      d.addEventListener("toggle", () => {
        if (d.open) {
          document.querySelectorAll("details.ui-modulo[open]").forEach((x) => {
            if (x !== d) x.open = false;
          });
          if (h.onclick && !d.dataset.inicializado) {
            d.dataset.inicializado = "sim";
            h.onclick();
          }
        }
      });
    });
}
function prepararFotosAdminUI() {
  ["produto-imagem", "edit-produto-imagem"].forEach((id) => {
    const alvo = document.getElementById(id);
    if (!alvo || document.getElementById(id + "-arquivo")) return;
    const label = document.createElement("label");
    label.textContent = "Foto do produto";
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/jpeg,image/png,image/webp";
    input.id = id + "-arquivo";
    const preview = document.createElement("img");
    preview.style.cssText = "display:none;width:100px;height:100px;object-fit:contain";
    if (alvo.value) {
      preview.src = resolverImagemProduto(alvo.value);
      preview.style.display = "block";
    }
    const remover = document.createElement("button");
    remover.type = "button";
    remover.textContent = "Remover foto";
    remover.onclick = () => {
      alvo.value = "";
      preview.removeAttribute("src");
      preview.style.display = "none";
      input.value = "";
    };
    input.onchange = async () => {
      const f = input.files[0];
      if (!f) return;
      input.disabled = true;
      window.fotoProdutoProcessandoUI = true;
      try {
        const bitmap = await createImageBitmap(f);
        const c = document.createElement("canvas");
        const escala = Math.min(1, 600 / Math.max(bitmap.width, bitmap.height));
        c.width = Math.round(bitmap.width * escala);
        c.height = Math.round(bitmap.height * escala);
        c.getContext("2d").drawImage(bitmap, 0, 0, c.width, c.height);
        let url = c.toDataURL("image/webp", 0.72);
        if (url.length > 220000) url = c.toDataURL("image/webp", 0.4);
        bitmap.close();
        if (url.length > 220000) throw Error("A foto é muito grande. Escolha uma imagem menor.");
        alvo.value = url;
        preview.src = url;
        preview.style.display = "block";
      } catch (e) {
        avisoOperacao("Não foi possível carregar a foto: " + e.message);
      } finally {
        input.disabled = false;
        window.fotoProdutoProcessandoUI = false;
      }
    };
    label.append(input, preview, remover);
    alvo.after(label);
  });
}
function atualizarAutoCardapioUI() {
  const grades = [...document.querySelectorAll(".auto-grid-produtos")];
  if (!grades.length) return;
  if (!document.getElementById("busca-auto-ui")) {
    const box = document.createElement("div");
    box.className = "auto-busca";
    box.innerHTML =
      '<input id="busca-auto-ui" type="search" aria-label="Buscar no cardápio" placeholder="🔎 Busque pelo nome do item"><button class="busca-limpar" aria-label="Limpar busca">×</button>';
    document.querySelector(".auto-categorias")?.before(box);
    box.querySelector("input").oninput = atualizarAutoCardapioUI;
    box.querySelector("button").onclick = () => {
      box.querySelector("input").value = "";
      atualizarAutoCardapioUI();
    };
  }
  const termo = normalizarBuscaUI(document.getElementById("busca-auto-ui")?.value);
  grades.forEach((g) => {
    const cards = [...g.children].filter((c) => !c.matches("button.auto-ver-mais"));
    cards.forEach((c, i) => {
      const texto = normalizarBuscaUI(c.textContent);
      const hidden = termo ? !texto.includes(termo) : i >= 5 && g.dataset.expandido !== "sim";
      if (c.hidden !== hidden) c.hidden = hidden;
    });
    const secao = g.closest('[id^="secao-auto-"]');
    if (secao) secao.hidden = !!termo && !cards.some((c) => !c.hidden);
    let b = g.nextElementSibling;
    if (!b?.classList.contains("auto-ver-mais")) {
      b = document.createElement("button");
      b.className = "auto-ver-mais";
      b.onclick = () => {
        g.dataset.expandido = g.dataset.expandido === "sim" ? "nao" : "sim";
        atualizarAutoCardapioUI();
      };
      g.after(b);
    }
    b.hidden = !!termo || cards.length <= 5;
    const texto = g.dataset.expandido === "sim" ? "Ver menos" : "Ver mais";
    if (b.textContent !== texto) b.textContent = texto;
  });
}
function instalarCarregamentoAcoesUI() {
  const acoes = {
    buscarCliente: "Entrando…",
    loginAtendente: "Entrando…",
    salvarPerfilCliente: "Salvando…",
    criarPerfilCliente: "Criando conta…",
    abrirPedidosCliente: "Buscando…",
    abrirBonusCliente: "Buscando…",
    abrirEnderecosCliente: "Buscando…",
    editarEnderecoCliente: "Abrindo…",
    aplicarCupomDesconto: "Conferindo…",
    carregarCategoriaProdutos: "Buscando…",
    criarChamadoSuporte: "Enviando…",
    enviarMensagemChamadoCliente: "Enviando…",
  };
  for (const [nome, texto] of Object.entries(acoes)) {
    const original = window[nome];
    if (typeof original !== "function") continue;
    let executando = false;
    window[nome] = async function (...args) {
      if (executando) return;
      executando = true;
      const botao = document.activeElement?.closest("button");
      const conteudo = botao?.innerHTML;
      if (botao) {
        botao.disabled = true;
        botao.setAttribute("aria-busy", "true");
        botao.textContent = texto;
      }
      try {
        return await original.apply(this, args);
      } catch (erro) {
        if (["abrirPedidosCliente", "abrirEnderecosCliente"].includes(nome))
          document.getElementById("area-perfil").innerHTML =
            "<p>Não foi possível buscar os dados. Confira sua conexão e tente novamente.</p>";
        mostrarAvisoUI(
          erro.message || "Não foi possível concluir. Confira sua conexão e tente novamente.",
        );
      } finally {
        executando = false;
        if (botao?.isConnected) {
          botao.disabled = false;
          botao.removeAttribute("aria-busy");
          botao.innerHTML = conteudo;
        }
      }
    };
  }
}
document.addEventListener("DOMContentLoaded", () => {
  if (typeof abrirTela === "function" && document.getElementById("tela-inicio")) {
    const anterior = abrirTela;
    window.abrirTela = (nome) => {
      anterior(nome);
      document.body.dataset.tela = nome;
    };
    document.body.dataset.tela = "inicio";
  }
  if (typeof abrirPerfilModo === "function" && document.getElementById("perfil-form")) {
    const anterior = abrirPerfilModo;
    window.abrirPerfilModo = (modo) => {
      perfilModoUI = modo;
      anterior(modo);
      const codigo = document.getElementById("codigo-ativacao");
      const ativo = modo === "editar" && clienteLogado?.fidelidadeAtiva;
      codigo.readOnly = !!ativo;
      if (ativo) codigo.value = clienteLogado.codigoAtivacao || "";
      codigo.setAttribute(
        "aria-label",
        ativo ? "Código CDA · somente consulta" : "Código de ativação",
      );
      document.querySelector("#box-codigo-login button").hidden = !!ativo;
      if (modo === "login") document.getElementById("btn-entrar-perfil").textContent = "Entrar";
      if (modo === "cadastro")
        document.getElementById("btn-entrar-perfil").onclick = criarPerfilCliente;
    };
  }
  const busca = document.getElementById("busca-produto");
  if (busca) {
    const b = document.createElement("button");
    b.className = "busca-limpar";
    b.setAttribute("aria-label", "Limpar busca");
    b.textContent = "×";
    b.onclick = () => {
      busca.value = "";
      filtrarCardapioPedrao("");
      busca.focus();
    };
    busca.after(b);
  }
  document.querySelectorAll("#tela-perfil>.perfil-card").forEach((card) => {
    const x = document.createElement("button");
    x.className = "ui-x";
    x.textContent = "×";
    x.setAttribute("aria-label", "Fechar minha conta");
    x.onclick = () => (card.id === "perfil-form" ? voltarPerfilUI() : abrirTela("inicio"));
    card.classList.add("ui-caixa");
    card.prepend(x);
  });
  const fecharCarrinho = document.querySelector('#modal-carrinho [onclick="fecharCarrinho()"]');
  if (fecharCarrinho) {
    fecharCarrinho.textContent = "×";
    fecharCarrinho.className = "ui-x";
    fecharCarrinho.setAttribute("aria-label", "Fechar carrinho");
    document.querySelector("#modal-carrinho .conteudo-carrinho").prepend(fecharCarrinho);
  }
  instalarNavegacaoAtendenteUI();
  instalarCarregamentoAcoesUI();
  atualizarPublicoCampanhaUI();
  organizarModulosAdminUI();
  prepararFotosAdminUI();
  atualizarAutoCardapioUI();
  for (const nome of ["salvarProdutoAdmin", "salvarEdicaoProdutoAdmin"]) {
    const original = window[nome];
    if (original)
      window[nome] = (...args) =>
        window.fotoProdutoProcessandoUI
          ? avisoOperacao("Aguarde a foto terminar de carregar.")
          : original(...args);
  }
  let pendente = false;
  const detalhesNovos = new Set();
  let atualizarFotos = false,
    atualizarCardapio = false;
  new MutationObserver((registros) => {
    for (const registro of registros)
      for (const n of registro.addedNodes) {
        if (n.nodeType !== 1) continue;
        if (
          n.matches("#produto-imagem,#edit-produto-imagem") ||
          n.querySelector("#produto-imagem,#edit-produto-imagem")
        )
          atualizarFotos = true;
        if (
          n.matches(".auto-grid-produtos") ||
          n.querySelector(".auto-grid-produtos") ||
          registro.target.closest?.(".auto-grid-produtos")
        )
          atualizarCardapio = true;
        if (n.matches('[id^="pedido-detalhes-"]')) detalhesNovos.add(n);
        n.querySelectorAll('[id^="pedido-detalhes-"]').forEach((d) => detalhesNovos.add(d));
      }
    if (!atualizarFotos && !atualizarCardapio && !detalhesNovos.size) return;
    if (pendente) return;
    pendente = true;
    requestAnimationFrame(() => {
      pendente = false;
      if (atualizarFotos) prepararFotosAdminUI();
      if (atualizarCardapio) atualizarAutoCardapioUI();
      atualizarFotos = atualizarCardapio = false;
      const lote = [...detalhesNovos];
      detalhesNovos.clear();
      lote
        .filter((d) => d.isConnected)
        .forEach((d) => {
          if (d.querySelector(".ui-acoes-pedido")) return;
          const id = d.id.slice("pedido-detalhes-".length);
          const entrega = d.dataset.entrega === "true";
          d.insertAdjacentHTML("beforeend", acoesRegistroUI("pedidos", id, entrega));
        });
    });
  }).observe(document.body, { childList: true, subtree: true });
});
