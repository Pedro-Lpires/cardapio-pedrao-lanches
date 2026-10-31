const fs = require("node:fs"),
  vm = require("node:vm"),
  assert = require("node:assert/strict");
const c = vm.createContext({ URL, URLSearchParams, document: { addEventListener() {} } });
vm.runInContext(fs.readFileSync("js/localizacao.js", "utf8"), c);
const d = c.destinosLocalizacaoUI("?p=-15.7508%2C-56.1035");
assert.equal(new URL(d.waze).searchParams.get("ll"), "-15.7508,-56.1035");
assert.equal(new URL(d.maps).searchParams.get("q"), "-15.7508,-56.1035");
assert.equal(new URL(d.waze).searchParams.get("navigate"), "yes");
for (const query of ["", "?p=91,0", "?p=0,181", "?p=<script>", "?p=texto&q=Casa"])
  assert.equal(c.destinosLocalizacaoUI(query), null);
assert(c.destinosLocalizacaoUI("?p=0,0"));
const e = c.destinosLocalizacaoUI("?q=Rua%20de%20teste%2C%20100");
assert.equal(e.porEndereco, true);
assert.equal(new URL(e.waze).searchParams.get("q"), "Rua de teste, 100");
assert(!fs.readFileSync("localizacao.html", "utf8").includes("firebase"));
console.log(
  "PASS: link único permite escolher mapa, preserva o ponto GPS, busca endereço quando necessário e rejeita coordenadas inválidas sem consultar Firebase.",
);
