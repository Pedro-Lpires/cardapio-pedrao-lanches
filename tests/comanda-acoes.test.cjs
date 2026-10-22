const fs = require("node:fs"),
  vm = require("node:vm"),
  assert = require("node:assert/strict");
const botoes = [
  { dataset: { acaoComanda: "editar" }, hidden: true },
  { dataset: { acaoComanda: "remover" }, hidden: true },
];
let consultas = 0;
const ctx = vm.createContext({
  modoEditarItem: false,
  modoRemoverItem: false,
  document: { querySelectorAll: () => botoes },
  abrirComandaVisual: () => consultas++,
});
const fonte = fs.readFileSync("js/atendente.js", "utf8");
for (const nome of ["ativarEditarItens", "ativarRemoverItens", "atualizarAcoesItensComandaUI"]) {
  const a = fonte.indexOf("function " + nome + "("),
    b = fonte.indexOf("\n}", a) + 2;
  vm.runInContext(fonte.slice(a, b), ctx);
}
ctx.ativarEditarItens("comanda");
assert.equal(botoes[0].hidden, false);
assert.equal(botoes[1].hidden, true);
ctx.ativarRemoverItens("comanda");
assert.equal(botoes[0].hidden, true);
assert.equal(botoes[1].hidden, false);
ctx.ativarRemoverItens("comanda");
assert(botoes.every((b) => b.hidden));
assert.equal(consultas, 0);
console.log(
  "PASS: editar/remover apenas alternam ações nos mesmos elementos, sem buscar ou reconstruir a comanda.",
);
