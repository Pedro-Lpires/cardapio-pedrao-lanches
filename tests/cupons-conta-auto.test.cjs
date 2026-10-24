const fs = require("node:fs");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const cliente = "65999999999";
const registros = new Map();
const ref = (path) => ({
  doc: (id) => ref(path + "/" + id),
  collection: (id) => ref(path + "/" + id),
  where: (campo, operador, valor) => ({
    get: async () => ({ docs: filhos(path).filter((d) => d.data()[campo] === valor) }),
  }),
  get: async () => ({
    exists: registros.has(path),
    data: () => registros.get(path),
    docs: filhos(path),
  }),
});
const filhos = (path) =>
  [...registros].flatMap(([chave, dados]) =>
    chave.startsWith(path + "/") && !chave.slice(path.length + 1).includes("/")
      ? [{ id: chave.split("/").at(-1), data: () => dados }]
      : [],
  );
const ctx = vm.createContext({ db: { collection: ref }, console });
const fonte = fs.readFileSync("js/autoatendimento.js", "utf8");
vm.runInContext(
  fonte.slice(
    fonte.indexOf("async function buscarCuponsClienteAuto("),
    fonte.indexOf("async function sairContaAutoatendimento("),
  ),
  ctx,
);
const mensagem = (id, codigo, extra = {}) =>
  registros.set(`clientes/${cliente}/mensagens/${id}`, {
    remetente: "admin",
    cupomCodigo: codigo,
    lida: true,
    ...extra,
  });
const cupom = (codigo, extra = {}) =>
  registros.set("cuponsDesconto/" + codigo, { ativo: true, ...extra });
(async () => {
  // Campanha real grava somente uma mensagem, sem criar o vínculo antigo /cupons.
  mensagem("campanha", "B13");
  cupom("B13", { uso: "diversos", clientesPermitidos: [cliente] });
  let lista = await ctx.buscarCuponsClienteAuto(cliente);
  assert.equal(lista.length, 1);
  assert.equal(lista[0].codigo, "B13");
  assert.equal(lista[0].usosRestantes, null, "não inventa um limite para cupom reutilizável");
  mensagem("outra-campanha", "B13");
  registros.set(`clientes/${cliente}/cupons/B13`, { ativo: true, usosRestantes: 2 });
  lista = await ctx.buscarCuponsClienteAuto(cliente);
  assert.equal(lista.length, 1, "deduplica mensagem repetida e vínculo antigo");
  assert.equal(lista[0].usosRestantes, 2);
  registros.get(`clientes/${cliente}/cupons/B13`).usosRestantes = 0;
  assert.equal((await ctx.buscarCuponsClienteAuto(cliente)).length, 0, "não reativa uso esgotado");
  registros.get(`clientes/${cliente}/cupons/B13`).usosRestantes = 2;
  registros.get(`clientes/${cliente}/cupons/B13`).ativo = false;
  assert.equal((await ctx.buscarCuponsClienteAuto(cliente)).length, 0);
  registros.delete(`clientes/${cliente}/cupons/B13`);
  for (const [codigo, extra] of [
    ["INATIVO", { ativo: false }],
    ["USADO", { uso: "unico", usadoEm: "2026-10-24" }],
    ["OUTRA-CONTA", { clientesPermitidos: ["65888888888"] }],
  ]) {
    cupom(codigo, extra);
    mensagem(codigo, codigo);
  }
  mensagem("nao-existe", "INEXISTENTE");
  mensagem("autopromocao", "CLIENTE", { remetente: "cliente" });
  cupom("CLIENTE");
  cupom("UNICO", { uso: "unico" });
  mensagem("unico", "UNICO");
  cupom("LEGADO");
  registros.set(`clientes/${cliente}/cupons/LEGADO`, { ativo: true, usosRestantes: 3 });
  const antes = JSON.stringify([...registros]);
  lista = await ctx.buscarCuponsClienteAuto(cliente);
  assert.deepEqual(Array.from(lista, (c) => c.codigo).sort(), ["B13", "LEGADO", "UNICO"]);
  assert.equal(lista.find((c) => c.codigo === "UNICO").usosRestantes, 1);
  assert.equal(JSON.stringify([...registros]), antes, "abrir conta não grava nem consome cupom");
  assert.equal((await ctx.buscarCuponsClienteAuto("65888888888")).length, 0);
  assert.equal((await ctx.buscarCuponsClienteAuto(null)).length, 0);
  console.log(
    "PASS: autoatendimento encontra cupons enviados por campanha e preserva restrições e usos antigos.",
  );
})().catch((erro) => {
  console.error(erro);
  process.exitCode = 1;
});
