const fs = require("node:fs"),
  vm = require("node:vm"),
  assert = require("node:assert/strict");
const area = { style: {}, innerHTML: "" };
let conferencias = 0;
const comanda = {
  status: "Aberta",
  cliente: "Teste",
  mesa: 1,
  valorTotal: 25,
  itens: [{ nome: "Lanche", quantidade: 1 }],
  itensEnviadosCozinha: [],
};
const ctx = vm.createContext({
  document: { getElementById: () => area },
  areaDestinoComandaAtual: null,
  mesaAbertaAtual: "mesa1",
  modoEditarItem: false,
  modoRemoverItem: false,
  escaparOperacao: String,
  db: {
    collection: () => ({
      doc: () => ({ get: async () => ({ exists: true, data: () => comanda }) }),
    }),
  },
  confirmarProducaoOperacao: async () => {
    conferencias++;
    comanda.cozinhaItensVersao = ctx.assinaturaItensProducaoOperacao(comanda.itens);
  },
});
const operacao = fs.readFileSync("js/operacao.js", "utf8");
vm.runInContext(
  operacao.slice(
    operacao.indexOf("function serializarOperacao("),
    operacao.indexOf("function dialogoOperacao("),
  ),
  ctx,
);
vm.runInContext(
  operacao.slice(
    operacao.indexOf("function identidadeItemOperacao("),
    operacao.indexOf("function bebidasOperacao("),
  ),
  ctx,
);
const fonte = fs.readFileSync("js/atendente.js", "utf8");
vm.runInContext(
  fonte.slice(
    fonte.indexOf("async function abrirComandaVisual("),
    fonte.indexOf("async function novaComandaMesa("),
  ),
  ctx,
);
(async () => {
  await ctx.abrirComandaVisual("comanda1");
  assert.equal(conferencias, 0);
  await ctx.abrirComandaVisual("comanda1");
  assert.equal(conferencias, 0);
  assert.match(area.innerHTML, /Lanche/);
  comanda.itens[0] = { quantidade: 1, nome: "Lanche" };
  await ctx.abrirComandaVisual("comanda1");
  assert.equal(conferencias, 0);
  comanda.itens[0].quantidade = 2;
  await ctx.abrirComandaVisual("comanda1");
  assert.equal(conferencias, 0);
  comanda.itens = [];
  await ctx.abrirComandaVisual("comanda1");
  assert.equal(conferencias, 0);
  comanda.status = "Fechada";
  comanda.itens = [{ nome: "Novo" }];
  const telaAnterior = area.innerHTML;
  await ctx.abrirComandaVisual("comanda1");
  assert.equal(conferencias, 0);
  assert.equal(area.innerHTML, telaAnterior);
  const produtos = fs.readFileSync("js/produto-comanda.js", "utf8");
  vm.runInContext(
    produtos.slice(
      produtos.indexOf("async function montarAdicionaisProduto("),
      produtos.indexOf("function alterarQuantidadeProduto("),
    ),
    ctx,
  );
  assert.equal(
    await ctx.montarAdicionaisProduto({ categoria: "Bebidas", permiteAdicionais: true }),
    "",
  );
  console.log(
    "PASS: abrir comanda e visualizar alterações não enviam itens à cozinha sem conferência explícita.",
  );
})().catch((erro) => {
  console.error(erro);
  process.exitCode = 1;
});
