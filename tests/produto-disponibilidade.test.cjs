const fs = require("node:fs"),
  vm = require("node:vm"),
  assert = require("node:assert/strict");
const fonte = fs.readFileSync("js/produto-comanda.js", "utf8");
const area = { style: {}, innerHTML: "" };
const produtos = [
  { id: "ok", nome: "X-Bagunça", ativo: true, esgotado: false, categoria: "lanches" },
  { id: "acabou", nome: "X-Home", ativo: true, esgotado: true, categoria: "lanches" },
  { id: "oculto", nome: "Oculto", ativo: false, categoria: "lanches" },
];
let aviso = "";
const snap = { forEach: (fn) => produtos.forEach((p) => fn({ id: p.id, data: () => p })) };
const ctx = vm.createContext({
  contextoPainelProduto: "",
  htmlCarregandoUI: (texto) => texto,
  document: { getElementById: () => area },
  mostrarAvisoUI: (txt) => {
    aviso = txt;
  },
  db: {
    collection: () => ({
      orderBy: () => ({ get: async () => snap }),
      doc: () => ({ get: async () => ({ exists: true, data: () => produtos[1] }) }),
    }),
  },
});
for (const nome of ["carregarCategoriaProdutos", "abrirPainelProduto"]) {
  const start = fonte.indexOf("async function " + nome + "(");
  const next = fonte.slice(start + 1).search(/\n(?:async )?function /);
  vm.runInContext(fonte.slice(start, next < 0 ? undefined : start + 1 + next), ctx);
}
(async () => {
  await ctx.carregarCategoriaProdutos("comanda", "lanches");
  assert.match(area.innerHTML, /X-Bagunça/);
  assert(!area.innerHTML.includes("X-Home"));
  assert(!area.innerHTML.includes("Oculto"));
  await ctx.abrirPainelProduto("comanda", "acabou");
  assert.match(aviso, /indisponível/);
  assert(
    !fonte.includes("await confirmarProducaoOperacao("),
    "Adicionar item não pode enviar à cozinha",
  );
  console.log(
    "PASS: catálogo exclui esgotados/ocultos, abertura bloqueia esgotado e inclusão não libera produção.",
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
