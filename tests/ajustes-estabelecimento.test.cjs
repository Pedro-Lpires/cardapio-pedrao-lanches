const fs = require("node:fs"),
  vm = require("node:vm"),
  assert = require("node:assert/strict");
const { context: c, mockDb } = require("./operacao.test.cjs");
vm.runInContext(fs.readFileSync("js/acrescimo-pedido-ui.js", "utf8"), c);
const combo = (q, obs = "") => ({
  nome: "Combo teste",
  categoria: "combos",
  quantidade: 1,
  tipo: "Artesanal",
  obs,
  comboComponentes: [
    { nome: "Baguncinha", categoria: "lanches", quantidade: q },
    ...(q === 2 ? [{ nome: "Batata Média", categoria: "batatas", quantidade: 1 }] : []),
  ],
});
const compra = [combo(2, "Sem tomate e batata sequinha"), combo(5), combo(2)];
const antes = JSON.stringify(compra),
  html = c.itensHtmlChapeiroOperacao(compra);
assert.match(html, /9 Baguncinha/);
assert.match(
  html,
  /9 Baguncinha[\s\S]*<strong>2 lanches<\/strong>[\s\S]*1 Batata Média[\s\S]*Obs\. geral: Sem tomate/,
);
assert.doesNotMatch(html, /Observação para/);
const geralTodos = c.itensHtmlChapeiroOperacao([combo(3, "sem salada e coca gelada")]);
assert.match(geralTodos, /3 Baguncinha[\s\S]*Obs\. geral: sem salada e coca gelada/);
assert.doesNotMatch(
  geralTodos,
  />3 lanches</,
  "A quantidade do título não se repete se a Obs. vale para todos",
);
const legado = c.itensHtmlChapeiroOperacao([
  {
    ...combo(2),
    modoPersonalizacaoCombo: "todos",
    lanchesCombo: [1, 2].map((numero) => ({
      numero,
      adicionais: [{ nome: "Salsicha", qtd: 1 }],
      observacao: "batata bem frita",
    })),
  },
]);
assert.match(
  legado,
  /Todos com:[\s\S]*\+ 1 Salsicha[\s\S]*1 Batata Média[\s\S]*Obs\. geral: batata bem frita/,
);
assert.equal(legado.split("batata bem frita").length - 1, 1);
const comExtra = c.itensHtmlChapeiroOperacao([
  {
    ...combo(2, "2 lanches sem salada e batata bem frita"),
    modoPersonalizacaoCombo: "todos",
    lanchesCombo: [{ numero: 1, adicionais: [{ nome: "Bacon", qtd: 1 }] }],
  },
  combo(5),
  combo(2),
]);
assert.match(
  comExtra,
  /9 Baguncinha[\s\S]*2 lanches com:[\s\S]*\+ 1 Bacon[\s\S]*1 Batata Média[\s\S]*Obs\. geral: 2 lanches sem salada/,
);
assert.equal(html.split("Sem tomate e batata sequinha").length - 1, 1);
assert.doesNotMatch(html.replace(/<[^>]+>/g, ""), /Combo teste/);
assert.equal(JSON.stringify(compra), antes);
const extra = c.itemAcrescimoPedidoUI("Troca de bebida", 4);
assert.equal(c.baseFidelidadePedidoOperacao({ itens: [{ preco: 25, quantidade: 1 }, extra] }), 29);
assert.equal(c.itensChapeiroOperacao([extra]).length, 0);
assert.throws(() => c.itemAcrescimoPedidoUI("Troca", -1));
assert.throws(() => c.itemAcrescimoPedidoUI("", 4));
(async () => {
  let saldoAberto;
  c.abrirBeneficiosPagamentoSeparado = async (id, saldo, clienteId) => {
    saldoAberto = { id, saldo, clienteId };
  };
  await c.abrirPagamentoSaldoJuntoUI("mesa", {
    valorTotal: 83,
    clienteId: "cliente",
    pagamentos: [{ id: "p1", valorQuitado: 33 }],
  });
  assert.equal(saldoAberto.saldo, 50);
  assert.equal(saldoAberto.clienteId, "cliente");
  assert.equal(c.modoPagamentoSeparado, "saldo");
  assert.equal(c.itensPagamentoSeparadoAtual[0].subtotal, 50);
  c.db = mockDb({
    "comandas/a": {
      status: "Aberta",
      valorTotal: 25,
      valorPago: 10,
      itens: [{ nome: "Lanche", preco: 25, quantidade: 1 }],
    },
  });
  await c.adicionarValorComandaTransacaoUI("a", extra);
  const d = (await c.db.collection("comandas").doc("a").get()).data();
  assert.equal(d.valorTotal, 29);
  assert.equal(d.valorPago, 10);
  assert.equal(d.itens.length, 2);
  const corrigido = c.itemAcrescimoPedidoUI("Troca de bebida", 6);
  await c.substituirValorComandaTransacaoUI("a", 1, extra, corrigido);
  const editado = (await c.db.collection("comandas").doc("a").get()).data();
  assert.equal(editado.valorTotal, 31);
  assert.equal(editado.valorPago, 10);
  assert.equal(editado.itens.length, 2);
  await assert.rejects(c.substituirValorComandaTransacaoUI("a", 1, extra, corrigido), /item mudou/);
  c.db = mockDb({
    "comandas/a": { status: "Aberta", valorTotal: 6, valorPago: 6, itens: [corrigido] },
  });
  await assert.rejects(
    c.substituirValorComandaTransacaoUI("a", 0, corrigido, extra),
    /menor que o valor/,
  );
  c.db = mockDb({ "comandas/a": { status: "Fechada", valorTotal: 25, itens: [] } });
  await assert.rejects(c.adicionarValorComandaTransacaoUI("a", extra), /não está aberta/);
  console.log(
    "PASS: observação única identifica 2 dos 9 lanches e a batata; valor extra soma sem alterar catálogo, pagamentos ou preparo.",
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
