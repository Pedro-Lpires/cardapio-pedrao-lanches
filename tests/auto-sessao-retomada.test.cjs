const fs = require("node:fs"),
  vm = require("node:vm"),
  assert = require("node:assert/strict");
const dados = new Map(),
  memoria = new Map(),
  ouvintes = new Map(),
  eventos = new Map(),
  timers = new Map();
let falhar = false,
  urlAtual = "https://loja.exemplo/autoatendimento.html?mesa=2",
  gravacoes = 0;
const area = { innerHTML: "" };
const snap = (path) => ({
  id: path.split("/").at(-1),
  exists: dados.has(path),
  data: () => dados.get(path),
  ref: ref(path),
});
const ref = (path) => ({
  get: async () => {
    if (falhar) throw Error("offline");
    return snap(path);
  },
  update: async (p) => {
    dados.set(path, { ...dados.get(path), ...p });
    gravacoes++;
  },
  onSnapshot: (fn) => {
    ouvintes.set(path, fn);
    return () => ouvintes.delete(path);
  },
});
const c = vm.createContext({
  console,
  URL,
  Date,
  CHAVE_SESSAO_AUTOATENDIMENTO: "sessaoAutoatendimentoId",
  mesaAutoatendimentoId: "mesa2",
  sessaoAutoatendimentoAtual: null,
  mesaAutoatendimentoAtual: { numero: 2 },
  carrinhoAutoatendimento: [{}],
  document: { getElementById: () => area },
  location: { href: urlAtual },
  history: {
    replaceState: (_, __, u) => {
      urlAtual = u;
    },
  },
  addEventListener: (tipo, fn) => eventos.set(tipo, fn),
  setTimeout: (fn) => {
    timers.set(1, fn);
    return 1;
  },
  clearTimeout: (id) => timers.delete(id),
  alert() {},
  obterJanelaDiaOperacional: () => ({ inicioMs: 100, fimMs: 1000 }),
  db: { collection: (n) => ({ doc: (id) => ref(n + "/" + id) }) },
  localStorage: {
    getItem: (k) => memoria.get(k) || null,
    setItem: (k, v) => memoria.set(k, v),
    removeItem: (k) => memoria.delete(k),
  },
});
c.window = c;
vm.runInContext(fs.readFileSync("js/auto-sessao-ui.js", "utf8"), c);
function preparar() {
  c.pararAcompanhamentoSessaoAutoUI();
  dados.clear();
  memoria.clear();
  falhar = false;
  gravacoes = 0;
  dados.set("sessoesMesa/s2", {
    mesaId: "mesa2",
    mesaNumero: 2,
    status: "ativa",
    pedidoEnviado: true,
    comandaId: "c2",
    criadoEmMs: 10,
  });
  dados.set("sessoesMesa/s3", {
    mesaId: "mesa3",
    status: "ativa",
    pedidoEnviado: true,
    comandaId: "c3",
    criadoEmMs: 10,
  });
  dados.set("comandas/c2", { status: "Aberta", sessaoAutoatendimentoId: "s2" });
  dados.set("mesas/mesa2", { ocupada: true });
  memoria.set("sessaoAutoatendimentoId:mesa2", "s2");
  memoria.set("sessaoAutoatendimentoId:mesa3", "s3");
  memoria.set("sessaoAutoatendimentoId", "s3");
  c.sessaoAutoatendimentoAtual = { id: "s2", ...dados.get("sessoesMesa/s2") };
}
(async () => {
  preparar();
  const retomada = await c.recuperarSessaoDaMesaAutoUI();
  assert.equal(retomada.id, "s2", "Retoma esta mesa mesmo depois de acessar outra");
  assert.equal(retomada.pedidoEnviado, true);
  assert.equal(gravacoes, 0, "Recarregar não cria nem reenvia pedido");
  assert.equal(memoria.get("sessaoAutoatendimentoId:mesa3"), "s3");
  memoria.delete("sessaoAutoatendimentoId:mesa2");
  memoria.set("sessaoAutoatendimentoId", "s2");
  assert.equal((await c.recuperarSessaoDaMesaAutoUI()).id, "s2", "Migra a identificação antiga");
  assert.equal(memoria.get("sessaoAutoatendimentoId:mesa2"), "s2");
  preparar();
  memoria.delete("sessaoAutoatendimentoId:mesa2");
  assert.equal(await c.recuperarSessaoDaMesaAutoUI(), null, "Não pega a sessão de outra mesa");
  preparar();
  memoria.clear();
  assert.equal(
    await c.recuperarSessaoDaMesaAutoUI(),
    null,
    "Outro aparelho não descobre a sessão de uma mesa ocupada",
  );
  for (const estado of ["Fechada", "Cancelada", "excluida", "livre", "outra-sessao"]) {
    preparar();
    if (estado === "excluida") dados.delete("comandas/c2");
    else if (estado === "livre") dados.set("mesas/mesa2", { ocupada: false });
    else if (estado === "outra-sessao")
      dados.set("comandas/c2", { status: "Aberta", sessaoAutoatendimentoId: "outra" });
    else dados.set("comandas/c2", { status: estado });
    assert.equal((await c.recuperarSessaoDaMesaAutoUI()).sessaoEncerrada, true, estado);
    assert.equal(memoria.has("sessaoAutoatendimentoId:mesa2"), false);
    assert.equal(memoria.get("sessaoAutoatendimentoId:mesa3"), "s3");
  }
  preparar();
  falhar = true;
  await assert.rejects(c.recuperarSessaoDaMesaAutoUI(), /offline/);
  assert.equal(
    memoria.get("sessaoAutoatendimentoId:mesa2"),
    "s2",
    "Falha temporária não perde o atendimento",
  );
  falhar = false;
  assert.equal((await c.recuperarSessaoDaMesaAutoUI()).id, "s2");
  preparar();
  dados.get("sessoesMesa/s2").pedidoEnviado = false;
  const expirado = await c.recuperarSessaoDaMesaAutoUI();
  assert.equal(expirado.rascunhoExpirado, true);
  let reinicios = 0;
  c.iniciarAutoatendimento = async () => reinicios++;
  c.sessaoAutoatendimentoAtual = { id: "s2", pedidoEnviado: false, criadoEmMs: 10 };
  await eventos.get("pageshow")();
  // O evento inicia a conferência assíncrona.
  await Promise.resolve();
  assert.equal(reinicios, 1, "Voltar à aba antiga confere o dia antes de retomar o cardápio");
  memoria.set("clientePedrao", "conta-lembrada");
  c.limparRascunhoAntigoAutoUI();
  assert.equal(c.sessaoAutoatendimentoAtual, null);
  assert.equal(c.carrinhoAutoatendimento.length, 0);
  assert.equal(memoria.get("clientePedrao"), "conta-lembrada");
  c.sessaoAutoatendimentoAtual = { pedidoEnviado: false, criadoEmMs: 500 };
  await c.conferirValidadeRascunhoAutoUI();
  assert.equal(reinicios, 1, "Visita do mesmo dia continua no cardápio");
  assert.equal(timers.size, 1, "Aba aberta agenda a conferência na virada");
  c.sessaoAutoatendimentoAtual = { pedidoEnviado: true, criadoEmMs: 10 };
  c.agendarExpiracaoRascunhoAutoUI();
  assert.equal(timers.size, 0, "Pedido enviado depende da comanda aberta");
  preparar();
  c.acompanharSessaoEnviadaAutoUI();
  assert.equal(ouvintes.size, 2);
  c.acompanharSessaoEnviadaAutoUI();
  assert.equal(ouvintes.size, 2, "Sem duplicar assinaturas");
  dados.set("comandas/c2", { status: "Fechada" });
  ouvintes.get("comandas/c2")(snap("comandas/c2"));
  assert.equal(c.sessaoAutoatendimentoAtual, null);
  assert.equal(ouvintes.size, 0);
  assert.equal(new URL(urlAtual).searchParams.has("mesa"), false);
  assert.match(area.innerHTML, /Atendimento encerrado/);
  assert(!area.innerHTML.includes("pedirContaAuto"));
  assert.equal(
    await c.validarAcaoSessaoEnviadaAutoUI(),
    false,
    "Aba antiga não cria chamados após encerrar",
  );
  const fonteAuto = fs.readFileSync("js/autoatendimento.js", "utf8");
  let em = Date.parse("2026-11-11T05:59:59Z");
  class Relogio extends Date {
    static now() {
      return em;
    }
  }
  const horario = vm.createContext({ Date: Relogio, Intl });
  vm.runInContext(
    fonteAuto.slice(
      fonteAuto.indexOf("function obterJanelaDiaOperacional("),
      fonteAuto.indexOf("function obterNumeroMesaDaUrl("),
    ),
    horario,
  );
  assert.equal(horario.obterJanelaDiaOperacional().inicioMs, Date.parse("2026-11-10T06:00:00Z"));
  em += 1000;
  assert.equal(horario.obterJanelaDiaOperacional().inicioMs, Date.parse("2026-11-11T06:00:00Z"));
  console.log(
    "PASS: retoma por mesa sem reenviar; legado, outra mesa/aparelho, falha temporária, fechamento/cancelamento, mesa livre, assinaturas e aba antiga bloqueada.",
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
