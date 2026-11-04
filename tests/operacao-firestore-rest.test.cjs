const assert = require("node:assert/strict");
const {
  criarDbOperacaoRest,
  codificarCampos,
  lerCampos,
  codificarValor,
} = require("../api/_lib/operacao-firestore-rest.cjs");
const recurso = "projects/demo-pedrao-seguranca/databases/(default)/documents";
const dados = {
  nome: "Pessoa Teste",
  ativo: true,
  vazio: null,
  preco: 3.5,
  itens: [{ quantidade: 2, obs: "Teste" }],
  carteira: { meses: { "2026-11": { reservado: 500 } } },
};
assert.deepEqual(lerCampos(codificarCampos(dados)), dados);
assert.throws(() => codificarValor(undefined));
assert.throws(() => codificarValor(Infinity));
(async () => {
  let abortar = true,
    rollback = 0,
    commits = 0,
    transacoes = 0,
    leituras = 0;
  const db = criarDbOperacaoRest({
    projectId: "demo-pedrao-seguranca",
    obterToken: async () => ({ access_token: "token-ficticio" }),
    colecoes: ["pedidos"],
    fetchHttp: async (url, opcoes) => {
      assert(url.startsWith("https://firestore.googleapis.com/v1/" + recurso));
      assert.equal(opcoes.headers.Authorization, "Bearer token-ficticio");
      const body = opcoes.body ? JSON.parse(opcoes.body) : null;
      const ok = (v) => ({ ok: true, json: async () => v });
      if (url.endsWith(":beginTransaction")) {
        transacoes++;
        return ok({ transaction: "tx-" + transacoes });
      }
      if (url.endsWith(":batchGet")) {
        leituras++;
        assert.equal(body.documents[0], recurso + "/pedidos/p");
        assert.equal(body.transaction, "tx-" + transacoes);
        return ok([{ found: { name: recurso + "/pedidos/p", fields: codificarCampos(dados) } }]);
      }
      if (url.endsWith(":commit")) {
        commits++;
        assert.equal(body.writes.length, 2);
        assert.deepEqual(body.writes[0].updateMask.fieldPaths, ["carteira"]);
        assert.deepEqual(body.writes[0].currentDocument, { exists: true });
        assert.deepEqual(body.writes[1].updateMask.fieldPaths, ["nome"]);
        if (abortar) {
          abortar = false;
          return { ok: false, status: 409, json: async () => ({ error: { status: "ABORTED" } }) };
        }
        return ok({});
      }
      if (url.endsWith(":rollback")) {
        rollback++;
        return ok({});
      }
      if (url.endsWith(":runQuery")) {
        assert.equal(body.structuredQuery.where.fieldFilter.op, "EQUAL");
        return ok([{ document: { name: recurso + "/pedidos/p", fields: codificarCampos(dados) } }]);
      }
      assert(url.endsWith("/pedidos/p"));
      return ok({ fields: codificarCampos(dados) });
    },
  });
  assert.throws(() => db.collection("atendentes"));
  assert.throws(() => db.collection("pedidos").doc("../proibido"));
  assert.throws(() => db.collection("pedidos").doc(".."));
  assert.throws(() => db.collection("pedidos").where("nome)", "==", "Teste"));
  assert.deepEqual((await db.collection("pedidos").doc("p").get()).data(), dados);
  assert.equal(
    (await db.collection("pedidos").where("nome", "==", dados.nome).limit(2).get()).docs.length,
    1,
  );
  await assert.rejects(
    db.collection("pedidos").where("nome", "==", dados.nome).limit(1).get(),
    /limite/,
  );
  const r = await db.runTransaction(async (t) => {
    const ref = db.collection("pedidos").doc("p");
    const d = await t.get(ref);
    await t.get(ref);
    t.update(ref, { carteira: d.data().carteira });
    t.set(ref, { nome: dados.nome }, { merge: true });
    return "concluído";
  });
  assert.equal(r, "concluído");
  assert.equal(commits, 2);
  assert.equal(rollback, 1);
  assert.equal(leituras, 2, "Cache de leituras isolado por tentativa, nunca entre transações");
  await assert.rejects(
    db.runTransaction((t) =>
      t.get({ path: "pedidos/p", name: "projects/outro/databases/(default)/documents/pedidos/p" }),
    ),
    /Referência inválida/,
  );
  assert.equal(rollback, 2);
  console.log(
    "PASS: transporte de operação restrito, campos aninhados, consulta limitada, máscara de atualização, rollback/retry e rejeição de outro projeto.",
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
