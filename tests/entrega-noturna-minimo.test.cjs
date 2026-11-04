const assert = require("node:assert/strict");
const {
  taxaEntregaRegraUI,
  horarioNoturnoEntregaUI,
  validarMinimoEntregaUI,
} = require("../js/regras-entrega.js");
const { fixture } = require("./pedido-publico.test.cjs");
const dia = Date.parse("2026-11-04T22:59:59-04:00"),
  noite = Date.parse("2026-11-04T23:00:00-04:00");
const pedido = (km, qtd = 2) => ({
  tipo: "Entrega",
  nome: "Pessoa Teste",
  telefone: "65999999999",
  pagamento: "Pix",
  areaUrbanaConfirmada: true,
  endereco: "Rua de teste, 1",
  localizacao: `https://google.com/maps?q=${-15.553076945525193 - km / 111.19492664455873},-56.05602240360688`,
  itens: [{ produtoId: "bagunca", quantidade: qtd, tipo: "artesanal" }],
});
(async () => {
  assert.equal(horarioNoturnoEntregaUI(dia), false);
  assert.equal(horarioNoturnoEntregaUI(noite), true);
  assert.equal(horarioNoturnoEntregaUI(Date.parse("2026-11-05T01:00:00-04:00")), true);
  for (const [km, taxa] of [
    [0, 10],
    [2, 10],
    [2.01, 12],
    [3, 12],
    [3.01, 15],
    [4, 15],
  ])
    assert.equal(taxaEntregaRegraUI(km, noite), taxa);
  assert.throws(() => taxaEntregaRegraUI(4.001, noite), /Devido ao horário/);
  assert.equal(taxaEntregaRegraUI(4, dia), 8);
  validarMinimoEntregaUI(11, 25);
  validarMinimoEntregaUI(11.01, 50);
  assert.throws(() => validarMinimoEntregaUI(11.01, 49.99), /50,00/);
  const f = fixture({ agora: () => dia });
  await assert.rejects(
    f.servico.conferir({ pedido: pedido(12, 1) }),
    (e) => e.status === 400 && /50,00/.test(e.message),
  );
  assert.equal((await f.servico.conferir({ pedido: pedido(12) })).pedido.adicionalNoturno, false);
  f.registros.set("cuponsDesconto/REDUZ", { ativo: true, tipo: "pedido", modo: "fixo", valor: 1 });
  await assert.rejects(
    f.servico.conferir({ pedido: { ...pedido(12), cupomDescontoCodigo: "REDUZ" } }),
    /50,00/,
  );
  const n = fixture({ agora: () => noite });
  const q = (await n.servico.conferir({ pedido: pedido(2.5, 1) })).pedido;
  assert.equal(q.taxaEntrega, 12);
  assert.equal(q.adicionalNoturno, true);
  await assert.rejects(
    n.servico.conferir({ pedido: pedido(4.1) }),
    (e) => e.status === 400 && /horário/.test(e.message),
  );
  assert.equal([...n.registros.keys()].filter((k) => k.startsWith("pedidos/")).length, 0);
  console.log(
    "PASS: limites diurno/noturno em Cuiabá, mínimo líquido sem frete, desconto, cotação e bloqueio no servidor sem gravar pedidos.",
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
