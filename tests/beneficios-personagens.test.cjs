const fs = require("node:fs");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const memoria = new Map();
const avisos = [];
const listeners = new Map();
let abertos = 0,
  fechados = 0;
const ctx = vm.createContext({
  console,
  alert: (mensagem, personagem) => avisos.push({ mensagem, personagem }),
  localStorage: { getItem: (k) => memoria.get(k) ?? null, setItem: (k, v) => memoria.set(k, v) },
  db: {
    collection: () => ({
      doc: (id) => ({
        onSnapshot: (fn) => {
          abertos++;
          listeners.set(id, fn);
          return () => {
            fechados++;
          };
        },
      }),
    }),
  },
});
vm.runInContext(fs.readFileSync("js/personagens-ui.js", "utf8"), ctx);
const cliente = { telefone: "111", fidelidadeAtiva: true, nivelCliente: "Bronze" };
const receber = (dados, id = "111") => listeners.get(id)({ exists: true, data: () => dados });
ctx.acompanharBeneficiosClientePedraoUI(cliente);
receber(cliente);
assert.equal(avisos.length, 0, "Primeiro acesso não inventa uma promoção");
ctx.acompanharBeneficiosClientePedraoUI(cliente);
assert.equal(abertos, 1, "Atualizações do perfil não duplicam acompanhamento");
receber({ ...cliente, nivelCliente: "Prata" });
assert.equal(avisos.length, 1);
assert.equal(avisos[0].personagem, "nivel");
assert.match(avisos[0].mensagem, /Prata/);
receber({ ...cliente, nivelCliente: "Prata" });
receber({ ...cliente, nivelCliente: "Prata", fidelidadeAtiva: false });
receber(cliente);
assert.equal(avisos.length, 1, "Repetições, revogação e rebaixamento não celebram");
ctx.encerrarBeneficiosPedraoUI();
ctx.acompanharBeneficiosClientePedraoUI({ ...cliente, nivelCliente: "Prata" });
receber({ ...cliente, nivelCliente: "Prata" });
assert.equal(avisos.length, 1, "Recarregar não repete o nível já visto");
receber({ ...cliente, nivelCliente: "Ouro" });
assert.equal(avisos.length, 2);
ctx.acompanharBeneficiosClientePedraoUI({ ...cliente, telefone: "222", nivelCliente: "Lenda" });
receber({ ...cliente, nivelCliente: "Diamante" });
receber({ ...cliente, telefone: "222", nivelCliente: "Lenda" }, "222");
assert.equal(avisos.length, 2, "Troca de conta ignora callback antigo e não herda o nível");
assert.equal(fechados, 2);
ctx.encerrarBeneficiosPedraoUI();
ctx.acompanharBeneficiosClientePedraoUI({
  ...cliente,
  telefone: "333",
  nivelCliente: "Prata",
  fidelidadeAtiva: false,
});
receber({ ...cliente, telefone: "333", nivelCliente: "Prata", fidelidadeAtiva: false }, "333");
receber({ ...cliente, telefone: "333", nivelCliente: "Prata", fidelidadeAtiva: true }, "333");
assert.equal(avisos.length, 2, "Reativar benefícios no mesmo nível não é promoção");
ctx.encerrarBeneficiosPedraoUI();
ctx.acompanharBeneficiosClientePedraoUI({
  ...cliente,
  telefone: "444",
  nivelCliente: "Sem nível",
  fidelidadeAtiva: false,
});
receber({ ...cliente, telefone: "444", nivelCliente: "Bronze" }, "444");
assert.equal(avisos.length, 2, "Bronze inicial não entra na frente da comemoração do CDA");
receber({ ...cliente, telefone: "444", nivelCliente: "Prata" }, "444");
assert.equal(avisos.length, 3, "Depois do Bronze inicial, Prata é anunciado normalmente");
const html = ctx.htmlPersonagemRecompensaPedraoUI("premio", '<img src=x onerror="alert(1)">');
assert(!html.includes("<img src=x"));
assert(html.includes("&lt;img"));
assert.equal(ctx.htmlPersonagemRecompensaPedraoUI("inventado"), "");
for (const tipo of [
  "ativar",
  "ativado",
  "acordo",
  "nivel",
  "pressa",
  "solicitacao",
  "cupom",
  "raspadinha",
  "premio",
  "mensagem",
]) {
  const personagem = ctx.personagemAvisoPedraoUI({ personagem: tipo });
  assert(fs.existsSync(personagem.imagem));
  assert(fs.statSync(personagem.imagem).size < 300000);
}
console.log(
  "PASS: ranks reais, aviso único por conta/aparelho, troca de conta, recompensas seguras e artes leves.",
);
