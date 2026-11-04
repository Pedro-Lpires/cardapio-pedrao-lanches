const { ErroRecuperacao } = require("./_lib/recuperacao-acesso.cjs");
const { configurado, obterServicoRecuperacao } = require("./_lib/recuperacao-runtime.cjs");
function criarHandlerRecuperacao({
  obterServico = obterServicoRecuperacao,
  estaConfigurado = configurado,
} = {}) {
  return async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    const responder = (status, dados) => {
      res.statusCode = status;
      res.end(JSON.stringify(dados));
    };
    if (req.method === "GET")
      return responder(200, { disponivel: estaConfigurado(), validadeMinutos: 30 });
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
      let texto;
      if (req.body != null)
        texto = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
      else {
        texto = "";
        for await (const parte of req) {
          texto += parte.toString();
          if (Buffer.byteLength(texto) > 16384)
            throw new ErroRecuperacao(413, "Solicitação muito grande.");
        }
      }
      if (Buffer.byteLength(texto || "") > 16384)
        throw new ErroRecuperacao(413, "Solicitação muito grande.");
      let dados;
      try {
        dados = JSON.parse(texto);
      } catch {
        throw new ErroRecuperacao(400, "Solicitação inválida.");
      }
      if (!dados || typeof dados !== "object" || Array.isArray(dados))
        throw new ErroRecuperacao(400, "Solicitação inválida.");
      let resultado;
      if (dados.acao === "emitir")
        resultado = await servico.emitir({
          authorization: req.headers.authorization,
          telefone: dados.telefone,
        });
      else if (dados.acao === "conferir") resultado = await servico.conferir(dados.token);
      else if (dados.acao === "redefinir")
        resultado = await servico.redefinir({
          token: dados.token,
          senha: dados.senha,
          confirmacao: dados.confirmacao,
        });
      else throw new ErroRecuperacao(400, "Ação inválida.");
      responder(200, resultado);
    } catch (erro) {
      responder(erro instanceof ErroRecuperacao ? erro.status : 503, {
        erro:
          erro instanceof ErroRecuperacao
            ? erro.message
            : "A recuperação de acesso está indisponível no momento. Tente novamente pela loja.",
      });
    }
  };
}
module.exports = criarHandlerRecuperacao();
module.exports.criarHandlerRecuperacao = criarHandlerRecuperacao;
