/* Documento público: abre apenas pelo link, sem aceite nem alteração dos formulários. */
let janelaPrivacidadeUI = null;
let documentoPrivacidadeUI = null;
function carregarDocumentoPrivacidadeUI() {
  if (!documentoPrivacidadeUI) {
    documentoPrivacidadeUI = fetch(new URL("privacidade.html", document.baseURI), {
      cache: "no-cache",
    })
      .then(async (resposta) => {
        if (!resposta.ok) throw Error("Documento indisponível");
        const pagina = new DOMParser().parseFromString(await resposta.text(), "text/html");
        const artigo = pagina.getElementById("conteudo-privacidade");
        if (!artigo) throw Error("Documento inválido");
        return artigo;
      })
      .catch((erro) => {
        documentoPrivacidadeUI = null;
        throw erro;
      });
  }
  return documentoPrivacidadeUI;
}
async function abrirPrivacidadeUI(origem) {
  if (janelaPrivacidadeUI?.open) return;
  const janela = document.createElement("dialog");
  janela.className = "privacidade-janela-ui";
  janela.setAttribute("aria-labelledby", "privacidade-janela-titulo-ui");
  janela.innerHTML =
    '<header class="privacidade-topo-ui"><button type="button" data-voltar-privacidade>← Voltar</button><h2 id="privacidade-janela-titulo-ui">Privacidade</h2><button type="button" data-fechar-privacidade aria-label="Fechar privacidade">×</button></header><div class="privacidade-corpo-ui"></div>';
  const corpo = janela.querySelector(".privacidade-corpo-ui");
  corpo.innerHTML = htmlCarregandoUI("Abrindo privacidade…");
  corpo.setAttribute("aria-busy", "true");
  const rolagemAnterior = document.body.style.overflow;
  janela.querySelectorAll("button").forEach((botao) => {
    botao.onclick = () => janela.close();
  });
  janela.addEventListener(
    "close",
    () => {
      document.body.style.overflow = rolagemAnterior;
      janela.remove();
      if (janelaPrivacidadeUI === janela) janelaPrivacidadeUI = null;
      if (origem?.isConnected) origem.focus({ preventScroll: true });
    },
    { once: true },
  );
  document.body.append(janela);
  janelaPrivacidadeUI = janela;
  janela.showModal();
  document.body.style.overflow = "hidden";
  janela.querySelector("button").focus({ preventScroll: true });
  try {
    const documento = await carregarDocumentoPrivacidadeUI();
    if (!janela.open) return;
    corpo.replaceChildren(documento.cloneNode(true));
  } catch {
    if (janela.open)
      corpo.innerHTML =
        '<p>Não foi possível carregar o texto. Confira sua conexão ou <a href="privacidade.html" target="_blank" rel="noopener">abra a página de privacidade</a>.</p>';
  } finally {
    corpo.removeAttribute("aria-busy");
  }
}
document.addEventListener("click", (evento) => {
  const link = evento.target.closest?.("a[data-privacidade-ui]");
  if (
    !link ||
    evento.button > 0 ||
    evento.ctrlKey ||
    evento.metaKey ||
    evento.shiftKey ||
    evento.altKey
  )
    return;
  evento.preventDefault();
  abrirPrivacidadeUI(link);
});
