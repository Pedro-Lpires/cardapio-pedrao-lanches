const fs = require("node:fs"),
  vm = require("node:vm"),
  assert = require("node:assert/strict");
function elemento(id = "") {
  return {
    id,
    hidden: true,
    style: { display: "none" },
    dataset: {},
    innerHTML: "",
    classList: { contains: () => false },
    querySelector: () => null,
    querySelectorAll: () => [],
    prepend() {},
    append() {},
    remove() {},
    setAttribute() {},
  };
}
const ids = [
  "area-consumo-local",
  "area-mesa-atendente",
  "area-comanda-atendente",
  "area-produtos-comanda",
  "area-entrega-atendente",
];
const areas = Object.fromEntries(ids.map((id) => [id, elemento(id)]));
const menu = { hidden: false };
const ctx = vm.createContext({
  document: {
    querySelector: () => menu,
    getElementById: (id) => areas[id] || null,
    createElement: () => elemento(),
    body: { append() {} },
  },
  window: { scrollTo() {} },
  htmlCarregandoUI: () => "Carregando…",
  avisoOperacao: (msg) => assert.fail(msg),
  mesaAbertaAtual: null,
  comandaAbertaAtual: null,
  areaDestinoComandaAtual: null,
  areaConsumoLocalRecarregar: async () => {
    areas["area-consumo-local"].innerHTML = "grade de mesas";
  },
});
const atendente = fs.readFileSync("js/atendente.js", "utf8");
const inicio = atendente.indexOf("async function abrirConsumoLocal(");
const fim = atendente.indexOf("\nasync function ", inicio + 1);
vm.runInContext(atendente.slice(inicio, fim), ctx);
ctx.window.abrirConsumoLocal = ctx.abrirConsumoLocal;
ctx.window.abrirMesaAtendente = async () => {
  areas["area-mesa-atendente"].innerHTML = "Mesa 2";
};
ctx.window.abrirEntregaAtendente = async () => {
  const area = areas["area-entrega-atendente"];
  if (area.style.display !== "none") {
    area.innerHTML = "";
    return;
  }
  area.style.display = "block";
  area.innerHTML = "lista de entregas";
};
const app = fs.readFileSync("js/app-ui.js", "utf8");
vm.runInContext(
  app.slice(
    app.indexOf("const telasAtendenteUI ="),
    app.indexOf("async function enviarMesaCozinhaUI("),
  ),
  ctx,
);
ctx.instalarNavegacaoAtendenteUI();
ctx.abrirConsumoLocal = ctx.window.abrirConsumoLocal;
(async () => {
  for (let n = 0; n < 3; n++) {
    await ctx.window.abrirConsumoLocal();
    assert.equal(areas["area-consumo-local"].innerHTML, "grade de mesas");
    assert.equal(areas["area-consumo-local"].hidden, false);
    assert.equal(areas["area-consumo-local"].style.display, "block");
    await ctx.window.abrirEntregaAtendente();
    assert.equal(areas["area-entrega-atendente"].innerHTML, "lista de entregas");
  }
  ctx.fecharFluxoAtendenteUI();
  await ctx.window.abrirConsumoLocal();
  await ctx.window.abrirMesaAtendente("mesa2");
  await ctx.fecharEtapaAtendenteUI();
  assert.equal(areas["area-consumo-local"].hidden, false);
  assert.equal(vm.runInContext("pilhaAtendenteUI.length", ctx), 1);
  await ctx.fecharEtapaAtendenteUI();
  assert.equal(menu.hidden, false);
  assert.equal(areas["area-consumo-local"].hidden, true);
  await ctx.window.abrirConsumoLocal();
  await ctx.window.abrirMesaAtendente("mesa2");
  await ctx.fecharEtapaAtendenteUI();
  await ctx.voltarFluxoAtendenteUI();
  assert.equal(menu.hidden, false);
  console.log(
    "PASS: indicador separado não aciona o fechar por segundo clique; mesas e entregas reabrem sem tela vazia.",
  );
})().catch((erro) => {
  console.error(erro);
  process.exitCode = 1;
});
