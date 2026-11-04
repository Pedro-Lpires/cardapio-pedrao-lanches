const fs = require("node:fs"),
  vm = require("node:vm"),
  assert = require("node:assert/strict");
const { context: c, mockDb: criarBanco } = require("./operacao.test.cjs");
function mockDb(inicial) {
  const db = criarBanco(inicial),
    copiar = (v) => JSON.parse(JSON.stringify(v));
  db.runTransaction = async (fn) => {
    const snapshot = new Map([...db.docs].map(([k, v]) => [k, copiar(v)])),
      writes = [];
    const r = await fn({
      get: async (ref) => {
        assert.equal(writes.length, 0, "Leituras antes de qualquer escrita");
        return {
          exists: snapshot.has(ref.path),
          data: () => copiar(snapshot.get(ref.path) || {}),
          id: ref.id,
        };
      },
      update: (ref, p) => writes.push([ref.path, copiar(p), true]),
      set: (ref, p) => writes.push([ref.path, copiar(p), false]),
    });
    for (const [id, p, merge] of writes) db.docs.set(id, merge ? { ...db.docs.get(id), ...p } : p);
    return r;
  };
  return db;
}
for (const arquivo of [
  "beneficios-pedido",
  "editor-pedido-ui",
  "beneficios-entrega",
  "rank-mensal",
])
  vm.runInContext(fs.readFileSync("js/" + arquivo + ".js", "utf8"), c);
function dados() {
  return {
    "clientes/c": {
      nome: "Teste",
      authUid: "uid",
      fidelidadeAtiva: true,
      bonusDisponivel: 0,
      totalFidelidade: 290,
      totalGasto: 290,
      bonusGeradoTotal: 10,
      gastoTotal: 0,
      pedidosTotal: 0,
      rankMensal: { meses: {}, importadoEm: 1 },
    },
    "pedidos/p": {
      clienteId: "c",
      clienteAuthUid: "uid",
      origem: "site_delivery",
      checkoutProtegido: 1,
      tipo: "Retirada",
      nome: "Teste",
      telefone: "65999999999",
      pagamento: "Pix",
      fidelidadeAtivaNoPedido: true,
      itens: [{ produtoId: "i", nome: "Baguncinha", quantidade: 1, subtotal: 35 }],
      descontoFidelidade: 10,
      valorTotal: 25,
      taxaEntrega: 0,
      descontoCupom: 0,
      descontoCreditoEntrega: 0,
      beneficiosPerfil: {
        regra: 3,
        baseFidelidade: 0,
        bonusUsado: 0,
        bonusGerado: 0,
        pedidoContado: false,
        gastoTotal: 0,
      },
      fidelidadeReserva: { centavos: 1000, status: "reservado" },
      data: new Date().toISOString(),
    },
  };
}
(async () => {
  let db = mockDb(dados());
  c.db = db;
  await c.registrarBeneficiosPedidoOperacao("p");
  assert.equal(db.docs.get("clientes/c").totalFidelidade, 290, "Enviar não antecipa bônus");
  await c.registrarRecebimentoPedidoOperacao("p", true);
  assert.equal(db.docs.get("clientes/c").totalFidelidade, 315);
  assert.equal(db.docs.get("clientes/c").bonusDisponivel, 10);
  assert.equal(db.docs.get("pedidos/p").fidelidadeReserva.status, "utilizado");
  const mes = c.competenciaRankMensalUI();
  assert.equal(db.docs.get("clientes/c").rankMensal.meses[mes], 2500);
  await c.registrarRecebimentoPedidoOperacao("p", true);
  assert.equal(db.docs.get("clientes/c").totalFidelidade, 315);
  await c.cancelarPedidoPerfilTransacaoUI("p");
  assert.equal(db.docs.get("clientes/c").bonusDisponivel, 10);
  assert.equal(db.docs.get("clientes/c").totalFidelidade, 290);
  assert.equal(db.docs.get("clientes/c").rankMensal.meses[mes], 0);
  assert.equal(db.docs.get("pedidos/p").estornoPerfil.bonusDevolvido, 10);
  db = mockDb(dados());
  c.db = db;
  await c.cancelarPedidoPerfilTransacaoUI("p");
  assert.equal(db.docs.get("clientes/c").bonusDisponivel, 10);
  const antes = JSON.stringify([...db.docs]);
  await c.cancelarPedidoPerfilTransacaoUI("p");
  assert.equal(JSON.stringify([...db.docs]), antes);
  db = mockDb(dados());
  c.db = db;
  let original = db.docs.get("pedidos/p");
  await c.salvarEdicaoPedidoTransacaoUI("p", original, {
    ...original,
    itens: [{ ...original.itens[0], subtotal: 45 }],
  });
  assert.equal(
    db.docs.get("clientes/c").totalFidelidade,
    290,
    "Editar pedido ainda não pago não credita fidelidade",
  );
  assert.equal(
    db.docs.get("clientes/c").bonusDisponivel,
    0,
    "Mantém a reserva sem debitar de novo",
  );
  original = db.docs.get("pedidos/p");
  await c.salvarEdicaoPedidoTransacaoUI("p", original, { ...original, tipo: "Local" });
  assert.equal(db.docs.get("pedidos/p").descontoFidelidade, 0);
  assert.equal(db.docs.get("pedidos/p").valorTotal, 45);
  assert.equal(db.docs.get("clientes/c").bonusDisponivel, 10);
  db = mockDb(dados());
  c.db = db;
  db.docs.get("clientes/c").authUid = "outra-conta";
  await assert.rejects(c.registrarRecebimentoPedidoOperacao("p", true));
  assert.equal(db.docs.get("pedidos/p").pagamentoConfirmado, undefined);
  console.log(
    "PASS: checkout protegido ligado ao caixa: confirmar/cancelar/editar preservam reserva, saldo, rank e vínculo da conta sem antecipar crédito.",
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
