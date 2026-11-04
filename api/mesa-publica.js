const { criarHandlerPedidoPublico } = require("./pedido-publico.js");
const { obterServicoMesaPublica } = require("./_lib/mesa-publica-runtime.cjs");
module.exports = criarHandlerPedidoPublico({
  obterServico: obterServicoMesaPublica,
  acoes: ["estado", "iniciar", "retomar", "enviar", "vincular", "chamar"],
});
