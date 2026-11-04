const assert = require("node:assert/strict");
const { criarArmazenamentoAcessoCliente } = require("../api/_lib/acesso-cliente-rest.cjs");
const campos = {
  nome: { stringValue: "Pessoa Teste" },
  bonus: { doubleValue: 12.5 },
  ativo: { booleanValue: true },
  enderecos: {
    arrayValue: { values: [{ mapValue: { fields: { rua: { stringValue: "Rua Teste" } } } }] },
  },
};
let chamadas = [],
  tentativas = new Map();
const base = "projects/pedrao-teste/databases/(default)/documents";
const db = criarArmazenamentoAcessoCliente({
  projectId: "pedrao-teste",
  obterToken: async () => ({ access_token: "oauth-ficticio" }),
  fetchHttp: async (url, opcoes) => {
    assert.equal(new URL(url).origin, "https://firestore.googleapis.com");
    assert.equal(opcoes.headers.Authorization, "Bearer oauth-ficticio");
    const caminho = url.split("/documents")[1];
    const body = opcoes.body ? JSON.parse(opcoes.body) : undefined;
    chamadas.push({ caminho, body, opcoes });
    let json = {};
    if (caminho.startsWith("/clientes/")) json = { fields: campos };
    else if (caminho.startsWith("/clientes?"))
      json = { documents: [{ name: base + "/clientes/65999999999", fields: campos }] };
    else if (caminho.startsWith("/authClientesTeste/")) return { ok: false, status: 404 };
    else if (caminho === ":beginTransaction") json = { transaction: "transacao-teste" };
    else if (caminho === ":batchGet")
      json = body.documents.map((nome) =>
        tentativas.has(nome)
          ? { found: { name: nome, fields: tentativas.get(nome) } }
          : { missing: nome },
      );
    else if (caminho.startsWith("/authTentativasCliente/")) {
      const nome = base + caminho.split("?")[0];
      if (!tentativas.has(nome)) return { ok: false, status: 404 };
      json = { fields: tentativas.get(nome) };
    } else if (caminho === ":commit") {
      for (const w of body.writes || [])
        if (w.update.name.includes("/authTentativasCliente/"))
          tentativas.set(w.update.name, w.update.fields);
    } else if (caminho === ":runQuery")
      json = [{ document: { name: base + "/clientes/65999999999", fields: campos } }];
    return { ok: true, status: 200, json: async () => json };
  },
});
(async () => {
  const c = await db.lerCliente("65999999999");
  assert.equal(c.bonus, 12.5);
  assert.equal(c.ativo, true);
  assert.equal(c.enderecos[0].rua, "Rua Teste");
  assert.equal(await db.lerAprovacaoTeste("65999999999"), null);
  assert.equal((await db.listarClientesTeste())[0].telefone, "65999999999");
  await db.vincularCliente("65999999999", "uid-teste", c, true, 1000);
  let escrita = chamadas.at(-1).body.writes[0];
  assert.deepEqual(escrita.updateMask.fieldPaths, ["authUid", "acessoSenhaCriadoEm"]);
  assert.equal(escrita.currentDocument.exists, true);
  assert.equal("nome" in escrita.update.fields, false, "Migração não regrava saldos nem histórico");
  await db.vincularCliente("65999999999", "uid-teste", c, false, 1000);
  escrita = chamadas.at(-1).body.writes[0];
  assert.equal(escrita.currentDocument.exists, false);
  assert.equal(escrita.update.fields.nome.stringValue, "Pessoa Teste");
  await db.aprovarTestes([{ telefone: "65999999999", adminUid: "dono", preparadoEm: 1000 }]);
  assert.equal(chamadas.at(-1).body.writes[0].update.name, base + "/authClientesTeste/65999999999");
  assert.equal((await db.buscarClienteCodigo("4979")).telefone, "65999999999");
  await assert.rejects(db.lerCliente("../fora"));
  for (let n = 0; n < 5; n++) await db.consumirTentativa("65999999999", 1000);
  await assert.rejects(db.consumirTentativa("65999999999", 1001), (e) => e.status === 429);
  assert.equal(chamadas.at(-1).caminho, ":rollback");
  await db.consumirTentativa("65999999999", 1000 + 15 * 60 * 1000);
  await db.consumirTentativa("codigo:4979", 1000 + 15 * 60 * 1000);
  assert.equal(JSON.stringify([...tentativas.keys()]).includes("65999999999"), false);
  assert.equal(
    [...tentativas.values()].every((v) => Object.keys(v).length === 2),
    true,
  );
  console.log(
    "PASS: transporte Auth/cadastro por REST, dados aninhados, vínculo sem regravar benefícios, aprovação privada e limite transacional com renovação da janela.",
  );
})().catch((erro) => {
  console.error(erro);
  process.exitCode = 1;
});
