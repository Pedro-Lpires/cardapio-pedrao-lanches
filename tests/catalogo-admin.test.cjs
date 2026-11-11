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
const refProduto = (id) => ({
  id,
  get: async () => ({
    id,
    exists: produtos.has(id),
    ref: refProduto(id),
    data: () => ({ ...produtos.get(id) }),
  }),
  update: async (patch) => produtos.set(id, { ...produtos.get(id), ...patch }),
});
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
        return { docs: await Promise.all([...produtos.keys()].map((id) => refProduto(id).get())) };
      },
      doc: refProduto,
    }),
    runTransaction: async (operacao) => {
      const escritas = [];
      await operacao({
        get: (ref) => {
          assert.equal(escritas.length, 0);
          return ref.get();
        },
        update: (ref, patch) => escritas.push(() => ref.update(patch)),
      });
      for (const escrever of escritas) await escrever();
    },
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
const burrito = {
  nome: "Burrito cuiabano",
  categoria: "lanches",
  tipoBase: "hamburguer",
  preco: 20,
  precoIndustrial: 18,
  precoFrango: 20,
  descricao:
    "Pão, hambúrguer artesanal triturado, molho vermelho. * (opção de substituir o hamburguer por filé de frango)",
};
assert.equal(
  ctx.descricaoProdutoComCarneOperacao(burrito),
  "Pão, hambúrguer artesanal triturado, molho vermelho (picante).",
);
assert.equal(
  ctx.descricaoProdutoComCarneOperacao(burrito, "Industrial"),
  "Pão, hambúrguer industrial triturado, molho vermelho (picante).",
);
assert.equal(
  ctx.descricaoProdutoComCarneOperacao(burrito, "frango"),
  "Pão, filé de frango triturado, molho vermelho (picante).",
);
const burritoSalvo = {
  ...burrito,
  descricaoModeloCarne: "Pão, {carne}, molho vermelho (picante).",
  descricaoCarnes: { frango: "filé de frango" },
};
assert.equal(
  ctx.descricaoProdutoComCarneOperacao(burritoSalvo, "frango"),
  "Pão, filé de frango triturado, molho vermelho (picante).",
);
const xtudo = {
  ...burrito,
  nome: "X-Tudo",
  descricao: "Pão, hambúrguer artesanal, filé mignon e filé de frango",
};
assert.equal(
  ctx.descricaoProdutoComCarneOperacao(xtudo, "industrial"),
  "Pão, hambúrguer industrial, filé mignon e filé de frango",
);
const ambiguo = { ...burrito, descricao: "Pão, hambúrguer artesanal e hambúrguer industrial" };
assert.equal(ctx.descricaoProdutoComCarneOperacao(ambiguo, "industrial"), ambiguo.descricao);
const personalizado = {
  ...burrito,
  nome: "Lanche novo",
  tipoBase: "frango",
  descricao: "Pão, {carne}, molho vermelho",
};
el("edit-produto-descricao-carne-frango").value = "frango em tiras";
ctx.salvarDescricaoCarneCatalogoUI(personalizado, "edit-produto-");
assert.equal(personalizado.descricao, "Pão, frango em tiras, molho vermelho");
assert.equal(
  ctx.descricaoProdutoComCarneOperacao(personalizado, "industrial"),
  "Pão, hambúrguer industrial, molho vermelho",
);
assert.equal(
  ctx.modeloDescricaoCarneOperacao(personalizado).modelo,
  "Pão, {carne}, molho vermelho",
);
const delivery = fs.readFileSync("js/script.js", "utf8");
vm.runInContext(
  delivery.slice(
    delivery.indexOf("function montarOpcoes("),
    delivery.indexOf("function montarAdicionais("),
  ),
  ctx,
);
ctx.moedaOperacao = (valor) => String(valor);
el("modal-opcoes-tipo").dataset = {};
ctx.montarOpcoes(burrito);
el("modal-opcoes-tipo").onchange({ target: { name: "tipo-produto", value: "Industrial" } });
assert.match(el("modal-desc").textContent, /hambúrguer industrial triturado/);

const auto = fs.readFileSync("js/autoatendimento.js", "utf8");
vm.runInContext(
  auto.slice(
    auto.indexOf("function atualizarDescricaoProdutoAuto("),
    auto.indexOf("function irParaCategoriaAuto("),
  ),
  ctx,
);
el("modal-opcoes-tipo-auto").dataset = {};
ctx.produtoAutoAtual = burrito;
ctx.document.querySelector = () => null;
ctx.montarTiposProdutoAuto(burrito);
ctx.document.querySelector = () => ({ value: "frango" });
el("modal-opcoes-tipo-auto").onchange();
assert.match(
  el("modal-desc-auto").textContent,
  /filé de frango triturado, molho vermelho \(picante\)/,
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
vm.runInContext(
  admin.slice(
    admin.indexOf("function deslocarOrdemProdutosAdmin("),
    admin.indexOf("async function importarProdutosFixosParaFirebase("),
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

  produtos.set("kitubaina", { categoria: "bebidas", ordem: 76 });
  produtos.set("coca15", { categoria: "bebidas", ordem: 49 });
  produtos.set("guarana", { categoria: "bebidas", ordem: 50, ativo: false });
  produtos.set("fanta", { categoria: "bebidas", ordem: 52 });
  produtos.set("batata", { categoria: "batatas", ordem: 50 });
  const mover = (ordem) =>
    ctx.atualizarProdutoNaPosicaoAdmin("kitubaina", { ...bebida, ordem }, true);
  const ordens = () =>
    ["kitubaina", "coca15", "guarana", "fanta", "batata"].map((id) => produtos.get(id).ordem);
  await mover(49);
  assert.deepEqual(ordens(), [49, 50, 51, 52, 50]);
  assert.equal(produtos.get("guarana").ativo, false);
  await mover(51);
  assert.deepEqual(ordens(), [51, 49, 50, 52, 50]);
  produtos.get("coca15").ordem = 51;
  await mover(51);
  assert.deepEqual(ordens(), [51, 52, 50, 53, 50]);
  console.log(
    "PASS: opções de carne, filtro Ocultos, reativação, cache e reordenação de produtos.",
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
