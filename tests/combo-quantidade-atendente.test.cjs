const fs = require("node:fs"),
  vm = require("node:vm"),
  assert = require("node:assert/strict");
const avisos = [];
const elementos = {
  "quantidade-produto-config": { textContent: "1" },
  "preco-produto-config": { dataset: { precoBase: "80" }, textContent: "R$ 80.00" },
  "qtd-todos-adicional-extra": { textContent: "0" },
  "qtd-combo-adicional-extra": { textContent: "0" },
  "observacao-todos-combo": { value: "" },
  "observacao-lanche-combo-1": { value: "" },
};
const adicional = { dataset: { id: "extra", nome: "Bacon", preco: "5" } };
const ctx = vm.createContext({
  modoPersonalizacaoCombo: "todos",
  configuracaoTodosCombo: null,
  configuracoesLanchesCombo: {},
  quantidadeLanchesComboAtual: 3,
  document: {
    querySelector: () => null,
    getElementById: (id) => elementos[id] || null,
    querySelectorAll: (seletor) => (seletor === ".adicional-produto-config" ? [] : [adicional]),
  },
  atualizarResumoTodosCombo() {},
  atualizarStatusLancheCombo() {},
  fecharConfiguracaoTodosCombo() {},
  fecharConfiguracaoLancheCombo() {},
  alert: (texto) => avisos.push(texto),
});
const fonte = fs.readFileSync("js/produto-comanda.js", "utf8");
for (const nome of [
  "configuracaoComboTemAlteracoes",
  "configuracoesAtivasCombo",
  "produtoTemAcrescimos",
  "alterarQuantidadeProduto",
  "atualizarPrecoComboPersonalizado",
  "salvarConfiguracaoTodosCombo",
  "salvarConfiguracaoLancheCombo",
  "limparConfiguracaoTodosCombo",
  "limparConfiguracaoLancheCombo",
]) {
  const inicio = fonte.indexOf("function " + nome + "(");
  const fim = fonte.indexOf("\nfunction ", inicio + 1);
  const fimAsync = fonte.indexOf("\nasync function ", inicio + 1);
  const final = Math.min(...[fim, fimAsync].filter((n) => n >= 0));
  vm.runInContext(fonte.slice(inicio, final), ctx);
}
const quantidade = () => Number(elementos["quantidade-produto-config"].textContent);
ctx.alterarQuantidadeProduto(1);
assert.equal(quantidade(), 2, "Escolher Todos sem alterações não bloqueia");
elementos["qtd-todos-adicional-extra"].textContent = "1";
ctx.salvarConfiguracaoTodosCombo();
assert.equal(quantidade(), 1, "Aplicar acréscimos limita a uma unidade");
ctx.alterarQuantidadeProduto(1);
assert.equal(quantidade(), 1);
assert.equal(avisos.at(-1), "Retire os acréscimos para aumentar a quantidade.");
const avisosAntes = avisos.length;
ctx.alterarQuantidadeProduto(-1);
assert.equal(avisos.length, avisosAntes, "Menos não precisa de aviso");
elementos["qtd-todos-adicional-extra"].textContent = "0";
ctx.salvarConfiguracaoTodosCombo();
assert.equal(ctx.configuracaoTodosCombo, null);
ctx.alterarQuantidadeProduto(1);
assert.equal(quantidade(), 2, "Zerar os acréscimos por menos libera a quantidade");
elementos["qtd-todos-adicional-extra"].textContent = "1";
ctx.salvarConfiguracaoTodosCombo();
ctx.limparConfiguracaoTodosCombo();
ctx.alterarQuantidadeProduto(1);
assert.equal(quantidade(), 2, "Limpar Todos libera sem reabrir o combo");

ctx.modoPersonalizacaoCombo = "individual";
elementos["qtd-combo-adicional-extra"].textContent = "1";
ctx.salvarConfiguracaoLancheCombo(1);
ctx.configuracoesLanchesCombo[2] = { adicionais: [{ qtd: 1 }], observacao: "" };
elementos["qtd-combo-adicional-extra"].textContent = "0";
ctx.salvarConfiguracaoLancheCombo(1);
ctx.alterarQuantidadeProduto(1);
assert.equal(quantidade(), 1, "Ainda há um acréscimo no segundo lanche");
ctx.limparConfiguracaoLancheCombo(2);
ctx.alterarQuantidadeProduto(1);
assert.equal(quantidade(), 2, "Limpar o último lanche libera Individual");
ctx.configuracoesLanchesCombo = { 1: { adicionais: [{ qtd: 0 }], observacao: "" } };
assert.equal(ctx.configuracaoComboTemAlteracoes(ctx.configuracoesLanchesCombo[1]), false);
ctx.alterarQuantidadeProduto(1);
assert.equal(quantidade(), 3, "Configuração vazia antiga não bloqueia");
ctx.configuracoesLanchesCombo[1].observacao = "Sem cebola";
ctx.alterarQuantidadeProduto(1);
assert.equal(avisos.at(-1), "Remova as observações dos lanches para aumentar a quantidade.");
console.log(
  "PASS: aviso no + com acréscimos; zerar por menos e Limpar liberam Todos/Individual sem reabrir; configuração vazia não personaliza.",
);
