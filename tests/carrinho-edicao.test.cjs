const fs = require("node:fs"),
  vm = require("node:vm"),
  assert = require("node:assert/strict");
const elementos = new Map(),
  eventos = [];
const el = (id) => {
  if (!elementos.has(id))
    elementos.set(id, {
      style: {},
      setAttribute(k, v) {
        this[k] = v;
      },
      innerText: "",
      value: "",
      textContent: "",
    });
  return elementos.get(id);
};
const c = {
  console,
  Map,
  document: {
    getElementById: el,
    querySelector: (sel) => (sel.includes("button") ? el("salvar") : null),
    querySelectorAll: () => [],
    body: { classList: { add() {}, remove() {} } },
    addEventListener: (_, fn) => eventos.push(fn),
  },
  carrinho: [
    {
      produtoId: "p1",
      nome: "Baguncinha",
      categoria: "Lanches",
      qtd: 1,
      preco: 31,
      adicionais: [{ nome: "Bacon", qtd: 1, preco: 6 }],
      molhosPagos: [{ nome: "Ketchup", qtd: 1 }],
      totalMolhosPagos: 2,
    },
  ],
  adicionaisSelecionados: {},
  qtdProdutoAtual: 1,
  buscarProdutoAtual: () => ({ id: "p1", nome: "Baguncinha", preco: 25 }),
  atualizarResumoAdicionaisProdutoUI() {},
  atualizarCarrinho() {},
  renderizarCarrinho() {},
  avisoOperacao() {},
  alert() {},
  fecharCarrinho() {},
  fecharModalProduto() {},
  gerarItens() {},
  abrirProduto() {
    c.adicionaisSelecionados = { 0: { nome: "Bacon", qtd: 0, preco: 6 } };
  },
  adicionarProdutoFinal() {
    c.carrinho.push({
      nome: "Baguncinha",
      qtd: 1,
      preco: 37,
      adicionais: [{ nome: "Bacon", qtd: 2, preco: 6 }],
      obs: el("obs-produto").value,
    });
    c.fecharModalProduto();
  },
};
c.window = c;
vm.createContext(c);
vm.runInContext(fs.readFileSync("js/carrinho-edicao-ui.js", "utf8"), c);
eventos.forEach((fn) => fn());
c.alternarEdicaoCarrinhoUI();
c.editarItemCarrinhoUI(0);
assert.equal(el("salvar").textContent, "Salvar alterações");
assert.equal(c.adicionaisSelecionados[0].qtd, 1);
assert.equal(c.carrinho[0].preco, 31);
c.fecharModalProduto();
assert.equal(c.carrinho[0].preco, 31, "X descarta a edição");
c.editarItemCarrinhoUI(0);
el("obs-produto").value = "Sem cebola";
c.adicionarProdutoFinal();
assert.equal(c.carrinho.length, 1);
assert.equal(c.carrinho[0].preco, 37);
assert.equal(c.carrinho[0].obs, "Sem cebola");
assert.equal(c.carrinho[0].molhosPagos[0].nome, "Ketchup");
assert.equal(el("editar-carrinho-ui")["aria-pressed"], "false");
assert.doesNotMatch(fs.readFileSync("js/carrinho-edicao-ui.js", "utf8"), /abrirItemEdicaoUI/);
console.log(
  "PASS: editar reutiliza o card original, restaura acréscimos, X preserva item e salvar substitui sem perder molhos do checkout.",
);
