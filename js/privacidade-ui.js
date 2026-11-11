/* Documentos públicos abertos a partir dos links da loja. */
let janelaDocumentoLojaUI = null;
const documentosLojaUI = new Map();
function carregarDocumentoLojaUI(arquivo, id) {
  if (!documentosLojaUI.has(arquivo)) {
    const documento = fetch(new URL(arquivo, document.baseURI), {
      cache: "no-cache",
    })
      .then(async (resposta) => {
        if (!resposta.ok) throw Error("Documento indisponível");
        const pagina = new DOMParser().parseFromString(await resposta.text(), "text/html");
        const artigo = pagina.getElementById(id);
        if (!artigo) throw Error("Documento inválido");
        return artigo;
      })
      .catch((erro) => {
        documentosLojaUI.delete(arquivo);
        throw erro;
      });
    documentosLojaUI.set(arquivo, documento);
  }
  return documentosLojaUI.get(arquivo);
}
async function abrirDocumentoLojaUI(origem) {
  if (janelaDocumentoLojaUI?.open) return;
  const termos = origem.hasAttribute("data-termos-ui");
  const titulo = termos ? "Termos de Uso" : "Privacidade";
  const arquivo = termos ? "termos.html" : "privacidade.html";
  const id = termos ? "conteudo-termos" : "conteudo-privacidade";
  const janela = document.createElement("dialog");
  janela.className = "privacidade-janela-ui";
  janela.setAttribute("aria-labelledby", "privacidade-janela-titulo-ui");
  janela.innerHTML = `<header class="privacidade-topo-ui"><button type="button" data-voltar-privacidade>← Voltar</button><h2 id="privacidade-janela-titulo-ui">${titulo}</h2><button type="button" data-fechar-privacidade aria-label="Fechar ${titulo}">×</button></header><div class="privacidade-corpo-ui"></div>`;
  const corpo = janela.querySelector(".privacidade-corpo-ui");
  corpo.innerHTML = htmlCarregandoUI("Abrindo documento…");
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
      if (janelaDocumentoLojaUI === janela) janelaDocumentoLojaUI = null;
      if (origem?.isConnected) origem.focus({ preventScroll: true });
    },
    { once: true },
  );
  document.body.append(janela);
  janelaDocumentoLojaUI = janela;
  janela.showModal();
  document.body.style.overflow = "hidden";
  janela.querySelector("button").focus({ preventScroll: true });
  try {
    const documento = await carregarDocumentoLojaUI(arquivo, id);
    if (!janela.open) return;
    corpo.replaceChildren(documento.cloneNode(true));
  } catch {
    if (janela.open)
      corpo.innerHTML = `<p>Não foi possível carregar o texto. Confira sua conexão ou <a href="${arquivo}" target="_blank" rel="noopener">abra o documento em outra aba</a>.</p>`;
  } finally {
    corpo.removeAttribute("aria-busy");
  }
}
document.addEventListener("click", (evento) => {
  const link = evento.target.closest?.("a[data-privacidade-ui], a[data-termos-ui]");
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
  abrirDocumentoLojaUI(link);
});
