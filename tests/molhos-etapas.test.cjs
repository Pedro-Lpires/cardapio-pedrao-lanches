const fs = require("node:fs"),
  vm = require("node:vm"),
  assert = require("node:assert/strict");
const fonte = fs.readFileSync("js/script.js", "utf8"),
  campos = {};
const campo = (id) => (campos[id] ||= { style: {}, innerHTML: "", textContent: "" });
let janela;
function criarJanela() {
  const elementos = {},
    eventos = {};
  return {
    dataset: {},
    open: false,
    innerHTML: "",
    setAttribute() {},
    remove() {},
    querySelector(s) {
      return (elementos[s] ||= { innerHTML: "", textContent: "", focus() {} });
    },
    addEventListener(nome, fn) {
      eventos[nome] = fn;
    },
    showModal() {
      this.open = true;
    },
    close() {
      this.open = false;
      eventos.close?.();
    },
  };
}
const ctx = vm.createContext({
  carrinho: [
    {
      nome: "Combo 3",
      categoria: "Combos",
      comboQtdLanches: 3,
      qtd: 1,
      molhosPagos: [{ nome: "Barbecue", qtd: 1 }],
    },
  ],
  molhosGratisTempUI: [],
  janelaMolhoUnidadeUI: null,
  escolhaMolhoTempUI: null,
  unidadeMolhoTempUI: null,
  etapaMolhoUnidadeUI: "tipo",
  PRECO_MOLHO_PAGO: 2,
  dadosPedidoTemporario: { areaUrbanaConfirmada: true },
  escaparOperacao: String,
  alert: (msg) => assert.fail(msg),
  exibirRevisao() {},
  document: {
    getElementById: campo,
    body: { append() {} },
    createElement() {
      return (janela = criarJanela());
    },
  },
});
for (const nome of [
  "abrirMolhosItem",
  "normalizarMolhoGratisUI",
  "htmlOpcaoMolhoUI",
  "htmlBlocoMolhoUI",
  "atualizarBlocoMolhoUI",
  "definirSemMolhoUI",
  "abrirEscolhaMolhoUI",
  "renderizarJanelaMolhoUI",
  "selecionarTipoMolhoUI",
  "alternarMolhoGratisUI",
  "confirmarMolhoUnidadeUI",
  "alterarMolhoPago",
  "salvarMolhosItem",
  "fecharModalMolhos",
]) {
  const inicio = fonte.indexOf(`function ${nome}(`),
    fim = fonte.indexOf("\nfunction ", inicio + 1);
  assert(inicio >= 0, nome);
  vm.runInContext(fonte.slice(inicio, fim < 0 ? undefined : fim), ctx);
}
ctx.abrirMolhosItem(0);
assert.equal(ctx.molhosGratisTempUI.length, 3, "Um grupo por lanche do combo");
assert(!ctx.htmlBlocoMolhoUI(1).includes("Maionese"), "Sem molho não expande sabores");
ctx.abrirEscolhaMolhoUI(2);
assert.equal(janela.dataset.etapa, "tipo");
ctx.selecionarTipoMolhoUI("doisiguais");
ctx.alternarMolhoGratisUI("Ketchup");
ctx.confirmarMolhoUnidadeUI();
assert.equal(ctx.molhosGratisTempUI[1].texto, "2 Ketchup");
assert.equal(ctx.molhosGratisTempUI[0].tipo, "semmolho");
assert(!ctx.carrinho[0].molhosGratis, "A janela filha altera o rascunho até salvar o item");
ctx.abrirEscolhaMolhoUI(1);
ctx.selecionarTipoMolhoUI("umdecada");
ctx.alternarMolhoGratisUI("Maionese");
ctx.alternarMolhoGratisUI("Mostarda");
janela.querySelector(".ui-voltar").onclick();
assert.equal(janela.dataset.etapa, "tipo", "Voltar retorna à escolha de quantidade");
ctx.selecionarTipoMolhoUI("umdecada");
assert.deepEqual(Array.from(ctx.escolhaMolhoTempUI.molhos), ["Maionese", "Mostarda"]);
janela.querySelector(".ui-x").onclick();
assert.equal(
  ctx.molhosGratisTempUI[0].tipo,
  "semmolho",
  "X descarta a escolha filha não confirmada",
);
ctx.abrirEscolhaMolhoUI(1);
ctx.selecionarTipoMolhoUI("umdecada");
ctx.alternarMolhoGratisUI("Maionese");
ctx.alternarMolhoGratisUI("Ketchup");
ctx.confirmarMolhoUnidadeUI();
ctx.alterarMolhoPago("Barbecue", 1);
ctx.salvarMolhosItem();
assert.equal(ctx.carrinho[0].molhosGratis[0].texto, "Maionese + Ketchup");
assert.equal(ctx.carrinho[0].molhosGratis[1].texto, "2 Ketchup");
assert.equal(ctx.carrinho[0].molhosGratis[2].texto, "Sem molho");
assert.equal(ctx.carrinho[0].totalMolhosPagos, 4);
ctx.abrirMolhosItem(0);
ctx.definirSemMolhoUI(2);
assert(!ctx.htmlBlocoMolhoUI(2).includes("molho-resumo-ui"));
ctx.fecharModalMolhos();
ctx.abrirMolhosItem(0);
assert.equal(
  ctx.molhosGratisTempUI[1].texto,
  "Sem molho",
  "Fechar aplica a escolha e reabrir mantém os molhos",
);
ctx.definirSemMolhoUI(2);
ctx.salvarMolhosItem();
assert.equal(ctx.carrinho[0].molhosGratis[1].tipo, "semmolho");
ctx.carrinho = [{ nome: "Lanche", qtd: 2 }];
ctx.abrirMolhosItem(0);
assert.equal(ctx.molhosGratisTempUI.length, 2, "Quantidade comum mantém unidades independentes");
console.log(
  "PASS: etapas Sem/Com, 1 de cada/2 iguais, Voltar/X, rascunhos isolados, três lanches do combo, reabertura e molhos pagos preservados.",
);
const editor = fs.readFileSync("js/editor-pedido-personalizacao-ui.js", "utf8");
vm.runInContext(
  editor.slice(
    editor.indexOf("function valorMolhosGratisEditorUI"),
    editor.indexOf("function prepararMolhosGratisEditorUI"),
  ),
  ctx,
);
assert.equal(
  ctx.valorMolhosGratisEditorUI({ tipo: "doisiguais", texto: "2 Maionese" }),
  "2:Maionese",
);
assert.equal(
  ctx.valorMolhosGratisEditorUI({ tipo: "umdecada", molhos: ["Maionese", "Ketchup"] }),
  "Maionese+Ketchup",
);
assert.equal(ctx.valorMolhosGratisEditorUI({ tipo: "semmolho", texto: "2 Maionese" }), "");
