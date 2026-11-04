const assert = require("node:assert/strict");
const { criarMesaProtegidaUI } = require("../js/mesa-protegida-ui.js");
(async () => {
  const memoria = new Map(),
    chamadas = [],
    tokens = [];
  let ativo = true,
    usuario = null;
  const factory = () =>
    criarMesaProtegidaUI({
      ativo: async () => ativo,
      storage: {
        getItem: (k) => memoria.get(k),
        setItem: (k, v) => memoria.set(k, v),
        removeItem: (k) => memoria.delete(k),
      },
      aleatorio: () => Uint8Array.from({ length: 32 }, () => 7),
      authCliente: {
        get currentUser() {
          return usuario;
        },
        onAuthStateChanged(cb) {
          queueMicrotask(() => cb(usuario));
          return () => {};
        },
      },
      autenticarVisita: async (...args) => tokens.push(args),
      fetchHttp: async (url, opcoes) => {
        assert.equal(url, "/api/mesa-publica");
        const d = JSON.parse(opcoes.body);
        chamadas.push(d);
        assert.equal(opcoes.credentials, "omit");
        assert.equal(opcoes.headers.Authorization, usuario ? "Bearer token-cliente" : undefined);
        return {
          ok: true,
          json: async () =>
            d.acao === "enviar"
              ? { sessao: { id: "sessao-propria" }, token: "token-visita", visitaUid: "uid-visita" }
              : { sessao: { id: "sessao-propria" } },
        };
      },
    });
  let ui = factory();
  assert.equal((await ui.retomar(1)).sessao, null);
  await ui.iniciar(1, "Pessoa");
  assert(/^[a-f0-9]{64}$/.test(chamadas[0].segredo));
  ui = factory();
  await ui.retomar(1);
  assert.equal(
    chamadas[1].segredo,
    chamadas[0].segredo,
    "A recarga conserva a credencial daquela mesa",
  );
  assert.equal((await ui.retomar(2)).sessao, null, "Outra mesa tem sua própria visita");
  usuario = { uid: "cliente", getIdToken: async () => "token-cliente" };
  await ui.enviar(1, [{ produtoId: "lanche", quantidade: 1 }], 25);
  assert.deepEqual(tokens[0], ["token-visita", "uid-visita"]);
  await ui.solicitar(1, "atendente", true);
  assert.equal(
    chamadas.at(-1).segredo,
    undefined,
    "Mesa ocupada não reutiliza uma credencial de outra visita",
  );
  ui.apagar(1);
  assert.equal((await ui.retomar(1)).sessao, null);
  assert.equal(usuario.uid, "cliente", "Encerrar a visita não remove a conta lembrada");
  ativo = false;
  await assert.rejects(ui.estado(1));
  console.log(
    "PASS: credencial da visita persiste por mesa, token da visita fica separado do cliente e erro não cai no acesso legado.",
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
