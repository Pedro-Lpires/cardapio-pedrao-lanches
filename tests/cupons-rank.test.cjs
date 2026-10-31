const fs = require("node:fs");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const { context: c, mockDb, pagamento, patch } = require("./operacao.test.cjs");
vm.runInContext(fs.readFileSync("js/cupons-rank.js", "utf8"), c);
const cliente = (nivelCliente) => ({ nivelCliente, fidelidadeAtiva: true });
const regra = (acesso = "todos", nivel = "Prata") => ({
  acesso,
  nivel,
  descontoPorRank: true,
  percentuais: { Bronze: 5, Prata: 7, Ouro: 9, Diamante: 11, Imortal: 13 },
});
const cupom = {
  codigo: "BKFP",
  ativo: true,
  uso: "diversos",
  tipo: "item",
  itemGeral: true,
  itemGeralTipo: "todos",
  rankRegra: regra(),
};
const itens = [
  { nome: "Baguncinha", preco: 25, quantidade: 2, categoria: "Lanches" },
  { nome: "Coca 2L", preco: 22, quantidade: 1, categoria: "Bebidas" },
];
function desconto(rank, config = cupom) {
  return c.calcularCupomRankUI(c.resolverCupomRankUI(config, cliente(rank)), {
    base: 72,
    taxa: 10,
    itens,
  }).desconto;
}

