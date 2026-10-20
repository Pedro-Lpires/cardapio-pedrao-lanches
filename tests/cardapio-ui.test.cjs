const fs = require("fs"),
  vm = require("vm"),
  assert = require("node:assert/strict");
const cards = ["A", "B", "C", "D", "E", "X-Bacon especial", "Água", "Combo oculto"].map(
  (textContent) => ({ textContent, hidden: false, classList: { contains: (c) => c === "card" } }),
);
const nodes = {};
const grid = {
  id: "container-lanches",
  children: cards,
  after(b) {
    nodes[b.id] = b;
  },
};
nodes.lanches = { hidden: false, scrollIntoView() {} };
nodes["busca-produto"] = { value: "" };
nodes["busca-sem-resultados"] = { hidden: true };
const context = vm.createContext({
  document: {
    addEventListener() {},
    getElementById: (id) => nodes[id] || null,
    querySelectorAll: () => [grid],
    createElement: () => ({
      attrs: {},
      setAttribute(k, v) {
        this.attrs[k] = v;
      },
      addEventListener(event, cb) {
        this[event] = cb;
      },
    }),
  },
});
vm.runInContext(fs.readFileSync("js/cardapio-ui.js", "utf8"), context);
for (const termo of ["xTudo", "X-TUDO", "x tudo", "X. Túdo!"]) {
  assert.equal(context.calcularVisibilidadeCardapio(["X-Tudo"], termo)[0], true);
}
context.window = {};
vm.runInContext(fs.readFileSync("js/ui-comum.js", "utf8"), context);
assert.equal(context.normalizarBuscaUI("Água, com gás!"), "aguacomgas");
assert.equal(context.normalizarBuscaUI("X - TÚDO"), "xtudo");
context.atualizarVisibilidadeCardapio();
assert.equal(cards.filter((c) => !c.hidden).length, 5);
const botao = nodes["ver-mais-container-lanches"];
assert.equal(botao.textContent, "Ver mais (3)");
botao.click();
assert.equal(cards.filter((c) => !c.hidden).length, 8);
botao.click();
assert.equal(cards.filter((c) => !c.hidden).length, 5);
context.atualizarVisibilidadeCardapio("especial");
assert.equal(cards.filter((c) => !c.hidden).length, 1);
assert.equal(cards[5].hidden, false);
assert.equal(botao.hidden, true);
context.atualizarVisibilidadeCardapio("agua");
assert.equal(cards[6].hidden, false);
context.atualizarVisibilidadeCardapio("nao existe");
assert.equal(nodes["busca-sem-resultados"].hidden, false);
assert.equal(nodes.lanches.hidden, true);
context.atualizarVisibilidadeCardapio("");
assert.equal(cards.filter((c) => !c.hidden).length, 5);
assert.equal(botao.hidden, false);
assert.equal(nodes.lanches.hidden, false);
console.log(
  "PASS: limite de cinco, ver mais/menos, busca nos escondidos, acentos, nenhum resultado e limpeza da busca.",
);
