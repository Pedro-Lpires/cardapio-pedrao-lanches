/* A abertura do WhatsApp não grava nem reenvia o pedido. */
function urlWhatsAppPedidoUI(
  texto = "",
  desktop = !/Android|iPhone|iPad|iPod/i.test(navigator.userAgent || ""),
) {
  const numero = "5565992386045";
  const base = desktop
    ? "https://web.whatsapp.com/send?phone=" + numero
    : "https://wa.me/" + numero;
  return (
    base +
    (texto
      ? (desktop ? "&" : "?") + "text=" + encodeURIComponent(textoWhatsAppSemEmojisUI(texto))
      : "")
  );
}
function abrirMensagemWhatsPedidoUI(texto) {
  const mensagem = textoWhatsAppSemEmojisUI(texto);
  window.open(urlWhatsAppPedidoUI(mensagem), "pedrao-whatsapp-pedido", "noopener");
  if (typeof janelaEditorUI !== "function") return;
  const janela = janelaEditorUI("Pedido salvo"),
    box = janela.querySelector(".editor-corpo-ui");
  box.innerHTML =
    '<p>Seu pedido foi salvo e abrimos o WhatsApp para você enviar a mensagem.</p><p>Se o WhatsApp ficar carregando, copie o pedido e abra a conversa sem o texto.</p><div class="editor-acoes-ui"><button type="button" data-copiar>Copiar pedido</button><a class="botao-padrao" target="_blank" rel="noopener" data-abrir>Abrir conversa</a></div><p role="status"></p><details><summary>Ver mensagem</summary><textarea readonly aria-label="Mensagem do pedido"></textarea></details>';
  box.querySelector("textarea").value = mensagem;
  box.querySelector("[data-abrir]").href = urlWhatsAppPedidoUI();
  box.querySelector("[data-copiar]").onclick = async () => {
    try {
      await navigator.clipboard.writeText(mensagem);
      box.querySelector("[role=status]").textContent =
        "Pedido copiado. Cole na conversa do WhatsApp.";
    } catch {
      box.querySelector("details").open = true;
      box.querySelector("textarea").select();
      box.querySelector("[role=status]").textContent = "Selecione e copie o texto abaixo.";
    }
  };
}
document.addEventListener("DOMContentLoaded", () => {
  const enviar = window.confirmarEEnviar;
  let enviando = false;
  if (typeof enviar !== "function") return;
  window.confirmarEEnviar = async (...args) => {
    if (enviando) return;
    enviando = true;
    try {
      return await enviar(...args);
    } finally {
      enviando = false;
    }
  };
});
