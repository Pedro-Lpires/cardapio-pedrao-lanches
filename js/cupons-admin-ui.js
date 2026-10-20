/** Editor e consulta de cupons em etapas, sem expandir formulários na página. */
let formularioCupomModeloUI = "";
let cupomEmEdicaoUI = null;
let cuponsListaUI = [],
  usoListaCuponsUI = null,
  tipoListaCuponsUI = null;
function montarCuponsAdminUI() {
  const secao = document.querySelector(".admin-cupons");
  if (!secao) return;
  const modelo = secao.cloneNode(true);
  modelo.querySelectorAll("h2,button,#lista-cupons-admin").forEach((el) => el.remove());
  const tipo = modelo.querySelector("#cupom-tipo");
  tipo.hidden = true;
  const nomes = {
    "cupom-nome": "Nome do cupom",
    "cupom-codigo": "Código",
    "cupom-modo": "Desconto",
    "cupom-valor": "Valor do desconto",
    "cupom-km-gratis": "Taxa grátis até quantos km?",
    "cupom-item-geral-tipo": "Grupo de produtos",
    "cupom-item-geral-modo": "Desconto no grupo",
    "cupom-item-geral-valor": "Valor do desconto",
    "cupom-item-nome": "Nome do item",
    "cupom-item-preco-promocional": "Preço promocional do item",
    "cupom-pedido-minimo": "Valor mínimo do pedido",
  };
  modelo.querySelectorAll("input:not([type=checkbox]), select").forEach((campo) => {
    if (campo.id === "cupom-tipo") return;
    const label = document.createElement("label");
    label.className = "cupom-campo-ui";
    label.htmlFor = campo.id;
    label.textContent = nomes[campo.id] || campo.placeholder || "Valor";
    campo.before(label);
    if (campo.type === "number") {
      campo.min = "0";
      campo.step = "0.01";
    }
  });
  formularioCupomModeloUI = modelo.innerHTML;
  secao.innerHTML =
    '<h2>🏷️ Cupons de Desconto</h2><p>Crie um código de uso diverso ou um código que deixa de valer após o primeiro uso.</p><div class="cupons-menu-ui"><button type="button" onclick="abrirEditorCupomAdminUI()">Novo cupom</button><button type="button" id="cupons-listar-toggle" aria-expanded="false" onclick="listarCuponsDesconto()">Buscar/listar cupons</button></div><p class="cupons-admin-status" role="status"></p>';
}
function etapaEditorCupomUI(etapa) {
  document
    .querySelectorAll("#cupons-editor-corpo [data-etapa-cupom]")
    .forEach((el) => (el.hidden = el.dataset.etapaCupom !== etapa));
}
async function abrirEditorCupomAdminUI(codigo = null) {
  if (!adminAvancadoLiberado) return;
  let dados = null;
  if (codigo) {
    const doc = await db.collection("cuponsDesconto").doc(codigo).get();
    if (!doc.exists) return avisoOperacao("Cupom não encontrado.");
    dados = doc.data();
    if (dados.usadoEm)
      return avisoOperacao("Este cupom já foi utilizado. O registro permanece no histórico.");
  }
  document.getElementById("cupons-editor-corpo")?.closest("dialog").close();
  const box = telaSuporteAdmin("cupons-editor-corpo", codigo ? "Editar cupom" : "Novo cupom");
  cupomEmEdicaoUI = codigo;
  box.classList.add("cupons-ui");
  box.innerHTML =
    '<input type="hidden" id="cupom-uso" value="diversos"><section data-etapa-cupom="uso"><h3>Como este código pode ser usado?</h3><div class="cupons-opcoes-ui"><button type="button" onclick="selecionarUsoCupomUI(\'diversos\')">Uso diverso</button><button type="button" onclick="selecionarUsoCupomUI(\'unico\')">1x · uso único</button></div><p>Uso diverso: continua disponível conforme as regras.<br>1x: após o primeiro uso, o código não vale mais para ninguém.</p></section><section data-etapa-cupom="tipo" hidden><button type="button" onclick="etapaEditorCupomUI(\'uso\')">← Uso</button><h3>Onde aplicar?</h3><div class="cupons-opcoes-ui"><button type="button" onclick="selecionarTipoCupomUI(\'item\')">Item</button><button type="button" onclick="selecionarTipoCupomUI(\'pedido\')">Pedido</button><button type="button" onclick="selecionarTipoCupomUI(\'taxa\')">Taxa de entrega</button></div></section><section data-etapa-cupom="configurar" hidden><button type="button" onclick="etapaEditorCupomUI(\'tipo\')">← Tipo</button><h3 id="cupom-config-titulo"></h3><p id="cupom-config-uso"></p><div class="cupons-config-ui">' +
    formularioCupomModeloUI +
    '</div><p id="cupom-salvar-status" role="status"></p><button id="cupom-salvar-ui" type="button" onclick="criarCupomDesconto()">Salvar cupom</button></section>';
  if (dados) {
    const campos = {
      nome: "nome",
      codigo: "codigo",
      tipo: "tipo",
      modo: "modo",
      valor: "valor",
      "km-gratis": "kmGratis",
      "item-nome": "itemNome",
      "item-preco-promocional": "itemPrecoPromocional",
      "pedido-minimo": "pedidoMinimo",
      "item-geral-tipo": "itemGeralTipo",
      "item-geral-modo": "itemGeralModo",
      "item-geral-valor": "itemGeralValor",
    };
    for (const [id, chave] of Object.entries(campos))
      document.getElementById("cupom-" + id).value = dados[chave] ?? "";
    for (const [id, chave] of [
      ["tem-minimo", "temPedidoMinimo"],
      ["item-geral", "itemGeral"],
    ])
      document.getElementById("cupom-" + id).checked = !!dados[chave];
    document.getElementById("cupom-codigo").readOnly = true;
    document.getElementById("cupom-uso").value = dados.uso === "unico" ? "unico" : "diversos";
    selecionarTipoCupomUI(dados.tipo);
  }
}
function selecionarUsoCupomUI(uso) {
  document.getElementById("cupom-uso").value = uso;
  etapaEditorCupomUI("tipo");
}
function selecionarTipoCupomUI(tipo) {
  document.getElementById("cupom-tipo").value = tipo;
  document.getElementById("cupom-config-titulo").textContent = {
    item: "Cupom de item",
    pedido: "Cupom de pedido",
    taxa: "Cupom da taxa de entrega",
  }[tipo];
  document.getElementById("cupom-config-uso").textContent =
    document.getElementById("cupom-uso").value === "unico"
      ? "1x · deixa de valer após o primeiro uso, em qualquer conta."
      : "Uso diverso · continua disponível conforme as regras.";
  etapaEditorCupomUI("configurar");
  atualizarCamposCupomAdmin();
}
async function finalizarSalvarCupomUI() {
  document.getElementById("cupons-editor-corpo")?.closest("dialog").close();
  document.querySelector(".cupons-admin-status").textContent = "Cupom salvo com sucesso.";
  if (document.getElementById("cupons-lista-corpo") && tipoListaCuponsUI)
    await carregarListaCuponsAdminUI();
}
function alternarListaCuponsAdminUI() {
  const aberto = document.getElementById("cupons-lista-corpo");
  if (aberto) {
    aberto.closest("dialog").close();
    return;
  }
  const toggle = document.getElementById("cupons-listar-toggle");
  toggle.setAttribute("aria-expanded", "true");
  const box = telaSuporteAdmin("cupons-lista-corpo", "Cupons cadastrados", () =>
    toggle.setAttribute("aria-expanded", "false"),
  );
  box.classList.add("cupons-ui");
  usoListaCuponsUI = null;
  tipoListaCuponsUI = null;
  renderizarNavegacaoCuponsUI();
}
function renderizarNavegacaoCuponsUI() {
  const box = document.getElementById("cupons-lista-corpo");
  if (!box) return;
  if (!usoListaCuponsUI) {
    box.innerHTML =
      '<h3>Escolha o uso</h3><div class="cupons-opcoes-ui"><button type="button" onclick="filtrarUsoCuponsUI(\'unico\')">1x · uso único</button><button type="button" onclick="filtrarUsoCuponsUI(\'diversos\')">Uso diverso</button></div>';
    return;
  }
  const uso = usoListaCuponsUI === "unico" ? "1x · uso único" : "Uso diverso";
  box.innerHTML =
    '<button type="button" onclick="usoListaCuponsUI=null;tipoListaCuponsUI=null;renderizarNavegacaoCuponsUI()">← Uso</button><h3>' +
    uso +
    '</h3><div class="cupons-opcoes-ui"><button type="button" onclick="filtrarTipoCuponsUI(\'item\')">Itens</button><button type="button" onclick="filtrarTipoCuponsUI(\'taxa\')">Taxa de entrega</button><button type="button" onclick="filtrarTipoCuponsUI(\'pedido\')">Pedido</button></div><div id="cupons-lista-resultados" aria-live="polite"></div>';
}
function filtrarUsoCuponsUI(uso) {
  usoListaCuponsUI = uso;
  tipoListaCuponsUI = null;
  renderizarNavegacaoCuponsUI();
}
async function filtrarTipoCuponsUI(tipo) {
  tipoListaCuponsUI = tipo;
  await carregarListaCuponsAdminUI();
}
async function carregarListaCuponsAdminUI() {
  const box = document.getElementById("cupons-lista-resultados");
  if (!box || !tipoListaCuponsUI) return;
  box.textContent = "Buscando cupons...";
  const uso = usoListaCuponsUI,
    tipo = tipoListaCuponsUI;
  try {
    const snap = await db.collection("cuponsDesconto").where("tipo", "==", tipo).get();
    if (!box.isConnected || uso !== usoListaCuponsUI || tipo !== tipoListaCuponsUI) return;
    cuponsListaUI = snap.docs
      .map((d) => ({ ...d.data(), id: d.id }))
      .filter((c) => (c.uso === "unico" ? "unico" : "diversos") === uso);
    const esc = escaparOperacao;
    box.innerHTML =
      "<h4>" +
      { item: "Itens", taxa: "Taxa de entrega", pedido: "Pedido" }[tipo] +
      "</h4>" +
      (cuponsListaUI.length
        ? cuponsListaUI
            .map(
              (c) =>
                '<article class="cupom-registro-ui"><div class="cupom-registro-topo"><strong>' +
                esc(c.nome) +
                "</strong><span>" +
                (c.usadoEm ? "Utilizado" : c.ativo ? "Ativo" : "Inativo") +
                '</span></div><p class="cupom-codigo-ui">' +
                esc(c.codigo || c.id) +
                "</p><dl><div><dt>Uso</dt><dd>" +
                (c.uso === "unico" ? "1x por código" : "Diverso") +
                "</dd></div><div><dt>Condição</dt><dd>" +
                esc(
                  c.tipo === "item"
                    ? c.itemGeral
                      ? "Grupo: " + c.itemGeralTipo
                      : c.itemNome + " por " + moedaOperacao(c.itemPrecoPromocional)
                    : c.modo === "gratis"
                      ? "Taxa grátis até " + c.kmGratis + " km"
                      : c.modo === "porcentagem"
                        ? c.valor + "%"
                        : moedaOperacao(c.valor),
                ) +
                "</dd></div><div><dt>Pedido mínimo</dt><dd>" +
                (c.temPedidoMinimo ? moedaOperacao(c.pedidoMinimo) : "Não exige") +
                "</dd></div></dl>" +
                (c.usadoEm
                  ? "<p>Usado em " + new Date(c.usadoEm).toLocaleString("pt-BR") + "</p>"
                  : '<div class="cupons-acoes-ui"><button type="button" onclick="editarCupomDesconto(\'' +
                    esc(c.id) +
                    '\')">Editar</button><button type="button" onclick="alternarCupomDesconto(\'' +
                    esc(c.id) +
                    "'," +
                    !c.ativo +
                    ')">' +
                    (c.ativo ? "Pausar" : "Ativar") +
                    '</button><button type="button" onclick="excluirCupomDesconto(\'' +
                    esc(c.id) +
                    "')\">Excluir</button></div>") +
                "</article>",
            )
            .join("")
        : "<p>Nenhum cupom nesta categoria.</p>");
  } catch {
    if (box.isConnected) box.textContent = "Não foi possível buscar cupons. Tente novamente.";
  }
}
document.addEventListener("DOMContentLoaded", montarCuponsAdminUI);
