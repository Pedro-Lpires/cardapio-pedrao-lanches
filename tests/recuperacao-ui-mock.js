/* Só para a prévia local: não gera links nem altera contas. */
(() => {
  if (
    !["127.0.0.1", "localhost"].includes(location.hostname) ||
    !location.pathname.startsWith("/tests/")
  )
    throw Error("Prévia somente local.");
  const cenario = new URL(document.currentScript.src).searchParams.get("cenario") || "valido";
  const original = window.fetch.bind(window);
  window.fetch = async (url, opcoes = {}) => {
    if (url !== "/api/recuperacao-acesso") return original(url, opcoes);
    const dados = JSON.parse(opcoes.body || "{}");
    if (cenario === "expirado")
      return new Response(
        JSON.stringify({
          erro: "Este link expirou, já foi utilizado ou foi substituído. Peça um novo link à loja.",
        }),
        { status: 410, headers: { "Content-Type": "application/json" } },
      );
    return new Response(
      JSON.stringify(
        dados.acao === "redefinir" ? { sucesso: true } : { valido: true, minimoSenha: 8 },
      ),
      { headers: { "Content-Type": "application/json" } },
    );
  };
})();
