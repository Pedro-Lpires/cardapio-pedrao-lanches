const fs = require("node:fs"),
  vm = require("node:vm"),
  assert = require("node:assert/strict");
const ctx = vm.createContext({
  document: {
    createElement: (tag) => ({
      tag,
      hidden: false,
      dataset: {},
      append(...filhos) {
        this.filhos = filhos;
      },
    }),
  },
});
vm.runInContext(fs.readFileSync("js/personagens-ui.js", "utf8"), ctx);
for (const [aviso, esperado] of [
  [
    { mensagem: "Lanches com adicionais devem ser adicionados ao carrinho uma unidade por vez." },
    "acrescimos",
  ],
  [
    { mensagem: "Combos com adicionais devem ser adicionados ao carrinho uma unidade por vez." },
    "acrescimos",
  ],
  [{ mensagem: "Retire os acréscimos para aumentar a quantidade." }, "acrescimos"],
  [{ mensagem: "Código de ativação não encontrado." }, "codigoNaoEncontrado"],
  [{ mensagem: "Código inválido ou não pertence a este cliente." }, "codigoNaoEncontrado"],
  [
    { mensagem: "Entramos na conta, mas o CDA está errado.", personagem: "codigoLogin" },
    "codigoLogin",
  ],
  [{ mensagem: "Esse código não existe ou você digitou errado.", personagem: "codigo" }, "codigo"],
  [{ mensagem: "Código ativado! Sua fidelidade já está disponível." }, "ativado"],
  [{ mensagem: "Bem-vindo, Cliente!", boasVindas: true }, "boasVindas"],
  [{ mensagem: "Sobre o CDA", informativo: true }, "ajudaCda"],
  [{ mensagem: "Sobre o preparo", personagem: "infoPreparo" }, "infoPreparo"],
  [{ mensagem: "Sobre a entrega", personagem: "infoEntrega" }, "infoEntrega"],
  [{ mensagem: "WhatsApp", personagem: "infoWhatsapp", informativo: true }, "infoWhatsapp"],
  [{ mensagem: "Autorize sua localização", localizacao: true }, "localizacao"],
  [{ mensagem: "Seu pedido está vazio." }, "vazio"],
  [{ mensagem: "Informe seu nome." }, "conferir"],
  [{ mensagem: "Não foi possível enviar o pedido. Tente novamente." }, "falha"],
  [{ mensagem: "Perfil atualizado!" }, "sucesso"],
  [{ mensagem: "🔔 Atendente chamado! Aguarde um momento." }, "chamado"],
]) {
  const personagem = ctx.personagemAvisoPedraoUI(aviso);
  assert.equal(personagem.tipo, esperado);
  assert(fs.existsSync(personagem.imagem), personagem.imagem);
  assert(fs.statSync(personagem.imagem).size < 300000, "O popup usa a cópia leve");
}
assert.equal(ctx.personagemAvisoPedraoUI({ mensagem: "Cupom inválido." }), null);
assert.equal(
  ctx.personagemAvisoPedraoUI({
    mensagem: "Este código está vinculado a mais de uma conta. Procure o atendimento.",
  }),
  null,
);
assert(fs.existsSync(ctx.imagemPersonagemPedraoUI("pedido")));
const paragrafo = {
  before(...itens) {
    this.antes = itens;
  },
  textContent: "Mensagem segura <script>",
};
const icone = { hidden: false },
  attrs = {};
const dialogo = {
  dataset: {},
  classList: {
    add(c) {
      attrs.classe = c;
    },
  },
  querySelector(s) {
    return s === "p" ? paragrafo : icone;
  },
  setAttribute(k, v) {
    attrs[k] = v;
  },
};
ctx.decorarAvisoPersonagemPedraoUI(dialogo, {
  mensagem: "Esse código não existe.",
  personagem: "codigo",
});
const retrato = paragrafo.antes[0],
  balao = paragrafo.antes[1];
assert.equal(retrato.filhos[0].tag, "img");
assert.equal(balao.className, "aviso-fala-ui");
assert.equal(balao.filhos[0].tag, "h2");
assert.equal(balao.filhos[0].textContent, "Aí não, sacana!");
assert.equal(balao.filhos[1], paragrafo);
assert.equal(paragrafo.textContent, "Mensagem segura <script>");
assert.equal(icone.hidden, true);
assert.equal(attrs["aria-labelledby"], "aviso-personagem-titulo-ui");
retrato.filhos[0].onerror();
assert.equal(
  retrato.filhos[0].hidden,
  true,
  "Falha da arte não esconde a mensagem nem os controles",
);
for (const pagina of ["index.html", "autoatendimento.html"])
  assert(fs.readFileSync(pagina, "utf8").includes("js/personagens-ui.js"));
for (const pagina of ["painel-atendente.html", "admin.html"])
  assert(!fs.readFileSync(pagina, "utf8").includes("js/personagens-ui.js"));
const operacao = fs.readFileSync("js/operacao.js", "utf8");
let avisoCheckout;
ctx.mostrarAvisoUI = (mensagem) => {
  avisoCheckout = mensagem;
};
vm.runInContext(
  operacao.slice(
    operacao.indexOf("function avisoOperacao("),
    operacao.indexOf("function saldoComandaPagamento("),
  ),
  ctx,
);
ctx.avisoOperacao("Informe nome e celular completo com DDD antes de continuar.");
assert.match(avisoCheckout, /nome e celular/);
assert.equal(ctx.personagemAvisoPedraoUI({ mensagem: avisoCheckout }).tipo, "conferir");
const comum = fs.readFileSync("js/ui-comum.js", "utf8");
ctx.exibirProximoAvisoUI = () => {};
vm.runInContext(
  comum.slice(
    comum.indexOf("const filaAvisosUI"),
    comum.indexOf("function pedirPermissaoLocalizacaoUI"),
  ),
  ctx,
);
const site = fs.readFileSync("js/script.js", "utf8");
vm.runInContext(
  site.slice(
    site.indexOf("function abrirInfoLojaUI("),
    site.indexOf("function atualizarHorarioFuncionamento("),
  ),
  ctx,
);
for (const tipo of ["preparo", "whatsapp", "entrega"]) ctx.abrirInfoLojaUI(tipo);
const informacoes = vm.runInContext("filaAvisosUI", ctx);
assert.equal(informacoes.length, 3);
assert.match(informacoes[0].mensagem, /no mínimo 15 minutos/);
assert.match(informacoes[2].mensagem, /terceirizadas/);
assert.match(informacoes[2].mensagem, /autorize a localização GPS/);
assert.equal(informacoes[1].url, "https://wa.me/5565992386045");
assert.equal(informacoes[1].informativo, true, "WhatsApp aguarda a confirmação no aviso");
for (const aviso of informacoes)
  assert.match(ctx.personagemAvisoPedraoUI(aviso).imagem, /mago-brincalhao\.webp$/);
console.log(
  "PASS: personagens por situação só nos dois canais públicos; artes leves, CDA distinto de cupom, texto seguro e fallback preservado.",
);
