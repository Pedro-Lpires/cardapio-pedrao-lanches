const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  vm = require("node:vm");
const fonte = fs.readFileSync("js/admin.js", "utf8");
const trecho = fonte.slice(
  fonte.indexOf("let adminAvancadoLiberado ="),
  fonte.indexOf("function abrirFinanceiroAdmin("),
);
for (const admin of [false, true]) {
  const area = { style: { display: "none" } };
  const c = vm.createContext({
    equipeProtegidaAtivaUI: () => true,
    perfilEquipeProtegidaUI: { admin },
    document: { getElementById: () => area },
  });
  vm.runInContext(trecho, c);
  c.liberarAreaAvancadaAdmin();
  assert.equal(vm.runInContext("adminAvancadoLiberado", c), admin);
  assert.equal(area.style.display, admin ? "block" : "none");
  if (admin) {
    c.liberarAreaAvancadaAdmin();
    assert.equal(area.style.display, "none");
    assert.equal(vm.runInContext("adminAvancadoLiberado", c), true);
  }
}
console.log(
  "PASS: proprietário libera os controles antigos de benefícios/campanhas/cupons; ocultar a área não encerra acesso e equipe sem papel administrativo não libera.",
);
