const assert = require("node:assert/strict");
const { criarArmazenamentoAcessoEquipe } = require("../api/_lib/acesso-equipe-rest.cjs");
const chamadas = [],
  contadores = new Map();
const base = "projects/pedrao-teste/databases/(default)/documents";
let duplicado = false;
const documento = {
  name: base + "/atendentes/a",
  fields: {
    nome: { stringValue: "Chapa Teste" },
    ativo: { booleanValue: true },
    perfil: { stringValue: "chapa" },
    codigo: { stringValue: "123456" },
  },
};
const db = criarArmazenamentoAcessoEquipe({
  projectId: "pedrao-teste",
  obterToken: async () => ({ access_token: "token-ficticio" }),
  fetchHttp: async (url, opcoes) => {
    assert.equal(new URL(url).origin, "https://firestore.googleapis.com");
    assert.equal(opcoes.headers.Authorization, "Bearer token-ficticio");
    const caminho = url.split("/documents")[1],
      body = opcoes.body ? JSON.parse(opcoes.body) : null;
    chamadas.push({ caminho, body });
    let json = {};
    if (caminho === ":runQuery")
      json = (duplicado ? [documento, documento] : [documento]).map((d) => ({ document: d }));
    else if (caminho === "/atendentes/a") json = documento;
    else if (caminho.startsWith("/atendentes/")) return { ok: false, status: 404 };
    else if (caminho === ":beginTransaction") json = { transaction: "teste" };
    else if (caminho === ":batchGet")
      json = body.documents.map((nome) =>
        contadores.has(nome)
          ? { found: { name: nome, fields: contadores.get(nome) } }
          : { missing: nome },
      );
    else if (caminho.startsWith("/authTentativasEquipe/")) {
      const nome = base + caminho.split("?")[0];
      if (!contadores.has(nome)) return { ok: false, status: 404 };
      json = { fields: contadores.get(nome) };
    } else if (caminho === ":commit")
      for (const w of body.writes || []) contadores.set(w.update.name, w.update.fields);
    return { ok: true, status: 200, json: async () => json };
  },
});
(async () => {
  assert.equal((await db.buscarCodigo("123456")).dados.perfil, "chapa");
  const consulta = chamadas.at(-1).body.structuredQuery;
  assert.equal(consulta.limit, 2);
  assert.equal(consulta.where.compositeFilter.filters[1].fieldFilter.value.booleanValue, true);
  duplicado = true;
  assert.equal(await db.buscarCodigo("123456"), null);
  assert.equal((await db.lerFuncionario("a")).ativo, true);
  assert.equal(await db.lerFuncionario("b"), null);
  await assert.rejects(db.lerFuncionario("../outra"));
  for (let i = 0; i < 5; i++) await db.consumirTentativa("123456", "rede-teste", 1000);
  await assert.rejects(db.consumirTentativa("123456", "rede-teste", 1001), (e) => e.status === 429);
  assert.equal(chamadas.at(-1).caminho, ":rollback");
  for (let i = 0; i < 5; i++) await db.consumirTentativa("outro" + i, "rede-teste", 1001);
  await assert.rejects(
    db.consumirTentativa("terceiro", "rede-teste", 1001),
    (e) => e.status === 429,
  );
  await db.consumirTentativa("123456", "rede-teste", 901000);
  assert(!JSON.stringify([...contadores.keys()]).includes("123456"));
  assert(!JSON.stringify([...contadores.keys()]).includes("rede-teste"));
  console.log(
    "PASS: consulta privada de códigos ativos e únicos, limites transacionais por código/rede/global e renovação da janela sem armazenar código ou IP nos contadores.",
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
