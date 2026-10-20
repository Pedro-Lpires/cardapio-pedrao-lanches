const fs = require("node:fs"),
  vm = require("node:vm"),
  assert = require("node:assert/strict");
// Simula eventos do Firestore sem acessar o projeto real.
const listeners = [];
const detalhes = { open: false };
const campos = Object.fromEntries(
  ["fila-cozinha", "cozinha-acesso", "quantidade-cozinha", "concluidos-cozinha"].map((id) => [
    id,
    { textContent: "", innerHTML: "", closest: () => detalhes },
  ]),
);
const eventos = {};
function observar(chave, cb) {
  const listener = { chave, cb, ativo: true };
  listeners.push(listener);
  return () => {
    listener.ativo = false;
  };
}
function consulta(colecao, filtro = "") {
  return {
    where(campo, op, valor) {
      return consulta(colecao, `/${campo}${op}${valor}`);
    },
    orderBy(campo, ordem) {
      return consulta(colecao, `/${campo}:${ordem}`);
    },
    limit(n) {
      return consulta(colecao, filtro + `/limit:${n}`);
    },
    onSnapshot(cb) {
      return observar(colecao + filtro, cb);
    },
    doc(id) {
      return { onSnapshot: (cb) => observar(colecao + "/" + id, cb) };
    },
    get() {
      assert.fail("A cozinha não deve carregar coleções inteiras");
    },
  };
}
const ctx = vm.createContext({
  console,
  URLSearchParams,
  location: { search: "" },
  db: { collection: consulta },
  sessionStorage: { getItem: () => "funcionario" },
  document: {
    getElementById: (id) => campos[id],
    addEventListener() {},
    body: { classList: { toggle() {} } },
  },
  window: {
    addEventListener: (nome, cb) => {
      (eventos[nome] ??= []).push(cb);
    },
  },
});
vm.runInContext(fs.readFileSync("js/operacao.js", "utf8"), ctx);
ctx.itensHtmlOperacao = () => "itens";
const registro = (id, dados) => ({ id, exists: true, data: () => dados });
const ativo = (chave) => listeners.findLast((l) => l.ativo && l.chave === chave);
ctx.iniciarCozinhaOperacao();
ctx.iniciarCozinhaOperacao();
assert.equal(listeners.length, 1, "Não duplica a assinatura ao iniciar novamente");
assert.equal(listeners[0].chave, "filaCozinha/status==aguardando");
const fila = [
  {
    id: "a",
    origemColecao: "comandas",
    origemId: "c1",
    cliente: "Ana",
    mesa: 1,
    criadoEmMs: 1,
    itens: [],
  },
  {
    id: "b",
    origemColecao: "pedidos",
    origemId: "p1",
    cliente: "Beto",
    tipo: "Retirada",
    criadoEmMs: 2,
    itens: [],
  },
];
const emitirFila = (itens) =>
  ativo("filaCozinha/status==aguardando").cb({ docs: itens.map((r) => registro(r.id, r)) });
emitirFila(fila);
assert.equal(listeners.length, 3, "Só acompanha as duas origens ativas");
ativo("comandas/c1").cb(registro("c1", { status: "Aberta" }));
ativo("pedidos/p1").cb(registro("p1", { tipo: "Retirada" }));
assert.match(campos["quantidade-cozinha"].textContent, /^2 /);
emitirFila(fila.map((r) => ({ ...r, atualizadoEm: 10 })));
assert.equal(listeners.length, 3, "Editar fila reutiliza assinaturas, sem reler origens");
ativo("comandas/c1").cb(registro("c1", { status: "Fechada", valorPago: 25 }));
assert.match(campos["quantidade-cozinha"].textContent, /^2 /, "Pagar não retira da produção");
ativo("comandas/c1").cb(registro("c1", { status: "Cancelada" }));
assert.match(campos["quantidade-cozinha"].textContent, /^1 /);
ativo("comandas/c1").cb({ exists: false });
assert.match(campos["quantidade-cozinha"].textContent, /^1 /, "Excluir não deixa pedido fantasma");
ativo("pedidos/p1").cb(registro("p1", { cancelado: true }));
assert.match(campos["quantidade-cozinha"].textContent, /^0 /);
emitirFila([]);
assert.equal(listeners.filter((l) => l.ativo).length, 1);
assert(
  !listeners.some((l) => l.chave.includes("concluidoEm")),
  "Concluídos fechados não leem histórico",
);
detalhes.open = true;
detalhes.ontoggle();
const consultaConcluidos = ativo("filaCozinha/concluidoEm:desc/limit:10");
assert(consultaConcluidos);
consultaConcluidos.cb({
  docs: [registro("feito", { status: "pronto", mesa: 2, cliente: "Carlos" })],
});
assert.match(campos["concluidos-cozinha"].innerHTML, /Carlos/);
detalhes.open = false;
detalhes.ontoggle();
assert.equal(consultaConcluidos.ativo, false);
ctx.pararCozinhaOperacao();
assert.equal(listeners.filter((l) => l.ativo).length, 0);
ctx.iniciarCozinhaOperacao();
assert.equal(listeners.filter((l) => l.ativo).length, 1);
console.log(
  "PASS: cozinha sem consultas gerais, fila ativa, origens reutilizadas, pagamento preservado, cancelamento/exclusão e concluídos sob demanda.",
);
