const fs = require("node:fs"),
  vm = require("node:vm"),
  assert = require("node:assert/strict");
const fonte = fs.readFileSync("js/autoatendimento.js", "utf8");
function carregar(ctx, nome) {
  const inicio = fonte.indexOf("async function " + nome + "(");
  const proximo = fonte.slice(inicio + 1).search(/\n(?:async )?function /);
  vm.runInContext(fonte.slice(inicio, inicio + 1 + proximo), ctx);
}
function ambiente({ numero = 6, lembrar = true, ocupada = false, conta = true } = {}) {
  const telefone = "65999999999";
  const memoria = new Map();
  if (lembrar) memoria.set("clientePedrao", JSON.stringify({ nome: "Cliente Teste", telefone }));
  memoria.set("sessaoAutoatendimentoId:mesa2", "visita-anterior");
  const docs = new Map([
    ["mesas/mesa" + numero, { numero, ocupada }],
    ["sessoesMesa/visita-anterior", { mesaId: "mesa2", status: "encerrada" }],
  ]);
  if (conta)
    docs.set("clientes/" + telefone, {
      nome: "Cliente Teste",
      avatar: "images/avatares/prata/maionese.webp",
      fidelidadeAtiva: false,
    });
  const escritas = [],
    avisos = [];
  let identificacao = 0,
    bloqueios = 0,
    cardapios = 0,
    aposLerConta;
  const ref = (colecao, id) => ({
    get: async () => {
      if (colecao === "clientes") aposLerConta?.();
      const path = colecao + "/" + id;
      return { id, exists: docs.has(path), data: () => docs.get(path) };
    },
  });
  const ctx = vm.createContext({
    console: { ...console, warn() {} },
    Date,
    URL,
    CHAVE_SESSAO_AUTOATENDIMENTO: "sessaoAutoatendimentoId",
    mesaAutoatendimentoId: null,
    mesaAutoatendimentoAtual: null,
    sessaoAutoatendimentoAtual: null,
    document: {
      getElementById: (id) => (id === "area-autoatendimento" ? { innerHTML: "" } : null),
    },
    localStorage: {
      getItem: (k) => memoria.get(k) || null,
      setItem: (k, v) => memoria.set(k, v),
    },
    addEventListener() {},
    alert: (m) => avisos.push(m),
    htmlCarregandoUI: () => "Carregando",
    lerComPrazoUI: (p) => p,
    obterNumeroMesaDaUrl: () => numero,
    obterJanelaDiaOperacional: () => ({ inicioMs: Date.now() - 10000, fimMs: Date.now() + 10000 }),
    mostrarIdentificacaoAutoatendimento: () => identificacao++,
    mostrarMesaBloqueadaAutoatendimento: () => bloqueios++,
    mostrarSessaoAutoatendimento: async () => cardapios++,
    db: {
      collection: (colecao) => ({
        doc: (id) => ref(colecao, id),
        where: () => ({
          limit: () => ({
            get: async () => ({ docs: [await ref("mesas", "mesa" + numero).get()] }),
          }),
        }),
        add: async (dados) => {
          escritas.push({ colecao, dados });
          return { id: "nova-sessao" };
        },
      }),
    },
  });
  ctx.window = ctx;
  vm.runInContext(fs.readFileSync("js/auto-sessao-ui.js", "utf8"), ctx);
  for (const nome of [
    "iniciarAutoatendimento",
    "recuperarSessaoAutoatendimento",
    "criarSessaoAutoatendimento",
  ])
    carregar(ctx, nome);
  return {
    ctx,
    docs,
    memoria,
    escritas,
    avisos,
    estado: () => ({ identificacao, bloqueios, cardapios }),
    aposLerConta: (fn) => {
      aposLerConta = fn;
    },
  };
}
(async () => {
  const a = ambiente();
  await a.ctx.iniciarAutoatendimento();
  assert.equal(a.estado().cardapios, 1, "Conta lembrada entra direto no cardápio");
  assert.equal(a.estado().identificacao, 0, "Sem repetir nome ou login");
  assert.equal(a.escritas.length, 1);
  assert.equal(a.escritas[0].colecao, "sessoesMesa", "Não cria pedido nem altera cliente");
  const sessao = a.escritas[0].dados;
  assert.equal(sessao.mesaId, "mesa6", "Usa a nova mesa do QR");
  assert.equal(sessao.clienteId, "65999999999");
  assert.equal(sessao.clienteLogado, true);
  assert.equal(sessao.clienteAvatar, "images/avatares/prata/maionese.webp");
  assert.equal(sessao.comandaId, null);
  assert.equal(sessao.pedidoEnviado, false);
  assert.equal(a.memoria.get("sessaoAutoatendimentoId:mesa2"), "visita-anterior");
  assert.equal(a.memoria.get("sessaoAutoatendimentoId:mesa6"), "nova-sessao");
  assert.equal(
    a.docs.get("clientes/65999999999").fidelidadeAtiva,
    false,
    "Não ativa CDA ao lembrar conta",
  );

  for (const opcoes of [{ lembrar: false }, { conta: false }]) {
    const b = ambiente(opcoes);
    await b.ctx.iniciarAutoatendimento();
    assert.equal(b.estado().identificacao, 1);
    assert.equal(b.escritas.length, 0);
  }
  const invalido = ambiente();
  invalido.memoria.set("clientePedrao", "{json inválido");
  await invalido.ctx.iniciarAutoatendimento();
  assert.equal(invalido.estado().identificacao, 1);
  const mudouNome = ambiente();
  mudouNome.docs.get("clientes/65999999999").nome = "Outra pessoa";
  await mudouNome.ctx.iniciarAutoatendimento();
  assert.equal(mudouNome.estado().identificacao, 1, "Conta desatualizada pede login");
  const offline = ambiente();
  offline.aposLerConta(() => {
    throw Error("offline");
  });
  await offline.ctx.iniciarAutoatendimento();
  assert.equal(offline.estado().identificacao, 1);
  assert(offline.memoria.has("clientePedrao"), "Falha temporária preserva conta salva");

  const ocupada = ambiente({ ocupada: true });
  await ocupada.ctx.iniciarAutoatendimento();
  assert.equal(ocupada.estado().bloqueios, 1);
  assert.equal(ocupada.escritas.length, 0, "Conta lembrada não entra na mesa de outra pessoa");
  const corrida = ambiente();
  corrida.aposLerConta(() => (corrida.docs.get("mesas/mesa6").ocupada = true));
  await corrida.ctx.iniciarAutoatendimento();
  assert.equal(corrida.estado().bloqueios, 1, "Confere mesa novamente antes de criar sessão");
  assert.equal(corrida.escritas.length, 0);

  const ativa = ambiente();
  ativa.docs.set("sessoesMesa/s6", {
    mesaId: "mesa6",
    status: "ativa",
    criadoEmMs: Date.now(),
    clienteLogado: false,
  });
  ativa.memoria.set("sessaoAutoatendimentoId:mesa6", "s6");
  await ativa.ctx.iniciarAutoatendimento();
  assert.equal(ativa.ctx.sessaoAutoatendimentoAtual.id, "s6");
  assert.equal(ativa.escritas.length, 0, "Retomar visita não cria outra sessão nem desfaz logout");
  console.log(
    "PASS: conta lembrada inicia nova mesa logada; visitante, conta inválida/offline, mesa ocupada, corrida e retomada preservados.",
  );
})().catch((erro) => {
  console.error(erro);
  process.exitCode = 1;
});
