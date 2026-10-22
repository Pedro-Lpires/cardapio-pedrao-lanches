const fs = require("node:fs"),
  vm = require("node:vm"),
  assert = require("node:assert/strict");
const fonte = fs.readFileSync("js/combos-site-ui.js", "utf8");
let abriu = 0,
  fechou = 0;
const voltar = {},
  x = { onclick: () => fechou++ };
const ctx = vm.createContext({
  abrirEscolhaAcrescimosComboUI: (tipo) => {
    assert.equal(tipo, "site");
    abriu++;
  },
});
vm.runInContext(
  fonte.slice(
    fonte.indexOf("function configurarVoltaTipoComboSiteUI("),
    fonte.indexOf("async function escolherModoComboSiteUI("),
  ),
  ctx,
);
ctx.configurarVoltaTipoComboSiteUI({ querySelector: () => voltar, close: () => fechou++ });
voltar.onclick();
assert.equal(abriu, 1);
assert.equal(fechou, 1);
x.onclick();
assert.equal(abriu, 1);
console.log("PASS: Voltar do resumo Todos/Individual reabre escolha de tipo; X não reabre.");
