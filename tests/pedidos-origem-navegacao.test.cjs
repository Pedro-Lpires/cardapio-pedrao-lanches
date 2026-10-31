const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  vm = require("node:vm");
let ctx;
function elemento(id = "") {
  const voltar = { onclick: () => ctx.voltarFluxoAtendenteUI() },
    fechar = { onclick: () => ctx.fecharEtapaAtendenteUI() };
  return {
    id,
    hidden: true,
    style: { display: "none" },
    dataset: {},
    innerHTML: "",
    botoes: [],
    classList: { contains: () => false },
    querySelector(s) {
      return s === ".ui-navegacao"
        ? this.nav
        : s === ".ui-voltar"
          ? voltar
          : s === ".ui-x"
            ? fechar
            : null;
    },
    querySelectorAll: () => [],
    prepend(nav) {
      this.nav = nav;
    },
    append(b) {
      this.botoes.push(b);
    },
    remove() {},
    setAttribute() {},
  };
}
const areas = Object.fromEntries(
  ["area-entrega-atendente", "area-retirada-atendente", "central-operacao"].map((id) => [
    id,
    elemento(id),
  ]),
);
const menu = { hidden: false };
ctx = vm.createContext({
  document: {
    querySelector: () => menu,
    getElementById: (id) => areas[id] || null,
    createElement: () => elemento(),
    body: { append() {} },
  },
  htmlCarregandoUI: () => "Carregando…",
  avisoOperacao: (m) => assert.fail(m),
  scrollTo() {},
  tipoCentralOperacao: null,
  idCentralOperacao: null,
  abrirEntregaAtendente: () => {
    areas["area-entrega-atendente"].innerHTML = "Entrega";
  },
  abrirRetiradaAtendente: () => {
    areas["area-retirada-atendente"].innerHTML = "Retirada";
  },
  abrirCentralOperacao: (tipo = null, id = null) => {
    ctx.tipoCentralOperacao = tipo;
    ctx.idCentralOperacao = id;
    areas["central-operacao"].innerHTML = id
      ? "Pedido " + id
      : tipo
        ? "Pedidos de " + tipo
        : "Pedidos e produção";
  },
});
ctx.window = ctx;
const fonte = fs.readFileSync("js/app-ui.js", "utf8");
vm.runInContext(
  fonte.slice(
    fonte.indexOf("const telasAtendenteUI ="),
    fonte.indexOf("async function enviarMesaCozinhaUI("),
  ),
  ctx,
);
vm.runInContext(
  fonte.slice(
    fonte.indexOf("async function abrirPedidosTipoUI("),
    fonte.indexOf("function organizarModulosAdminUI("),
  ),
  ctx,
);
ctx.instalarNavegacaoAtendenteUI();
const x = () => areas["central-operacao"].nav.querySelector(".ui-x").onclick();
const voltar = () => areas["central-operacao"].nav.querySelector(".ui-voltar").onclick();
(async () => {
  for (const tipo of ["Entrega", "Retirada"]) {
    const nome = "abrir" + tipo + "Atendente",
      id = tipo === "Entrega" ? "area-entrega-atendente" : "area-retirada-atendente";
    for (let n = 0; n < 3; n++) {
      ctx.fecharFluxoAtendenteUI();
      await ctx[nome]();
      await areas[id].botoes.at(-1).onclick();
      assert.equal(areas["central-operacao"].innerHTML, "Pedidos de " + tipo);
      await ctx.abrirCentralOperacao(tipo, "p1");
      await voltar();
      assert.equal(areas["central-operacao"].innerHTML, "Pedidos de " + tipo);
      await x();
      assert.equal(areas[id].hidden, false, "X retorna ao módulo de origem");
      assert.equal(areas["central-operacao"].hidden, true);
      assert.equal(menu.hidden, true);
      await ctx.fecharEtapaAtendenteUI();
      assert.equal(menu.hidden, false, "Fechar o módulo retorna ao menu");
    }
    ctx.fecharFluxoAtendenteUI();
    await ctx.abrirCentralOperacao();
    await ctx.abrirCentralOperacao(tipo);
    await ctx.abrirCentralOperacao(tipo, "p1");
    await x();
    assert.equal(areas["central-operacao"].innerHTML, "Pedidos de " + tipo);
    await x();
    assert.equal(areas["central-operacao"].innerHTML, "Pedidos e produção");
    await x();
    assert.equal(menu.hidden, false);
  }
  console.log(
    "PASS: Entrega/Retirada e Produção usam a mesma consulta, mas X/Voltar respeitam a origem sem alternar de módulo ou acumular retornos.",
  );
})().catch((erro) => {
  console.error(erro);
  process.exitCode = 1;
});
