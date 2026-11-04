const { ErroRecuperacao } = require("./_lib/recuperacao-acesso.cjs");
const { configurado } = require("./_lib/recuperacao-runtime.cjs");
const { obterServicoAcessoEquipe } = require("./_lib/acesso-equipe-runtime.cjs");
function criarHandlerAcessoEquipe({
  obterServico = obterServicoAcessoEquipe,
  estaConfigurado = configurado,
} = {}) {
  return async (req, res) => {
    for (const [nome, valor] of Object.entries({
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "X-Robots-Tag": "noindex, nofollow, noarchive",
    }))
      res.setHeader(nome, valor);
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
          if (Buffer.byteLength(texto) > 8192)
            throw new ErroRecuperacao(413, "Solicitação muito grande.");
        }
      if (Buffer.byteLength(texto) > 8192)
        throw new ErroRecuperacao(413, "Solicitação muito grande.");
      let dados;
      try {
        dados = JSON.parse(texto);
      } catch {
        throw new ErroRecuperacao(400, "Solicitação inválida.");
      }
      if (!dados || typeof dados !== "object" || Array.isArray(dados))
        throw new ErroRecuperacao(400, "Solicitação inválida.");
      let resposta;
      if (dados.acao === "entrar")
        resposta = await servico.entrar({
          codigo: dados.codigo,
          origemRede:
            req.headers["x-vercel-forwarded-for"] || req.socket?.remoteAddress || "sem-rede",
        });
      else if (dados.acao === "perfil") resposta = await servico.perfil(req.headers.authorization);
      else if (dados.acao === "proprietario")
        resposta = await servico.proprietario(req.headers.authorization);
      else throw new ErroRecuperacao(400, "Ação inválida.");
      return responder(200, resposta);
    } catch (erro) {
      return responder(erro instanceof ErroRecuperacao ? erro.status : 503, {
        erro:
          erro instanceof ErroRecuperacao
            ? erro.message
            : "Não foi possível concluir o acesso da equipe. Tente novamente.",
      });
    }
  };
}
module.exports = criarHandlerAcessoEquipe();
module.exports.criarHandlerAcessoEquipe = criarHandlerAcessoEquipe;
