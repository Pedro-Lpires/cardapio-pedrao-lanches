const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  vm = require("node:vm");
const agora = Date.parse("2026-10-28T20:00:00-04:00"),
  registros = new Map(),
  campos = {};
let seq = 0,
  filaTx = Promise.resolve(),
  sons = 0;
const clone = (x) => (x === undefined ? undefined : structuredClone(x));
const snap = (path) => ({
  id: path.split("/").at(-1),
  exists: registros.has(path),
  data: () => clone(registros.get(path)),
});
function ref(path) {
  return {
    path,
    id: path.split("/").at(-1),
    get: async () => snap(path),
    update: async (p) => registros.set(path, { ...registros.get(path), ...clone(p) }),
    collection: (n) => query(path + "/" + n),
  };
}
function query(path, filtros = []) {
  return {
    doc: (id) => ref(path + "/" + (id || "novo" + ++seq)),
    where: (campo, op, valor) => query(path, [...filtros, [campo, op, valor]]),
    orderBy: () => query(path, filtros),
    limit: () => query(path, filtros),
    async get() {
      const docs = [...registros]
        .filter(
          ([p, d]) =>
            p.startsWith(path + "/") &&
            p.slice(path.length + 1).indexOf("/") < 0 &&
            filtros.every(([campo, op, v]) =>
              op === "=="
                ? d[campo] === v
                : op === "in"
                  ? v.includes(d[campo])
                  : op === ">="
                    ? d[campo] >= v
                    : d[campo] < v,
            ),
        )
        .map(([p]) => snap(p));
      return { docs, empty: !docs.length, forEach: (fn) => docs.forEach(fn) };
    },
  };
}
const db = {
  collection: query,
  async runTransaction(fn) {
    const anterior = filaTx;
    let liberar;
    filaTx = new Promise((r) => (liberar = r));
    await anterior;
    const escritas = [];
    try {
      const valor = await fn({
        get: async (r) => {
          assert.equal(escritas.length, 0, "Leituras vêm antes das gravações");
          return snap(r.path);
        },
        set: (r, p, opts) => escritas.push([r.path, p, !!opts?.merge]),
        update: (r, p) => escritas.push([r.path, p, true]),
      });
      for (const [p, d, merge] of escritas)
        registros.set(p, { ...(merge ? registros.get(p) : {}), ...clone(d) });
      return valor;
    } finally {
      liberar();
    }
  },
};
class DataFixa extends Date {
  constructor(...args) {
    super(...(args.length ? args : [agora]));
  }
  static now() {
    return agora;
  }
}
const campo = (id) => (campos[id] ||= { hidden: true, style: {}, textContent: "", innerHTML: "" });
const ctx = vm.createContext({
  console,
  Date: DataFixa,
  Intl,
  setTimeout,
  clearTimeout,
  db,
  document: { addEventListener() {}, getElementById: campo, querySelector: () => null },
  window: { addEventListener() {} },
  localStorage: { getItem: () => "Atendente Teste" },
  avisarSomPedidosSiteUI: () => sons++,
  confirmarOperacao: async () => true,
  avisoOperacao: (msg) => {
    throw Error(msg);
  },
});
vm.runInContext(fs.readFileSync("js/operacao.js", "utf8"), ctx);
vm.runInContext(fs.readFileSync("js/pedidos-site-atendente.js", "utf8"), ctx);
vm.runInContext(fs.readFileSync("js/editor-pedido-ui.js", "utf8"), ctx);
vm.runInContext(fs.readFileSync("js/editor-cliente-admin-ui.js", "utf8"), ctx);
ctx.confirmarOperacao = async () => true;
ctx.avisoOperacao = (msg) => {
  throw Error(msg);
};
function carregar(nome, arquivo = "js/atendente.js") {
  const s = fs.readFileSync(arquivo, "utf8"),
    inicio = s.search(new RegExp("(?:async )?function " + nome + "\\(")),
    fim = s.slice(inicio + 1).search(/\n(?:async )?function /);
  assert(inicio >= 0, nome);
  vm.runInContext(s.slice(inicio, fim < 0 ? undefined : inicio + 1 + fim), ctx);
}
for (const nome of [
  "limparTipoDoNomePedido",
  "descobrirTipoNomePedido",
  "prepararItensPedidoParaComanda",
  "marcarPedidoComoRetirado",
  "abrirPedidosParaVincularNaMesa",
])
  carregar(nome);