(async () => {
  assert.equal(desconto("Bronze"), 3.6);
  assert.equal(desconto("Prata"), 5.04);
  assert.equal(desconto("Imortal"), 9.36);
  assert.throws(() => c.resolverCupomRankUI(cupom, null), /Entre na sua conta/);
  assert.throws(
    () => c.resolverCupomRankUI(cupom, { nivelCliente: "Ouro", fidelidadeAtiva: false }),
    /rank ativo/,
  );
  assert.equal(c.resolverCupomRankUI(cupom, { fidelidadeAtiva: true }).rankAplicado, "Bronze");
  assert.equal(c.resolverCupomRankUI(cupom, cliente("Lenda")).rankAplicado, "Imortal");
  const exclusivo = { ...cupom, rankRegra: regra("exclusivo") };
  assert.throws(() => desconto("Bronze", exclusivo), /exclusivo.*Prata.*Bronze/);
  assert.throws(() => desconto("Ouro", exclusivo), /exclusivo.*Prata.*Ouro/);
  assert.equal(desconto("Prata", exclusivo), 5.04);
  const crescente = { ...cupom, rankRegra: regra("crescente") };
  assert.throws(() => desconto("Bronze", crescente), /Prata ou superior/);
  assert.equal(desconto("Ouro", crescente), 6.48);
  const fixo = {
    ...cupom,
    rankRegra: { ...regra("exclusivo"), descontoPorRank: false },
    tipo: "pedido",
    modo: "valor",
    valor: 10,
  };
  assert.equal(desconto("Prata", fixo), 10);
  assert.throws(
    () => c.validarRegraCupomRankUI({ ...regra(), percentuais: { Bronze: 101 } }),
    /100%/,
  );
  assert.throws(
    () => c.validarRegraCupomRankUI({ ...regra(), percentuais: { Bronze: 0 } }),
    /Bronze/,
  );
  assert.doesNotThrow(() =>
    c.validarRegraCupomRankUI({ ...regra("exclusivo"), percentuais: { Prata: 7 } }),
  );
  assert.equal(desconto("Prata", { ...cupom, itemGeralTipo: "bebidas" }), 1.54);
  assert.equal(desconto("Prata", { ...cupom, itemGeral: false, itemNome: "Coca 2L" }), 1.54);
  assert.throws(
    () => desconto("Prata", { ...cupom, temPedidoMinimo: true, pedidoMinimo: 100 }),
    /compra mínima/,
  );
  const antigo = { ativo: true, tipo: "pedido", modo: "valor", valor: 5 };
  assert.equal(c.resolverCupomRankUI(antigo, null), antigo);

  // O desconto apresentado e o confirmado precisam coincidir com a conta atual.
  const pedido = {
    clienteId: "cliente",
    itens,
    taxaEntrega: 10,
    descontoCupom: 5.04,
    cupomDescontoCodigo: "BKFP",
  };
  const criarDb = (rank = "Prata", extra = {}) =>
    mockDb({
      "clientes/cliente": cliente(rank),
      "cuponsDesconto/BKFP": cupom,
      ...extra,
    });
  c.db = criarDb();
  await c.salvarPedidoComCupomOperacao(c.db.collection("pedidos").doc("novo"), pedido);
  assert.equal(c.db.docs.get("pedidos/novo").descontoCupom, 5.04);
  c.db = criarDb("Bronze");
  await assert.rejects(
    c.salvarPedidoComCupomOperacao(c.db.collection("pedidos").doc("novo"), pedido),
    /mudou/,
  );
  assert.equal(c.db.docs.has("pedidos/novo"), false);
  c.db = criarDb("Prata", { "cuponsDesconto/BKFP": { ...exclusivo, uso: "unico" } });
  await assert.rejects(
    c.salvarPedidoComCupomOperacao(c.db.collection("pedidos").doc("novo"), {
      ...pedido,
      clienteId: null,
    }),
    /Entre na sua conta/,
  );
  assert.equal(c.db.docs.get("cuponsDesconto/BKFP").ativo, true);
  await c.salvarPedidoComCupomOperacao(c.db.collection("pedidos").doc("novo"), pedido);
  assert.equal(c.db.docs.get("cuponsDesconto/BKFP").ativo, false);

  // Mesmo bloqueio para comandas: o cupom não é consumido antes de validar.
  c.db = criarDb("Ouro", {
    "comandas/c": { status: "Aberta", itens },
    "cuponsDesconto/BKFP": exclusivo,
  });
  let ref = c.db.collection("comandas").doc("c");
  let lote = c.lotePagamentoCupomOperacao("BKFP", "cliente", ref);
  lote.update(ref, { status: "Fechada", valorOriginal: 72, descontoCupom: 5.04 });
  await assert.rejects(lote.commit(), /exclusivo/);
  assert.equal(c.db.docs.get("comandas/c").status, "Aberta");
  c.db = criarDb("Prata", { "comandas/c": { status: "Aberta", itens } });
  ref = c.db.collection("comandas").doc("c");
  lote = c.lotePagamentoCupomOperacao("BKFP", "cliente", ref);
  lote.update(ref, { status: "Fechada", valorOriginal: 72, descontoCupom: 5.04 });
  await lote.commit();
  assert.equal(c.db.docs.get("comandas/c").status, "Fechada");

  // Pagamento separado usa somente os itens desta pessoa, com revalidação do rank.
  const parteComanda = { status: "Aberta", valorTotal: 72, itens, pagamentos: [] };
  const parte = pagamento("parte", 25, {
    clienteId: "cliente",
    cupomId: "BKFP",
    cupomCodigo: "BKFP",
    descontoCupom: 1.75,
    valorPago: 23.25,
    modo: "itens",
    itens: [{ itemIndex: 0, quantidade: 1 }],
  });
  c.db = criarDb("Prata", { "comandas/c": parteComanda });
  ref = c.db.collection("comandas").doc("c");
  await c.salvarPagamentoSeparadoAtomico(ref, parteComanda, parte, patch(parteComanda, parte), [
    { ...itens[0], quantidade: 1 },
  ]);
  assert.equal(c.db.docs.get("comandas/c").saldoPendente, 47);
  c.db = criarDb("Bronze", { "comandas/c": parteComanda });
  await assert.rejects(
    c.salvarPagamentoSeparadoAtomico(
      c.db.collection("comandas").doc("c"),
      parteComanda,
      parte,
      patch(parteComanda, parte),
      [{ ...itens[0], quantidade: 1 }],
    ),
    /mudou/,
  );
  assert.equal(c.db.docs.has("historicoPagamentosClientes/parte"), false);

  // O delivery mostra o aviso e limpa descontos anteriores para quem não tem acesso.
  const fonte = fs.readFileSync("js/script.js", "utf8");
  vm.runInContext(
    fonte.slice(
      fonte.indexOf("async function aplicarCupomDesconto()"),
      fonte.indexOf(
        "function arredondarPagamento(",
        fonte.indexOf("async function aplicarCupomDesconto()"),
      ),
    ),
    c,
  );
  const retorno = { innerText: "" };
  c.document.getElementById = (id) =>
    id === "codigo-cupom-desconto" ? { value: "bkfp" } : retorno;
  c.dadosPedidoTemporario = { subtotal: 72, taxa: 10, km: 5 };
  c.carrinho = itens;
  c.exibirRevisao = () => {};
  let aviso = "";
  c.mostrarAvisoUI = (msg) => {
    aviso = msg;
  };
  c.removerCupomDescontoCliente = () => {
    c.descontoCupom = 0;
    c.cupomDescontoAplicado = null;
  };
  c.clienteLogado = null;
  c.db = criarDb();
  await c.aplicarCupomDesconto();
  assert.match(aviso, /Entre na sua conta/);
  c.clienteLogado = { telefone: "cliente", ...cliente("Bronze") };
  await c.aplicarCupomDesconto();
  assert.equal(c.descontoCupom, 5.04); // Lê Prata no banco, não o Bronze antigo salvo no aparelho.
  assert.equal(c.cupomDescontoAplicado.codigo, "BKFP");
  c.db.docs.set("cuponsDesconto/BKFP", exclusivo);
  c.db.docs.set("clientes/cliente", cliente("Ouro"));
  await c.aplicarCupomDesconto();
  assert.match(aviso, /exclusivo do rank Prata/);
  assert.equal(c.descontoCupom, 0);
  // O fechamento de mesa oferece apenas os cupons compatíveis com a conta.
  const atendente = fs.readFileSync("js/atendente.js", "utf8");
  vm.runInContext(
    atendente.slice(
      atendente.indexOf("function calcularDescontoCupomAtendente("),
      atendente.indexOf("async function carregarPedidosRetiradaAtendente("),
    ),
    c,
  );
  c.db = criarDb("Bronze");
  const collectionBase = c.db.collection;
  c.db.collection = (nome) => {
    const colecao = collectionBase(nome);
    if (nome !== "cuponsDesconto") return colecao;
    return {
      ...colecao,
      where(...args) {
        const consulta = colecao.where(...args);
        return {
          ...consulta,
          get: async () => {
            const snap = await consulta.get();
            return { ...snap, forEach: (fn) => snap.docs.forEach(fn) };
          },
        };
      },
    };
  };
  assert.equal((await c.buscarCuponsElegiveisAtendente(72, itens)).length, 0);
  assert.equal(
    (await c.buscarCuponsElegiveisAtendente(72, itens, "cliente"))[0].descontoCalculado,
    3.6,
  );
  c.db.docs.set("cuponsDesconto/BKFP", crescente);
  assert.equal((await c.buscarCuponsElegiveisAtendente(72, itens, "cliente")).length, 0);
  c.db.docs.set("clientes/cliente", cliente("Ouro"));
  assert.equal(
    (await c.buscarCuponsElegiveisAtendente(72, itens, "cliente"))[0].descontoCalculado,
    6.48,
  );
  c.db.docs.set("cuponsDesconto/BKFP", exclusivo);
  assert.equal((await c.buscarCuponsElegiveisAtendente(72, itens, "cliente")).length, 0);

  // Cadastro real do ADM persiste a tabela e rejeita percentuais incompletos.
  const campos = {};
  c.document.getElementById = (id) =>
    (campos[id] ||= { value: "", checked: false, disabled: false });
  vm.runInContext(fs.readFileSync("js/cupons-rank-admin-ui.js", "utf8"), c);
  const admin = fs.readFileSync("js/admin.js", "utf8");
  vm.runInContext(
    admin.slice(
      admin.indexOf("async function criarCupomDesconto()"),
      admin.indexOf("async function listarCuponsDesconto()"),
    ),
    c,
  );
  function campo(id, value) {
    c.document.getElementById("cupom-" + id).value = value;
  }
  campo("nome", "Black Pedrão");
  campo("codigo", "BLACKTESTE");
  campo("tipo", "item");
  campo("item-geral-tipo", "todos");
  c.document.getElementById("cupom-item-geral").checked = true;
  c.document.getElementById("cupom-rank-ativo").checked = true;
  c.document.getElementById("cupom-rank-percentual").checked = true;
  campo("rank-acesso", "crescente");
  campo("rank-nivel", "Prata");
  for (const [nivel, percentual] of Object.entries(regra().percentuais))
    campo("rank-" + nivel, String(percentual));
  c.finalizarSalvarCupomUI = async () => {};
  c.alert = (msg) => {
    throw Error(msg);
  };
  c.db = criarDb();
  await c.criarCupomDesconto();
  assert.equal(c.db.docs.get("cuponsDesconto/BLACKTESTE").rankRegra.acesso, "crescente");
  assert.equal(c.db.docs.get("cuponsDesconto/BLACKTESTE").rankRegra.percentuais.Prata, 7);
  campo("codigo", "INVALIDO");
  campo("rank-Prata", "101");
  await assert.rejects(c.criarCupomDesconto(), /100%/);
  assert.equal(c.db.docs.has("cuponsDesconto/INVALIDO"), false);
  console.log(
    "PASS: cupons por rank, cadastro, exclusividade, progressão e confirmação transacional.",
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
