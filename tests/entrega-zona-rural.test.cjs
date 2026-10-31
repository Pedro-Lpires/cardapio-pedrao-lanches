const fs = require("node:fs"),
  vm = require("node:vm"),
  assert = require("node:assert/strict");
const fonte = fs.readFileSync("js/script.js", "utf8");
function carregar(ctx, nome, texto = fonte) {
  const padrao = new RegExp("(?:async )?function " + nome + "\\(");
  const inicio = texto.search(padrao);
  assert(inicio >= 0, nome);
  const fim = texto.slice(inicio + 1).search(/\n(?:async )?function /);
  vm.runInContext(texto.slice(inicio, fim < 0 ? undefined : inicio + 1 + fim), ctx);
}
function contexto() {
  const campos = {};
  const campo = (id) => (campos[id] ||= { value: "", style: {}, focus() {}, remove() {} });
  campo("nome-cliente").value = "Cliente Exemplo";
  campo("telefone-cliente").value = "65999999999";
  campo("condominio").value = "Não";
  campo("cnh").value = "Não";
  campo("endereco-escrito").value = "Rua Exemplo, 100 - Bairro Exemplo";
  const avisos = [],
    salvos = [],
    urls = [],
    revisoes = [];
  let perguntas = 0,
    gps = 0,
    tipo = "Entrega",
    area = "urbana",
    km = 12;
  class DataExemplo extends Date {
    constructor(...args) {
      super(...(args.length ? args : ["2026-10-28T20:00:00-04:00"]));
    }
    toLocaleString() {
      return "28/10/2026, 20:00:00";
    }
  }
  const ctx = vm.createContext({
    console,
    Date: DataExemplo,
    feriados: [],
    document: {
      getElementById: campo,
      querySelector: () => ({ value: tipo }),
      querySelectorAll: () => [{ value: "Pix" }],
    },
    navigator: {
      geolocation: {
        getCurrentPosition(ok) {
          gps++;
          ok({ coords: { latitude: -15.66, longitude: -56.05 } });
        },
      },
    },
    LAT_ESTABELECIMENTO: -15.55,
    LON_ESTABELECIMENTO: -56.05,
    calcularDistancia: () => km,
    perguntarZonaRuralUI: async () => {
      perguntas++;
      return area;
    },
    pedirPermissaoLocalizacaoUI: async () =>
      assert.fail("A explicação do GPS já está na pergunta do asfalto"),
    alert: (mensagem, personagem) => avisos.push({ mensagem, personagem }),
    exibirRevisao: (...args) => revisoes.push(args),
    calcularTotalMolhosPagos: () => 0,
    salvarPedidoFirebase: async (pedido) => {
      salvos.push(pedido);
      return 1;
    },
    atualizarCarrinho() {},
    fecharModalCheck() {},
    fecharCheckoutUI() {},
    window: { open: (url) => urls.push(url) },
    clienteLogado: null,
    cupomDescontoAplicado: null,
    descontoCupom: 0,
    descontoFidelidade: 0,
    carrinhoVersao: 1,
    revisaoCarrinhoVersao: 1,
    carrinho: [
      {
        nome: "X-Bagunça",
        qtd: 1,
        preco: 30,
        desc: "Lanche",
        obs: "Sem cebola",
        adicionais: [],
        molhosGratis: [],
        molhosPagos: [],
      },
    ],
    dadosPedidoTemporario: {
      tipo: "Entrega",
      subtotal: 30,
      taxa: 24,
      km: 12,
      obs: "Caprichar na chapa",
      mapa: "https://www.google.com/maps?q=-15.66,-56.05",
      areaUrbanaConfirmada: true,
    },
  });
  carregar(ctx, "montarMensagemPedidoWhatsUI", fs.readFileSync("js/ui-comum.js", "utf8"));
  for (const nome of [
    "calcularTaxaEntregaSiteUI",
    "finalizarPedido",
    "arredondarPagamento",
    "confirmarEEnviar",
  ])
    carregar(ctx, nome);
  carregar(ctx, "textoWhatsAppSemEmojisUI", fs.readFileSync("js/ui-comum.js", "utf8"));
  return {
    ctx,
    campo,
    avisos,
    salvos,
    urls,
    revisoes,
    get perguntas() {
      return perguntas;
    },
    get gps() {
      return gps;
    },
    definir(dados) {
      if (dados.tipo) tipo = dados.tipo;
      if (dados.area) area = dados.area;
      if (dados.km !== undefined) km = dados.km;
    },
  };
}
async function exemplosWhatsApp() {
  const mensagens = {};
  for (const tipo of ["Entrega", "Retirada"]) {
    const t = contexto();
    t.ctx.dadosPedidoTemporario.tipo = tipo;
    if (tipo === "Retirada")
      Object.assign(t.ctx.dadosPedidoTemporario, { taxa: 0, km: 0, mapa: "" });
    await t.ctx.confirmarEEnviar();
    assert.equal(t.urls.length, 1);
    mensagens[tipo] = new URL(t.urls[0]).searchParams.get("text");
  }
  const t = contexto();
  t.ctx.moedaOperacao = (valor) => "R$ " + valor.toFixed(2).replace(".", ",");
  carregar(t.ctx, "montarConsumoLocalUI", fs.readFileSync("js/fluxos-interface.js", "utf8"));
  mensagens.Local = t.ctx.montarConsumoLocalUI(
    t.ctx.carrinho,
    "Cliente Exemplo",
    "65999999999",
    null,
    "Mesa perto da janela",
  ).mensagem;
  return mensagens;
}
async function testar() {
  const t = contexto(),
    taxa = t.ctx.calcularTaxaEntregaSiteUI;
  const quarta = new Date(2026, 9, 28, 20),
    sabado = new Date(2026, 9, 31, 20),
    domingo = new Date(2026, 10, 1, 20);
  for (const [km, valor] of [
    [2, 6],
    [3, 7],
    [4, 8],
    [5, 10],
    [6, 11],
    [7, 13],
    [8, 14],
    [9, 15],
    [10, 16],
    [10.01, 20.02],
    [10.5, 21],
    [11, 22],
    [12, 24],
    [15.25, 30.5],
  ])
    assert.equal(taxa(km, quarta), valor);
  assert.equal(taxa(12, sabado), 25);
  assert.equal(taxa(12, domingo), 25);
  t.ctx.feriados.push("28/10");
  assert.equal(taxa(12, quarta), 25);
  t.ctx.feriados.length = 0;
  for (const [area, km] of [
    ["rural", 2],
    ["rural", 18],
    ["cancelado", 12],
  ]) {
    const r = contexto();
    r.definir({ area, km });
    await r.ctx.finalizarPedido();
    assert.equal(r.gps, 0);
    assert.equal(r.revisoes.length, 0);
    assert.equal(r.salvos.length, 0);
    assert.equal(r.ctx.revisaoCarrinhoVersao, -1, "Uma revisão antiga não autoriza outra entrega");
    if (area === "rural") assert.match(r.avisos.at(-1).mensagem, /critérios da empresa/);
  }
  const r = contexto();
  await r.ctx.finalizarPedido();
  assert.equal(r.gps, 1);
  assert.equal(r.revisoes[0][2], 24);
  assert.equal(r.revisoes[0][8], true);
  assert(r.avisos.some((a) => a.personagem === "entregaDistante"));
  const perto = contexto();
  perto.definir({ km: 10 });
  await perto.ctx.finalizarPedido();
  assert(!perto.avisos.some((a) => a.personagem === "entregaDistante"));
  const longe = contexto();
  longe.definir({ km: 22 });
  await longe.ctx.finalizarPedido();
  assert.equal(longe.avisos.length, 1, "Acima de 15 km gera um único popup");
  assert.equal(longe.avisos[0].personagem, "entregaDistante");
  assert.match(longe.avisos[0].mensagem, /fora da área de entrega/);
  assert.match(longe.avisos[0].mensagem, /demora/);
  assert(!longe.avisos[0].mensagem.includes("R$"), "O popup não repete o preço por km");
  assert.equal(longe.revisoes[0][7], true, "Mantém a marcação de fora da área");
  for (const tipo of ["Retirada", "Local"]) {
    const n = contexto();
    n.definir({ tipo });
    await n.ctx.finalizarPedido();
    assert.equal(n.perguntas, 0);
    assert.equal(n.gps, 0);
    assert.equal(n.revisoes[0][2], 0);
  }
  const semConfirmacao = contexto();
  semConfirmacao.ctx.dadosPedidoTemporario.areaUrbanaConfirmada = false;
  await semConfirmacao.ctx.confirmarEEnviar();
  assert.equal(semConfirmacao.salvos.length, 0);
  assert.equal(semConfirmacao.urls.length, 0);
  const mensagens = await exemplosWhatsApp();
  assert.match(mensagens.Entrega, /Taxa de entrega: R\$.*24,00/);
  assert.match(mensagens.Entrega, /Acessível: Sim/);
  assert.match(mensagens.Entrega, /Pode haver demora/);
  assert(!mensagens.Retirada.includes("Acesso:"));
  assert(!mensagens.Retirada.includes("possível demora"));
  assert(!mensagens.Local.includes("Taxa:"));
  for (const mensagem of Object.values(mensagens))
    assert(!/\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(mensagem));
  const limpar = t.ctx.textoWhatsAppSemEmojisUI;
  assert.equal(
    limpar("🍔 *Observação:* caprichar 😋\n💵 R$ 24,00\n📍 https://maps.google.com/?q=-15,-56"),
    "*Observação:* caprichar\n R$ 24,00\n https://maps.google.com/?q=-15,-56",
  );
  console.log(
    "PASS: zona rural/cancelar não calcula nem envia; área urbana obrigatória, taxa por toda a distância acima de 10 km, adicionais e aviso de demora; WhatsApp nas três modalidades.",
  );
}
module.exports = { exemplosWhatsApp };
if (require.main === module)
  testar().catch((erro) => {
    console.error(erro);
    process.exitCode = 1;
  });
