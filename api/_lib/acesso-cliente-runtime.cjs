const { criarServicoAcessoCliente } = require("./acesso-cliente.cjs");
const { criarArmazenamentoAcessoCliente } = require("./acesso-cliente-rest.cjs");
const { obterPlataformaAcesso, uidsAdministrativos } = require("./recuperacao-runtime.cjs");
let servico;
function obterServicoAcessoCliente() {
  if (servico) return servico;
  const { app, auth, conta } = obterPlataformaAcesso();
  servico = criarServicoAcessoCliente({
    auth,
    siteUrl: process.env.SITE_PUBLICO_URL,
    adminUids: uidsAdministrativos(),
    conferirSenha: async (email, senha) => {
      const resposta = await fetch(
        "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=" +
          encodeURIComponent(process.env.FIREBASE_WEB_API_KEY),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password: senha, returnSecureToken: true }),
          signal: AbortSignal.timeout(15000),
        },
      );
      if (!resposta.ok) throw Error("Acesso inválido.");
      const dados = await resposta.json();
      return auth.verifyIdToken(dados.idToken, true);
    },
    armazenamento: criarArmazenamentoAcessoCliente({
      projectId: conta.project_id,
      obterToken: () => app.options.credential.getAccessToken(),
    }),
  });
  return servico;
}
module.exports = { obterServicoAcessoCliente };
