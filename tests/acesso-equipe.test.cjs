const assert = require("node:assert/strict");
const { criarServicoAcessoEquipe, uidFuncionario } = require("../api/_lib/acesso-equipe.cjs");
const { criarHandlerAcessoEquipe } = require("../api/acesso-equipe.js");
function fixture() {
  const funcionarios = new Map([
    ["a", { nome: "Atendimento Teste", codigo: "123456", ativo: true, perfil: "atendimento" }],
    ["c", { nome: "Chapa Teste", codigo: "654321", ativo: true, perfil: "chapa" }],
  ]);
  const usuarios = new Map([
    ["dono", { uid: "dono", customClaims: {} }],
    ["cliente", { uid: "cliente", customClaims: { acessoCliente: true } }],
  ]);
  const tokens = [];
  let limite = false,
    falharClaims = false;
  const auth = {
    async verifyIdToken(token, revogados) {
      assert.equal(revogados, true);
      if (!usuarios.has(token)) throw Error();
      return { uid: token, ...usuarios.get(token).customClaims };
    },
    async getUser(uid) {
      if (!usuarios.has(uid)) throw Object.assign(Error(), { code: "auth/user-not-found" });
      return usuarios.get(uid);
    },
    async createUser(dados) {
      assert(!usuarios.has(dados.uid));
      const user = { ...dados };
      usuarios.set(dados.uid, user);
      return user;
    },
    async setCustomUserClaims(uid, claims) {
      if (falharClaims) throw Error();
      usuarios.get(uid).customClaims = claims;
    },
    async createCustomToken(uid, claims) {
      tokens.push({ uid, claims });
      return "custom-ficticio";
    },
    async deleteUser(uid) {
      usuarios.delete(uid);
    },
  };
  const armazenamento = {
    async consumirTentativa(codigo, rede, em) {
      assert.equal(typeof codigo, "string");
      assert.equal(em, 1000);
      if (limite) throw Object.assign(Error(), { status: 429 });
    },
    async buscarCodigo(codigo) {
      const lista = [...funcionarios].filter(([, v]) => v.codigo === codigo && v.ativo === true);
      return lista.length === 1 ? { id: lista[0][0], dados: lista[0][1] } : null;
    },
    async lerFuncionario(id) {
      return funcionarios.get(id) || null;
    },
  };
  const servico = criarServicoAcessoEquipe({
    auth,
    armazenamento,
    siteUrl: "https://pedrao.exemplo/",
    adminUids: ["dono"],
    agora: () => 1000,
  });
  return {
    servico,
    auth,
    armazenamento,
    funcionarios,
    usuarios,
    tokens,
    limitar() {
      limite = true;
    },
    falhar() {
      falharClaims = true;
    },
  };
}
async function api(handler, body, headers = {}, method = "POST") {
  const result = { headers: {} };
  await handler(
    {
      method,
      headers: { "content-type": "application/json", origin: "https://pedrao.exemplo", ...headers },
      body,
      socket: { remoteAddress: "127.0.0.1" },
    },
    {
      setHeader: (k, v) => (result.headers[k] = v),
      set statusCode(v) {
        result.status = v;
      },
      end: (v) => (result.body = JSON.parse(v)),
    },
  );
  return result;
}
(async () => {
  const f = fixture();
  for (const codigo of ["", "1", null, 123456, "../123456", "a".repeat(65)])
    await assert.rejects(f.servico.entrar({ codigo }), (e) => e.status === 401);
  await assert.rejects(f.servico.entrar({ codigo: "999999" }), (e) => e.status === 401);
  const entrada = await f.servico.entrar({ codigo: "123456", origemRede: "rede-ficticia" });
  assert.deepEqual(entrada.funcionario, {
    id: "a",
    nome: "Atendimento Teste",
    perfil: "atendimento",
    admin: false,
  });
  assert.equal(entrada.token, "custom-ficticio");
  assert(!JSON.stringify(entrada).includes("123456"), "A resposta não devolve o código");
  assert.deepEqual(f.tokens.at(-1), { uid: uidFuncionario("a"), claims: { funcionarioId: "a" } });
  assert.equal(
    (await f.servico.perfil("Bearer " + uidFuncionario("a"))).funcionario.perfil,
    "atendimento",
  );
  f.funcionarios.get("a").perfil = "chapa";
  assert.equal(
    (await f.servico.perfil("Bearer " + uidFuncionario("a"))).funcionario.perfil,
    "chapa",
    "Cargo é relido do cadastro, sem confiar no armazenamento local",
  );
  f.funcionarios.get("a").ativo = false;
  await assert.rejects(f.servico.perfil("Bearer " + uidFuncionario("a")), (e) => e.status === 401);
  await assert.rejects(f.servico.entrar({ codigo: "123456" }), (e) => e.status === 401);
  f.funcionarios.get("a").ativo = true;
  f.usuarios.get(uidFuncionario("a")).disabled = true;
  await assert.rejects(f.servico.perfil("Bearer " + uidFuncionario("a")), (e) => e.status === 401);
  await assert.rejects(f.servico.entrar({ codigo: "123456" }), (e) => e.status === 401);
  f.usuarios.get(uidFuncionario("a")).disabled = false;
  for (const token of ["", "Bearer invalido", "Bearer cliente", "Bearer dono"])
    await assert.rejects(f.servico.perfil(token));
  const dono = await f.servico.proprietario("Bearer dono");
  assert.equal(dono.funcionario.admin, true);
  assert.equal(f.usuarios.get("dono").customClaims.admin, true);
  assert.equal((await f.servico.perfil("Bearer dono")).funcionario.admin, true);
  await assert.rejects(f.servico.proprietario("Bearer cliente"), (e) => e.status === 403);
  await assert.rejects(
    f.servico.proprietario("Bearer " + uidFuncionario("a")),
    (e) => e.status === 403,
  );
  f.usuarios.get("cliente").customClaims.admin = true;
  await assert.rejects(
    f.servico.proprietario("Bearer cliente"),
    (e) => e.status === 403,
    "Claim antigo não substitui a lista privada de proprietários",
  );
  f.funcionarios.set("duplicado", { ...f.funcionarios.get("a") });
  await assert.rejects(f.servico.entrar({ codigo: "123456" }), (e) => e.status === 401);
  f.funcionarios.delete("duplicado");
  f.funcionarios.get("a").perfil = "administrador";
  await assert.rejects(f.servico.entrar({ codigo: "123456" }), (e) => e.status === 401);
  f.funcionarios.get("a").perfil = null;
  assert.equal((await f.servico.entrar({ codigo: "123456" })).funcionario.perfil, "ambos");
  const colisao = fixture();
  colisao.usuarios.set(uidFuncionario("a"), { uid: uidFuncionario("a"), customClaims: {} });
  await assert.rejects(colisao.servico.entrar({ codigo: "123456" }), (e) => e.status === 401);
  assert.deepEqual(
    colisao.usuarios.get(uidFuncionario("a")).customClaims,
    {},
    "Conta preexistente não pode ser promovida",
  );
  const falha = fixture();
  falha.falhar();
  await assert.rejects(falha.servico.entrar({ codigo: "123456" }));
  assert.equal(
    falha.usuarios.has(uidFuncionario("a")),
    false,
    "Falha da claim remove somente a conta incompleta recém-criada",
  );
  const handler = criarHandlerAcessoEquipe({
    obterServico: () => f.servico,
    estaConfigurado: () => true,
  });
  assert.equal((await api(handler, null, {}, "GET")).body.disponivel, true);
  assert.equal((await api(handler, {}, {}, "DELETE")).status, 405);
  assert.equal(
    (
      await api(
        handler,
        { acao: "entrar", codigo: "123456" },
        { origin: "https://estranho.exemplo" },
      )
    ).status,
    403,
  );
  assert.equal(
    (await api(handler, { acao: "entrar", codigo: "123456" }, { "content-type": "text/plain" }))
      .status,
    415,
  );
  assert.equal((await api(handler, "nao-json")).status, 400);
  assert.equal((await api(handler, [])).status, 400);
  assert.equal((await api(handler, { acao: "entrar", codigo: "a".repeat(9000) })).status, 413);
  const abuso = await api(handler, {
    acao: "entrar",
    codigo: "123456",
    admin: true,
    perfil: "ambos",
    uid: "dono",
  });
  assert.equal(abuso.body.funcionario.admin, false);
  assert.equal(abuso.body.funcionario.id, "a");
  assert.equal(abuso.headers["Cache-Control"], "no-store");
  console.log(
    "PASS: autenticação da equipe no servidor, cargos ativos, códigos privados, identidade sem colisão, proprietário pela lista privada, bloqueios HTTP e resposta sem credenciais.",
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
