const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  vm = require("node:vm");
let contexto,
  assinaturas = 0,
  escritas = 0,
  reconstrucoes = 0,
  callback,
  falhaListener;
let falharEnvio = false,
  segurarEnvio = false,
  liberarEnvio,
  falharMetadados = false;
const mensagens = [{ texto: "Olá", remetente: "cliente", data: "2026-10-27T12:00:00Z" }];
const botao = { disabled: false };
const lista = { innerHTML: "" },
  status = { hidden: true, innerHTML: "" };
let campo = null;
const chat = {
  style: {},
  set innerHTML(html) {
    this.html = html;
    reconstrucoes++;
    campo = html.includes('id="resposta-chamado-cliente"')
      ? {
          value: "",
          closest: () => ({ querySelector: () => botao }),
          focus() {
            contexto.document.activeElement = this;
          },
        }
      : null;
  },
  get innerHTML() {
    return this.html;
  },
  querySelector(s) {
    return s === "textarea"
      ? campo
      : s === ".suporte-mensagens-ui"
        ? lista
        : s === ".suporte-conexao-status-ui"
          ? status
          : null;
  },
};
const modal = { scrollHeight: 1000, scrollTop: 0, clientHeight: 300 };
Object.assign(lista, modal);
const tituloJanela = { textContent: "" };
const controlesJanela = { onclick: null, setAttribute() {} };
const janela = {
  open: true,
  dataset: {},
  style: { setProperty() {} },
  classList: { add() {} },
  querySelector: (s) => (s.includes("h3") ? tituloJanela : controlesJanela),
  setAttribute() {},
  addEventListener() {},
};
const elementos = Object.fromEntries(
  ["lista-chamados-cliente", "suporte-menu", "form-novo-chamado"].map((id) => [id, { style: {} }]),
);
elementos["chat-chamado-cliente"] = chat;
const emitir = () =>
  callback({
    docs: mensagens.map((m) => ({ data: () => ({ ...m }), ref: { update: async () => {} } })),
  });
const ref = {
  get: async () => ({ data: () => ({ status: "aberto" }) }),
  update: async () => {
    if (falharMetadados) throw Error("Metadados offline");
  },
  collection: () => ({
    orderBy() {
      return this;
    },
    onSnapshot(fn, erro) {
      assinaturas++;
      callback = fn;
      falhaListener = erro;
      emitir();
      return () => {};
    },
    async add(m) {
      escritas++;
      if (falharEnvio) throw Error("Offline");
      mensagens.push(m);
      emitir();
      if (segurarEnvio)
        await new Promise((resolve) => {
          liberarEnvio = resolve;
        });
    },
  }),
};
contexto = vm.createContext({
  console: { error() {} },
  innerHeight: 667,
  addEventListener() {},
  removeEventListener() {},
  abrirJanelaElementoUI: () => janela,
  Set,
  Date,
  clienteLogado: {
    telefone: "65999999999",
    avatar: "images/avatar2.webp",
    fidelidadeAtiva: true,
    nivelCliente: "Ouro",
  },
  document: {
    activeElement: null,
    getElementById: (id) => (id === "resposta-chamado-cliente" ? campo : elementos[id]),
    querySelector: () => modal,
  },
  db: { collection: () => ({ doc: () => ({ collection: () => ({ doc: () => ref }) }) }) },
  lerComPrazoUI: (p) => p,
  htmlCarregandoUI: () => "Carregando…",
  atualizarContadorMensagens() {},
  escaparOperacao: (s) => String(s || "").replaceAll("<", "&lt;"),
  alert: (s) => {
    contexto.ultimoAviso = s;
  },
});
contexto.window = contexto;
vm.runInContext(fs.readFileSync("js/avatares-ui.js", "utf8"), contexto);
const fonte = fs.readFileSync("js/script.js", "utf8");
vm.runInContext(
  "let consultaMensagensUI = 0;" +
    fonte.slice(
      fonte.indexOf("let chamadoClienteAbertoId ="),
      fonte.indexOf("function retomarMensagensClienteUI("),
    ),
  contexto,
);
vm.runInContext(
  fonte.slice(
    fonte.indexOf("async function enviarMensagemChamadoCliente("),
    fonte.indexOf("async function finalizarChamadoCliente("),
  ),
  contexto,
);
(async () => {
  await contexto.abrirChamadoCliente("suporte1");
  const compositor = campo,
    base = reconstrucoes;
  assert.match(lista.innerHTML, /images\/avatares\/ouro\/ketchup.webp/);
  assert.match(lista.innerHTML, /data-avatar-rank="ouro"/);
  campo.value = "Primeira resposta";
  contexto.document.activeElement = campo;
  await Promise.all([
    contexto.enviarMensagemChamadoCliente(),
    contexto.enviarMensagemChamadoCliente(),
  ]);
  assert.equal(escritas, 1, "Dois toques rápidos enviam uma vez");
  assert.equal(campo.value, "", "Limpa o campo depois do envio confirmado");
  assert.equal(campo, compositor);
  assert.equal(assinaturas, 1, "Enviar não reabre a conversa nem refaz a assinatura");
  assert.equal(reconstrucoes, base, "Atualiza mensagens sem reconstruir a janela");
  assert.match(lista.innerHTML, /Primeira resposta/);
  campo.value = "Texto que ainda estou escrevendo";
  lista.scrollTop = 10;
  mensagens.push({ remetente: "admin", texto: "Nova resposta", data: "2026-10-27T12:01:00Z" });
  emitir();
  assert.equal(campo.value, "Texto que ainda estou escrevendo");
  assert.equal(contexto.document.activeElement, campo);
  assert.equal(lista.scrollTop, 10, "Não força o fim quando o cliente está lendo acima");
  assert.equal(modal.scrollTop, 0, "A conversa nunca rola a página externa de mensagens");
  falharEnvio = true;
  await contexto.enviarMensagemChamadoCliente();
  assert.equal(campo.value, "Texto que ainda estou escrevendo");
  assert.equal(botao.disabled, false);
  assert.match(contexto.ultimoAviso, /texto foi mantido/);
  falharEnvio = false;
  segurarEnvio = true;
  const emAndamento = contexto.enviarMensagemChamadoCliente();
  while (!liberarEnvio) await Promise.resolve();
  campo.value = "Próxima mensagem digitada durante o envio";
  liberarEnvio();
  await emAndamento;
  assert.equal(campo.value, "Próxima mensagem digitada durante o envio");
  segurarEnvio = false;
  falharMetadados = true;
  await contexto.enviarMensagemChamadoCliente();
  assert.equal(campo.value, "", "Falha no horário do chamado não repete mensagem já salva");
  campo.value = "Rascunho preservado sem conexão";
  falhaListener();
  assert.equal(campo.value, "Rascunho preservado sem conexão");
  assert.equal(status.hidden, false);
  assert.equal(reconstrucoes, base);
  console.log(
    "PASS: suporte usa avatar/rank atual, limpa envio, bloqueia repetição, mantém compositor/foco/rascunho e não força rolagem ao receber resposta.",
  );
})().catch((erro) => {
  console.error(erro);
  process.exitCode = 1;
});
