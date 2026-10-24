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
function mostrarAvisoUI(mensagem, personagem) {
  filaAvisosUI.push({ mensagem: String(mensagem ?? ""), personagem });
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
  if (typeof decorarAvisoPersonagemPedraoUI === "function")
    decorarAvisoPersonagemPedraoUI(dialogo, aviso);
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

function htmlCarregandoUI(texto = "Carregando…") {
  return (
    '<div class="ui-carregando" role="status" aria-live="polite"><strong class="ui-carregando-texto">' +
    String(texto).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]) +
    '</strong><span class="ui-carregando-circulo" aria-hidden="true"></span><span class="ui-carregando-bolinhas" aria-hidden="true"><i></i><i></i><i></i></span></div>'
  );
}
function abrirJanelaElementoUI(elemento, titulo) {
  const aberta = elemento.parentElement?.matches("dialog.interface-janela")
    ? elemento.parentElement
    : null;
  if (aberta) return aberta;
  const marcador = document.createComment("origem da janela");
  elemento.before(marcador);
  const display = elemento.style.display,
    oculto = elemento.hidden;
  const dialog = document.createElement("dialog");
  dialog.className = "interface-janela";
  if (/acr[eé]scimos|todos os lanches|lanches individuais|^lanche \d/i.test(titulo))
    dialog.classList.add("janela-acrescimos-ui");
  const cabecalho = document.createElement("div");
  cabecalho.className = "interface-janela-topo";
  cabecalho.innerHTML =
    '<button type="button" class="ui-voltar">← Voltar</button><h3></h3><button type="button" class="ui-x" aria-label="Fechar janela">×</button>';
  cabecalho.querySelector("h3").textContent = titulo;
  cabecalho.querySelector(".ui-voltar").onclick = () => dialog.close("aplicar");
  cabecalho.querySelector(".ui-x").onclick = () => dialog.close("cancelar");
  dialog.append(cabecalho, elemento);
  elemento.hidden = false;
  elemento.style.display = "block";
  dialog.addEventListener(
    "close",
    () => {
      elemento.style.display = display;
      elemento.hidden = oculto;
      if (marcador.isConnected) marcador.replaceWith(elemento);
      dialog.remove();
    },
    { once: true },
  );
  document.body.append(dialog);
  dialog.showModal();
  return dialog;
}
function configurarRascunhoAcrescimosUI(janela, aplicar, cancelar) {
  janela.querySelector(".ui-voltar").onclick = () => {
    janela.returnValue = "aplicar";
    aplicar?.();
    if (janela.open) janela.close("aplicar");
  };
  janela.addEventListener(
    "close",
    () => {
      if (janela.returnValue !== "aplicar") cancelar?.();
    },
    { once: true },
  );
}
// Acréscimos mantêm a seleção ao fechar, inclusive por X ou Escape.
function configurarAcrescimosImediatosUI(janela, aplicar) {
  let aplicado = false;
  const salvar = () => {
    if (aplicado) return;
    aplicado = true;
    aplicar?.();
  };
  const fechar = () => {
    salvar();
    if (janela.open) janela.close("aplicar");
  };
  janela.querySelector(".ui-voltar").onclick = fechar;
  janela.querySelector(".ui-x").onclick = fechar;
  janela.addEventListener("cancel", (evento) => {
    evento.preventDefault();
    fechar();
  });
  janela.addEventListener("close", salvar, { once: true });
}
function lerComPrazoUI(promessa, prazo = 12000) {
  let timer;
  return Promise.race([
    promessa,
    new Promise((_, rejeitar) => {
      timer = setTimeout(
        () => rejeitar(new Error("A busca demorou. Confira sua conexão e tente novamente.")),
        prazo,
      );
    }),
  ]).finally(() => clearTimeout(timer));
}
document.addEventListener("DOMContentLoaded", exibirProximoAvisoUI);

