const crypto = require("node:crypto");
const { criarDbOperacaoRest } = require("./operacao-firestore-rest.cjs");
const { criarServicoPedidoPublico } = require("./pedido-publico.cjs");
const { criarFreteRota, criarLimitadorFreteRota } = require("./frete-rota.cjs");
const { obterPlataformaAcesso } = require("./recuperacao-runtime.cjs");
const { ErroRecuperacao } = require("./recuperacao-acesso.cjs");
function criarLimitadorPedido(
  db,
  { colecao = "authTentativasPedido", limites = [200, 60, 60] } = {},
) {
  return async ({ origemRede, clienteId, em }) => {
    const hash = (v) => crypto.createHash("sha256").update(v).digest("hex");
    const grupos = [
      ["global", limites[0]],
      ["rede-" + hash(String(origemRede || "sem-rede").slice(0, 200)), limites[1]],
      ...(clienteId ? [["conta-" + hash(clienteId), limites[2]]] : []),
    ];
    await db.runTransaction(async (t) => {
      const refs = grupos.map(([id]) => db.collection(colecao).doc(id));
      const docs = await Promise.all(refs.map((r) => t.get(r)));
      const estados = docs.map((d) =>
        d.exists && em - d.data().inicio < 15 * 60000 ? d.data() : { inicio: em, quantidade: 0 },
      );
      if (
        estados.some(
          (e, i) =>
            !Number.isSafeInteger(e.quantidade) || e.quantidade < 0 || e.quantidade >= grupos[i][1],
        )
      )
        throw new ErroRecuperacao(
          429,
          "Muitas conferências de pedido. Aguarde alguns minutos ou fale com a loja.",
        );
      estados.forEach((e, i) => t.set(refs[i], { inicio: e.inicio, quantidade: e.quantidade + 1 }));
    });
  };
}
let servico;
function fretePorRotaConfigurado() {
  return Boolean(process.env.GEOAPIFY_ROUTING_API_KEY?.trim());
}
function obterServicoPedidoPublico() {
  if (servico) return servico;
  const { app, auth, conta } = obterPlataformaAcesso();
  const db = criarDbOperacaoRest({
    projectId: conta.project_id,
    obterToken: () => app.options.credential.getAccessToken(),
    colecoes: [
      "produtos",
      "adicionais",
      "config",
      "clientes",
      "pedidos",
      "cuponsDesconto",
      "authTentativasPedido",
      "comandas",
      "historicoPagamentosClientes",
      "rankMovimentos",
    ],
  });
  servico = criarServicoPedidoPublico({
    db,
    auth,
    siteUrl: process.env.SITE_PUBLICO_URL,
    consumirTentativa: criarLimitadorPedido(db),
    rotasEntrega: fretePorRotaConfigurado()
      ? criarFreteRota({
          apiKey: process.env.GEOAPIFY_ROUTING_API_KEY.trim(),
          chave: Buffer.from(process.env.RECUPERACAO_CHAVE, "base64"),
          consumirConsulta: criarLimitadorFreteRota(db),
        })
      : null,
  });
  return servico;
}
module.exports = { obterServicoPedidoPublico, criarLimitadorPedido, fretePorRotaConfigurado };
