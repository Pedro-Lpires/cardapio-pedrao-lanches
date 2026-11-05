const fs = require("node:fs"),
  vm = require("node:vm"),
  assert = require("node:assert/strict");
function fixture({ bloqueado = false, pagamento = true } = {}) {
  let init,
    concluir,
    falhar,
    envios = 0,
    ativos = 0,
    aberturas = 0,
    fechamentos = 0;
  const destinos = [],
    elementos = new Map();
  const popup = {
    closed: false,
    document: { createElement: () => ({}), head: { append() {} }, body: {} },
    location: { replace: (url) => destinos.push(url) },
    close() {
      fechamentos++;
      this.closed = true;
    },
  };
  const box = {
    set innerHTML(v) {},
    querySelector(s) {
      if (!elementos.has(s)) elementos.set(s, {});
      return elementos.get(s);
    },
  };
  const ctx = vm.createContext({
    navigator: { userAgent: "Android" },
    document: {
      addEventListener: (n, f) => (init = f),
      querySelector: () => (pagamento ? {} : null),
    },
    iniciarCarregamentoUI() {
      ativos++;
      return () => ativos--;
    },
    mostrarAvisoUI() {},
    textoWhatsAppSemEmojisUI: (s) => s,
    janelaEditorUI: () => ({ querySelector: () => box }),
    window: {
      open() {
        aberturas++;
        return bloqueado ? null : popup;
      },
      confirmarEEnviar: async () => {
        if (!pagamento) return;
        envios++;
        await new Promise((r, j) => {
          concluir = r;
          falhar = j;
        });
        ctx.abrirMensagemWhatsPedidoUI("Entrega\nMensagem pronta");
      },
    },
  });
  vm.runInContext(fs.readFileSync("js/whatsapp-pedido-ui.js", "utf8"), ctx);
  init();
  return {
    ctx,
    concluir: () => concluir(),
    falhar: () => falhar(Error("rede")),
    destinos,
    elementos,
    estado: () => ({ envios, ativos, aberturas, fechamentos }),
  };
}
(async () => {
  let f = fixture();
  const p = f.ctx.window.confirmarEEnviar();
  assert.equal(f.estado().aberturas, 1, "Janela reservada no toque, antes de aguardar servidor");
  assert.equal(f.estado().ativos, 1);
  await f.ctx.window.confirmarEEnviar();
  assert.equal(f.estado().envios, 1);
  f.concluir();
  await p;
  assert.equal(f.estado().ativos, 0);
  assert.equal(f.estado().fechamentos, 0);
  assert.equal(new URL(f.destinos[0]).searchParams.get("text"), "Entrega\nMensagem pronta");
  assert.equal(
    new URL(f.elementos.get("[data-enviar]").href).searchParams.get("text"),
    "Entrega\nMensagem pronta",
  );
  f = fixture({ bloqueado: true });
  const q = f.ctx.window.confirmarEEnviar();
  f.concluir();
  await q;
  assert.equal(f.estado().envios, 1);
  assert(
    f.elementos.get("[data-enviar]").href,
    "Bloqueio de popup preserva link com a mensagem completa",
  );
  f = fixture();
  const erro = f.ctx.window.confirmarEEnviar();
  f.falhar();
  await erro;
  assert.equal(f.estado().ativos, 0);
  assert.equal(f.estado().fechamentos, 1);
  f = fixture({ pagamento: false });
  await f.ctx.window.confirmarEEnviar();
  assert.deepEqual(f.estado(), { envios: 0, ativos: 0, aberturas: 0, fechamentos: 0 });
  console.log(
    "PASS: reserva durante toque, carregamento/deduplicação, mensagem pronta após await, popup bloqueado, falha libera tela e pagamento ausente não abre WhatsApp.",
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
