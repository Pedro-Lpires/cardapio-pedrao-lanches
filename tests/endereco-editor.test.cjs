const fs = require("node:fs");
const vm = require("node:vm");
const assert = require("node:assert/strict");
let enderecos = [
  { nome: "Casa", rua: "Rua A", numero: "10", bairro: "Centro", extra: true },
  { nome: "Trabalho" },
];
let escritas = 0;
let atualizado = 0;
const campos = Object.fromEntries(
  ["nome", "rua", "numero", "bairro", "complemento"].map((nome) => [nome, { value: "" }]),
);
const botoes = [{}, {}, {}];
const status = { textContent: "" };
const form = { elements: { namedItem: (nome) => campos[nome] }, querySelectorAll: () => botoes };
let fechado = false;
const modal = {
  setAttribute() {},
  addEventListener() {},
  showModal() {},
  close() {
    fechado = true;
  },
  querySelector: (seletor) =>
    seletor === "form"
      ? form
      : seletor === ".editor-endereco-status"
        ? status
        : seletor.includes("fechar")
          ? botoes[0]
          : botoes[1],
};
const ref = { get: async () => ({ data: () => ({ enderecos }) }) };
const ctx = vm.createContext({
  clienteLogado: { telefone: "123" },
  db: {
    collection: () => ({ doc: () => ref }),
    runTransaction: async (acao) =>
      acao({
        get: ref.get,
        update: (_, dados) => {
          escritas++;
          enderecos = dados.enderecos;
        },
      }),
  },
  document: { getElementById: () => null, createElement: () => modal, body: { append() {} } },
  abrirEnderecosCliente: async () => {
    atualizado++;
  },
  alert: () => assert.fail("Edição não deve usar alertas"),
});
const fonte = fs.readFileSync("js/script.js", "utf8");
vm.runInContext(
  fonte.slice(
    fonte.indexOf("async function editarEnderecoCliente("),
    fonte.indexOf("function buscarProdutoAtual("),
  ),
  ctx,
);
(async () => {
  await ctx.editarEnderecoCliente(0);
  assert.equal(campos.rua.value, "Rua A");
  botoes[1].onclick();
  assert.equal(fechado, true);
  assert.equal(escritas, 0);
  fechado = false;
  await ctx.editarEnderecoCliente(0);
  campos.nome.value = " ";
  await form.onsubmit({ preventDefault() {} });
  assert.equal(escritas, 0);
  assert.match(status.textContent, /Preencha/);
  campos.nome.value = "Casa nova";
  campos.rua.value = "Rua B";
  await form.onsubmit({ preventDefault() {} });
  assert.equal(escritas, 1);
  assert.equal(enderecos[0].rua, "Rua B");
  assert.equal(enderecos[0].extra, true);
  assert.equal(enderecos[1].nome, "Trabalho");
  assert.equal(atualizado, 1);
  assert.equal(fechado, true);
  console.log(
    "PASS: edição preenchida, cancelar sem escrita, validação e atualização preservando outros endereços.",
  );
})().catch((erro) => {
  console.error(erro);
  process.exitCode = 1;
});
