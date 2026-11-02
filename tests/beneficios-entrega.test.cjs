const fs = require("node:fs"),
  vm = require("node:vm"),
  assert = require("node:assert/strict");
const { context: c } = require("./operacao.test.cjs");
let agora = Date.parse("2026-11-15T18:00:00-04:00");
c.Date = class extends Date {
  constructor(...a) {
    super(...(a.length ? a : [agora]));
  }
  static now() {
    return agora;
  }
};
for (const p of [
  "rank-mensal",
  "beneficios-entrega",
  "beneficios-pedido",
  "editor-pedido-ui",
  "beneficios-admin-ui",
])
  vm.runInContext(fs.readFileSync("js/" + p + ".js", "utf8"), c);
const clone = (x) => JSON.parse(JSON.stringify(x)),
  id = "65999999999";
function banco(initial) {
  const docs = new Map(Object.entries(clone(initial)));
  let seq = 0,
    fila = Promise.resolve();
  const snap = (path) => ({
    id: path.split("/").at(-1),
    exists: docs.has(path),
    data: () => clone(docs.get(path) || {}),
  });
  const ref = (path) => ({ path, id: path.split("/").at(-1), get: async () => snap(path) });
  const coll = (path, filtros = []) => ({
    doc: (i) => ref(path + "/" + (i || "teste-" + ++seq)),
    where: (k, op, v) => coll(path, [...filtros, [k, v]]),
    get: async () => ({
      docs: [...docs.keys()]
        .filter(
          (k) =>
            k.startsWith(path + "/") &&
            !k.slice(path.length + 1).includes("/") &&
            filtros.every(([a, b]) => docs.get(k)[a] === b),
        )
        .map(snap),
    }),
  });
  return {
    docs,
    collection: coll,
    runTransaction: (fn) => {
      const tarefa = fila.then(async () => {
        let escreveu = false;
        const writes = new Map();
        const result = await fn({
          get: (r) => {
            assert.equal(escreveu, false, "leituras antes das escritas");
            return Promise.resolve(snap(r.path));
          },
          set: (r, d) => {
            escreveu = true;
            writes.set(r.path, clone(d));
          },
          update: (r, d) => {
            escreveu = true;
            writes.set(r.path, { ...(writes.get(r.path) || docs.get(r.path)), ...clone(d) });
          },
        });
        for (const [p, d] of writes) docs.set(p, d);
        return result;
      });
      fila = tarefa.catch(() => {});
      return tarefa;
    },
  };
}
const cfg = {
  ativo: true,
  valores: { Bronze: 0, Prata: 5, Ouro: 10, Diamante: 15, Imortal: 20 },
  limitePorPedido: 4,
  pedidoMinimo: 0,
  acumularCupom: true,
  acumularFidelidade: true,
};
const cliente = {
  telefone: id,
  nome: "Teste",
  fidelidadeAtiva: true,
  nivelCliente: "Prata",
  bonusDisponivel: 20,
  totalFidelidade: 0,
  bonusGeradoTotal: 0,
  rankMensal: {
    versao: 1,
    importadoEm: agora,
    competencia: "2026-11",
    meses: { "2026-10": 50000 },
  },
};
const pedido = (credito = 4, extra = {}) => ({
  clienteId: id,
  nome: "Teste",
  telefone: id,
  tipo: "Entrega",
  itens: [{ nome: "Lanche", preco: 50, quantidade: 1 }],
  taxaEntrega: 8,
  valorTotal: 58 - credito,
  descontoCreditoEntrega: credito,
  creditoEntregaMes: "2026-11",
  pagamento: "Pix",
  ...extra,
});
const estado = () => c.db.docs.get("clientes/" + id);
const saldo = () => c.saldoBeneficiosEntregaUI(estado(), cfg);
(async () => {
  const off = c.configurarBeneficiosEntregaUI();
  assert.equal(off.ativo, false);
  assert.equal(off.valores.Prata, 0, "nenhum valor liberado antes de configurar");
  assert.equal(c.calcularBeneficioEntregaUI(cliente, off, pedido()).centavos, 0);
  assert.equal(c.calcularBeneficioEntregaUI(null, cfg, pedido()).centavos, 0);
  assert.equal(
    c.calcularBeneficioEntregaUI({ ...cliente, fidelidadeAtiva: false }, cfg, pedido()).centavos,
    0,
  );
  assert.equal(
    c.calcularBeneficioEntregaUI(cliente, cfg, pedido(0, { tipo: "Retirada" })).centavos,
    0,
  );
  assert.equal(c.calcularBeneficioEntregaUI(cliente, cfg, pedido()).centavos, 400);
  assert.equal(
    c.calcularBeneficioEntregaUI(cliente, cfg, pedido(0, { taxaEntrega: 2 })).centavos,
    200,
    "nunca passa do frete",
  );
  assert.equal(
    c.calcularBeneficioEntregaUI(cliente, { ...cfg, limitePorPedido: 0 }, pedido()).centavos,
    500,
    "zero no limite por entrega usa só o saldo mensal",
  );
  assert.equal(
    c.calcularBeneficioEntregaUI(cliente, { ...cfg, pedidoMinimo: 51 }, pedido()).centavos,
    0,
  );
  assert.equal(
    c.calcularBeneficioEntregaUI(
      cliente,
      { ...cfg, acumularCupom: false },
      pedido(0, { descontoCupom: 5 }),
    ).centavos,
    0,
  );
  assert.equal(
    c.calcularBeneficioEntregaUI(
      cliente,
      { ...cfg, acumularFidelidade: false },
      pedido(0, { descontoFidelidade: 10 }),
    ).centavos,
    0,
  );
  assert.equal(
    c.calcularBeneficioEntregaUI(
      cliente,
      cfg,
      pedido(0, { descontoCupom: 6, descontoCupomTaxa: 6 }),
    ).centavos,
    200,
  );
  assert.equal(
    c.calcularBeneficioEntregaUI(cliente, cfg, pedido(0, { descontoCupom: 100 })).centavos,
    0,
    "não consome crédito se o cupom já zerou o total",
  );
  assert.throws(
    () => c.validarBeneficiosAdminUI({ ...cfg, valores: { ...cfg.valores, Prata: -1 } }),
    /valores/,
  );
  c.db = banco({ ["clientes/" + id]: cliente, "config/beneficios": { creditoEntrega: cfg } });
  c.adminAvancadoLiberado = true;
  const configInicial = { creditoEntrega: cfg };
  const pausado = await c.salvarConfigBeneficiosAdminUI({ ...cfg, ativo: false }, configInicial);
  assert.equal(
    c.calcularBeneficioEntregaUI(estado(), c.configurarBeneficiosEntregaUI(pausado), pedido())
      .centavos,
    0,
    "pausa global bloqueia novos usos de quem já tinha limite",
  );
  await assert.rejects(c.salvarConfigBeneficiosAdminUI(cfg, configInicial), /mudou em outra tela/);
  const retomado = await c.salvarConfigBeneficiosAdminUI(cfg, pausado);
  assert.equal(retomado.creditoEntrega.valores.Prata, 5, "retomar preserva valores configurados");
  assert.equal(saldo().disponivel, 500);
  const a = c.db.collection("pedidos").doc("a"),
    b = c.db.collection("pedidos").doc("b");
  const concorrentes = await Promise.allSettled([
    c.salvarPedidoComCupomOperacao(a, pedido()),
    c.salvarPedidoComCupomOperacao(b, pedido()),
  ]);
  assert.equal(
    concorrentes.filter((x) => x.status === "fulfilled").length,
    1,
    "duas abas não gastam o mesmo saldo",
  );
  assert.equal(saldo().reservado, 400);
  assert.equal(saldo().disponivel, 100);
  await c.salvarPedidoComCupomOperacao(a, pedido());
  assert.equal(saldo().reservado, 400, "repetir o mesmo pedido não reserva de novo");
  await c.salvarPedidoComCupomOperacao(b, pedido(1));
  assert.equal(saldo().reservado, 500);
  assert.equal(saldo().disponivel, 0);
  const pausaComReserva = await c.salvarConfigBeneficiosAdminUI({ ...cfg, ativo: false }, retomado);
  assert.equal(saldo().reservado, 500, "pausar preserva as reservas existentes");
  await c.salvarConfigBeneficiosAdminUI(cfg, pausaComReserva);
  assert.equal(saldo().disponivel, 0, "retomar não recarrega o saldo já reservado");
  await c.registrarRecebimentoPedidoOperacao("a", false);
  assert.equal(saldo().utilizado, 400);
  assert.equal(saldo().reservado, 100);
  assert.equal(
    estado().rankMensal.meses["2026-11"],
    5000,
    "subsídio do frete não reduz nem aumenta compras em produtos",
  );
  assert.equal(c.db.docs.get("pedidos/a").creditoEntrega.status, "utilizado");
  await c.registrarRecebimentoPedidoOperacao("a", false);
  assert.equal(saldo().utilizado, 400);
  await c.cancelarPedidoPerfilTransacaoUI("a");
  assert.equal(saldo().utilizado, 0);
  assert.equal(saldo().disponivel, 400);
  assert.equal(c.db.docs.get("pedidos/a").creditoEntrega.devolvidoTotal, 400);
  await c.cancelarPedidoPerfilTransacaoUI("a");
  assert.equal(saldo().disponivel, 400, "cancelamento repetido não cria saldo");
  const orig = c.db.docs.get("pedidos/b");
  await c.salvarEdicaoPedidoTransacaoUI("b", orig, {
    ...orig,
    tipo: "Retirada",
    taxaEntrega: 0,
    descontoCupom: 0,
    descontoFidelidade: 0,
    ajusteArredondamento: 0,
  });
  assert.equal(saldo().reservado, 0);
  assert.equal(saldo().disponivel, 500, "conversão para retirada devolve a reserva");
  assert.equal(c.db.docs.get("pedidos/b").descontoCreditoEntrega, 0);
  const antes = JSON.stringify([...c.db.docs]);
  await assert.rejects(
    c.db.runTransaction(async (t) => {
      const p = await c.prepararBeneficioEntregaUI(t, pedido(), "reservar");
      p.salvar();
      throw Error("falha");
    }),
    /falha/,
  );
  assert.equal(JSON.stringify([...c.db.docs]), antes, "rollback não debita saldo");
  await assert.rejects(
    c.salvarPedidoComCupomOperacao(c.db.collection("pedidos").doc("forjado"), pedido(9)),
    /benefícios.*atualizados/,
  );
  const c0 = estado();
  c0.rankMensal.meses["2026-11"] = 70000;
  c.db.docs.set("clientes/" + id, c0);
  assert.equal(saldo().limite, 1000, "subida de rank só aumenta o limite");
  await c.salvarPedidoComCupomOperacao(c.db.collection("pedidos").doc("c"), pedido());
  assert.equal(saldo().disponivel, 600);
  agora = Date.parse("2026-12-01T00:00:00-04:00");
  assert.equal(
    saldo().disponivel,
    1000,
    "novo mês tem limite próprio, sem carregar os seis reais restantes",
  );
  await c.cancelarPedidoPerfilTransacaoUI("c");
  assert.equal(saldo().disponivel, 1000, "estorno do mês anterior não aumenta saldo do mês novo");
  assert.equal(estado().bonusDisponivel, 20, "saldo de fidelidade permanece separado");
  console.log(
    "PASS: benefícios desligados por padrão, configuração, tetos, mensalidade, reserva concorrente, pagamento, edição, cancelamento e rollback.",
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
