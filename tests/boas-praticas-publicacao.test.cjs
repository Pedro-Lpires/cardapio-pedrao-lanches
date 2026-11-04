const fs = require("node:fs"),
  http = require("node:http"),
  assert = require("node:assert/strict");
const { criarServidorPreview } = require("./servidor-local.cjs");
const internos = [
  "admin",
  "atendente",
  "painel-atendente",
  "cozinha",
  "financeiro",
  "autoatendimento",
  "localizacao",
];
const config = JSON.parse(fs.readFileSync("vercel.json", "utf8"));
function headersDaRota(rota) {
  return config.headers.reduce((h, regra) => {
    if (new RegExp("^" + regra.source + "$").test(rota))
      for (const { key, value } of regra.headers) h[key] = value;
    return h;
  }, {});
}
function requisitar(porta, rota) {
  return new Promise((resolve, reject) => {
    const req = http.get({ hostname: "127.0.0.1", port: porta, path: rota }, (res) => {
      const chunks = [];
      res.on("data", (b) => chunks.push(b));
      res.on("end", () =>
        resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }),
      );
    });
    req.on("error", reject);
  });
}
(async () => {
  const index = fs.readFileSync("index.html", "utf8");
  const canonical = index.match(/rel="canonical" href="([^"]+)"/)[1];
  assert.equal(canonical, "https://cardapio-pedrao-lanches.vercel.app/");
  assert(!/name="robots" content="[^"]*noindex/.test(index));
  assert.match(index, /name="description"/);
  assert.match(index, /property="og:image"/);
  for (const pagina of internos) {
    assert.match(fs.readFileSync(pagina + ".html", "utf8"), /name="robots" content="[^"]*noindex/);
    for (const rota of ["/" + pagina, "/" + pagina + ".html"])
      assert.match(headersDaRota(rota)["X-Robots-Tag"], /noindex/);
  }
  assert.equal(headersDaRota("/")["X-Robots-Tag"], undefined);
  assert.equal(headersDaRota("/localizacao.html")["Referrer-Policy"], "no-referrer");
  assert(
    !headersDaRota("/")["Permissions-Policy"].includes("geolocation=()"),
    "GPS do checkout permanece disponível",
  );
  const sitemap = fs.readFileSync("sitemap.xml", "utf8");
  assert.deepEqual(
    [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]),
    [canonical],
  );
  const robots = fs.readFileSync("robots.txt", "utf8");
  assert(robots.includes("Sitemap: " + canonical + "sitemap.xml"));
  for (const pagina of internos)
    assert(!robots.includes("Disallow: /" + pagina), "Noindex precisa poder ser lido");
  const ignore = fs.readFileSync(".vercelignore", "utf8").split(/\r?\n/);
  for (const pasta of ["tests/", "scripts/", "node_modules/", ".git/"])
    assert(ignore.includes(pasta));
  assert(ignore.includes("*.md"), "Relatório e instruções internas fora do deploy");

  const servidor = criarServidorPreview();
  await new Promise((resolve) => servidor.listen(0, "127.0.0.1", resolve));
  try {
    const porta = servidor.address().port;
    const home = await requisitar(porta, "/");
    assert.equal(home.status, 200);
    assert.equal(home.headers["x-content-type-options"], "nosniff");
    for (const rota of ["/pagina-inexistente", "/pasta/pagina-inexistente.html"]) {
      const pagina = await requisitar(porta, rota);
      assert.equal(pagina.status, 404, "Página ausente nunca retorna 200");
      assert.match(pagina.headers["content-type"], /^text\/html/);
      assert.match(pagina.headers["x-robots-tag"], /noindex/);
      assert.match(pagina.body.toString(), /Opa! Essa página não está aqui/);
      for (const asset of [
        "/css/paginas/404.css",
        "/images/logo-trailer.webp",
        "/images/personagens-pedrao/ui/mago-pensando.webp",
      ])
        assert.equal(
          (await requisitar(porta, asset)).status,
          200,
          "404 em caminho aninhado mantém os recursos",
        );
    }
    assert.equal((await requisitar(porta, "/.git/config")).status, 403);
    assert.equal((await requisitar(porta, "/.codex")).status, 403);
    assert.equal((await requisitar(porta, "/.env.local")).status, 403);
    assert.equal((await requisitar(porta, "/conta.secret.json")).status, 403);
    assert.equal((await requisitar(porta, "/api/_lib/recuperacao-runtime.cjs")).status, 403);
    const recuperacao = await requisitar(porta, "/api/recuperacao-acesso");
    assert.equal(recuperacao.status, 200);
    assert.equal(JSON.parse(recuperacao.body.toString()).validadeMinutos, 30);
    assert.equal(recuperacao.headers["cache-control"], "no-store");
    assert.equal((await requisitar(porta, "/..%5c..%5carquivo")).status, 403);
    assert.equal((await requisitar(porta, "/%E0%A4%A")).status, 400);
    const jsAusente = await requisitar(porta, "/arquivo-ausente.js");
    assert.equal(jsAusente.status, 404);
    assert.match(jsAusente.headers["content-type"], /^text\/plain/);
    assert(!jsAusente.body.toString().includes("<!doctype"), "Script ausente não recebe HTML");
    assert.match(
      (await requisitar(porta, "/sitemap.xml")).headers["content-type"],
      /^application\/xml/,
    );
    assert.match((await requisitar(porta, "/robots.txt")).headers["content-type"], /^text\/plain/);
    const imagem = await requisitar(porta, "/images/compartilhamento-pedrao.jpg");
    assert.equal(imagem.status, 200);
    assert.equal(imagem.headers["content-type"], "image/jpeg");
    assert.equal(imagem.body.readUInt16BE(0), 0xffd8);
    let dimensoes;
    for (let offset = 2; offset < imagem.body.length; ) {
      const marcador = imagem.body.readUInt16BE(offset);
      offset += 2;
      if ([0xffc0, 0xffc1, 0xffc2].includes(marcador)) {
        dimensoes = [imagem.body.readUInt16BE(offset + 5), imagem.body.readUInt16BE(offset + 3)];
        break;
      }
      offset += imagem.body.readUInt16BE(offset);
    }
    assert.deepEqual(dimensoes, [1200, 630]);
  } finally {
    await new Promise((resolve) => servidor.close(resolve));
  }
  console.log(
    "PASS: 404 real com assets aninhados, metadata e imagem 1200×630, sitemap público, painéis noindex, cabeçalhos, GPS e exclusão dos arquivos internos do deploy.",
  );
})().catch((erro) => {
  console.error(erro);
  process.exitCode = 1;
});
