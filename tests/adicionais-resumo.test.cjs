const fs = require("node:fs"),
  vm = require("node:vm"),
  assert = require("node:assert/strict");
function el() {
  return {
    children: [],
    classList: { add() {} },
    setAttribute() {},
    append(n) {
      this.children.push(n);
    },
    replaceChildren() {
      this.children = [];
    },
  };
}
let resumo = null;
const botao = el();
botao.parentElement = { querySelector: () => resumo };
botao.after = (n) => {
  resumo = n;
};
const ctx = vm.createContext({
  document: { querySelector: () => botao, createElement: el },
  adicionaisSelecionados: { a: { nome: "Bacon", qtd: 1 }, b: { nome: "Cheddar", qtd: 2 } },
  adicionaisAutoSelecionados: { a: { nome: "Bacon", qtd: 1 }, b: { nome: "Cheddar", qtd: 2 } },
  obterAcrescimosSelecionados: () => Object.values(ctx.adicionaisSelecionados),
});
const fonte = fs.readFileSync("js/janelas-fluxos.js", "utf8");
vm.runInContext(
  fonte.slice(
    fonte.indexOf("function atualizarResumoAdicionaisProdutoUI("),
    fonte.indexOf("function abrirAcrescimosJanelaUI("),
  ),
  ctx,
);
for (const id of ["lista-adicionais", "lista-adicionais-auto", "area-acrescimos-produto"]) {
  botao.children = [];
  ctx.atualizarResumoAdicionaisProdutoUI(id);
  assert.equal(botao.children[0].textContent, 3);
  assert.equal(resumo.hidden, false);
  assert.deepEqual(
    resumo.children.map((n) => n.textContent),
    ["+ 1 Bacon", "+ 2 Cheddar"],
  );
}
ctx.adicionaisSelecionados = {};
ctx.atualizarResumoAdicionaisProdutoUI("lista-adicionais");
assert.equal(resumo.hidden, true);
assert.equal(resumo.children.length, 0);
console.log("PASS: três fluxos mostram quantidades e nomes selecionados; limpar remove o resumo.");
