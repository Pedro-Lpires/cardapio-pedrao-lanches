const fs = require("node:fs");
const vm = require("node:vm");
const assert = require("node:assert/strict");

// Exercita a seleção imediata sem Firebase ou gravação de pedidos reais.
const fonte = fs.readFileSync("js/autoatendimento.js", "utf8");
const campos = {};
const campo = (id) => (campos[id] ??= { textContent: "0", value: "", style: {}, innerHTML: "" });
const opcao = { dataset: { id: "carne", nome: "Hambúrguer", preco: "8" } };
const ctx = vm.createContext({
  configuracaoTodosComboAuto: null,
  configuracoesLanchesComboAuto: {},
  adicionaisAutoatendimento: [{ id: "carne", nome: "Hambúrguer", preco: 8 }],
  comboAutoAtual: { id: "combo", nome: "Combo", preco: 80, comboQtdLanches: 3 },
  modoPersonalizacaoComboAuto: "todos",
  quantidadeComboAuto: 1,
  carrinhoAutoatendimento: [],
  indiceItemAutoEmEdicao: null,
  voltarResumoDepoisEdicaoAuto: false,
  atualizarCarrinhoAuto() {},
  fecharComboAuto() {},
  alert() {},
  document: { getElementById: campo, querySelectorAll: () => [opcao] },
});
for (const nome of [
  "abrirConfiguracaoTodosComboAuto",
  "alterarAdicionalTodosComboAuto",
  "sincronizarConfiguracaoTodosComboAuto",
  "atualizarResumoTodosComboAuto",
  "fecharConfiguracaoTodosComboAuto",
  "limparConfiguracaoTodosComboAuto",
  "abrirConfiguracaoLancheComboAuto",
  "alterarAdicionalLancheComboAuto",
  "sincronizarConfiguracaoLancheComboAuto",
  "atualizarStatusLancheComboAuto",
  "fecharConfiguracaoLancheComboAuto",
  "atualizarPrecoComboAuto",
  "adicionarComboCarrinhoAuto",
  "selecionarModoComboAuto",
  "comboAutoTemAcrescimos",
  "permitirAcrescimoComboAuto",
  "alterarQtdComboAuto",
]) {
  const inicio = fonte.indexOf(`function ${nome}(`);
  const fim = fonte.indexOf("\nfunction ", inicio + 1);
  assert(inicio >= 0, nome);
  vm.runInContext(fonte.slice(inicio, fim < 0 ? undefined : fim), ctx);
}
ctx.abrirConfiguracaoTodosComboAuto();
assert(!campo("config-todos-combo-auto").innerHTML.includes("✅ Salvar"));
ctx.alterarAdicionalTodosComboAuto("carne", 1);
assert.equal(ctx.configuracaoTodosComboAuto.adicionais[0].qtd, 1);
assert.equal(campo("combo-preco-auto").textContent, "R$ 104.00");
assert.equal(campo("config-todos-combo-auto").style.display, "block");
ctx.fecharConfiguracaoTodosComboAuto();
ctx.abrirConfiguracaoTodosComboAuto();
assert.equal(ctx.configuracaoTodosComboAuto.adicionais[0].qtd, 1);
campo("observacao-combo-auto").value = "sem cebola";
ctx.sincronizarConfiguracaoTodosComboAuto();
ctx.adicionarComboCarrinhoAuto();
assert(ctx.carrinhoAutoatendimento[0].lanchesCombo.every((l) => l.adicionais[0].qtd === 1));
assert.equal(ctx.carrinhoAutoatendimento[0].observacao, "sem cebola");
ctx.limparConfiguracaoTodosComboAuto();
assert.equal(ctx.configuracaoTodosComboAuto, null);
assert.equal(campo("combo-preco-auto").textContent, "R$ 80.00");

ctx.modoPersonalizacaoComboAuto = "individual";
ctx.abrirConfiguracaoLancheComboAuto(2);
assert(!campo("config-lanche-combo-auto-2").innerHTML.includes("✅ Salvar"));
ctx.alterarAdicionalLancheComboAuto(2, "carne", 1);
assert.equal(campo("combo-preco-auto").textContent, "R$ 88.00");
ctx.abrirConfiguracaoLancheComboAuto(2);
assert.equal(campo("config-lanche-combo-auto-2").style.display, "none");
ctx.abrirConfiguracaoLancheComboAuto(2);
assert.equal(campo("config-lanche-combo-auto-2").style.display, "block");
ctx.fecharConfiguracaoLancheComboAuto(2);
assert.equal(ctx.configuracoesLanchesComboAuto[2].adicionais[0].qtd, 1);
ctx.adicionarComboCarrinhoAuto();
const lanches = ctx.carrinhoAutoatendimento[1].lanchesCombo;
assert.equal(lanches[0].adicionais.length, 0);
assert.equal(lanches[1].adicionais[0].qtd, 1);
assert.equal(lanches[2].adicionais.length, 0);
ctx.alterarAdicionalLancheComboAuto(2, "carne", -1);
ctx.alterarAdicionalLancheComboAuto(2, "carne", -1);
assert.equal(ctx.configuracoesLanchesComboAuto[2], undefined);
assert.equal(campo("qtd-lanche-combo-auto-2-carne").textContent, 0);
ctx.selecionarModoComboAuto("todos");
assert.equal(campo("config-todos-combo-auto").style.display, "block");
ctx.selecionarModoComboAuto("todos");
assert.equal(campo("modo-todos-combo-auto").style.display, "none");
assert.equal(ctx.modoPersonalizacaoComboAuto, "todos");
ctx.selecionarModoComboAuto("todos");
assert.equal(campo("modo-todos-combo-auto").style.display, "block");
ctx.limparConfiguracaoTodosComboAuto();
assert.equal(campo("config-todos-combo-auto").style.display, "block");
ctx.selecionarModoComboAuto("individual");
assert.equal(campo("modo-individual-combo-auto").style.display, "block");
assert.equal(campo("modo-todos-combo-auto").style.display, "none");
ctx.selecionarModoComboAuto("individual");
assert.equal(campo("modo-individual-combo-auto").style.display, "none");
ctx.selecionarModoComboAuto("individual");
assert.equal(campo("modo-individual-combo-auto").style.display, "block");
ctx.alterarQtdComboAuto(1);
assert.equal(ctx.quantidadeComboAuto, 2);
ctx.selecionarModoComboAuto("todos");
assert.equal(ctx.quantidadeComboAuto, 2);
ctx.alterarQtdComboAuto(1);
assert.equal(ctx.quantidadeComboAuto, 3);
// O DOM real recria os contadores ao reabrir; atualiza o campo do mock também.
campo("qtd-todos-combo-auto-carne").textContent = "0";
ctx.alterarAdicionalTodosComboAuto("carne", 1);
assert.equal(ctx.comboAutoTemAcrescimos(), true);
assert.equal(ctx.configuracaoTodosComboAuto.adicionais[0].qtd, 1);
assert.equal(ctx.quantidadeComboAuto, 1);
ctx.alterarQtdComboAuto(1);
assert.equal(ctx.quantidadeComboAuto, 1);
ctx.alterarAdicionalTodosComboAuto("carne", -1);
ctx.alterarQtdComboAuto(1);
assert.equal(ctx.quantidadeComboAuto, 2);
ctx.adicionarComboCarrinhoAuto();
assert.equal(ctx.carrinhoAutoatendimento.at(-1).quantidade, 2);
console.log(
  "PASS: acréscimos de combos imediatos, preço, X, carrinho, observações, limpar e menos sem negativos.",
);
