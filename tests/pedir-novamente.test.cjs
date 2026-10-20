const fs = require("node:fs"),
  vm = require("node:vm"),
  assert = require("node:assert/strict");
const ctx = vm.createContext({
  carrinho: [],
  carrinhoVersao: 0,
  PRECO_MOLHO_PAGO: 2,
  buscarProdutoAtual: (nome) => ({ nome, preco: 25 }),
  atualizarCarrinho() {},
  abrirTela() {},
  setTimeout() {},
});
const fonte = fs.readFileSync("js/script.js", "utf8");
vm.runInContext(
  fonte.slice(
    fonte.indexOf("function pedirNovamente("),
    fonte.indexOf("function pedidoUsouBonus("),
  ),
  ctx,
);
const antigo = [
  {
    nome: "Lanche",
    quantidade: 2,
    observacao: "Sem cebola",
    adicionais: [{ nome: "Bacon", qtd: 1, preco: 5 }],
    molhosPagos: [{ nome: "Mostarda", qtd: 2, preco: 2 }],
    molhosGratis: [{ texto: "2 Ketchup" }],
  },
];
ctx.pedirNovamente(antigo);
assert.equal(ctx.carrinho[0].obs, "Sem cebola");
assert.equal(ctx.carrinho[0].preco, 30);
assert.equal(ctx.carrinho[0].subtotal, 60);
assert.equal(ctx.carrinho[0].totalMolhosPagos, 4);
ctx.carrinho[0].adicionais[0].qtd = 3;
assert.equal(antigo[0].adicionais[0].qtd, 1);
ctx.pedirNovamente([
  {
    nome: "Combo",
    qtd: 1,
    lanchesCombo: [
      { observacao: "Sem tomate", adicionais: [{ nome: "Queijo", qtd: 2, preco: 3 }] },
    ],
  },
]);
assert.equal(ctx.carrinho[0].preco, 31);
assert.equal(ctx.carrinho[0].lanchesCombo[0].observacao, "Sem tomate");
assert.equal(ctx.carrinhoVersao, 2);
console.log(
  "PASS: repetir preserva observações, adicionais, molhos e combos sem alterar histórico; usa preço base atual.",
);
