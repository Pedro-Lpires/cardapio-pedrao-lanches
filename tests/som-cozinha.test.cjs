const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  vm = require("node:vm");
let toques = 0;
const ctx = vm.createContext({
  console,
  somChamadosAtendenteUI: { ligado: false, contexto: { state: "running" } },
  itensChapeiroOperacao: (itens) => itens.filter((i) => i.categoria !== "bebidas"),
  tocarSomChamadoAtendenteUI() {
    if (ctx.somChamadosAtendenteUI.ligado) toques++;
  },
  async ativarSomChamadosAtendenteUI() {
    ctx.somChamadosAtendenteUI.ligado = true;
  },
  encerrarSomChamadosAtendenteUI() {
    ctx.somChamadosAtendenteUI.ligado = false;
  },
});
vm.runInContext(fs.readFileSync("js/som-cozinha.js", "utf8"), ctx);
const pedido = (id, status = "aguardando", categoria = "lanches") => ({
  id,
  status,
  itens: [{ nome: "Teste", categoria }],
});
(async () => {
  await ctx.alternarSomCozinhaUI();
  ctx.processarSomFilaCozinhaUI([pedido("antigo")], 1);
  assert.equal(toques, 0);
  ctx.processarSomFilaCozinhaUI([pedido("antigo"), pedido("novo")], 1);
  assert.equal(toques, 1);
  ctx.processarSomFilaCozinhaUI([pedido("antigo"), pedido("novo")], 1);
  assert.equal(toques, 1);
  ctx.processarSomFilaCozinhaUI(
    [pedido("antigo", "pronto"), pedido("novo"), pedido("bebida", "aguardando", "bebidas")],
    1,
  );
  assert.equal(toques, 1);
  ctx.processarSomFilaCozinhaUI([pedido("antigo"), pedido("novo"), pedido("segunda-leva")], 1);
  assert.equal(toques, 2, "Voltar concluído não repete som; nova leva toca");
  await ctx.alternarSomCozinhaUI();
  ctx.processarSomFilaCozinhaUI([pedido("silencioso")], 1);
  assert.equal(toques, 2);
  await ctx.alternarSomCozinhaUI();
  ctx.processarSomFilaCozinhaUI([pedido("silencioso")], 1);
  assert.equal(toques, 2, "Ativar não repete backlog");
  ctx.processarSomFilaCozinhaUI([], 2);
  ctx.processarSomFilaCozinhaUI([pedido("amanha", "aguardando", "batatas")], 2);
  assert.equal(toques, 3);
  console.log(
    "PASS: sino optativo da chapa, nova leva, batatas, silêncio inicial, deduplicação e virada de jornada.",
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
