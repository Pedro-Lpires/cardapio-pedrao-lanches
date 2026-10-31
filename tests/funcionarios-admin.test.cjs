const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  vm = require("node:vm");
let permitir = false,
  excluidos = [],
  consultas = 0;
const box = { dataset: {}, hidden: true },
  botao = {
    setAttribute(n, v) {
      this[n] = v;
    },
  };
const ctx = vm.createContext({
  document: { getElementById: () => box, querySelector: () => botao },
  db: {
    collection(n) {
      assert.equal(n, "atendentes");
      return {
        get: async () => {
          consultas++;
          return { empty: true };
        },
        doc: (id) => ({ delete: async () => excluidos.push(id) }),
      };
    },
  },
  confirmarOperacao: async () => permitir,
  htmlCarregandoUI: () => "",
  avisoOperacao: (m) => {
    throw Error(m);
  },
});
const s = fs.readFileSync("js/admin.js", "utf8");
for (const nome of ["listarAtendentesAdmin", "excluirFuncionarioAdminUI"]) {
  const inicio = s.indexOf("async function " + nome + "("),
    fim = s.indexOf("\nasync function ", inicio + 1);
  vm.runInContext(s.slice(inicio, fim), ctx);
}
(async () => {
  await ctx.listarAtendentesAdmin(true);
  assert.equal(box.hidden, false);
  assert.equal(botao["aria-expanded"], "true");
  await ctx.listarAtendentesAdmin(true);
  assert.equal(box.hidden, true);
  assert.equal(consultas, 1, "Fechar não consulta o banco");
  await ctx.excluirFuncionarioAdminUI("teste");
  assert.equal(excluidos.length, 0, "Cancelar mantém cadastro");
  permitir = true;
  await ctx.excluirFuncionarioAdminUI("teste");
  assert.deepEqual(excluidos, ["teste"]);
  assert.equal(box.hidden, false);
  console.log(
    "PASS: funcionários alternam lista sem leitura ao fechar; exclusão exige confirmação e atua apenas no cadastro escolhido.",
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
