const assert = require("node:assert/strict"),
  crypto = require("node:crypto");
const {
  criarServicoRecuperacao,
  criarArmazenamentoRecuperacao,
  ErroRecuperacao,
  VALIDADE_RECUPERACAO_MS,
} = require("../api/_lib/recuperacao-acesso.cjs");
const { criarHandlerRecuperacao } = require("../api/recuperacao-acesso.js");
const { configurado } = require("../api/_lib/recuperacao-runtime.cjs");
function ambiente() {
  let relogio = Date.UTC(2026, 10, 3, 16),
    fila = Promise.resolve(),
    aplicarFalha = false;
  const docs = new Map(),
    eventos = [],
    aplicacoes = [],
    codigos = new Set();
  const usuario = {
    uid: "cliente1",
    phoneNumber: "+5565999999999",
    email: "cliente@exemplo.invalid",
    providerData: [{ providerId: "password" }],
    disabled: false,
  };
  const contaAntiga = { historico: [1, 2], bonus: 10, rank: "Prata" };
  const ref = (id) => ({
    id,
    get: async () => ({ exists: docs.has(id), data: () => structuredClone(docs.get(id)) }),
  });
  const db = {
    collection: (nome) => {
      assert.equal(nome, "authRecuperacoes", "Nenhuma alteração em pedidos, saldos ou cadastro");
      return { doc: ref };
    },
    runTransaction: (fn) => {
      const tarefa = fila.then(() =>
        fn({
          get: (r) => r.get(),
          set: (r, dados) => docs.set(r.id, structuredClone(dados)),
          update: (r, dados) => docs.set(r.id, { ...docs.get(r.id), ...structuredClone(dados) }),
        }),
      );
      fila = tarefa.catch(() => {});
      return tarefa;
    },
  };
  const auth = {
    verifyIdToken: async (token, revoked) => {
      assert.equal(revoked, true);
      if (token === "admin") return { uid: "proprietario", admin: true };
      if (token === "permitido") return { uid: "admin-lista" };
      if (token === "cliente") return { uid: "cliente1", admin: false };
      throw Error("revogado");
    },
    getUserByPhoneNumber: async (telefone) => {
      if (telefone !== usuario.phoneNumber)
        throw Object.assign(Error(), { code: "auth/user-not-found" });
      return structuredClone(usuario);
    },
    getUser: async (uid) => {
      assert.equal(uid, usuario.uid);
      return structuredClone(usuario);
    },
    generatePasswordResetLink: async (email) => {
      assert.equal(email, usuario.email);
      const codigo = "CODIGO-NATIVO-" + (codigos.size + 1);
      codigos.add(codigo);
      return "https://firebase.exemplo/action?mode=resetPassword&oobCode=" + codigo;
    },
  };
  const chave = crypto.randomBytes(32);
  const opcoes = {
    auth,
    armazenamento: criarArmazenamentoRecuperacao(db),
    chave,
    siteUrl: "https://pedrao.exemplo/",
    adminUids: ["admin-lista"],
    agora: () => relogio,
    aplicarSenha: async (codigo, senha) => {
      if (aplicarFalha) throw Error("Falha do provedor");
      assert(codigos.has(codigo));
      codigos.delete(codigo);
      aplicacoes.push({ codigo, senha });
    },
    auditar: (evento) => eventos.push(evento),
  };
  const servico = criarServicoRecuperacao(opcoes);
  return {
    servico,
    opcoes,
    usuario,
    docs,
    eventos,
    aplicacoes,
    contaAntiga,
    agora: () => relogio,
    avancar: (ms) => (relogio += ms),
    falharAplicacao: () => (aplicarFalha = true),
  };
}
const tokenDe = (emissao) => new URLSearchParams(new URL(emissao.link).hash.slice(1)).get("token");
const emitir = (a, token = "admin") =>
  a.servico.emitir({ authorization: "Bearer " + token, telefone: "65999999999" });
const rejeita = (p, status) =>
  assert.rejects(p, (e) => e instanceof ErroRecuperacao && e.status === status);
