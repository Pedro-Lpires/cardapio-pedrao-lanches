const assert = require("node:assert/strict");
const { nivelRankMensalUI, ajusteRankAdminUI } = require("../js/rank-mensal.js");
const agora = Date.parse("2026-11-04T20:00:00-04:00");
const c = { fidelidadeAtiva: true, rankMensal: { importadoEm: 1, meses: { "2026-11": 40000 } } };
assert.equal(nivelRankMensalUI(c, agora), "Prata");
const rankManual = ajusteRankAdminUI("Diamante", agora);
assert.equal(nivelRankMensalUI({ ...c, rankManual }, agora), "Diamante");
assert.equal(
  nivelRankMensalUI({ ...c, rankManual }, Date.parse("2026-12-01T00:00:00-04:00")),
  "Prata",
);
assert.equal(nivelRankMensalUI({ ...c, rankManual, fidelidadeAtiva: false }, agora), "Sem nível");
assert.equal(ajusteRankAdminUI("automatico", agora), null);
assert.throws(() => ajusteRankAdminUI("inventado", agora), /rank válido/);
console.log(
  "PASS: rank manual vale no mês corrente, volta ao automático na virada e não ativa fidelidade por conta própria.",
);
