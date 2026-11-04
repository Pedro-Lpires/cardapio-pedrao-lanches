const { spawnSync } = require("node:child_process");
if (
  process.env.FIRESTORE_EMULATOR_HOST !== "127.0.0.1:8188" ||
  process.env.FIREBASE_AUTH_EMULATOR_HOST !== "127.0.0.1:9099"
)
  throw Error("Este teste só executa nos emuladores locais de Auth e Firestore.");
for (const arquivo of ["regras-firestore.emulador.cjs", "autenticacao-integrada.emulador.cjs"]) {
  const resultado = spawnSync(process.execPath, ["tests/" + arquivo], {
    stdio: "inherit",
    env: process.env,
  });
  if (resultado.status !== 0) process.exit(resultado.status || 1);
}
