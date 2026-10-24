const fs = require("node:fs"),
  vm = require("node:vm"),
  assert = require("node:assert/strict");
const { context: ctx, mockDb } = require("./operacao.test.cjs");
const combos = JSON.parse(fs.readFileSync("scripts/combos-conferidos.json", "utf8")).filter(
  (c) => c.precoIndustrial,
);
const clonar = (obj) => JSON.parse(JSON.stringify(obj));
const carregar = (arquivo, nome) => {
  const fonte = fs.readFileSync(arquivo, "utf8");
  const inicio = fonte.search(new RegExp("(?:async )?function " + nome + "\\("));
  assert(inicio >= 0, nome);
  const proximo = fonte.slice(inicio + 1).search(/\n(?:async )?function /);
  vm.runInContext(fonte.slice(inicio, proximo < 0 ? undefined : inicio + 1 + proximo), ctx);
};
const campos = {};
let tipo = "industrial",
  canal = "index",
  atual;
ctx.document.getElementById = (id) =>
  (campos[id] ||= { value: "", textContent: "1", style: {}, dataset: {} });
ctx.document.querySelector = (seletor) =>
  seletor.startsWith('input[name="tipo-')
    ? {
        value: canal === "index" ? (tipo === "industrial" ? "Industrial" : "Artesanal") : tipo,
        dataset: { preco: tipo === "industrial" ? atual.precoIndustrial : atual.preco },
      }
    : null;
ctx.document.querySelectorAll = () => [];
ctx.alert = ctx.avisoOperacao = (texto) => assert.fail(texto);
ctx.abrirProduto =
  ctx.atualizarCarrinho =
  ctx.fecharModalProduto =
  ctx.atualizarCarrinhoAuto =
  ctx.fecharComboAuto =
  ctx.abrirBuscaProdutos =
  ctx.abrirMontagemPedidoEntrega =
  ctx.abrirMontagemPedidoRetirada =
  ctx.fecharResumoPedidoAuto =
  ctx.mostrarPosPedidoAutoatendimento =
    () => {};
ctx.limitarQuantidadeProdutoComAdicionais = () => false;
ctx.carrinho = [];
ctx.carrinhoVersao = 0;
ctx.qtdProdutoAtual = 1;
ctx.categoriaProdutoAtual = "Combos";
ctx.adicionaisSelecionados = {};
ctx.window = ctx;
carregar("js/script.js", "adicionarProdutoFinal");
let pronto;
ctx.document.addEventListener = (_evento, fn) => (pronto = fn);
vm.runInContext(fs.readFileSync("js/combos-site-ui.js", "utf8"), ctx);
pronto();
ctx.document.addEventListener = () => {};
vm.runInContext(fs.readFileSync("js/fluxos-interface.js", "utf8"), ctx);
vm.runInContext(fs.readFileSync("js/produto-comanda.js", "utf8"), ctx);
carregar("js/atendente.js", "adicionarComboConfiguradoPedido");
for (const nome of [
  "comboAutoSelecionado",
  "comboAutoTemAcrescimos",
  "adicionarComboCarrinhoAuto",
  "confirmarEnvioPedidoAuto",
])
  carregar("js/autoatendimento.js", nome);
ctx.prepararContadorPedidoOperacao = async (db) =>
  db.collection("config").doc("contadorPedidos_teste");
