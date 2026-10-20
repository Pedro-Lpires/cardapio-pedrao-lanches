const http = require("http"),
  fs = require("fs"),
  path = require("path");
const root = process.cwd();
const tipos = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".webp": "image/webp",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
};
http
  .createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    const file = path.resolve(root, "." + (pathname === "/" ? "/index.html" : pathname));
    if (
      !file.startsWith(root + path.sep) ||
      file.includes(path.sep + ".git" + path.sep) ||
      file.includes(path.sep + ".codex" + path.sep)
    ) {
      res.writeHead(403);
      res.end();
      return;
    }
    fs.readFile(file, (e, buf) => {
      if (e) {
        res.writeHead(404);
        res.end("Arquivo não encontrado");
        return;
      }
      res.writeHead(200, {
        "Content-Type": tipos[path.extname(file)] || "application/octet-stream",
        "Cache-Control": "no-store",
      });
      res.end(buf);
    });
  })
  .listen(8090, "127.0.0.1", () => console.log("Preview em http://127.0.0.1:8090"));
