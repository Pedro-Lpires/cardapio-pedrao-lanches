const assert = require("node:assert/strict");
const fs = require("node:fs"),
  vm = require("node:vm");
const { criarAcessoClienteUI, criarAvisoSenhaClienteUI } = require("../js/acesso-cliente-ui.js");
function fixture() {
  let usuario = null,
    removidos = 0,
    disponivel = true,
    rejeitarPerfil = false;
  const chamadas = [],
    persistencias = [],
    entradas = [];
  const perfil = {
    nome: "Pessoa Teste",
    telefone: "65999999999",
    authUid: "u1",
    nivelCliente: "Prata",
  };
  const novoUsuario = () => ({
    uid: "u1",
    async getIdToken(atualizar) {
      assert.equal(atualizar, true);
      return "id-u1";
    },
  });
  const auth = {
    get currentUser() {
      return usuario;
    },
    onAuthStateChanged(cb) {
      queueMicrotask(() => cb(usuario));
      return () => {};
    },
    async setPersistence(modo) {
      persistencias.push(modo);
    },
    async signInWithEmailAndPassword(email, senha) {
      entradas.push({ email, senha });
      if (senha === "errada") throw Error("Firebase error com detalhe interno");
      usuario = novoUsuario();
    },
    async signInWithCustomToken(token) {
      assert.equal(token, "custom-u1");
      usuario = novoUsuario();
    },
    async signOut() {
      usuario = null;
    },
  };
  const fetchHttp = async (url, opcoes) => {
    chamadas.push({ url, opcoes });
    const body = opcoes.body ? JSON.parse(opcoes.body) : null;
    if (!body) return { ok: true, json: async () => ({ disponivel }) };
    assert.equal(opcoes.cache, "no-store");
    assert.equal(opcoes.credentials, "omit");
    assert.equal(opcoes.referrerPolicy, "no-referrer");
    if (body.acao === "perfil") {
      assert.equal(opcoes.headers.Authorization, "Bearer id-u1");
      return {
        ok: !rejeitarPerfil,
        json: async () =>
          rejeitarPerfil ? { erro: "Sessão inválida." } : { cliente: { ...perfil } },
      };
    }
    if (body.acao === "entrarTeste")
      return {
        ok: true,
        json: async () => ({ cliente: { ...perfil, authUid: null, precisaCriarSenha: true } }),
      };
    return { ok: true, json: async () => ({ token: "custom-u1" }) };
  };
  const deps = { auth, fetchHttp, limparLegado: () => removidos++ };
  return {
    deps,
    chamadas,
    persistencias,
    entradas,
    auth,
    perfil,
    setDisponivel(v) {
      disponivel = v;
    },
    rejeitar() {
      rejeitarPerfil = true;
    },
    removidos: () => removidos,
  };
}
(async () => {
  const f = fixture(),
    delivery = criarAcessoClienteUI(f.deps),
    auto = criarAcessoClienteUI(f.deps);
  assert.equal(
    await delivery.restaurar(),
    null,
    "Nome e telefone salvos não viram uma sessão Auth",
  );
  assert.equal(f.chamadas.filter((c) => c.opcoes.body).length, 0);
  const cliente = await delivery.entrar({
    telefone: f.perfil.telefone,
    senha: "Uma senha ficticia",
    lembrar: true,
  });
  assert.equal(cliente.nivelCliente, "Prata");
  assert.equal(f.persistencias.at(-1), "local");
  assert.equal(f.entradas[0].email, "65999999999@clientes.pedrao-lanches.invalid");
  assert.equal(
    (await auto.restaurar()).authUid,
    cliente.authUid,
    "Os dois canais usam a mesma sessão do Firebase",
  );
  await auto.sair();
  assert.equal(await delivery.restaurar(), null, "Sair remove o login compartilhado");
  await assert.rejects(
    delivery.entrar({ telefone: f.perfil.telefone, senha: "errada" }),
    /não conferem/,
  );
  assert.equal(f.auth.currentUser, null);
  const antes = f.chamadas.length;
  await assert.rejects(
    delivery.criarSenha({ senha: "curta", confirmacao: "diferente" }),
    /pelo menos/,
  );
  assert.equal(f.chamadas.length, antes, "Senha inválida não é enviada");
  await delivery.criarSenha({
    nome: f.perfil.nome,
    telefone: f.perfil.telefone,
    senha: "Frase ficticia longa",
    confirmacao: "Frase ficticia longa",
    lembrar: false,
  });
  assert.equal(f.persistencias.at(-1), "session");
  assert.equal(f.auth.currentUser.uid, "u1");
  await delivery.sair();
  const teste = await delivery.entrar({
    nome: f.perfil.nome,
    telefone: f.perfil.telefone,
    senha: "",
  });
  assert.equal(teste.precisaCriarSenha, true);
  assert.equal(f.auth.currentUser, null);
  const desligado = fixture();
  desligado.setDisponivel(false);
  const inativo = criarAcessoClienteUI(desligado.deps);
  await assert.rejects(
    inativo.criarSenha({ senha: "Senha ficticia longa", confirmacao: "Senha ficticia longa" }),
    /Nenhuma senha foi salva/,
  );
  assert.equal(desligado.chamadas.length, 1);
  const offline = criarAcessoClienteUI({
    ...f.deps,
    fetchHttp: async () => {
      throw Error("offline");
    },
  });
  await assert.rejects(offline.restaurar(), /Verifique a conexão/);
  const estatico = criarAcessoClienteUI({
    ...f.deps,
    fetchHttp: async () => ({ ok: false, status: 404 }),
  });
  assert.equal(
    await estatico.ativo(),
    false,
    "Preview estático continua disponível sem simular um backend protegido",
  );
  await delivery.entrar({ codigo: "4979", senha: "Frase ficticia longa", lembrar: false });
  assert.equal(f.auth.currentUser.uid, "u1", "CDA precisa de senha e sessão validada no servidor");
  const atrasado = fixture();
  await atrasado.auth.signInWithEmailAndPassword("email-ficticio", "senha-ficticia");
  let liberar, avisar;
  const aguardando = new Promise((resolve) => {
    avisar = resolve;
  });
  const lento = criarAcessoClienteUI({
    ...atrasado.deps,
    fetchHttp: async (url, opcoes) => {
      if (opcoes.body && JSON.parse(opcoes.body).acao === "perfil")
        await new Promise((resolve) => {
          liberar = resolve;
          avisar();
        });
      return atrasado.deps.fetchHttp(url, opcoes);
    },
  });
  const leitura = lento.restaurar();
  await aguardando;
  await lento.sair();
  liberar();
  await assert.rejects(leitura, /conferir sua conta/);
  assert.equal(
    atrasado.auth.currentUser,
    null,
    "Uma resposta atrasada não reabre a conta após Sair",
  );
  f.rejeitar();
  await assert.rejects(auto.restaurar(), /Sessão inválida/);

  class Elemento {
    constructor(tag) {
      this.tag = tag;
      this.children = [];
      this.attrs = {};
    }
    setAttribute(n, v) {
      this.attrs[n] = v;
    }
    append(...itens) {
      this.children.push(...itens);
    }
  }
  global.document = { createElement: (tag) => new Elemento(tag) };
  try {
    let abertos = 0;
    const aviso = criarAvisoSenhaClienteUI(
      { nome: "<img src=x>", telefone: f.perfil.telefone },
      () => abertos++,
    );
    assert.equal(aviso.children[0].children[1].textContent, "Pedrão Lanches · Administração");
    aviso.children.at(-1).onclick();
    assert.equal(abertos, 1);
    assert.equal(JSON.stringify(aviso).includes("<img src=x>"), false);
    assert.equal(
      criarAvisoSenhaClienteUI(f.perfil, () => {}),
      null,
      "O aviso some para quem já criou senha",
    );
  } finally {
    delete global.document;
  }

  const contexto = vm.createContext({
    module: { exports: {} },
    db: { collection: (colecao) => ({ where: (...args) => ({ colecao, args }) }) },
  });
  vm.runInContext(fs.readFileSync("js/acesso-cliente-ui.js", "utf8"), contexto);
  const consulta = contexto.consultaHistoricoClienteSenhaUI("pedidos", {
    ...f.perfil,
    historicoLegadoVerificado: false,
  });
  assert.equal(consulta.args[0], "clienteAuthUid");
  assert.equal(consulta.args[2], "u1");
  const legado = contexto.consultaHistoricoClienteSenhaUI("pedidos", {
    ...f.perfil,
    historicoLegadoVerificado: true,
  });
  assert.equal(legado.args[0], "clienteId");
  console.log(
    "PASS: login/sessão compartilhados, lembrar/sair, falha sem retorno ao legado, cadastro e aviso ADM sem senha no storage, CDA+senha e histórico novo por UID.",
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
