const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  vm = require("node:vm");
const elementos = Object.fromEntries(
  [
    "lista-chamados-cliente",
    "suporte-menu",
    "form-novo-chamado",
    "chat-chamado-cliente",
    "box-enviar-suporte",
    "suporte-blocos",
    "suporte-categoria-vazia",
  ].map((id) => [id, { style: {}, hidden: false }]),
);
const categorias = { hidden: false },
  cards = ["reclamacao", "feedback"].map((categoria) => ({
    dataset: { categoria },
    hidden: false,
  }));
let janelas = 0,
  fechadas = 0,
  consultas = 0,
  paradas = 0,
  janela;
function criarJanela() {
  const eventos = {},
    voltar = {},
    fechar = { setAttribute() {} },
    titulo = {};
  return {
    open: true,
    dataset: {},
    style: { setProperty() {} },
    classList: { add() {} },
    setAttribute() {},
    querySelector: (s) => (s === ".ui-voltar" ? voltar : s === ".ui-x" ? fechar : titulo),
    addEventListener(nome, fn) {
      eventos[nome] = fn;
    },
    close() {
      if (!this.open) return;
      this.open = false;
      fechadas++;
      eventos.close();
    },
  };
}
const ctx = vm.createContext({
  consultaMensagensUI: 0,
  abaMensagemAtual: "suporte",
  innerHeight: 667,
  addEventListener() {},
  removeEventListener() {},
  document: {
    getElementById: (id) => elementos[id],
    querySelector: () => categorias,
    querySelectorAll: () => cards,
  },
  abrirJanelaElementoUI: () => {
    janelas++;
    janela = criarJanela();
    return janela;
  },
  listarChamadosCliente: async () => {
    consultas++;
  },
});
ctx.window = ctx;
const fonte = fs.readFileSync("js/script.js", "utf8");
vm.runInContext(
  fonte.slice(
    fonte.indexOf("let chamadoClienteAbertoId ="),
    fonte.indexOf("function abrirFormNovoChamado("),
  ),
  ctx,
);
vm.runInContext(
  fonte.slice(
    fonte.indexOf("function filtrarSuportesCliente("),
    fonte.indexOf("async function criarChamadoSuporte("),
  ),
  ctx,
);
(async () => {
  ctx.etapaSuporteCliente("lista");
  assert.equal(janelas, 1);
  assert.equal(janela.dataset.etapa, "lista");
  ctx.filtrarSuportesCliente("reclamacao");
  assert.equal(janelas, 1, "A categoria usa a mesma janela");
  assert.equal(categorias.hidden, true, "Após entrar, o botão de Reclamação fica fora da tela");
  assert.equal(cards[0].hidden, false);
  assert.equal(cards[1].hidden, true);
  assert.equal(janela.dataset.etapa, "categoria");
  ctx.etapaSuporteCliente("chat");
  assert.equal(janela.dataset.etapa, "chat");
  assert.equal(elementos["chat-chamado-cliente"].style.display, "flex");
  ctx.listenerChamadoCliente = () => paradas++;
  await janela.querySelector(".ui-voltar").onclick();
  assert.equal(paradas, 1, "Voltar encerra a assinatura da conversa");
  assert.equal(janela.dataset.etapa, "categoria");
  await janela.querySelector(".ui-voltar").onclick();
  assert.equal(janela.dataset.etapa, "lista");
  await janela.querySelector(".ui-voltar").onclick();
  assert.equal(fechadas, 1);
  assert.equal(elementos["suporte-menu"].style.display, "grid");
  assert.equal(elementos["chat-chamado-cliente"].style.display, "none");
  ctx.etapaSuporteCliente("novo");
  assert.equal(janelas, 2);
  assert.equal(elementos["form-novo-chamado"].style.display, "grid");
  janela.querySelector(".ui-x").onclick();
  assert.equal(fechadas, 2);
  assert.equal(elementos["suporte-menu"].style.display, "grid");
  ctx.etapaSuporteCliente("novo");
  ctx.abaMensagemAtual = "geral";
  const consultaGeral = ++ctx.consultaMensagensUI;
  janela.close();
  assert.equal(
    ctx.consultaMensagensUI,
    consultaGeral,
    "Fechar o suporte ao trocar de aba não invalida a consulta da nova aba",
  );
  assert.equal(elementos["box-enviar-suporte"].style.display, "none");
  assert(consultas >= 2);
  console.log(
    "PASS: suporte abre janela única, oculta a categoria selecionada, Voltar respeita etapas e X encerra a janela com limpeza da conversa.",
  );
})().catch((erro) => {
  console.error(erro);
  process.exitCode = 1;
});
