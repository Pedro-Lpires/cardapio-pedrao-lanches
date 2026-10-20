const fs = require("node:fs"),
  vm = require("node:vm"),
  assert = require("node:assert/strict");
const campo = { value: "errado" },
  botao = { disabled: false },
  avisos = [];
let escritas = 0;
let atualizacoes = 0;
let cliente = { telefone: "123", codigoAtivacao: "CDA123", fidelidadeAtiva: false };
const ctx = vm.createContext({
  clienteLogado: cliente,
  document: { getElementById: () => campo, querySelector: () => botao },
  alert: (msg) => avisos.push(msg),
  atualizarTelaClienteLogado: () => atualizacoes++,
  db: {
    collection: () => ({ doc: () => ({}) }),
    runTransaction: async (fn) =>
      fn({
        get: async () => ({ exists: true, data: () => cliente }),
        update: (_, dados) => {
          cliente = { ...cliente, ...dados };
          escritas++;
        },
      }),
  },
});
const fonte = fs.readFileSync("js/script.js", "utf8");
vm.runInContext(
  fonte.slice(
    fonte.indexOf("async function ativarCodigoClienteLogado("),
    fonte.indexOf("function explicarCodigo("),
  ),
  ctx,
);
(async () => {
  await ctx.ativarCodigoClienteLogado();
  assert.match(avisos.at(-1), /Código inválido/);
  assert.equal(escritas, 0);
  assert.equal(botao.disabled, false);
  campo.value = "";
  await ctx.ativarCodigoClienteLogado();
  assert.match(avisos.at(-1), /Digite/);
  campo.value = "CDA123";
  await ctx.ativarCodigoClienteLogado();
  assert.equal(escritas, 1);
  assert.equal(ctx.clienteLogado.fidelidadeAtiva, true);
  assert.equal(atualizacoes, 1);
  campo.value = "CDA123";
  await ctx.ativarCodigoClienteLogado();
  assert.equal(escritas, 1);
  console.log("PASS: ativação valida código, avisa inválido/vazio e ativa uma única vez.");
})().catch((erro) => {
  console.error(erro);
  process.exitCode = 1;
});
