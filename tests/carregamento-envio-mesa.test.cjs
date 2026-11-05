const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  vm = require("node:vm");
let confirmar,
  resolver,
  rejeitar,
  envios = 0,
  carregando = 0;
const botao = { disabled: false },
  avisos = [];
const ctx = vm.createContext({
  sessaoAutoatendimentoAtual: {},
  carrinhoAutoatendimento: [{ subtotal: 25 }],
  mesaAutoatendimentoAtual: { numero: 2 },
  confirmarOperacao: () => new Promise((r) => (confirmar = r)),
  iniciarCarregamentoUI: () => {
    carregando++;
    let fim = false;
    return () => {
      if (!fim) {
        carregando--;
        fim = true;
      }
    };
  },
  document: { querySelector: () => botao },
  mesaProtegidaUI: {
    enviar() {
      envios++;
      return new Promise((r, j) => {
        resolver = r;
        rejeitar = j;
      });
    },
  },
  mostrarAvisoUI: (m) => avisos.push(m),
  mostrarAtendimentoEncerradoAutoUI() {},
  atualizarCarrinhoAuto() {},
  fecharResumoPedidoAuto() {},
  mostrarPosPedidoAutoatendimento() {},
});
const fonte = fs.readFileSync("js/mesa-protegida-ui.js", "utf8");
vm.runInContext(
  fonte.slice(
    fonte.indexOf("let enviandoMesaProtegidaUI"),
    fonte.indexOf("async function solicitarMesaProtegidaUI"),
  ),
  ctx,
);
(async () => {
  let p = ctx.enviarMesaProtegidaUI();
  await ctx.enviarMesaProtegidaUI();
  assert(botao.disabled);
  assert.equal(carregando, 0, "Confirmação continua clicável");
  confirmar(true);
  await new Promise(setImmediate);
  assert.equal(carregando, 1);
  assert.equal(envios, 1);
  await ctx.enviarMesaProtegidaUI();
  assert.equal(envios, 1);
  rejeitar(Error("Sem conexão"));
  await p;
  assert.equal(carregando, 0);
  assert.equal(botao.disabled, false);
  assert.equal(ctx.carrinhoAutoatendimento.length, 1, "Falha não apaga carrinho");
  p = ctx.enviarMesaProtegidaUI();
  confirmar(true);
  await new Promise(setImmediate);
  resolver({ sessao: { pedidoEnviado: true } });
  await p;
  assert.equal(carregando, 0);
  assert.equal(ctx.carrinhoAutoatendimento.length, 0);
  assert.equal(envios, 2);
  assert.deepEqual(avisos, ["Sem conexão"]);
  console.log(
    "PASS: carregamento durante envio real, confirmação acessível, cliques duplicados bloqueados, erro permite repetir e sucesso limpa uma vez.",
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
