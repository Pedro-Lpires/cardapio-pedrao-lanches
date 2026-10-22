const fs = require("node:fs"),
  vm = require("node:vm"),
  assert = require("node:assert/strict");
const fonte = fs.readFileSync("js/ui-comum.js", "utf8");
const ctx = vm.createContext({});
vm.runInContext(
  fonte.slice(
    fonte.indexOf("function configurarRascunhoAcrescimosUI("),
    fonte.indexOf("function lerComPrazoUI("),
  ),
  ctx,
);
function janela() {
  const voltar = {};
  const eventos = [];
  return {
    open: true,
    returnValue: "",
    querySelector: () => voltar,
    addEventListener: (nome, fn) => eventos.push(fn),
    voltar,
    close(valor = "") {
      this.returnValue = valor;
      this.open = false;
      eventos.forEach((fn) => fn());
    },
  };
}
let aplicou = 0,
  cancelou = 0;
const j = janela();
ctx.configurarRascunhoAcrescimosUI(
  j,
  () => aplicou++,
  () => cancelou++,
);
j.voltar.onclick();
assert.equal(aplicou, 1);
assert.equal(cancelou, 0);
const x = janela();
ctx.configurarRascunhoAcrescimosUI(
  x,
  () => aplicou++,
  () => cancelou++,
);
x.close("cancelar");
assert.equal(aplicou, 1);
assert.equal(cancelou, 1);
console.log("PASS: Voltar aplica antes de fechar; X/Escape descartam o rascunho.");
