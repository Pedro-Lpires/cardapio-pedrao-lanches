/** Executa as suítes locais sem acessar o Firebase real. */
import fs from "node:fs";
import { spawnSync } from "node:child_process";

const arquivos = fs
  .readdirSync("tests")
  .filter((arquivo) => arquivo.endsWith(".test.cjs"))
  .sort();

for (const arquivo of arquivos) {
  const resultado = spawnSync(process.execPath, ["tests/" + arquivo], { stdio: "inherit" });
  if (resultado.status !== 0) process.exit(resultado.status || 1);
}

console.log(`PASS: ${arquivos.length} suítes locais.`);