ctx.confirmarOperacao = async () => true;
ctx.console = {
  log() {},
  warn: (...args) => assert.fail(args.join(" ")),
  error: (...args) => assert.fail(args.join(" ")),
};
function conferir(item, combo, carne) {
  assert.equal(
    Number(item.precoUnitario ?? item.preco),
    carne === "industrial" ? combo.precoIndustrial : combo.preco,
  );
  const cozinha = ctx.itensChapeiroOperacao([item]);
  const lanches = cozinha.filter((i) => i.categoria === "lanches");
  assert.equal(
    lanches.reduce((total, i) => total + i.quantidade, 0),
    combo.comboQtdLanches,
  );
  assert(lanches.every((i) => String(i.tipoCarne).toLowerCase() === carne));
  assert(cozinha.every((i) => !/refrigerante|combo/i.test(i.nome)));
  assert.equal(
    cozinha.filter((i) => i.categoria === "batatas").reduce((s, i) => s + i.quantidade, 0),
    combo.comboComponentes
      .filter((i) => i.categoria === "batatas")
      .reduce((s, i) => s + i.quantidade, 0),
  );
  const html = ctx.itensHtmlChapeiroOperacao([item]);
  assert.match(html.toLowerCase(), new RegExp("tipo: " + carne));
}
async function enviar(colecao, item, combo) {
  ctx.db = mockDb({
    [`${colecao}/teste`]: {
      status: "Aberta",
      tipo: colecao === "pedidos" ? "Entrega" : "Local",
      mesa: 2,
      itens: [item],
    },
  });
  assert.equal(await ctx.confirmarProducaoOperacao(colecao, "teste"), true);
  const fila = ctx.db.docs.get(`filaCozinha/${colecao}_teste_ativo`);
  conferir(fila.itens[0], combo, tipo);
}
(async () => {
  assert.equal(combos.length, 6);
  for (const combo of combos)
    for (tipo of ["industrial", "artesanal"]) {
      atual = { ...clonar(combo), id: "combo", categoria: "combos" };
      const antes = JSON.stringify(atual);
      canal = "index";
      ctx.produtoAtual = atual;
      ctx.carrinho = [];
      vm.runInContext(
        `comboSiteUI = { modo: "todos", lanches: Array.from({length:${combo.comboQtdLanches}}, () => ({adicionais:{}, observacao:""})) };`,
        ctx,
      );
      ctx.adicionarProdutoFinal();
      const indexItem = ctx.montarConsumoLocalUI(ctx.carrinho, "Teste", "65999999999", null).pedido
        .itens[0];
      conferir(indexItem, combo, tipo);
      await enviar("pedidos", indexItem, combo);

      canal = "atendente";
      ctx.db = mockDb({ "comandas/teste": { status: "Aberta", mesa: 2, itens: [] } });
      await ctx.adicionarComboConfiguradoComanda("teste", "combo", atual, 1, "");
      const comandaItem = ctx.db.docs.get("comandas/teste").itens[0];
      conferir(comandaItem, combo, tipo);
      await enviar("comandas", comandaItem, combo);
      for (const contexto of ["entrega", "retirada"]) {
        const pedido = { itens: [] };
        ctx[contexto === "entrega" ? "pedidoEntregaAtual" : "pedidoRetiradaAtual"] = pedido;
        ctx.indiceItemEntregaEmEdicao = ctx.indiceItemRetiradaEmEdicao = null;
        ctx.adicionarComboConfiguradoPedido("combo", atual, 1, "", contexto);
        conferir(pedido.itens[0], combo, tipo);
        await enviar("pedidos", pedido.itens[0], combo);
      }

      canal = "auto";
      Object.assign(ctx, {
        comboAutoAtual: atual,
        quantidadeComboAuto: 1,
        modoPersonalizacaoComboAuto: "padrao",
        configuracaoTodosComboAuto: null,
        configuracoesLanchesComboAuto: {},
        carrinhoAutoatendimento: [],
        indiceItemAutoEmEdicao: null,
        voltarResumoDepoisEdicaoAuto: false,
      });
      ctx.adicionarComboCarrinhoAuto();
      conferir(ctx.carrinhoAutoatendimento[0], combo, tipo);
      ctx.db = mockDb({
        "mesas/mesa2": { numero: 2 },
        "sessoesMesa/teste": { status: "ativa", mesaId: "mesa2", nome: "Teste" },
      });
      ctx.sessaoAutoatendimentoAtual = { id: "teste" };
      ctx.mesaAutoatendimentoId = "mesa2";
      await ctx.confirmarEnvioPedidoAuto();
      const filaAuto = [...ctx.db.docs.entries()].find(([id]) => id.startsWith("filaCozinha/"));
      assert(filaAuto, "Envio real do autoatendimento cria a fila da cozinha");
      conferir(filaAuto[1].itens[0], combo, tipo);
      assert.equal(JSON.stringify(atual), antes, "Escolher o tipo não modifica o cadastro");
    }
  canal = "atendente";
  ctx.db = mockDb({ "comandas/teste": { status: "Aberta", itens: [] } });
  for (tipo of ["industrial", "artesanal"])
    await ctx.adicionarComboConfiguradoComanda("teste", "combo", atual, 1, "");
  assert.equal(
    ctx.db.docs.get("comandas/teste").itens.length,
    2,
    "Tipos diferentes não se juntam na comanda",
  );
  console.log(
    "PASS: seis combos nos dois tipos, preços e envio real até a cozinha pelo index, atendente (comanda/entrega/retirada) e autoatendimento.",
  );
})().catch((erro) => {
  console.error(erro);
  process.exitCode = 1;
});
