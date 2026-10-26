/* O mesmo listener dos chamados alimenta o som; não abre consultas adicionais. */
const toquesChamadosUI = {
  campainha: {
    nome: "Campainha",
    descricao: "Ding-dong com som de sino.",
    notas: [880, 659.25],
    conta: [880, 659.25, 1046.5],
    passo: 0.38,
    duracao: 0.8,
    parciais: [
      [1, 1],
      [2.01, 0.3],
      [3, 0.12],
    ],
    volume: 0.2,
  },
  gotas: {
    nome: "Gotas",
    descricao: "Toques curtos, suaves e arredondados.",
    notas: [523.25, 659.25, 783.99],
    conta: [523.25, 659.25, 783.99, 1046.5],
    passo: 0.18,
    duracao: 0.24,
    parciais: [[1, 1]],
    volume: 0.25,
    deslizar: true,
  },
  cristal: {
    nome: "Cristal",
    descricao: "Notas brilhantes em sequência.",
    notas: [783.99, 987.77, 1174.66],
    conta: [783.99, 987.77, 1174.66, 1567.98],
    passo: 0.19,
    duracao: 0.52,
    parciais: [
      [1, 1],
      [2, 0.2],
    ],
    volume: 0.2,
  },
};
const chaveToqueChamadosUI = "pedrao-toque-chamados";
function lerToqueChamadosUI() {
  try {
    const salvo = localStorage.getItem(chaveToqueChamadosUI);
    if (Object.hasOwn(toquesChamadosUI, salvo)) return salvo;
  } catch {}
  return "campainha";
}
const somChamadosAtendenteUI = {
  contexto: null,
  ligado: false,
  iniciando: false,
  recebeuSnapshot: false,
  vistos: new Set(),
  jornada: null,
  titulo: document.title,
  conexao: null,
  fim: 0,
  toque: lerToqueChamadosUI(),
  ultimo: "Nenhum chamado novo nesta sessão.",
  erro: "",
  nos: new Set(),
};

function atualizarControleSomChamadosUI() {
  const botao = document.getElementById("btn-som-chamados");
  const status = document.getElementById("estado-som-chamados");
  const ativo =
    somChamadosAtendenteUI.ligado && somChamadosAtendenteUI.contexto?.state === "running";
  if (botao) {
    const rotulo = ativo ? "Silenciar chamados" : "Ativar som dos chamados";
    botao.setAttribute("aria-label", rotulo);
    botao.setAttribute("title", rotulo);
    botao.setAttribute("aria-pressed", String(ativo));
    botao.disabled = somChamadosAtendenteUI.iniciando;
  }
  document.querySelectorAll?.("[data-ouvir-toque]").forEach((b) => {
    b.disabled = somChamadosAtendenteUI.iniciando;
  });
  if (status)
    status.textContent =
      somChamadosAtendenteUI.conexao === false
        ? "Conexão com os chamados interrompida. Recarregue o painel."
        : somChamadosAtendenteUI.erro ||
          (somChamadosAtendenteUI.iniciando
            ? "Liberando o áudio…"
            : ativo
              ? "Som ligado para chamar atendente e pedir a conta."
              : somChamadosAtendenteUI.ligado
                ? "O navegador pausou o áudio. Toque no sino para reativar."
                : document.getElementById("confirmar-som-chamados")
                  ? ""
                  : "Som desligado. Clique no sino do título para ativar.");
}

