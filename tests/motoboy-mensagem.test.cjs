const assert = require("node:assert/strict");
const { context: c, mockDb } = require("./operacao.test.cjs");
c.URL = URL;
c.document.baseURI = "http://127.0.0.1:5501/painel-atendente.html";
const box = { innerHTML: "", showModal() {} };
c.document.getElementById = () => box;
c.textoWhatsAppSemEmojisUI = (s) => s;
c.completarItensOperacao = async (itens) => itens;
c.db = mockDb({
  "comandas/p": {
    tipo: "Entrega",
    nome: "Cliente teste",
    telefone: "65999999999",
    endereco: "Rua de teste, 100\n Bloco A, apartamento 03",
    condominio: "Sim",
    cnh: "Sim",
    localizacao: "https://www.google.com/maps?q=-15.7508,-56.1035",
    observacao: "Embalar bebidas separadas.",
    valorTotal: 80,
    itens: [
      { nome: "Coca (1L)", categoria: "bebidas", quantidade: 1 },
      { nome: "Suco Del Valle Uva (lata)", categoria: "bebidas", quantidade: 2 },
    ],
  },
});
(async () => {
  await c.compartilharMotoboyOperacao("comandas", "p");
  const texto = new URL(box.innerHTML.match(/href="([^"]+)"/)[1]).searchParams.get("text");
  assert.match(texto, /Endereço: Rua de teste, 100 Bloco A, apartamento 03\n/);
  assert.match(texto, /Condomínio: Sim \| CNH: Sim\n/);
  assert.match(texto, /Bebidas: 1 Coca \(1L\); 2 Suco Del Valle Uva \(lata\)\n/);
  const links = texto.match(/https?:[^\s]+/g);
  assert.equal(links.length, 1);
  const destino = new URL(links[0]);
  assert.equal(destino.origin, "https://cardapio-pedrao-lanches.vercel.app");
  assert.equal(destino.pathname, "/localizacao.html");
  assert.equal(destino.searchParams.get("p"), "-15.7508,-56.1035");
  assert.match(texto, /Obs.: Embalar bebidas separadas/);
  console.log(
    "PASS: mensagem do motoboy compacta endereço, CNH/condomínio e bebidas, preserva observação e fornece um único link de escolha do mapa com as coordenadas originais.",
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
