const assert = require("node:assert/strict");
const { fixture } = require("./pedido-publico.test.cjs");
(async () => {
  const f = fixture(),
    authorization = "Bearer cliente",
    id = "65999999999";
  const c = f.registros.get("clientes/" + id);
  c.rankMensal = { meses: {} };
  c.fidelidadeAtiva = false;
  c.codigoAtivacao = "0123";
  f.registros.set("pedidos/pago", {
    clienteId: id,
    tipo: "Entrega",
    valorTotal: 430,
    taxaEntrega: 30,
    pagamentoConfirmado: true,
    data: "2026-11-02T18:00:00Z",
  });
  f.registros.set("pedidos/cancelado", {
    clienteId: id,
    tipo: "Retirada",
    cancelado: true,
    valorTotal: 9000,
    pagamentoConfirmado: true,
    data: "2026-11-02T18:00:00Z",
  });
  f.registros.set("pedidos/outra-pessoa", {
    clienteId: "65911111111",
    tipo: "Retirada",
    valorTotal: 9999,
    pagamentoConfirmado: true,
    data: "2026-11-02T18:00:00Z",
  });
  let perfil = await f.servico.perfil({ authorization });
  assert.equal(perfil.cliente.rankMensal.meses["2026-11"], 40000);
  assert.equal(perfil.cliente.nivelCliente, "Sem nível");
  await assert.rejects(
    f.servico.ativar({ authorization, codigo: "9999" }),
    (e) => e.status === 409,
  );
  assert.equal((await f.servico.ativar({ authorization, codigo: "0123" })).ativado, true);
  assert.equal((await f.servico.ativar({ authorization, codigo: "0123" })).ativado, false);
  perfil = await f.servico.perfil({ authorization });
  assert.equal(perfil.cliente.nivelCliente, "Prata");
  assert.equal(
    perfil.cliente.rankMensal.meses["2026-11"],
    40000,
    "Conferência repetida não duplica compras importadas",
  );
  assert.equal(perfil.cliente.bonusDisponivel, 10);
  await assert.rejects(f.servico.perfil({}), (e) => e.status === 401);
  f.registros.set("clientes/" + id + "/mensagens/m", { remetente: "admin", cupomCodigo: "PRATA" });
  f.registros.set("cuponsDesconto/PRATA", {
    ativo: true,
    nome: "Promo Prata",
    tipo: "pedido",
    modo: "porcentagem",
    valor: 10,
    clientesPermitidos: [id, "OUTRO"],
    rankRegra: { acesso: "crescente", nivel: "Prata" },
  });
  f.registros.set("clientes/" + id + "/mensagens/x", { remetente: "admin", cupomCodigo: "OURO" });
  f.registros.set("cuponsDesconto/OURO", {
    ativo: true,
    nome: "Só Ouro",
    tipo: "pedido",
    modo: "valor",
    valor: 10,
    rankRegra: { acesso: "exclusivo", nivel: "Ouro" },
  });
  const lista = (await f.servico.cupons({ authorization })).cupons;
  assert.equal(lista.length, 1);
  assert.equal(lista[0].codigo, "PRATA");
  assert.equal(
    lista[0].clientesPermitidos,
    undefined,
    "A resposta não revela outras contas nem as regras privadas",
  );
  f.registros.get("clientes/" + id).authUid = "outro";
  await assert.rejects(f.servico.perfil({ authorization }), (e) => e.status === 403);
  console.log(
    "PASS: rank calculado no servidor por pagamentos sem frete/cancelados, ativação própria e cupons projetados sem outras contas.",
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
