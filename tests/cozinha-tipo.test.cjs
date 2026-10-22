const fs = require("node:fs"),
  vm = require("node:vm"),
  assert = require("node:assert/strict");
const fonte = fs.readFileSync("js/operacao.js", "utf8");
const ctx = vm.createContext({ escaparOperacao: String, serializarOperacao: JSON.stringify });
vm.runInContext(
  fonte.slice(
    fonte.indexOf("function identidadeItemOperacao("),
    fonte.indexOf("function itensHtmlOperacao("),
  ),
  ctx,
);
const itens = ctx.agruparItensOperacao([
  { nome: "Baguncinha", quantidade: 2, tipo: "industrial" },
  { nome: "Baguncinha", quantidade: 1, tipo: "artesanal" },
]);
assert.equal(itens.length, 2);
assert.equal(itens[0].carne, "industrial");
assert.match(ctx.detalhesItemOperacao(itens[0]), /industrial/);
assert.match(ctx.detalhesItemOperacao(itens[1]), /artesanal/);
console.log("PASS: cozinha distingue e mostra industrial/artesanal salvos no campo tipo.");
