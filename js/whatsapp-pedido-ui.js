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
let janelaWhatsReservadaUI = null;
function reservarWhatsPedidoUI() {
  try {
    const janela = window.open("about:blank", "pedrao-whatsapp-pedido");
    if (janela) {
      janela.opener = null;
      janela.document.title = "Preparando seu pedido";
      const estilo = janela.document.createElement("style");
      estilo.textContent =
        "body{margin:0;min-height:100dvh;display:grid;place-items:center;background:#111;color:#fff;font:17px Arial;text-align:center}main{max-width:280px;padding:24px} .espera{width:40px;height:40px;border:4px solid #444;border-top-color:#e60016;border-radius:50%;margin:20px auto;animation:girar .9s linear infinite}@keyframes girar{to{transform:rotate(360deg)}}@media(prefers-reduced-motion:reduce){.espera{animation:none}}";
      janela.document.head.append(estilo);
      janela.document.body.innerHTML =
        '<main role="status"><div class="espera" aria-hidden="true"></div><p>Salvando seu pedido…</p><p>Aguarde para abrir o WhatsApp.</p></main>';
      janelaWhatsReservadaUI = janela;
    }
  } catch {
    janelaWhatsReservadaUI = null;
  }
}
function fecharReservaWhatsPedidoUI() {
  if (janelaWhatsReservadaUI && !janelaWhatsReservadaUI.closed) janelaWhatsReservadaUI.close();
  janelaWhatsReservadaUI = null;
}
function abrirMensagemWhatsPedidoUI(texto) {
  const mensagem = textoWhatsAppSemEmojisUI(texto);
  if (janelaWhatsReservadaUI && !janelaWhatsReservadaUI.closed) {
    try {
      janelaWhatsReservadaUI.location.replace(urlWhatsAppPedidoUI(mensagem));
    } catch {} // O link explícito abaixo também funciona quando o navegador bloqueia a navegação.
    janelaWhatsReservadaUI = null;
  } else window.open(urlWhatsAppPedidoUI(mensagem), "pedrao-whatsapp-pedido", "noopener");
  if (typeof janelaEditorUI !== "function") return;
  const janela = janelaEditorUI("Pedido salvo"),
    box = janela.querySelector(".editor-corpo-ui");
  box.innerHTML =
    '<p>Seu pedido foi salvo. Envie a mensagem no WhatsApp para concluir.</p><div class="editor-acoes-ui"><a class="botao-padrao" target="_blank" rel="noopener" data-enviar>Enviar no WhatsApp</a></div><details class="whatsapp-ajuda-ui"><summary>O WhatsApp não abriu ou ficou carregando?</summary><p>Toque em Enviar no WhatsApp para abrir a mensagem pronta. Se ainda não funcionar, copie o pedido e cole na conversa. Isso não cria outro pedido.</p></details><div class="editor-acoes-ui"><button type="button" data-copiar>Copiar pedido</button><a class="botao-padrao" target="_blank" rel="noopener" data-abrir>Abrir conversa</a></div><p role="status"></p><details><summary>Ver mensagem</summary><textarea readonly aria-label="Mensagem do pedido"></textarea></details>';
  box.querySelector("textarea").value = mensagem;
  box.querySelector("[data-enviar]").href = urlWhatsAppPedidoUI(mensagem);
  box.querySelector("[data-abrir]").href = urlWhatsAppPedidoUI();
  box.querySelector("[data-copiar]").onclick = async () => {
    try {
      await navigator.clipboard.writeText(mensagem);
      box.querySelector("[role=status]").textContent =
        "Pedido copiado. Cole na conversa do WhatsApp.";
    } catch {
      box.querySelector("textarea").closest("details").open = true;
      box.querySelector("textarea").select();
      box.querySelector("[role=status]").textContent = "Selecione e copie o texto abaixo.";
    }
  };
}
document.addEventListener("DOMContentLoaded", () => {
  for (const nome of ["confirmarEEnviar", "enviarConsumoLocalUI"]) {
    const enviar = window[nome];
    let enviando = false;
    if (typeof enviar !== "function") continue;
    window[nome] = async (...args) => {
      if (enviando) return;
      if (nome === "confirmarEEnviar" && !document.querySelector(".check-pagamento:checked"))
        return enviar(...args); // A mensagem de campo obrigatório é imediata.
      enviando = true;
      reservarWhatsPedidoUI(); // Antes do primeiro await, durante o toque do cliente.
      const concluirCarregamento = iniciarCarregamentoUI("Conferindo e salvando seu pedido…");
      try {
        return await enviar(...args);
      } catch (erro) {
        mostrarAvisoUI(
          erro.message || "Não foi possível concluir o pedido. Tente novamente.",
          "conferir",
        );
      } finally {
        concluirCarregamento();
        fecharReservaWhatsPedidoUI();
        enviando = false;
      }
    };
  }
});
