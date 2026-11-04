/* A conta lembrada e a credencial da visita são independentes. */
function criarMesaProtegidaUI({
  authCliente,
  autenticarVisita,
  fetchHttp = fetch,
  storage,
  ativo,
  aleatorio = () => crypto.getRandomValues(new Uint8Array(32)),
}) {
  const memoria = new Map(),
    chave = (n) => "pedrao-visita-v1:" + n;
  function segredo(n, criar = false) {
    let v = memoria.get(n);
    if (!v) {
      try {
        v = storage?.getItem(chave(n));
      } catch {}
    }
    if (!/^[a-f0-9]{64}$/.test(v || "")) v = null;
    if (!v && criar) v = Array.from(aleatorio(), (b) => b.toString(16).padStart(2, "0")).join("");
    if (v) {
      memoria.set(n, v);
      try {
        storage?.setItem(chave(n), v);
      } catch {}
    }
    return v;
  }
  async function usuarioAtual() {
    if (authCliente.currentUser) return authCliente.currentUser;
    return new Promise((resolve, reject) => {
      let parar;
      parar = authCliente.onAuthStateChanged((u) => {
        parar?.();
        resolve(u);
      }, reject);
    });
  }
  async function chamar(acao, n, extras = {}, comSegredo = true) {
    if (!(await ativo())) throw Error("O atendimento protegido ainda está em configuração.");
    const usuario = await usuarioAtual();
    const r = await fetchHttp("/api/mesa-publica", {
      method: "POST",
      cache: "no-store",
      credentials: "omit",
      referrerPolicy: "no-referrer",
      headers: {
        "Content-Type": "application/json",
        ...(usuario ? { Authorization: "Bearer " + (await usuario.getIdToken(true)) } : {}),
      },
      body: JSON.stringify({
        acao,
        mesa: n,
        ...(comSegredo ? { segredo: segredo(n) } : {}),
        ...extras,
      }),
    });
    const d = await r.json();
    if (!r.ok)
      throw Object.assign(Error(d.erro || "Não foi possível conferir o atendimento."), {
        status: r.status,
      });
    if (d.token) await autenticarVisita(d.token, d.visitaUid);
    return d;
  }
  return {
    ativo,
    estado: (n) => chamar("estado", n, {}, false),
    retomar: (n) => (segredo(n) ? chamar("retomar", n) : Promise.resolve({ sessao: null })),
    iniciar(n, nome) {
      segredo(n, true);
      return chamar("iniciar", n, { nome });
    },
    enviar: (n, itens, valorTotalEsperado) => chamar("enviar", n, { itens, valorTotalEsperado }),
    vincular: (n, sair = false) => chamar("vincular", n, { sair }),
    solicitar: (n, tipo, semVisita = false) => chamar("chamar", n, { tipo }, !semVisita),
    apagar(n) {
      memoria.delete(n);
      try {
        storage?.removeItem(chave(n));
      } catch {}
    },
  };
}
let appVisitaMesaProtegidaUI = null;
function bancoVisitaMesaUI() {
  return appVisitaMesaProtegidaUI ? appVisitaMesaProtegidaUI.firestore() : db;
}
async function iniciarMesaProtegidaUI(numero) {
  const dados = await mesaProtegidaUI.estado(numero);
  mesaAutoatendimentoAtual = dados.mesa;
  mesaAutoatendimentoId = dados.mesa.id;
  const anterior = await mesaProtegidaUI.retomar(numero);
  if (anterior.sessaoEncerrada) return mostrarAtendimentoEncerradoAutoUI();
  if (anterior.sessao) {
    sessaoAutoatendimentoAtual = anterior.sessao;
    salvarIdentificacaoSessaoAutoUI(anterior.sessao.id);
    return mostrarSessaoAutoatendimento();
  }
  if (dados.mesa.ocupada) return mostrarMesaBloqueadaAutoatendimento();
  const cliente = await recuperarContaSalvaAutoUI();
  if (cliente && !cliente.precisaCriarSenha) return criarSessaoMesaProtegidaUI(cliente.nome);
  mostrarIdentificacaoAutoatendimento();
}
async function criarSessaoMesaProtegidaUI(nome) {
  try {
    const r = await mesaProtegidaUI.iniciar(mesaAutoatendimentoAtual.numero, nome);
    if (r.sessaoEncerrada) return mostrarAtendimentoEncerradoAutoUI();
    sessaoAutoatendimentoAtual = r.sessao;
    salvarIdentificacaoSessaoAutoUI(r.sessao.id);
    await mostrarSessaoAutoatendimento();
  } catch (e) {
    mostrarAvisoUI(e.message, "conferir");
  }
}
let enviandoMesaProtegidaUI = false;
async function enviarMesaProtegidaUI() {
  if (enviandoMesaProtegidaUI || !sessaoAutoatendimentoAtual || !carrinhoAutoatendimento.length)
    return;
  if (!(await confirmarOperacao("Enviar pedido ao chapeiro?"))) return;
  enviandoMesaProtegidaUI = true;
  const b = document.querySelector(
    '#modal-resumo-auto button[onclick*="confirmarEnvioPedidoAuto"]',
  );
  if (b) b.disabled = true;
  try {
    const r = await mesaProtegidaUI.enviar(
      mesaAutoatendimentoAtual.numero,
      carrinhoAutoatendimento,
      carrinhoAutoatendimento.reduce((s, i) => s + Number(i.subtotal || 0), 0),
    );
    sessaoAutoatendimentoAtual = r.sessao;
    carrinhoAutoatendimento = [];
    atualizarCarrinhoAuto();
    fecharResumoPedidoAuto();
    mostrarPosPedidoAutoatendimento();
  } catch (e) {
    if (e.status === 410) mostrarAtendimentoEncerradoAutoUI();
    mostrarAvisoUI(e.message, "conferir");
  } finally {
    enviandoMesaProtegidaUI = false;
    if (b) b.disabled = false;
  }
}
async function solicitarMesaProtegidaUI(tipo, semVisita = false) {
  try {
    const r = await mesaProtegidaUI.solicitar(mesaAutoatendimentoAtual.numero, tipo, semVisita);
    if (r.repetido) {
      mostrarAvisoUI(
        r.tipo === tipo
          ? "Sua solicitação já foi enviada. Aguarde o atendente."
          : "Você já possui uma solicitação aberta. Aguarde o atendente.",
        r.tipo === tipo ? "pressa" : "solicitacao",
      );
      return false;
    }
    return true;
  } catch (e) {
    if (e.status === 410) mostrarAtendimentoEncerradoAutoUI();
    mostrarAvisoUI(e.message, "conferir");
    return false;
  }
}
async function vincularClienteMesaProtegidaUI(sair = false) {
  const r = await mesaProtegidaUI.vincular(mesaAutoatendimentoAtual.numero, sair);
  if (r.sessao) sessaoAutoatendimentoAtual = r.sessao;
  fecharLoginAutoatendimento();
  atualizarIconeLoginAuto();
  const nome = document.getElementById("nome-sessao-auto");
  if (nome) nome.textContent = r.sessao.nome;
}
if (typeof module !== "undefined" && module.exports) module.exports = { criarMesaProtegidaUI };
else {
  let storage;
  try {
    storage = window.localStorage;
  } catch {
    try {
      storage = window.sessionStorage;
    } catch {}
  }
  window.mesaProtegidaUI = criarMesaProtegidaUI({
    authCliente: typeof firebase.auth === "function" ? firebase.auth() : {},
    ativo: () => checkoutProtegidoUI.ativo(),
    storage,
    autenticarVisita: async (token, uid) => {
      appVisitaMesaProtegidaUI ||=
        firebase.apps.find((a) => a.name === "visita-pedrao") ||
        firebase.initializeApp(firebaseConfigAutoatendimento, "visita-pedrao");
      const auth = appVisitaMesaProtegidaUI.auth();
      if (auth.currentUser?.uid !== uid) {
        await auth.setPersistence("local");
        await auth.signInWithCustomToken(token);
      }
    },
  });
}
