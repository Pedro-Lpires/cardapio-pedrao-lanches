const fs = require("node:fs"),
  vm = require("node:vm"),
  assert = require("node:assert/strict");
let status = "Aberta",
  abriu = "";
const menu = { hidden: true };
const ctx = vm.createContext({
  document: { querySelector: () => menu, getElementById: () => null },
  window: {
    scrollTo() {},
    abrirMesaAtendente: async () => {
      abriu = "mesa";
    },
    abrirComandaVisual: async () => {
      abriu = "comanda";
    },
  },
  lerComPrazoUI: (p) => p,
  abrirFechamentoComanda: async () => {
    abriu = "escolha de pagamento";
  },
  db: {
    collection: () => ({
      doc: () => ({
        get: async () => ({ exists: status !== "Excluida", data: () => ({ status }) }),
      }),
    }),
  },
});
const fonte = fs.readFileSync("js/app-ui.js", "utf8");
vm.runInContext(
  fonte.slice(
    fonte.indexOf("const telasAtendenteUI ="),
    fonte.indexOf("function cabecalhoEtapaUI("),
  ),
  ctx,
);
const pilha = (ultima) =>
  vm.runInContext(
    `pilhaAtendenteUI = [{nome:'abrirMesaAtendente',args:['mesa1']},{nome:'abrirComandaVisual',args:['c1']},{nome:'${ultima}',args:['c1']}];`,
    ctx,
  );
(async () => {
  pilha("abrirFormaPagamentoSeparado");
  await ctx.voltarFluxoAtendenteUI();
  assert.equal(abriu, "escolha de pagamento");
  pilha("abrirFechamentoComanda");
  await ctx.voltarFluxoAtendenteUI();
  assert.equal(abriu, "comanda");
  for (const encerrada of ["Fechada", "Cancelada", "Excluida"]) {
    status = encerrada;
    abriu = "";
    pilha("abrirFormaPagamentoSeparado");
    await ctx.voltarFluxoAtendenteUI();
    assert.equal(abriu, "");
    assert.equal(menu.hidden, false);
    assert.equal(vm.runInContext("pilhaAtendenteUI.length", ctx), 0);
  }
  console.log(
    "PASS: Voltar não reabre comanda paga, cancelada ou excluída; saldo pendente volta à escolha de pagamento.",
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
