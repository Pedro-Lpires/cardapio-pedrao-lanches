/* Transporte REST restrito à coleção privada da recuperação. Usa transações do Firestore. */
function criarDbRecuperacaoRest({
  projectId,
  obterToken,
  fetchHttp = fetch,
  colecao = "authRecuperacoes",
}) {
  if (!["authRecuperacoes", "authTentativasCliente", "authTentativasEquipe"].includes(colecao))
    throw Error("Coleção privada inválida.");
  if (!/^[a-z][a-z0-9-]+$/.test(projectId)) throw Error("Projeto inválido.");
  const recurso = "projects/" + projectId + "/databases/(default)/documents";
  const base = "https://firestore.googleapis.com/v1/" + recurso;
  const campos = (dados) =>
    Object.fromEntries(
      Object.entries(dados).map(([k, v]) => [
        k,
        typeof v === "number" ? { integerValue: String(v) } : { stringValue: v },
      ]),
    );
  const dados = (doc) =>
    Object.fromEntries(
      Object.entries(doc.fields || {}).map(([k, v]) => [
        k,
        v.integerValue != null ? Number(v.integerValue) : v.stringValue,
      ]),
    );
  async function chamar(caminho, body, ausente = false) {
    const credencial = await obterToken();
    const resposta = await fetchHttp(base + caminho, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        Authorization: "Bearer " + credencial.access_token,
        "Content-Type": "application/json",
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(15000),
    });
    if (ausente && resposta.status === 404) return null;
    const retorno = await resposta.json();
    if (!resposta.ok) {
      const erro = new Error("Não foi possível conferir o estado da recuperação.");
      erro.retry = resposta.status === 409 || retorno.error?.status === "ABORTED";
      throw erro;
    }
    return retorno;
  }
  function referencia(uid) {
    if (typeof uid !== "string" || !uid || uid.includes("/")) throw Error("Identidade inválida.");
    const caminho = "/" + colecao + "/" + encodeURIComponent(uid);
    return {
      caminho,
      name: recurso + "/" + colecao + "/" + uid,
      async get(transacao) {
        let doc;
        if (transacao) {
          const nome = recurso + "/" + colecao + "/" + uid;
          const resultado = await chamar(":batchGet", {
            documents: [nome],
            transaction: transacao,
          });
          const entrada =
            Array.isArray(resultado) &&
            resultado.find((v) => v.found?.name === nome || v.missing === nome);
          if (!entrada) throw Error("Resposta inválida na leitura transacional.");
          doc = entrada.found || null;
        } else doc = await chamar(caminho, undefined, true);
        return { exists: Boolean(doc), data: () => (doc ? dados(doc) : undefined) };
      },
    };
  }
  return {
    collection(nome) {
      if (nome !== colecao) throw Error("Coleção não autorizada neste serviço.");
      return { doc: referencia };
    },
    async runTransaction(fn) {
      for (let tentativa = 0; tentativa < 3; tentativa++) {
        const { transaction } = await chamar(":beginTransaction", { options: { readWrite: {} } });
        const writes = [];
        try {
          const resultado = await fn({
            get: (ref) => ref.get(transaction),
            set: (ref, valores) =>
              writes.push({ update: { name: ref.name, fields: campos(valores) } }),
            update: (ref, valores) =>
              writes.push({
                update: { name: ref.name, fields: campos(valores) },
                updateMask: { fieldPaths: Object.keys(valores) },
              }),
          });
          await chamar(":commit", { transaction, writes });
          return resultado;
        } catch (erro) {
          try {
            await chamar(":rollback", { transaction });
          } catch {}
          if (!erro.retry || tentativa === 2) throw erro;
        }
      }
    },
  };
}
module.exports = { criarDbRecuperacaoRest };
