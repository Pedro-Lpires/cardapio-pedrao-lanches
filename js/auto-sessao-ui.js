/* Retoma somente a sessão que este aparelho criou para esta mesa. */
let observadoresSessaoAutoUI = [];

async function recuperarContaSalvaAutoUI() {
  if (typeof acessoClienteSenhaUI !== "undefined") {
    try {
      if (await window.acessoClienteSenhaUI.ativo())
        return await window.acessoClienteSenhaUI.restaurar();
    } catch {
      return null;
    }
  }
  let salvo;
  try {
    const texto = window.localStorage.getItem("clientePedrao");
    if (!texto) return null;
    salvo = JSON.parse(texto);
  } catch {
    return null;
  }
  const telefone = String(salvo?.telefone || "").replace(/\D/g, "");
  const nomeSalvo = String(salvo?.nome || "")
    .trim()
    .toLowerCase();
  if (telefone.length !== 11 || !nomeSalvo) return null;
  try {
    const doc = await db.collection("clientes").doc(telefone).get();
    if (!doc.exists) return null;
    const cliente = doc.data();
    if (
      String(cliente.nome || "")
        .trim()
        .toLowerCase() !== nomeSalvo
    )
      return null;
    // A conta é do aparelho; a sessão e a comanda continuam sendo de cada mesa.
    return { ...cliente, telefone };
  } catch (erro) {
    console.warn("Não foi possível recuperar a conta salva:", erro);
    return null;
  }
}

