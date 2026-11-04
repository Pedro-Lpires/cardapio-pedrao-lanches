const assert = require("node:assert/strict");
const { movimentoFidelidadeCheckoutUI: mover } = require("../js/beneficios-pedido.js");
let cliente = {
  fidelidadeAtiva: true,
  bonusDisponivel: 0,
  bonusGeradoTotal: 10,
  totalFidelidade: 290,
  totalGasto: 290,
  pedidosTotal: 0,
  gastoTotal: 0,
};
let pedido = {
  tipo: "Entrega",
  itens: [{ subtotal: 36, totalMolhosPagos: 4 }],
  taxaEntrega: 20,
  descontoCupom: 5,
  descontoCupomTaxa: 0,
  descontoCreditoEntrega: 5,
  descontoFidelidade: 10,
  valorTotal: 40,
  valorPago: 0,
  beneficiosPerfil: {
    regra: 3,
    baseFidelidade: 0,
    bonusUsado: 0,
    pedidoContado: false,
    gastoTotal: 0,
  },
  fidelidadeReserva: { centavos: 1000, status: "reservado" },
};
let m = mover(cliente, pedido, pedido);
assert.equal(m.cliente.totalFidelidade, 290);
assert.equal(m.cliente.bonusDisponivel, 0);
assert.equal(m.cliente.pedidosTotal, 0);
assert.equal(m.pedido.fidelidadeReserva.status, "reservado");
m = mover(cliente, pedido, pedido, true);
assert.equal(m.cliente.bonusDisponivel, 10, "Cancelar devolve o bônus reservado");
assert.equal(m.cliente.totalFidelidade, 290);
assert.equal(m.pedido.fidelidadeReserva.status, "devolvido");
m = mover(cliente, pedido, { ...pedido, valorPago: 40, pagamentoConfirmado: true });
assert.equal(
  m.cliente.totalFidelidade,
  315,
  "Só os R$25 pagos de produtos contam: frete líquido R$15 fica fora",
);
assert.equal(
  m.cliente.bonusDisponivel,
  10,
  "Atingir R$300 pagos gera R$10; o bônus reservado não é debitado de novo",
);
assert.equal(m.cliente.pedidosTotal, 1);
assert.equal(m.pedido.fidelidadeReserva.status, "utilizado");
cliente = { ...cliente, ...m.cliente };
pedido = { ...pedido, valorPago: 40, pagamentoConfirmado: true, ...m.pedido };
const repetido = mover(cliente, pedido, pedido);
assert.deepEqual(
  repetido.cliente,
  m.cliente,
  "Repetir recebimento não gera bônus nem conta pedido duas vezes",
);
m = mover(cliente, pedido, pedido, true);
assert.equal(m.cliente.totalFidelidade, 290);
assert.equal(m.cliente.bonusDisponivel, 10, "Estorna o bônus gerado e devolve o utilizado");
assert.equal(m.cliente.pedidosTotal, 0);
m = mover(cliente, pedido, { ...pedido, tipo: "Local", descontoFidelidade: 0 });
assert.equal(m.cliente.totalFidelidade, 290);
assert.equal(
  m.cliente.bonusDisponivel,
  10,
  "Mover para mesa retira a contabilização do pedido e devolve o bônus para a comanda tratar depois",
);
m = mover(cliente, pedido, {
  ...pedido,
  itens: [{ subtotal: 61, totalMolhosPagos: 4 }],
  valorTotal: 65,
  pagamentoConfirmado: false,
});
assert.equal(
  m.cliente.totalFidelidade,
  315,
  "Acrescentar um item ainda não pago não aumenta a fidelidade",
);
assert.throws(() => mover(cliente, pedido, { ...pedido, descontoFidelidade: 50 }));
console.log(
  "Fidelidade protegida: reserva, pagamento, repetição, edição e cancelamento conferidos.",
);
