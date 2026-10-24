const assert = require("node:assert/strict");
const { context: ctx, mockDb } = require("./operacao.test.cjs");
ctx.document.getElementById = () => null;
ctx.confirmarOperacao = async () => true;
ctx.avisoOperacao = (texto) => assert.fail(texto);
const lanche = { nome: "Baguncinha", categoria: "lanches", tipo: "artesanal", quantidade: 1 };
const combo = (qtd, lanchesCombo = [], tipo = "Artesanal") => ({
  nome: `Combo ${qtd} Caseiro`,
  categoria: "combos",
  quantidade: 1,
  comboComponentes: [
    { nome: "Baguncinha", quantidade: qtd, categoria: "lanches", tipoCarne: tipo },
    { nome: "Refrigerante 1,5L", categoria: "bebidas", quantidade: 1 },
  ],
  lanchesCombo,
  modoPersonalizacaoCombo: "individual",
});
const itens = [
  { ...lanche, quantidade: 3 },
  combo(2),
  combo(3, [
    { numero: 1, adicionais: [{ nome: "Bacon", qtd: 2 }] },
    { numero: 2, adicionais: [{ nome: "Tomate", qtd: 1 }] },
  ]),
  { ...lanche, observacao: "Sem salada" },
  { ...lanche, adicionais: [{ nome: "Hambúrguer caseiro", qtd: 1 }], observacao: "Sem salsicha" },
  combo(4, [], "Industrial"),
  {
    nome: "Batata Média",
    categoria: "batatas",
    quantidade: 1,
    adicionais: [{ nome: "Cheddar", qtd: 1 }],
  },
];
const antes = JSON.stringify(itens);
const grupos = ctx.agruparPreparoChapeiroOperacao(itens);
const artesanal = grupos.find((g) => g.tipo === "artesanal");
assert.equal(grupos.length, 3);
assert.equal(artesanal.quantidade, 10);
assert.equal(artesanal.padrao, 6);
assert.deepEqual(
  Array.from(artesanal.personalizacoes, (p) => p.quantidade),
  [1, 1, 1, 1],
);
const html = ctx.itensHtmlChapeiroOperacao(itens);
assert.match(html, /10 Baguncinha/);
assert.doesNotMatch(html, /padrão|preparo-padrao/);
assert.match(html, /4 Baguncinha/);
assert.match(html, /1 porção com:/);
assert.doesNotMatch(html, /Refrigerante|Combo \d|Lanche 2/);
assert.equal(JSON.stringify(itens), antes);
const quatroLanches = ctx.itensHtmlChapeiroOperacao([
  lanche,
  { ...lanche, quantidade: 3, adicionais: [{ nome: "Filé Mignon", qtd: 1 }] },
]);
assert.match(quatroLanches, /4 Baguncinha/);
assert.match(quatroLanches, /3 lanches com:/);
assert.match(quatroLanches, /\+ 1 Filé Mignon/);
assert.doesNotMatch(quatroLanches, /padrão|preparo-padrao/);
assert.doesNotMatch(
  ctx.itensHtmlChapeiroOperacao([{ ...lanche, quantidade: 4 }]),
  /padrão|lanches com:/,
);
const iguais = ctx.agruparPreparoChapeiroOperacao([
  {
    ...combo(3, [{ adicionais: [{ nome: "Bacon", qtd: 1 }] }]),
    modoPersonalizacaoCombo: "todos",
    quantidade: 2,
  },
  { ...lanche, adicionais: [{ nome: "bacon", qtd: 1 }] },
])[0];
assert.equal(iguais.quantidade, 7);
assert.equal(iguais.personalizacoes.length, 1);
assert.equal(iguais.personalizacoes[0].quantidade, 7);
assert.equal(
  ctx.agruparPreparoChapeiroOperacao([{ ...combo(2), observacao: "Sem salada" }])[0]
    .personalizacoes[0].quantidade,
  2,
);

(async () => {
  const db = mockDb({ "comandas/grande": { status: "Aberta", mesa: 2, itens } });
  ctx.db = db;
  const enviar = () => ctx.confirmarProducaoOperacao("comandas", "grande");
  const filas = (status = "aguardando") =>
    [...db.docs.entries()].filter(
      ([id, d]) => id.startsWith("filaCozinha/") && d.status === status,
    );
  await enviar();
  assert.equal(filas().length, 1);
  const primeiro = JSON.stringify(filas()[0][1].itens);
  await db
    .collection("comandas")
    .doc("grande")
    .update({ itens: [...itens, { ...lanche, quantidade: 6 }] });
  await enviar();
  assert.equal(
    filas().length,
    2,
    "Seis novos lanches geram um segundo bloco ainda com o primeiro aguardando",
  );
  assert.equal(JSON.stringify(filas()[0][1].itens), primeiro);
  const segundo = filas()[1];
  assert.equal(segundo[1].itens[0].quantidade, 6);
  assert.ok(segundo[1].criadoEmMs > filas()[0][1].criadoEmMs);
  await enviar();
  assert.equal(filas().length, 2, "Repetir não cria outro bloco");
  await ctx.retirarDaFilaCozinhaOperacao(segundo[0].split("/")[1]);
  assert.equal(filas().length, 1);
  await enviar();
  assert.equal(filas().length, 2, "Reenvia apenas o lote retirado sem somá-lo ao primeiro");
  await ctx.concluirCozinhaOperacao("comandas_grande_ativo");
  assert.equal(filas().length, 1, "OK do primeiro preserva o segundo pendente");
  await enviar();
  assert.equal(filas().length, 1);
  assert.equal(filas()[0][1].itens[0].quantidade, 6);
  assert.equal(
    JSON.stringify(db.docs.get("comandas/grande").itens),
    JSON.stringify([...itens, { ...lanche, quantidade: 6 }]),
  );
  console.log(
    "PASS: total e personalizações na chapa sem indicar padrão; carne separada, combos multiplicados e novos envios em lotes independentes.",
  );
})().catch((erro) => {
  console.error(erro);
  process.exitCode = 1;
});
