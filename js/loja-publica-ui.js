/* Fechamento manual do cardápio público. A conta continua disponível. */
"use strict";
let estadoLojaPublicaUI = "carregando";
let pararLojaPublicaUI = null;

function atualizarEstadoLojaPublicaUI(estado) {
  estadoLojaPublicaUI = estado;
  lojaAberta = estado === "aberta";
  document.body.classList.toggle("loja-fechada-ui", !lojaAberta);
  const faixa = document.getElementById("aviso-loja-fechada-ui");
  if (faixa) {
    faixa.hidden = lojaAberta;
    faixa.textContent =
      estado === "fechada"
        ? "Estamos fechados. Novos pedidos estão indisponíveis; sua conta continua acessível."
        : estado === "carregando"
          ? "Conferindo se a loja está aberta…"
          : "Não foi possível conferir a loja. Aguarde a conexão para fazer seu pedido.";
  }
  if (typeof atualizarHorarioFuncionamento === "function") atualizarHorarioFuncionamento();
}

function permitirPedidoLojaUI() {
  if (estadoLojaPublicaUI === "aberta") return true;
  // Um clique repetido não cria uma fila de avisos iguais.
  if (!document.querySelector("dialog.aviso-ui[open]")) {
    const fechada = estadoLojaPublicaUI === "fechada";
    mostrarAvisoUI(
      fechada
        ? "A cozinha está descansando! Volte quando a loja abrir para montar e enviar seu pedido. Você pode acessar sua conta normalmente."
        : estadoLojaPublicaUI === "carregando"
          ? "Estamos conferindo se a loja está aberta. Aguarde um instante."
          : "Não conseguimos confirmar se a loja está aberta. Tente novamente quando a conexão voltar.",
      fechada ? "lojaFechada" : "conferir",
    );
  }
  return false;
}

async function conferirLojaNaTransacaoUI(transacao) {
  const doc = await transacao.get(db.collection("config").doc("loja"));
  if (doc.exists && doc.data().aberta === false) {
    const erro = new Error("A loja fechou antes da confirmação do pedido.");
    erro.code = "LOJA_FECHADA";
    throw erro;
  }
}

async function salvarPedidoLojaAbertaUI(ref, pedido) {
  // A leitura participa da gravação: se o ADM fechar durante o envio,
  // a transação é refeita e não grava o pedido nem consome o cupom.
  await db.runTransaction(async (t) => {
    await conferirLojaNaTransacaoUI(t);
    const registrarUso = await prepararUsoCupomAtomicoOperacao(
      t,
      pedido.cupomDescontoCodigo,
      pedido.clienteId,
      ref.path,
    );
    registrarUso();
    t.set(ref, pedido);
  });
}

function acompanharLojaPublicaUI() {
  if (pararLojaPublicaUI) return;
  pararLojaPublicaUI = db
    .collection("config")
    .doc("loja")
    .onSnapshot(
      (doc) =>
        atualizarEstadoLojaPublicaUI(
          doc.exists && doc.data().aberta === false ? "fechada" : "aberta",
        ),
      () => atualizarEstadoLojaPublicaUI("indisponivel"),
    );
}

document.addEventListener("DOMContentLoaded", () => {
  if (!document.getElementById("tela-inicio")) return;
  const faixa = document.createElement("p");
  faixa.id = "aviso-loja-fechada-ui";
  faixa.setAttribute("role", "status");
  document.querySelector(".abas-navegacao").before(faixa);
  atualizarEstadoLojaPublicaUI("carregando");
  acompanharLojaPublicaUI();
  const areasCompra =
    "#tela-inicio, #tela-finalizar, #busca-produto, .abas-navegacao, .header-loja a, " +
    '.menu-inferior button:not([onclick*="perfil"]), #modal-produto, #modal-carrinho, ' +
    "#modal-molhos, #checkout-entrega-ui, .janela-acrescimos-ui";
  const bloquear = (evento) => {
    if (estadoLojaPublicaUI === "aberta" || ["Escape", "Tab"].includes(evento.key)) return;
    if (
      evento.target.closest?.(
        '.ui-x, .ui-voltar, [aria-label^="Fechar"], button[onclick^="fechar"]',
      )
    )
      return;
    if (!evento.target.closest?.(areasCompra)) return;
    evento.preventDefault();
    evento.stopImmediatePropagation();
    permitirPedidoLojaUI();
  };
  document.addEventListener("click", bloquear, true);
  document.addEventListener("keydown", bloquear, true);
  document.addEventListener("submit", bloquear, true);
  document.addEventListener("beforeinput", bloquear, true);
});
window.addEventListener("pagehide", () => {
  pararLojaPublicaUI?.();
  pararLojaPublicaUI = null;
});
window.addEventListener("pageshow", (evento) => {
  if (evento.persisted) {
    atualizarEstadoLojaPublicaUI("carregando");
    acompanharLojaPublicaUI();
  }
});
