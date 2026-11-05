const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  vm = require("node:vm");
let liberar,
  sucesso,
  falha,
  abertos = 0,
  encerrados = 0;
const timers = new Map();
let seq = 0;
const status = {
  hidden: true,
  children: [],
  replaceChildren() {
    this.children = [];
  },
  append(...n) {
    this.children.push(...n);
  },
  querySelector() {
    return this.children[0];
  },
};
const ctx = vm.createContext({
  console: { error() {} },
  inicializacaoEquipeProtegidaUI: new Promise((r) => (liberar = r)),
  equipeProtegidaAtivaUI: () => true,
  perfilEquipeProtegidaUI: { perfil: "atendimento" },
  document: {
    querySelector: () => ({}),
    getElementById: (id) => (id === "pedidos-site-status" ? status : null),
    createElement: () => ({}),
    addEventListener() {},
  },
  window: { addEventListener() {} },
  setTimeout: (f) => {
    timers.set(++seq, f);
    return seq;
  },
  clearTimeout: (id) => timers.delete(id),
  janelaOperacionalOperacao: () => ({ inicio: 1, fim: Date.now() + 60000 }),
  db: {
    collection() {
      return this;
    },
    where() {
      return this;
    },
    onSnapshot(ok, erro) {
      abertos++;
      sucesso = ok;
      falha = erro;
      return () => encerrados++;
    },
  },
});
vm.runInContext(fs.readFileSync("js/pedidos-site-atendente.js", "utf8"), ctx);
(async () => {
  const abrir = ctx.iniciarPedidosSiteUI();
  assert.equal(abertos, 0, "Nenhuma leitura privada antes da restauração do Auth");
  liberar();
  await abrir;
  assert.equal(abertos, 1);
  falha(Error("permission-denied"));
  assert.equal(status.hidden, false);
  assert.match(status.children[1].textContent, /Tentar novamente/);
  await status.children[1].onclick();
  await Promise.resolve();
  assert.equal(abertos, 2);
  assert.equal(encerrados, 1);
  sucesso({ docs: [] });
  assert.equal(status.hidden, true);
  ctx.encerrarPedidosSiteUI();
  assert.equal(timers.size, 0, "Ao sair, cancela reconexão e virada do período");
  console.log(
    "PASS: pedidos aguardam Auth, reconectam sem recarregar e encerram listeners/timers ao sair.",
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
