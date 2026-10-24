/* Contadores da conta: uma assinatura por consulta, encerrada ao trocar de cliente. */
let contadorClienteUI = "",
  versaoContadorClienteUI = 0,
  falhaContadorClienteUI = false;
let paradasContadorClienteUI = [];
function encerrarContadorClienteUI() {
  versaoContadorClienteUI++;
  paradasContadorClienteUI.forEach((parar) => parar());
  paradasContadorClienteUI = [];
  contadorClienteUI = "";
}
function acompanharContadorClienteUI() {
  const id = clienteLogado?.telefone;
  if (!id || !document.getElementById("badge-geral")) return false;
  if (contadorClienteUI === id) return !falhaContadorClienteUI;
  const ref = db.collection("clientes").doc(id);
  const consulta = ref
    .collection("mensagens")
    .where("lida", "==", false)
    .where("remetente", "==", "admin");
  if (typeof consulta.onSnapshot !== "function") return false;
  encerrarContadorClienteUI();
  contadorClienteUI = id;
  falhaContadorClienteUI = false;
  const versao = versaoContadorClienteUI;
  const atual = () => versao === versaoContadorClienteUI && clienteLogado?.telefone === id;
  let geral = 0,
    admin = 0,
    primeiras = true,
    mensagensAnteriores = new Set();
  const suportes = new Map();
  paradasContadorClienteUI.push(() => {
    suportes.forEach((c) => c.parar?.());
    suportes.clear();
  });
  function renderizar() {
    if (!atual()) return;
    const suporte = [...suportes.values()].reduce((s, c) => s + c.total, 0);
    for (const [tipo, total] of [
      ["geral", geral],
      ["admin", admin],
      ["suporte", suporte],
    ]) {
      const badge = document.getElementById("badge-" + tipo);
      if (badge) badge.innerText = total || "";
    }
    const botao = document.querySelector(".btn-mensagens-perfil");
    const total = geral + admin + suporte;
    if (botao)
      botao.innerHTML = total ? `Mensagens <span class="badge-msg">${total}</span>` : "Mensagens";
  }
  function falhou(erro) {
    if (!atual()) return;
    falhaContadorClienteUI = true;
    paradasContadorClienteUI.forEach((parar) => parar());
    paradasContadorClienteUI = [];
    console.error("Contador de mensagens em tempo real:", erro);
    buscarContadorMensagensUI().catch(console.error);
  }
  paradasContadorClienteUI.push(
    consulta.onSnapshot((snap) => {
      if (!atual()) return;
      geral = 0;
      admin = 0;
      const ids = new Set();
      let nova = false;
      snap.docs.forEach((doc) => {
        ids.add(doc.id);
        if (!mensagensAnteriores.has(doc.id)) nova = true;
        const m = doc.data();
        if (m.tipo === "geral") geral++;
        if (m.tipo === "admin") admin++;
      });
      const atualizarLista = !primeiras && nova;
      primeiras = false;
      mensagensAnteriores = ids;
      renderizar();
      if (
        atualizarLista &&
        document.getElementById("modal-mensagens")?.style.display === "flex" &&
        abaMensagemAtual !== "suporte"
      )
        abrirAbaMensagens(abaMensagemAtual).catch(console.error);
    }, falhou),
  );
  paradasContadorClienteUI.push(
    ref
      .collection("chamados")
      .where("status", "==", "aberto")
      .onSnapshot((snap) => {
        if (!atual()) return;
        const ids = new Set(snap.docs.map((d) => d.id));
        for (const [idChamado, c] of suportes)
          if (!ids.has(idChamado)) {
            c.parar?.();
            suportes.delete(idChamado);
          }
        for (const doc of snap.docs) {
          if (suportes.has(doc.id)) continue;
          const c = { total: 0, parar: null };
          suportes.set(doc.id, c);
          c.parar = doc.ref
            .collection("mensagens")
            .where("lida", "==", false)
            .where("remetente", "==", "admin")
            .onSnapshot((respostas) => {
              if (!atual() || !suportes.has(doc.id)) return;
              c.total = respostas.size;
              renderizar();
            }, falhou);
        }
        renderizar();
      }, falhou),
  );
  return true;
}
