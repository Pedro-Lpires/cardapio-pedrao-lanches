const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  vm = require("node:vm");
const salvos = [],
  avisos = [];
let contadores = 0;
const campos = {};
const ctx = vm.createContext({
  console,
  document: {
    getElementById: (id) => campos[id] || null,
    querySelector: () => ({ value: "Pix + Crédito" }),
  },
  mostrarAvisoUI: (m) => avisos.push(m),
  alert: (m) => avisos.push(m),
  centavosOperacao: (v) => Math.round(Number(v || 0) * 100),
  prepararContadorPedidoOperacao: async () => {
    contadores++;
    return { id: "contadorPedidos_teste" };
  },
  reservarNumeroEntregaOperacao: async () => 1,
  abrirCentralOperacao: async () => {},
  db: {
    runTransaction: async (fn) => fn({ get: async () => ({ exists: false }), set() {} }),
    collection: () => ({
      add: async (p) => {
        salvos.push(structuredClone(p));
        return { id: "pedido-teste", update: async () => {} };
      },
    }),
  },
});
function carregar(nome, arquivo) {
  const s = fs.readFileSync(arquivo, "utf8"),
    inicio = s.search(new RegExp("(?:async )?function " + nome + "\\(")),
    fim = s.slice(inicio + 1).search(/\n(?:async )?function /);
  assert(inicio >= 0);
  vm.runInContext(s.slice(inicio, fim < 0 ? undefined : inicio + 1 + fim), ctx);
}
carregar("validarDivisaoPedidoAtendenteUI", "js/pedido-atendente-ui.js");
for (const nome of ["salvarPedidoRetiradaAtendente", "salvarPedidoEntregaAtendente"])
  carregar(nome, "js/atendente.js");
(async () => {
  for (const tipo of ["Retirada", "Entrega"]) {
    const p = {
      nome: "Cliente Exemplo",
      itens: [{ nome: "Lanche", quantidade: 1, subtotal: 33, totalMolhosPagos: 4 }],
      formas: [
        { forma: "Pix", valor: 12 },
        { forma: "Crédito", valor: 25 },
      ],
      formaPagamento: "Pix + Crédito",
    };
    campos["taxa-pedido-entrega"] = { value: "8" };
    const chave = "pedido" + tipo + "Atual";
    ctx[chave] = structuredClone(p);
    const salvar = ctx["salvarPedido" + tipo + "Atendente"];
    if (tipo === "Entrega") {
      const antes = contadores;
      await salvar();
      assert.equal(contadores, antes, "Divisão sem a taxa não grava nem reserva número");
      ctx[chave].formas[1].valor = 33;
    }
    await salvar();
    const salvo = salvos.at(-1);
    assert.equal(salvo.tipo, tipo);
    assert.equal(salvo.valorTotal, tipo === "Entrega" ? 45 : 37);
    assert.equal(
      salvo.formas.reduce((n, f) => n + f.valor, 0),
      salvo.valorTotal,
    );
    assert.equal(salvo.pagamento, "Pix + Crédito");
    assert(!salvo.pagamentoConfirmado, "Escolher pagamento não confirma recebimento");
  }
  const antes = salvos.length;
  ctx.pedidoRetiradaAtual = {
    nome: "Exemplo",
    itens: [{ subtotal: 42 }],
    formas: [
      { forma: "Pix", valor: 12 },
      { forma: "Crédito", valor: 25 },
    ],
  };
  await ctx.salvarPedidoRetiradaAtendente();
  assert.equal(salvos.length, antes, "Adicionar item exige conferir divisão");
  assert.equal(
    ctx.validarDivisaoPedidoAtendenteUI(
      {
        formas: [
          { forma: "Pix", valor: 10 },
          { forma: "Dinheiro", valor: -1 },
        ],
      },
      9,
    ),
    false,
  );
  console.log(
    "PASS: criação de retirada e entrega preserva pagamento dividido; taxa e itens exigem soma correta antes de gravar, sem confirmar recebimento.",
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
