const assert = require("node:assert/strict");
const { context: c } = require("./operacao.test.cjs");
const classes = new Set(),
  x = [{ hidden: true }, { hidden: true }],
  botao = {
    setAttribute(k, v) {
      this[k] = v;
    },
  };
c.document.getElementById = (id) =>
  id === "central-operacao"
    ? {
        classList: {
          toggle(k, v) {
            v ? classes.add(k) : classes.delete(k);
          },
        },
      }
    : botao;
c.document.querySelectorAll = () => x;
c.db = {
  collection() {
    throw Error("Alternar modo não deve consultar o banco");
  },
};
c.alternarCancelamentoPedidosCentralUI();
assert(x.every((b) => !b.hidden));
assert.equal(botao["aria-pressed"], "true");
assert(classes.has("cancelando-pedidos-ui"));
c.atualizarModoCancelamentoPedidosCentralUI();
assert(
  x.every((b) => !b.hidden),
  "Atualizar lista conserva o modo",
);
c.alternarCancelamentoPedidosCentralUI();
assert(x.every((b) => b.hidden));
assert.equal(botao["aria-pressed"], "false");
console.log(
  "PASS: cancelar alterna os X sem leituras/escritas, conserva modo na atualização e desliga no segundo clique.",
);
