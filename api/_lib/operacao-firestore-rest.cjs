/* Transporte restrito para serviços de pedidos. Todos os caminhos são conferidos no servidor. */
const crypto = require("node:crypto");
function codificarValor(v) {
  if (v === null) return { nullValue: null };
  if (typeof v === "string") return { stringValue: v };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number" && Number.isFinite(v))
    return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(codificarValor) } };
  if (v && typeof v === "object" && Object.getPrototypeOf(v) === Object.prototype)
    return { mapValue: { fields: codificarCampos(v) } };
  throw Error("Valor não suportado na operação.");
}
const codificarCampos = (dados) =>
  Object.fromEntries(Object.entries(dados).map(([k, v]) => [k, codificarValor(v)]));
function lerValor(v) {
  if ("nullValue" in v) return null;
  if ("stringValue" in v) return v.stringValue;
  if ("booleanValue" in v) return v.booleanValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return v.doubleValue;
  if ("timestampValue" in v) return v.timestampValue;
  if ("arrayValue" in v) return (v.arrayValue.values || []).map(lerValor);
  if ("mapValue" in v) return lerCampos(v.mapValue.fields || {});
  throw Error("Tipo de campo não suportado.");
}
const lerCampos = (fields) =>
  Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, lerValor(v)]));
function criarDbOperacaoRest({ projectId, obterToken, fetchHttp = fetch, colecoes }) {
  if (!/^[a-z][a-z0-9-]+$/.test(projectId) || !Array.isArray(colecoes) || !colecoes.length)
    throw Error("Configuração de operação inválida.");
  const recurso = "projects/" + projectId + "/databases/(default)/documents",
    base = "https://firestore.googleapis.com/v1/" + recurso;
  function caminhoValido(caminho, documento) {
    if (
      typeof caminho !== "string" ||
      caminho.length > 1000 ||
      caminho.split("/").some((p) => !p || p === "." || p === "..")
    )
      throw Error("Caminho inválido.");
    const partes = caminho.split("/");
    if (!colecoes.includes(partes[0]) || partes.length % 2 !== (documento ? 0 : 1))
      throw Error("Coleção não autorizada nesta operação.");
    return caminho;
  }
  const endereco = (caminho) => caminho.split("/").map(encodeURIComponent).join("/");
  async function chamar(sufixo, body, ausente = false) {
    const credencial = await obterToken();
    const resposta = await fetchHttp(base + sufixo, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        Authorization: "Bearer " + credencial.access_token,
        "Content-Type": "application/json",
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(15000),
    });
    if (ausente && resposta.status === 404) return null;
    const dados = await resposta.json();
    if (!resposta.ok) {
      const erro = Error("Não foi possível concluir a operação no banco.");
      erro.retry = resposta.status === 409 || dados.error?.status === "ABORTED";
      throw erro;
    }
    return dados;
  }
  function snapshot(caminho, dados) {
    return {
      id: caminho.split("/").at(-1),
      exists: Boolean(dados),
      ref: referencia(caminho),
      data: () => (dados ? lerCampos(dados.fields || {}) : undefined),
    };
  }
  function referencia(caminho) {
    caminhoValido(caminho, true);
    const ref = {
      path: caminho,
      id: caminho.split("/").at(-1),
      name: recurso + "/" + caminho,
      collection: (nome) => consulta(caminho + "/" + nome),
      async get() {
        return snapshot(caminho, await chamar("/" + endereco(caminho), undefined, true));
      },
    };
    return ref;
  }
  function consulta(caminho, filtros = [], limite = 500) {
    caminhoValido(caminho, false);
    return {
      doc(id = crypto.randomBytes(16).toString("hex")) {
        if (typeof id !== "string" || id.includes("/")) throw Error("Identidade inválida.");
        return referencia(caminho + "/" + id);
      },
      where(campo, comparacao, valor) {
        if (
          !/^[A-Za-z][A-Za-z0-9_.]*$/.test(campo) ||
          !["==", ">=", "<=", ">", "<"].includes(comparacao)
        )
          throw Error("Consulta inválida.");
        return consulta(
          caminho,
          [
            ...filtros,
            {
              fieldFilter: {
                field: { fieldPath: campo },
                op: {
                  "==": "EQUAL",
                  ">=": "GREATER_THAN_OR_EQUAL",
                  "<=": "LESS_THAN_OR_EQUAL",
                  ">": "GREATER_THAN",
                  "<": "LESS_THAN",
                }[comparacao],
                value: codificarValor(valor),
              },
            },
          ],
          limite,
        );
      },
      limit(valor) {
        if (!Number.isInteger(valor) || valor < 1 || valor > 500)
          throw Error("Limite de consulta inválido.");
        return consulta(caminho, filtros, valor);
      },
      async get() {
        const partes = caminho.split("/"),
          nome = partes.pop(),
          pai = partes.length ? "/" + endereco(partes.join("/")) : "";
        const resultado = await chamar(pai + ":runQuery", {
          structuredQuery: {
            from: [{ collectionId: nome }],
            limit: limite,
            ...(filtros.length
              ? {
                  where:
                    filtros.length === 1
                      ? filtros[0]
                      : { compositeFilter: { op: "AND", filters: filtros } },
                }
              : {}),
          },
        });
        const docs = resultado
          .filter((v) => v.document)
          .map((v) => {
            if (!v.document.name.startsWith(recurso + "/"))
              throw Error("Resposta de outro projeto.");
            return snapshot(v.document.name.slice(recurso.length + 1), v.document);
          });
        if (docs.length === limite)
          throw Error("A consulta atingiu o limite. Refine os registros antes de continuar.");
        return { docs, empty: !docs.length, size: docs.length, forEach: (fn) => docs.forEach(fn) };
      },
    };
  }
  return {
    collection: (nome) => consulta(nome),
    async runTransaction(fn) {
      for (let tentativa = 0; tentativa < 4; tentativa++) {
        const { transaction } = await chamar(":beginTransaction", { options: { readWrite: {} } });
        const writes = [],
          leituras = new Map(),
          filaLeituras = [];
        let leituraAgendada = false;
        function agendarLeitura(ref) {
          return new Promise((resolve, reject) => {
            filaLeituras.push({ ref, resolve, reject });
            if (leituraAgendada) return;
            leituraAgendada = true;
            queueMicrotask(async () => {
              leituraAgendada = false;
              const lote = filaLeituras.splice(0);
              try {
                const respostas = await chamar(":batchGet", {
                  documents: lote.map(({ ref }) => ref.name),
                  transaction,
                });
                const documentos = new Map(
                  (Array.isArray(respostas) ? respostas : []).map((d) => [
                    d.found?.name || d.missing,
                    d,
                  ]),
                );
                // Valida o lote inteiro antes de resolver qualquer leitura.
                const snapshots = lote.map(({ ref }) => {
                  const dado = documentos.get(ref.name);
                  if (!dado) throw Error("Leitura transacional inválida.");
                  return snapshot(ref.path, dado.found || null);
                });
                lote.forEach((entrada, i) => entrada.resolve(snapshots[i]));
              } catch (erro) {
                lote.forEach(({ reject }) => reject(erro));
              }
            });
          });
        }
        try {
          function validarRef(ref) {
            if (!ref || ref.name !== recurso + "/" + caminhoValido(ref.path, true))
              throw Error("Referência inválida.");
          }
          const resultado = await fn({
            async get(ref) {
              validarRef(ref);
              if (!leituras.has(ref.path)) leituras.set(ref.path, agendarLeitura(ref));
              return leituras.get(ref.path);
            },
            set(ref, dados, opcoes = {}) {
              validarRef(ref);
              writes.push({
                update: { name: ref.name, fields: codificarCampos(dados) },
                ...(opcoes.merge ? { updateMask: { fieldPaths: Object.keys(dados) } } : {}),
              });
            },
            update(ref, dados) {
              validarRef(ref);
              writes.push({
                update: { name: ref.name, fields: codificarCampos(dados) },
                updateMask: { fieldPaths: Object.keys(dados) },
                currentDocument: { exists: true },
              });
            },
            delete(ref) {
              validarRef(ref);
              writes.push({ delete: ref.name });
            },
          });
          if (writes.length > 400) throw Error("A operação ultrapassou o limite de gravações.");
          await chamar(":commit", { transaction, writes });
          return resultado;
        } catch (erro) {
          try {
            await chamar(":rollback", { transaction });
          } catch {}
          if (!erro.retry || tentativa === 3) throw erro;
        }
      }
    },
  };
}
module.exports = { criarDbOperacaoRest, codificarValor, codificarCampos, lerValor, lerCampos };
