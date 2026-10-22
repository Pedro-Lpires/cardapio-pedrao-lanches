const fs = require("node:fs"),
  vm = require("node:vm"),
  assert = require("node:assert/strict");
let abriu = "";
const ctx = vm.createContext({
  document: { getElementById: () => null, querySelector: () => ({}) },
  lerComPrazoUI: (p) => p,
  db: {
    collection: () => ({
      doc: () => ({ get: async () => ({ exists: true, data: () => ({ status: "Aberta" }) }) }),
    }),
  },
  abrirConsumoLocal: () => (abriu = "mesas"),
  abrirComandaVisual: () => (abriu = "comanda"),
  abrirFechamentoComanda: () => (abriu = "escolha"),
  abrirPagamentoSeparado: () => (abriu = "separado"),
  scrollTo() {},
});
ctx.window = ctx;
const fonte = fs.readFileSync("js/app-ui.js", "utf8");
vm.runInContext(
  fonte.slice(
    fonte.indexOf("const telasAtendenteUI ="),
    fonte.indexOf("function cabecalhoEtapaUI("),
  ),
  ctx,
);
const rota = (nome) =>
  vm.runInContext(
    `pilhaAtendenteUI=[{nome:'abrirComandaVisual',args:['c1']},{nome:'abrirFechamentoComanda',args:['c1']},{nome:'${nome}',args:['c1']}];`,
    ctx,
  );
(async () => {
  rota("abrirPagamentoTudoJunto");
  await ctx.fecharEtapaAtendenteUI();
  assert.equal(abriu, "escolha");
  rota("abrirPagamentoSeparado");
  await ctx.fecharEtapaAtendenteUI();
  assert.equal(abriu, "escolha");
  rota("abrirFechamentoComanda");
  await ctx.fecharEtapaAtendenteUI();
  assert.equal(abriu, "comanda");
  rota("abrirMesaAtendente");
  await ctx.fecharEtapaAtendenteUI();
  assert.equal(abriu, "mesas");
  vm.runInContext(
    "pilhaAtendenteUI=[{nome:'abrirFechamentoComanda',args:['c1']},{nome:'abrirPagamentoSeparado',args:['c1']},{nome:'abrirIdentificacaoPagamentoSeparado',args:['c1',10]}];",
    ctx,
  );
  await ctx.voltarFluxoAtendenteUI();
  assert.equal(abriu, "separado");
  console.log(
    "PASS: X fecha pagamento para escolha, escolha para comanda e mesa para lista; Voltar retorna à etapa anterior.",
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
