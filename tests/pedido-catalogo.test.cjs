const assert = require("node:assert/strict"),
  fs = require("node:fs");
const { reconstruirItensPedido } = require("../api/_lib/pedido-catalogo.cjs");
const produtos = [
  {
    id: "lanche",
    nome: "Baguncinha",
    categoria: "lanches",
    ativo: true,
    preco: 25,
    precoIndustrial: 18,
    opcoes: { artesanal: true, industrial: true },
  },
  {
    id: "burrito",
    nome: "Burrito",
    categoria: "lanches",
    ativo: true,
    preco: 20,
    precoIndustrial: 18,
    precoFrango: 20,
  },
  { id: "coca", nome: "Coca lata", categoria: "bebidas", ativo: true, preco: 8 },
  {
    id: "cerveja",
    nome: "Skol",
    categoria: "bebidas",
    ativo: true,
    somenteAtendente: true,
    preco: 6,
  },
  { id: "batata", nome: "Batata Média", categoria: "batatas", ativo: true, preco: 20 },
  ...JSON.parse(fs.readFileSync("scripts/combos-conferidos.json", "utf8")).map((c, i) => ({
    ...c,
    id: "combo" + i,
    categoria: "combos",
    ativo: true,
  })),
];
const extras = [
  { id: "bacon", nome: "Bacon", ativo: true, preco: 6 },
  { id: "cebola", nome: "Cebola", ativo: true, preco: 3 },
];
const ler = (item, opcoes) =>
  reconstruirItensPedido(Array.isArray(item) ? item : [item], produtos, extras, opcoes);
let item = ler({
  produtoId: "lanche",
  nome: "X-Tudo",
  quantidade: 1,
  preco: 0.01,
  categoria: "bebidas",
  tipoCarne: "artesanal",
  adicionais: [{ id: "bacon", qtd: 2, nome: "Filé Mignon", preco: 0 }],
  observacao: "Sem tomate",
  molhosPagos: [{ nome: "Ketchup", qtd: 2, preco: 0 }],
  totalMolhosPagos: 0,
})[0];
assert.equal(item.nome, "Baguncinha (Artesanal)");
assert.equal(item.categoria, "lanches");
assert.equal(item.preco, 37);
assert.equal(item.adicionais[0].nome, "Bacon");
assert.equal(item.totalMolhosPagos, 4);
assert.equal(item.subtotal, 37);
assert.equal(ler({ produtoId: "burrito", tipoCarne: "frango", quantidade: 1 })[0].preco, 20);
assert.equal(ler({ produtoId: "burrito", tipoCarne: "industrial", quantidade: 1 })[0].preco, 18);
assert.throws(() => ler({ produtoId: "lanche", tipoCarne: "file", quantidade: 1 }));
assert.throws(() => ler({ produtoId: "cerveja", quantidade: 1 }));
assert.throws(() => ler({ produtoId: "inexistente", quantidade: 1 }));
for (const quantidade of [0, -1, 1.5, "1", 31, Infinity, NaN])
  assert.throws(() => ler({ produtoId: "lanche", quantidade }));
assert.throws(() =>
  ler({ produtoId: "lanche", quantidade: 2, adicionais: [{ id: "bacon", qtd: 1 }] }),
);
assert.throws(() =>
  ler({ produtoId: "coca", quantidade: 1, adicionais: [{ id: "bacon", qtd: 1 }] }),
);
assert.throws(() =>
  ler({ produtoId: "lanche", quantidade: 1, adicionais: [{ id: "falso", nome: "Bacon", qtd: 1 }] }),
);
assert.throws(() =>
  ler({
    produtoId: "lanche",
    quantidade: 1,
    adicionais: [
      { id: "bacon", qtd: 1 },
      { id: "bacon", qtd: 1 },
    ],
  }),
);
assert.throws(() => ler({ produtoId: "lanche", quantidade: 1, observacao: "a".repeat(1001) }));
assert.throws(() =>
  ler({
    produtoId: "lanche",
    quantidade: 1,
    molhosGratis: [{ unidade: 1, texto: "500 Maionese" }],
  }),
);
assert.throws(() =>
  ler({ produtoId: "lanche", quantidade: 1, molhosPagos: [{ nome: "Bacon", qtd: 1 }] }),
);
item = ler(
  {
    produtoId: "lanche",
    quantidade: 1,
    molhosGratis: [{ unidade: 1, texto: "2 Maionese" }],
    molhosPagos: [{ nome: "Ketchup", qtd: 2 }],
  },
  { local: true },
)[0];
assert.deepEqual(item.molhosGratis, []);
assert.equal(item.totalMolhosPagos, 0);
for (let i = 0; i < 12; i++) {
  const p = produtos.find((p) => p.id === "combo" + i);
  const c = ler({
    produtoId: p.id,
    quantidade: 1,
    comboQtdLanches: 100,
    comboComponentes: [{ nome: "Combo inventado" }],
    lanchesCombo: Array.from({ length: p.comboQtdLanches }, (_, n) => ({
      numero: n + 1,
      adicionais: [{ id: "bacon", qtd: 1 }],
      observacao: "Sem tomate",
    })),
  })[0];
  assert.equal(c.comboQtdLanches, p.comboQtdLanches);
  assert.equal(c.preco, p.preco + p.comboQtdLanches * 6);
  assert(c.comboComponentes.every((c) => c.nome !== "Combo inventado"));
  assert.equal(c.lanchesCombo[0].observacao, "Sem tomate");
}
produtos[0].esgotado = true;
assert.throws(() => ler({ produtoId: "lanche", quantidade: 1 }));
produtos[0].esgotado = false;
extras[0].ativo = false;
assert.throws(() =>
  ler({ produtoId: "lanche", quantidade: 1, adicionais: [{ id: "bacon", qtd: 1 }] }),
);
console.log(
  "PASS: servidor reconstrói preços, nomes, carnes, extras, 12 combos e molhos pelo catálogo; bloqueia cerveja pública, valores forjados, quantidades inválidas e personalização duplicada.",
);
