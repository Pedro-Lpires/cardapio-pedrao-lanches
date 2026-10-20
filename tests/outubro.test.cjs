const fs = require("fs"),
  vm = require("vm"),
  assert = require("node:assert/strict");
const ctx = vm.createContext({
  console,
  Date,
  Intl,
  Number,
  String,
  Math,
  Map,
  Set,
  Array,
  JSON,
  Promise,
  Error,
  URLSearchParams,
  document: { addEventListener() {} },
  window: { addEventListener() {} },
});
vm.runInContext(fs.readFileSync("js/operacao.js", "utf8"), ctx);
vm.runInContext(fs.readFileSync("js/fluxos-interface.js", "utf8"), ctx);
const antes = ctx.janelaOperacionalOperacao(Date.parse("2026-10-14T01:59:59-04:00")),
  depois = ctx.janelaOperacionalOperacao(Date.parse("2026-10-14T02:00:00-04:00"));
assert.equal(antes.inicio, Date.parse("2026-10-13T02:00:00-04:00"));
assert.equal(antes.fim, depois.inicio);
assert.equal(depois.fim, Date.parse("2026-10-15T02:00:00-04:00"));
const agosto = ctx.semanasDoMesUI("2026-08");
assert.equal(agosto.length, 6);
assert.equal(agosto[2].dia, "2026-08-09");
assert.equal(agosto.at(-1).dia, "2026-08-30");
assert(agosto.every((s) => new Date(s.dia + "T00:00:00Z").getUTCDay() === 0));
assert.equal(ctx.semanasDoMesUI("2026-02").length, 4);
assert.equal(ctx.semanasDoMesUI("2024-02").length, 5);
console.log(
  "PASS: virada operacional às 02h de Cuiabá e semanas selecionáveis de agosto/fevereiro, incluindo ano bissexto.",
);
