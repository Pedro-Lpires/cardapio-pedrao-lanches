const fs = require("node:fs"),
  vm = require("node:vm"),
  assert = require("node:assert/strict");
const consultas = [];
const eventos = {};
const janela = {
  inicio: Date.parse("2026-10-20T02:00:00-04:00"),
  fim: Date.parse("2026-10-21T02:00:00-04:00"),
};
const banco = {
  collection(colecao) {
    return {
      where(campo, op, valor) {
        assert.equal(op, ">=");
        return {
          onSnapshot(cb) {
            const consulta = { colecao, campo, valor, cb, parada: false };
            consultas.push(consulta);
            return () => (consulta.parada = true);
          },
        };
      },
      get() {
        assert.fail("Consulta geral não permitida");
      },
    };
  },
};
const ctx = vm.createContext({
  console,
  Date,
  db: banco,
  periodoAtualAdmin: "hoje",
  vendasFirebase: [],
  janelaOperacionalOperacao: () => janela,
  aplicarNumerosDiariosOperacao() {},
  listarPedidosAdmin() {},
  setTimeout: () => 1,
  clearTimeout() {},
  document: { addEventListener() {}, getElementById: () => null },
  window: { addEventListener: (nome, fn) => (eventos[nome] = fn) },
});
const admin = fs.readFileSync("js/admin.js", "utf8");
vm.runInContext(
  admin.slice(admin.indexOf("let pararPedidosAdmin"), admin.indexOf("let produtoEditandoId")),
  ctx,
);
ctx.consultarPedidosPeriodoAdmin("hoje");
assert.equal(consultas.length, 1);
assert.equal(consultas[0].campo, "dataMs");
assert.equal(consultas[0].valor, janela.inicio);
ctx.consultarPedidosPeriodoAdmin("hoje");
assert.equal(consultas.length, 1);
ctx.consultarPedidosPeriodoAdmin("mes");
assert.equal(consultas[0].parada, true);
eventos.pagehide();
assert(consultas.every((c) => c.parada));

consultas.length = 0;
vm.runInContext(fs.readFileSync("js/raspadinhas-recuperacao.js", "utf8"), ctx);
vm.runInContext(fs.readFileSync("js/raspadinhas.js", "utf8"), ctx);
let conferencias = 0;
ctx.verificarRaspadinhasCompra = async () => conferencias++;
ctx.iniciarPagamentosRaspadinha();
assert.equal(consultas.length, 3);
assert.deepEqual(
  consultas.map((c) => c.campo),
  ["pagamentoConfirmadoEm", "fechadoEm", "criadoEmMs"],
);
assert(consultas.every((c) => c.valor === janela.inicio));
(async () => {
  const compra = {
    clienteId: "123",
    pagamentoConfirmado: true,
    valorPago: 50,
    pagamentoConfirmadoEm: janela.inicio + 100,
  };
  await Promise.all([
    ctx.conferirPagamentoRecenteRaspadinha("pedidos", "p1", compra),
    ctx.conferirPagamentoRecenteRaspadinha("pedidos", "p1", compra),
  ]);
  assert.equal(conferencias, 1, "Eventos iguais só conferem uma vez");
  await ctx.conferirPagamentoRecenteRaspadinha("pedidos", "p1", { ...compra, valorPago: 70 });
  assert.equal(conferencias, 2, "Mudança real no pagamento confere novamente");
  await ctx.conferirPagamentoRecenteRaspadinha("pedidos", "p2", { clienteId: "123" });
  assert.equal(conferencias, 2, "Sem pagamento não consulta campanhas/clientes");
  ctx.iniciarPagamentosRaspadinha();
  assert(consultas.slice(0, 3).every((c) => c.parada));
  ctx.pararPagamentosRaspadinha();
  assert(consultas.every((c) => c.parada));
  console.log(
    "PASS: ADM por período sem assinaturas duplicadas; raspadinhas só pagamentos recentes, deduplicação e encerramento.",
  );
})().catch((erro) => {
  console.error(erro);
  process.exitCode = 1;
});
