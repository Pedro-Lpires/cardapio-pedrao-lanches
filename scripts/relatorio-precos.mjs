import fs from "node:fs";
const consulta = JSON.parse(fs.readFileSync("scripts/catalogo-precos-consulta.json", "utf8"));
function valor(v) {
  if ("mapValue" in v)
    return Object.fromEntries(
      Object.entries(v.mapValue.fields || {}).map(([k, x]) => [k, valor(x)]),
    );
  if ("arrayValue" in v) return (v.arrayValue.values || []).map(valor);
  if ("integerValue" in v || "doubleValue" in v) return Number(v.integerValue ?? v.doubleValue);
  if ("booleanValue" in v) return v.booleanValue;
  return v.stringValue ?? null;
}
const dados = (grupo) =>
  consulta[grupo].map((d) => ({
    ...valor({ mapValue: { fields: d.fields } }),
    id: d.name.split("/").at(-1),
  }));
const produtos = dados("produtos"),
  adicionais = dados("adicionais");
const moeda = (n) => Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
let texto =
  "# Preços atuais do Pedrão Lanches\n\nConferência do catálogo do Firebase após a atualização solicitada, em " +
  new Date(consulta.consultadoEm).toLocaleString("pt-BR", { timeZone: "America/Cuiaba" }) +
  " (Cuiabá). Novas bebidas e preços já gravados; demais itens preservados.\n\n";
texto += `São ${produtos.length} produtos: ${produtos.filter((p) => p.ativo !== false && !p.esgotado).length} disponíveis e ${produtos.filter((p) => p.esgotado).length} esgotado(s). Os ${adicionais.length} acréscimos estão listados no final.\n\nPreço principal é o preço do produto, não necessariamente carne artesanal (por exemplo, lanches de frango ou filé). As outras colunas mostram apenas opções habilitadas.\n\n`;
for (const [categoria, titulo] of [
  ["lanches", "Lanches"],
  ["combos", "Combos"],
  ["batatas", "Batatas"],
  ["bebidas", "Bebidas"],
]) {
  texto += `## ${titulo}\n\n| Produto | Principal | Industrial | Frango | Filé | Situação |\n|---|---:|---:|---:|---:|---|\n`;
  for (const p of produtos
    .filter((p) => p.categoria === categoria)
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))) {
    if (p.ativo !== false && !p.esgotado && !(p.preco > 0))
      throw Error("Produto disponível sem preço: " + p.nome);
    const opcao = (chave, tipo) =>
      p[chave] > 0 && p.opcoes?.[tipo] !== false ? moeda(p[chave]) : "—";
    texto += `| ${p.nome.trim()} | ${moeda(p.preco)} | ${opcao("precoIndustrial", "industrial")} | ${opcao("precoFrango", "frango")} | ${opcao("precoFile", "file")} | ${p.somenteAtendente ? (p.disponivelAtendimento ? "Só atendimento" : "Inativo") : p.ativo === false ? "Inativo" : p.esgotado ? "Esgotado" : "Disponível"} |\n`;
  }
  texto += "\n";
}
texto += "## Acréscimos\n\n| Acréscimo | Por unidade | Situação |\n|---|---:|---|\n";
for (const a of adicionais.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")))
  texto += `| ${a.nome} | ${moeda(a.preco)} | ${a.ativo === false ? "Inativo" : a.esgotado ? "Esgotado" : "Disponível"} |\n`;
texto +=
  "\nMolhos pagos: R$ 2,00 por unidade. Acréscimos e molhos pagos somam ao preço do item; nas personalizações de combo, o acréscimo se aplica aos lanches selecionados.\n\n## Fidelidade e benefícios no código atual\n\n- CDA ativo libera fidelidade e começa em Bronze.\n- A cada R$ 300 acumulados no saldo de fidelidade: R$ 10 de bônus. O uso por pedido é de R$ 10, quando a base elegível atinge pelo menos R$ 10. Bônus antigos já conquistados são preservados.\n- Delivery/retirada do site acumulam o valor dos itens, incluindo acréscimos e molhos pagos, sem a taxa de entrega. Comandas acumulam o valor pago pelos itens.\n- No delivery/retirada do site, o saldo é atualizado ao enviar/salvar o pedido; nas comandas, ao registrar pagamento. O cancelamento de pedido no ADM ou atendimento estorna seu progresso e bônus e retira a compra dos contadores, uma única vez. Pedido já vinculado à mesa é cancelado pela comanda.\n- Os números de pedidos significam compras separadas, não quantidade de lanches. Os critérios de rank abaixo permanecem como estavam, aguardando definição de uma nova regra.\n- Prata: 5 pedidos ou R$ 300; Ouro: 15 pedidos ou R$ 700; Diamante: 30 pedidos ou R$ 1.500; Imortal: 60 pedidos ou R$ 4.000. A progressão exige fidelidade ativa.\n- Os ranks atualizam os avatares/bordas. Não há um desconto fixo automático extra por rank: cupons e campanhas podem segmentar o nível.\n- Cupons: descontos no pedido ou em itens, com regras de validade, mínimo e público definidas no ADM. Não existe um valor único para todos os cupons.\n- Raspadinhas: prêmio, mínimo de compra, público, validade e emissão manual/automática definidos por campanha. Não existe um prêmio monetário fixo.\n- Acordo do WhatsApp/CDA: ativação e retirada dos benefícios são administradas pelo estabelecimento; o aviso do mago não verifica automaticamente Instagram, avaliações ou contatos.\n";
fs.writeFileSync("PRECOS-E-BENEFICIOS-2026-10-31.md", texto);
console.log(
  "Relatório gerado: " +
    produtos.length +
    " produtos e " +
    adicionais.length +
    " acréscimos; disponíveis com preço positivo.",
);