function tocarSomChamadoAtendenteUI(
  tipo = "atendente",
  toque = somChamadosAtendenteUI.toque,
  previa = false,
) {
  const estado = somChamadosAtendenteUI;
  const contexto = estado.contexto;
  if ((!estado.ligado && !previa) || contexto?.state !== "running") {
    atualizarControleSomChamadosUI();
    return false;
  }
  try {
    const perfil = toquesChamadosUI[toque] || toquesChamadosUI.campainha;
    const notas = tipo === "conta" ? perfil.conta : perfil.notas;
    const inicio = Math.max(contexto.currentTime + 0.025, estado.fim);
    notas.forEach((frequencia, i) => {
      const tempo = inicio + i * perfil.passo;
      for (const [multiplicador, intensidade] of perfil.parciais) {
        const oscilador = contexto.createOscillator();
        const volume = contexto.createGain();
        oscilador.type = "sine";
        oscilador.frequency.setValueAtTime(
          frequencia * multiplicador * (perfil.deslizar ? 1.35 : 1),
          tempo,
        );
        if (perfil.deslizar)
          oscilador.frequency.exponentialRampToValueAtTime(
            frequencia * multiplicador,
            tempo + 0.06,
          );
        volume.gain.setValueAtTime(0, tempo);
        volume.gain.linearRampToValueAtTime(perfil.volume * intensidade, tempo + 0.008);
        volume.gain.exponentialRampToValueAtTime(0.0001, tempo + perfil.duracao);
        oscilador.connect(volume);
        volume.connect(contexto.destination);
        estado.nos.add(oscilador);
        oscilador.onended = () => {
          estado.nos.delete(oscilador);
          oscilador.disconnect();
          volume.disconnect();
        };
        oscilador.start(tempo);
        oscilador.stop(tempo + perfil.duracao + 0.02);
      }
    });
    estado.fim = inicio + (notas.length - 1) * perfil.passo + perfil.duracao + 0.03;
    return true;
  } catch (erro) {
    console.error("Não foi possível tocar o chamado:", erro);
    estado.ligado = false;
    atualizarControleSomChamadosUI();
    return false;
  }
}
function interromperToqueChamadosUI() {
  for (const no of somChamadosAtendenteUI.nos) {
    try {
      no.stop();
    } catch {}
  }
  somChamadosAtendenteUI.nos.clear();
  somChamadosAtendenteUI.fim = 0;
}
async function prepararContextoSomChamadosUI() {
  const estado = somChamadosAtendenteUI;
  const Audio = window.AudioContext || window.webkitAudioContext;
  if (!Audio) throw Error("Este navegador não oferece áudio para os chamados.");
  if (!estado.contexto || estado.contexto.state === "closed") {
    estado.contexto = new Audio();
    estado.fim = 0;
    estado.contexto.onstatechange = atualizarControleSomChamadosUI;
  }
  if (estado.contexto.state !== "running") await estado.contexto.resume();
  if (estado.contexto.state !== "running")
    throw Error("O navegador pausou o som. Clique no sino novamente.");
}

async function ativarSomChamadosAtendenteUI(testar = true) {
  const estado = somChamadosAtendenteUI;
  if (estado.iniciando) return;
  estado.iniciando = true;
  estado.erro = "";
  atualizarControleSomChamadosUI();
  try {
    await prepararContextoSomChamadosUI();
    estado.ligado = true;
    if (testar) {
      interromperToqueChamadosUI();
      tocarSomChamadoAtendenteUI();
    }
  } catch (erro) {
    estado.ligado = false;
    estado.erro =
      (erro.message || "Não foi possível ativar o som.") +
      " Confira o volume e se o site está autorizado a reproduzir som nas configurações do navegador. Depois, tente novamente.";
  } finally {
    estado.iniciando = false;
    atualizarControleSomChamadosUI();
  }
  return estado.ligado;
}

function alternarSomChamadosAtendenteUI() {
  if (somChamadosAtendenteUI.iniciando) return;
  const silenciar = () => {
    somChamadosAtendenteUI.ligado = false;
    interromperToqueChamadosUI();
    somChamadosAtendenteUI.contexto?.close().catch(console.error);
    somChamadosAtendenteUI.contexto = null;
    somChamadosAtendenteUI.fim = 0;
    somChamadosAtendenteUI.erro = "";
    atualizarControleSomChamadosUI();
  };
  if (somChamadosAtendenteUI.ligado && somChamadosAtendenteUI.contexto?.state === "running") {
    silenciar();
    return;
  }
  return abrirAtivacaoSomChamadosUI();
}

