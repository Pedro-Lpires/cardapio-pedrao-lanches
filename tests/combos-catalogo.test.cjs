const fs = require("node:fs"),
  vm = require("node:vm"),
  assert = require("node:assert/strict");
const combos = JSON.parse(fs.readFileSync("scripts/combos-conferidos.json", "utf8"));
const ctx = vm.createContext({
  window: { addEventListener() {} },
  document: { addEventListener() {} },
  location: { search: "" },
  localStorage: {
    getItem() {
      return "";
    },
  },
});
vm.runInContext(fs.readFileSync("js/produtos.js", "utf8"), ctx);
vm.runInContext(fs.readFileSync("js/operacao.js", "utf8"), ctx);
const json = (v) => JSON.parse(JSON.stringify(v));
assert.equal(combos.length, 12);
for (const combo of combos) {
  const fixo = ctx.window.listaCombos.find((c) => c.img === combo.imagem);
  assert.equal(fixo.preco, combo.preco);
  assert(Number.isInteger(combo.preco));
  assert.equal(fixo.comboQtdLanches, combo.comboQtdLanches);
  assert.deepEqual(json(fixo.comboComponentes), combo.comboComponentes);
  const item = {
    ...combo,
    categoria: "combos",
    quantidade: 2,
    lanchesCombo: [
      { numero: 1, adicionais: [{ nome: "Bacon", qtd: 1 }], observacao: "Sem cebola" },
    ],
  };
  const antes = JSON.stringify(item);
  const cozinha = ctx.itensChapeiroOperacao([item]);
  assert.equal(
    cozinha.filter((c) => c.categoria === "lanches").reduce((n, c) => n + c.quantidade, 0),
    combo.comboQtdLanches * 2,
  );
  const batata = combo.comboComponentes.find((c) => c.categoria === "batatas");
  assert.equal(
    cozinha.filter((c) => c.categoria === "batatas").reduce((n, c) => n + c.quantidade, 0),
    (batata?.quantidade || 0) * 2,
  );
  assert(
    cozinha
      .filter((c) => c.categoria === "batatas")
      .every((c) => !c.lanchesCombo.length && !c.adicionais.length),
  );
  const bebidas = ctx.bebidasOperacao([item]);
  const refri = combo.comboComponentes.find((c) => c.categoria === "bebidas");
  assert.equal(bebidas.length, 1);
  assert.equal(bebidas[0].nome, refri.nome);
  assert.equal(bebidas[0].quantidade, refri.quantidade * 2);
  const htmlCozinha = ctx.gerarImpressaoOperacao("cozinha", { mesa: 1, itens: [item] });
  assert(!/Refrigerante|Combo \d/.test(htmlCozinha));
  const htmlMotoboy = ctx.gerarImpressaoOperacao("motoboy", { tipo: "Entrega", itens: [item] });
  assert(htmlMotoboy.includes(refri.nome));
  assert(!/Batata|Baguncinha|X-Bacon|X-Tudo|X-Filé|Big Big/.test(htmlMotoboy));
  assert(ctx.detalhesItemOperacao(item).includes("Itens do combo"));
  assert.equal(JSON.stringify(item), antes, "Impressões preservam a compra e o preço");
}
const artesanal = combos.find((c) => c.nome === "Combo 2 Artesanal");
assert.equal(artesanal.comboComponentes.find((c) => c.categoria === "batatas").quantidade, 1);
assert.equal(
  artesanal.comboComponentes.find((c) => c.categoria === "batatas").nome,
  "Batata Frita Média",
);
const antigo = {
  nome: "Combo 3 teste",
  categoria: "combos",
  quantidade: 2,
  descricao: "3 X-Bacon + Batata Frita Média + 2 Refrigerantes em lata",
};
assert.equal(
  ctx.itensChapeiroOperacao([antigo])[1].quantidade,
  2,
  "Batata sem numeral significa uma por combo",
);
const escolhido = {
  ...artesanal,
  categoria: "combos",
  quantidade: 1,
  bebidas: [{ nome: "Coca lata", quantidade: 2 }],
  bebida: "Refrigerante em lata",
};
assert.equal(ctx.bebidasOperacao([escolhido]).length, 1);
assert.equal(ctx.bebidasOperacao([escolhido])[0].nome, "Coca lata");
console.log(
  "PASS: 12 combos conferidos, preços inteiros, lanches/batatas do chapeiro, bebidas do motoboy, quantidades multiplicadas e compra preservada.",
);
