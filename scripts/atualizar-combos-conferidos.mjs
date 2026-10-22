/** Atualiza apenas os 12 combos conferidos nas artes, conservando IDs e demais campos. */
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { isDeepStrictEqual } from "node:util";
const base =
  "https://firestore.googleapis.com/v1/projects/pedrao-lanches/databases/(default)/documents";
const conferidos = JSON.parse(
  await fs.readFile(new URL("./combos-conferidos.json", import.meta.url), "utf8"),
);
function ler(v) {
  if (v.stringValue !== undefined) return v.stringValue;
  if (v.integerValue !== undefined) return Number(v.integerValue);
  if (v.doubleValue !== undefined) return v.doubleValue;
  if (v.booleanValue !== undefined) return v.booleanValue;
  if (v.arrayValue) return (v.arrayValue.values || []).map(ler);
  if (v.mapValue)
    return Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k, v]) => [k, ler(v)]));
  return null;
}
function valor(v) {
  if (typeof v === "string") return { stringValue: v };
  if (typeof v === "number")
    return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(valor) } };
  return {
    mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, v]) => [k, valor(v)])) },
  };
}
async function requisicao(url, opcoes) {
  const r = await fetch(url, opcoes);
  if (!r.ok) throw Error(`${r.status}: ${await r.text()}`);
  return r.json();
}
const docs = [];
let pagina = "";
do {
  const r = await requisicao(
    base + "/produtos?pageSize=300" + (pagina ? "&pageToken=" + encodeURIComponent(pagina) : ""),
  );
  docs.push(...(r.documents || []));
  pagina = r.nextPageToken || "";
} while (pagina);
const planos = conferidos.map((combo) => {
  const encontrados = docs.filter((d) => {
    const p = Object.fromEntries(Object.entries(d.fields).map(([k, v]) => [k, ler(v)]));
    return (
      p.categoria === "combos" &&
      String(p.imagem || p.img || "")
        .split("/")
        .pop() === combo.imagem
    );
  });
  if (encontrados.length !== 1)
    throw Error(`Esperado um cadastro para ${combo.nome}; encontrados ${encontrados.length}.`);
  const doc = encontrados[0];
  const dados = {
    preco: combo.preco,
    descricao: combo.descricao,
    comboQtdLanches: combo.comboQtdLanches,
    comboComponentes: combo.comboComponentes,
  };
  return {
    doc,
    combo,
    dados,
    campos: Object.keys(dados).filter(
      (k) => !isDeepStrictEqual(ler(doc.fields[k] || {}), dados[k]),
    ),
  };
});
console.log(
  JSON.stringify(
    planos.map((p) => ({
      id: p.doc.name.split("/").pop(),
      nome: p.combo.nome,
      preco: p.combo.preco,
      lanches: p.combo.comboQtdLanches,
      descricao: p.combo.descricao,
      campos: p.campos,
    })),
    null,
    2,
  ),
);
if (process.argv.includes("--aplicar")) {
  const indiceBackup = process.argv.indexOf("--backup");
  const backup =
    indiceBackup >= 0
      ? process.argv[indiceBackup + 1]
      : path.join(os.tmpdir(), `pedrao-combos-antes-${Date.now()}.json`);
  await fs.writeFile(
    backup,
    JSON.stringify(
      planos.map((p) => p.doc),
      null,
      2,
    ),
    { flag: "wx" },
  );
  const writes = planos
    .filter((p) => p.campos.length)
    .map((p) => ({
      update: {
        name: p.doc.name,
        fields: Object.fromEntries(p.campos.map((k) => [k, valor(p.dados[k])])),
      },
      updateMask: { fieldPaths: p.campos },
      currentDocument: { updateTime: p.doc.updateTime },
    }));
  if (writes.length)
    await requisicao(base + ":commit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ writes }),
    });
  for (const p of planos) {
    const salvo = await requisicao("https://firestore.googleapis.com/v1/" + p.doc.name);
    for (const [k, v] of Object.entries(p.dados))
      if (!isDeepStrictEqual(ler(salvo.fields[k]), v))
        throw Error(`Conferência falhou: ${p.combo.nome}, ${k}`);
  }
  console.log(
    `PASS: ${planos.length} combos conferidos após gravar; ${writes.length} atualizados. Backup: ${backup}`,
  );
} else
  console.log(
    "Prévia: nenhuma gravação. Use --aplicar para executar o lote com verificação de versão.",
  );