function abrirAtivacaoSomChamadosUI() {
  if (document.querySelector("dialog.som-ativacao-janela-ui")?.open) return;
  const painel = document.createElement("div");
  painel.id = "confirmar-som-chamados";
  painel.className = "som-ativacao-conteudo-ui";
  painel.hidden = true;
  painel.innerHTML = `<p class="som-ativacao-pergunta-ui">Ativar o som neste painel?</p>
    <p>O Sim libera o áudio nesta sessão e toca um teste.</p>
    <p class="som-ativacao-limite-ui">No celular, usar outro app ou apagar a tela pode pausar os avisos. Durante o atendimento, mantenha o painel aberto e a tela ligada.</p>
    <p id="estado-som-chamados" role="status"></p>
    <div class="som-ativacao-acoes-ui"><button type="button" class="som-nao-ui">Não, agora não</button><button type="button" class="som-sim-ui">Sim, ativar</button></div>`;
  document.body.append(painel);
  const janela = abrirJanelaElementoUI(painel, "Ativar avisos sonoros");
  janela.classList.add("som-ativacao-janela-ui");
  janela.setAttribute("aria-label", "Ativar avisos sonoros");
  janela.setAttribute("aria-describedby", "estado-som-chamados");
  const botoes = janela.querySelectorAll("button");
  painel.querySelector(".som-nao-ui").onclick = () => janela.close("cancelar");
  painel.querySelector(".som-sim-ui").onclick = async () => {
    botoes.forEach((b) => (b.disabled = true));
    const ativado = await ativarSomChamadosAtendenteUI();
    botoes.forEach((b) => (b.disabled = false));
    if (ativado && janela.open) janela.close("ativado");
  };
  janela.addEventListener("cancel", (evento) => {
    if (somChamadosAtendenteUI.iniciando) evento.preventDefault();
  });
  janela.addEventListener(
    "close",
    () => {
      painel.remove();
      document.getElementById("btn-som-chamados")?.focus({ preventScroll: true });
    },
    { once: true },
  );
  atualizarControleSomChamadosUI();
}

function processarSomChamadosAtendenteUI(chamados, jornada) {
  const estado = somChamadosAtendenteUI;
  if (estado.conexao !== true) {
    estado.conexao = true;
    atualizarControleSomChamadosUI();
  }
  if (estado.jornada !== jornada) {
    estado.vistos.clear();
    estado.jornada = jornada;
  }
  const novos = [];
  for (const chamado of chamados) {
    const chave = chamado.id + ":" + (chamado.tipo === "conta" ? "conta" : "atendente");
    if (!estado.vistos.has(chave)) {
      estado.vistos.add(chave);
      if (estado.recebeuSnapshot) novos.push(chamado);
    }
  }
  estado.recebeuSnapshot = true;
  document.title = chamados.length
    ? `(${chamados.length} chamado${chamados.length > 1 ? "s" : ""}) ${estado.titulo}`
    : estado.titulo;
  const ultimo = document.getElementById("ultimo-chamado-sonoro");
  if (!chamados.length) estado.ultimo = "Nenhum chamado pendente.";
  if (ultimo) ultimo.textContent = estado.ultimo;
  if (!novos.length) return;
  const recente = [...novos].sort(
    (a, b) => Number(b.criadoEmMs || 0) - Number(a.criadoEmMs || 0),
  )[0];
  estado.ultimo = `${novos.length > 1 ? novos.length + " novos chamados. " : ""}Mesa ${recente.mesaNumero || "-"}: ${recente.tipo === "conta" ? "pediu a conta" : "chamou o atendente"}.`;
  if (ultimo) ultimo.textContent = estado.ultimo;
  // Não depende de document.hidden: a aba minimizada também precisa avisar.
  tocarSomChamadoAtendenteUI(novos.some((c) => c.tipo === "conta") ? "conta" : "atendente");
}

function encerrarSomChamadosAtendenteUI() {
  const estado = somChamadosAtendenteUI;
  estado.ligado = false;
  interromperToqueChamadosUI();
  if (estado.contexto && estado.contexto.state !== "closed")
    estado.contexto.close().catch(console.error);
  estado.contexto = null;
  estado.fim = 0;
  estado.erro = "";
  document.title = estado.titulo;
  atualizarControleSomChamadosUI();
}
function informarFalhaChamadosAtendenteUI() {
  somChamadosAtendenteUI.conexao = false;
  atualizarControleSomChamadosUI();
}

