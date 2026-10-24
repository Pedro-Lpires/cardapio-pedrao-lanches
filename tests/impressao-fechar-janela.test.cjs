const fs = require("node:fs");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const { context: ctx, mockDb } = require("./operacao.test.cjs");
let ultimaJanela,
  impressoes = 0;
const avisos = [];
ctx.avisoOperacao = (texto) => avisos.push(texto);
ctx.confirmarOperacao = () => assert.fail("Tela deve enviar sem outra confirmação");
ctx.document.createElement = () => {
  const eventos = {};
  const botoes = { ".ui-x": {}, '[data-acao="imprimir"]': {}, '[data-acao="enviar"]': {} };
  ultimaJanela = {
    open: false,
    querySelector: (seletor) => botoes[seletor],
    querySelectorAll: () => Object.values(botoes).slice(1),
    addEventListener: (nome, fn) => (eventos[nome] = fn),
    showModal() {
      this.open = true;
    },
    close() {
      this.open = false;
      eventos.close?.();
    },
    remove() {
      this.removida = true;
    },
  };
  return ultimaJanela;
};
ctx.document.body = { append() {} };
ctx.window.open = () => ({
  document: {
    write() {
      impressoes++;
    },
    close() {},
  },
  focus() {},
});
vm.runInContext(fs.readFileSync("js/fluxos-interface.js", "utf8"), ctx);
const app = fs.readFileSync("js/app-ui.js", "utf8");
vm.runInContext(
  app.slice(
    app.indexOf("async function enviarMesaCozinhaUI("),
    app.indexOf("async function abrirPedidosTipoUI("),
  ),
  ctx,
);
const item = { nome: "Baguncinha", categoria: "lanches", quantidade: 1, preco: 25 };
const botao = (janela, acao) => janela.querySelector(`[data-acao="${acao}"]`);
(async () => {
  // Atendente e administrador usam estes mesmos fluxos de destino.
  for (const [colecao, tipo] of [
    ["comandas", "Local"],
    ["pedidos", "Entrega"],
    ["pedidos", "Retirada"],
  ]) {
    ctx.db = mockDb({ [`${colecao}/teste`]: { status: "Aberta", tipo, mesa: 2, itens: [item] } });
    ctx.abrirDestinoPedidoUI("cozinha", colecao, "teste");
    let janela = ultimaJanela;
    assert.match(janela.innerHTML, />Tela</);
    await botao(janela, "enviar").onclick();
    assert.equal(janela.open, false, tipo + ": envio fecha as opções");
    assert.equal(janela.removida, true);
    assert.equal(ctx.db.docs.get(`filaCozinha/${colecao}_teste_ativo`).status, "aguardando");
    ctx.abrirDestinoPedidoUI("cozinha", colecao, "teste");
    janela = ultimaJanela;
    const antes = impressoes;
    await botao(janela, "imprimir").onclick();
    assert.equal(impressoes, antes + 1);
    assert.equal(janela.open, false, tipo + ": impressão fecha as opções");
  }
  ctx.db = mockDb({
    "comandas/a": { status: "Aberta", mesa: 2, itens: [item] },
    "comandas/b": { status: "Aberta", mesa: 2, itens: [item] },
  });
  ctx.abrirCozinhaMesaUI(2);
  await botao(ultimaJanela, "enviar").onclick();
  assert.equal(ultimaJanela.open, false);
  assert.equal(ctx.db.docs.get("filaCozinha/comandas_a_ativo").status, "aguardando");
  assert.equal(ctx.db.docs.get("filaCozinha/comandas_b_ativo").status, "aguardando");
  ctx.abrirCozinhaMesaUI(2);
  await botao(ultimaJanela, "imprimir").onclick();
  assert.equal(ultimaJanela.open, false);
  assert.deepEqual(avisos, [], "Envios e impressões não mostram avisos de sucesso");

  ctx.window.open = () => null;
  ctx.abrirCozinhaMesaUI(2);
  await botao(ultimaJanela, "imprimir").onclick();
  assert.equal(ultimaJanela.open, true, "Impressão bloqueada mantém as opções disponíveis");
  assert.match(avisos.pop(), /Permita abrir/);
  ctx.db = mockDb({ "comandas/a": { status: "Fechada", itens: [item] } });
  ctx.abrirDestinoPedidoUI("cozinha", "comandas", "a");
  await botao(ultimaJanela, "enviar").onclick();
  assert.equal(ultimaJanela.open, true, "Falha no envio mantém a janela aberta");
  assert.match(avisos.pop(), /não está aberta/);
  assert.equal(botao(ultimaJanela, "enviar").disabled, false);
  console.log(
    "PASS: Tela e impressão fecham opções sem confirmação ou aviso de sucesso; falhas permitem tentar novamente.",
  );
})().catch((erro) => {
  console.error(erro);
  process.exitCode = 1;
});
