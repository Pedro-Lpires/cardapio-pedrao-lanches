const assert = require("node:assert/strict");
const { criarDbOperacaoRest, codificarCampos } = require("../api/_lib/operacao-firestore-rest.cjs");
let requisicoes = 0,
  versao = 1;
const base = "projects/demo-pedrao-seguranca/databases/(default)/documents/";
const db = criarDbOperacaoRest({
  projectId: "demo-pedrao-seguranca",
  colecoes: ["produtos"],
  obterToken: async () => ({ access_token: "ficticio" }),
  fetchHttp: async (url, opcoes) => {
    const body = JSON.parse(opcoes.body);
    let dados = {};
    if (url.endsWith(":beginTransaction")) dados = { transaction: "tx" };
    if (url.endsWith(":batchGet")) {
      requisicoes++;
      dados = body.documents
        .map((name) =>
          name.endsWith("/ausente")
            ? { missing: name }
            : { found: { name, fields: codificarCampos({ preco: versao }) } },
        )
        .reverse();
    }
    return { ok: true, json: async () => dados };
  },
});
(async () => {
  for (versao = 1; versao <= 2; versao++)
    await db.runTransaction(async (t) => {
      const a = db.collection("produtos").doc("a"),
        b = db.collection("produtos").doc("b"),
        n = db.collection("produtos").doc("ausente");
      const docs = await Promise.all([t.get(a), t.get(b), t.get(a), t.get(n)]);
      assert.equal(docs[0].data().preco, versao);
      assert.equal(docs[1].ref.name, base + "produtos/b");
      assert.equal(docs[2].data().preco, versao);
      assert.equal(docs[3].exists, false);
      await t.get(a);
      assert.equal(
        requisicoes,
        versao,
        "Uma ida ao banco por lote; nenhuma reutilização entre transações",
      );
    });
  console.log(
    "PASS: leituras paralelas usam lote único, mapeiam respostas fora de ordem e ausentes, sem cache de preços entre operações.",
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
