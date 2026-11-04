const assert = require("node:assert/strict");
const { fixture } = require("./pedido-publico.test.cjs");
(async () => {
  const f = fixture(),
    authorization = "Bearer cliente",
    chave = "c".repeat(64);
  const d = {
    authorization,
    chave,
    categoria: "outros",
    texto: "Minha mensagem",
    referenciaPedido: "pedidos/p",
  };
  f.registros.set("pedidos/p", { clienteAuthUid: "outra-pessoa", clienteId: "65999999999" });
  await assert.rejects(f.servico.suporte(d), (e) => e.status === 403);
  f.registros.get("pedidos/p").clienteAuthUid = "cliente";
  const criado = await f.servico.suporte(d);
  assert.equal((await f.servico.suporte(d)).id, criado.id);
  const raiz = "clientes/65999999999/chamados/" + criado.id;
  assert.equal(f.registros.get(raiz).clienteNome, "Cliente Teste");
  assert.equal(f.registros.get(raiz + "/mensagens/inicial").remetente, "cliente");
  await assert.rejects(
    f.servico.suporte({ ...d, texto: "Outro chamado" }),
    (e) => e.status === 409,
  );
  const resposta = {
    authorization,
    chamadoId: criado.id,
    texto: "Resposta",
    chave: "d".repeat(64),
    remetente: "admin",
  };
  assert.equal((await f.servico.responderSuporte(resposta)).repetido, false);
  assert.equal((await f.servico.responderSuporte(resposta)).repetido, true);
  assert.equal([...f.registros.keys()].filter((p) => p.startsWith(raiz + "/mensagens/")).length, 2);
  assert.equal(
    (await f.servico.encerrarSuporte({ authorization, chamadoId: criado.id })).encerrado,
    true,
  );
  assert.equal(f.registros.get(raiz).status, "finalizado");
  await assert.rejects(
    f.servico.responderSuporte({ ...resposta, chave: "e".repeat(64) }),
    (e) => e.status === 409,
  );
  await assert.rejects(
    f.servico.encerrarSuporte({ chamadoId: criado.id }),
    (e) => e.status === 401,
  );
  await assert.rejects(
    f.servico.suporte({ ...d, referenciaPedido: "atendentes/privado" }),
    (e) => e.status === 400,
  );
  console.log(
    "PASS: suporte próprio valida o pedido associado, cria e responde uma vez, usa remetente confiável e impede resposta após encerrar.",
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
