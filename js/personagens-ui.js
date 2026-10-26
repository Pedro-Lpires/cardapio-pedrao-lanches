/* Avisos e acompanhamento da conta no cardápio e no autoatendimento. */
"use strict";
const personagensPedraoUI = {
  acrescimos: { arte: "mago-aviso", titulo: "Opa, um de cada vez!", busto: true },
  codigo: { arte: "mago-sobrancelha", titulo: "Aí não, sacana!" },
  codigoLogin: { arte: "mago-pensando", titulo: "Só um detalhe...", busto: true },
  codigoNaoEncontrado: { arte: "mago-pensando", titulo: "Vamos conferir o CDA?", busto: true },
  boasVindas: { arte: "mago-acenando", titulo: "Chega mais!", busto: true },
  ajudaCda: { arte: "mago-piscando", titulo: "Bora liberar seu CDA?" },
  ativar: { arte: "mago-comemorando", titulo: "Bora ativar seus benefícios?", festa: true },
  ativado: { arte: "mago-comemorando", titulo: "Aí sim, CDA ativado!", festa: true },
  acordo: { arte: "mago-desculpas", titulo: "O acordo precisa ser cumprido.", busto: true },
  nivel: { arte: "mago-novo-nivel", titulo: "Você subiu de rank!", busto: true, festa: true },
  pressa: { arte: "mago-intrigado", titulo: "Tá com pressa?" },
  solicitacao: { arte: "mago-brincalhao", titulo: "Um chamado de cada vez!", busto: true },
  cupom: { arte: "mago-surpreso", titulo: "Tem cupom pra você!" },
  raspadinha: { arte: "mago-pedido-confirmado", titulo: "Chegou coisa boa pra você!" },
  premio: { arte: "mago-comemorando", titulo: "Olha o seu prêmio!", festa: true },
  mensagem: { arte: "mago-tranquilo", titulo: "Pedrão Lanches" },
  sucesso: { arte: "mago-joinha", titulo: "Tudo certo!", busto: true },
  vazio: { arte: "mago-pensando", titulo: "Bora escolher seu lanche?", busto: true },
  conferir: { arte: "mago-pensando", titulo: "Falta só um detalhe.", busto: true },
  falha: { arte: "mago-desculpas", titulo: "Opa, deu uma falha.", busto: true },
  localizacao: { arte: "mago-pensando", titulo: "Vamos calcular sua entrega?", busto: true },
  chamado: { arte: "mago-joinha", titulo: "Chamado enviado!", busto: true },
  pedido: { arte: "mago-pedido-confirmado", titulo: "Pedido na chapa!" },
  lojaFechada: { arte: "mago-saboreando", titulo: "Estamos fechados agora." },
};
function imagemPersonagemPedraoUI(tipo) {
  const personagem = personagensPedraoUI[tipo];
  return personagem ? `images/personagens-pedrao/ui/${personagem.arte}.webp` : "";
}
// Prepara apenas os avisos mais frequentes quando o navegador estiver ocioso.
if (typeof window !== "undefined" && typeof Image !== "undefined") {
  const preparar = () => {
    for (const tipo of ["boasVindas", "acrescimos", "codigoLogin"]) {
      const imagem = new Image();
      imagem.decoding = "async";
      imagem.src = imagemPersonagemPedraoUI(tipo);
    }
  };
  if (window.requestIdleCallback) window.requestIdleCallback(preparar, { timeout: 3000 });
  else window.setTimeout(preparar, 1500);
}
function personagemAvisoPedraoUI(aviso) {
  const texto = String(aviso.mensagem || "");
  let tipo = "";
  if (Object.hasOwn(personagensPedraoUI, aviso.personagem)) tipo = aviso.personagem;
  else if (aviso.boasVindas) tipo = "boasVindas";
  else if (aviso.informativo) tipo = "ajudaCda";
  else if (aviso.localizacao) tipo = "localizacao";
  else if (/adicionais|acr[eé]scimos/i.test(texto) && /unidade|quantidade|vez/i.test(texto))
    tipo = "acrescimos";
  else if (/código (?:de ativação )?não encontrado|código inválido/i.test(texto))
    tipo = "codigoNaoEncontrado";
  else if (/código ativado/i.test(texto)) tipo = "ativado";
  else if (/atendente chamado|conta solicitada/i.test(texto)) tipo = "chamado";
  else if (/carrinho.*vazio|pedido.*vazio/i.test(texto)) tipo = "vazio";
  else if (/não foi possível|não conseguimos|indisponível|esgotado|falha|erro/i.test(texto))
    tipo = "falha";
  else if (/^(informe|digite|preencha|escolha|por favor,? (?:informe|selecione))/i.test(texto))
    tipo = "conferir";
  else if (/salvo com sucesso|perfil atualizado/i.test(texto)) tipo = "sucesso";
  if (!tipo) return null;
  return { ...personagensPedraoUI[tipo], tipo, imagem: imagemPersonagemPedraoUI(tipo) };
}
function decorarAvisoPersonagemPedraoUI(dialogo, aviso) {
  const personagem = personagemAvisoPedraoUI(aviso);
  if (!personagem) return;
  const imagem = document.createElement("img");
  imagem.className = "aviso-personagem-ui";
  imagem.src = personagem.imagem;
  imagem.alt = "";
  imagem.width = 140;
  imagem.height = 132;
  imagem.decoding = "async";
  imagem.fetchPriority = "high";
  imagem.onerror = () => {
    imagem.hidden = true;
  };
  const titulo = document.createElement("h2");
  titulo.id = "aviso-personagem-titulo-ui";
  titulo.textContent = personagem.titulo;
  const retrato = document.createElement("div");
  retrato.className = "aviso-personagem-retrato-ui";
  retrato.dataset.enquadramento = personagem.busto ? "busto" : "rosto";
  retrato.append(imagem);
  if (personagem.tipo === "acordo") {
    for (const lado of ["esquerda", "direita"]) {
      const fogo = document.createElement("span");
      fogo.className = "aviso-fogo-ui aviso-fogo-" + lado + "-ui";
      fogo.setAttribute("aria-hidden", "true");
      const lingua = document.createElement("span");
      lingua.className = "fogo-lingua-ui";
      fogo.append(lingua);
      for (let i = 0; i < 6; i++) {
        const faisca = document.createElement("span");
        faisca.className = "fogo-faisca-ui fogo-faisca-" + i + "-ui";
        fogo.append(faisca);
      }
      retrato.append(fogo);
    }
  }
  const balao = document.createElement("div");
  balao.className = "aviso-fala-ui";
  const mensagem = dialogo.querySelector("p");
  mensagem.before(retrato, balao);
  balao.append(titulo, mensagem);
  dialogo.querySelector(".aviso-ui-icone").hidden = true;
  dialogo.classList.add("aviso-ui-com-personagem");
  dialogo.dataset.personagem = personagem.tipo;
  if (personagem.festa) dialogo.classList.add("aviso-personagem-festa-ui");
  dialogo.setAttribute("aria-labelledby", titulo.id);
}

