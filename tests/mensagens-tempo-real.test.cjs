const fs = require("node:fs"),
  vm = require("node:vm"),
  assert = require("node:assert/strict");
const ouvintes = new Map();
let abertos = 0,
  fechados = 0,
  recargas = 0;
const campos = Object.fromEntries(
  ["badge-geral", "badge-admin", "badge-suporte"].map((id) => [id, { innerText: "" }]),
);
campos["modal-mensagens"] = { style: { display: "none" } };
const botao = { innerHTML: "" };
function colecao(path) {
  return {
    doc: (id) => ({ collection: (c) => colecao(path + "/" + id + "/" + c) }),
    where() {
      return this;
    },
    onSnapshot: (fn) => {
      abertos++;
      ouvintes.set(path, fn);
      return () => fechados++;
    },
  };
}
const ctx = vm.createContext({
  console,
  clienteLogado: { telefone: "111" },
  abaMensagemAtual: "admin",
  document: { getElementById: (id) => campos[id], querySelector: () => botao },
  db: { collection: colecao },
  abrirAbaMensagens: async () => recargas++,
  buscarContadorMensagensUI: async () => {},
});
vm.runInContext(fs.readFileSync("js/mensagens-tempo-real-ui.js", "utf8"), ctx);
function emitir(path, itens) {
  ouvintes.get(path)({
    size: itens.length,
    docs: itens.map(([id, dados]) => ({
      id,
      data: () => dados,
      ref: { collection: (c) => colecao(path + "/" + id + "/" + c) },
    })),
  });
}
ctx.acompanharContadorClienteUI();
ctx.acompanharContadorClienteUI();
assert.equal(abertos, 2);
emitir("clientes/111/mensagens", []);
emitir("clientes/111/chamados", []);
emitir("clientes/111/mensagens", [["m1", { tipo: "admin" }]]);
assert.match(botao.innerHTML, /badge-msg">1/);
campos["modal-mensagens"].style.display = "flex";
emitir("clientes/111/mensagens", [
  ["m1", { tipo: "admin" }],
  ["m2", { tipo: "geral" }],
]);
assert.equal(recargas, 1);
emitir("clientes/111/mensagens", []);
assert.equal(recargas, 1, "Marcar como lida não entra em ciclo de recarregar");
emitir("clientes/111/chamados", [["s1", {}]]);
emitir("clientes/111/chamados/s1/mensagens", [["r1", {}]]);
assert.equal(campos["badge-suporte"].innerText, 1);
emitir("clientes/111/chamados", [["s1", {}]]);
assert.equal(abertos, 3);
emitir("clientes/111/chamados", []);
assert.equal(campos["badge-suporte"].innerText, "");
assert.equal(fechados, 1);
ctx.encerrarContadorClienteUI();
const antes = botao.innerHTML;
emitir("clientes/111/mensagens", [["atrasada", { tipo: "admin" }]]);
assert.equal(botao.innerHTML, antes);
ctx.clienteLogado = { telefone: "222" };
ctx.acompanharContadorClienteUI();
emitir("clientes/111/mensagens", [["antiga", { tipo: "geral" }]]);
assert.equal(botao.innerHTML, antes);
emitir("clientes/222/mensagens", [["nova", { tipo: "admin" }]]);
assert.equal(campos["badge-admin"].innerText, 1);
console.log(
  "PASS: contador ao receber/ler, atualização da lista aberta, suporte sem assinaturas repetidas e callbacks antigos ignorados.",
);
