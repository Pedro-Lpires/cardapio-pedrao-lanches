const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  vm = require("node:vm");
function fixture(pagina = "/atendente.html") {
  const chamadas = [],
    persistencias = [],
    apps = [{ name: "[DEFAULT]", options: { projectId: "teste" } }];
  let usuario = null,
    disponivel = true,
    offline = false,
    perfilNegado = false,
    atraso = null;
  const cliente = { uid: "cliente-preservado" };
  const auth = {
    get currentUser() {
      return usuario;
    },
    onAuthStateChanged(cb) {
      queueMicrotask(() => cb(usuario));
      return () => {};
    },
    async setPersistence(p) {
      persistencias.push(p);
    },
    async signInWithCustomToken(t) {
      assert.equal(t, "custom-teste");
      usuario = { uid: "equipe-teste", getIdToken: async () => "id-equipe" };
    },
    async signOut() {
      usuario = null;
    },
  };
  const firebase = {
    apps,
    app: () => apps[0],
    auth: Object.assign(() => ({ currentUser: cliente }), {
      Auth: { Persistence: { LOCAL: "local", SESSION: "sessao" } },
    }),
    firestore: () => "db-cliente",
    initializeApp(options, name) {
      const app = { name, options, auth: () => auth, firestore: () => "db-equipe" };
      apps.push(app);
      return app;
    },
  };
  const contexto = vm.createContext({
    console,
    firebase,
    queueMicrotask,
    location: { pathname: pagina },
    fetch: async (url, opcoes) => {
      chamadas.push({ url, opcoes });
      if (offline) throw Error("offline");
      const body = opcoes.body ? JSON.parse(opcoes.body) : null;
      if (!body) return { status: 200, ok: true, json: async () => ({ disponivel }) };
      if (body.acao === "entrar") {
        assert.equal(body.codigo, "123456");
        return { ok: true, json: async () => ({ token: "custom-teste" }) };
      }
      if (body.acao === "perfil") {
        if (atraso) {
          atraso.iniciou();
          await atraso.espera;
        }
        assert.equal(opcoes.headers.Authorization, "Bearer id-equipe");
        return {
          ok: !perfilNegado,
          json: async () =>
            perfilNegado
              ? { erro: "Inativo" }
              : { funcionario: { id: "a", nome: "Chapa Teste", perfil: "chapa", admin: false } },
        };
      }
      throw Error("Ação não prevista");
    },
    document: { addEventListener() {}, documentElement: { classList: { add() {} } } },
  });
  vm.runInContext(fs.readFileSync("js/acesso-equipe-ui.js", "utf8"), contexto);
  return {
    contexto,
    chamadas,
    persistencias,
    apps,
    auth,
    cliente,
    indisponivel() {
      disponivel = false;
    },
    offline() {
      offline = true;
    },
    negar() {
      perfilNegado = true;
    },
    atrasarPerfil() {
      let liberar, iniciou;
      const espera = new Promise((r) => (liberar = r)),
        comecou = new Promise((r) => (iniciou = r));
      atraso = { espera, iniciou };
      return { liberar, comecou };
    },
  };
}
(async () => {
  const f = fixture(),
    ui = f.contexto;
  assert.equal(await ui.acessoEquipeDisponivelUI(), true);
  assert.equal(
    await ui.restaurarEquipeProtegidaUI(),
    null,
    "Dados locais não substituem uma sessão Auth",
  );
  assert.equal(ui.dbEquipeProtegidaUI(), "db-equipe");
  const perfil = await ui.entrarEquipeProtegidaUI("123456", true);
  assert.equal(perfil.perfil, "chapa");
  assert.equal(f.persistencias.at(-1), "local");
  assert.equal(
    f.cliente.uid,
    "cliente-preservado",
    "Entrar como equipe não altera o login do delivery",
  );
  assert.equal(f.apps.filter((a) => a.name === "operacao-pedrao").length, 1);
  assert.equal((await ui.restaurarEquipeProtegidaUI()).id, "a");
  assert(f.chamadas.every((c) => c.opcoes.credentials === "omit" && c.opcoes.cache === "no-store"));
  await ui.sairEquipeProtegidaUI();
  assert.equal(await ui.restaurarEquipeProtegidaUI(), null);
  await ui.entrarEquipeProtegidaUI("123456", false);
  assert.equal(f.persistencias.at(-1), "sessao");
  f.negar();
  await assert.rejects(ui.restaurarEquipeProtegidaUI(), /Inativo/);
  await assert.rejects(ui.entrarEquipeProtegidaUI("123456", false), /Inativo/);
  assert.equal(f.auth.currentUser, null, "Perfil recusado encerra a nova sessão da equipe");
  const legado = fixture();
  legado.indisponivel();
  assert.equal(await legado.contexto.acessoEquipeDisponivelUI(), false);
  const queda = fixture();
  queda.offline();
  await assert.rejects(queda.contexto.acessoEquipeDisponivelUI(), /offline/);
  assert.equal(queda.contexto.equipeProtegidaAtivaUI(), false);
  const corrida = fixture();
  await corrida.contexto.entrarEquipeProtegidaUI("123456");
  const atraso = corrida.atrasarPerfil();
  const restauracao = corrida.contexto.restaurarEquipeProtegidaUI();
  await atraso.comecou;
  await corrida.contexto.sairEquipeProtegidaUI();
  atraso.liberar();
  assert.equal(await restauracao, null, "Resposta atrasada não restaura perfil após Sair");
  const dono = fixture("/admin.html");
  assert.equal(dono.contexto.appEquipeProtegidaUI().name, "administracao-protegida");
  assert.equal(
    dono.apps.some((a) => a.name === "operacao-pedrao"),
    false,
    "Sessão do proprietário não reaproveita a da equipe",
  );
  console.log(
    "PASS: equipe usa Auth separado do cliente, persistência conforme escolha, restauração validada no servidor, logout, perfil inativo e falha de rede sem acesso pelo armazenamento local.",
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
