const crypto = require("node:crypto");
const { criarDbRecuperacaoRest } = require("./recuperacao-firestore-rest.cjs");
const { ErroRecuperacao } = require("./recuperacao-acesso.cjs");
function criarArmazenamentoAcessoEquipe({ projectId, obterToken, fetchHttp = fetch }) {
  if (!/^[a-z][a-z0-9-]+$/.test(projectId)) throw Error("Projeto inválido.");
  const base =
    "https://firestore.googleapis.com/v1/projects/" + projectId + "/databases/(default)/documents";
  const tentativas = criarDbRecuperacaoRest({
    projectId,
    obterToken,
    fetchHttp,
    colecao: "authTentativasEquipe",
  });
  const ler = (documento) =>
    Object.fromEntries(
      Object.entries(documento.fields || {}).map(([k, v]) => [
        k,
        v.stringValue ?? v.booleanValue ?? (v.integerValue == null ? null : Number(v.integerValue)),
      ]),
    );
  async function chamar(caminho, body) {
    const credencial = await obterToken();
    const res = await fetchHttp(base + caminho, {
      method: body ? "POST" : "GET",
      headers: {
        Authorization: "Bearer " + credencial.access_token,
        "Content-Type": "application/json",
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(15000),
    });
    if (res.status === 404 && !body) return null;
    if (!res.ok) throw Error("Não foi possível conferir o acesso da equipe.");
    return res.json();
  }
  return {
    async buscarCodigo(codigo) {
      const resultado = await chamar(":runQuery", {
        structuredQuery: {
          from: [{ collectionId: "atendentes" }],
          where: {
            compositeFilter: {
              op: "AND",
              filters: [
                {
                  fieldFilter: {
                    field: { fieldPath: "codigo" },
                    op: "EQUAL",
                    value: { stringValue: codigo },
                  },
                },
                {
                  fieldFilter: {
                    field: { fieldPath: "ativo" },
                    op: "EQUAL",
                    value: { booleanValue: true },
                  },
                },
              ],
            },
          },
          limit: 2,
        },
      });
      const docs = resultado.filter((v) => v.document);
      return docs.length === 1
        ? { id: docs[0].document.name.split("/").at(-1), dados: ler(docs[0].document) }
        : null;
    },
    async lerFuncionario(id) {
      if (!/^[A-Za-z0-9_-]{1,128}$/.test(id)) throw Error("Cadastro inválido.");
      const doc = await chamar("/atendentes/" + encodeURIComponent(id));
      return doc ? ler(doc) : null;
    },
    async consumirTentativa(codigo, origemRede, em) {
      const hash = (s) => crypto.createHash("sha256").update(s).digest("hex");
      const chaves = [
        "global",
        "codigo-" + hash(codigo),
        "rede-" + hash(String(origemRede || "sem-rede").slice(0, 200)),
      ];
      const refs = chaves.map((id) => tentativas.collection("authTentativasEquipe").doc(id));
      await tentativas.runTransaction(async (t) => {
        const snapshots = await Promise.all(refs.map((r) => t.get(r)));
        const estados = snapshots.map((s) =>
          s.exists && em - s.data().inicio < 15 * 60 * 1000
            ? s.data()
            : { inicio: em, quantidade: 0 },
        );
        if (estados.some((s, i) => s.quantidade >= [100, 5, 10][i]))
          throw new ErroRecuperacao(
            429,
            "Muitas tentativas. Aguarde alguns minutos para tentar novamente.",
          );
        estados.forEach((s, i) =>
          t.set(refs[i], { inicio: s.inicio, quantidade: s.quantidade + 1 }),
        );
      });
    },
  };
}
module.exports = { criarArmazenamentoAcessoEquipe };
