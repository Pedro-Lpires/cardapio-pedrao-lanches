const fs = require("node:fs"),
  vm = require("node:vm"),
  assert = require("node:assert/strict");
let pronto,
  aviso = "";
const carrinho = [];
const ctx = vm.createContext({
  document: {
    getElementById: () => ({ innerText: "1" }),
    addEventListener: (nome, fn) => {
      pronto = fn;
    },
  },
  abrirProduto() {},
  adicionarProdutoFinal() {
    carrinho.push({ nome: "Combo", qtd: ctx.qtdProdutoAtual, precoBase: 40, preco: 40 });
  },
  categoriaProdutoAtual: "Combos",
  qtdProdutoAtual: 1,
  adicionaisSelecionados: {},
  carrinho,
  atualizarCarrinho() {},
  alert: (txt) => (aviso = txt),
});
ctx.window = ctx;
const produto = fs.readFileSync("js/script.js", "utf8");
vm.runInContext(
  produto.slice(
    produto.indexOf("function alterarQtdProduto("),
    produto.indexOf("let adicionais = []"),
  ),
  ctx,
);
vm.runInContext(fs.readFileSync("js/combos-site-ui.js", "utf8"), ctx);
pronto();
vm.runInContext(
  'comboSiteUI={modo:"individual",lanches:[{adicionais:{a:{nome:"Cheddar",preco:3,qtd:2}},observacao:"Sem cebola"},{adicionais:{},observacao:""},{adicionais:{b:{nome:"Bacon",preco:5,qtd:1}},observacao:""}]};',
  ctx,
);
assert.equal(ctx.extrasComboSiteUI(), 11);
ctx.adicionarProdutoFinal();
assert.equal(carrinho[0].preco, 51);
assert.equal(carrinho[0].precoBase, 40);
assert.equal(carrinho[0].lanchesCombo[0].adicionais[0].qtd, 2);
assert.match(ctx.resumoComboTextoSiteUI(carrinho[0]), /Lanche 1: 2 Cheddar; Obs.: Sem cebola/);
ctx.qtdProdutoAtual = 2;
ctx.adicionarProdutoFinal();
assert.equal(carrinho.length, 1);
assert.match(aviso, /uma unidade/);
assert.equal(ctx.qtdProdutoAtual, 1);
assert.equal(aviso, "Combos com adicionais devem ser adicionados ao carrinho uma unidade por vez.");
aviso = "";
ctx.alterarQtdProduto(1);
assert.equal(ctx.qtdProdutoAtual, 1);
assert.match(aviso, /^Combos com adicionais/);
vm.runInContext("comboSiteUI.lanches.forEach(c => c.adicionais = {});", ctx);
aviso = "";
ctx.alterarQtdProduto(1);
assert.equal(ctx.qtdProdutoAtual, 2);
assert.equal(aviso, "");
console.log(
  "PASS: combo do site soma acréscimos por lanche, preserva observação e impede duplicar combo personalizado.",
);
