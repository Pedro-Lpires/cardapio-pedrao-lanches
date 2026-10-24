const fs = require("node:fs"),
  vm = require("node:vm"),
  assert = require("node:assert/strict");
const fonte = fs.readFileSync("js/script.js", "utf8");
const quantidade = { innerText: "1" };
const avisos = [];
const ctx = vm.createContext({
  qtdProdutoAtual: 1,
  categoriaProdutoAtual: "Lanches",
  adicionaisSelecionados: { bacon: { qtd: 0 } },
  document: { getElementById: () => quantidade },
  alert: (texto) => avisos.push(texto),
});
vm.runInContext(
  fonte.slice(fonte.indexOf("function alterarQtdProduto("), fonte.indexOf("let adicionais = []")),
  ctx,
);
ctx.alterarQtdProduto(1);
assert.equal(ctx.qtdProdutoAtual, 2);
assert.equal(avisos.length, 0);
ctx.adicionaisSelecionados.bacon.qtd = 1;
ctx.limitarQuantidadeProdutoComAdicionais();
assert.equal(ctx.qtdProdutoAtual, 1);
assert.equal(quantidade.innerText, "1");
assert.equal(avisos.length, 1);
assert.equal(
  avisos[0],
  "Lanches com adicionais devem ser adicionados ao carrinho uma unidade por vez.",
);
ctx.alterarQtdProduto(1);
assert.equal(ctx.qtdProdutoAtual, 1);
assert.equal(avisos.length, 2);
ctx.alterarQtdProduto(-1);
assert.equal(ctx.qtdProdutoAtual, 1);
assert.equal(avisos.length, 2);
ctx.adicionaisSelecionados.bacon.qtd = 0;
ctx.alterarQtdProduto(1);
assert.equal(ctx.qtdProdutoAtual, 2);
assert.equal(avisos.length, 2);

let aplicar,
  cancelar,
  ajustes = 0;
const conteudo = {
  style: {},
  querySelectorAll: () => [],
  querySelector: () => true,
};
const janelaCtx = vm.createContext({
  document: { getElementById: (id) => (id === "lista-adicionais" ? conteudo : null) },
  adicionaisSelecionados: { bacon: { qtd: 1 } },
  structuredClone,
  abrirJanelaElementoUI: () => ({ addEventListener() {} }),
  configurarAcrescimosImediatosUI: (janela, a) => {
    aplicar = a;
    cancelar = a;
  },
  limitarQuantidadeProdutoComAdicionais: () => ajustes++,
});
const janelas = fs.readFileSync("js/janelas-fluxos.js", "utf8");
vm.runInContext(
  janelas.slice(
    janelas.indexOf("function abrirAcrescimosJanelaUI("),
    janelas.indexOf("function resumoAcrescimosHtmlUI("),
  ),
  janelaCtx,
);
janelaCtx.abrirAcrescimosJanelaUI("lista-adicionais");
cancelar();
assert.equal(ajustes, 1);
janelaCtx.abrirAcrescimosJanelaUI("lista-adicionais");
aplicar();
assert.equal(ajustes, 2);
console.log(
  "PASS: adicionais limitam a quantidade no + e ao fechar por Voltar ou X; sem adicionais aumenta.",
);
