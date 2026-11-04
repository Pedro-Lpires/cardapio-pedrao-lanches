const assert = require("node:assert/strict");
const { criarDbRecuperacaoRest } = require("../api/_lib/recuperacao-firestore-rest.cjs");
const { criarArmazenamentoRecuperacao } = require("../api/_lib/recuperacao-acesso.cjs");
let documento = null,
  sequencia = 0,
  conflito = false;
const chamadas = [];
const resposta = (status, dados) => ({ status, ok: status < 400, json: async () => dados });
const db = criarDbRecuperacaoRest({
  projectId: "pedrao-teste",
  obterToken: async () => ({ access_token: "credencial-ficticia" }),
  fetchHttp: async (endereco, opcoes) => {
    const url = new URL(endereco);
    assert.equal(url.origin, "https://firestore.googleapis.com");
    assert.equal(opcoes.headers.Authorization, "Bearer credencial-ficticia");
    const body = opcoes.body ? JSON.parse(opcoes.body) : null;
    chamadas.push({ url, body });
    if (url.pathname.endsWith(":beginTransaction"))
      return resposta(200, { transaction: "transacao-" + ++sequencia });
    if (url.pathname.endsWith(":rollback")) return resposta(200, {});
    if (url.pathname.endsWith(":batchGet")) {
      assert.match(body.transaction, /^transacao-/);
      return resposta(200, [documento ? { found: documento } : { missing: body.documents[0] }]);
    }
    if (url.pathname.endsWith(":commit")) {
      if (conflito) {
        conflito = false;
        return resposta(409, { error: { status: "ABORTED" } });
      }
      assert.match(body.transaction, /^transacao-/);
      const write = body.writes[0];
      assert.equal(
        write.update.name,
        "projects/pedrao-teste/databases/(default)/documents/authRecuperacoes/cliente1",
      );
      if (write.updateMask) {
        assert.deepEqual(write.updateMask.fieldPaths.sort(), [
          "revogadoAntesEm",
          "status",
          "utilizadoEm",
        ]);
        documento.fields = { ...documento.fields, ...write.update.fields };
      } else documento = write.update;
      return resposta(200, {});
    }
    assert.equal(opcoes.method, "GET");
    assert.match(url.pathname, /\/authRecuperacoes\/cliente1$/);
    return documento ? resposta(200, documento) : resposta(404, {});
  },
});
(async () => {
  const store = criarArmazenamentoRecuperacao(db);
  assert.equal(await store.ler("cliente1"), null);
  conflito = true;
  await store.emitir(
    "cliente1",
    {
      hash: "a".repeat(64),
      emitidoEm: 1000,
      expiraEm: 1801000,
      status: "emitido",
      adminUid: "adm",
    },
    60000,
  );
  assert.equal(sequencia, 2, "Refaz transação abortada pelo Firestore");
  assert(chamadas.some((c) => c.url.pathname.endsWith(":rollback")));
  const atual = await store.ler("cliente1");
  assert.equal(atual.emitidoEm, 1000, "Datas integerValue são lidas como números");
  await store.consumir("cliente1", "a".repeat(64), 2000);
  assert.equal((await store.ler("cliente1")).status, "utilizado");
  assert.equal(
    (await store.ler("cliente1")).hash,
    "a".repeat(64),
    "Update mantém campos não alterados",
  );
  await assert.rejects(store.consumir("cliente1", "a".repeat(64), 2001), (e) => e.status === 410);
  assert.throws(() => db.collection("clientes"));
  assert.throws(() => db.collection("authRecuperacoes").doc("cliente/fora"));
  assert(
    chamadas.some((c) => c.url.pathname.endsWith(":batchGet") && c.body.transaction),
    "Leitura ocorre dentro da transação",
  );
  console.log(
    "PASS: transporte REST privado, credencial no cabeçalho, datas, transação/rollback/retry, máscara de atualização e recusa de outras coleções.",
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
