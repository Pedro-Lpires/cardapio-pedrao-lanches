const fs = require("node:fs"),
  vm = require("node:vm"),
  assert = require("node:assert/strict");
const { context: c, mockDb } = require("./operacao.test.cjs");
vm.runInContext(fs.readFileSync("js/beneficios-pedido.js", "utf8"), c);
vm.runInContext(fs.readFileSync("js/editor-pedido-ui.js", "utf8"), c);
(async () => {
  for (const tipo of ["Entrega", "Retirada", "Local"]) {
    const cliente = {
      nome: "Teste",
      fidelidadeAtiva: true,
      totalFidelidade: 290,
      bonusGeradoTotal: 20,
      bonusDisponivel: 20,
      totalGasto: 290,
      gastoTotal: 290,
      pedidosTotal: 1,
    };
    const pedido = {
      clienteId: "c",
      origem: "site_delivery",
      fidelidadeAtivaNoPedido: true,
      nome: "Teste",
      tipo,
      itens: [{ nome: "Lanche com Bacon", preco: 31, quantidade: 1, totalMolhosPagos: 4 }],
      taxaEntrega: tipo === "Entrega" ? 45 : 0,
      valorTotal: tipo === "Entrega" ? 80 : 35,
    };
    const db = mockDb({
      "clientes/c": cliente,
      "pedidos/p": pedido,
      "filaCozinha/q": { origemColecao: "pedidos", origemId: "p", status: "aguardando" },
    });
    c.db = db;
    await c.registrarBeneficiosPedidoOperacao("p");
    const apos = { ...db.docs.get("clientes/c") };
    assert.equal(
      apos.totalFidelidade,
      tipo === "Local" ? 290 : 325,
      "Só o valor dos itens, extras e molhos; consumo local acumula ao pagar na mesa",
    );
    assert.equal(
      apos.bonusDisponivel,
      tipo === "Local" ? 20 : 30,
      "Preserva R$20 anteriores e gera só R$10 novos",
    );
    await c.registrarBeneficiosPedidoOperacao("p");
    assert.deepEqual(db.docs.get("clientes/c"), apos, "Retry não credita outra vez");
    await c.cancelarPedidoPerfilTransacaoUI("p");
    const cancelado = db.docs.get("clientes/c");
    for (const k of [
      "totalFidelidade",
      "bonusGeradoTotal",
      "bonusDisponivel",
      "totalGasto",
      "gastoTotal",
      "pedidosTotal",
    ])
      assert.equal(cancelado[k], cliente[k], k + " estornado");
    assert.equal(db.docs.get("filaCozinha/q").status, "cancelado");
    assert.equal(db.docs.get("pedidos/p").cancelado, true);
    const antes = JSON.stringify([...db.docs]);
    await c.cancelarPedidoPerfilTransacaoUI("p");
    assert.equal(JSON.stringify([...db.docs]), antes, "Cancelar duas vezes não estorna duas vezes");
  }
  const db = mockDb({
    "clientes/c": {
      fidelidadeAtiva: true,
      totalFidelidade: 300,
      bonusGeradoTotal: 10,
      bonusDisponivel: 0,
      pedidosTotal: 1,
      gastoTotal: 300,
      totalGasto: 300,
    },
    "pedidos/p": {
      clienteId: "c",
      tipo: "Retirada",
      beneficiosPerfil: {
        regra: 2,
        baseFidelidade: 300,
        bonusUsado: 10,
        bonusGerado: 10,
        pedidoContado: true,
        gastoTotal: 300,
      },
      itens: [],
      valorTotal: 300,
    },
  });
  c.db = db;
  await c.cancelarPedidoPerfilTransacaoUI("p");
  assert.equal(
    db.docs.get("clientes/c").bonusDisponivel,
    0,
    "Desfaz geração e devolve bônus usado sem criar saldo",
  );
  assert.equal(
    c.bonusAcumuladoFidelidadeOperacao({ totalFidelidade: 590, bonusGeradoTotal: 20 }, 610),
    30,
  );
  assert.equal(
    c.baseFidelidadePedidoOperacao({
      itens: [{ preco: 31, quantidade: 2, totalMolhosPagos: 4 }],
      taxaEntrega: 99,
    }),
    66,
  );
  {
    const dbEdit = mockDb({
      "clientes/c": {
        fidelidadeAtiva: true,
        totalFidelidade: 290,
        totalGasto: 290,
        gastoTotal: 290,
        pedidosTotal: 1,
        bonusGeradoTotal: 0,
        bonusDisponivel: 0,
      },
      "pedidos/e": {
        nome: "Teste",
        telefone: "65999999999",
        clienteId: "c",
        origem: "site_delivery",
        fidelidadeAtivaNoPedido: true,
        tipo: "Entrega",
        taxaEntrega: 45,
        itens: [{ nome: "Lanche", preco: 31, quantidade: 1, totalMolhosPagos: 4 }],
        valorTotal: 80,
      },
    });
    c.db = dbEdit;
    await c.registrarBeneficiosPedidoOperacao("e");
    let antes = JSON.parse(JSON.stringify(dbEdit.docs.get("pedidos/e")));
    let draft = { ...antes, taxaEntrega: 60 };
    await c.salvarEdicaoPedidoTransacaoUI("e", antes, draft);
    assert.equal(
      dbEdit.docs.get("clientes/c").totalFidelidade,
      325,
      "Editar só a taxa não altera fidelidade",
    );
    antes = JSON.parse(JSON.stringify(dbEdit.docs.get("pedidos/e")));
    draft = { ...antes, itens: [{ ...antes.itens[0], preco: 37 }] };
    await c.salvarEdicaoPedidoTransacaoUI("e", antes, draft);
    assert.equal(
      dbEdit.docs.get("clientes/c").totalFidelidade,
      331,
      "Acréscimo editado atualiza a base",
    );
    await c.cancelarPedidoPerfilTransacaoUI("e");
    assert.equal(
      dbEdit.docs.get("clientes/c").totalFidelidade,
      290,
      "Cancelar devolve a base atualizada",
    );
    assert.equal(
      dbEdit.docs.get("clientes/c").gastoTotal,
      290,
      "Cancelar devolve o valor editado do contador",
    );
  }
  console.log(
    "PASS: R$10/300, extras/molhos contam, taxa não; saldo antigo preservado, crédito/estorno idempotentes nas três modalidades e fila cancelada.",
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
