const fs = require("node:fs");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const elementos = Object.fromEntries(
  ["modal-mensagens", "lista-mensagens-cliente", "box-enviar-suporte"].map((id) => [
    id,
    { style: {}, innerHTML: "" },
  ]),
);
const leituras = [];
let suporte = 0;
let marcacoes = 0;
const consulta = {
  doc() {
    return this;
  },
  collection() {
    return this;
  },
  where() {
    return this;
  },
  get() {
    return new Promise((resolve, reject) => leituras.push({ resolve, reject }));
  },
};
const contexto = vm.createContext({
  document: { getElementById: (id) => elementos[id] },
  window: {},
  clienteLogado: { telefone: "123" },
  db: { collection: () => consulta },
  htmlCarregandoUI: (texto) => "loading:" + texto,
  lerComPrazoUI: (promessa) => promessa,
  escaparOperacao: (s) => String(s ?? "").replaceAll("<", "&lt;"),
  atualizarContadorMensagens: async () => {},
  etapaSuporteCliente: () => suporte++,
  console: { error() {} },
});
const fonte = fs.readFileSync("js/script.js", "utf8");
vm.runInContext(
  fonte.slice(
    fonte.indexOf('let abaMensagemAtual = "geral";'),
    fonte.indexOf("async function enviarMensagemSuporte("),
  ),
  contexto,
);
function snap(mensagens) {
  const docs = mensagens.map((m) => ({
    data: () => m,
    ref: {
      update: () => {
        marcacoes++;
        return new Promise(() => {});
      },
    },
  }));
  return { empty: !docs.length, docs, forEach: (fn) => docs.forEach(fn) };
}
(async () => {
  const antiga = contexto.abrirAbaMensagens("admin");
  assert.match(elementos["lista-mensagens-cliente"].innerHTML, /loading/);
  await contexto.abrirAbaMensagens("suporte");
  assert.equal(suporte, 1);
  assert.equal(elementos["box-enviar-suporte"].style.display, "block");
  leituras.shift().resolve(snap([{ texto: "Resposta atrasada", data: 0 }]));
  await antiga;
  assert.equal(elementos["lista-mensagens-cliente"].innerHTML, "");

  const atual = contexto.abrirAbaMensagens("admin");
  leituras.shift().resolve(
    snap([
      {
        texto: "Descrição\nCupom: AB10. Confira as condições de uso do cupom.",
        cupomCodigo: "AB10",
        remetente: "admin",
        lida: false,
        data: 0,
      },
    ]),
  );
  await atual; // não aguarda a marcação como lida, que continua pendente
  const html = elementos["lista-mensagens-cliente"].innerHTML;
  assert.equal(marcacoes, 1);
  assert.match(html, /mensagem-descricao">Descrição<\/p>/);
  assert.match(html, /mensagem-cupom/);
  assert.doesNotMatch(html, /condições de uso/);
  assert.match(contexto.htmlMensagemCliente({ texto: "<script>", data: 0 }), /&lt;script>/);

  const falha = contexto.abrirAbaMensagens("geral");
  leituras.shift().reject(Error("sem conexão"));
  await falha;
  assert.match(elementos["lista-mensagens-cliente"].innerHTML, /Tentar novamente/);
  const fechada = contexto.abrirAbaMensagens("admin");
  contexto.fecharMensagensCliente();
  leituras.shift().resolve(snap([{ texto: "Não mostrar após fechar", data: 0 }]));
  await fechada;
  assert.doesNotMatch(elementos["lista-mensagens-cliente"].innerHTML, /Não mostrar após fechar/);
  let expirar,
    limpezas = 0;
  contexto.setTimeout = (fn, prazo) => {
    expirar = fn;
    assert.equal(prazo, 12000);
    return 1;
  };
  contexto.clearTimeout = () => limpezas++;
  const comum = fs.readFileSync("js/ui-comum.js", "utf8");
  vm.runInContext(
    comum.slice(
      comum.indexOf("function lerComPrazoUI("),
      comum.indexOf('document.addEventListener("DOMContentLoaded", exibirProximoAvisoUI);'),
    ),
    contexto,
  );
  const limite = contexto.lerComPrazoUI(new Promise(() => {}));
  expirar();
  await assert.rejects(limite, /busca demorou/);
  assert.equal(limpezas, 1);
  console.log(
    "PASS: suporte imediato, respostas atrasadas ignoradas, leitura sem bloquear por marcação, cupom separado e falha recuperável.",
  );
})().catch((erro) => {
  console.error(erro);
  process.exitCode = 1;
});
