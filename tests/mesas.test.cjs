const fs = require("node:fs"),
  vm = require("node:vm"),
  assert = require("node:assert/strict");
const area = { innerHTML: "" };
const registros = new Map([["antiga", { numero: 1, ocupada: true }]]);
let aberta;
const doc = (id) => ({ id, exists: registros.has(id), data: () => registros.get(id) });
const consulta = (numero) => ({
  orderBy() {
    return this;
  },
  where(_, __, valor) {
    return consulta(valor);
  },
  limit() {
    return this;
  },
  get: async () => {
    const docs = [...registros.keys()]
      .filter((id) => numero === undefined || registros.get(id).numero === numero)
      .map(doc);
    return { docs, forEach: (cb) => docs.forEach(cb) };
  },
  doc: (id) => ({ id }),
});
const ctx = vm.createContext({
  document: { getElementById: () => area },
  escaparOperacao: String,
  abrirMesaAtendente: async (id) => {
    aberta = id;
  },
  alert: () => assert.fail("Falha ao abrir mesa"),
  db: {
    collection: () => consulta(),
    runTransaction: async (fn) =>
      fn({ get: async (ref) => doc(ref.id), set: (ref, dados) => registros.set(ref.id, dados) }),
  },
});
const fonte = fs.readFileSync("js/atendente.js", "utf8");
vm.runInContext(
  fonte.slice(
    fonte.indexOf("async function abrirMesaNovaAtendente("),
    fonte.indexOf("async function adicionarItemComanda("),
  ),
  ctx,
);
(async () => {
  await ctx.areaConsumoLocalRecarregar();
  assert.equal((area.innerHTML.match(/class="mesa-atendente"/g) || []).length, 20);
  assert.match(area.innerHTML, /Mesa 20/);
  assert.match(area.innerHTML, /#ff8080/);
  assert.equal(registros.size, 1);
  await ctx.abrirMesaNovaAtendente(20);
  assert.equal(aberta, "mesa-20");
  assert.equal(registros.size, 2);
  await ctx.abrirMesaNovaAtendente(20);
  assert.equal(registros.size, 2);
  await ctx.abrirMesaNovaAtendente(1);
  assert.equal(aberta, "antiga");
  assert.equal(registros.get("antiga").ocupada, true);
  console.log(
    "PASS: grade até mesa 20, criação no primeiro uso sem duplicar ou alterar mesas existentes.",
  );
})().catch((erro) => {
  console.error(erro);
  process.exitCode = 1;
});
