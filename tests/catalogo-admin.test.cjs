const fs = require("fs"),
  vm = require("vm"),
  assert = require("node:assert/strict");
const els = {};
const el = (id) => (els[id] ||= { value: "", innerHTML: "" });
let consultas = 0;
const produtos = new Map([
  ["visivel", { nome: "Lanche visível", categoria: "lanches", ativo: true, preco: 20, ordem: 1 }],
  ["oculto", { nome: "Bebida oculta", categoria: "bebidas", ativo: false, preco: 5, ordem: 2 }],
]);
const ctx = vm.createContext({
  console,
  Number,
  String,
  document: { addEventListener() {}, getElementById: el },
  escaparOperacao: (s) => String(s ?? "").replaceAll("<", "&lt;"),
  normalizarBuscaUI: (s) => String(s || "").toLowerCase(),
  htmlCarregandoUI: (texto) => texto,
  db: {
    collection: () => ({
      get: async () => {
        consultas++;
        return { docs: [...produtos].map(([id, p]) => ({ id, data: () => ({ ...p }) })) };
      },
      doc: (id) => ({
        update: async (patch) => produtos.set(id, { ...produtos.get(id), ...patch }),
      }),
    }),
  },
});
vm.runInContext(fs.readFileSync("js/catalogo-admin-ui.js", "utf8"), ctx);
const operacao = fs.readFileSync("js/operacao.js", "utf8");
vm.runInContext(
  operacao.slice(
    operacao.indexOf("function tiposCarneProdutoOperacao("),
    operacao.indexOf("function cupomUsoUnicoOperacao("),
  ),
  ctx,
);
const base = {
  categoria: "bebidas",
  tipoBase: "frango",
  preco: 7,
  precoIndustrial: 15,
  precoFrango: 20,
  precoFile: 30,
  opcoes: { artesanal: true, industrial: true, frango: true, file: true },
  permiteAdicionais: true,
  adicionaisPermitidos: ["a"],
  comboQtdLanches: 3,
};
const bebida = ctx.normalizarProdutoCatalogoUI({ ...base });
assert.equal(bebida.tipoBase, "outro");
assert.equal(bebida.precoFrango, 0);
assert.equal(bebida.precoIndustrial, 0);
assert.equal(bebida.precoFile, 0);
assert.equal(bebida.permiteAdicionais, false);
assert.equal(bebida.comboQtdLanches, 0);
assert.equal(ctx.tiposCarneProdutoOperacao(bebida).length, 0);
const frango = ctx.normalizarProdutoCatalogoUI({
  ...base,
  categoria: "lanches",
  preco: 0,
  opcoes: { artesanal: false, industrial: true, frango: true, file: false },
});
assert.equal(frango.preco, 20);
assert.equal(frango.precoFile, 0);
const tipos = ctx.tiposCarneProdutoOperacao(frango);
assert.equal(tipos[0].valor, "frango");
assert.equal(tipos[1].valor, "industrial");
assert.equal(tipos.length, 2);
assert.throws(
  () => ctx.normalizarProdutoCatalogoUI({ ...base, categoria: "lanches", precoFrango: 0 }),
  /preço/,
);
const admin = fs.readFileSync("js/admin.js", "utf8");
vm.runInContext(
  admin.slice(
    admin.indexOf("async function listarProdutosAdmin()"),
    admin.indexOf("async function salvarAdicionalAdmin()"),
  ),
  ctx,
);
vm.runInContext(
  admin.slice(
    admin.indexOf("async function alternarProdutoAtivo("),
    admin.indexOf("async function alternarProdutoEsgotado("),
  ),
  ctx,
);
(async () => {
  el("filtro-categoria-admin").value = "ocultos";
  await ctx.listarProdutosAdmin();
  assert.match(el("lista-produtos-admin").innerHTML, /Bebida oculta/);
  assert.ok(!el("lista-produtos-admin").innerHTML.includes("Lanche visível"));
  await ctx.listarProdutosAdmin();
  assert.equal(consultas, 1);
  await ctx.alternarProdutoAtivo("oculto", true);
  assert.equal(produtos.get("oculto").ativo, true);
  assert.equal(consultas, 2);
  assert.ok(!el("lista-produtos-admin").innerHTML.includes("Bebida oculta"));
  console.log(
    "PASS: bebida sem carne, preços disponíveis, carne principal, validação, filtro Ocultos, reativação e busca sem novas leituras.",
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
