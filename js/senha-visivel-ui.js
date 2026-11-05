/* O botão altera apenas a exibição do campo; não copia nem armazena a senha. */
(() => {
  const icone =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/><path class="senha-visivel-risco-ui" d="m3 3 18 18"/></svg>';
  function preparar(raiz) {
    const campos = raiz.matches?.('input[type="password"]')
      ? [raiz]
      : raiz.querySelectorAll('input[type="password"]');
    campos.forEach((campo) => {
      if (campo.closest(".senha-visivel-campo-ui")) return;
      const rotulo = campo.labels?.[0]?.textContent.trim();
      if (rotulo && !campo.hasAttribute("aria-label") && !campo.hasAttribute("aria-labelledby")) {
        campo.setAttribute("aria-label", rotulo);
      }
      const caixa = document.createElement("span");
      caixa.className = "senha-visivel-campo-ui";
      const botao = document.createElement("button");
      botao.type = "button";
      botao.className = "senha-visivel-botao-ui";
      botao.setAttribute("aria-label", "Mostrar senha");
      botao.setAttribute("aria-pressed", "false");
      botao.title = "Mostrar senha";
      botao.innerHTML = icone;
      campo.before(caixa);
      caixa.append(campo, botao);
      botao.onclick = () => {
        const mostrar = campo.type === "password";
        campo.type = mostrar ? "text" : "password";
        botao.setAttribute("aria-pressed", String(mostrar));
        botao.setAttribute("aria-label", mostrar ? "Ocultar senha" : "Mostrar senha");
        botao.title = mostrar ? "Ocultar senha" : "Mostrar senha";
      };
    });
  }
  window.ocultarSenhasUI = (raiz) => {
    raiz.querySelectorAll(".senha-visivel-campo-ui").forEach((caixa) => {
      caixa.querySelector("input").type = "password";
      const botao = caixa.querySelector("button");
      botao.setAttribute("aria-pressed", "false");
      botao.setAttribute("aria-label", "Mostrar senha");
      botao.title = "Mostrar senha";
    });
  };
  document.addEventListener("DOMContentLoaded", () => {
    preparar(document);
    new MutationObserver((mudancas) => {
      for (const mudanca of mudancas) {
        for (const no of mudanca.addedNodes) {
          if (no.nodeType !== 1) continue;
          preparar(no);
        }
      }
    }).observe(document.body, { childList: true, subtree: true });
  });
})();
