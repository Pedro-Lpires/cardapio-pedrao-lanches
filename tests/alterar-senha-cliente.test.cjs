const assert = require("node:assert/strict");
const { criarAcessoClienteUI } = require("../js/acesso-cliente-ui.js");
function fixture() {
  const chamadas = [],
    operacoes = [];
  let falhar = false,
    duranteReauth = null;
  const usuario = {
    uid: "cliente-teste",
    email: "65999999999@clientes.pedrao-lanches.invalid",
    getIdToken: async () => "token-ficticio",
    async reauthenticateWithCredential(c) {
      operacoes.push("reauth");
      assert.equal(c.email, usuario.email);
      if (falhar) throw Error("detalhe que não pode aparecer");
      if (duranteReauth) await duranteReauth();
    },
    async updatePassword() {
      operacoes.push("alterou");
    },
  };
  const auth = {
    currentUser: usuario,
    async signOut() {
      this.currentUser = null;
    },
  };
  const ui = criarAcessoClienteUI({
    auth,
    credencialSenha: (email, senha) => ({ email, senha }),
    fetchHttp: async (u, o) => {
      chamadas.push(o);
      if (!o.body) return { ok: true, json: async () => ({ disponivel: true }) };
      assert.deepEqual(JSON.parse(o.body), { acao: "perfil" });
      return {
        ok: true,
        json: async () => ({ cliente: { authUid: usuario.uid, telefone: "65999999999" } }),
      };
    },
  });
  return {
    ui,
    auth,
    chamadas,
    operacoes,
    negar: () => (falhar = true),
    aoReautenticar: (fn) => (duranteReauth = fn),
  };
}
(async () => {
  const dados = {
    atual: "Atual ficticia 123",
    senha: "Nova ficticia 456",
    confirmacao: "Nova ficticia 456",
  };
  const a = fixture();
  await assert.rejects(a.ui.alterarSenha({ ...dados, confirmacao: "diferente" }), /repita/);
  assert.equal(a.operacoes.length, 0);
  await a.ui.alterarSenha(dados);
  assert.deepEqual(a.operacoes, ["reauth", "alterou"]);
  assert(
    !a.chamadas.some((c) => c.body?.includes("ficticia")),
    "Senhas não passam pela API do perfil",
  );
  const b = fixture();
  b.negar();
  await assert.rejects(
    b.ui.alterarSenha(dados),
    (e) => /senha atual/.test(e.message) && !e.message.includes("detalhe"),
  );
  assert.deepEqual(b.operacoes, ["reauth"]);
  const c = fixture();
  c.aoReautenticar(() => c.ui.sair());
  await assert.rejects(c.ui.alterarSenha(dados));
  assert.deepEqual(c.operacoes, ["reauth"], "Sair durante a conferência impede gravar nova senha");
  console.log(
    "PASS: troca de senha exige confirmação, conta conferida e reautenticação; senha errada e logout não alteram credencial.",
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
