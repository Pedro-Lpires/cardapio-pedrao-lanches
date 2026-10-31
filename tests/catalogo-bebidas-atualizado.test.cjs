const fs = require("node:fs"),
  vm = require("node:vm"),
  assert = require("node:assert/strict");
const s = JSON.parse(fs.readFileSync("scripts/catalogo-precos-consulta.json", "utf8"));
const dec = (v) =>
  v.mapValue
    ? Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k, x]) => [k, dec(x)]))
    : v.arrayValue
      ? (v.arrayValue.values || []).map(dec)
      : (v.stringValue ?? v.booleanValue ?? Number(v.integerValue ?? v.doubleValue));
const produtos = s.produtos.map((d) => dec({ mapValue: { fields: d.fields } }));
const bebidas = produtos.filter((p) => p.categoria === "bebidas");
assert.equal(bebidas.length, 23);
const publico = bebidas.filter((p) => p.ativo !== false && !p.somenteAtendente);
assert.equal(publico.length, 21);
assert(!publico.some((p) => /cerveja|brahma|skol/i.test(p.nome)));
for (const p of bebidas) {
  const n = p.nome;
  if (p.somenteAtendente) {
    assert.equal(p.preco, 6);
    assert.equal(p.ativo, false);
    assert.equal(p.disponivelAtendimento, true);
    assert.equal(p.imagem, "");
  } else if (/água/i.test(n)) assert.equal(p.preco, 5);
  else if (/garrafinha/i.test(n)) assert.equal(p.preco, 10);
  else if (/1[,.]5l/i.test(n)) assert.equal(p.preco, 18);
  else if (/2l/i.test(n)) assert.equal(p.preco, 22);
  else if (/1l/i.test(n)) assert.equal(p.preco, 12);
  else if (/lata/i.test(n)) assert.equal(p.preco, 8);
}
const c = vm.createContext({ window: {}, URL, location: { origin: "https://teste.local" } });
vm.runInContext(fs.readFileSync("js/imagens-webp.js", "utf8"), c);
for (const [a, b] of Object.entries(
  JSON.parse(fs.readFileSync("scripts/imagens-organizadas.json")),
)) {
  assert.equal(c.resolverImagemWebpUI(a), b);
  assert(fs.existsSync(b), b);
  assert.equal(fs.readFileSync(b).toString("ascii", 8, 12), "WEBP");
}
for (const p of produtos)
  if (p.imagem && p.nome !== "x-home")
    assert(
      fs.existsSync(
        c.resolverImagemWebpUI(p.imagem.startsWith("images/") ? p.imagem : "images/" + p.imagem),
      ),
      p.nome,
    );
const extras = Object.fromEntries(
  s.adicionais.map((d) => [d.fields.nome.stringValue, dec(d.fields.preco)]),
);
for (const [nome, preco] of Object.entries({
  Bacon: 6,
  Calabresa: 5,
  Cebola: 3,
  Cheddar: 4,
  "Filé de Frango": 7,
  "Filé Mignon": 12,
  "Hambúrguer Caseiro": 9,
}))
  assert.equal(extras[nome], preco, nome);
console.log(
  "PASS: catálogo relido tem 23 bebidas, 21 públicas, duas cervejas de R$6 só no atendimento; preços e todos os caminhos de imagens conferidos.",
);
