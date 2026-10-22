const fs = require("node:fs"),
  vm = require("node:vm"),
  assert = require("node:assert/strict");
let aplicar,
  cancelar,
  resumo = null,
  atualizou = 0;
const campos = [10, 25, 0, 0].map((value) => ({ value: String(value) }));
campos[0].oninput = () => atualizou++;
const radios = [{ checked: true }];
const pai = { matches: () => false, querySelector: () => resumo };
const botao = { parentElement: pai, after: (el) => (resumo = el) };
const area = {
  style: { display: "none" },
  dataset: {},
  parentElement: pai,
  previousElementSibling: botao,
  querySelector: () => null,
  querySelectorAll: () => campos,
};
const ctx = vm.createContext({
  document: {
    getElementById: () => area,
    querySelectorAll: () => radios,
    createElement: () => ({
      remove() {
        resumo = null;
      },
    }),
    addEventListener() {},
  },
  abrirJanelaElementoUI: () => ({ classList: { add() {} } }),
  configurarRascunhoAcrescimosUI: (j, a, c) => {
    aplicar = a;
    cancelar = c;
  },
  moedaOperacao: (n) => "R$ " + n,
});
vm.runInContext(fs.readFileSync("js/pagamento-ui.js", "utf8"), ctx);
ctx.organizarCamposPagamentoMistoUI = () => {};
ctx.abrirPagamentoMistoJanelaUI("area-pagamento-misto");
aplicar();
assert.equal(area.dataset.ativo, "sim");
assert.equal(area.style.display, "none");
assert.equal(radios[0].checked, false);
assert.match(resumo.textContent, /Dinheiro: R\$ 10/);
assert.match(resumo.textContent, /Pix: R\$ 25/);
ctx.abrirPagamentoMistoJanelaUI("area-pagamento-misto");
campos[0].value = "99";
cancelar();
assert.equal(campos[0].value, "10");
assert.equal(area.dataset.ativo, "sim");
assert.equal(atualizou, 1);
ctx.desativarPagamentoMistoUI("area-pagamento-misto");
assert.equal(area.dataset.ativo, undefined);
assert.match(ctx.htmlResumoPagamentoMistoUI(30, 5), /pagamento-restante-ui/);
assert.match(ctx.htmlResumoPagamentoMistoUI(30, 5), /Restante a pagar/);
assert.match(ctx.htmlResumoPagamentoMistoUI(35, 0), /pagamento-restante-ui quitado/);
console.log(
  "PASS: misto permanece ativo fora da janela, conserva valores ao cancelar e desativa ao escolher uma forma única.",
);
