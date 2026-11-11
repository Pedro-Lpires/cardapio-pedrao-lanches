const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
let iniciar, botaoMenu;
const menu = { append: (botao) => (botaoMenu = botao) };
const ctx = vm.createContext({
  document: {
    addEventListener: (nome, callback) => {
      if (nome === "DOMContentLoaded") iniciar = callback;
    },
    getElementById: () => null,
    querySelector: (seletor) => (seletor === ".menu-atendente" ? menu : null),
    createElement: () => ({}),
  },
});
vm.runInContext(fs.readFileSync("js/raspadinhas.js", "utf8"), ctx);
ctx.iniciarPagamentosRaspadinha = () => {};
const abrirOriginal = ctx.abrirResgateRaspadinha;
let argumentos;
ctx.abrirResgateRaspadinha = (...args) => (argumentos = args);
iniciar();
botaoMenu.onclick({ type: "click" });
assert.deepEqual(argumentos, [], "O evento do clique não pode ativar somenteConsultar");
ctx.abrirResgateRaspadinha = abrirOriginal;

const elementos = {
  "form button": { disabled: false },
  form: {},
  "[name=codigo]": { value: "ra1234" },
  "[name=nome]": { value: "Pedro" },
  "#raspa-conferido": { checked: false },
  "#raspa-referencia": { value: "" },
  "#raspa-usar": {},
  "[data-entregar-premio]": {},
};
const resultado = {
  innerHTML: "",
  querySelector: (seletor) => elementos[seletor],
};
elementos[".raspa-resultado"] = resultado;
const dialogo = {
  classList: { add() {} },
  insertAdjacentHTML() {},
  querySelector: (seletor) => elementos[seletor],
};
Object.assign(ctx, {
  dialogoRaspadinhaUI: () => dialogo,
  localizarCodigoRaspadinha: async () => ({
    doc: {
      exists: true,
      data: () => ({ clienteNome: "Pedro", clienteId: "65999999999", codigo: "RA1234" }),
    },
  }),
  validarUsoRaspadinha: () => {},
  comprasParaResgateRaspadinha: async () => [{ valor: "pedidos/novo", texto: "Pedido novo" }],
  escaparOperacao: String,
  moedaOperacao: String,
});
async function testar() {
  await ctx.abrirResgateRaspadinha();
  await elementos.form.onsubmit({ preventDefault() {} });
  assert.match(resultado.innerHTML, /Confirmar entrega do prêmio/);
  assert.equal(elementos["form button"].disabled, false);
  elementos["#raspa-conferido"].checked = true;
  elementos["#raspa-conferido"].onchange();
  assert.equal(elementos["#raspa-usar"].disabled, true, "Exige selecionar a compra");
  elementos["#raspa-referencia"].value = "pedidos/novo";
  elementos["#raspa-referencia"].onchange();
  assert.equal(elementos["#raspa-usar"].disabled, false);
  let entregue;
  ctx.resgatarRaspadinha = async (...args) => {
    entregue = args;
    return "Batata média";
  };
  await elementos["#raspa-usar"].onclick();
  assert.deepEqual(entregue, ["RA1234", "65999999999", "pedidos/novo"]);
  assert.match(resultado.innerHTML, /raspa-entrega-sucesso-ui/);
  assert.match(resultado.innerHTML, /Prêmio entregue/);
  assert.match(resultado.innerHTML, /Batata média/);
  await ctx.abrirResgateRaspadinha(true);
  await elementos.form.onsubmit({ preventDefault() {} });
  assert.match(resultado.innerHTML, /data-entregar-premio/);
  console.log("PASS: atendente consulta e entrega prêmio com compra selecionada e conferida.");
}
testar().catch((erro) => {
  console.error(erro);
  process.exitCode = 1;
});
