/* Fixture local: nenhum dado é enviado ao Firebase ou a uma conta real. */
var clienteLogado = { nome: "Pessoa de teste", telefone: "65999999999", nivelCliente: "Bronze" };
var avatarClienteAtual = "images/avatares/sem-rank/maionese.webp";
function selecionarAvatar() {}
function limparTelaMensagensCliente() {}
function atualizarTelaClienteLogado() {
  atualizarAvisoSenhaClienteUI(clienteLogado);
  if (clienteLogado.authUid)
    document.getElementById("resultado-demonstracao").textContent =
      "Senha criada. A conta de teste foi preservada.";
}
(() => {
  if (
    !["127.0.0.1", "localhost"].includes(location.hostname) ||
    !location.pathname.startsWith("/tests/")
  )
    return;
  let usuario = null;
  const auth = {
    get currentUser() {
      return usuario;
    },
    onAuthStateChanged(cb) {
      queueMicrotask(() => cb(usuario));
      return () => {};
    },
    async setPersistence() {},
    async signInWithCustomToken() {
      usuario = {
        uid: "demonstracao",
        async getIdToken() {
          return "token-ficticio";
        },
      };
    },
    async signOut() {
      usuario = null;
    },
  };
  window.firebase = { auth: () => auth };
  const original = window.fetch.bind(window);
  window.fetch = async (url, opcoes = {}) => {
    if (url !== "/api/acesso-cliente") return original(url, opcoes);
    const dados = opcoes.body ? JSON.parse(opcoes.body) : null;
    let resposta = { disponivel: true };
    if (dados?.acao === "criarSenha") resposta = { token: "custom-ficticio" };
    if (dados?.acao === "perfil")
      resposta = { cliente: { ...clienteLogado, authUid: "demonstracao" } };
    return { ok: true, status: 200, json: async () => resposta };
  };
  document.addEventListener("DOMContentLoaded", () => atualizarTelaClienteLogado());
})();
