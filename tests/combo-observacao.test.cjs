const fs = require("node:fs"),
  vm = require("node:vm"),
  assert = require("node:assert/strict");
const titulo = { hidden: false, matches: () => true };
const campo = { hidden: false, value: "Sem tomate", previousElementSibling: titulo };
const ctx = vm.createContext({
  document: { getElementById: () => campo, querySelector: () => null },
  configuracaoTodosCombo: null,
  configuracoesLanchesCombo: {},
  modoPersonalizacaoComboAuto: "todos",
  configuracaoTodosComboAuto: null,
  configuracoesLanchesComboAuto: {},
});
const fonte = fs.readFileSync("js/janelas-fluxos.js", "utf8");
vm.runInContext(
  fonte.slice(
    fonte.indexOf("function atualizarObservacaoComboUI("),
    fonte.indexOf("function organizarProdutoPainelUI("),
  ),
  ctx,
);
for (const auto of [false, true]) {
  ctx.atualizarObservacaoComboUI(auto);
  assert.equal(campo.hidden, false);
  if (auto) ctx.configuracaoTodosComboAuto = { adicionais: [{ qtd: 1 }] };
  else ctx.configuracoesLanchesCombo = { 2: { adicionais: [{ qtd: 1 }] } };
  ctx.atualizarObservacaoComboUI(auto);
  assert.equal(campo.hidden, false);
  assert.equal(campo.value, "Sem tomate");
  ctx.configuracaoTodosComboAuto = null;
  ctx.configuracoesLanchesCombo = {};
  ctx.atualizarObservacaoComboUI(auto);
  assert.equal(campo.hidden, false);
}
console.log(
  "PASS: observação geral permanece no card e conserva o texto com e sem acréscimos nos dois fluxos.",
);
