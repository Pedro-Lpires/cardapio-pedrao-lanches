const assert = require("node:assert/strict");
const { criarServicoAcessoCliente, emailCliente } = require("../api/_lib/acesso-cliente.cjs");
const { criarHandlerAcessoCliente } = require("../api/acesso-cliente.js");
function fixture() {
  const clientes = new Map(),
    aprovados = new Map(),
    usuarios = new Map(),
    senhas = new Map();
  let numero = 0,
    limitado = false,
    falharVinculo = false;
  const auth = {
    async verifyIdToken(token, revogado) {
      assert.equal(revogado, true);
      if (token === "dono") return { uid: "dono" };
      if (token.startsWith("id-"))
        return { uid: token.slice(3), ...usuarios.get(token.slice(3))?.customClaims };
      throw Error("revogado");
    },
    async createUser(dados) {
      if (
        [...usuarios.values()].some(
          (u) => u.phoneNumber === dados.phoneNumber || u.email === dados.email,
        )
      )
        throw Object.assign(Error(), { code: "auth/phone-number-already-exists" });
      const uid = "u" + ++numero;
      const { password, ...publico } = dados;
      const u = { uid, ...publico, customClaims: {} };
      usuarios.set(uid, u);
      senhas.set(uid, password);
      return u;
    },
    async getUser(uid) {
      if (!usuarios.has(uid)) throw Error();
      return usuarios.get(uid);
    },
    async getUserByPhoneNumber(phoneNumber) {
      const u = [...usuarios.values()].find((u) => u.phoneNumber === phoneNumber);
      if (!u) throw Object.assign(Error(), { code: "auth/user-not-found" });
      return u;
    },
    async setCustomUserClaims(uid, claims) {
      usuarios.get(uid).customClaims = claims;
    },
    async deleteUser(uid) {
      usuarios.delete(uid);
      senhas.delete(uid);
    },
    async createCustomToken(uid) {
      return "custom-" + uid;
    },
  };
  const armazenamento = {
    async consumirTentativa() {
      if (limitado) throw Object.assign(Error("limite"), { status: 429 });
    },
    async lerCliente(t) {
      return clientes.get(t) || null;
    },
    async lerAprovacaoTeste(t) {
      return aprovados.get(t) || null;
    },
    async listarClientesTeste() {
      return [...clientes.values()];
    },
    async aprovarTestes(lista) {
      lista.forEach((c) => aprovados.set(c.telefone, c));
    },
    async vincularCliente(t, uid, dados, existe, em) {
      if (falharVinculo || existe !== clientes.has(t)) throw Error();
      clientes.set(t, { ...dados, authUid: uid, acessoSenhaCriadoEm: em });
    },
    async buscarClienteCodigo(codigo) {
      const lista = [...clientes.values()].filter((c) => c.codigoAtivacao === codigo);
      return lista.length === 1 ? lista[0] : null;
    },
  };
  const servico = criarServicoAcessoCliente({
    auth,
    armazenamento,
    siteUrl: "https://pedrao.exemplo/",
    adminUids: ["dono"],
    agora: () => 1800000000000,
    conferirSenha: async (email, senha) => {
      const u = [...usuarios.values()].find((u) => u.email === email);
      if (!u || senhas.get(u.uid) !== senha) throw Error();
      return { uid: u.uid };
    },
  });
  return {
    servico,
    auth,
    clientes,
    aprovados,
    usuarios,
    senhas,
    limitar() {
      limitado = true;
    },
    falhar() {
      falharVinculo = true;
    },
  };
}
const senha = "Uma senha ficticia 123";
const dados = { telefone: "65999999999", nome: "Pessoa Teste", senha, confirmacao: senha };
async function api(handler, body, headers = {}, method = "POST") {
  const retorno = { headers: {} };
  await handler(
    { method, headers: { "content-type": "application/json", ...headers }, body },
    {
      setHeader(n, v) {
        retorno.headers[n] = v;
      },
      set statusCode(v) {
        retorno.status = v;
      },
      end(v) {
        retorno.body = JSON.parse(v);
      },
    },
  );
  return retorno;
}
(async () => {
  const f = fixture();
  f.clientes.set(dados.telefone, {
    nome: dados.nome,
    telefone: dados.telefone,
    nivelCliente: "Ouro",
    bonusDisponivel: 13,
    avatar: "avatar-teste",
    codigoAtivacao: "4979",
  });
  await assert.rejects(f.servico.criarSenha(dados), (e) => e.status === 409);
  await assert.rejects(f.servico.prepararTestes(), (e) => e.status === 401);
  await assert.rejects(f.servico.prepararTestes("Bearer invalido"), (e) => e.status === 401);
  assert.equal((await f.servico.prepararTestes("Bearer dono")).preparados, 1);
  const inicial = await f.servico.entrarTeste(dados);
  assert.equal(inicial.cliente.precisaCriarSenha, true);
  assert.equal(f.usuarios.size, 0, "Entrar no teste não concede uma sessão Auth nem cria senha");
  await assert.rejects(
    f.servico.entrarTeste({ ...dados, nome: "Outra pessoa" }),
    (e) => e.status === 401,
  );
  await assert.rejects(
    f.servico.criarSenha({ ...dados, confirmacao: "outra" }),
    (e) => e.status === 400,
  );
  assert.equal(f.usuarios.size, 0);
  const tentativas = await Promise.allSettled([
    f.servico.criarSenha(dados),
    f.servico.criarSenha(dados),
  ]);
  assert.equal(
    tentativas.filter((t) => t.status === "fulfilled").length,
    1,
    "Uma única senha pode ser criada no primeiro acesso concorrente",
  );
  assert.equal(f.usuarios.size, 1);
  const cliente = f.clientes.get(dados.telefone),
    uid = cliente.authUid;
  assert.equal(cliente.nivelCliente, "Ouro");
  assert.equal(cliente.bonusDisponivel, 13);
  assert.equal(cliente.avatar, "avatar-teste");
  assert.equal(f.usuarios.get(uid).email, emailCliente(dados.telefone));
  assert.equal(f.usuarios.get(uid).phoneNumber, "+5565999999999");
  assert.equal(f.usuarios.get(uid).customClaims.historicoLegadoVerificado, true);
  assert.equal(JSON.stringify([...f.clientes.values()]).includes(senha), false);
  assert.equal(JSON.stringify([...f.aprovados.values()]).includes(senha), false);
  await assert.rejects(
    f.servico.criarSenha({
      ...dados,
      senha: "Nova senha maliciosa",
      confirmacao: "Nova senha maliciosa",
    }),
    (e) => e.status === 409,
  );
  assert.equal(f.senhas.get(uid), senha, "Nome e telefone nunca substituem uma senha existente");
  await assert.rejects(f.servico.entrarTeste(dados), (e) => e.status === 401);
  await assert.rejects(f.servico.perfil("Bearer dono"), (e) => e.status === 403);
  assert.equal((await f.servico.perfil("Bearer id-" + uid)).cliente.nivelCliente, "Ouro");
  assert.equal((await f.servico.entrarCodigo({ codigo: "4979", senha })).token, "custom-" + uid);
  await assert.rejects(
    f.servico.entrarCodigo({ codigo: "4979", senha: "errada" }),
    (e) => e.status === 401,
  );
  await assert.rejects(f.servico.entrarCodigo({ codigo: "1234", senha }), (e) => e.status === 401);
  f.usuarios.get(uid).disabled = true;
  await assert.rejects(f.servico.perfil("Bearer id-" + uid), (e) => e.status === 401);
  f.usuarios.get(uid).disabled = false;
  f.clientes.set(dados.telefone, { ...cliente, authUid: "outro" });
  await assert.rejects(f.servico.perfil("Bearer id-" + uid), (e) => e.status === 403);

  const novo = fixture();
  await novo.servico.criarSenha({ ...dados, avatar: "https://terceiro.exemplo/foto" });
  assert.equal(novo.clientes.get(dados.telefone).fidelidadeAtiva, false);
  assert.equal(novo.clientes.get(dados.telefone).avatar, "images/avatares/sem-rank/maionese.webp");
  assert.equal(novo.usuarios.get("u1").customClaims.historicoLegadoVerificado, false);
  novo.clientes.set("65988888888", { nome: "Novo teste posterior", telefone: "65988888888" });
  assert.equal(
    novo.aprovados.has("65988888888"),
    false,
    "A preparação não autoriza contas futuras automaticamente",
  );
  await assert.rejects(
    novo.servico.entrarTeste({ nome: "Novo teste posterior", telefone: "65988888888" }),
    (e) => e.status === 401,
  );
  const falha = fixture();
  falha.falhar();
  await assert.rejects(falha.servico.criarSenha(dados), (e) => e.status === 503);
  assert.equal(falha.usuarios.size, 0, "Falha de vínculo remove a criação incompleta no Auth");
  const limitado = fixture();
  limitado.limitar();
  await assert.rejects(limitado.servico.criarSenha(dados));
  assert.equal(limitado.usuarios.size, 0);
  await assert.rejects(
    fixture().servico.criarSenha({ ...dados, nome: "<img src=x onerror=alert(1)>" }),
    (e) => e.status === 400,
  );

  const handler = criarHandlerAcessoCliente({
    obterServico: () => f.servico,
    estaConfigurado: () => false,
  });
  assert.equal((await api(handler, null, {}, "GET")).body.disponivel, false);
  assert.equal((await api(handler, {}, {}, "DELETE")).status, 405);
  assert.equal((await api(handler, { acao: "prepararTestes" })).status, 401);
  assert.equal((await api(handler, {}, { origin: "https://outro.exemplo" })).status, 403);
  assert.equal((await api(handler, {}, { "content-type": "text/plain" })).status, 415);
  assert.equal((await api(handler, "{errado")).status, 400);
  assert.equal((await api(handler, { dado: "x".repeat(20000) })).status, 413);
  assert.equal((await api(handler, { acao: "ignorada" })).status, 400);
  const consulta = await api(
    handler,
    { acao: "perfil", uid: "outro" },
    { authorization: "Bearer id-" + uid },
  );
  assert.equal(consulta.status, 403);
  assert.equal(consulta.headers["Cache-Control"], "no-store");
  console.log(
    "PASS: primeira senha só para testes aprovados; cadastro novo separado; senha no Auth, concorrência sem sobrescrita, dados preservados, CDA+senha, sessão revogada/vínculo, limites e HTTP protegido.",
  );
})().catch((erro) => {
  console.error(erro);
  process.exitCode = 1;
});
