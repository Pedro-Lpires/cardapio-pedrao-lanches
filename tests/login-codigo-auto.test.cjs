const fs = require("fs"),
  vm = require("vm"),
  assert = require("node:assert/strict");
const campos = Object.fromEntries(
  [
    "login-auto-nome",
    "login-auto-telefone",
    "login-auto-codigo",
    "status-login-auto",
    "auto-confirmar-conta",
  ].map((id) => [id, { value: "", textContent: "", disabled: false }]),
);
let documentos = [],
  consultas = 0,
  entradas = 0;
const db = {
  collection(nome) {
    assert.equal(nome, "clientes");
    return {
      where(campo, op, codigo) {
        consultas++;
        assert.equal(campo, "codigoAtivacao");
        assert.equal(op, "==");
        assert.equal(codigo, "TESTE-123");
        return {
          limit(n) {
            assert.equal(n, 2);
            return {
              async get() {
                return { docs: documentos };
              },
            };
          },
        };
      },
    };
  },
};
const ctx = vm.createContext({
  console,
  document: { addEventListener() {}, getElementById: (id) => campos[id] },
  db,
  async entrarClienteAutoatendimento() {
    entradas++;
    assert.equal(campos["login-auto-nome"].value, "Cliente fictício");
    assert.equal(campos["login-auto-telefone"].value, "65999999999");
  },
});
vm.runInContext(fs.readFileSync("js/fluxos-interface.js", "utf8"), ctx);
(async () => {
  campos["login-auto-codigo"].value = " TESTE-123 ";
  documentos = [
    { id: "65999999999", data: () => ({ nome: "Cliente fictício", telefone: "(65) 99999-9999" }) },
  ];
  await ctx.entrarContaAutoUI();
  assert.equal(entradas, 1);
  assert.equal(campos["auto-confirmar-conta"].disabled, false);
  documentos = [];
  await ctx.entrarContaAutoUI();
  assert.equal(entradas, 1);
  assert.match(campos["status-login-auto"].textContent, /não encontrado/);
  documentos = [{ data: () => ({}) }, { data: () => ({}) }];
  await ctx.entrarContaAutoUI();
  assert.equal(entradas, 1);
  assert.match(campos["status-login-auto"].textContent, /mais de uma conta/);
  campos["login-auto-codigo"].value = "";
  await ctx.entrarContaAutoUI();
  assert.equal(entradas, 2);
  assert.equal(consultas, 3);
  console.log(
    "PASS: código sozinho recupera a conta; inválido/duplicado não entra; nome e celular continuam funcionando sem código.",
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