ctx.localizarProdutoIdPedido = async (i) => i.produtoId || "lanche";
ctx.completarItensOperacao = async (itens) => clone(itens);
ctx.carregarPedidosRetiradaAtendente = async () => {};
ctx.carregarCentralOperacao = async () => {};
ctx.obterJanelaAtualPedidosAtendente = () => ({
  inicioMs: ctx.janelaOperacionalOperacao().inicio,
  fimMs: ctx.janelaOperacionalOperacao().fim,
});
const item = {
  nome: "X-Bagunça",
  produtoId: "lanche",
  tipoCarne: "Artesanal",
  tipo: "Artesanal",
  preco: 30,
  quantidade: 1,
  categoria: "Lanches",
  observacao: "Sem cebola",
  adicionais: [],
};
const pedido = (tipo, extra = {}) => ({
  nome: "Cliente teste",
  telefone: "65999999999",
  tipo,
  origem: "site_delivery",
  dataMs: agora,
  valorTotal: 30,
  itens: [clone(item)],
  ...extra,
});
function put(id, tipo, extra) {
  registros.set("pedidos/" + id, pedido(tipo, extra));
}
async function testar() {
  const conta = {
    nome: "Cliente",
    nomeReal: "Cliente Teste",
    fidelidadeAtiva: true,
    nivelCliente: "Ouro",
    codigoAtivacao: "1234",
    totalGasto: 100,
    totalFidelidade: 100,
    bonusDisponivel: 20,
  };
  registros.set("clientes/65999999999", clone(conta));
  const desativado = await ctx.salvarCadastroClientePedidoAdminUI("65999999999", conta, {
    ...conta,
    fidelidadeAtiva: false,
  });
  assert.equal(desativado.codigoAtivacao, "");
  assert.equal(desativado.fidelidadeAtiva, false);
  const ticket = { clienteId: "65999999999", status: "usada", expiraEm: agora + 86400000 };
  registros.set("raspadinhas/teste", clone(ticket));
  registros.set("clientes/65999999999/mensagens/raspa-teste", { raspadinhaStatus: "usada" });
  await ctx.alterarRaspadinhaClientePedidoAdminUI("65999999999", "teste", "reabrir", 0, ticket);
  assert.equal(registros.get("raspadinhas/teste").status, "disponivel");
  assert.equal(
    registros.get("clientes/65999999999/mensagens/raspa-teste").raspadinhaStatus,
    "disponivel",
  );
  registros.delete("clientes/65999999999");

  const pagoOriginal = pedido("Retirada", {
    pagamento: "Pix",
    pagamentoConfirmado: true,
    retirado: true,
    numero: 42,
    clienteId: "65999999999",
    valorTotal: 60,
    itens: [{ ...clone(item), quantidade: 2, subtotal: 60 }],
  });
  registros.set("pedidos/editor", clone(pagoOriginal));
  const rascunho = clone(pagoOriginal);
  rascunho.pagamento = "Pix + Cartão";
  rascunho.modoPagamentoEditor = "misto";
  rascunho.formas = [
    { forma: "Pix", valor: 2 },
    { forma: "Cartão", valor: 8 },
  ];
  rascunho.itens.push({
    nome: "Coca 1L",
    produtoId: "coca",
    categoria: "Bebidas",
    quantidade: 1,
    preco: 10,
    subtotal: 10,
  });
  const atualizado = await ctx.salvarEdicaoPedidoTransacaoUI("editor", pagoOriginal, rascunho);
  assert.equal(atualizado.valorTotal, 70);
  assert.equal(atualizado.valorPago, 60);
  assert.equal(atualizado.saldoPendente, 10);
  assert.equal(atualizado.pagamentoConfirmado, false);
  assert.equal(atualizado.retirado, false);
  assert.equal(atualizado.numero, 42);
  assert.equal(atualizado.clienteId, pagoOriginal.clienteId);
  assert.equal(atualizado.recebimentosPedido[0].forma, "Pix");
  assert.equal([...registros.keys()].filter((p) => p.startsWith("filaCozinha/")).length, 0);
  await assert.rejects(
    ctx.salvarEdicaoPedidoTransacaoUI("editor", pagoOriginal, rascunho),
    /outra tela/,
  );
  await ctx.registrarRecebimentoPedidoOperacao("editor", true, atualizado);
  let quitado = clone(registros.get("pedidos/editor"));
  assert.equal(quitado.valorPago, 70);
  assert.equal(quitado.recebimentosPedido.length, 2);
  assert.equal(quitado.recebimentosPedido[1].valor, 10);
  assert.equal(quitado.recebimentosPedido[1].formas[0].valor, 2);
  assert.equal(quitado.recebimentosPedido[1].formas[1].valor, 8);
  const reduzido = await ctx.salvarEdicaoPedidoTransacaoUI("editor", quitado, {
    ...quitado,
    itens: [clone(quitado.itens[0])],
  });
  assert.equal(reduzido.valorADevolver, 10);
  assert.equal(reduzido.valorPago, 70);
  assert.equal(reduzido.recebimentosPedido.length, 2);
  await assert.rejects(
    ctx.salvarEdicaoPedidoTransacaoUI("editor", reduzido, { ...reduzido, itens: [] }),
    /pelo menos/,
  );
  await assert.rejects(
    ctx.salvarEdicaoPedidoTransacaoUI("editor", reduzido, { ...reduzido, descontoCupom: 100 }),
    /ultrapassam/,
  );
  assert.equal(registros.get("pedidos/editor").valorTotal, 60);
  const corrigido = await ctx.salvarEdicaoPedidoTransacaoUI("editor", reduzido, {
    ...reduzido,
    correcaoRecebimentos: { 0: [{ forma: "Cartão", valor: 60 }] },
  });
  assert.equal(corrigido.valorPago, 70);
  assert.equal(corrigido.recebimentosPedido.length, 2);
  assert.equal(corrigido.recebimentosPedido[0].formas[0].forma, "Cartão");
  assert.equal(corrigido.recebimentosPedido[0].pagoEm, quitado.recebimentosPedido[0].pagoEm);
  registros.delete("pedidos/editor");

  for (let n = 1; n <= 8; n++) registros.set("mesas/legado" + n, { numero: n, ocupada: n === 1 });
  const mesas = await ctx.listarVinteMesasPedidoUI();
  assert.equal(mesas.length, 20);
  assert.equal(mesas[0].id, "legado1");
  assert.equal(mesas[0].ocupada, true);
  await ctx.listarVinteMesasPedidoUI();
  assert.equal([...registros.keys()].filter((p) => p.startsWith("mesas/")).length, 20);
  put("retirada", "Retirada");
  put("local", "Local");
  put("entrega", "Entrega");
  put("local-mesa", "Local", { mesa: 5 });
  put("local-comanda", "Local", { comandaId: "aberta" });
  put("local-reverso", "Local");
  registros.set("comandas/antiga", { pedidoOrigemId: "local-reverso", mesa: 4, status: "Fechada" });
  const disponiveis = await ctx.buscarPedidosLocalSemMesaUI();
  assert.deepEqual(
    Array.from(disponiveis, (p) => p.id),
    ["local"],
    "Vínculo exclui mesa, comanda e referência legada reversa",
  );
  await ctx.abrirPedidosParaVincularNaMesa("legado1");
  assert(campo("area-mesa-atendente").innerHTML.includes("local"));
  assert(!campo("area-mesa-atendente").innerHTML.includes("'retirada'"));
  assert(!campo("area-mesa-atendente").innerHTML.includes("'entrega'"));
  await assert.rejects(
    ctx.vincularPedidoLocalTransacaoUI("retirada", "legado1"),
    /Somente pedidos/,
  );
  await ctx.converterRetiradaConsumoLocalUI("retirada");
  assert.equal(registros.get("pedidos/retirada").tipo, "Local");
  const nova = await ctx.vincularPedidoLocalTransacaoUI("local", "legado1");
  assert.equal(registros.get("pedidos/local").comandaId, nova);
  assert.equal(registros.get("comandas/" + nova).itens.length, 1);
  assert.equal(
    [...registros.keys()].filter((p) => p.startsWith("filaCozinha/")).length,
    0,
    "Vincular não libera automaticamente",
  );
  assert.equal(await ctx.confirmarProducaoOperacao("comandas", nova), true);
  assert.equal([...registros.keys()].filter((p) => p.startsWith("filaCozinha/")).length, 1);
  put("concorrente", "Local");
  const resultados = await Promise.allSettled([
    ctx.vincularPedidoLocalTransacaoUI("concorrente", "legado1"),
    ctx.vincularPedidoLocalTransacaoUI("concorrente", "legado1"),
  ]);
  assert.equal(
    resultados.filter((r) => r.status === "fulfilled").length,
    1,
    "Dois atendentes não duplicam o vínculo",
  );
  put("preparado", "Retirada", {
    pagamentoConfirmado: true,
    pagamentoConfirmadoEm: agora - 1000,
    pagamento: "Pix",
  });
  await ctx.confirmarProducaoOperacao("pedidos", "preparado");
  const filaAntes = [...registros].filter(
    ([p, d]) => p.startsWith("filaCozinha/") && d.origemId === "preparado",
  );
  assert.equal(filaAntes.length, 1);
  registros.get(filaAntes[0][0]).status = "pronto";
  await ctx.converterRetiradaConsumoLocalUI("preparado");
  const comandaPaga = await ctx.vincularPedidoLocalTransacaoUI("preparado", "mesa-20");
  assert.equal(registros.get(filaAntes[0][0]).status, "pronto");
  assert.equal(registros.get(filaAntes[0][0]).origemId, comandaPaga);
  const antes = [...registros.keys()].filter((p) => p.startsWith("filaCozinha/")).length;
  ctx.confirmarOperacao = async () => false;
  assert.equal(await ctx.confirmarProducaoOperacao("comandas", comandaPaga), false);
  ctx.confirmarOperacao = async () => true;
  assert.equal(
    [...registros.keys()].filter((p) => p.startsWith("filaCozinha/")).length,
    antes,
    "Pedido já preparado não volta duplicado ao chapeiro",
  );
  const paga = registros.get("comandas/" + comandaPaga);
  assert.equal(paga.pagamentos.length, 1);
  assert.equal(paga.valorPago, 30);
  assert.equal(paga.saldoPendente, 0);
  assert.equal(paga.pagamentos[0].pagoEm, agora - 1000, "Mantém o dia do recebimento original");
  for (const [id, pagamentos] of [
    ["legada", [{ forma: "Dinheiro", valor: 15 }]],
    ["raiz", []],
  ]) {
    registros.set("comandas/" + id, {
      mesa: 1,
      status: "Aberta",
      itens: [clone(item)],
      valorTotal: 30,
      valorPago: 15,
      valorQuitado: 15,
      fechadoEm: agora - 2000,
      pagamentos,
    });
    put("pago-" + id, "Local", {
      pagamentoConfirmado: true,
      pagamentoConfirmadoEm: agora - 1000,
      pagamento: "Pix",
    });
    await ctx.vincularPedidoLocalTransacaoUI("pago-" + id, "legado1", id);
    const c = registros.get("comandas/" + id);
    assert.equal(c.valorPago, 45, "Preserva pagamento anterior e importa o pedido");
    assert.equal(c.valorQuitado, 45);
    assert.equal(c.saldoPendente, 15);
    assert.equal(c.pagamentos.length, 2);
    assert.equal(c.pagamentos[0].pagoEm, agora - 2000);
    assert(!c.pagamentos.some((p) => p.forma), "Não mistura formatos financeiros");
  }
  put("levado", "Retirada");
  await ctx.marcarPedidoComoRetirado("levado", 9);
  assert.equal(registros.get("pedidos/levado").retirado, true);
  assert.equal(
    registros.get("pedidos/levado").pagamentoConfirmado,
    true,
    "Retirada confirmada também confirma pagamento",
  );
  await ctx.confirmarRecebimentoOperacao("levado");
  const tempo = registros.get("pedidos/levado").pagamentoConfirmadoEm;
  await ctx.confirmarRecebimentoOperacao("levado");
  assert.equal(
    registros.get("pedidos/levado").pagamentoConfirmadoEm,
    tempo,
    "Repetir confirmação não muda o recebimento",
  );
  put("acrescimo", "Retirada", {
    valorTotal: 60,
    pagamento: "Pix",
    itens: [{ ...item, quantidade: 2, subtotal: 60 }],
  });
  await ctx.registrarRecebimentoPedidoOperacao(
    "acrescimo",
    true,
    registros.get("pedidos/acrescimo"),
  );
  const editado = registros.get("pedidos/acrescimo");
  Object.assign(editado, {
    valorTotal: 70,
    pagamentoConfirmado: false,
    retirado: false,
    pagamento: "Dinheiro",
  });
  editado.itens.push({
    produtoId: "coca",
    nome: "Coca 1L",
    categoria: "bebidas",
    quantidade: 1,
    preco: 10,
    subtotal: 10,
  });
  assert.equal(ctx.saldoPedidoOperacao(editado), 10);
  assert.equal(ctx.valorRecebidoPedidoOperacao(editado), 60);
  assert.equal(
    editado.recebimentosPedido[0].itensPedido.length,
    1,
    "Recibo preserva itens originais",
  );
  await ctx.registrarRecebimentoPedidoOperacao("acrescimo", true, clone(editado));
  await ctx.registrarRecebimentoPedidoOperacao(
    "acrescimo",
    true,
    clone(registros.get("pedidos/acrescimo")),
  );
  const acrescido = registros.get("pedidos/acrescimo");
  assert.equal(acrescido.valorPago, 70);
  assert.equal(acrescido.recebimentosPedido.length, 2);
  assert.equal(acrescido.recebimentosPedido[1].valor, 10);
  assert.equal(acrescido.recebimentosPedido[1].itens[0].nome, "Coca 1L");
  const { resumoEntradasFinanceiro } = require("../js/financeiro-calculos.js");
  const financeiro = resumoEntradasFinanceiro(acrescido.recebimentosPedido);
  assert.equal(financeiro.recebido, 70);
  assert.equal(financeiro.categorias.Lanches, 60);
  assert.equal(financeiro.categorias.Bebidas, 10);
  assert.equal(financeiro.formas.Pix, 60);
  assert.equal(financeiro.formas.Dinheiro, 10);
  const conferido = clone(acrescido);
  acrescido.valorTotal = 80;
  await assert.rejects(
    ctx.registrarRecebimentoPedidoOperacao("acrescimo", true, conferido),
    /pedido mudou/,
  );
  ctx.confirmarOperacao = async () => false;
  put("cancelou", "Retirada");
  await ctx.confirmarRecebimentoOperacao("cancelou", true);
  assert.equal(registros.get("pedidos/cancelou").pagamentoConfirmado, undefined);
  assert.equal(registros.get("pedidos/cancelou").retirado, undefined);
  ctx.confirmarOperacao = async () => true;
  const inicial = [
    { id: "e", ...pedido("Entrega") },
    { id: "r", ...pedido("Retirada") },
  ];
  ctx.processarPedidosSiteUI(inicial, ctx.janelaOperacionalOperacao().inicio);
  assert.equal(sons, 0, "Primeira carga mostra pendentes sem tocar a lista antiga");
  assert.equal(campo("contador-pedidos-entrega").textContent, "1");
  const novos = [...inicial, { id: "l", ...pedido("Local") }];
  ctx.processarPedidosSiteUI(novos, ctx.janelaOperacionalOperacao().inicio);
  assert.equal(sons, 0, "Consumo local não dispara som");
  assert.equal(campo("contador-pedidos-local").hidden, true);
  novos.push({ id: "e2", ...pedido("Entrega") });
  ctx.processarPedidosSiteUI(novos, ctx.janelaOperacionalOperacao().inicio);
  assert.equal(sons, 1);
  ctx.processarPedidosSiteUI(novos, ctx.janelaOperacionalOperacao().inicio);
  assert.equal(sons, 1);
  novos[0].cozinhaItensVersao = ctx.assinaturaItensProducaoOperacao(novos[0].itens);
  novos[3].cozinhaItensVersao = ctx.assinaturaItensProducaoOperacao(novos[3].itens);
  novos[2].vinculadoComanda = true;
  ctx.processarPedidosSiteUI(novos, ctx.janelaOperacionalOperacao().inicio);
  assert.equal(campo("contador-pedidos-entrega").hidden, true);
  assert.equal(campo("contador-pedidos-local").hidden, true);
  console.log(
    "PASS: 20 mesas, só Local sem mesa/comanda no vínculo, conversão e vínculo atômicos, pagamentos/produção preservados, retirada com pagamento e avisos apenas para entrega/retirada.",
  );
}
testar().catch((erro) => {
  console.error(erro);
  process.exitCode = 1;
});
