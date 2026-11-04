const fs = require("node:fs"),
  vm = require("node:vm"),
  assert = require("node:assert/strict");
async function ambiente({
  token = "v1.teste.teste.teste",
  conferirStatus = 200,
  rede = false,
} = {}) {
  const campos = {},
    chamadas = [];
  let iniciar, enviar, caminhoLimpo, confirmar;
  for (const id of [
    "recuperar-status",
    "form-recuperar",
    "recuperar-titulo",
    "recuperar-senha",
    "recuperar-confirmacao",
    "recuperar-voltar",
  ])
    campos[id] = { textContent: "", value: "", hidden: true, dataset: {}, focus() {} };
  const botao = { disabled: false };
  campos["form-recuperar"].querySelector = () => botao;
  campos["form-recuperar"].addEventListener = (_, fn) => (enviar = fn);
  const ctx = vm.createContext({
    URLSearchParams,
    document: { addEventListener: (_, fn) => (iniciar = fn), getElementById: (id) => campos[id] },
    location: { hash: token ? "#token=" + token : "", pathname: "/recuperar-acesso.html" },
    history: { replaceState: (_, __, caminho) => (caminhoLimpo = caminho) },
    fetch: async (url, opcoes) => {
      if (rede) throw Error("Failed to fetch");
      const dados = JSON.parse(opcoes.body);
      chamadas.push({ url, opcoes, dados });
      if (dados.acao === "redefinir")
        return new Promise((resolve) => {
          confirmar = () => resolve({ ok: true, json: async () => ({ sucesso: true }) });
        });
      return {
        ok: conferirStatus === 200,
        status: conferirStatus,
        json: async () =>
          conferirStatus === 200
            ? { valido: true, minimoSenha: 8 }
            : { erro: "Este link expirou ou já foi utilizado." },
      };
    },
  });
  vm.runInContext(fs.readFileSync("js/recuperar-acesso.js", "utf8"), ctx);
  await iniciar();
  return {
    campos,
    chamadas,
    botao,
    enviar: () => enviar({ preventDefault() {} }),
    concluir: () => confirmar(),
    caminhoLimpo,
  };
}
(async () => {
  const a = await ambiente();
  assert.equal(a.campos["form-recuperar"].hidden, false);
  assert.equal(a.caminhoLimpo, "/recuperar-acesso.html", "Remove segredo do endereço visível");
  assert.equal(a.chamadas[0].url, "/api/recuperacao-acesso");
  assert.equal(a.chamadas[0].opcoes.referrerPolicy, "no-referrer");
  assert.equal(a.chamadas[0].opcoes.credentials, "omit");
  a.campos["recuperar-senha"].value = "Senha teste 123";
  a.campos["recuperar-confirmacao"].value = "Diferente";
  await a.enviar();
  assert.equal(a.chamadas.length, 1, "Senhas diferentes não são enviadas");
  a.campos["recuperar-confirmacao"].value = a.campos["recuperar-senha"].value;
  const salvando = a.enviar();
  await a.enviar();
  assert.equal(a.chamadas.length, 2, "Segundo clique não repete a solicitação");
  assert.equal(a.botao.disabled, true);
  a.concluir();
  await salvando;
  assert.equal(a.campos["form-recuperar"].hidden, true);
  assert.equal(a.campos["recuperar-senha"].value, "");
  assert.equal(a.campos["recuperar-confirmacao"].value, "");
  assert.equal(a.campos["recuperar-voltar"].hidden, false);
  assert.match(
    a.campos["recuperar-status"].textContent,
    /histórico e seus benefícios foram preservados/,
  );
  for (const conferirStatus of [410, 503]) {
    const b = await ambiente({ conferirStatus });
    assert.equal(b.campos["form-recuperar"].hidden, true);
    assert.match(b.campos["recuperar-status"].textContent, /expirou/);
  }
  const semToken = await ambiente({ token: "" });
  assert.equal(semToken.chamadas.length, 0);
  assert.equal(semToken.campos["form-recuperar"].hidden, true);
  const offline = await ambiente({ rede: true });
  assert.match(
    offline.campos["recuperar-status"].textContent,
    /Abra o link novamente pelo WhatsApp/,
  );
  assert(!offline.campos["recuperar-status"].textContent.includes("Failed to fetch"));
  console.log(
    "PASS: formulário só abre após conferir o link; fragmento removido, ausência/expiração/falha, confirmação da senha, duplo clique e limpeza dos campos.",
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
