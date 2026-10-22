const fs = require("node:fs"),
  vm = require("node:vm"),
  assert = require("node:assert/strict");
const x = { setAttribute() {} };
let voltou;
const nav = { querySelector: () => x };
const ctx = vm.createContext({
  comandaAbertaAtual: "c123",
  abrirComandaVisual: (id) => (voltou = id),
  document: { createElement: () => nav },
});
const fonte = fs.readFileSync("js/app-ui.js", "utf8");
vm.runInContext(
  fonte.slice(
    fonte.indexOf("function cabecalhoEtapaUI("),
    fonte.indexOf("function instalarNavegacaoAtendenteUI("),
  ),
  ctx,
);
ctx.cabecalhoEtapaUI({
  id: "area-produtos-comanda",
  querySelector: () => null,
  prepend() {},
  querySelectorAll: () => [],
});
x.onclick();
assert.equal(voltou, "c123");
console.log("PASS: X da busca de produtos volta à comanda aberta.");
