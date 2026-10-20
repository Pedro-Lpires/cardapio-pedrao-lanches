const fs = require("fs"),
  vm = require("vm"),
  assert = require("node:assert/strict");
const ctx = vm.createContext({
  console,
  Date,
  Intl,
  document: { addEventListener() {} },
  window: { addEventListener() {} },
});
vm.runInContext(fs.readFileSync("js/operacao.js", "utf8"), ctx);
vm.runInContext(fs.readFileSync("js/fluxos-interface.js", "utf8"), ctx);
const { pedido, mensagem } = ctx.montarConsumoLocalUI(
  [
    {
      nome: "Lanche",
      qtd: 2,
      preco: 20,
      obs: "Sem cebola",
      molhosGratis: [{ texto: "Maionese" }],
      molhosPagos: [{ nome: "Barbecue", qtd: 4 }],
      totalMolhosPagos: 8,
    },
  ],
  "Cliente fictício",
  "65999999999",
  { telefone: "65999999999", bonusDisponivel: 20 },
  "Mesa próxima à janela",
);
assert.equal(pedido.valorTotal, 40);
assert.equal(pedido.descontoFidelidade, 0);
assert.equal(pedido.descontoCupom, 0);
assert.equal(pedido.taxaEntrega, 0);
assert.equal(pedido.pagamentoConfirmado, false);
assert(!("molhosPagos" in pedido.itens[0]));
assert(!mensagem.includes("Pagamento"));
assert(!mensagem.includes("#"));
assert(!mensagem.includes("Barbecue"));
assert(mensagem.includes("Sem cebola"));
assert(mensagem.includes("Subtotal:"));
assert.equal(ctx.rotuloDestinoCozinhaOperacao({ tipo: "Entrega" }), "Entrega");
assert.equal(ctx.rotuloDestinoCozinhaOperacao({ tipo: "Retirada" }), "Retirada");
assert.equal(ctx.rotuloDestinoCozinhaOperacao({ tipo: "Local", mesa: 3 }), "Mesa 3");
console.log(
  "PASS: consumo local sem molhos/cupom/pagamento, subtotal integral e cozinha distingue entrega, retirada e mesa.",
);
