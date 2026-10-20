const fs = require("fs"),
  vm = require("vm"),
  assert = require("node:assert/strict");
let agora = Date.parse("2026-10-18T20:00:00-04:00"),
  seq = 0,
  fila = Promise.resolve();
class Relogio extends Date {
  constructor(...args) {
    super(...(args.length ? args : [agora]));
  }
  static now() {
    return agora;
  }
}
const dados = new Map([["config/contadorPedidos", { ultimoNumero: 999 }]]);
for (let i = 0; i < 10; i++)
  dados.set("pedidos/ontem" + i, {
    dataMs: Date.parse("2026-10-17T20:00:00-04:00") + i,
    numero: 90 + i,
  });
dados.set("pedidos/hoje", { dataMs: agora - 1000, numero: 100 });
const snap = (p) => ({
  id: p.split("/").at(-1),
  exists: dados.has(p),
  data: () => structuredClone(dados.get(p)),
});
const ref = (p) => ({
  id: p.split("/").at(-1),
  path: p,
  get: async () => snap(p),
  update: async (d) => dados.set(p, { ...dados.get(p), ...structuredClone(d) }),
});
const db = {
  collection: (c) => ({
    doc: (id) => ref(c + "/" + id),
    get: async () => ({ docs: [...dados.keys()].filter((p) => p.startsWith(c + "/")).map(snap) }),
    add: async (d) => {
      const r = ref(c + "/novo" + ++seq);
      dados.set(r.path, structuredClone(d));
      return r;
    },
  }),
  runTransaction(fn) {
    const tarefa = fila.then(() =>
      fn({ get: (r) => r.get(), set: (r, d) => dados.set(r.path, structuredClone(d)) }),
    );
    fila = tarefa.catch(() => {});
    return tarefa;
  },
};
const ctx = vm.createContext({
  Date: Relogio,
  Intl,
  console,
  db,
  document: { addEventListener() {} },
  window: { addEventListener() {} },
});
vm.runInContext(fs.readFileSync("js/operacao.js", "utf8"), ctx);
const fonte = fs.readFileSync("js/script.js", "utf8");
vm.runInContext(
  fonte.slice(
    fonte.indexOf("async function salvarPedidoFirebase("),
    fonte.indexOf("async function carregarProdutosFirebase("),
  ),
  ctx,
);
(async () => {
  const salvos = await Promise.all(
    Array.from({ length: 3 }, () => ctx.salvarPedidoFirebase({ dataMs: agora, itens: [] })),
  );
  assert.deepEqual(salvos, [2, 3, 4]);
  assert.equal(dados.get("config/contadorPedidos").ultimoNumero, 999);
  agora = Date.parse("2026-10-19T01:59:00-04:00");
  assert.equal(await ctx.salvarPedidoFirebase({ dataMs: agora }), 5);
  agora = Date.parse("2026-10-19T02:00:00-04:00");
  assert.equal(await ctx.salvarPedidoFirebase({ dataMs: agora }), 1);
  assert.equal(dados.get("pedidos/novo5").numeroDia, 1);
  assert.equal(dados.get("pedidos/novo5").diaOperacional, "2026-10-19");
  await ctx.salvarPedidoFirebase({ dataMs: agora, tipo: "Retirada" });
  await ctx.salvarPedidoFirebase({ dataMs: agora, tipo: "Entrega" });
  await ctx.salvarPedidoFirebase({ dataMs: agora, tipo: "Local" });
  await ctx.salvarPedidoFirebase({ dataMs: agora, tipo: "Entrega" });
  assert.equal(dados.get("pedidos/novo7").numeroEntregaDia, 1);
  assert.equal(dados.get("pedidos/novo9").numeroEntregaDia, 2);
  const impresso = ctx.gerarImpressaoOperacao("motoboy", {
    numeroEntregaDia: 1,
    localizacao: "https://maps.example/local",
    itens: [],
  });
  assert(!impresso.includes("maps.example"));
  assert(impresso.includes("Entrega 1"));
  assert(!fonte.includes("PEDIDO #${numeroPedido}"));
  console.log(
    "PASS: contador diário, concorrência, histórico existente, virada às 02h, cliente sem número e impressão do motoboy sem localização.",
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
