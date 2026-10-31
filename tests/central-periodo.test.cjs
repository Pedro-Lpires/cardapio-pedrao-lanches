const fs = require("node:fs"),
  vm = require("node:vm"),
  assert = require("node:assert/strict");
const campos = {},
  consultas = [];
let pedido;
const campo = (id) => (campos[id] ||= { innerHTML: "", hidden: false, querySelector: () => null });
const ctx = vm.createContext({
  console,
  URLSearchParams,
  location: { search: "" },
  setTimeout: () => 1,
  clearTimeout() {},
  document: {
    addEventListener() {},
    getElementById: campo,
    querySelector: () => null,
    querySelectorAll: () => [],
  },
  window: { addEventListener() {} },
  db: {
    collection(c) {
      return {
        where(ch, op, v) {
          consultas.push({ c, ch, op, v });
          return {
            get: async () => ({
              docs: c === "pedidos" ? [{ id: "antes-limpeza", data: () => pedido }] : [],
            }),
          };
        },
      };
    },
  },
});
vm.runInContext(fs.readFileSync("js/operacao.js", "utf8"), ctx);
ctx.htmlCarregandoUI = () => "";
ctx.aplicarNumerosDiariosOperacao = () => {};
ctx.acoesRegistroUI = () => "";
(async () => {
  const dia = ctx.janelaOperacionalOperacao().inicio;
  pedido = {
    nome: "Pedido antes da limpeza",
    tipo: "Entrega",
    dataMs: dia + 1000,
    valorTotal: 30,
    itens: [],
    distanciaKm: 18,
  };
  vm.runInContext(
    'tipoCentralOperacao="Entrega";idCentralOperacao=null;corteManualProducaoOperacao=Date.now();',
    ctx,
  );
  await ctx.carregarCentralOperacao();
  assert(
    campos["registros-operacao"].innerHTML.includes("Pedido antes da limpeza"),
    JSON.stringify(campos["registros-operacao"]),
  );
  assert.equal(
    consultas.find((x) => x.c === "pedidos").v,
    dia,
    "Atendente consulta o período, nunca o corte da chapa",
  );
  assert.match(campos["registros-operacao"].innerHTML, /Fora da nossa área/);
  assert(!ctx.avisoDistanciaEntregaOperacao({ ...pedido, distanciaKm: 10 }));
  assert.match(ctx.avisoDistanciaEntregaOperacao({ ...pedido, distanciaKm: 12 }), /Percurso longo/);
  assert.match(
    ctx.avisoDistanciaEntregaOperacao({ ...pedido, distanciaKm: 15.01 }),
    /Fora da nossa área/,
  );
  assert(
    ctx.distanciaEntregaOperacao({
      localizacao: "https://www.google.com/maps?q=-15.7508,-56.1035",
    }) > 22,
    "GPS antigo recupera o aviso",
  );
  const dados = {
    nome: "Cliente",
    valorTotal: 25,
    itens: [{ nome: "Lanche", quantidade: 1, categoria: "lanches", observacao: "Sem cebola" }],
    observacao: "Entregar na portaria",
  };
  const chapa = ctx.gerarImpressaoOperacao("cozinha", dados);
  assert(!chapa.includes("Entregar na portaria"));
  assert(chapa.includes("Sem cebola"));
  assert(ctx.gerarImpressaoOperacao("geral", dados).includes("Entregar na portaria"));
  console.log(
    "PASS: limpeza da cozinha preserva lista do atendente; avisos de 10/15 km e GPS legado.",
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
