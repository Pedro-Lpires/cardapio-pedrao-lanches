const fs = require("node:fs"),
  vm = require("node:vm"),
  assert = require("node:assert/strict");
const clone = (x) => JSON.parse(JSON.stringify(x));
function banco(inicial, falhar = false) {
  const dados = new Map(Object.entries(clone(inicial)));
  const ref = (path) => ({ path, id: path.split("/").at(-1) });
  const snap = (path) => ({
    ...ref(path),
    exists: dados.has(path),
    data: () => clone(dados.get(path)),
  });
  const query = (path, filtros = []) => ({
    doc: (id) => ref(path + "/" + id),
    where: (campo, op, valor) => query(path, [...filtros, [campo, valor]]),
    get: async () => ({
      docs: [...dados]
        .filter(
          ([p, d]) =>
            p.split("/").length === 2 &&
            p.startsWith(path + "/") &&
            filtros.every(([campo, valor]) => d[campo] === valor),
        )
        .map(([p]) => snap(p)),
    }),
  });
  return {
    dados,
    collection: query,
    runTransaction: async (fn) => {
      const escritas = [];
      const resultado = await fn({
        get: async (r) => {
          assert.equal(escritas.length, 0, "Ler antes de escrever");
          return snap(r.path);
        },
        update: (r, patch) => escritas.push([r.path, clone(patch)]),
      });
      if (falhar) throw Error("falha de rede");
      for (const [path, patch] of escritas) dados.set(path, { ...dados.get(path), ...patch });
      return resultado;
    },
  };
}
const inicial = {
  "mesas/m1": { numero: 1, ocupada: true },
  "mesas/m2": { numero: 2, ocupada: true },
  "comandas/c1": { mesa: 1, status: "Aberta", itens: [1], pagamentos: [] },
  "comandas/c2": {
    mesa: 1,
    status: "Aberta",
    itens: [2],
    pagamentos: [{ valorPago: 15, forma: "Pix", pagoEm: 10 }],
  },
  "comandas/c3": { mesa: 2, status: "Aberta", itens: [3], pagamentos: [] },
  "comandas/fechada": {
    mesa: 2,
    status: "Fechada",
    fechadoEm: 100,
    pagamentos: [{ valorPago: 20 }],
  },
  "filaCozinha/f1": { origemColecao: "comandas", origemId: "c1", status: "aguardando" },
  "filaCozinha/f2": { origemColecao: "comandas", origemId: "c2", status: "pronto" },
  "filaCozinha/entrega": { origemColecao: "pedidos", origemId: "c1", status: "aguardando" },
  "sessoesMesa/s1": { mesaId: "m1", status: "ativa" },
  "sessoesMesa/s2": { mesaId: "m2", status: "ativa" },
  "chamadosMesa/a1": { mesaId: "m1", status: "aberto" },
};
const ctx = vm.createContext({ Date, Set });
vm.runInContext(fs.readFileSync("js/mesas-limpeza.js", "utf8"), ctx);
(async () => {
  ctx.db = banco(inicial);
  await assert.rejects(
    () => ctx.cancelarComandasMesasOperacao({ comandaId: "c2" }),
    /pagamento registrado/,
  );
  assert.deepEqual(Object.fromEntries(ctx.db.dados), inicial, "Aviso não altera nada");
  await ctx.cancelarComandasMesasOperacao({ comandaId: "c2", pagamentosConfirmados: true });
  assert.equal(ctx.db.dados.get("comandas/c2").status, "Cancelada");
  assert.deepEqual(ctx.db.dados.get("comandas/c2").pagamentos, inicial["comandas/c2"].pagamentos);
  assert.equal(ctx.db.dados.get("mesas/m1").ocupada, true, "Outra comanda mantém a mesa ocupada");
  assert.equal(ctx.db.dados.get("sessoesMesa/s1").status, "ativa");
  ctx.db = banco(inicial);
  const resultado = await ctx.cancelarComandasMesasOperacao({ pagamentosConfirmados: true });
  assert.equal(resultado.comandas, 3);
  assert.equal(resultado.comPagamento, 1);
  assert.equal(ctx.db.dados.get("mesas/m1").ocupada, false);
  assert.equal(ctx.db.dados.get("mesas/m2").ocupada, false);
  assert.equal(ctx.db.dados.get("sessoesMesa/s1").status, "encerrada");
  assert.equal(ctx.db.dados.get("chamadosMesa/a1").status, "cancelado");
  assert.equal(ctx.db.dados.get("filaCozinha/f1").status, "cancelado");
  assert.equal(ctx.db.dados.get("filaCozinha/f2").status, "pronto");
  assert.deepEqual(ctx.db.dados.get("filaCozinha/entrega"), inicial["filaCozinha/entrega"]);
  assert.deepEqual(ctx.db.dados.get("comandas/fechada"), inicial["comandas/fechada"]);
  assert.deepEqual(ctx.db.dados.get("comandas/c2").pagamentos, inicial["comandas/c2"].pagamentos);
  for (const id of ["c1", "c2", "c3"])
    assert.equal(
      ctx.db.dados.get("comandas/" + id).fechadoEm,
      undefined,
      "Limpeza não finaliza vendas",
    );
  ctx.db = banco(inicial, true);
  await assert.rejects(
    () => ctx.cancelarComandasMesasOperacao({ pagamentosConfirmados: true }),
    /rede/,
  );
  assert.deepEqual(
    Object.fromEntries(ctx.db.dados),
    inicial,
    "Falha não deixa metade das mesas limpa",
  );
  console.log(
    "PASS: limpeza atômica, cancelamento com pagamento confirmado, histórico preservado, cozinha, sessões e mesa compartilhada.",
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
