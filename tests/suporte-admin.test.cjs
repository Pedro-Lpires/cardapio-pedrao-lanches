const fs = require("fs"),
  vm = require("vm"),
  assert = require("node:assert/strict");
const src = fs.readFileSync("js/admin.js", "utf8");
let encontrado = true,
  falha = false,
  consulta;
const box = { innerHTML: "" };
const ctx = vm.createContext({
  telaSuporteAdmin: () => box,
  escaparOperacao: (x) => String(x).replaceAll("<", "&lt;"),
  moedaOperacao: (x) => String(x),
  db: {
    collection: (c) => ({
      doc: (id) => ({
        get: async () => {
          consulta = [c, id];
          if (falha) throw Error("offline");
          return {
            exists: encontrado,
            data: () => ({
              numero: 7,
              nome: "Teste",
              valorPago: 50,
              itens: [{ nome: "<Lanche>", quantidade: 2, obs: "Sem cebola" }],
            }),
          };
        },
      }),
    }),
  },
});
vm.runInContext(
  src.slice(
    src.indexOf("async function verPedidoAnexadoSuporte("),
    src.indexOf("async function listarUsuariosOnline()"),
  ),
  ctx,
);
(async () => {
  await ctx.verPedidoAnexadoSuporte("p");
  assert.deepEqual(consulta, ["pedidos", "p"]);
  assert.match(box.innerHTML, /Pedido #7/);
  assert.match(box.innerHTML, /2 &lt;Lanche>/);
  assert.match(box.innerHTML, /Sem cebola/);
  await ctx.verPedidoAnexadoSuporte("local", "historicoPagamentosClientes");
  assert.deepEqual(consulta, ["historicoPagamentosClientes", "local"]);
  assert.match(box.innerHTML, /50/);
  encontrado = false;
  await ctx.verPedidoAnexadoSuporte("p");
  assert.match(box.innerHTML, /não encontrado/);
  falha = true;
  await ctx.verPedidoAnexadoSuporte("p");
  assert.match(box.innerHTML, /Não foi possível/);
  console.log(
    "PASS: ficha do pedido no suporte ADM, itens escapados, observação, pagamento local e falhas de consulta.",
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
