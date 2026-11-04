/* Exibe o componente real, sem SDK do Firebase ou requisições externas. */
if (!["127.0.0.1", "localhost"].includes(location.hostname)) throw Error("Prévia somente local.");
document.addEventListener("DOMContentLoaded", () => {
  const equipe = new URLSearchParams(location.search).get("tipo") === "equipe";
  const janela = janelaEntradaEquipeUI(
    !equipe,
    "Prévia visual com dados fictícios. Não envie credenciais reais.",
  );
  const form = janela.querySelector("form");
  if (form)
    form.onsubmit = (e) => {
      e.preventDefault();
      form.elements.senha.value = "";
      janela.querySelector("[role=status]").textContent =
        "Demonstração local. Nenhum acesso foi solicitado.";
    };
});
