const fs = require("fs"),
  vm = require("vm"),
  assert = require("node:assert/strict");
const src = fs.readFileSync("js/script.js", "utf8");
const els = {};
for (const id of [
  "box-pedidos-suporte",
  "pedido-relacionado-suporte",
  "suporte-tem-pedido",
  "categoria-chamado",
  "mensagem-novo-chamado",
])
  els[id] = { style: {}, value: "", innerHTML: "" };
const consultas = [];
const ctx = vm.createContext({
  console,
  Date,
  Number,
  Promise,
  clienteLogado: { telefone: "65999999999" },
  document: { getElementById: (id) => els[id] },
  escaparOperacao: (s) => s,
  alert: (s) => {
    ctx.aviso = s;
  },
  db: {
    collection: (c) => ({
      where: (campo, op, id) => {
        consultas.push([c, campo, id]);
        return {
          get: async () => ({
            forEach: (fn) =>
              fn({
                id: c === "pedidos" ? "delivery" : "local",
                data: () => ({ clienteId: id, dataMs: c === "pedidos" ? 1000 : 2000 }),
              }),
          }),
        };
      },
    }),
  },
});
vm.runInContext(
  src.slice(
    src.indexOf("async function togglePedidosSuporteCliente() {"),
    src.indexOf("async function atualizarStatusOnline()"),
  ),
  ctx,
);
vm.runInContext(
  src.slice(
    src.indexOf("async function criarChamadoSuporte() {"),
    src.indexOf("window.abrirChamadoCliente ="),
  ),
  ctx,
);
(async () => {
  els["suporte-tem-pedido"].value = "sim";
  await ctx.togglePedidosSuporteCliente();
  assert.equal(consultas.length, 2);
  assert.ok(consultas.every((c) => c[1] === "clienteId" && c[2] === "65999999999"));
  assert.match(els["pedido-relacionado-suporte"].innerHTML, /historicoPagamentosClientes\/local/);
  assert.match(els["pedido-relacionado-suporte"].innerHTML, /pedidos\/delivery/);
  els["categoria-chamado"].value = "reclamacao";
  els["mensagem-novo-chamado"].value = "teste";
  await ctx.criarChamadoSuporte();
  assert.match(ctx.aviso, /Escolha o pedido/);
  els["suporte-tem-pedido"].value = "nao";
  await ctx.togglePedidosSuporteCliente();
  assert.equal(els["box-pedidos-suporte"].style.display, "none");
  console.log(
    "PASS: suporte carrega delivery e consumo local apenas da conta e exige pedido quando Sim.",
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
