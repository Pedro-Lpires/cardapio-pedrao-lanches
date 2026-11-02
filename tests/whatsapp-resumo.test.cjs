const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  vm = require("node:vm");
const ctx = vm.createContext({ document: { addEventListener() {} }, window: {}, setTimeout() {} });
const fonte = fs.readFileSync("js/ui-comum.js", "utf8");
vm.runInContext(
  fonte.slice(
    fonte.indexOf("function textoWhatsAppSemEmojisUI"),
    fonte.indexOf("// Compara termos"),
  ),
  ctx,
);
const item = {
  nome: "Baguncinha",
  qtd: 1,
  preco: 30,
  adicionais: [{ qtd: 1, nome: "Bacon" }],
  molhosPagos: [{ qtd: 2, nome: "Maionese" }],
  totalMolhosPagos: 4,
};
const base = {
  nome: "Cliente Exemplo",
  telefone: "65999999999",
  data: "29/10/2026, 20:00",
  tipo: "Entrega",
  itens: [item],
  taxa: 24,
  total: 58,
  km: 12,
  descontoCupom: 5,
};
let msg = ctx.montarMensagemPedidoWhatsUI(base);
assert(msg.startsWith("*PEDRÃO LANCHES - ENTREGA*\n"));
assert(!msg.includes("\n*Entrega*"));
assert.match(msg, /Baguncinha - R\$.*34,00/);
assert(!msg.includes("Valor dos molhos"));
assert(!msg.includes("confirmado"));
assert(!msg.includes("ciente"));
assert.equal((msg.match(/34,00/g) || []).length, 1);
assert.match(msg, /Desconto de cupom: -R\$.*5,00/);
const grupo = { adicionais: [{ qtd: 1, nome: "Cheddar" }], observacao: "Sem cebola" };
msg = ctx.montarMensagemPedidoWhatsUI({
  ...base,
  km: 22,
  itens: [{ nome: "Combo 3", qtd: 1, preco: 80, lanchesCombo: [grupo, grupo, grupo] }],
});
assert.match(msg, /Todos os lanches:/);
assert(!msg.includes("Lanche 1"));
assert(!msg.includes("acima de 10"));
assert.match(msg, /mais de 15 km/);
msg = ctx.montarMensagemPedidoWhatsUI({
  ...base,
  tipo: "Retirada",
  itens: [
    {
      nome: "Batata P",
      categoria: "batatas",
      qtd: 2,
      preco: 10,
      molhosGratis: [{ texto: "Maionese" }, { texto: "Ketchup" }],
    },
    {
      nome: "Batata G",
      categoria: "batatas",
      qtd: 1,
      preco: 20,
      molhosGratis: [{ texto: "Barbecue" }],
    },
  ],
});
assert.match(msg, /1ª batata - molhos: Maionese/);
assert.match(msg, /2ª batata - molhos: Ketchup/);
assert.match(msg, /Molhos: Barbecue/);
assert(!msg.includes("Taxa"));
assert(!msg.includes("Acessível"));
assert(!msg.includes("Lanche:"));
assert(msg.startsWith("*PEDRÃO LANCHES - RETIRADA*\n"));
assert(
  ctx
    .montarMensagemPedidoWhatsUI({ ...base, tipo: "Local" })
    .startsWith("*PEDRÃO LANCHES - CONSUMO NO LOCAL*\n"),
);
assert.equal(ctx.textoWhatsAppSemEmojisUI("� teste 🍔"), "teste");
ctx.URL = URL;
const operacao = fs.readFileSync("js/operacao.js", "utf8");
vm.runInContext(
  operacao.slice(
    operacao.indexOf("function linkLocalizacaoMotoboyUI("),
    operacao.indexOf("async function compartilharMotoboyOperacao("),
  ),
  ctx,
);
msg = ctx.montarMensagemPedidoWhatsUI({
  ...base,
  mapa: "https://www.google.com/maps?q=-15.7508,-56.1035",
});
const destino = msg.match(/Localização: (\S+)/)[1];
assert.equal(new URL(destino).pathname, "/localizacao.html");
assert.equal(new URL(destino).searchParams.get("p"), "-15.7508,-56.1035");
assert(!msg.includes("www.google.com/maps"));
assert.equal(
  ctx.linkLocalizacaoMotoboyUI(destino, ""),
  destino,
  "Reabrir o link da loja conserva o GPS",
);
console.log(
  "PASS: WhatsApp compacto, valor integrado, combos Todos, batatas separadas e avisos de distância sem repetição.",
);