function resolverImagemProduto(valor) {
  if (!valor) return "images/logo-trailer.png";
  if (/^(https?:\/\/|data:image\/(png|jpeg|webp);base64,|blob:)/i.test(valor)) return valor;
  return String(valor).startsWith("images/") ? valor : "images/" + valor;
}
async function copiarCupomClienteUI(botao) {
  const codigo = botao.dataset.codigo;
  const status = botao.nextElementSibling;
  try {
    await navigator.clipboard.writeText(codigo);
    if (status) status.textContent = "Código copiado! Cole no campo de cupom do pedido.";
  } catch {
    const campo = document.createElement("input");
    campo.value = codigo;
    campo.readOnly = true;
    campo.setAttribute("aria-label", "Código do cupom para copiar");
    botao.after(campo);
    campo.focus();
    campo.select();
    if (status) status.textContent = "Selecione e copie o código acima.";
  }
}
function configurarCamposNumericosUI(raiz = document) {
  if (!document.querySelector("#area-admin-avancada,.menu-atendente")) return;
  const mistos = [
    "admin-busca-cliente",
    "campanha-cliente",
    "raspa-cliente-regra",
    "raspa-manual-cliente",
    "raspa-busca-cliente",
  ];
  const campos = [...(raiz.matches?.("input") ? [raiz] : []), ...raiz.querySelectorAll("input")];
  campos.forEach((campo) => {
    if (campo.dataset.digitosUi) return;
    const rotulo = `${campo.closest?.("label")?.textContent || ""} ${campo.placeholder || ""}`;
    const cda =
      campo.id === "admin-codigo-cliente" ||
      (/CDA/i.test(rotulo) && !/telefone|celular/i.test(rotulo));
    const misto =
      mistos.includes(campo.id) || /(?:telefone|celular).*(?:c[oó]digo|CDA)/i.test(rotulo);
    const telefone = /telefone|celular/i.test(`${campo.id || ""} ${campo.name || ""} ${rotulo}`);
    if (!cda && !misto && !telefone) return;
    campo.dataset.digitosUi = "sim";
    campo.inputMode = "numeric";
    campo.maxLength = cda ? 4 : 11;
    campo.pattern = misto ? "(?:[0-9]{4}|[0-9]{11})" : cda ? "[0-9]{4}" : "[0-9]{11}";
    const ajuda = document.createElement("small");
    ajuda.className = "campo-digitos-ui";
    campo.after(ajuda);
    const conferir = () => {
      const n = campo.value.length;
      ajuda.textContent = misto
        ? `${n} dígitos · CDA: 4 / celular com DDD: 11`
        : `${n}/${cda ? 4 : 11} dígitos${telefone ? " · celular com DDD" : " · CDA"}`;
      campo.setCustomValidity(
        !n || (misto ? n === 4 || n === 11 : n === campo.maxLength)
          ? ""
          : misto
            ? "Informe um CDA de 4 números ou celular de 11 números com DDD."
            : `Informe exatamente ${campo.maxLength} números.`,
      );
    };
    campo.addEventListener("input", () => {
      campo.value = campo.value.replace(/\D/g, "").slice(0, campo.maxLength);
      conferir();
    });
    campo.addEventListener("change", conferir);
    conferir();
  });
}
function padronizarFechamentosUI(raiz = document) {
  configurarCamposNumericosUI(raiz);
  [...(raiz.matches?.("button") ? [raiz] : []), ...raiz.querySelectorAll("button")].forEach((b) => {
    if (b.closest("dialog.aviso-ui, dialog.editor-endereco-cliente")) return;
    if (/removerItem|excluirItem|fecharConfiguracao/i.test(b.getAttribute("onclick") || "")) return;
    if (b.classList.contains("ui-x") || b.classList.contains("busca-limpar")) return;
    if (b.classList.contains("cozinha-remover-x")) return;
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
  [
    ...(raiz.matches?.(".modal,.modal-produto,.modal-carrinho") ? [raiz] : []),
    ...raiz.querySelectorAll(".modal,.modal-produto,.modal-carrinho"),
  ].forEach((modal) => {
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
  const novos = new Set();
  new MutationObserver((registros) => {
    registros.forEach((r) =>
      r.addedNodes.forEach((n) => {
        if (n.nodeType === 1) novos.add(n);
      }),
    );
    if (!novos.size) return;
    if (pendente) return;
    pendente = true;
    requestAnimationFrame(() => {
      pendente = false;
      const lote = [...novos];
      novos.clear();
      lote
        .filter((n) => n.isConnected && !lote.some((pai) => pai !== n && pai.contains(n)))
        .forEach((n) => padronizarFechamentosUI(n));
    });
  }).observe(document.body, { childList: true, subtree: true });
});
