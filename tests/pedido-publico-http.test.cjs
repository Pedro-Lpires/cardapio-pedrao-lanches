const assert = require("node:assert/strict");
const { criarHandlerPedidoPublico } = require("../api/pedido-publico.js");
const { criarLimitadorPedido } = require("../api/_lib/pedido-publico-runtime.cjs");
async function executar(handler, body, headers = {}, method = "POST") {
  const res = {
    headers: {},
    setHeader(k, v) {
      this.headers[k] = v;
    },
    end(v) {
      this.body = JSON.parse(v);
    },
  };
  await handler(
    {
      method,
      body,
      headers: { "content-type": "application/json", ...headers },
      socket: { remoteAddress: "rede-teste" },
    },
    res,
  );
  return res;
}
(async () => {
  let chamadas = 0;
  const handler = criarHandlerPedidoPublico({
    estaConfigurado: () => true,
    obterServico: () => ({
      origem: "https://pedrao.exemplo",
      salvar: async (d) => {
        chamadas++;
        assert.equal(d.authorization, "Bearer cliente");
        assert.equal(d.origemRede, "rede-teste");
        assert.equal(d.gravar, undefined);
        return { pedido: { id: "seguro" } };
      },
    }),
  });
  assert.equal(
    (
      await executar(
        handler,
        { acao: "salvar", pedido: {}, gravar: true },
        { authorization: "Bearer cliente" },
      )
    ).statusCode,
    200,
  );
  assert.equal(chamadas, 1);
  assert.equal((await executar(handler, {}, {}, "DELETE")).statusCode, 405);
  assert.equal(
    (await executar(handler, {}, { origin: "https://invasor.exemplo" })).statusCode,
    403,
  );
  assert.equal((await executar(handler, "{errado")).statusCode, 400);
  assert.equal((await executar(handler, { acao: "apagar" })).statusCode, 400);
  assert.equal((await executar(handler, {}, { "content-type": "text/plain" })).statusCode, 415);
  assert.equal(
    (await executar(handler, { acao: "salvar", pedido: { observacao: "x".repeat(131073) } }))
      .statusCode,
    413,
  );
  const desligado = criarHandlerPedidoPublico({
    estaConfigurado: () => false,
    obterServico: () => {
      throw Error("Não deve inicializar credenciais");
    },
  });
  const gate = await executar(desligado, null, {}, "GET");
  assert.equal(gate.body.disponivel, false);
  assert.equal(gate.headers["Cache-Control"], "no-store");
  assert.equal((await executar(desligado, { acao: "salvar" })).statusCode, 503);
  const dados = new Map();
  const db = {
    collection: () => ({ doc: (id) => ({ id }) }),
    runTransaction: async (fn) => {
      const w = [];
      await fn({
        get: async (r) => ({ exists: dados.has(r.id), data: () => dados.get(r.id) }),
        set: (r, v) => w.push([r.id, v]),
      });
      w.forEach(([k, v]) => dados.set(k, v));
    },
  };
  const limitar = criarLimitadorPedido(db);
  for (let i = 0; i < 60; i++)
    await limitar({ origemRede: "rede", clienteId: "65999999999", em: 1000000 });
  await assert.rejects(
    limitar({ origemRede: "rede", clienteId: "65999999999", em: 1000000 }),
    (e) => e.status === 429,
  );
  assert.equal(
    dados.get("global").quantidade,
    60,
    "Rejeição não consome parcialmente outros limites",
  );
  await limitar({ origemRede: "rede", clienteId: "65999999999", em: 2000000 });
  assert.equal(dados.get("global").quantidade, 1);
  assert([...dados.keys()].every((k) => !k.includes("65999999999")));
  console.log(
    "API de pedido: desligamento seguro, origem, tamanho, ações e limites persistentes conferidos.",
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
