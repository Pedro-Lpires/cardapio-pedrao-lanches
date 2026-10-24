const fs = require("node:fs"),
  vm = require("node:vm"),
  assert = require("node:assert/strict");
const operacao = fs.readFileSync("js/operacao.js", "utf8");
let dados = {},
  escritas = 0;
const ref = {};
const ctx = vm.createContext({
  db: {
    collection: () => ({ doc: () => ref }),
    runTransaction: async (fn) =>
      fn({
        get: async () => ({ exists: true, data: () => ({ ...dados }) }),
        update: (_, patch) => {
          dados = { ...dados, ...patch };
          escritas++;
        },
      }),
  },
  alert() {},
  buscarClienteAdmin() {},
});
vm.runInContext(
  operacao.slice(
    operacao.indexOf("function nivelFidelidadeOperacao("),
    operacao.indexOf("function serializarOperacao("),
  ),
  ctx,
);
const admin = fs.readFileSync("js/admin.js", "utf8");
vm.runInContext(
  admin.slice(
    admin.indexOf("async function alternarFidelidadeAdmin("),
    admin.indexOf("function listarPedidosAdmin("),
  ),
  ctx,
);
(async () => {
  for (const nivel of [
    undefined,
    "",
    "Sem nível",
    "Bronze",
    "Prata",
    "Ouro",
    "Diamante",
    "Lenda",
    "Imortal",
  ]) {
    dados = { fidelidadeAtiva: false, nivelCliente: nivel, codigoAtivacao: "1234" };
    await ctx.alternarFidelidadeAdmin("111", true);
    assert.equal(dados.fidelidadeAtiva, true);
    assert.equal(
      dados.nivelCliente,
      [undefined, "", "Sem nível"].includes(nivel)
        ? "Bronze"
        : nivel === "Lenda"
          ? "Imortal"
          : nivel,
    );
  }
  dados = { fidelidadeAtiva: true, nivelCliente: "Sem nível" };
  await ctx.garantirNivelFidelidadeOperacao("111");
  assert.equal(dados.nivelCliente, "Bronze");
  const total = escritas;
  await ctx.garantirNivelFidelidadeOperacao("111");
  assert.equal(escritas, total);
  dados = { fidelidadeAtiva: true, nivelCliente: "Ouro" };
  await ctx.garantirNivelFidelidadeOperacao("111");
  assert.equal(dados.nivelCliente, "Ouro");
  await ctx.alternarFidelidadeAdmin("111", false);
  assert.equal(dados.fidelidadeAtiva, false);
  assert.equal(dados.codigoAtivacao, "");
  console.log(
    "PASS: ativação ADM inicia em Bronze, preserva todos os níveis superiores e corrige legado sem sobrescrever progressão.",
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
