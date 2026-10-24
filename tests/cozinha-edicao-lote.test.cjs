const fs = require("node:fs"),
  vm = require("node:vm"),
  assert = require("node:assert/strict");
const { context: ctx, mockDb } = require("./operacao.test.cjs");
vm.runInContext(fs.readFileSync("js/produto-comanda.js", "utf8"), ctx);
const campos = {
  "quantidade-produto-config": { textContent: "1" },
  "observacao-produto-config": { value: "Sem cebola" },
};
ctx.document.getElementById = (id) => campos[id] || null;
ctx.document.querySelector = () => ({ value: "artesanal", dataset: { preco: "25" } });
ctx.alert = ctx.mostrarAvisoUI = ctx.avisoOperacao = (texto) => assert.fail(texto);
ctx.confirmarOperacao = async () => true;
ctx.abrirComandaVisual = () => {};
const tomate = { id: "tomate", nome: "Tomate", qtd: 1, preco: 2 };
ctx.obterAcrescimosSelecionados = () => [tomate];
const base = {
  produtoId: "lanche",
  nome: "Baguncinha",
  categoria: "lanches",
  tipo: "artesanal",
  quantidade: 1,
  adicionais: [],
  observacao: "",
  subtotal: 25,
};
const combo = {
  produtoId: "combo",
  nome: "Combo 2 Artesanal",
  categoria: "combos",
  quantidade: 1,
  comboQtdLanches: 2,
  comboComponentes: [
    { nome: "Baguncinha", categoria: "lanches", tipoCarne: "artesanal", quantidade: 2 },
  ],
  subtotal: 50,
};
const itens = [
  { ...base, quantidade: 9 },
  { ...base, adicionais: [tomate] },
  combo,
  { produtoId: "batata", nome: "Batata Grande", categoria: "batatas", quantidade: 1, subtotal: 30 },
];
const db = mockDb({
  "produtos/lanche": { nome: "Baguncinha", categoria: "lanches", preco: 25 },
  "produtos/combo": { ...combo, preco: 50 },
  "produtos/batata": { nome: "Batata Grande", categoria: "batatas", preco: 30 },
  "comandas/mesa": { status: "Aberta", mesa: 2, itens },
});
ctx.db = db;
const filas = () =>
  [...db.docs.entries()].filter(
    ([id, d]) => id.startsWith("filaCozinha/") && d.status === "aguardando",
  );
const enviar = () => ctx.confirmarProducaoOperacao("comandas", "mesa");
const editar = (indice) =>
  vm.runInContext(`itemComandaEmEdicao = { comandaId: "mesa", index: ${indice} };`, ctx);
(async () => {
  await enviar();
  const primeiro = filas()[0][0];
  const horario = filas()[0][1].criadoEmMs;
  await db
    .collection("comandas")
    .doc("mesa")
    .update({ itens: [...itens, { ...base, quantidade: 6 }] });
  await enviar();
  assert.equal(filas().length, 2);
  const segundo = filas().find(([id]) => id !== primeiro);
  const segundoAntes = JSON.stringify(segundo[1].itens);
  editar(1);
  await ctx.adicionarProdutoConfiguradoComanda("mesa", "lanche");
  assert.equal(db.docs.get("comandas/mesa").edicoesPendentesCozinha.length, 1);
  assert.ok(
    !JSON.stringify(db.docs.get(primeiro).itens).includes("Sem cebola"),
    "A edição só é liberada ao reenviar",
  );
  await enviar();
  assert.equal(filas().length, 2, "Observação não cria terceiro lote");
  assert.equal(db.docs.get(primeiro).criadoEmMs, horario);
  let grupo = ctx
    .agruparPreparoChapeiroOperacao(db.docs.get(primeiro).itens)
    .find((g) => g.nome === "Baguncinha");
  assert.equal(grupo.quantidade, 12);
  assert.equal(
    grupo.personalizacoes.find((p) => p.observacao === "Sem cebola").adicionais[0].nome,
    "Tomate",
  );
  assert.equal(JSON.stringify(db.docs.get(segundo[0]).itens), segundoAntes);
  assert.equal(db.docs.get("comandas/mesa").edicoesPendentesCozinha.length, 0);
  editar(1);
  ctx.obterAcrescimosSelecionados = () => [
    ...[tomate],
    { id: "bacon", nome: "Bacon", qtd: 2, preco: 5 },
  ];
  campos["observacao-produto-config"].value = "Sem salada";
  await ctx.adicionarProdutoConfiguradoComanda("mesa", "lanche");
  editar(3);
  await ctx.adicionarProdutoConfiguradoComanda("mesa", "batata");
  editar(2);
  vm.runInContext(
    'modoPersonalizacaoCombo = "todos"; quantidadeLanchesComboAtual = 2; configuracaoTodosCombo = { adicionais: [{ id: "bacon", nome: "Bacon", qtd: 1, preco: 5 }], observacao: "Sem tomate" };',
    ctx,
  );
  await ctx.adicionarProdutoConfiguradoComanda("mesa", "combo");
  await enviar();
  assert.equal(filas().length, 2, "Acréscimos no lanche, combo e batata mantêm os lotes");
  assert.equal(db.docs.get(primeiro).criadoEmMs, horario);
  assert.equal(JSON.stringify(db.docs.get(segundo[0]).itens), segundoAntes);
  grupo = ctx
    .agruparPreparoChapeiroOperacao(db.docs.get(primeiro).itens)
    .find((g) => g.nome === "Baguncinha");
  assert.equal(grupo.quantidade, 12);
  await enviar();
  assert.equal(filas().length, 2, "Reenvio repetido não duplica");
  const comanda = db.docs.get("comandas/mesa");
  await db
    .collection("comandas")
    .doc("mesa")
    .update({ itens: [...comanda.itens, { ...base, nome: "Outro lanche", quantidade: 1 }] });
  await enviar();
  assert.equal(filas().length, 3, "Item novo continua em lote novo");
  const repetido = { ...base, adicionais: [tomate] };
  const edicoes = ctx.registrarEdicaoPreparoComandaOperacao({ itens: [repetido, repetido] }, 1, {
    ...repetido,
    observacao: "Só o segundo",
  });
  const corrigidas = ctx.aplicarEdicoesPreparoOperacao(
    [
      { id: "a", status: "aguardando", criadoEmMs: 10, itens: [repetido] },
      { id: "b", status: "aguardando", criadoEmMs: 20, itens: [repetido] },
    ],
    edicoes,
    0,
  );
  assert.equal(corrigidas[0].itens[0].observacao, "");
  assert.equal(
    corrigidas[1].itens[0].observacao,
    "Só o segundo",
    "Linhas iguais em envios diferentes respeitam qual foi editada",
  );
  console.log(
    "PASS: salvar edição real mantém os 12 lanches no primeiro lote, atualiza observações/extras de lanche, combo e batata e conserva o segundo envio de seis.",
  );
})().catch((erro) => {
  console.error(erro);
  process.exitCode = 1;
});
