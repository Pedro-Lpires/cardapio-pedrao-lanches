/** Executa regras apenas no projeto fictício, com o SDK/CLI de testes fora da publicação. */
import path from "node:path";
import fs from "node:fs";
import { spawnSync } from "node:child_process";
const pasta = process.env.PEDRAO_FIREBASE_TEST_TOOLS;
if (!pasta) throw Error("Defina PEDRAO_FIREBASE_TEST_TOOLS conforme security/COMO-TESTAR.md.");
const cli = path.resolve(pasta, "node_modules/firebase-tools/lib/bin/firebase.js");
if (!fs.existsSync(cli)) throw Error("Firebase CLI não encontrado na pasta de testes.");
const resultado = spawnSync(
  process.execPath,
  [
    cli,
    "emulators:exec",
    "--only",
    "firestore,auth",
    "--project",
    "demo-pedrao-seguranca",
    "--config",
    "firebase.emulador.json",
    "node tests/seguranca.emulador.cjs",
  ],
  { stdio: "inherit", env: { ...process.env, FIREBASE_CLI_DISABLE_UPDATE_CHECK: "true" } },
);
if (resultado.error) throw resultado.error;
process.exitCode = resultado.status || 0;
