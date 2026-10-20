/**
 * Utilidades visuais compartilhadas: caminhos de imagens e botões de fechamento. Evite alterar aqui ações de negócio.
 *
 * Organização e caminhos: consulte GUIA-DO-CODIGO.md.
 */
"use strict";

// Compara termos de busca sem acentos, caixa, pontuação ou espaços.
function normalizarBuscaUI(texto) {
  return String(texto ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

// Todos os avisos simples usam o mesmo card. Confirmações de ações continuam separadas.
// Mantém chamadas alert() existentes; mensagens entram em fila e nunca interpretam HTML.
const filaAvisosUI = [];
let avisoAtualUI = null;
let focoAntesAvisoUI = null;
function mostrarAvisoUI(mensagem) {
  filaAvisosUI.push({ mensagem: String(mensagem ?? "") });
  exibirProximoAvisoUI();
}
function mostrarBoasVindasUI(nome, novoPerfil = false) {
  filaAvisosUI.push({
    mensagem: `Bem-vindo, ${String(nome || "cliente").trim()}!${novoPerfil ? "\n\nÉ muito bom ter você conosco. Contamos com sua presença! 🍔" : ""}`,
    boasVindas: true,
  });
  exibirProximoAvisoUI();
}
function mostrarAjudaComLinkUI(mensagem, url) {
  filaAvisosUI.push({ mensagem, url, informativo: true });
  exibirProximoAvisoUI();
}
function pedirPermissaoLocalizacaoUI() {
  return new Promise((resolver) => {
    filaAvisosUI.push({
      mensagem:
        "Autorize sua localização para calcularmos a taxa de entrega. Ao continuar, o navegador pedirá sua permissão.",
      localizacao: true,
      resolver,
    });
    exibirProximoAvisoUI();
  });
}
function exibirProximoAvisoUI() {
  if (avisoAtualUI || !filaAvisosUI.length || !document.body) return;
  focoAntesAvisoUI = document.activeElement;
  const dialogo = document.createElement("dialog");
  const aviso = filaAvisosUI.shift();
  dialogo.className = "aviso-ui";
  dialogo.setAttribute("aria-label", "Aviso");
  dialogo.setAttribute("aria-describedby", "aviso-ui-texto");
  dialogo.innerHTML = `
    <button type="button" class="aviso-ui-fechar" aria-label="Fechar aviso">×</button>
    <span class="aviso-ui-icone" aria-hidden="true">!</span>

    <p id="aviso-ui-texto"></p>
    <button type="button" class="aviso-ui-entendi">Entendi</button>
  `;
  dialogo.querySelector("p").textContent = aviso.mensagem;
  if (aviso.informativo) {
    dialogo.classList.add("aviso-ui-boas-vindas");
    dialogo.querySelector(".aviso-ui-icone").hidden = true;

    dialogo.removeAttribute("aria-labelledby");
    dialogo.setAttribute("aria-label", "Sobre o código CDA");
    dialogo.querySelector(".aviso-ui-entendi").textContent = "Ir para WhatsApp";
  }
  if (aviso.boasVindas) {
    dialogo.classList.add("aviso-ui-boas-vindas");
    dialogo.querySelector(".aviso-ui-icone").hidden = true;

    dialogo.removeAttribute("aria-labelledby");
    dialogo.setAttribute("aria-label", "Boas-vindas");
    dialogo.querySelector(".aviso-ui-entendi").textContent = "Continuar";
  }
  if (aviso.localizacao) {
    dialogo.classList.add("aviso-ui-localizacao");
    dialogo.querySelector(".aviso-ui-icone").textContent = "📍";

    dialogo.setAttribute("aria-label", "Permitir localização");
    dialogo.removeAttribute("aria-labelledby");
    dialogo.querySelector(".aviso-ui-entendi").textContent = "Autorizo";
  }
  dialogo.querySelectorAll("button").forEach((botao) => {
    botao.addEventListener("click", () => {
      const confirmou = botao.classList.contains("aviso-ui-entendi");
      if (confirmou && aviso.url) window.open(aviso.url, "_blank", "noopener,noreferrer");
      dialogo.close(confirmou ? "autorizado" : "cancelado");
    });
  });
  dialogo.addEventListener(
    "close",
    () => {
      dialogo.remove();
      avisoAtualUI = null;
      aviso.resolver?.(dialogo.returnValue === "autorizado");
      if (focoAntesAvisoUI?.isConnected) focoAntesAvisoUI.focus({ preventScroll: true });
      exibirProximoAvisoUI();
    },
    { once: true },
  );
  document.body.append(dialogo);
  avisoAtualUI = dialogo;
  dialogo.showModal();
  dialogo.querySelector(".aviso-ui-entendi").focus({ preventScroll: true });
}
window.alert = mostrarAvisoUI;
document.addEventListener("DOMContentLoaded", exibirProximoAvisoUI);

function resolverImagemProduto(valor) {
  if (!valor) return "images/logo-trailer.png";
  if (/^(https?:\/\/|data:image\/(png|jpeg|webp);base64,|blob:)/i.test(valor)) return valor;
  return String(valor).startsWith("images/") ? valor : "images/" + valor;
}
function padronizarFechamentosUI(raiz = document) {
  raiz.querySelectorAll("button").forEach((b) => {
    if (b.closest("dialog.aviso-ui, dialog.editor-endereco-cliente")) return;
    if (/removerItem|excluirItem|fecharConfiguracao/i.test(b.getAttribute("onclick") || "")) return;
    if (b.classList.contains("ui-x") || b.classList.contains("busca-limpar")) return;
    const texto = b.textContent.trim();
    if (!/^(Fechar|✕|×|✖|X|❌)$/i.test(texto)) return;
    b.textContent = "×";
    b.classList.add("ui-x");
    b.setAttribute("aria-label", "Fechar esta tela");
    const caixa = b.closest(
      ".modal-conteudo,.modal-content,.conteudo-carrinho,dialog,.central-operacao,.perfil-card,section",
    );
    if (caixa) {
      caixa.classList.add("ui-caixa");
      if (b.closest(".modal,.modal-produto,.modal-carrinho") && b.parentElement !== caixa)
        caixa.prepend(b);
    }
  });
  raiz.querySelectorAll(".modal,.modal-produto,.modal-carrinho").forEach((modal) => {
    const conteudo = modal.querySelector(".modal-conteudo,.modal-content,.conteudo-carrinho");
    if (conteudo)
      modal.querySelectorAll(".ui-x,.btn-fechar-modal-auto").forEach((b) => {
        if (!conteudo.contains(b)) conteudo.prepend(b);
      });
  });
}
document.addEventListener("DOMContentLoaded", () => {
  padronizarFechamentosUI();
  let pendente = false;
  new MutationObserver(() => {
    if (pendente) return;
    pendente = true;
    requestAnimationFrame(() => {
      pendente = false;
      padronizarFechamentosUI();
    });
  }).observe(document.body, { childList: true, subtree: true });
});
