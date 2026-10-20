const fs = require("fs"),
  vm = require("vm"),
  assert = require("node:assert/strict");
const els = {};
const el = (id) =>
  (els[id] ||= {
    value: "",
    textContent: "",
    innerHTML: "",
    hidden: false,
    disabled: false,
    scrollIntoView() {},
  });
const docs = new Map([
  [
    "clientes/65999999999",
    { nome: "Rafa", nivelCliente: "Prata", fidelidadeAtiva: true, codigoAtivacao: "RAFA" },
  ],
  ["clientes/65888888888", { nome: "Bia", nivelCliente: "Diamante", fidelidadeAtiva: true }],
  [
    "cuponsDesconto/COCA",
    { codigo: "COCA", nome: "Coca 2L", ativo: true, tipo: "item", pedidoMinimo: 200 },
  ],
]);
let seq = 0,
  commits = 0,
  failCommit = 0;
const clone = (x) => JSON.parse(JSON.stringify(x));
function ref(path) {
  return {
    id: path.split("/").at(-1),
    path,
    collection: (c) => query(path + "/" + c),
    get: async () => ({
      id: path.split("/").at(-1),
      exists: docs.has(path),
      data: () => clone(docs.get(path)),
    }),
    set: async (d) => docs.set(path, clone(d)),
    update: async (d) => {
      assert.ok(docs.has(path));
      docs.set(path, { ...docs.get(path), ...clone(d) });
    },
  };
}
function query(path, filters = [], lim = Infinity, after = null, ordered = false) {
  return {
    doc: (id) => ref(path + "/" + (id || "c" + ++seq)),
    where: (k, op, v) => query(path, [...filters, [k, v]], lim, after, ordered),
    orderBy: () => query(path, filters, lim, after, true),
    limit: (n) => query(path, filters, n, after, ordered),
    startAfter: (d) => query(path, filters, lim, d.id, ordered),
    get: async () => {
      let entries = [...docs].filter(
        ([p, d]) =>
          p.startsWith(path + "/") &&
          !p.slice(path.length + 1).includes("/") &&
          filters.every(([k, v]) => d[k] === v),
      );
      if (ordered) entries.sort((a, b) => (b[1].criadoEm || 0) - (a[1].criadoEm || 0));
      if (after)
        entries = entries.slice(entries.findIndex(([p]) => p.split("/").at(-1) === after) + 1);
      const arr = entries
        .slice(0, lim)
        .map(([p, d]) => ({ id: p.split("/").at(-1), data: () => clone(d) }));
      return { docs: arr, size: arr.length };
    },
  };
}
const db = {
  collection: query,
  batch: () => {
    const writes = [];
    return {
      set: (r, d) => writes.push(() => r.set(d)),
      update: (r, d) => writes.push(() => r.update(d)),
      commit: async () => {
        commits++;
        if (commits === failCommit) throw Error("offline");
        for (const w of writes) await w();
      },
    };
  },
};
const ctx = vm.createContext({
  console,
  Date,
  Number,
  String,
  JSON,
  Promise,
  Set,
  Map,
  db,
  adminAvancadoLiberado: true,
  window: {},
  document: { getElementById: el, addEventListener() {} },
  escaparOperacao: (s) => String(s ?? "").replaceAll("<", "&lt;"),
  moedaOperacao: (x) => String(x),
});
vm.runInContext(fs.readFileSync("js/campanhas.js", "utf8"), ctx);
function form(canal, publico, finalidade = "aviso") {
  for (const [k, v] of Object.entries({
    "campanha-canal": canal,
    "campanha-publico": publico,
    "campanha-rank": "Diamante",
    "campanha-cliente": "RAFA",
    "campanha-finalidade": finalidade,
    "campanha-codigo": "COCA",
    "campanha-texto": "Mensagem especial",
    "campanha-filtro-canal": "todos",
    "campanha-filtro-finalidade": "todos",
  }))
    el(k).value = v;
}
(async () => {
  form("admin", "cliente");
  await ctx.prepararCampanhaAdmin();
  assert.deepEqual([...ctx.window.previaCampanhaPedrao.clientes], ["65999999999"]);
  await ctx.publicarCampanhaAdmin();
  assert.equal(docs.get("clientes/65999999999/mensagens/c1").tipo, "admin");
  form("geral", "todos");
  await ctx.prepararCampanhaAdmin();
  await ctx.publicarCampanhaAdmin();
  assert.equal(docs.get("clientes/65888888888/mensagens/c2").tipo, "geral");
  form("admin", "rank", "cupom");
  const cupomAntes = JSON.stringify(docs.get("cuponsDesconto/COCA"));
  await ctx.prepararCampanhaAdmin();
  assert.deepEqual([...ctx.window.previaCampanhaPedrao.clientes], ["65888888888"]);
  await ctx.publicarCampanhaAdmin();
  assert.equal(docs.get("clientes/65888888888/mensagens/c3").cupomCodigo, "COCA");
  assert.equal(JSON.stringify(docs.get("cuponsDesconto/COCA")), cupomAntes);
  form("admin", "todos");
  await ctx.prepararCampanhaAdmin();
  assert.equal(ctx.window.previaCampanhaPedrao, null);
  form("geral", "rank", "cupom");
  el("campanha-codigo").value = "INVALIDO";
  await ctx.prepararCampanhaAdmin();
  assert.equal(ctx.window.previaCampanhaPedrao, null);
  assert.match(el("campanha-previa").textContent, /não existe/);
  await ctx.carregarHistoricoCampanhas(true);
  assert.match(el("campanha-historico-lista").innerHTML, /Geral/);
  assert.match(el("campanha-historico-lista").innerHTML, /ADM/);
  el("campanha-filtro-canal").value = "geral";
  ctx.renderizarHistoricoCampanhas();
  assert.ok(!el("campanha-historico-lista").innerHTML.includes("ADM ·"));
  // Failure after one atomic batch: resume the same campaign without repeating recipients.
  const clientes = Array.from({ length: 401 }, (_, i) => "conta" + i);
  ctx.window.previaCampanhaPedrao = {
    canal: "geral",
    finalidade: "aviso",
    texto: "Teste em lote",
    clientes,
    enviados: 0,
  };
  failCommit = commits + 2;
  await ctx.publicarCampanhaAdmin();
  const id = ctx.window.previaCampanhaPedrao.id;
  assert.equal(docs.get("campanhas/" + id).enviados, 400);
  assert.equal(docs.get("campanhas/" + id).status, "publicando");
  await ctx.retomarCampanhaAdmin(id);
  await ctx.publicarCampanhaAdmin();
  assert.equal(docs.get("campanhas/" + id).status, "publicada");
  assert.equal([...docs.keys()].filter((p) => p.endsWith("/mensagens/" + id)).length, 401);
  console.log(
    "PASS: campanhas ADM/Geral, pessoa/CDA/nível/todos, cupom existente intacto, validação, histórico e retomada após falha sem duplicação.",
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
