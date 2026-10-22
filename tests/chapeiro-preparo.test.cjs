const fs = require("node:fs"),
  vm = require("node:vm"),
  assert = require("node:assert/strict");
const fonte = fs.readFileSync("js/operacao.js", "utf8");
const ctx = vm.createContext({ serializarOperacao: JSON.stringify, escaparOperacao: String });
vm.runInContext(
  fonte.slice(
    fonte.indexOf("function identidadeItemOperacao("),
    fonte.indexOf("function bebidasOperacao("),
  ),
  ctx,
);
const lanches = [1, 2, 3].map((numero) => ({
  numero,
  adicionais: [
    { nome: "Hambúrguer", qtd: 1 },
    { nome: "Cheddar", qtd: 1 },
  ],
}));
const origem = [
  {
    nome: "Combo 3 X-Bagunça",
    categoria: "combos",
    quantidade: 2,
    descricao: "3 X-Bagunça + Refrigerante 1,5L + 1 Batata Grande",
    modoPersonalizacaoCombo: "todos",
    lanchesCombo: lanches,
    tipo: "industrial",
  },
  { nome: "Coca 2L", categoria: "bebidas", quantidade: 1 },
];
const copia = JSON.stringify(origem);
const itens = ctx.itensChapeiroOperacao(origem);
assert.equal(itens.length, 2);
assert.equal(itens[0].nome, "X-Bagunça");
assert.equal(itens[0].quantidade, 6);
assert.equal(itens[1].quantidade, 2);
assert.equal(itens[1].nome, "Batata Grande");
assert.equal(JSON.stringify(origem), copia);
const html = ctx.itensHtmlOperacao(itens);
assert(!/Combo 3|Refrigerante|Coca/.test(html));
assert.match(html, /industrial/);
assert.match(html, /Todos com:/);
assert.equal((html.match(/\+ 1 Hambúrguer/g) || []).length, 1);
assert(!html.includes("Lanche 1"));
const individual = ctx.detalhesLanchesComboOperacao({
  ...origem[0],
  modoPersonalizacaoCombo: "individual",
});
assert(individual.includes("Lanche 1"));
assert(individual.includes("Lanche 3"));
const comboQuatro = {
  nome: "Combo 4 Industrial",
  categoria: "combos",
  quantidade: 1,
  descricao: "4 Baguncinha + Refrigerante 1,5L",
  modoPersonalizacaoCombo: "individual",
  lanchesCombo: [1, 2, 3, 4].map((numero) => ({
    numero,
    adicionais: numero === 2 ? [{ nome: "Bacon", qtd: 2 }] : [],
    observacao: "",
  })),
};
const chapeiro = ctx.itensHtmlOperacao(ctx.itensChapeiroOperacao([comboQuatro]));
assert.match(chapeiro, /4 Baguncinha/);
assert.match(chapeiro, /1 lanche com:/);
assert.match(chapeiro, /\+ 2 Bacon/);
assert(!chapeiro.includes("Lanche 2"));
const atendente = ctx.detalhesItemOperacao(comboQuatro);
assert(atendente.includes("Lanche 2"));
assert(!atendente.includes("1 lanche com:"));
const doisPersonalizados = structuredClone(comboQuatro);
doisPersonalizados.lanchesCombo[3].observacao = "Sem cebola";
const doisHtml = ctx.itensHtmlOperacao(ctx.itensChapeiroOperacao([doisPersonalizados]));
assert.equal((doisHtml.match(/1 lanche com:/g) || []).length, 2);
assert.match(doisHtml, /Sem cebola/);
const doisCombos = ctx.itensHtmlOperacao(ctx.itensChapeiroOperacao([comboQuatro, comboQuatro]));
assert.match(doisCombos, /8 Baguncinha/);
assert.equal(
  (doisCombos.match(/1 lanche com:/g) || []).length,
  2,
  "Cada combo contribui com um lanche personalizado",
);
const duasUnidades = ctx.itensHtmlOperacao(
  ctx.itensChapeiroOperacao([{ ...comboQuatro, quantidade: 2 }]),
);
assert.equal((duasUnidades.match(/1 lanche com:/g) || []).length, 2);
assert.equal(JSON.stringify(origem), copia);
console.log(
  "PASS: chapeiro recebe só lanches e batatas, multiplica combos e resume Todos sem alterar a compra; Individual permanece separado.",
);
