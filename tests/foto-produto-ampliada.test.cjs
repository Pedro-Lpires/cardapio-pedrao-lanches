const fs = require("node:fs"),
  vm = require("node:vm"),
  assert = require("node:assert/strict");
const fonte = fs.readFileSync("js/janelas-fluxos.js", "utf8");
const elemento = (tag) => ({
  tag,
  filhos: [],
  atributos: {},
  eventos: {},
  setAttribute(nome, valor) {
    this.atributos[nome] = valor;
  },
  append(...filhos) {
    this.filhos.push(...filhos);
  },
  addEventListener(nome, fn) {
    this.eventos[nome] = fn;
  },
  showModal() {
    this.open = true;
  },
  close() {
    this.open = false;
    this.eventos.close?.();
  },
  remove() {
    this.removido = true;
  },
});
const body = elemento("body");
const ctx = vm.createContext({ document: { createElement: elemento, body } });
vm.runInContext(
  fonte.slice(
    fonte.indexOf("function abrirFotoProdutoUI("),
    fonte.indexOf("function prepararFotosProdutosUI("),
  ),
  ctx,
);
for (const canal of ["index", "auto", "atendente"]) {
  const imagem = { src: "images/big.webp", currentSrc: "images/big.webp" };
  const origem = {
    dataset: canal === "atendente" ? { imagem: imagem.src, nome: "Big Big" } : {},
    querySelector: () => (canal === "atendente" ? null : imagem),
    closest: () => ({ querySelector: () => ({ textContent: "Big Big" }) }),
  };
  const antes = JSON.stringify(imagem);
  const janela = ctx.abrirFotoProdutoUI(origem);
  assert.equal(janela.open, true);
  assert.equal(janela.filhos[1].src, imagem.src);
  assert.equal(janela.filhos[1].alt, "Big Big");
  janela.filhos[0].filhos[1].onclick();
  assert.equal(janela.open, false);
  assert.equal(janela.removido, true);
  assert.equal(
    JSON.stringify(imagem),
    antes,
    "Fechar a foto conserva a imagem e o produto originais",
  );
}
console.log(
  "PASS: fotos do index, autoatendimento e atendente abrem ampliadas e fecham sem alterar o produto.",
);
