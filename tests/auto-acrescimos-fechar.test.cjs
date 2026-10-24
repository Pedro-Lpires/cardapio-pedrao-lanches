const fs = require("node:fs"),
  vm = require("node:vm"),
  assert = require("node:assert/strict");
const fonte = fs.readFileSync("js/janelas-fluxos.js", "utf8");
let fechar;
const contador = { textContent: "0" };
const conteudo = { style: {}, querySelectorAll: () => [contador], querySelector: () => true };
const ctx = vm.createContext({
  adicionaisAutoSelecionados: { bacon: { nome: "Bacon", qtd: 0 } },
  structuredClone,
  document: { getElementById: (id) => (id === "lista-adicionais-auto" ? conteudo : null) },
  abrirJanelaElementoUI: () => ({ addEventListener() {} }),
  configurarAcrescimosImediatosUI: (j, aplicar) => {
    fechar = aplicar;
  },
});
vm.runInContext(
  fonte.slice(
    fonte.indexOf("function abrirAcrescimosJanelaUI("),
    fonte.indexOf("function resumoAcrescimosHtmlUI("),
  ),
  ctx,
);
ctx.abrirAcrescimosJanelaUI("lista-adicionais-auto");
ctx.adicionaisAutoSelecionados.bacon.qtd = 2;
contador.textContent = "2";
fechar();
assert.equal(ctx.adicionaisAutoSelecionados.bacon.qtd, 2);
assert.equal(contador.textContent, "2");
ctx.abrirAcrescimosJanelaUI("lista-adicionais-auto");
ctx.adicionaisAutoSelecionados.bacon.qtd = 0;
contador.textContent = "0";
fechar();
assert.equal(
  ctx.adicionaisAutoSelecionados.bacon.qtd,
  0,
  "Fechar também conserva a remoção manual",
);

for (const individual of [false, true]) {
  let limpar;
  const campo = { textContent: "1" };
  const area = {
    style: {},
    innerHTML: "",
    parentElement: { matches: () => false },
    querySelector: () => null,
    querySelectorAll: (s) => (s === "textarea" ? [] : [campo]),
    append: (b) => {
      limpar = b;
    },
  };
  const janela = {
    classList: { add() {} },
    eventos: [],
    addEventListener(n, f) {
      this.eventos.push(f);
    },
    close() {
      this.cancelar?.();
      this.eventos.forEach((f) => f());
    },
  };
  const jctx = vm.createContext({
    structuredClone,
    configuracaoTodosComboAuto: { adicionais: [{ qtd: 1 }], observacao: "" },
    configuracoesLanchesComboAuto: { 2: { adicionais: [{ qtd: 1 }], observacao: "" } },
    quantidadeComboAuto: 1,
    document: { getElementById: () => area, createElement: () => ({}) },
    abrirJanelaElementoUI: () => janela,
    configurarRascunhoAcrescimosUI: (j, a, c) => {
      j.cancelar = c;
    },
    sincronizarConfiguracaoTodosComboAuto: () => {
      jctx.configuracaoTodosComboAuto = null;
    },
    sincronizarConfiguracaoLancheComboAuto: () => {
      delete jctx.configuracoesLanchesComboAuto[2];
    },
    atualizarResumoTodosComboAuto() {},
    atualizarStatusLancheComboAuto() {},
    atualizarPrecoComboAuto() {},
    comboAutoAtual: { comboQtdLanches: 3 },
  });
  jctx.window = jctx;
  for (const nome of [
    "abrirConfiguracaoTodosComboAuto",
    "fecharConfiguracaoTodosComboAuto",
    "abrirConfiguracaoLancheComboAuto",
    "fecharConfiguracaoLancheComboAuto",
  ])
    jctx[nome] = () => {};
  vm.runInContext(
    fonte.slice(
      fonte.indexOf("  // O autoatendimento mantém a seleção imediata"),
      fonte.indexOf("  // O indicador pertence ao clique"),
    ),
    jctx,
  );
  const abrir = () =>
    individual ? jctx.abrirConfiguracaoLancheComboAuto(2) : jctx.abrirConfiguracaoTodosComboAuto();
  abrir();
  const atual = () =>
    individual ? jctx.configuracoesLanchesComboAuto[2] : jctx.configuracaoTodosComboAuto;
  atual().adicionais[0].qtd = 2;
  janela.close();
  assert.equal(atual().adicionais[0].qtd, 2, "X conserva os acréscimos do combo");
  abrir();
  limpar.onclick();
  janela.close();
  assert.equal(atual(), individual ? undefined : null, "X conserva o Limpar");
}
console.log(
  "PASS: X mantém escolhas e remoções no lanche e nos combos Todos/Individual do autoatendimento.",
);