function armazenamentosSessaoAutoUI() {
  const opcoes = [];
  for (const nome of ["localStorage", "sessionStorage"]) {
    try {
      if (window[nome]) opcoes.push(window[nome]);
    } catch {}
  }
  return opcoes;
}
function chaveSessaoMesaAutoUI() {
  return CHAVE_SESSAO_AUTOATENDIMENTO + ":" + mesaAutoatendimentoId;
}
function lerIdentificacaoSessaoAutoUI() {
  for (const chave of [chaveSessaoMesaAutoUI(), CHAVE_SESSAO_AUTOATENDIMENTO])
    for (const storage of armazenamentosSessaoAutoUI()) {
      try {
        const id = storage.getItem(chave);
        if (id) return id;
      } catch {}
    }
  return null;
}
function salvarIdentificacaoSessaoAutoUI(id) {
  for (const storage of armazenamentosSessaoAutoUI()) {
    try {
      storage.setItem(chaveSessaoMesaAutoUI(), id);
      storage.setItem(CHAVE_SESSAO_AUTOATENDIMENTO, id);
    } catch {}
  }
}
function apagarIdentificacaoSessaoAutoUI(id) {
  for (const storage of armazenamentosSessaoAutoUI())
    for (const chave of [chaveSessaoMesaAutoUI(), CHAVE_SESSAO_AUTOATENDIMENTO]) {
      try {
        if (storage.getItem(chave) === id) storage.removeItem(chave);
      } catch {}
    }
}
function pararAcompanhamentoSessaoAutoUI() {
  const parar = observadoresSessaoAutoUI;
  observadoresSessaoAutoUI = [];
  parar.forEach((fn) => fn());
}
function mostrarAtendimentoEncerradoAutoUI() {
  if (typeof mesaProtegidaUI !== "undefined")
    mesaProtegidaUI.apagar(mesaAutoatendimentoAtual?.numero);
  if (typeof appVisitaMesaProtegidaUI !== "undefined" && appVisitaMesaProtegidaUI)
    appVisitaMesaProtegidaUI
      .auth()
      .signOut()
      .catch(() => {});
  pararAcompanhamentoSessaoAutoUI();
  const id = sessaoAutoatendimentoAtual?.id;
  if (id) apagarIdentificacaoSessaoAutoUI(id);
  sessaoAutoatendimentoAtual = null;
  carrinhoAutoatendimento = [];
  // A aba encerrada deixa de carregar o número da mesa ao atualizar.
  try {
    const url = new URL(window.location.href);
    url.searchParams.delete("mesa");
    window.history.replaceState(null, "", url.href);
  } catch {}
  const area = document.getElementById("area-autoatendimento");
  if (area)
    area.innerHTML =
      '<section class="auto-atendimento-encerrado-ui"><h2>Atendimento encerrado</h2><p>Esta comanda foi encerrada. Para começar um novo atendimento, escaneie o QR Code da mesa novamente.</p></section>';
}
async function recuperarSessaoDaMesaAutoUI() {
  if (typeof mesaProtegidaUI !== "undefined" && (await mesaProtegidaUI.ativo())) {
    const r = await mesaProtegidaUI.retomar(mesaAutoatendimentoAtual.numero);
    return r.sessaoEncerrada ? { sessaoEncerrada: true } : r.sessao;
  }
  const id = lerIdentificacaoSessaoAutoUI();
  if (!id) return null;
  const doc = await db.collection("sessoesMesa").doc(id).get();
  const sessao = doc.exists ? doc.data() : null;
  if (sessao && sessao.mesaId !== mesaAutoatendimentoId) return null;
  const encerrar = async (motivo) => {
    apagarIdentificacaoSessaoAutoUI(id);
    if (sessao?.status === "ativa") {
      try {
        await doc.ref.update({
          status: "encerrada",
          motivoEncerramento: motivo,
          encerradaEm: new Date().toISOString(),
          encerradaEmMs: Date.now(),
        });
      } catch (erro) {
        console.error("Não foi possível atualizar a sessão encerrada:", erro);
      }
    }
    return { sessaoEncerrada: true };
  };
  if (!sessao || sessao.status !== "ativa") return encerrar("sessao_inativa");
  if (sessao.pedidoEnviado) {
    if (!sessao.comandaId) return encerrar("comanda_inexistente");
    const [comanda, mesa] = await Promise.all([
      db.collection("comandas").doc(sessao.comandaId).get(),
      db.collection("mesas").doc(mesaAutoatendimentoId).get(),
    ]);
    if (!comanda.exists || comanda.data().status !== "Aberta")
      return encerrar("comanda_finalizada");
    if (comanda.data().sessaoAutoatendimentoId && comanda.data().sessaoAutoatendimentoId !== id)
      return encerrar("comanda_de_outra_sessao");
    if (!mesa.exists || mesa.data().ocupada !== true) return encerrar("mesa_liberada");
  } else {
    const janela = obterJanelaDiaOperacional();
    const criado = Number(sessao.criadoEmMs || 0);
    if (criado < janela.inicioMs || criado >= janela.fimMs) return encerrar("fim_dia_operacional");
  }
  salvarIdentificacaoSessaoAutoUI(id);
  return { ...sessao, id: doc.id };
}
function acompanharSessaoEnviadaAutoUI() {
  pararAcompanhamentoSessaoAutoUI();
  const sessao = sessaoAutoatendimentoAtual;
  if (!sessao?.pedidoEnviado || !sessao.comandaId) return;
  for (const [colecao, id, valido] of [
    [
      "comandas",
      sessao.comandaId,
      (d) =>
        d.status === "Aberta" &&
        (!d.sessaoAutoatendimentoId || d.sessaoAutoatendimentoId === sessao.id),
    ],
    ["mesas", sessao.mesaId || mesaAutoatendimentoId, (d) => d.ocupada === true],
  ]) {
    const ref = (typeof bancoVisitaMesaUI === "function" ? bancoVisitaMesaUI() : db)
      .collection(colecao)
      .doc(id);
    if (typeof ref.onSnapshot !== "function") continue;
    observadoresSessaoAutoUI.push(
      ref.onSnapshot(
        (doc) => {
          if (sessaoAutoatendimentoAtual?.id !== sessao.id) return;
          if (!doc.exists || !valido(doc.data())) mostrarAtendimentoEncerradoAutoUI();
        },
        (erro) => {
          if (
            typeof mesaProtegidaUI !== "undefined" &&
            sessao.sessaoProtegida === 1 &&
            String(erro.code || "").includes("permission-denied")
          )
            mostrarAtendimentoEncerradoAutoUI();
          else console.error("Não foi possível acompanhar o atendimento:", erro);
        },
      ),
    );
  }
}
async function validarAcaoSessaoEnviadaAutoUI() {
  try {
    const atual = await recuperarSessaoDaMesaAutoUI();
    if (atual?.sessaoEncerrada) {
      mostrarAtendimentoEncerradoAutoUI();
      return false;
    }
    if (!atual?.pedidoEnviado || atual.id !== sessaoAutoatendimentoAtual?.id) {
      mostrarAtendimentoEncerradoAutoUI();
      return false;
    }
    sessaoAutoatendimentoAtual = { ...sessaoAutoatendimentoAtual, ...atual };
    return true;
  } catch {
    alert("Não foi possível conferir seu atendimento. Verifique a conexão e tente novamente.");
    return false;
  }
}
window.addEventListener("pagehide", pararAcompanhamentoSessaoAutoUI);
window.addEventListener("pageshow", () => {
  if (
    typeof sessaoAutoatendimentoAtual !== "undefined" &&
    sessaoAutoatendimentoAtual?.pedidoEnviado
  )
    acompanharSessaoEnviadaAutoUI();
});