async function api(handler, { method = "POST", body, headers = {} } = {}) {
  let retorno;
  const res = {
    statusCode: 200,
    headers: {},
    setHeader(k, v) {
      this.headers[k] = v;
    },
    end(s) {
      retorno = JSON.parse(s);
    },
  };
  await handler(
    {
      method,
      body,
      headers: { "content-type": "application/json", origin: "https://pedrao.exemplo", ...headers },
    },
    res,
  );
  return { status: res.statusCode, headers: res.headers, dados: retorno };
}
(async () => {
  assert.equal(VALIDADE_RECUPERACAO_MS, 1800000);
  const a = ambiente(),
    emissao = await emitir(a),
    token = tokenDe(emissao);
  assert.equal(emissao.expiraEm - a.agora(), 30 * 60 * 1000);
  assert.equal(emissao.validadeMinutos, 30);
  assert.equal(new URL(emissao.link).search, "", "Segredo somente no fragmento");
  assert.match(emissao.whatsapp, /^https:\/\/wa\.me\/5565999999999\?text=/);
  assert.equal((await a.servico.conferir(token)).valido, true);
  assert(!emissao.link.includes("CODIGO-NATIVO"), "Código do Firebase não é entregue legível");
  assert(!JSON.stringify([...a.docs.values()]).includes("CODIGO-NATIVO"));
  assert(!JSON.stringify([...a.docs.values()]).includes(token));
  a.avancar(VALIDADE_RECUPERACAO_MS - 1);
  assert.equal((await a.servico.conferir(token)).valido, true, "Válido até antes dos 30 minutos");
  a.avancar(1);
  await rejeita(a.servico.conferir(token), 410);
  await rejeita(
    a.servico.redefinir({ token, senha: "Senha teste 123", confirmacao: "Senha teste 123" }),
    410,
  );
  assert.equal(a.aplicacoes.length, 0);

  const b = ambiente(),
    antigo = await emitir(b);
  await rejeita(emitir(b), 429);
  b.avancar(61000);
  const novo = await emitir(b);
  await rejeita(b.servico.conferir(tokenDe(antigo)), 410);
  const novoToken = tokenDe(novo);
  await rejeita(
    b.servico.redefinir({ token: novoToken, senha: "curta", confirmacao: "curta" }),
    400,
  );
  await rejeita(
    b.servico.redefinir({
      token: novoToken,
      senha: "Senha teste 123",
      confirmacao: "Outra senha 123",
    }),
    400,
  );
  const simultaneos = await Promise.allSettled([
    b.servico.redefinir({
      token: novoToken,
      senha: "Senha teste 123",
      confirmacao: "Senha teste 123",
    }),
    b.servico.redefinir({
      token: novoToken,
      senha: "Senha teste 456",
      confirmacao: "Senha teste 456",
    }),
  ]);
  assert.equal(simultaneos.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(b.aplicacoes.length, 1, "Uma única troca mesmo com solicitações simultâneas");
  const corte = b.docs.get("cliente1").revogadoAntesEm;
  assert.equal(corte, b.agora());
  b.avancar(61000);
  await emitir(b);
  assert.equal(
    b.docs.get("cliente1").revogadoAntesEm,
    corte,
    "Novo link não reativa sessões antigas",
  );
  await rejeita(b.servico.conferir(novoToken), 410);
  assert.deepEqual(b.contaAntiga, { historico: [1, 2], bonus: 10, rank: "Prata" });
  const log = JSON.stringify(b.eventos);
  assert(!log.includes(novoToken));
  assert(!log.includes("Senha teste"));
  assert(!log.includes("CODIGO-NATIVO"));

  const c = ambiente();
  await rejeita(emitir(c, "cliente"), 403);
  await rejeita(emitir(c, "revogado"), 401);
  await rejeita(c.servico.emitir({ telefone: "65999999999" }), 401);
  assert.equal(c.docs.size, 0);
  assert.equal((await emitir(c, "permitido")).validadeMinutos, 30);
  const d = ambiente();
  d.usuario.disabled = true;
  await rejeita(emitir(d), 409);
  d.usuario.disabled = false;
  d.usuario.providerData = [];
  await rejeita(emitir(d), 409);
  await rejeita(d.servico.emitir({ authorization: "Bearer admin", telefone: "1234" }), 400);
  await rejeita(d.servico.emitir({ authorization: "Bearer admin", telefone: "65988888888" }), 409);

  const e = ambiente(),
    seguro = tokenDe(await emitir(e));
  await rejeita(e.servico.conferir(seguro.slice(0, 20) + "X" + seguro.slice(21)), 410);
  const outraChave = criarServicoRecuperacao({ ...e.opcoes, chave: crypto.randomBytes(32) });
  await rejeita(outraChave.conferir(seguro), 410);
  const outroSite = criarServicoRecuperacao({ ...e.opcoes, siteUrl: "https://outro.exemplo/" });
  await rejeita(outroSite.conferir(seguro), 410);
  e.usuario.phoneNumber = "+5565988888888";
  await rejeita(e.servico.conferir(seguro), 410, "Troca do contato invalida link antigo");

  const f = ambiente(),
    falho = tokenDe(await emitir(f));
  f.falharAplicacao();
  await assert.rejects(
    f.servico.redefinir({ token: falho, senha: "Senha teste 123", confirmacao: "Senha teste 123" }),
  );
  await rejeita(f.servico.conferir(falho), 410, "Falha externa não reabre o uso reservado");

  const g = ambiente();
  const handler = criarHandlerRecuperacao({
    obterServico: () => g.servico,
    estaConfigurado: () => true,
  });
  assert.equal((await api(handler, { method: "GET" })).dados.validadeMinutos, 30);
  assert.equal((await api(handler, { method: "DELETE" })).status, 405);
  assert.equal(
    (await api(handler, { body: { acao: "emitir", telefone: "65999999999" } })).status,
    401,
  );
  assert.equal(
    (
      await api(handler, {
        body: { acao: "emitir", telefone: "65999999999" },
        headers: { authorization: "Bearer cliente" },
      })
    ).status,
    403,
  );
  assert.equal(
    (await api(handler, { headers: { origin: "https://invasor.exemplo" }, body: {} })).status,
    403,
  );
  assert.equal(
    (
      await api(handler, {
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: {},
      })
    ).status,
    415,
  );
  assert.equal((await api(handler, { body: "{json quebrado" })).status, 400);
  assert.equal((await api(handler, { body: { acao: "x", texto: "A".repeat(20000) } })).status, 413);
  const criada = await api(handler, {
    headers: { authorization: "Bearer admin" },
    body: { acao: "emitir", telefone: "65999999999", expiraEm: 999999999999999, admin: true },
  });
  assert.equal(criada.status, 200);
  assert.equal(
    criada.dados.expiraEm - g.agora(),
    VALIDADE_RECUPERACAO_MS,
    "Prazo do cliente é ignorado",
  );
  assert.equal(criada.headers["Cache-Control"], "no-store");
  const fechado = criarHandlerRecuperacao({
    estaConfigurado: () => false,
    obterServico: () => {
      throw new ErroRecuperacao(503, "Configuração pendente.");
    },
  });
  assert.equal((await api(fechado, { method: "GET" })).dados.disponivel, false);
  assert.equal((await api(fechado, { body: { acao: "emitir" } })).status, 503);
  assert.equal(configurado({ RECUPERACAO_ACESSO_ATIVA: "true" }), false);
  assert.throws(() =>
    criarServicoRecuperacao({ ...g.opcoes, siteUrl: "http://inseguro.exemplo/" }),
  );
  assert.throws(() => criarServicoRecuperacao({ ...g.opcoes, chave: Buffer.alloc(10) }));
  console.log(
    "PASS: recuperação expira em 30 minutos no servidor; uso único/transação, concorrência, novo link, vínculo do telefone, permissão administrativa, criptografia, logs sem segredo, limites HTTP e configuração desativada.",
  );
})().catch((erro) => {
  console.error(erro);
  process.exitCode = 1;
});