function mostrarAtivacaoCdaPedraoUI() {
  alert("Parabéns! Agora você possui os benefícios do sistema!", "ativado");
  // A fila mostra este lembrete depois que o cliente fecha a comemoração.
  alert(
    "Do mesmo modo que te dei os benefícios, também posso retirá-los. Cumpra o nosso acordo feito pelo WhatsApp. Se descumprir, os benefícios serão retirados.",
    "acordo",
  );
}

function htmlPersonagemRecompensaPedraoUI(tipo, mensagem = "", titulo = "") {
  const personagem = personagensPedraoUI[tipo];
  if (!personagem) return "";
  const seguro = (texto) =>
    String(texto).replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  return `<div class="personagem-recompensa-ui"><img src="${imagemPersonagemPedraoUI(tipo)}" alt="" width="72" height="72"><div class="recompensa-fala-ui"><strong>${seguro(titulo || personagem.titulo)}</strong>${mensagem ? `<p>${seguro(mensagem)}</p>` : ""}</div></div>`;
}

// Um acompanhamento por conta; o serviço de fidelidade corrige apenas o nível inicial ausente.
let contaBeneficiosPedraoUI = "";
let pararBeneficiosPedraoUI = null;
function encerrarBeneficiosPedraoUI() {
  pararBeneficiosPedraoUI?.();
  pararBeneficiosPedraoUI = null;
  contaBeneficiosPedraoUI = "";
}
function acompanharBeneficiosClientePedraoUI(cliente, aoAtualizar) {
  const id = String(cliente?.telefone || "");
  if (!id || contaBeneficiosPedraoUI === id) return;
  const ref = db.collection("clientes").doc(id);
  if (typeof ref.onSnapshot !== "function") return;
  encerrarBeneficiosPedraoUI();
  contaBeneficiosPedraoUI = id;
  const niveis = ["Sem nível", "Bronze", "Prata", "Ouro", "Diamante", "Imortal"];
  const ordem = (nivel) => niveis.indexOf(nivel === "Lenda" ? "Imortal" : nivel || "Sem nível");
  const chave = "pedrao-nivel-visto:" + id;
  let maiorNivel = Math.max(0, ordem(cliente.nivelCliente));
  try {
    const salvo = localStorage.getItem(chave);
    if (salvo !== null && ordem(salvo) >= 0) maiorNivel = ordem(salvo);
  } catch {}
  pararBeneficiosPedraoUI = ref.onSnapshot(
    (doc) => {
      if (contaBeneficiosPedraoUI !== id || !doc.exists) return;
      const atual = doc.data();
      if (
        atual.fidelidadeAtiva &&
        (!atual.nivelCliente || ["Sem nível", "Lenda"].includes(atual.nivelCliente)) &&
        typeof garantirNivelFidelidadeOperacao === "function"
      )
        garantirNivelFidelidadeOperacao(id).catch(console.error);
      const novo = ordem(atual.nivelCliente);
      if (!atual.fidelidadeAtiva && novo >= 0) maiorNivel = Math.max(maiorNivel, novo);
      if (atual.fidelidadeAtiva && novo >= 0) {
        if (novo > maiorNivel && maiorNivel >= 1)
          alert(
            `Parabéns! Você chegou ao rank ${niveis[novo]}! Continue assim: vem mais benefício por aí!`,
            "nivel",
          );
        maiorNivel = Math.max(maiorNivel, novo);
        try {
          localStorage.setItem(chave, niveis[maiorNivel]);
        } catch {}
      }
      aoAtualizar?.({ ...atual, telefone: id });
    },
    (erro) => {
      if (contaBeneficiosPedraoUI !== id) return;
      console.error("Não foi possível acompanhar o nível do cliente:", erro);
      encerrarBeneficiosPedraoUI();
    },
  );
}
