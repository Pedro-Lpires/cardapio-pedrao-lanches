const assert = require("node:assert/strict");
const { fixture } = require("./pedido-publico.test.cjs");
const { criarServicoMesaPublica } = require("../api/_lib/mesa-publica.cjs");
function montar() {
  const f = fixture();
  let em = Date.parse("2026-11-03T18:00:00Z");
  const tokens = [];
  f.mesas = criarServicoMesaPublica({
    db: f.db,
    pedidos: f.servico,
    auth: {
      createCustomToken: async (uid, claims) => {
        tokens.push({ uid, claims });
        return "token-de-visita";
      },
    },
    consumirTentativa: async () => {},
    agora: () => em,
  });
  f.avancar = (ms) => (em += ms);
  f.tokens = tokens;
  return f;
}
const visita = { mesa: 20, segredo: "a".repeat(64), nome: "Pessoa da mesa" };
const item = { produtoId: "bagunca", quantidade: 1, tipoCarne: "artesanal", preco: 0.01 };
(async () => {
  let f = montar();
  const estado = await f.mesas.estado({ mesa: 20 });
  assert.deepEqual(estado, { mesa: { id: "mesa-20", numero: 20, ocupada: false } });
  const primeira = await f.mesas.iniciar(visita);
  const segunda = await f.mesas.iniciar(visita);
  assert.equal(primeira.sessao.id, segunda.sessao.id);
  assert.equal(primeira.token, undefined, "Visita sem pedido não recebe acesso ao banco privado");
  assert.equal(
    (await f.mesas.retomar({ mesa: 20, segredo: "b".repeat(64) })).sessao,
    null,
    "Conhecer a mesa ou o id não retoma outra visita",
  );
  await assert.rejects(
    f.mesas.enviar({ ...visita, itens: [item], valorTotalEsperado: 0.01 }),
    (e) => e.status === 409,
  );
  const enviado = await f.mesas.enviar({ ...visita, itens: [item], valorTotalEsperado: 25 });
  const repetido = await f.mesas.enviar({ ...visita, itens: [item], valorTotalEsperado: 25 });
  assert.equal(enviado.sessao.comandaId, repetido.sessao.comandaId);
  assert.equal(f.registros.get("comandas/" + enviado.sessao.comandaId).valorTotal, 25);
  assert.equal(f.registros.get("config/contadorPedidos_2026-11-03").ultimoNumero, 1);
  assert.equal(f.tokens[0].claims.mesaId, "mesa-20");
  assert.equal(f.tokens[0].claims.sessaoMesaId, primeira.sessao.id);
  assert.equal((await f.mesas.retomar(visita)).sessao.pedidoEnviado, true);
  await assert.rejects(
    f.mesas.iniciar({ ...visita, segredo: "c".repeat(64) }),
    (e) => e.status === 409,
  );
  assert.equal((await f.mesas.chamar({ ...visita, tipo: "conta" })).repetido, false);
  assert.equal((await f.mesas.chamar({ ...visita, tipo: "atendente" })).repetido, true);
  assert.equal([...f.registros.keys()].filter((k) => k.startsWith("chamadosMesa/")).length, 1);
  await assert.rejects(f.mesas.chamar({ mesa: 20, tipo: "conta" }), (e) => e.status === 410);
  f.registros.get("comandas/" + enviado.sessao.comandaId).status = "Fechada";
  f.registros.get("mesas/mesa-20").ocupada = false;
  assert.equal((await f.mesas.retomar(visita)).sessaoEncerrada, true);
  await assert.rejects(
    f.mesas.enviar({ ...visita, itens: [item], valorTotalEsperado: 25 }),
    (e) => e.status === 410,
  );
  assert.equal(
    (await f.mesas.iniciar({ ...visita, segredo: "d".repeat(64) })).sessao.pedidoEnviado,
    false,
  );
  f = montar();
  const a = { ...visita, segredo: "e".repeat(64) },
    b = { ...visita, segredo: "f".repeat(64) };
  await Promise.all([f.mesas.iniciar(a), f.mesas.iniciar(b)]);
  const disputa = await Promise.allSettled([
    f.mesas.enviar({ ...a, itens: [item], valorTotalEsperado: 25 }),
    f.mesas.enviar({ ...b, itens: [item], valorTotalEsperado: 25 }),
  ]);
  assert.equal(
    disputa.filter((r) => r.status === "fulfilled").length,
    1,
    "Apenas uma visita ocupa a mesa, mesmo com dois envios concorrentes",
  );
  f = montar();
  await f.mesas.iniciar(visita);
  f.avancar(86400000);
  assert.equal(
    (await f.mesas.retomar(visita)).sessaoEncerrada,
    true,
    "Carrinho de outro dia não abre atendimento",
  );
  f = montar();
  const conta = { ...visita, authorization: "Bearer cliente" };
  const criada = await f.mesas.iniciar(conta);
  assert.equal(criada.sessao.clienteAuthUid, "cliente");
  assert.equal(criada.sessao.clienteId, "65999999999");
  await assert.rejects(
    f.mesas.enviar({ ...visita, itens: [item], valorTotalEsperado: 25 }),
    (e) => e.status === 401,
  );
  const saiu = await f.mesas.vincular({ ...visita, sair: true });
  assert.equal(saiu.sessao.clienteId, null);
  const entrou = await f.mesas.vincular(conta);
  assert.equal(entrou.sessao.clienteAuthUid, "cliente");
  await assert.rejects(
    f.mesas.vincular({ ...visita, clienteId: "65999999999" }),
    (e) => e.status === 401,
  );
  await assert.rejects(f.mesas.estado({ mesa: 21 }), (e) => e.status === 400);
  console.log(
    "PASS: mesa protegida retoma só a visita correta, confere preço, ocupa uma vez, envia à chapa, deduplica chamados, preserva conta lembrada e invalida após fechamento.",
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
