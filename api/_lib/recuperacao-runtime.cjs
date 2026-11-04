const {
  criarServicoRecuperacao,
  criarArmazenamentoRecuperacao,
  ErroRecuperacao,
} = require("./recuperacao-acesso.cjs");
const { criarDbRecuperacaoRest } = require("./recuperacao-firestore-rest.cjs");
const { protegerSessoesCliente } = require("./sessao-cliente.cjs");
const { etapaConfiguracao } = require("./diagnostico.cjs");
let servico;
let plataforma;
function configurado(env = process.env) {
  return (
    env.RECUPERACAO_ACESSO_ATIVA === "true" &&
    env.REGRAS_FIRESTORE_PROTEGIDAS === "true" &&
    Boolean(
      env.FIREBASE_SERVICE_ACCOUNT_JSON &&
        env.RECUPERACAO_CHAVE &&
        env.SITE_PUBLICO_URL &&
        env.FIREBASE_WEB_API_KEY,
    )
  );
}
function obterServicoRecuperacao() {
  if (!configurado())
    throw new ErroRecuperacao(
      503,
      "A recuperação de acesso ainda aguarda a configuração da autenticação e das regras de segurança.",
    );
  if (servico) return servico;
  const { app, auth, conta } = obterPlataformaAcesso();
  const chave = Buffer.from(process.env.RECUPERACAO_CHAVE, "base64");
  servico = criarServicoRecuperacao({
    auth,
    armazenamento: criarArmazenamentoRecuperacao(
      criarDbRecuperacaoRest({
        projectId: conta.project_id,
        obterToken: () => app.options.credential.getAccessToken(),
      }),
    ),
    chave,
    siteUrl: process.env.SITE_PUBLICO_URL,
    adminUids: uidsAdministrativos(),
    aplicarSenha: async (codigo, senha) => {
      const resposta = await fetch(
        "https://identitytoolkit.googleapis.com/v1/accounts:resetPassword?key=" +
          encodeURIComponent(process.env.FIREBASE_WEB_API_KEY),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ oobCode: codigo, newPassword: senha }),
          signal: AbortSignal.timeout(15000),
        },
      );
      if (!resposta.ok)
        throw new ErroRecuperacao(
          resposta.status >= 500 ? 503 : 410,
          "Não foi possível redefinir a senha com este link. Peça um novo link à loja.",
        );
    },
    auditar: (evento) => console.info(JSON.stringify(evento)),
  });
  return servico;
}
function uidsAdministrativos() {
  return String(process.env.ADMIN_AUTH_UIDS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
function obterPlataformaAcesso() {
  if (!configurado())
    throw new ErroRecuperacao(503, "O acesso com senha ainda está em configuração.");
  if (plataforma) return plataforma;
  const { initializeApp, cert, getApps } = etapaConfiguracao("carregar_sdk_app", () =>
    require("firebase-admin/app"),
  );
  const { getAuth } = etapaConfiguracao("carregar_sdk_auth", () => require("firebase-admin/auth"));
  const conta = etapaConfiguracao("ler_json_conta_servico", () =>
    JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON),
  );
  etapaConfiguracao("conferir_projeto", () => {
    if (conta.project_id !== (process.env.FIREBASE_PROJECT_ID || "pedrao-lanches"))
      throw Error("Projeto de autenticação inválido.");
  });
  const app = etapaConfiguracao(
    "inicializar_credencial",
    () =>
      getApps().find((a) => a.name === "recuperacao-pedrao") ||
      initializeApp({ credential: cert(conta) }, "recuperacao-pedrao"),
  );
  const armazenamento = criarArmazenamentoRecuperacao(
    criarDbRecuperacaoRest({
      projectId: conta.project_id,
      obterToken: () => app.options.credential.getAccessToken(),
    }),
  );
  plataforma = { app, auth: protegerSessoesCliente(getAuth(app), armazenamento), conta };
  return plataforma;
}
module.exports = {
  configurado,
  obterServicoRecuperacao,
  obterPlataformaAcesso,
  uidsAdministrativos,
};
