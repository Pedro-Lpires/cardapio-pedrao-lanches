const assert = require("node:assert/strict"),
  fs = require("fs"),
  vm = require("vm");
const {
  limitesPeriodoFinanceiro,
  resumoEntradasFinanceiro,
  chaveFechamentoFinanceiro,
} = require("../js/financeiro-calculos.js");
const iso = (ms) => new Date(ms - 21600000).toISOString().slice(0, 10);
let p = limitesPeriodoFinanceiro("2026-10-12", "semana");
assert.equal(iso(p.inicio), "2026-10-11");
assert.equal(iso(p.fim), "2026-10-18");
p = limitesPeriodoFinanceiro("2026-02-15", "mes");
assert.equal(iso(p.inicio), "2026-02-01");
assert.equal(iso(p.fim), "2026-03-01");
p = limitesPeriodoFinanceiro("2024-12-31", "ano");
assert.equal(iso(p.inicio), "2024-01-01");
assert.equal(iso(p.fim), "2025-01-01");
assert.equal(
  chaveFechamentoFinanceiro("mes", "2026-10-12"),
  chaveFechamentoFinanceiro("mes", "2026-10-31"),
);
assert.equal(chaveFechamentoFinanceiro("dia", "2026-10-12"), "2026-10-12");
const r = resumoEntradasFinanceiro([
  { valor: 15, modo: "valor", descontoCupom: 5, formas: [{ forma: "Pix", valor: 15 }] },
  {
    valor: 41,
    taxaEntrega: 11,
    descontoFidelidade: 20,
    itens: [{ categoria: "lanches", subtotal: 28, totalMolhosPagos: 2 }],
    formas: [{ forma: "Dinheiro", valor: 41 }],
  },
]);
assert.equal(r.total, 45);
assert.equal(r.entrega, 11);
assert.equal(r.categorias["Pagamento por valor sem categoria"], 15);
assert.equal(r.categorias.Lanches, 28);
assert.equal(r.categorias["Molhos pagos"], 2);
assert.equal(r.cupom, 5);
assert.equal(r.fidelidade, 20);
assert.equal(
  Object.values(r.categorias).reduce((n, v) => n + v, 0),
  45,
);
console.log(
  "PASS: períodos civis, semana domingo–sábado, taxa fora do total, descontos sem duplicação, pagamento por valor sem categoria.",
);
const ctx = vm.createContext({
  console,
  Date,
  Number,
  String,
  Math,
  Map,
  Set,
  Array,
  Promise,
  Error,
  Uint8Array,
  crypto: require("node:crypto").webcrypto,
  encodeURIComponent,
  document: { addEventListener() {} },
  sessionStorage: {
    getItem() {
      return "Teste";
    },
  },
});
vm.runInContext(fs.readFileSync("js/raspadinhas.js", "utf8"), ctx);
const regra = {
  ativa: true,
  modo: "automatico",
  criadoEm: 1,
  publico: "nivel",
  nivel: "Prata",
  minimoCompra: 100,
  premio: "Batata média",
  minimoResgate: 20,
  validadeDias: 7,
  termos: "Termos",
};
assert.equal(
  ctx.elegibilidadeRaspadinha(
    regra,
    { nivelCliente: "Prata" },
    { clienteId: "65999999999", valorPago: 99, pagoEm: 2 },
  ),
  false,
);
assert.equal(
  ctx.elegibilidadeRaspadinha(
    regra,
    { nivelCliente: "Prata" },
    { clienteId: "65999999999", valorPago: 100, pagoEm: 2 },
  ),
  true,
);
assert.equal(
  ctx.elegibilidadeRaspadinha(
    { ...regra, ativa: false },
    { nivelCliente: "Prata" },
    { valorPago: 100, pagoEm: 2 },
  ),
  false,
);
assert.equal(
  ctx.comprasRaspadinha("pedidos", "p", {
    telefone: "65999999999",
    tipo: "Entrega",
    valorTotal: 110,
    taxaEntrega: 11,
    pagamentoConfirmado: true,
    pagamentoConfirmadoEm: 2,
  })[0].valorPago,
  99,
);
assert.throws(
  () => ctx.validarUsoRaspadinha({ status: "usada", expiraEm: Date.now() + 1000 }),
  /já foi usada/,
);
assert.throws(() => ctx.validarUsoRaspadinha({ status: "disponivel", expiraEm: 0 }), /venceu/);
const clone = (x) => JSON.parse(JSON.stringify(x));
const docs = new Map([
  ["campanhasRaspadinhas/c", regra],
  ["clientes/65999999999", { nome: "Rafa", nivelCliente: "Prata" }],
  [
    "pedidos/p",
    {
      tipo: "Entrega",
      clienteId: "65999999999",
      valorTotal: 111,
      taxaEntrega: 11,
      pagamentoConfirmado: true,
      pagamentoConfirmadoEm: Date.now(),
    },
  ],
]);
const ref = (path) => ({
  get: async () => ({ exists: docs.has(path), data: () => clone(docs.get(path)) }),
  path,
  id: path.split("/").at(-1),
  collection: (c) => ({ doc: (id) => ref(path + "/" + c + "/" + id) }),
});
ctx.db = {
  doc: ref,
  collection: (c) => ({ doc: (id) => ref(c + "/" + id) }),
  runTransaction: async (fn) => {
    const writes = [];
    let escreveu = false;
    const out = await fn({
      get: async (r) => {
        assert.equal(escreveu, false, "leitura depois de escrita");
        return { exists: docs.has(r.path), data: () => clone(docs.get(r.path)) };
      },
      set: (r, d) => {
        escreveu = true;
        writes.push([r.path, d]);
      },
      update: (r, d) => {
        escreveu = true;
        writes.push([r.path, { ...docs.get(r.path), ...d }]);
      },
    });
    writes.forEach(([p, d]) => docs.set(p, clone(d)));
    return out;
  },
};
(async () => {
  const code = await ctx.concederRaspadinha("c", "65999999999", "pedidos/p");
  assert.ok(code);
  const ticket = docs.get("raspadinhas/" + code);
  assert.match(ticket.codigo, /^[A-Z]{2}\d{5}$/);
  assert.equal((await ctx.localizarCodigoRaspadinha(ticket.codigo)).ref.id, code);
  await ctx.registrarRevelacaoRaspadinha(code, "65999999999");
  const reveladaEm = docs.get("raspadinhas/" + code).reveladaEm;
  await ctx.registrarRevelacaoRaspadinha(code, "65999999999");
  assert.equal(docs.get("raspadinhas/" + code).reveladaEm, reveladaEm);
  await assert.rejects(ctx.registrarRevelacaoRaspadinha(code, "outra-conta"), /nesta conta/);
  assert.equal(await ctx.concederRaspadinha("c", "65999999999", "pedidos/p"), null);
  assert.equal([...docs.keys()].filter((k) => k.startsWith("raspadinhas/")).length, 1);
  docs.set("pedidos/pequeno", {
    tipo: "Entrega",
    clienteId: "65999999999",
    valorTotal: 8,
    pagamentoConfirmado: true,
    pagamentoConfirmadoEm: Date.now() + 1000,
  });
  await assert.rejects(
    ctx.resgatarRaspadinha(code, "65999999999", "pedidos/pequeno"),
    /atingir o mínimo/,
  );
  await assert.rejects(ctx.resgatarRaspadinha(code, "65999999999", "pedidos/p"), /compra seguinte/);
  docs.set("pedidos/proximo", {
    tipo: "Entrega",
    clienteId: "65999999999",
    valorTotal: 100,
    pagamentoConfirmado: true,
    pagamentoConfirmadoEm: Date.now() + 1000,
  });
  await ctx.resgatarRaspadinha(code, "65999999999", "pedidos/proximo");
  assert.equal(docs.get("raspadinhas/" + code).status, "usada");
  await assert.rejects(ctx.resgatarRaspadinha(code, "65999999999"), /já foi usada/);
  const outro = await ctx.concederRaspadinha("c", "65999999999");
  assert.ok(outro);
  assert.notEqual(outro, code);
  await assert.rejects(
    ctx.resgatarRaspadinha(outro, "65999999999", "pedidos/proximo"),
    /já resgatou/,
  );
  const novo = await ctx.concederRaspadinha("c", "65999999999", "pedidos/proximo");
  assert.ok(novo);
  await assert.rejects(
    ctx.resgatarRaspadinha(novo, "65999999999", "pedidos/proximo"),
    /compra seguinte/,
  );
  docs.set("pedidos/terceiro", {
    tipo: "Entrega",
    clienteId: "65999999999",
    valorTotal: 20,
    pagamentoConfirmado: true,
    pagamentoConfirmadoEm: Date.now() + 2000,
  });
  await ctx.resgatarRaspadinha(novo, "65999999999", "pedidos/terceiro");
  const dia = 86400000;
  docs.set("campanhasRaspadinhas/antiga", {
    ...docs.get("campanhasRaspadinhas/c"),
    criadoEm: Date.now() - 3 * dia,
    inicioEm: Date.now() - 2 * dia,
    fimEm: Date.now() - dia,
  });
  docs.set("pedidos/pendente-antigo", {
    ...docs.get("pedidos/p"),
    pagamentoConfirmadoEm: Date.now() - 1.5 * dia,
  });
  assert.equal(
    await ctx.concederRaspadinha("antiga", "65999999999", "pedidos/pendente-antigo"),
    null,
  );
  const recuperado = await ctx.concederRaspadinha(
    "antiga",
    "65999999999",
    "pedidos/pendente-antigo",
    true,
  );
  assert.ok(recuperado, "Recupera pagamento ocorrido dentro da campanha mesmo após outro dia");
  assert.equal(
    await ctx.concederRaspadinha("antiga", "65999999999", "pedidos/pendente-antigo", true),
    null,
  );
  console.log(
    "PASS: raspadinha líquida, público, pausa, validade, concessão idempotente, mensagem vinculada, acúmulo e uso único.",
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
