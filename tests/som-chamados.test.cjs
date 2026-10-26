const fs = require("node:fs"),
  vm = require("node:vm"),
  assert = require("node:assert/strict");
const elementos = Object.fromEntries(
  ["btn-som-chamados", "estado-som-chamados", "ultimo-chamado-sonoro"].map((id) => [
    id,
    {
      innerHTML: "<svg>sino</svg>",
      textContent: "",
      disabled: false,
      setAttribute(k, v) {
        this[k] = v;
      },
    },
  ]),
);
const preferencias = new Map([["pedrao-som-chamados", "ativado"]]);
const notas = [],
  contextos = [],
  eventos = {},
  previas = [{}, {}, {}];
let bloquear = false;
class AudioMock {
  constructor() {
    this.state = "suspended";
    this.currentTime = 10;
    this.destination = {};
    contextos.push(this);
  }
  async resume() {
    if (bloquear) throw Error("Áudio bloqueado pelo navegador");
    this.state = "running";
  }
  async close() {
    this.state = "closed";
  }
  createOscillator() {
    const nota = {};
    notas.push(nota);
    return {
      frequency: {
        setValueAtTime(f, t) {
          nota.frequencia = f;
          nota.inicio = t;
        },
        exponentialRampToValueAtTime(f) {
          nota.desliza = f;
        },
      },
      connect() {},
      disconnect() {},
      start(t) {
        nota.start = t;
      },
      stop(t) {
        if (t === undefined) nota.interrompida = true;
        else nota.stop = t;
      },
    };
  }
  createGain() {
    return {
      gain: {
        setValueAtTime() {},
        linearRampToValueAtTime() {},
        exponentialRampToValueAtTime() {},
      },
      connect() {},
      disconnect() {},
    };
  }
}
const ctx = vm.createContext({
  console,
  Set,
  Map,
  document: {
    title: "Painel Atendente",
    hidden: false,
    getElementById: (id) => elementos[id] || null,
    querySelectorAll: () => previas,
    addEventListener: (nome, fn) => {
      eventos[nome] = fn;
    },
  },
  window: {
    AudioContext: AudioMock,
    addEventListener: (nome, fn) => {
      eventos[nome] = fn;
    },
  },
  localStorage: { getItem: (k) => preferencias.get(k), setItem: (k, v) => preferencias.set(k, v) },
});
vm.runInContext(fs.readFileSync("js/som-chamados.js", "utf8"), ctx);
const estado = () => vm.runInContext("somChamadosAtendenteUI", ctx);
const normal = { id: "a", tipo: "atendente", mesaNumero: 2, criadoEmMs: 20 };
const conta = { id: "b", tipo: "conta", mesaNumero: 6, criadoEmMs: 30 };
(async () => {
  if (eventos.click) await eventos.click({ target: { closest: () => null } });
  assert.equal(contextos.length, 0, "Preferência antiga e clique fora do sino não ativam áudio");
  await ctx.ouvirToqueChamadosUI("gotas");
  assert.equal(notas.length, 3);
  assert(
    notas.every((n) => n.desliza),
    "Gotas tem transição de frequência",
  );
  assert.equal(estado().ligado, false, "Prévia não ativa os avisos");
  ctx.processarSomChamadosAtendenteUI([normal], 1);
  ctx.processarSomChamadosAtendenteUI([normal, conta], 1);
  assert.equal(notas.length, 3, "Receber chamados depois da prévia continua silencioso");
  ctx.selecionarToqueChamadosUI("cristal");
  assert.equal(notas.length, 3, "Escolher também não liga o som");
  assert.equal(estado().ligado, false);
  assert.equal(preferencias.get("pedrao-toque-chamados"), "cristal");
  assert.equal(ctx.lerToqueChamadosUI(), "cristal");
  await ctx.ouvirToqueChamadosUI("cristal");
  assert.equal(notas.length, 9);
  const cristal = notas.slice(3).map((n) => n.frequencia);
  ctx.selecionarToqueChamadosUI("campainha");
  let confirmacoes = 0;
  ctx.abrirAtivacaoSomChamadosUI = () => confirmacoes++;
  ctx.alternarSomChamadosAtendenteUI();
  assert.equal(confirmacoes, 1, "Sino abre a escolha Sim/Não antes de ativar");
  assert.equal(estado().ligado, false, "Abrir ou cancelar a confirmação não ativa áudio");
  assert.equal(notas.length, 9);
  await ctx.ativarSomChamadosAtendenteUI();
  assert.equal(notas.length, 15, "O sino liga e confirma com duas notas de sino e harmônicos");
  assert.notDeepEqual(
    notas.slice(9).map((n) => n.frequencia),
    cristal,
  );
  assert.equal(elementos["btn-som-chamados"]["aria-pressed"], "true");
  assert.equal(elementos["btn-som-chamados"].innerHTML, "<svg>sino</svg>");
  contextos[0].state = "suspended";
  contextos[0].onstatechange();
  assert.equal(elementos["btn-som-chamados"]["aria-pressed"], "false");
  assert.match(elementos["estado-som-chamados"].textContent, /pausou/);
  assert.equal(contextos[0].state, "suspended", "Pausa do navegador não é contornada");
  contextos[0].state = "running";
  contextos[0].onstatechange();
  ctx.document.hidden = true;
  ctx.processarSomChamadosAtendenteUI([normal, conta, { ...normal, id: "c" }], 1);
  assert.equal(notas.length, 21, "Chamado normal soa com a aba oculta");
  const novaConta = { ...conta, id: "d" };
  ctx.processarSomChamadosAtendenteUI([normal, conta, novaConta], 1);
  assert.equal(notas.length, 30, "Pedido de conta usa três notas com harmônicos");
  assert.match(elementos["ultimo-chamado-sonoro"].textContent, /Mesa 6: pediu a conta/);
  assert.match(ctx.document.title, /3 chamados/);
  ctx.processarSomChamadosAtendenteUI([normal, conta, novaConta], 1);
  ctx.processarSomChamadosAtendenteUI([], 1);
  ctx.processarSomChamadosAtendenteUI([normal, conta, novaConta], 1);
  assert.equal(notas.length, 30, "Reconexão e remarcação não repetem sons");
  ctx.alternarSomChamadosAtendenteUI();
  assert.equal(contextos[0].state, "closed");
  assert.equal(elementos["btn-som-chamados"]["aria-pressed"], "false");
  ctx.processarSomChamadosAtendenteUI([{ ...normal, id: "e" }], 1);
  assert.equal(notas.length, 30);
  ctx.alternarSomChamadosAtendenteUI();
  assert.equal(confirmacoes, 2);
  assert.equal(notas.length, 30);
  await ctx.ativarSomChamadosAtendenteUI();
  assert.equal(notas.length, 36);
  ctx.processarSomChamadosAtendenteUI([{ ...normal, id: "novo-dia" }], 2);
  assert.equal(notas.length, 42, "Não perde o primeiro chamado da nova jornada");
  for (const nota of notas) {
    assert.equal(nota.start, nota.inicio);
    assert(nota.stop > nota.start);
  }
  eventos.pagehide();
  assert.equal(contextos[1].state, "closed");
  assert.equal(ctx.document.title, "Painel Atendente");
  bloquear = true;
  await ctx.ativarSomChamadosAtendenteUI();
  assert.match(elementos["estado-som-chamados"].textContent, /bloqueado/);
  assert.equal(elementos["btn-som-chamados"].disabled, false);
  assert.equal(estado().ligado, false);
  assert.match(estado().erro, /configurações do navegador/);
  const status = elementos["estado-som-chamados"];
  delete elementos["estado-som-chamados"];
  await ctx.ativarSomChamadosAtendenteUI();
  assert.equal(estado().ligado, false, "Falha sem painel aberto continua recuperável");
  elementos["estado-som-chamados"] = status;
  const fonte = fs.readFileSync("js/atendente.js", "utf8");
  vm.runInContext(
    fonte.slice(
      fonte.indexOf("function iniciarListenerChamadosMesaAtendente("),
      fonte.indexOf("function atualizarContadorChamadosMesa("),
    ),
    ctx,
  );
  let assinatura,
    assinaturas = 0,
    paradas = 0;
  ctx.listenerChamadosMesaAtendente = null;
  ctx.obterJanelaAtualPedidosAtendente = () => ({ inicioMs: 100, fimMs: 1000 });
  ctx.atualizarContadorChamadosMesa = () => {};
  ctx.db = {
    collection: (nome) => {
      assert.equal(nome, "chamadosMesa");
      return {
        where: (campo, op, valor) => {
          assert.equal(campo, "status");
          assert.equal(valor, "aberto");
          return {
            onSnapshot: (fn) => {
              assinaturas++;
              assinatura = fn;
              return () => paradas++;
            },
          };
        },
      };
    },
  };
  ctx.iniciarListenerChamadosMesaAtendente();
  assinatura({
    forEach: (fn) =>
      [
        { ...normal, id: "antigo", criadoEmMs: 90 },
        { ...conta, id: "ao-vivo", criadoEmMs: 200 },
        { ...normal, id: "futuro", criadoEmMs: 1000 },
      ].forEach((d) => fn({ id: d.id, data: () => d })),
  });
  assert.equal(ctx.chamadosMesaAbertosAtendente.length, 1);
  assert.match(elementos["ultimo-chamado-sonoro"].textContent, /pediu a conta/);
  ctx.informarFalhaChamadosAtendenteUI();
  assert.match(elementos["estado-som-chamados"].textContent, /interrompida/);
  ctx.iniciarListenerChamadosMesaAtendente();
  assert.equal(assinaturas, 2);
  assert.equal(paradas, 1);
  console.log(
    "PASS: sino pede Sim/Não, pausa e bloqueio visíveis, três sons distintos, prévia independente, escolha salva, chamados ocultos, deduplicação e listener único.",
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
