const fs = require("node:fs"),
  vm = require("node:vm"),
  assert = require("node:assert/strict");
const ctx = vm.createContext({ URL, location: { origin: "https://cardapio.test" } });
vm.runInContext(fs.readFileSync("js/imagens-webp.js", "utf8"), ctx);
const aliases = JSON.parse(fs.readFileSync("scripts/imagens-webp-aliases.json", "utf8"));
for (const [antigo, atual] of Object.entries(aliases)) {
  assert.equal(ctx.resolverImagemWebpUI(antigo), atual);
  assert.equal(ctx.resolverImagemWebpUI("./" + antigo + "?v=2#foto"), atual + "?v=2#foto");
  assert.ok(fs.existsSync(atual), "Toda imagem antiga tem uma substituta real");
  assert.equal(fs.readFileSync(atual).toString("ascii", 8, 12), "WEBP");
}
assert.equal(
  ctx.resolverImagemWebpUI("https://externo.test/images/lanche.png"),
  "https://externo.test/images/lanche.png",
);
assert.equal(
  ctx.resolverImagemWebpUI("https://cardapio.test/images/logo-trailer.png"),
  "https://cardapio.test/images/logo-trailer.webp",
);
assert.equal(ctx.resolverImagemWebpUI("data:image/png;base64,AAA"), "data:image/png;base64,AAA");
vm.runInContext(fs.readFileSync("js/avatares-ui.js", "utf8"), ctx);
assert.equal(
  ctx.identidadeAvatarClienteUI("images/avatares/avatares/ouro/dama-do-ketchup.webp"),
  "ketchup",
);
console.log(
  "PASS: imagens legadas resolvem para WebP existente, URLs externas intactas e identidade dos avatares preservada.",
);
