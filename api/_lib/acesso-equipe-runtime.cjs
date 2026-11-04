const { obterPlataformaAcesso, uidsAdministrativos } = require("./recuperacao-runtime.cjs");
const { criarServicoAcessoEquipe } = require("./acesso-equipe.cjs");
const { criarArmazenamentoAcessoEquipe } = require("./acesso-equipe-rest.cjs");
let servico;
function obterServicoAcessoEquipe() {
  if (servico) return servico;
  const { app, auth, conta } = obterPlataformaAcesso();
  servico = criarServicoAcessoEquipe({
    auth,
    siteUrl: process.env.SITE_PUBLICO_URL,
    adminUids: uidsAdministrativos(),
    armazenamento: criarArmazenamentoAcessoEquipe({
      projectId: conta.project_id,
      obterToken: () => app.options.credential.getAccessToken(),
    }),
  });
  return servico;
}
module.exports = { obterServicoAcessoEquipe };
