/** Habilita industrial somente nos seis combos solicitados, com preços dos lanches atuais. */
import fs from "node:fs/promises";
import { isDeepStrictEqual } from "node:util";
const base =
  "https://firestore.googleapis.com/v1/projects/pedrao-lanches/databases/(default)/documents";
const imagens = new Set([
  "3xbagunca.webp",
  "3big.webp",
  "3xbacon.webp",
  "2xbagunca.webp",
  "2big.webp",
  "2tudo.webp",
]);
function ler(valor) {
  if (valor.stringValue !== undefined) return valor.stringValue;
  if (valor.integerValue !== undefined) return Number(valor.integerValue);
  if (valor.doubleValue !== undefined) return valor.doubleValue;
  if (valor.booleanValue !== undefined) return valor.booleanValue;
  if (valor.arrayValue) return (valor.arrayValue.values || []).map(ler);
  if (valor.mapValue)
    return Object.fromEntries(
      Object.entries(valor.mapValue.fields || {}).map(([chave, valor]) => [chave, ler(valor)]),
    );
  return null;
}
const normalizar = (texto) =>
  String(texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
const dados = (doc) =>
  Object.fromEntries(Object.entries(doc.fields).map(([chave, valor]) => [chave, ler(valor)]));
async function buscar(url, opcoes) {
  const resposta = await fetch(url, opcoes);
  if (!resposta.ok) throw Error(`${resposta.status}: ${await resposta.text()}`);
  return resposta.json();
}
const docs = [];
let pagina = "";
do {
  const resposta = await buscar(
    base + "/produtos?pageSize=300" + (pagina ? "&pageToken=" + encodeURIComponent(pagina) : ""),
  );
  docs.push(...(resposta.documents || []));
  pagina = resposta.nextPageToken || "";
} while (pagina);
const fontes = new Map();
const planos = [...imagens].map((imagem) => {
  const encontrados = docs.filter((doc) => {
    const produto = dados(doc);
    return (
      produto.categoria === "combos" &&
      String(produto.imagem || produto.img || "")
        .split("/")
        .pop() === imagem
    );
  });
  if (encontrados.length !== 1) throw Error(`Cadastro não é único: ${imagem}`);
  const doc = encontrados[0];
  const combo = dados(doc);
  const componentes = (combo.comboComponentes || []).filter((c) => c.categoria === "lanches");
  if (componentes.length !== 1) throw Error(`Composição inesperada: ${combo.nome}`);
  const componente = componentes[0];
  const lanches = docs.filter((doc) => {
    const produto = dados(doc);
    return (
      produto.categoria === "lanches" && normalizar(produto.nome) === normalizar(componente.nome)
    );
  });
  if (lanches.length !== 1) throw Error(`Lanche não é único: ${componente.nome}`);
  const lanche = dados(lanches[0]);
  fontes.set(lanches[0].name, lanches[0]);
  const quantidade = Number(componente.quantidade);
  if (
    !(lanche.preco > lanche.precoIndustrial && lanche.precoIndustrial > 0) ||
    quantidade !== Number(combo.comboQtdLanches)
  )
    throw Error(`Confira os preços e a quantidade: ${combo.nome}`);
  const industrial =
    Math.round((combo.preco - quantidade * (lanche.preco - lanche.precoIndustrial)) * 100) / 100;
  if (!(industrial > 0)) throw Error(`Preço inválido: ${combo.nome}`);
  const opcoes = { ...combo.opcoes, artesanal: true, industrial: true };
  return {
    doc,
    combo,
    industrial,
    opcoes,
    desconto: quantidade * (lanche.preco - lanche.precoIndustrial),
    mudou: combo.precoIndustrial !== industrial || !isDeepStrictEqual(combo.opcoes, opcoes),
  };
});
console.log(
  JSON.stringify(
    planos.map((p) => ({
      nome: p.combo.nome,
      artesanal: p.combo.preco,
      industrial: p.industrial,
      desconto: p.desconto,
      mudou: p.mudou,
    })),
    null,
    2,
  ),
);
if (process.argv.includes("--aplicar")) {
  const indice = process.argv.indexOf("--backup");
  if (indice < 0 || !process.argv[indice + 1])
    throw Error("Informe --backup com o destino da cópia dos cadastros.");
  await fs.writeFile(
    process.argv[indice + 1],
    JSON.stringify({ combos: planos.map((p) => p.doc), lanches: [...fontes.values()] }, null, 2),
    { flag: "wx" },
  );
  const alterados = planos.filter((p) => p.mudou);
  if (alterados.length)
    await buscar(base + ":commit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        writes: [
          ...[...fontes.values()].map((doc) => ({
            verify: doc.name,
            currentDocument: { updateTime: doc.updateTime },
          })),
          ...alterados.map((p) => ({
            update: {
              name: p.doc.name,
              fields: {
                precoIndustrial: { doubleValue: p.industrial },
                opcoes: {
                  mapValue: {
                    fields: Object.fromEntries(
                      Object.entries(p.opcoes).map(([chave, valor]) => [
                        chave,
                        { booleanValue: valor },
                      ]),
                    ),
                  },
                },
              },
            },
            updateMask: { fieldPaths: ["precoIndustrial", "opcoes"] },
            currentDocument: { updateTime: p.doc.updateTime },
          })),
        ],
      }),
    });
  for (const plano of planos) {
    const salvo = dados(await buscar("https://firestore.googleapis.com/v1/" + plano.doc.name));
    if (
      salvo.precoIndustrial !== plano.industrial ||
      !salvo.opcoes.industrial ||
      salvo.preco !== plano.combo.preco ||
      !isDeepStrictEqual(salvo.comboComponentes, plano.combo.comboComponentes)
    )
      throw Error(`Conferência falhou: ${plano.combo.nome}`);
  }
  console.log(`PASS: ${alterados.length} combos atualizados; os seis cadastros foram conferidos.`);
} else console.log("Prévia sem gravação. Use --aplicar --backup caminho para atualizar.");
