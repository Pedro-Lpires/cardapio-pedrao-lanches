/** Confere sintaxe, imports locais e formatação, sem abrir o banco de produção. */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import prettier from "prettier";
import postcss from "postcss";

function listarArquivos(pasta) {
  return fs.readdirSync(pasta, { withFileTypes: true }).flatMap((entrada) => {
    if (["node_modules", ".git", "images", ".vscode"].includes(entrada.name)) return [];
    const arquivo = path.join(pasta, entrada.name);
    return entrada.isDirectory() ? listarArquivos(arquivo) : [arquivo];
  });
}

const config = JSON.parse(fs.readFileSync(".prettierrc.json", "utf8"));
let falhou = false;
let total = 0;

for (const arquivo of listarArquivos(".")) {
  if (!/\.(js|cjs|mjs|css|html|json|md)$/.test(arquivo) || arquivo.endsWith("package-lock.json"))
    continue;
  total++;
  const fonte = fs.readFileSync(arquivo, "utf8");
  try {
    if (/\.(js|cjs|mjs)$/.test(arquivo)) {
      const resultado = spawnSync(process.execPath, ["--check", arquivo], { encoding: "utf8" });
      if (resultado.status !== 0) throw new Error(resultado.stderr);
    }
    if (arquivo.endsWith(".css")) {
      const css = postcss.parse(fonte, { from: arquivo });
      css.walkAtRules("import", (regra) => {
        const referencia = regra.params.match(/["']([^"']+)["']/)?.[1];
        if (!referencia || /^(https?:|data:)/.test(referencia)) return;
        const destino = path.resolve(path.dirname(arquivo), referencia.split("?")[0]);
        if (!fs.existsSync(destino)) throw new Error("Import CSS não encontrado: " + referencia);
      });
    }
    if (arquivo.endsWith(".html") && !arquivo.startsWith("tests" + path.sep)) {
      for (const referencia of fonte.matchAll(/(?:href|src)=["']((?:css|js)\/[^"']+)["']/g)) {
        if (!fs.existsSync(referencia[1].split("?")[0]))
          throw new Error("Arquivo não encontrado: " + referencia[1]);
      }
    }
    if (!(await prettier.check(fonte, { ...config, filepath: arquivo })))
      throw new Error("Formatação diferente do padrão; execute npm run format.");
  } catch (erro) {
    falhou = true;
    console.error(`${arquivo}: ${erro.message}`);
  }
}

if (falhou) process.exitCode = 1;
else console.log(`PASS: sintaxe, imports e formatação de ${total} arquivos.`);
