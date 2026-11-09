const fs = require("node:fs");
const vm = require("node:vm");
const assert = require("node:assert/strict");

const campos = {
  "login-auto-nome": { value: "Cliente fictício" },
  "login-auto-telefone": { value: "(65) 99999-9999" },
  "login-auto-senha-protegida": { value: "senha-de-teste" },
  "login-auto-salvar": { checked: true },
  "status-login-auto": {},
  "auto-confirmar-conta": {},
};
let credenciais,
  vinculou = false;
const contexto = vm.createContext({
  sessaoAutoatendimentoAtual: { id: "visita-teste" },
  document: { addEventListener() {}, getElementById: (id) => campos[id] },
  acessoClienteSenhaUI: {
    ativo: async () => true,
    entrar: async (dados) => {
      credenciais = { ...dados };
      return { nome: "Cliente fictício", telefone: "65999999999" };
    },
  },
  mesaProtegidaUI: { ativo: async () => true },
  vincularClienteMesaProtegidaUI: async () => {
    vinculou = true;
  },
  alert: (msg) => assert.fail(msg),
});
contexto.window = contexto;
const fonte = fs.readFileSync("js/autoatendimento.js", "utf8");
vm.runInContext(
  fonte.slice(
    fonte.indexOf("async function entrarClienteAutoatendimento("),
    fonte.indexOf("function atualizarAvataresContaAutoUI("),
  ),
  contexto,
);
vm.runInContext(fs.readFileSync("js/fluxos-interface.js", "utf8"), contexto);
(async () => {
  assert.doesNotMatch(fs.readFileSync("autoatendimento.html", "utf8"), /id="login-auto-codigo"/);
  await contexto.entrarContaAutoUI();
  assert.deepEqual(credenciais, {
    nome: "Cliente fictício",
    telefone: "65999999999",
    senha: "senha-de-teste",
    lembrar: true,
  });
  assert.equal(vinculou, true);
  assert.equal(campos["login-auto-senha-protegida"].value, "");
  assert.equal(campos["auto-confirmar-conta"].disabled, false);
  console.log("PASS: login da mesa envia celular e senha, sem CDA, e vincula a conta à visita.");
})().catch((erro) => {
  console.error(erro);
  process.exitCode = 1;
});
