const fs = require("node:fs"),
  vm = require("node:vm"),
  assert = require("node:assert/strict");
const { context: c, mockDb, pagamento, patch } = require("./operacao.test.cjs");
let agora = Date.parse("2026-11-15T18:00:00-04:00");
c.Date = class extends Date {
  constructor(...a) {
    super(...(a.length ? a : [agora]));
  }
  static now() {
    return agora;
  }
};
vm.runInContext(fs.readFileSync("js/rank-mensal.js", "utf8"), c);
vm.runInContext(fs.readFileSync("js/beneficios-pedido.js", "utf8"), c);
vm.runInContext(fs.readFileSync("js/mesas-limpeza.js", "utf8"), c);
vm.runInContext(fs.readFileSync("js/editor-pedido-ui.js", "utf8"), c);
vm.runInContext(fs.readFileSync("js/cupons-rank.js", "utf8"), c);
function banco(dados) {
  const db = mockDb(dados),
    run = db.runTransaction;
  db.runTransaction = (fn) =>
    run(async (t) => {
      let escreveu = false;
      return fn({
        get: (ref) => {
          assert.equal(escreveu, false, "Firestore exige leituras antes das escritas");
          return t.get(ref);
        },
        set: (...a) => {
          escreveu = true;
          return t.set(...a);
        },
        update: (...a) => {
          escreveu = true;
          return t.update(...a);
        },
      });
    });
  return db;
}
const cliente = (extra) => ({
  fidelidadeAtiva: true,
  nivelCliente: "Imortal",
  bonusDisponivel: 35,
  totalFidelidade: 290,
  bonusGeradoTotal: 20,
  rankMensal: { versao: 1, importadoEm: agora, competencia: "2026-11", meses: {} },
  ...extra,
});
const pedido = (extra) => ({
  clienteId: "a",
  tipo: "Entrega",
  valorTotal: 410,
  taxaEntrega: 10,
  pagamento: "Pix",
  itens: [{ nome: "Lanches", preco: 400, quantidade: 1 }],
  ...extra,
});
const nivel = (meses, data = "2026-11-15T12:00:00-04:00") =>
  c.nivelRankMensalUI(cliente({ rankMensal: { meses } }), Date.parse(data));
