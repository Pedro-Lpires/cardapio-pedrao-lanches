const assert = require("node:assert/strict");
const { criarCheckoutProtegidoUI } = require("../js/checkout-protegido-ui.js");
function fixture() {
  let uid = "u1",
    disponivel = true,
    offline = false,
    perderResposta = false,
    contador = 0;
  const registros = new Map(),
    local = new Map(),
    chamadas = [];
  const auth = {
    get currentUser() {
      return uid
        ? {
            uid,
            getIdToken: async (forcar) => {
              assert.equal(forcar, true);
              return "token-" + uid;
            },
          }
        : null;
    },
    onAuthStateChanged(cb) {
      queueMicrotask(() => cb(auth.currentUser));
      return () => {};
    },
  };
  const storage = {
    getItem: (k) => local.get(k),
    setItem: (k, v) => local.set(k, v),
    removeItem: (k) => local.delete(k),
  };
  const fetchHttp = async (url, opcoes) => {
    assert.equal(url, "/api/pedido-publico");
    if (offline) throw Error("Sem conexão");
    if (!opcoes.body) return { ok: true, json: async () => ({ disponivel }) };
    const d = JSON.parse(opcoes.body);
    chamadas.push(d);
    assert.equal(opcoes.credentials, "omit");
    assert.equal(opcoes.cache, "no-store");
    assert.equal(opcoes.referrerPolicy, "no-referrer");
    assert.equal(opcoes.headers.Authorization, uid ? "Bearer token-" + uid : undefined);
    let retorno;
    if (d.acao === "salvar") {
      assert(/^[a-f0-9]{64}$/.test(d.chave));
      if (!registros.has(d.chave))
        registros.set(d.chave, { ...d.pedido, id: "p" + ++contador, clienteAuthUid: uid });
      retorno = { pedido: registros.get(d.chave) };
      if (perderResposta) {
        perderResposta = false;
        throw Error("Resposta perdida após salvar");
      }
    } else if (d.acao === "recuperar") retorno = { pedido: registros.get(d.chave) || null };
    else retorno = { acao: d.acao };
    return { ok: true, json: async () => retorno };
  };
  const construir = () =>
    criarCheckoutProtegidoUI({
      auth,
      storage,
      fetchHttp,
      aleatorio: () => Uint8Array.from({ length: 32 }, () => contador + 31),
    });
  return {
    construir,
    local,
    chamadas,
    registros,
    uid: (v) => (uid = v),
    desligar: () => (disponivel = false),
    offline: (v) => (offline = v),
    perder: () => (perderResposta = true),
  };
}
(async () => {
  const f = fixture();
  let ui = f.construir();
  assert.equal(await ui.ativo(), true);
  f.perder();
  await assert.rejects(ui.salvar({ tipo: "Retirada", valorTotal: 30 }));
  assert.equal(f.registros.size, 1);
  ui = f.construir(); // Recarga conserva só a chave, sem guardar endereço, pedido ou senha.
  const salvo = await ui.recuperar();
  assert.equal(salvo.pedido.id, "p1");
  assert.equal((await ui.salvar({ tipo: "Retirada", valorTotal: 30 })).pedido.id, "p1");
  assert.equal(f.registros.size, 1);
  assert(
    [...f.local.values()].every(
      (v) => !v.includes("Retirada") && !v.includes("senha") && !v.includes("valorTotal"),
    ),
  );
  ui.concluir();
  assert.equal(f.local.size, 0);
  assert.equal((await ui.salvar({ tipo: "Retirada", valorTotal: 30 })).pedido.id, "p2");
  f.uid("u2");
  ui = f.construir();
  assert.equal(
    (await ui.recuperar()).pedido,
    null,
    "Outra conta não reaproveita a confirmação do usuário anterior",
  );
  assert.equal(f.local.size, 0);
  f.uid(null);
  await ui.salvar({ tipo: "Local" });
  assert.equal(f.chamadas.at(-1).acao, "salvar");
  const g = fixture();
  g.offline(true);
  const indisponivel = g.construir();
  await assert.rejects(indisponivel.ativo());
  g.offline(false);
  assert.equal(
    await indisponivel.ativo(),
    true,
    "Uma falha permite tentar novamente, sem fallback para o banco",
  );
  const h = fixture();
  h.desligar();
  const legado = h.construir();
  assert.equal(await legado.ativo(), false);
  await assert.rejects(legado.salvar({}), /configuração/);
  console.log(
    "PASS: checkout público usa token real, falha fechada, recupera resposta perdida/recarga sem duplicar, separa contas e não armazena pedido ou senha.",
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
