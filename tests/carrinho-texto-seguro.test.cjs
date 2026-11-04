const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  vm = require("node:vm");
const fonte = fs.readFileSync("js/script.js", "utf8");
const operacao = fs.readFileSync("js/operacao.js", "utf8");
const filhos = [];
const ataque = '<img src=x onerror="alert(1)">';
const c = vm.createContext({
  carrinho: [
    {
      nome: ataque,
      qtd: 1,
      preco: 25,
      categoria: "Lanches",
      obs: ataque,
      adicionais: [{ qtd: 1, nome: ataque }],
    },
  ],
  document: {
    getElementById: () => ({ innerHTML: "", appendChild: (e) => filhos.push(e) }),
    createElement: () => ({ classList: { add() {} }, innerHTML: "" }),
  },
});
vm.runInContext(
  operacao.slice(
    operacao.indexOf("const escaparOperacao"),
    operacao.indexOf("const moedaOperacao"),
  ),
  c,
);
vm.runInContext(
  fonte.slice(
    fonte.indexOf("function renderizarCarrinho()"),
    fonte.indexOf("function aumentarItem("),
  ),
  c,
);
c.renderizarCarrinho();
assert.equal(filhos.length, 1);
assert.doesNotMatch(filhos[0].innerHTML, /<img/);
assert.equal(filhos[0].innerHTML.split("&lt;img").length - 1, 3);
console.log(
  "PASS: nomes, acréscimos e observações do carrinho são texto escapado, sem injetar HTML.",
);
