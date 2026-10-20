const fs = require("node:fs");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const fonte = fs.readFileSync("js/script.js", "utf8");
const campos = {};
const campo = (id) => (campos[id] ??= { style: {}, textContent: "", innerHTML: "" });
let avisos = 0;
const ctx = vm.createContext({
  carrinho: [{ nome: "Lanche", qtd: 1, molhosPagos: [{ nome: "Mostarda", qtd: 1, preco: 2 }] }],
  dadosPedidoTemporario: {},
  PRECO_MOLHO_PAGO: 2,
  configurarEventosMolhoPorUnidade() {},
  exibirRevisao() {},
  alert() {
    avisos++;
  },
  document: {
    getElementById: campo,
    querySelector: () => ({ value: "semmolho" }),
    querySelectorAll: () => [],
  },
});
for (const nome of [
  "abrirMolhosItem",
  "alterarMolhoPago",
  "salvarMolhosItem",
  "fecharModalMolhos",
]) {
  const inicio = fonte.indexOf(`function ${nome}(`);
  const fim = fonte.indexOf("\nfunction ", inicio + 1);
  vm.runInContext(fonte.slice(inicio, fim < 0 ? undefined : fim), ctx);
}
ctx.abrirMolhosItem(0);
assert.match(campo("conteudo-molhos").innerHTML, /id="molho-pago-Mostarda">1<\/strong>/);
ctx.alterarMolhoPago("Mostarda", 1);
assert.equal(campo("molho-pago-Mostarda").textContent, 2);
ctx.salvarMolhosItem();
assert.equal(ctx.carrinho[0].totalMolhosPagos, 4);
assert.equal(avisos, 0);
ctx.abrirMolhosItem(0);
assert.match(campo("conteudo-molhos").innerHTML, /id="molho-pago-Mostarda">2<\/strong>/);
ctx.alterarMolhoPago("Mostarda", -1);
ctx.alterarMolhoPago("Mostarda", -1);
ctx.alterarMolhoPago("Mostarda", -1);
ctx.salvarMolhosItem();
assert.equal(ctx.carrinho[0].totalMolhosPagos, 0);
assert.equal(ctx.carrinho[0].molhosPagos.length, 0);
console.log(
  "PASS: molhos pagos reabrem com contadores salvos, atualizam total e salvam sem aviso.",
);
