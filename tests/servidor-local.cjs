const http = require("node:http"),
  fs = require("node:fs"),
  path = require("node:path");
const tipos = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".png": "image/png",
  ".webp": "image/webp",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
};
function criarServidorPreview(root = process.cwd()) {
  const regras = JSON.parse(fs.readFileSync(path.join(root, "vercel.json"), "utf8")).headers;
  return http.createServer((req, res) => {
    let pathname;
    try {
      pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    } catch {
      res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Endereço inválido");
      return;
    }
    // Reproduz os padrões regex dos cabeçalhos estáticos usados neste projeto.
    if (/^\/tests\/api-seguranca\/(pedido-publico|mesa-publica|acesso-cliente)$/.test(pathname)) {
      require("./seguranca-api-fixture.cjs").atenderFixture(req, res);
      return;
    }
    for (const regra of regras)
      if (new RegExp("^" + regra.source + "$").test(pathname))
        for (const { key, value } of regra.headers) res.setHeader(key, value);
    res.setHeader("Cache-Control", "no-store");
    const file = path.resolve(root, "." + (pathname === "/" ? "/index.html" : pathname));
    const relativo = path.relative(root, file);
    if (
      relativo === ".." ||
      relativo.startsWith(".." + path.sep) ||
      path.isAbsolute(relativo) ||
      relativo
        .split(path.sep)
        .some(
          (p) =>
            [".git", ".codex", ".agents", ".claude", "node_modules"].includes(p) ||
            /^\.env(?:\.|$)/.test(p),
        ) ||
      pathname.startsWith("/api/_lib/") ||
      pathname.endsWith(".secret.json")
    ) {
      res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Acesso indisponível");
      return;
    }
    if (["/api/recuperacao-acesso", "/api/recuperacao-acesso.js"].includes(pathname)) {
      require("../api/recuperacao-acesso.js")(req, res);
      return;
    }
    if (["/api/acesso-cliente", "/api/acesso-cliente.js"].includes(pathname)) {
      require("../api/acesso-cliente.js")(req, res);
      return;
    }
    if (["/api/acesso-equipe", "/api/acesso-equipe.js"].includes(pathname)) {
      require("../api/acesso-equipe.js")(req, res);
      return;
    }
    if (["/api/pedido-publico", "/api/pedido-publico.js"].includes(pathname)) {
      require("../api/pedido-publico.js")(req, res);
      return;
    }
    if (["/api/mesa-publica", "/api/mesa-publica.js"].includes(pathname)) {
      require("../api/mesa-publica.js")(req, res);
      return;
    }
    fs.readFile(file, (e, buf) => {
      if (e) {
        const extensao = path.extname(pathname);
        if (!extensao || extensao === ".html") {
          fs.readFile(path.join(root, "404.html"), (erro, pagina) => {
            res.writeHead(404, {
              "Content-Type": erro ? "text/plain; charset=utf-8" : tipos[".html"],
              "X-Robots-Tag": "noindex, nofollow, noarchive",
            });
            res.end(erro ? "Página não encontrada" : pagina);
          });
        } else {
          res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
          res.end("Arquivo não encontrado");
        }
        return;
      }
      res.writeHead(200, {
        "Content-Type": tipos[path.extname(file)] || "application/octet-stream",
      });
      res.end(buf);
    });
  });
}
if (require.main === module) {
  const servidor = criarServidorPreview();
  servidor.listen(Number(process.env.PORT || 8090), "127.0.0.1", () =>
    console.log("Preview em http://127.0.0.1:" + servidor.address().port),
  );
}
module.exports = { criarServidorPreview };
