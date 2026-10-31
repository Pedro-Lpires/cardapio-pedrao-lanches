// Sem --aplicar, apenas gera o plano. Escritas atômicas preservam campos não alterados.
import fs from "node:fs";
const projeto = "pedrao-lanches";
const raiz = `https://firestore.googleapis.com/v1/projects/${projeto}/databases/(default)/documents`;
const mapa = JSON.parse(fs.readFileSync("scripts/imagens-organizadas.json", "utf8"));
const novas = JSON.parse(fs.readFileSync("scripts/bebidas-novas.json", "utf8"));
const valor = (v) =>
  v?.stringValue ??
  v?.doubleValue ??
  (v?.integerValue != null ? Number(v.integerValue) : v?.booleanValue);
const campo = (v) =>
  typeof v === "number"
    ? { doubleValue: v }
    : typeof v === "boolean"
      ? { booleanValue: v }
      : { stringValue: v };
async function json(url, opcoes) {
  const r = await fetch(url, opcoes);
  if (!r.ok) throw Error(`Firebase ${r.status}: ${await r.text()}`);
  return r.json();
}
let docs = [],
  token;
do {
  const p = await json(
    raiz + "/produtos?pageSize=300" + (token ? "&pageToken=" + encodeURIComponent(token) : ""),
  );
  docs.push(...(p.documents || []));
  token = p.nextPageToken;
} while (token);
const writes = [],
  plano = [];
const adicionais = (await json(raiz + "/adicionais?pageSize=300")).documents || [];
const novosPrecos = {
  bacon: 6,
  calabresa: 5,
  cebola: 3,
  cheddar: 4,
  "file de frango": 7,
  "file mignon": 12,
  "hamburguer caseiro": 9,
};
for (const d of adicionais) {
  const nome = valor(d.fields.nome),
    chave = nome
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  if (!(chave in novosPrecos) || Number(valor(d.fields.preco)) === novosPrecos[chave]) continue;
  plano.push({ id: d.name.split("/").at(-1), nome, alteracoes: { preco: novosPrecos[chave] } });
  writes.push({
    update: { name: d.name, fields: { preco: campo(novosPrecos[chave]) } },
    updateMask: { fieldPaths: ["preco"] },
    currentDocument: { updateTime: d.updateTime },
  });
}
for (const d of docs) {
  const f = d.fields,
    patch = {};
  const img = valor(f.imagem),
    antigo = img?.startsWith("images/") ? img : "images/" + img;
  if (process.argv.includes("--imagens-publicadas") && mapa[antigo]) patch.imagem = mapa[antigo];
  if (process.argv.includes("--restaurar-caminhos")) {
    const anterior = JSON.parse(
      fs.readFileSync("scripts/catalogo-antes-20261031.json", "utf8"),
    ).produtos.find((x) => x.name === d.name);
    if (anterior && valor(anterior.fields.imagem) !== img)
      patch.imagem = valor(anterior.fields.imagem);
  }
  if (valor(f.categoria) === "bebidas" && !valor(f.somenteAtendente)) {
    const nome = String(valor(f.nome) || "");
    if (/garrafinha/i.test(nome)) patch.preco = 10;
    else if (/1[,.]5\s*l/i.test(nome)) patch.preco = 18;
    else if (/2\s*l/i.test(nome)) patch.preco = 22;
    else if (/1\s*l/i.test(nome)) patch.preco = 12;
    else if (/lata/i.test(nome)) patch.preco = 8;
  }
  for (const k of Object.keys(patch)) if (valor(f[k]) === patch[k]) delete patch[k];
  if (!Object.keys(patch).length) continue;
  plano.push({ id: d.name.split("/").at(-1), nome: valor(f.nome), alteracoes: patch });
  writes.push({
    update: {
      name: d.name,
      fields: Object.fromEntries(Object.entries(patch).map(([k, v]) => [k, campo(v)])),
    },
    updateMask: { fieldPaths: Object.keys(patch) },
    currentDocument: { updateTime: d.updateTime },
  });
}
for (const { id, ...p } of novas) {
  const existente = docs.find((d) => d.name.endsWith("/" + id));
  if (existente) {
    if (
      p.somenteAtendente &&
      (valor(existente.fields.ativo) !== false ||
        valor(existente.fields.disponivelAtendimento) !== true)
    ) {
      plano.push({ id, alteracoes: { ativo: false, disponivelAtendimento: true } });
      writes.push({
        update: {
          name: existente.name,
          fields: { ativo: campo(false), disponivelAtendimento: campo(true) },
        },
        updateMask: { fieldPaths: ["ativo", "disponivelAtendimento"] },
        currentDocument: { updateTime: existente.updateTime },
      });
    }
    continue;
  }
  plano.push({ id, novo: p });
  writes.push({
    update: {
      name: `projects/${projeto}/databases/(default)/documents/produtos/${id}`,
      fields: Object.fromEntries(Object.entries(p).map(([k, v]) => [k, campo(v)])),
    },
    currentDocument: { exists: false },
  });
}
fs.writeFileSync("scripts/plano-catalogo-20261031.json", JSON.stringify(plano, null, 2) + "\n");
console.log(
  `${plano.length} alterações no plano (preços avulsos, imagens e novas bebidas; combos mantêm seus preços).`,
);
if (process.argv.includes("--aplicar") && writes.length) {
  if (!fs.existsSync("scripts/catalogo-antes-20261031.json"))
    fs.writeFileSync(
      "scripts/catalogo-antes-20261031.json",
      JSON.stringify(
        { consultadoEm: new Date().toISOString(), produtos: docs, adicionais },
        null,
        2,
      ) + "\n",
    );
  await json(raiz + ":commit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ writes }),
  });
  const atual = await json(raiz + "/produtos?pageSize=300");
  const consulta = JSON.parse(fs.readFileSync("scripts/catalogo-precos-consulta.json", "utf8"));
  consulta.produtos = atual.documents;
  consulta.consultadoEm = new Date().toISOString();
  consulta.adicionais = (await json(raiz + "/adicionais?pageSize=300")).documents;
  fs.writeFileSync(
    "scripts/catalogo-precos-consulta.json",
    JSON.stringify(consulta, null, 2) + "\n",
  );
  console.log("Catálogo atualizado e relido. Cópia anterior preservada.");
}