function selecionarToqueChamadosUI(toque) {
  if (!Object.hasOwn(toquesChamadosUI, toque)) return;
  somChamadosAtendenteUI.toque = toque;
  try {
    localStorage.setItem(chaveToqueChamadosUI, toque);
  } catch {}
}
async function ouvirToqueChamadosUI(toque) {
  if (!Object.hasOwn(toquesChamadosUI, toque) || somChamadosAtendenteUI.iniciando) return;
  somChamadosAtendenteUI.iniciando = true;
  atualizarControleSomChamadosUI();
  let falha = "";
  try {
    await prepararContextoSomChamadosUI();
    interromperToqueChamadosUI();
    tocarSomChamadoAtendenteUI("atendente", toque, true);
  } catch (erro) {
    falha = erro.message;
  } finally {
    somChamadosAtendenteUI.iniciando = false;
    atualizarControleSomChamadosUI();
    if (falha) {
      const status = document.getElementById("estado-som-chamados");
      if (status) status.textContent = falha;
    }
  }
}
function abrirConfiguracaoSomChamadosUI() {
  if (document.querySelector("dialog.som-escolha-janela-ui")?.open) return;
  const painel = document.createElement("div");
  painel.id = "config-som-chamados";
  painel.className = "alertas-chamados-ui";
  painel.setAttribute("aria-label", "Som dos chamados");
  painel.innerHTML = `<p id="estado-som-chamados" role="status"></p><div class="toques-chamados-ui" role="radiogroup" aria-label="Tipo de som">${Object.entries(
    toquesChamadosUI,
  )
    .map(
      ([id, som]) =>
        `<div class="toque-chamado-ui"><label><input type="radio" name="toque-chamado" value="${id}" ${somChamadosAtendenteUI.toque === id ? "checked" : ""} onchange="selecionarToqueChamadosUI('${id}')"><span><strong>${som.nome}</strong><small>${som.descricao}</small></span></label><button type="button" data-ouvir-toque="${id}" aria-label="Ouvir ${som.nome}" onclick="ouvirToqueChamadosUI('${id}')">▶ Ouvir</button></div>`,
    )
    .join(
      "",
    )}</div><small>Escolher ou ouvir não ativa os avisos. Para ativar, feche esta janela e clique no sino do título.</small><p id="ultimo-chamado-sonoro" role="status"></p><button type="button" class="som-concluir-ui" onclick="this.closest('dialog').close('aplicar')">Concluir</button>`;
  painel.hidden = true;
  document.body.append(painel);
  const janela = abrirJanelaElementoUI(painel, "Toque dos chamados");
  janela.classList.add("som-escolha-janela-ui");
  janela.setAttribute("aria-label", "Escolher toque dos chamados");
  janela.addEventListener(
    "close",
    () => {
      painel.remove();
      if (!somChamadosAtendenteUI.ligado) interromperToqueChamadosUI();
      document.getElementById("abrir-config-som-chamados")?.focus({ preventScroll: true });
    },
    { once: true },
  );
  painel.querySelector("#ultimo-chamado-sonoro").textContent = somChamadosAtendenteUI.ultimo;
  atualizarControleSomChamadosUI();
}
function montarConfiguracaoSomChamadosUI(area) {
  area.querySelector("#config-som-chamados-atalho")?.remove();
  const atalho = document.createElement("div");
  atalho.id = "config-som-chamados-atalho";
  atalho.innerHTML =
    '<button type="button" id="abrir-config-som-chamados" onclick="abrirConfiguracaoSomChamadosUI()">Escolher toque</button>';
  const titulo = area.querySelector("h3");
  if (titulo) titulo.after(atalho);
  else area.prepend(atalho);
}
window.addEventListener("pagehide", encerrarSomChamadosAtendenteUI);
