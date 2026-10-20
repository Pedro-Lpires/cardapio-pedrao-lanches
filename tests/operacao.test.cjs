const fs = require("fs");
const vm = require("vm");
const assert = require("node:assert/strict");
const clone = (x) => JSON.parse(JSON.stringify(x));
const context = vm.createContext({
  console,
  Intl,
  Date,
  Math,
  Map,
  Set,
  Number,
  String,
  JSON,
  Array,
  Error,
  URLSearchParams,
  document: { addEventListener() {} },
  window: { addEventListener() {} },
  localStorage: {
    getItem() {
      return "Teste";
    },
  },
  sessionStorage: {
    getItem() {
      return "Teste";
    },
  },
  location: { search: "" },
  alert() {},
  confirm() {
    return true;
  },
});
vm.runInContext(fs.readFileSync("js/operacao.js", "utf8"), context);
context.confirmarOperacao = async () => true;
context.avisoOperacao = () => {};
function mockDb(initial) {
  const docs = new Map(Object.entries(clone(initial)));
  let seq = 0;
  const ref = (path) => ({
    path,
    id: path.split("/").at(-1),
    get: async () => snap(path),
    update: async (data) => docs.set(path, { ...docs.get(path), ...clone(data) }),
  });
  const snap = (path) => ({
    exists: docs.has(path),
    data: () => clone(docs.get(path) || {}),
    id: path.split("/").at(-1),
  });
  const colecao = (c, filtros = []) => ({
    doc: (id) => ref(c + "/" + (id || "fila-" + ++seq)),
    where: (campo, op, valor) => colecao(c, [...filtros, [campo, valor]]),
    get: async () => ({
      docs: [...docs.keys()]
        .filter((p) => p.startsWith(c + "/") && filtros.every(([k, v]) => docs.get(p)[k] === v))
        .map(snap),
    }),
  });
  return {
    docs,
    collection: (c) => colecao(c),
    batch: () => {
      const writes = [];
      return {
        update: (r, d) => writes.push([r.path, d]),
        commit: async () =>
          writes.forEach(([p, d]) => docs.set(p, { ...docs.get(p), ...clone(d) })),
      };
    },
    runTransaction: async (fn) => {
      const writes = [];
      const result = await fn({
        get: async (r) => snap(r.path),
        set: (r, d) => writes.push([r.path, clone(d)]),
        update: (r, d) => writes.push([r.path, { ...docs.get(r.path), ...clone(d) }]),
      });
      writes.forEach(([p, d]) => docs.set(p, d));
      return result;
    },
  };
}
function patch(comanda, pagamento) {
  const pagamentos = [...(comanda.pagamentos || []), pagamento];
  const valorPago = pagamentos.reduce((n, p) => n + p.valorPago, 0);
  const valorQuitado = pagamentos.reduce((n, p) => n + p.valorQuitado, 0);
  return {
    pagamentos,
    valorPago,
    valorQuitado,
    saldoPendente: Math.max(0, comanda.valorTotal - valorQuitado),
    status: valorQuitado >= comanda.valorTotal ? "Fechada" : "Aberta",
  };
}
function pagamento(id, valor, extra = {}) {
  return {
    id,
    modo: "valor",
    valorOriginal: valor,
    valorQuitado: valor,
    valorPago: valor,
    valor: valor,
    clienteId: null,
    clienteNome: null,
    cupomId: null,
    cupomCodigo: null,
    cupomNome: null,
    descontoCupom: 0,
    descontoFidelidade: 0,
    formas: [{ forma: "Pix", valor }],
    itens: [],
    pagoEm: Date.now(),
    ...extra,
  };
}
async function testarPagamentos(db, prefix) {
  context.db = db;
  const ref = db.collection("comandas").doc(prefix);
  let anterior = (await ref.get()).data();
  const p1 = pagamento(prefix + "-p1", 15, {
    clienteId: prefix + "-cliente",
    clienteNome: "Teste",
  });
  await context.salvarPagamentoSeparadoAtomico(ref, anterior, p1, patch(anterior, p1), [
    { nome: "Divisão por valor", quantidade: 1, subtotal: 15 },
  ]);
  anterior = (await ref.get()).data();
  assert.equal(anterior.saldoPendente, 15);
  assert.equal(anterior.status, "Aberta");
  // Repetição do mesmo ID não adiciona pagamento nem histórico.
  await context.salvarPagamentoSeparadoAtomico(ref, anterior, p1, patch(anterior, p1), []);
  assert.equal((await ref.get()).data().pagamentos.length, 1);
  const p2 = pagamento(prefix + "-p2", 15);
  await context.salvarPagamentoSeparadoAtomico(ref, anterior, p2, patch(anterior, p2), []);
  const final = (await ref.get()).data();
  assert.equal(final.valorPago, 30);
  assert.equal(final.valorQuitado, 30);
  assert.equal(final.status, "Fechada");
  assert.equal(
    (
      await db
        .collection("clientes")
        .doc(prefix + "-cliente")
        .get()
    ).data().totalGasto,
    15,
  );
  assert.equal(
    (await db.collection("historicoPagamentosClientes").doc(p1.id).get()).data().valorPago,
    15,
  );
  assert.equal((await db.collection("historicoPagamentosClientes").doc(p2.id).get()).exists, false);
  return [
    ref,
    db.collection("clientes").doc(prefix + "-cliente"),
    db.collection("historicoPagamentosClientes").doc(p1.id),
  ];
}
async function localTests() {
  let db = mockDb({
    "comandas/teste": {
      valorTotal: 30,
      status: "Aberta",
      itens: [{ nome: "Lanche", quantidade: 1, precoUnitario: 30 }],
      pagamentos: [],
    },
    "clientes/teste-cliente": { nome: "Teste", totalGasto: 0, fidelidadeAtiva: false },
  });
  await testarPagamentos(db, "teste");
  console.log("PASS: 15 + 15, com e sem conta, histórico único e repetição idempotente");
  db = mockDb({
    "comandas/desconto": { valorTotal: 325, status: "Aberta", itens: [], pagamentos: [] },
    "clientes/cliente": {
      totalGasto: 0,
      totalFidelidade: 0,
      bonusDisponivel: 0,
      bonusGeradoTotal: 0,
      fidelidadeAtiva: true,
    },
    "cuponsDesconto/CUPOM": { ativo: true, clientesPermitidos: ["cliente"] },
  });
  context.db = db;
  const ref = db.collection("comandas").doc("desconto"),
    c = (await ref.get()).data();
  const p = pagamento("beneficios", 325, {
    clienteId: "cliente",
    valorPago: 300,
    valor: 300,
    descontoCupom: 5,
    descontoFidelidade: 20,
    cupomId: "CUPOM",
  });
  await context.salvarPagamentoSeparadoAtomico(ref, c, p, patch(c, p), []);
  assert.equal((await ref.get()).data().valorPago, 300);
  assert.equal((await ref.get()).data().valorQuitado, 325);
  assert.equal(db.docs.get("clientes/cliente").totalFidelidade, 300);
  assert.equal(db.docs.get("clientes/cliente").bonusDisponivel, 0);
  console.log("PASS: cupom 5 + fidelidade 20, recebido 300, quitado 325");
  const outro = pagamento("duplicado", 15);
  await assert.rejects(
    () => context.salvarPagamentoSeparadoAtomico(ref, c, outro, patch(c, outro), []),
    /encerrada/,
  );
  db = mockDb({
    "comandas/concorrente": {
      valorTotal: 30,
      status: "Aberta",
      itens: [],
      pagamentos: [pagamento("anterior", 20)],
    },
  });
  context.db = db;
  const concorrente = db.collection("comandas").doc("concorrente");
  const stale = { valorTotal: 30, status: "Aberta", itens: [], pagamentos: [] };
  await assert.rejects(
    () =>
      context.salvarPagamentoSeparadoAtomico(
        concorrente,
        stale,
        pagamento("novo", 15),
        patch(stale, pagamento("novo", 15)),
        [],
      ),
    /Outro pagamento/,
  );
  const atual = (await concorrente.get()).data();
  await assert.rejects(
    () =>
      context.salvarPagamentoSeparadoAtomico(
        concorrente,
        atual,
        pagamento("excedente", 15),
        patch(atual, pagamento("excedente", 15)),
        [],
      ),
    /ultrapassa/,
  );
  assert.equal((await concorrente.get()).data().pagamentos.length, 1);
  assert.equal(
    context.serializarOperacao({ b: 2, a: { d: 4, c: 3 } }),
    context.serializarOperacao({ a: { c: 3, d: 4 }, b: 2 }),
  );
  console.log("PASS: concorrência, saldo excedido e ordem variável de campos do Firebase");
  const itens = [
    { nome: "Baguncinha", quantidade: 2, adicionais: [] },
    { nome: "Baguncinha", quantidade: 3, adicionais: [] },
    { nome: "Baguncinha", quantidade: 1, obs: "Sem queijo" },
  ];
  assert.equal(context.agruparItensOperacao(itens).length, 2);
  assert.equal(context.agruparItensOperacao(itens)[0].quantidade, 5);
  const recibo = context.gerarImpressaoOperacao("cozinha", {
    mesa: 3,
    cliente: "<script>x</script>",
    itens,
    valorTotal: 150,
  });
  assert(!recibo.includes("R$"));
  assert(recibo.includes("5 × Baguncinha"));
  assert(!recibo.includes("<script>"));
  assert(recibo.includes("Sem queijo"));
  const geral = context.gerarImpressaoOperacao("geral", {
    mesa: 1,
    status: "Aberta",
    valorTotal: 55,
    valorPago: 10,
    pagamentos: [{ valorQuitado: 15, valorPago: 10 }],
    descontoCupom: 5,
    itens: [],
  });
  assert(!geral.includes("Taxa de entrega"));
  assert(!geral.includes("<small>"));
  assert.match(geral, /Falta receber: R\$\s40,00/);
  assert.match(geral, /Total: R\$\s50,00/);
  const fechado = context.gerarImpressaoOperacao("geral", {
    mesa: 1,
    status: "Fechada",
    valorTotal: 55,
    valorPago: 50,
    pagamentos: [{ forma: "Pix", valor: 50 }],
    descontoCupom: 5,
  });
  assert.match(fechado, /Falta receber: R\$\s0,00/);
  assert.match(fechado, /Total: R\$\s50,00/);
  assert.equal(
    context.bebidasOperacao([
      {
        nome: "Combo",
        categoria: "combos",
        quantidade: 2,
        descricao: "2 lanches + Refrigerante 1,5L",
      },
    ])[0].quantidade,
    2,
  );
  assert.equal(context.lerValorOperacao("15,00"), 15);
  assert(Number.isNaN(context.lerValorOperacao("-1")));
  assert(Number.isNaN(context.lerValorOperacao("15abc")));
  console.log(
    "PASS: impressão sem valores, agrupamento, observações, bebidas de combos e validação monetária",
  );
  const itemMolhos = {
    nome: "Lanche",
    quantidade: 1,
    molhosGratis: [
      { unidade: 1, tipo: "doisiguais", texto: "2 Maionese" },
      { unidade: 2, tipo: "semmolho", texto: "Sem molho" },
    ],
    molhosPagos: [{ nome: "Barbecue", qtd: 2, preco: 2 }],
  };
  const molhos = context.molhosAtendenteOperacao([itemMolhos]);
  assert(molhos.includes("2 Maionese"));
  assert(molhos.includes("Unidade 2: Sem molho"));
  assert(molhos.includes("2 × Barbecue"));
  for (const destino of ["cozinha", "motoboy"]) {
    const impressao = context.gerarImpressaoOperacao(destino, { itens: [itemMolhos] });
    assert(!impressao.includes("Maionese"));
    assert(!impressao.includes("Barbecue"));
  }
  console.log(
    "PASS: molhos grátis/pagos aparecem para atendente e ficam fora das impressões de cozinha/motoboy",
  );
  db = mockDb({
    "comandas/cozinha": {
      cliente: "Teste",
      status: "Aberta",
      mesa: 3,
      itens: [{ nome: "Lanche", quantidade: 2, subtotal: 40 }],
      itensEnviadosCozinha: [{ nome: "Lanche", quantidade: 1, subtotal: 20 }],
    },
  });
  context.db = db;
  await context.confirmarProducaoOperacao("comandas", "cozinha");
  assert.equal(db.docs.get("filaCozinha/comandas_cozinha_ativo").itens[0].quantidade, 2);
  await context.confirmarProducaoOperacao("comandas", "cozinha");
  assert.equal([...db.docs.keys()].filter((k) => k.startsWith("filaCozinha/")).length, 1);
  await db
    .collection("comandas")
    .doc("cozinha")
    .update({ itens: [{ nome: "Lanche", quantidade: 1, observacao: "Sem cebola" }] });
  await context.confirmarProducaoOperacao("comandas", "cozinha");
  assert.equal(db.docs.get("filaCozinha/comandas_cozinha_ativo").itens[0].observacao, "Sem cebola");
  await context.concluirCozinhaOperacao("comandas_cozinha_ativo");
  assert.equal(db.docs.get("filaCozinha/comandas_cozinha_ativo").status, "pronto");
  await context.voltarCozinhaOperacao("comandas_cozinha_ativo");
  assert.equal(db.docs.get("filaCozinha/comandas_cozinha_ativo").status, "aguardando");
  await db.collection("comandas").doc("cozinha").update({ status: "Fechada", valorPago: 40 });
  assert.equal(db.docs.get("filaCozinha/comandas_cozinha_ativo").status, "aguardando");
  await context.cancelarPreparoComandaOperacao("cozinha");
  assert.equal(db.docs.get("filaCozinha/comandas_cozinha_ativo").status, "cancelado");
  const combo = context.detalhesItemOperacao({
    nome: "Combo",
    lanchesCombo: [
      { adicionais: [] },
      { adicionais: [{ nome: "Bacon", qtd: 1 }] },
      { observacao: "Sem tomate" },
    ],
  });
  assert(!combo.includes("Lanche 1"));
  assert(combo.includes("Lanche 2"));
  assert(combo.includes("Lanche 3"));
  assert(combo.includes("Sem tomate"));
  console.log(
    "PASS: fila idempotente, edição atualiza, pagamento preserva, cancelamento retira e combo mostra só personalizações",
  );
  context.confirmarOperacao = async () => false;
  db.docs.set("comandas/automatico", {
    status: "Aberta",
    mesa: 4,
    cliente: "Teste",
    itens: [{ nome: "Lanche", quantidade: 1 }],
  });
  await context.confirmarProducaoOperacao("comandas", "automatico", true);
  assert.equal(db.docs.get("filaCozinha/comandas_automatico_ativo").mesa, 4);
  db.docs.set("pedidos/delivery", { tipo: "Entrega", itens: [{ nome: "Lanche", quantidade: 1 }] });
  await context.confirmarProducaoOperacao("pedidos", "delivery", true);
  assert.equal([...db.docs.keys()].filter((k) => k.startsWith("filaCozinha/")).length, 2);
  console.log("PASS: comanda local segue direto; delivery não aceita liberação automática");
  db = mockDb({
    "comandas/etapas": { status: "Aberta", itens: [{ nome: "Lanche", quantidade: 1 }] },
  });
  context.db = db;
  await context.confirmarProducaoOperacao("comandas", "etapas", true);
  await context.concluirCozinhaOperacao("comandas_etapas_ativo");
  await db
    .collection("comandas")
    .doc("etapas")
    .update({ itens: [{ nome: "Lanche", quantidade: 2 }] });
  await context.confirmarProducaoOperacao("comandas", "etapas", true);
  await context.confirmarProducaoOperacao("comandas", "etapas", true);
  assert.equal(db.docs.get("filaCozinha/comandas_etapas_ativo").itens[0].quantidade, 1);
  assert.equal([...db.docs.values()].filter((d) => d.status === "pronto").length, 1);
  console.log(
    "PASS: inclusão após pedido pronto preserva o concluído e envia apenas a diferença sem duplicar",
  );
  // Usa as funções reais da tela do atendente com um DOM mínimo.
  const area = { innerHTML: "", scrollIntoView() {} };
  context.document.getElementById = (id) => (id === "area-fechamento-comanda" ? area : null);
  vm.runInContext(fs.readFileSync("js/atendente.js", "utf8"), context);
  context.db = mockDb({
    "comandas/identificacao": { status: "Aberta", valorTotal: 30, clienteId: "cliente" },
    "clientes/cliente": { nome: "Pedro" },
  });
  await context.abrirIdentificacaoPagamentoSeparado("identificacao", 15);
  assert(area.innerHTML.includes("Continuar como"));
  assert(area.innerHTML.includes("Pedro"));
  assert(area.innerHTML.includes("Continuar sem conta"));
  assert(area.innerHTML.includes("Usar outro cliente"));
  context.db = mockDb({
    "comandas/sessao": { status: "Aberta", valorTotal: 30, sessaoAutoatendimentoId: "sessao" },
    "sessoesMesa/sessao": { clienteId: "cliente" },
    "clientes/cliente": { nome: "Maria" },
  });
  await context.abrirIdentificacaoPagamentoSeparado("sessao", 15);
  assert(area.innerHTML.includes("Maria"));
  console.log(
    "PASS: três escolhas de cliente e recuperação da conta pela sessão do autoatendimento",
  );
}
module.exports = { context, testarPagamentos, pagamento, patch };
if (require.main === module)
  localTests().catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
