const { criarDbOperacaoRest } = require("./operacao-firestore-rest.cjs");
const { obterPlataformaAcesso } = require("./recuperacao-runtime.cjs");
const { obterServicoPedidoPublico, criarLimitadorPedido } = require("./pedido-publico-runtime.cjs");
const { criarServicoMesaPublica } = require("./mesa-publica.cjs");
let servico;
function obterServicoMesaPublica() {
  if (servico) return servico;
  const { app, auth, conta } = obterPlataformaAcesso();
  const db = criarDbOperacaoRest({
    projectId: conta.project_id,
    obterToken: () => app.options.credential.getAccessToken(),
    colecoes: [
      "mesas",
      "sessoesMesa",
      "authVisitasMesa",
      "comandas",
      "pedidos",
      "config",
      "produtos",
      "adicionais",
      "filaCozinha",
      "chamadosMesa",
      "authTentativasMesa",
    ],
  });
  servico = criarServicoMesaPublica({
    db,
    auth,
    pedidos: obterServicoPedidoPublico(),
    consumirTentativa: criarLimitadorPedido(db, {
      colecao: "authTentativasMesa",
      limites: [600, 300, 100],
    }),
  });
  return servico;
}
module.exports = { obterServicoMesaPublica };
