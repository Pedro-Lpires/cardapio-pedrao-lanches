const fs = require("node:fs");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const elements = {};
let closed = 0;
const parent = { matches: () => false };
const outer = {
  matches: () => true,
  close: () => {
    closed++;
  },
};
for (const id of ["config-individual-combo", "config-todos-combo", "modal-config-lanche-combo-3"]) {
  elements[id] = { style: { display: "none" }, innerHTML: "", parentElement: parent };
}
// O editor do terceiro lanche está dentro da janela da lista, mas não é uma janela aberta.
elements["modal-config-lanche-combo-3"].closest = () => outer;
const ctx = vm.createContext({
  modoPersonalizacaoCombo: "individual",
  configuracoesLanchesCombo: {
    1: { adicionais: [{ id: "alface", qtd: 1 }] },
    2: { adicionais: [{ id: "calabresa", qtd: 2 }] },
  },
  atualizarStatusLancheCombo() {},
  atualizarPrecoComboPersonalizado() {},
  selecionarModoCombo: async () => {},
  abrirConfiguracaoTodosCombo: async () => {},
  abrirConfiguracaoLancheCombo: async () => {},
  fecharConfiguracaoTodosCombo() {},
  abrirJanelaElementoUI(el) {
    el.parentElement = outer;
    el.style.display = "block";
    return outer;
  },
  document: {
    querySelector: () => null,
    getElementById: (id) => elements[id] || null,
    addEventListener: (name, fn) => {
      if (name === "DOMContentLoaded") fn();
    },
  },
});
ctx.window = ctx;
const fonte = fs.readFileSync("js/produto-comanda.js", "utf8");
for (const nome of ["limparConfiguracaoLancheCombo", "fecharConfiguracaoLancheCombo"]) {
  const start = fonte.indexOf("function " + nome + "(");
  const end = fonte.indexOf("\nfunction ", start + 1);
  vm.runInContext(fonte.slice(start, end < 0 ? undefined : end), ctx);
}
vm.runInContext(fs.readFileSync("js/janelas-fluxos.js", "utf8"), ctx);
(async () => {
  ctx.limparConfiguracaoLancheCombo(3);
  assert.equal(closed, 0, "Limpar lanche fechado não deve fechar a janela da lista");
  assert.equal(ctx.configuracoesLanchesCombo[1].adicionais[0].qtd, 1);
  assert.equal(ctx.configuracoesLanchesCombo[2].adicionais[0].qtd, 2);
  elements["modal-config-lanche-combo-3"].parentElement = outer;
  ctx.fecharConfiguracaoLancheCombo(3);
  assert.equal(closed, 1, "Fechar editor aberto deve fechar apenas sua própria janela");
  await ctx.selecionarModoCombo("individual");
  assert.equal(
    elements["config-individual-combo"].style.display,
    "block",
    "Mesmo modo deve reabrir após X",
  );
  console.log(
    "PASS: limpar terceiro combo mantém a lista e os outros lanches; fechar editor e reabrir Individual.",
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
