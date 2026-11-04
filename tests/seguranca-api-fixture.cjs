/* Somente o servidor local de testes importa este módulo. Nunca usa credenciais reais. */
const { fixture } = require("./pedido-publico.test.cjs");
const { criarServicoMesaPublica } = require("../api/_lib/mesa-publica.cjs");
const { criarHandlerPedidoPublico } = require("../api/pedido-publico.js");
const f = fixture();
f.registros.set("config/beneficios", {});
Object.assign(f.registros.get("clientes/65999999999"), {
  nome: "Cliente Teste",
  fidelidadeAtiva: false,
  bonusDisponivel: 0,
  nivelCliente: "Sem nível",
  codigoAtivacao: "0123",
  avatar: "images/avatares/sem-rank/maionese.webp",
  enderecos: [],
});
for (const [categoria, prefixo, preco] of [
  ["lanches", "lanche", 25],
  ["bebidas", "bebida", 5],
  ["batatas", "batata", 15],
  ["combos", "combo", 40],
])
  for (let i = 1; i <= 8; i++)
    f.registros.set("produtos/" + prefixo + i, {
      nome: prefixo[0].toUpperCase() + prefixo.slice(1) + " teste " + i,
      categoria,
      preco,
      ativo: true,
      ...(prefixo === "lanche" && i === 1 ? { precoIndustrial: 18 } : {}),
      ...(categoria === "combos"
        ? {
            comboQtdLanches: 3,
            comboComponentes: [{ nome: "Lanche teste", categoria: "lanches", quantidade: 3 }],
          }
        : {}),
    });
for (const [id, nome, preco] of [
  ["cheddar", "Cheddar", 3],
  ["alface", "Alface", 2],
  ["calabresa", "Calabresa", 5],
])
  f.registros.set("adicionais/" + id, { nome, preco, ativo: true });
const mesas = criarServicoMesaPublica({
  db: f.db,
  pedidos: f.servico,
  auth: { createCustomToken: async (uid) => "visita:" + uid },
  consumirTentativa: async () => {},
  agora: () => Date.parse("2026-11-03T18:00:00Z"),
});
async function atenderFixture(req, res) {
  const mesa = req.url.includes("mesa-publica"),
    acesso = req.url.includes("acesso-cliente");
  const servico = mesa
    ? mesas
    : acesso
      ? { perfil: (d) => f.servico.perfil(d), origem: "" }
      : f.servico;
  return criarHandlerPedidoPublico({
    estaConfigurado: () => true,
    obterServico: () => ({ ...servico, origem: "http://" + req.headers.host }),
    acoes: mesa
      ? ["estado", "iniciar", "retomar", "enviar", "vincular", "chamar"]
      : acesso
        ? ["perfil"]
        : [
            "perfil",
            "conferir",
            "salvar",
            "recuperar",
            "ativar",
            "cupons",
            "suporte",
            "responderSuporte",
            "encerrarSuporte",
          ],
  })(req, res);
}
module.exports = { atenderFixture };
