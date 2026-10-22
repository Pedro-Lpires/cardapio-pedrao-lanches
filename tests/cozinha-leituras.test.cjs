const fs = require("node:fs"),
  vm = require("node:vm"),
  assert = require("node:assert/strict");
let agora = Date.parse("2026-10-20T05:59:59Z");
const DataReal = Date;
class DataTeste extends DataReal {
  constructor(...args) {
    super(...(args.length ? args : [agora]));
  }
  static now() {
    return agora;
  }
}
const listeners = [],
  timers = new Map();
let timerId = 0;
const campos = Object.fromEntries(
  ["fila-cozinha", "cozinha-acesso", "quantidade-cozinha"].map((id) => [
    id,
    { textContent: "", innerHTML: "" },
  ]),
);
const eventos = {};
function observar(chave, cb) {
  const l = { chave, cb, ativo: true };
  listeners.push(l);
  return () => (l.ativo = false);
}
function consulta(c, f = "") {
  return {
    where: (k, op, v) => consulta(c, `/${k}${op}${v}`),
    onSnapshot: (cb) => observar(c + f, cb),
    doc: (id) => ({ onSnapshot: (cb) => observar(c + "/" + id, cb) }),
    get() {
      assert.fail("A cozinha não deve carregar coleções inteiras");
    },
  };
}
const ctx = vm.createContext({
  console,
  Date: DataTeste,
  URLSearchParams,
  location: { search: "" },
  db: { collection: consulta },
  sessionStorage: { getItem: () => "funcionario" },
  setTimeout: (fn, ms) => {
    timers.set(++timerId, { fn, ms });
    return timerId;
  },
  clearTimeout: (id) => timers.delete(id),
  document: {
    getElementById: (id) => campos[id],
    addEventListener() {},
    body: { classList: { toggle() {} } },
  },
  window: { addEventListener: (n, cb) => (eventos[n] ??= []).push(cb) },
});
vm.runInContext(fs.readFileSync("js/operacao.js", "utf8"), ctx);
ctx.itensHtmlOperacao = () => "itens";
const registro = (id, dados) => ({ id, exists: true, data: () => dados }),
  ativo = (chave) => listeners.findLast((l) => l.ativo && l.chave === chave),
  filaAtiva = () => listeners.findLast((l) => l.ativo && l.chave.startsWith("filaCozinha/"));
ctx.iniciarCozinhaOperacao();
ctx.iniciarCozinhaOperacao();
assert.equal(listeners.length, 2);
assert.match(filaAtiva().chave, /criadoEmMs>=/);
const fila = [
  {
    id: "a",
    status: "aguardando",
    origemColecao: "comandas",
    origemId: "c1",
    cliente: "Ana",
    mesa: 1,
    criadoEmMs: agora - 2000,
    itens: [{ nome: "Lanche", categoria: "lanches", quantidade: 1 }],
  },
  {
    id: "b",
    status: "aguardando",
    origemColecao: "pedidos",
    origemId: "p1",
    cliente: "Beto",
    tipo: "Retirada",
    criadoEmMs: agora - 1000,
    itens: [{ nome: "Lanche", categoria: "lanches", quantidade: 1 }],
  },
];
const emitir = (itens) => filaAtiva().cb({ docs: itens.map((r) => registro(r.id, r)) });
emitir([...fila, { ...fila[0], id: "velho", origemId: "ontem", criadoEmMs: agora - 86400000 }]);
assert.equal(listeners.length, 4, "Somente origens da jornada atual");
ativo("comandas/c1").cb(registro("c1", { status: "Aberta" }));
ativo("pedidos/p1").cb(registro("p1", { tipo: "Retirada" }));
assert.match(campos["quantidade-cozinha"].textContent, /^2 /);
emitir(fila);
assert.equal(listeners.length, 4, "Reutiliza origens");
ativo("comandas/c1").cb(registro("c1", { status: "Fechada", valorPago: 25 }));
assert.match(campos["quantidade-cozinha"].textContent, /^2 /, "Pagamento preserva produção");
ativo("comandas/c1").cb(registro("c1", { status: "Cancelada" }));
assert.match(campos["quantidade-cozinha"].textContent, /^1 /);
campos["concluidos-cozinha"] = { innerHTML: "" };
emitir([{ ...fila[0], status: "pronto", concluidoEm: agora }, fila[1]]);
assert.match(campos["concluidos-cozinha"].innerHTML, /Ana/);
assert.equal(
  listeners.filter((l) => l.ativo).length,
  3,
  "Config, fila e uma origem; concluídos usam os dados do dia",
);
const anterior = filaAtiva();
const virada = [...timers.values()][0];
assert.ok(virada.ms <= 1100);
agora += 2000;
virada.fn();
assert.equal(anterior.ativo, false);
assert.match(campos["quantidade-cozinha"].textContent, /^0 /);
assert.ok(!campos["concluidos-cozinha"].innerHTML.includes("Ana"));
assert.equal(listeners.filter((l) => l.ativo).length, 2);
emitir(fila);
assert.match(campos["quantidade-cozinha"].textContent, /^0 /, "Não ressuscita a jornada anterior");
const antesReset = filaAtiva();
ativo("config/producaoTela").cb(registro("producaoTela", { limpaAntes: agora }));
assert.equal(antesReset.ativo, false);
assert.equal(ctx.inicioProducaoOperacao(), agora + 1);
emitir([{ ...fila[1], id: "novo", origemId: "p2", criadoEmMs: agora + 2 }]);
ativo("pedidos/p2").cb(registro("p2", { tipo: "Entrega" }));
assert.match(campos["quantidade-cozinha"].textContent, /^1 /);
for (const cb of eventos.pagehide) cb();
assert.equal(listeners.filter((l) => l.ativo).length, 0);
assert.equal(timers.size, 0);
console.log(
  "PASS: fila do dia, origens reutilizadas, pagamento preservado, concluídos sem consulta histórica, virada às 2h, reset compartilhado e encerramento de assinaturas.",
);
