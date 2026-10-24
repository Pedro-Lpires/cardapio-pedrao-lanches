const fs = require("node:fs"),
  vm = require("node:vm"),
  assert = require("node:assert/strict");
function campo(id) {
  return {
    id,
    dataset: {},
    value: "",
    eventos: {},
    after(ajuda) {
      this.ajuda = ajuda;
    },
    addEventListener(tipo, fn) {
      this.eventos[tipo] = fn;
    },
    setCustomValidity(texto) {
      this.erro = texto;
    },
  };
}
const telefone = campo("admin-telefone-editar"),
  cda = campo("admin-codigo-cliente"),
  misto = campo("raspa-manual-cliente");
const ctx = vm.createContext({
  document: { querySelector: () => ({}), createElement: () => ({}) },
});
const fonte = fs.readFileSync("js/ui-comum.js", "utf8");
vm.runInContext(
  fonte.slice(
    fonte.indexOf("function configurarCamposNumericosUI("),
    fonte.indexOf("function padronizarFechamentosUI("),
  ),
  ctx,
);
const raiz = { querySelectorAll: () => [telefone, cda, misto] };
ctx.configurarCamposNumericosUI(raiz);
function digitar(c, texto) {
  c.value = texto;
  c.eventos.input();
}
digitar(telefone, "65 (99999) 999999999");
assert.equal(telefone.value, "65999999999");
assert.equal(telefone.erro, "");
digitar(telefone, "6599999999");
assert.match(telefone.erro, /11/);
digitar(cda, "01ab2345");
assert.equal(cda.value, "0123");
assert.equal(cda.erro, "");
digitar(cda, "123");
assert.match(cda.erro, /4/);
digitar(misto, "1234");
assert.equal(misto.erro, "");
digitar(misto, "65999999999");
assert.equal(misto.erro, "");
digitar(misto, "123456");
assert.match(misto.erro, /4.*11/);
const ajuda = misto.ajuda;
ctx.configurarCamposNumericosUI(raiz);
assert.equal(misto.ajuda, ajuda);
console.log(
  "PASS: telefone de 11 dígitos, CDA de 4, campos mistos, zeros iniciais, limpeza e indicação de números faltando.",
);
