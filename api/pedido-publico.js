const { ErroRecuperacao } = require("./_lib/recuperacao-acesso.cjs");
const { configurado } = require("./_lib/recuperacao-runtime.cjs");
const { obterServicoPedidoPublico } = require("./_lib/pedido-publico-runtime.cjs");
function criarHandlerPedidoPublico({
  obterServico = obterServicoPedidoPublico,
  estaConfigurado = configurado,
  acoes = [
    "conferir",
    "salvar",
    "recuperar",
    "perfil",
    "cupons",
    "ativar",
    "suporte",
    "responderSuporte",
    "encerrarSuporte",
  ],
} = {}) {
  return async (req, res) => {
    for (const [k, v] of Object.entries({
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "X-Robots-Tag": "noindex, nofollow, noarchive",
    }))
      res.setHeader(k, v);
    const responder = (status, dados) => {
      res.statusCode = status;
      res.end(JSON.stringify(dados));
    };
    if (req.method === "GET") return responder(200, { disponivel: estaConfigurado() });
    if (req.method !== "POST") {
      res.setHeader("Allow", "GET, POST");
      return responder(405, { erro: "Método indisponível." });
    }
    try {
      if (!estaConfigurado())
        throw new ErroRecuperacao(503, "O envio protegido ainda está em configuração.");
      if (!/^application\/json(?:;|$)/i.test(req.headers["content-type"] || ""))
        throw new ErroRecuperacao(415, "Envie os dados no formato esperado.");
      const servico = obterServico();
      if (req.headers.origin && req.headers.origin !== servico.origem)
        throw new ErroRecuperacao(403, "Origem não autorizada.");
      let texto = "";
      if (req.body != null)
        texto = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
      else
        for await (const parte of req) {
          texto += parte.toString();
          if (Buffer.byteLength(texto) > 131072)
            throw new ErroRecuperacao(413, "Pedido muito grande.");
        }
      if (Buffer.byteLength(texto) > 131072) throw new ErroRecuperacao(413, "Pedido muito grande.");
      let dados;
      try {
        dados = JSON.parse(texto);
      } catch {
        throw new ErroRecuperacao(400, "Solicitação inválida.");
      }
      if (
        !dados ||
        Array.isArray(dados) ||
        typeof dados !== "object" ||
        !acoes.includes(dados.acao)
      )
        throw new ErroRecuperacao(400, "Ação inválida.");
      const resultado = await servico[dados.acao]({
        pedido: dados.pedido,
        chave: dados.chave,
        codigo: dados.codigo,
        mesa: dados.mesa,
        segredo: dados.segredo,
        nome: dados.nome,
        itens: dados.itens,
        tipo: dados.tipo,
        sair: dados.sair,
        valorTotalEsperado: dados.valorTotalEsperado,
        texto: dados.texto,
        categoria: dados.categoria,
        referenciaPedido: dados.referenciaPedido,
        chamadoId: dados.chamadoId,
        authorization: req.headers.authorization,
        origemRede:
          req.headers["x-vercel-forwarded-for"] ||
          req.headers["x-forwarded-for"] ||
          req.socket?.remoteAddress ||
          "sem-rede",
      });
      return responder(200, resultado);
    } catch (erro) {
      return responder(erro instanceof ErroRecuperacao ? erro.status : 503, {
        erro:
          erro instanceof ErroRecuperacao
            ? erro.message
            : "Não foi possível conferir o pedido. Tente novamente ou fale com a loja.",
      });
    }
  };
}
module.exports = criarHandlerPedidoPublico();
module.exports.criarHandlerPedidoPublico = criarHandlerPedidoPublico;
