const fs = require("fs"),
  vm = require("vm"),
  assert = require("node:assert/strict");
const docs = new Map(),
  versions = new Map();
const clone = (d) => (d === undefined ? undefined : JSON.parse(JSON.stringify(d)));
const ref = (path) => ({
  path,
  id: path.split("/").at(-1),
  collection: (c) => ({ doc: (id) => ref(path + "/" + c + "/" + id) }),
  get: async () => snap(path),
});
const snap = (p) => ({ exists: docs.has(p), data: () => clone(docs.get(p)) });
const put = (p, d) => {
  docs.set(p, clone(d));
  versions.set(p, (versions.get(p) || 0) + 1);
};
const db = {
  collection: (c) => ({ doc: (id) => ref(c + "/" + id) }),
  runTransaction: async (fn) => {
    for (let n = 0; n < 10; n++) {
      const reads = new Map(),
        writes = [];
      let wrote = false;
      const out = await fn({
        get: async (r) => {
          assert.equal(wrote, false, "todas as leituras devem anteceder as escritas");
          reads.set(r.path, versions.get(r.path) || 0);
          const d = snap(r.path);
          return { exists: d.exists, data: () => d.data() };
        },
        set: (r, d) => {
          wrote = true;
          writes.push([r.path, d]);
        },
        update: (r, d) => {
          wrote = true;
          assert.ok(docs.has(r.path));
          writes.push([r.path, { ...docs.get(r.path), ...clone(d) }]);
        },
      });
      if ([...reads].some(([p, v]) => (versions.get(p) || 0) !== v)) continue;
      writes.forEach(([p, d]) => put(p, d));
      return out;
    }
    throw Error("conflito");
  },
};
const ctx = vm.createContext({
  console,
  Date,
  Number,
  String,
  JSON,
  Math,
  Map,
  Set,
  db,
  document: { addEventListener() {} },
  window: { addEventListener() {} },
  localStorage: { getItem: () => "" },
  sessionStorage: { getItem: () => "" },
  location: { search: "" },
});
vm.runInContext(fs.readFileSync("js/operacao.js", "utf8"), ctx);
const cupom = (codigo) => put("cuponsDesconto/" + codigo, { ativo: true, uso: "unico" });
(async () => {
  cupom("UNICO");
  const pedido = (codigo, id) => ({ clienteId: id, cupomDescontoCodigo: codigo, valorTotal: 10 });
  const resultados = await Promise.allSettled([
    ctx.salvarPedidoComCupomOperacao(ref("pedidos/a"), pedido("UNICO", "ana")),
    ctx.salvarPedidoComCupomOperacao(ref("pedidos/b"), pedido("UNICO", "bia")),
  ]);
  assert.equal(resultados.filter((x) => x.status === "fulfilled").length, 1);
  assert.equal(docs.get("cuponsDesconto/UNICO").ativo, false);
  assert.ok(docs.get("cuponsDesconto/UNICO").usadoEm);
  assert.equal([...docs.keys()].filter((k) => k.startsWith("pedidos/")).length, 1);
  assert.throws(
    () => ctx.verificarDisponibilidadeCupomOperacao(docs.get("cuponsDesconto/UNICO")),
    /já foi utilizado/,
  );
  const vencedor = docs.has("pedidos/a") ? "a" : "b";
  await ctx.salvarPedidoComCupomOperacao(ref("pedidos/" + vencedor), pedido("UNICO", "ana"));
  put("cuponsDesconto/DIVERSO", { ativo: true });
  await ctx.salvarPedidoComCupomOperacao(ref("pedidos/c"), pedido("DIVERSO", "ana"));
  await ctx.salvarPedidoComCupomOperacao(ref("pedidos/d"), pedido("DIVERSO", "bia"));
  assert.equal(docs.get("cuponsDesconto/DIVERSO").ativo, true);
  cupom("LOCAL");
  put("comandas/c1", { status: "Aberta" });
  const lote = ctx.lotePagamentoCupomOperacao("LOCAL", "ana", ref("comandas/c1"));
  lote.update(ref("comandas/c1"), { status: "Fechada" });
  await lote.commit();
  assert.equal(docs.get("cuponsDesconto/LOCAL").ativo, false);
  await assert.rejects(
    ctx.salvarPedidoComCupomOperacao(ref("pedidos/e"), pedido("LOCAL", "bia")),
    /já foi utilizado/,
  );
  assert.equal(docs.has("pedidos/e"), false);
  cupom("PARCIAL");
  const comanda = { status: "Aberta", valorTotal: 20, itens: [], pagamentos: [] };
  put("comandas/c2", comanda);
  const pag = {
    id: "parte1",
    clienteId: null,
    cupomId: "PARCIAL",
    valorOriginal: 20,
    valorPago: 15,
    valorQuitado: 20,
    modo: "valor",
    descontoCupom: 5,
    descontoFidelidade: 0,
  };
  await ctx.salvarPagamentoSeparadoAtomico(
    ref("comandas/c2"),
    comanda,
    pag,
    { pagamentos: [pag] },
    [],
  );
  assert.equal(docs.get("cuponsDesconto/PARCIAL").ativo, false);
  await ctx.salvarPagamentoSeparadoAtomico(
    ref("comandas/c2"),
    comanda,
    pag,
    { pagamentos: [pag] },
    [],
  );
  await assert.rejects(
    ctx.salvarPedidoComCupomOperacao(ref("pedidos/f"), pedido("PARCIAL", "bia")),
    /já foi utilizado/,
  );
  cupom("FALHA");
  await assert.rejects(
    db.runTransaction(async (t) => {
      const salvar = await ctx.prepararUsoCupomAtomicoOperacao(t, "FALHA", "ana", "teste");
      salvar();
      throw Error("falha ao gravar pedido");
    }),
    /falha/,
  );
  assert.equal(docs.get("cuponsDesconto/FALHA").ativo, true);

  // Criação pelo mesmo formulário administrativo: todos os tipos aceitam uso único.
  const campos = {};
  ctx.document.getElementById = (id) =>
    (campos[id] ||= { value: "", checked: false, disabled: false, textContent: "" });
  ctx.alert = (texto) => {
    throw Error(texto);
  };
  ctx.finalizarSalvarCupomUI = async () => {};
  ctx.cupomEmEdicaoUI = null;
  const admin = fs.readFileSync("js/admin.js", "utf8");
  vm.runInContext(
    admin.slice(
      admin.indexOf("async function criarCupomDesconto()"),
      admin.indexOf("async function listarCuponsDesconto()"),
    ),
    ctx,
  );
  function campo(id, valor) {
    ctx.document.getElementById("cupom-" + id).value = valor;
  }
  for (const tipo of ["pedido", "item", "taxa"]) {
    campo("nome", "Teste");
    campo("codigo", "NOVO_" + tipo.toUpperCase());
    campo("tipo", tipo);
    campo("uso", "unico");
    campo("modo", tipo === "taxa" ? "gratis" : "valor");
    campo("valor", "5");
    campo("km-gratis", "3");
    campo("item-nome", "Coca lata");
    campo("item-preco-promocional", "0");
    await ctx.criarCupomDesconto();
    assert.equal(docs.get("cuponsDesconto/NOVO_" + tipo.toUpperCase()).uso, "unico");
  }
  await ctx.criarCupomDesconto();
  assert.match(ctx.document.getElementById("cupom-salvar-status").textContent, /Já existe/);
  console.log(
    "PASS: cupom 1x global, concorrência entre contas, retry idempotente, diversos, comanda integral/separada e rollback sem consumir.",
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
