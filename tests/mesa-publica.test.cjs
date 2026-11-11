const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
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
  const ctx = vm.createContext({ db: f.db });
  vm.runInContext(fs.readFileSync("js/mesas-limpeza.js", "utf8"), ctx);
  f.liberar = () => ctx.liberarMesaSemComandasAbertasOperacao("mesa-20", 20);
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
  const pedidosDoGrupo = await Promise.all([
    f.mesas.enviar({ ...a, itens: [item], valorTotalEsperado: 25 }),
    f.mesas.enviar({ ...b, itens: [item], valorTotalEsperado: 25 }),
  ]);
  const ids = pedidosDoGrupo.map((p) => p.sessao.comandaId);
  assert.notEqual(ids[0], ids[1], "Cada pessoa fica com sua própria comanda");
  assert(ids.every((id) => f.registros.get("filaCozinha/" + id).status === "aguardando"));
  assert.equal(f.registros.get("config/contadorPedidos_2026-11-03").ultimoNumero, 2);
  await assert.rejects(f.mesas.iniciar(visita), (e) => e.status === 409);
  assert.equal(
    (await f.mesas.enviar({ ...a, itens: [item], valorTotalEsperado: 25 })).sessao.comandaId,
    ids[0],
    "Repetir um envio devolve a mesma comanda",
  );

  f = montar();
  await Promise.all([f.mesas.iniciar(a), f.mesas.iniciar(b)]);
  f.registros.set("comandas/atendente-teste", { mesa: 20, status: "Aberta" });
  Object.assign(f.registros.get("mesas/mesa-20"), {
    ocupada: true,
    ultimaComandaAbertaId: "atendente-teste",
  });
  await assert.rejects(f.mesas.iniciar(visita), (e) => e.status === 409);
  const depoisAtendente = await f.mesas.enviar({ ...a, itens: [item], valorTotalEsperado: 25 });
  assert.equal(f.registros.get("filaCozinha/" + depoisAtendente.sessao.comandaId).mesa, 20);
  f.registros.get("comandas/atendente-teste").status = "Fechada";
  await f.liberar();
  assert.equal(f.registros.get("mesas/mesa-20").ocupada, true, "Outra comanda está aberta");
  f.registros.get("comandas/" + depoisAtendente.sessao.comandaId).status = "Fechada";
  await f.liberar();
  assert.equal(f.registros.get("mesas/mesa-20").ocupada, false);
  await f.mesas.iniciar(visita);
  await f.mesas.enviar({ ...visita, itens: [item], valorTotalEsperado: 25 });
  await assert.rejects(
    f.mesas.enviar({ ...b, itens: [item], valorTotalEsperado: 25 }),
    (e) => e.status === 410,
    "Carrinho do grupo anterior não envia mesmo após outro grupo ocupar a mesa",
  );
  assert.equal((await f.mesas.retomar(b)).sessaoEncerrada, true);
  f = montar();
  await f.mesas.iniciar(visita);
  f.avancar(86400000);
  assert.equal(
    (await f.mesas.retomar(visita)).sessaoEncerrada,
    true,
    "Carrinho de outro dia não abre atendimento",
  );
  assert.equal((await f.mesas.retomar(visita)).rascunhoExpirado, true);
  const novaVisita = await f.mesas.iniciar({
    ...visita,
    segredo: "9".repeat(64),
    nome: "Nome novo",
  });
  assert.equal(novaVisita.sessao.nome, "Nome novo");
  assert.equal(novaVisita.sessao.pedidoEnviado, false);
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
    "PASS: mesa protegida libera as visitas anteriores à ocupação, preserva comandas separadas, evita duplicação e encerra carrinhos ao liberar a mesa.",
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
