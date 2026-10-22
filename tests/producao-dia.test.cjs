const fs = require("fs"),
  vm = require("vm"),
  assert = require("node:assert/strict");
const docs = new Map(),
  clone = (x) => JSON.parse(JSON.stringify(x));
let confirmar = true,
  aviso = "";
const ref = (path) => ({ path, id: path.split("/").at(-1), get: async () => snap(path) });
const snap = (path) => ({ exists: docs.has(path), data: () => clone(docs.get(path) || {}) });
const ctx = vm.createContext({
  console,
  Date,
  URLSearchParams,
  location: { search: "" },
  document: { getElementById: () => null, addEventListener() {} },
  window: { addEventListener() {} },
  localStorage: { getItem: () => "Teste" },
  sessionStorage: { getItem: () => "Teste" },
  db: {
    collection: (c) => ({ doc: (id) => ref(c + "/" + id) }),
    runTransaction: async (fn) => {
      const writes = [];
      let escreveu = false;
      const result = await fn({
        get: async (r) => {
          assert.equal(escreveu, false);
          return snap(r.path);
        },
        set: (r, d) => {
          escreveu = true;
          writes.push([r.path, { ...docs.get(r.path), ...d }]);
        },
        update: (r, d) => {
          escreveu = true;
          writes.push([r.path, { ...docs.get(r.path), ...d }]);
        },
      });
      writes.forEach(([p, d]) => docs.set(p, clone(d)));
      return result;
    },
  },
});
vm.runInContext(fs.readFileSync("js/operacao.js", "utf8"), ctx);
ctx.confirmarOperacao = async () => confirmar;
ctx.avisoOperacao = (s) => (aviso = s);
const agora = Date.now();
docs.set("pedidos/p1", {
  status: "Pago",
  pagamentoConfirmado: true,
  valorTotal: 50,
  itens: [{ nome: "Lanche" }],
});
docs.set("filaCozinha/f1", {
  origemColecao: "pedidos",
  origemId: "p1",
  status: "aguardando",
  criadoEmMs: agora,
});
(async () => {
  const original = JSON.stringify(docs.get("pedidos/p1"));
  confirmar = false;
  await ctx.retirarDaFilaCozinhaOperacao("f1");
  assert.equal(docs.get("filaCozinha/f1").status, "aguardando");
  confirmar = true;
  await ctx.retirarDaFilaCozinhaOperacao("f1");
  assert.equal(docs.get("filaCozinha/f1").status, "retirado");
  assert.equal(JSON.stringify(docs.get("pedidos/p1")), original);
  await ctx.concluirCozinhaOperacao("f1");
  assert.equal(docs.get("filaCozinha/f1").status, "retirado");
  assert.match(aviso, /já saiu/);
  docs.set("filaCozinha/f2", {
    origemColecao: "pedidos",
    origemId: "p1",
    status: "aguardando",
    criadoEmMs: agora,
  });
  await ctx.concluirCozinhaOperacao("f2");
  assert.equal(docs.get("filaCozinha/f2").status, "pronto");
  await ctx.voltarCozinhaOperacao("f2");
  assert.equal(docs.get("filaCozinha/f2").status, "aguardando");
  await ctx.concluirCozinhaOperacao("f2");
  confirmar = false;
  await ctx.limparTelasProducaoOperacao();
  assert.equal(docs.has("config/producaoTela"), false);
  confirmar = true;
  await ctx.limparTelasProducaoOperacao();
  assert.ok(docs.get("config/producaoTela").limpaAntes >= agora);
  assert.equal(ctx.inicioProducaoOperacao(), docs.get("config/producaoTela").limpaAntes + 1);
  await ctx.voltarCozinhaOperacao("f2");
  assert.equal(docs.get("filaCozinha/f2").status, "pronto");
  assert.match(aviso, /dia atual/);
  assert.equal(JSON.stringify(docs.get("pedidos/p1")), original);
  assert.equal(docs.size, 4, "Limpeza preserva os registros e grava apenas o corte compartilhado");
  console.log(
    "PASS: retirar sem cancelar compra, cancelar confirmação, OK sem sobrescrever retirada, voltar concluído, reset global e histórico preservado.",
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
