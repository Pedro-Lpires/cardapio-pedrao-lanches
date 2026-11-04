const assert = require("node:assert/strict");
const { registrarFalha, etapaConfiguracao } = require("../api/_lib/diagnostico.cjs");
const mensagens = [],
  original = console.error;
try {
  console.error = (texto) => mensagens.push(texto);
  const erro = Object.assign(new Error("SEGREDO PRIVADO não pode aparecer"), {
    code: "SEGREDO PRIVADO",
  });
  registrarFalha(erro, "api_teste");
  assert.throws(() =>
    etapaConfiguracao("json_servico", () => {
      throw erro;
    }),
  );
  assert.equal(
    etapaConfiguracao("ok", () => 3),
    3,
  );
  assert(!mensagens.join("").includes("SEGREDO"));
  assert.equal(JSON.parse(mensagens[0]).codigo, "erro");
  assert.equal(JSON.parse(mensagens[1]).etapa, "json_servico");
} finally {
  console.error = original;
}
console.log(
  "PASS: diagnóstico registra somente etapa/código, sem mensagem, stack ou conteúdo de credenciais.",
);
