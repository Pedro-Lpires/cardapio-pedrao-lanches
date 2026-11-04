/* Operações do servidor limitadas a cadastro e aprovação da migração de testes. */
const crypto = require("node:crypto");
const { criarDbRecuperacaoRest } = require("./recuperacao-firestore-rest.cjs");
const { ErroRecuperacao } = require("./recuperacao-acesso.cjs");
function criarArmazenamentoAcessoCliente({ projectId, obterToken, fetchHttp = fetch }) {
  if (!/^[a-z][a-z0-9-]+$/.test(projectId)) throw Error("Projeto inválido.");
  const recurso = "projects/" + projectId + "/databases/(default)/documents";
  const base = "https://firestore.googleapis.com/v1/" + recurso;
  const tentativas = criarDbRecuperacaoRest({
    projectId,
    obterToken,
    fetchHttp,
    colecao: "authTentativasCliente",
  });
  const valor = (v) => {
    if (v === null) return { nullValue: null };
    if (typeof v === "string") return { stringValue: v };
    if (typeof v === "boolean") return { booleanValue: v };
    if (typeof v === "number" && Number.isFinite(v))
      return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
    if (Array.isArray(v)) return { arrayValue: { values: v.map(valor) } };
    if (v && typeof v === "object") return { mapValue: { fields: campos(v) } };
    throw Error("Campo de cadastro inválido.");
  };
  const campos = (dados) =>
    Object.fromEntries(Object.entries(dados).map(([k, v]) => [k, valor(v)]));
  const lerValor = (v) => {
    if ("nullValue" in v) return null;
    if ("stringValue" in v) return v.stringValue;
    if ("booleanValue" in v) return v.booleanValue;
    if ("integerValue" in v) return Number(v.integerValue);
    if ("doubleValue" in v) return v.doubleValue;
    if ("timestampValue" in v) return v.timestampValue;
    if ("arrayValue" in v) return (v.arrayValue.values || []).map(lerValor);
    if ("mapValue" in v) return lerCampos(v.mapValue.fields || {});
    throw Error("Tipo de campo de cadastro não suportado.");
  };
  const lerCampos = (f) => Object.fromEntries(Object.entries(f).map(([k, v]) => [k, lerValor(v)]));
  async function chamar(caminho, metodo = "GET", body, ausente = false) {
    const credencial = await obterToken();
    const res = await fetchHttp(base + caminho, {
      method: metodo,
      headers: {
        Authorization: "Bearer " + credencial.access_token,
        "Content-Type": "application/json",
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(15000),
    });
    if (ausente && res.status === 404) return null;
    if (!res.ok) throw Error("Não foi possível conferir o cadastro no servidor.");
    return res.json();
  }
  function id(telefone) {
    if (!/^[1-9]\d9\d{8}$/.test(telefone)) throw Error("Celular inválido.");
    return telefone;
  }
  return {
    async consumirTentativa(telefone, em) {
      if (!/^(?:[1-9]\d9\d{8}|codigo:\d{4})$/.test(telefone))
        throw Error("Identificador inválido.");
      const refs = ["global", crypto.createHash("sha256").update(telefone).digest("hex")].map(
        (chave) => tentativas.collection("authTentativasCliente").doc(chave),
      );
      await tentativas.runTransaction(async (t) => {
        const snapshots = await Promise.all(refs.map((r) => t.get(r)));
        const estados = snapshots.map((s) =>
          s.exists && em - s.data().inicio < 15 * 60 * 1000
            ? s.data()
            : { inicio: em, quantidade: 0 },
        );
        if (estados.some((e, i) => e.quantidade >= (i === 0 ? 100 : 5)))
          throw new ErroRecuperacao(
            429,
            "Aguarde alguns minutos antes de tentar criar sua senha novamente.",
          );
        estados.forEach((e, i) =>
          t.set(refs[i], { inicio: e.inicio, quantidade: e.quantidade + 1 }),
        );
      });
    },
    async lerCliente(telefone) {
      const doc = await chamar("/clientes/" + id(telefone), "GET", undefined, true);
      return doc ? lerCampos(doc.fields || {}) : null;
    },
    async buscarClienteCodigo(codigo) {
      const docs = await chamar(":runQuery", "POST", {
        structuredQuery: {
          from: [{ collectionId: "clientes" }],
          where: {
            fieldFilter: {
              field: { fieldPath: "codigoAtivacao" },
              op: "EQUAL",
              value: { stringValue: codigo },
            },
          },
          limit: 2,
        },
      });
      const clientes = docs
        .filter((d) => d.document)
        .map((d) => ({
          ...lerCampos(d.document.fields || {}),
          telefone: d.document.name.split("/").at(-1),
        }));
      return clientes.length === 1 ? clientes[0] : null;
    },
    async lerAprovacaoTeste(telefone) {
      const doc = await chamar("/authClientesTeste/" + id(telefone), "GET", undefined, true);
      return doc ? lerCampos(doc.fields || {}) : null;
    },
    async listarClientesTeste() {
      const resultado = await chamar("/clientes?pageSize=101");
      if (resultado.nextPageToken)
        throw Error("Revise a lista de contas antes de migrar os testes.");
      return (resultado.documents || []).map((d) => ({
        ...lerCampos(d.fields || {}),
        telefone: d.name.split("/").at(-1),
      }));
    },
    async aprovarTestes(clientes) {
      if (clientes.length > 100) throw Error("Quantidade de testes inválida.");
      if (!clientes.length) return;
      await chamar(":commit", "POST", {
        writes: clientes.map((c) => ({
          update: { name: recurso + "/authClientesTeste/" + id(c.telefone), fields: campos(c) },
        })),
      });
    },
    async vincularCliente(telefone, uid, cliente, existente, em) {
      const vinculo = { authUid: uid, acessoSenhaCriadoEm: em };
      const dados = existente ? vinculo : { ...cliente, ...vinculo };
      // Uma conta existente conserva todos os campos e subcoleções; apenas o vínculo é alterado.
      await chamar(":commit", "POST", {
        writes: [
          {
            update: { name: recurso + "/clientes/" + id(telefone), fields: campos(dados) },
            ...(existente ? { updateMask: { fieldPaths: Object.keys(vinculo) } } : {}),
            currentDocument: { exists: existente },
          },
        ],
      });
    },
  };
}
module.exports = { criarArmazenamentoAcessoCliente };