(async () => {
  for (const [valor, esperado] of [
    [0, "Bronze"],
    [39999, "Bronze"],
    [40000, "Prata"],
    [69999, "Prata"],
    [70000, "Ouro"],
    [120000, "Diamante"],
    [160000, "Imortal"],
  ])
    assert.equal(nivel({ "2026-11": valor }), esperado);
  assert.equal(
    nivel({ "2026-10": 70000, "2026-11": 20000 }),
    "Ouro",
    "mês anterior sustenta o nível até a próxima avaliação",
  );
  assert.equal(
    nivel({ "2026-10": 30000, "2026-11": 0 }),
    "Bronze",
    "abaixo de R$400 no mês anterior, cai a Bronze",
  );
  assert.equal(
    nivel({ "2026-10": 30000, "2026-11": 120000 }),
    "Diamante",
    "pode subir imediatamente pelas compras do mês",
  );
  assert.equal(
    nivel({ "2026-10": 160000 }, "2027-01-01T00:00:00-04:00"),
    "Bronze",
    "meses sem compras não sustentam rank indefinidamente",
  );
  assert.equal(c.competenciaRankMensalUI("2027-01-01T03:59:59Z"), "2026-12");
  assert.equal(c.competenciaRankMensalUI("2027-01-01T04:00:00Z"), "2027-01");
  assert.equal(c.anteriorRankMensalUI("2027-01"), "2026-12");
  assert.equal(
    c.nivelRankMensalUI({ fidelidadeAtiva: false, rankMensal: { meses: { "2026-11": 160000 } } }),
    "Sem nível",
  );
  assert.equal(
    c.nivelComprasPedidoUI({ fidelidadeAtiva: true, pedidosTotal: 100, gastoTotal: 10000 }),
    "Bronze",
    "número de pedidos e gasto vitalício não promovem",
  );

  c.db = banco({ "clientes/a": cliente(), "pedidos/p": pedido() });
  assert.equal(
    c.eventosRankPedidoMensalUI(pedido()).length,
    0,
    "WhatsApp não é confirmação de pagamento",
  );
  await c.registrarRecebimentoPedidoOperacao("p", false);
  let conta = c.db.docs.get("clientes/a");
  assert.equal(conta.rankMensal.meses["2026-11"], 40000);
  assert.equal(conta.nivelCliente, "Prata");
  assert.equal(conta.bonusDisponivel, 35, "rank não altera o bônus fidelidade");
  await c.registrarRecebimentoPedidoOperacao("p", false);
  assert.equal(
    c.db.docs.get("clientes/a").rankMensal.meses["2026-11"],
    40000,
    "retry não duplica compra",
  );
  assert.equal(
    c.eventosRankPedidoMensalUI(
      pedido({
        valorTotal: 405,
        descontoCupomTaxa: 5,
        recebimentosPedido: [{ valor: 405, taxaEntrega: 10, pagoEm: agora }],
      }),
    )[0].centavos,
    40000,
    "desconto de frete não reduz os itens elegíveis",
  );
  assert.equal(
    c.eventosRankPedidoMensalUI(
      pedido({
        valorTotal: 380,
        recebimentosPedido: [{ valor: 380, taxaEntrega: 10, pagoEm: agora }],
      }),
    )[0].centavos,
    37000,
    "usa valor após descontos",
  );
  const original = c.db.docs.get("pedidos/p");
  await c.salvarEdicaoPedidoTransacaoUI("p", original, {
    ...original,
    nome: "Teste",
    itens: [{ nome: "Item", preco: 350, quantidade: 1 }],
    descontoCupom: 0,
    descontoFidelidade: 0,
    ajusteArredondamento: 0,
  });
  assert.equal(
    c.db.docs.get("clientes/a").rankMensal.meses["2026-11"],
    35000,
    "edição corrige compra paga sem duplicar recebimento",
  );
  await c.cancelarPedidoPerfilTransacaoUI("p");
  assert.equal(c.db.docs.get("clientes/a").rankMensal.meses["2026-11"], 0);
  assert.equal(c.db.docs.get("clientes/a").nivelCliente, "Bronze");
  await c.cancelarPedidoPerfilTransacaoUI("p");
  assert.equal(c.db.docs.get("clientes/a").rankMensal.meses["2026-11"], 0);

  c.db = banco({
    "clientes/a": cliente(),
    "comandas/c": { status: "Aberta", clienteId: "a", valorTotal: 500, itens: [] },
  });
  let ref = c.db.collection("comandas").doc("c");
  const lote = c.lotePagamentoCupomOperacao(null, "a", ref);
  lote.update(ref, {
    status: "Fechada",
    valorPago: 500,
    fechadoEm: agora,
    pagamentos: [{ forma: "Pix", valor: 500 }],
  });
  await lote.commit();
  assert.equal(
    c.db.docs.get("clientes/a").rankMensal.meses["2026-11"],
    50000,
    "pagamento integral da mesa entra uma vez",
  );
  c.db = banco({
    "clientes/a": cliente(),
    "clientes/b": cliente(),
    "comandas/c": { status: "Aberta", clienteId: "a", valorTotal: 500, itens: [], pagamentos: [] },
    "mesas/m": { numero: 1, ocupada: true },
  });
  ref = c.db.collection("comandas").doc("c");
  let comanda = (await ref.get()).data();
  const pa = pagamento("a1", 200, { clienteId: "a" }),
    pb = pagamento("b1", 100, { clienteId: "b" });
  await c.salvarPagamentoSeparadoAtomico(ref, comanda, pa, patch(comanda, pa), []);
  comanda = (await ref.get()).data();
  await c.salvarPagamentoSeparadoAtomico(ref, comanda, pb, patch(comanda, pb), []);
  assert.equal(c.db.docs.get("clientes/a").rankMensal.meses["2026-11"], 20000);
  assert.equal(
    c.db.docs.get("clientes/b").rankMensal.meses["2026-11"],
    10000,
    "cada pagador recebe apenas sua parte",
  );
  await c.cancelarComandasMesasOperacao({ comandaId: "c", pagamentosConfirmados: true });
  assert.equal(c.db.docs.get("clientes/a").rankMensal.meses["2026-11"], 0);
  assert.equal(c.db.docs.get("clientes/b").rankMensal.meses["2026-11"], 0);

  // Importação recupera somente pagamentos comprovados e não duplica origem vinculada.
  c.db = banco({
    "clientes/a": cliente({ rankMensal: null }),
    "pedidos/outubro": pedido({
      valorTotal: 510,
      pagamentoConfirmado: true,
      pagamentoConfirmadoEm: Date.parse("2026-10-20T18:00:00-04:00"),
    }),
    "pedidos/pendente": pedido({ valorTotal: 1000 }),
    "pedidos/local": pedido({ valorTotal: 500, tipo: "Local", comandaId: "mesa" }),
    "comandas/mesa": {
      clienteId: "a",
      status: "Fechada",
      valorPago: 100,
      fechadoEm: agora,
      pagamentos: [{ forma: "Pix", valor: 100 }],
    },
    "historicoPagamentosClientes/h": { clienteId: "a", comandaId: "mesa", valorPago: 100 },
  });
  conta = await c.sincronizarRankMensalClienteUI("a");
  assert.equal(conta.rankMensal.meses["2026-10"], 50000);
  assert.equal(conta.rankMensal.meses["2026-11"], 10000);
  assert.equal(conta.nivelCliente, "Prata");
  const antes = JSON.stringify([...c.db.docs]);
  await c.sincronizarRankMensalClienteUI("a", true);
  assert.equal(
    JSON.stringify([...c.db.docs]),
    antes,
    "reconferência não duplica nem regrava dados iguais",
  );
  assert.match(c.htmlRankMensalUI(conta), /Faltam.*600.*Ouro/);
  assert.doesNotMatch(c.htmlRankMensalUI(conta), /Prata:|Ouro:|1\.200|fidelidade/);
  agora = Date.parse("2026-12-01T00:00:00-04:00");
  assert.equal(
    c.nivelFidelidadeOperacao(conta),
    "Bronze",
    "regra muda no dia 1 mesmo sem escrita agendada",
  );
  conta = await c.sincronizarRankMensalClienteUI("a");
  assert.equal(conta.nivelCliente, "Bronze");
  assert.equal(conta.bonusDisponivel, 35);
  const cupom = { rankRegra: { acesso: "crescente", nivel: "Prata", descontoPorRank: false } };
  assert.throws(() => c.resolverCupomRankUI(cupom, conta), /Prata ou superior/);
  const campo = { dataset: {}, textContent: "Bronze" };
  const holder = { dataset: {}, innerHTML: "", querySelector: () => null };
  c.document = {
    getElementById: (id) => (id === "rank-mensal-perfil-ui" ? holder : null),
    querySelectorAll: (sel) => (sel.startsWith("#perfil-dado") ? [campo] : []),
  };
  c.atualizarCartaoRankMensalPerfilUI(conta);
  assert.equal(campo.textContent, "Bronze");
  conta.rankMensal.meses["2026-12"] = 70000;
  c.atualizarCartaoRankMensalPerfilUI(conta);
  assert.equal(
    campo.textContent,
    "Ouro",
    "nível e progresso usam o mesmo mês, mesmo com campo antigo em cache",
  );
  assert.equal(holder.innerHTML, "", "perfil não expõe o painel do rank");
  assert.match(c.htmlRankMensalUI(conta), /Faltam.*500.*Diamante/);
  console.log(
    "PASS: rank mensal, metas, virada de Cuiabá, importação, pagamentos integral/separado, cancelamentos, cupons e bônus preservados.",
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
