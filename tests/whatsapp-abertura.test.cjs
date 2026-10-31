const fs = require("node:fs"),
  vm = require("node:vm"),
  assert = require("node:assert/strict");
let init,
  terminar,
  chamadas = 0;
const abertos = [];
const ctx = vm.createContext({
  navigator: { userAgent: "Windows" },
  document: { addEventListener: (n, f) => (init = f) },
  window: {
    open: (...a) => abertos.push(a),
    confirmarEEnviar: async () => {
      chamadas++;
      await new Promise((r) => (terminar = r));
    },
  },
  textoWhatsAppSemEmojisUI: (t) => String(t),
});
vm.runInContext(fs.readFileSync("js/whatsapp-pedido-ui.js", "utf8"), ctx);
(async () => {
  const mensagem =
    "Entrega acima de 15 km\nLocal: https://www.google.com/maps?q=-15.75,-56.10\nA&B + 20%";
  for (const desktop of [true, false]) {
    const u = new URL(ctx.urlWhatsAppPedidoUI(mensagem, desktop));
    assert.equal(u.searchParams.get("text"), mensagem);
    assert.equal(u.hostname, desktop ? "web.whatsapp.com" : "wa.me");
  }
  ctx.abrirMensagemWhatsPedidoUI(mensagem);
  assert.equal(abertos.length, 1);
  assert.equal(new URL(abertos[0][0]).searchParams.get("text"), mensagem);
  init();
  const p = ctx.window.confirmarEEnviar();
  await ctx.window.confirmarEEnviar();
  assert.equal(chamadas, 1, "Duplo clique não grava pedido duas vezes");
  terminar();
  await p;
  console.log(
    "PASS: WhatsApp preserva mensagem, GPS, caracteres e destino; abertura única e trava de duplo clique.",
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
