/* O navegador apresenta a compra; o servidor confere e grava o pedido. */
function criarCheckoutProtegidoUI({
  auth,
  fetchHttp = fetch,
  storage,
  aleatorio = () => crypto.getRandomValues(new Uint8Array(32)),
}) {
  let disponibilidade,
    habilitado = null,
    fretePorRota = false,
    pendente;
  const confirmacoesSuporte = new Map();
  async function enviarSuporte(acao, dados) {
    const assinatura = JSON.stringify([acao, dados]);
    if (!confirmacoesSuporte.has(assinatura))
      confirmacoesSuporte.set(
        assinatura,
        Array.from(aleatorio(), (b) => b.toString(16).padStart(2, "0")).join(""),
      );
    const r = await chamar(acao, { ...dados, chave: confirmacoesSuporte.get(assinatura) });
    confirmacoesSuporte.delete(assinatura);
    return r;
  }
  const chaveStorage = "pedrao-checkout-pendente-v1";
  function guardar(valor) {
    pendente = valor;
    try {
      if (valor) storage?.setItem(chaveStorage, JSON.stringify(valor));
      else storage?.removeItem(chaveStorage);
    } catch {}
  }
  function lerPendente(uid) {
    if (pendente === undefined) {
      try {
        pendente = JSON.parse(storage?.getItem(chaveStorage) || "null");
      } catch {
        pendente = null;
      }
    }
    if (pendente && (!/^[a-f0-9]{64}$/.test(pendente.chave) || (pendente.uid || null) !== uid))
      guardar(null);
    return pendente;
  }
  async function ativo() {
    if (!disponibilidade)
      disponibilidade = (async () => {
        const r = await fetchHttp("/api/pedido-publico", { cache: "no-store" });
        if (r.status === 404) {
          if (typeof acessoClienteSenhaUI !== "undefined" && (await acessoClienteSenhaUI.ativo()))
            throw Error();
          habilitado = false;
          return false;
        }
        if (!r.ok) throw Error();
        const config = await r.json();
        habilitado = config.disponivel === true;
        fretePorRota = config.fretePorRota === true;
        return habilitado;
      })().catch(() => {
        disponibilidade = null;
        throw Error("Não foi possível conferir o envio do pedido. Verifique sua conexão.");
      });
    return disponibilidade;
  }
  async function usuarioAtual() {
    if (auth.currentUser) return auth.currentUser;
    return new Promise((resolve, reject) => {
      let parar;
      parar = auth.onAuthStateChanged((u) => {
        parar?.();
        resolve(u);
      }, reject);
    });
  }
  async function chamar(acao, dados = {}) {
    if (!(await ativo())) throw Error("O checkout protegido ainda está em configuração.");
    const usuario = await usuarioAtual(),
      uid = usuario?.uid || null;
    const r = await fetchHttp("/api/pedido-publico", {
      method: "POST",
      cache: "no-store",
      credentials: "omit",
      referrerPolicy: "no-referrer",
      headers: {
        "Content-Type": "application/json",
        ...(usuario ? { Authorization: "Bearer " + (await usuario.getIdToken()) } : {}),
      },
      body: JSON.stringify({ ...dados, acao }),
    });
    const retorno = await r.json();
    if (!r.ok)
      throw Object.assign(Error(retorno.erro || "Não foi possível conferir o pedido."), {
        status: r.status,
      });
    if ((auth.currentUser?.uid || null) !== uid)
      throw Error("A conta mudou durante o envio. Confira seu histórico antes de continuar.");
    return retorno;
  }
  return {
    ativo,
    get habilitado() {
      return habilitado;
    },
    async cotarFrete(localizacao) {
      await ativo();
      if (!fretePorRota) return null;
      const { frete } = await chamar("frete", {
        pedido: { localizacao, areaUrbanaConfirmada: true },
      });
      if (
        !frete?.comprovante ||
        !Number.isFinite(frete.distanciaKm) ||
        !Number.isFinite(frete.taxaEntrega)
      )
        throw Error("Cotação de entrega inválida.");
      return frete;
    },
    conferir: (pedido) => chamar("conferir", { pedido }),
    perfil: () => chamar("perfil"),
    cupons: () => chamar("cupons"),
    ativar: (codigo) => chamar("ativar", { codigo }),
    suporte: (dados) => enviarSuporte("suporte", dados),
    responderSuporte: (dados) => enviarSuporte("responderSuporte", dados),
    encerrarSuporte: (chamadoId) => chamar("encerrarSuporte", { chamadoId }),
    async recuperar() {
      const uid = (await usuarioAtual())?.uid || null,
        p = lerPendente(uid);
      return p ? chamar("recuperar", { chave: p.chave }) : { pedido: null };
    },
    async salvar(pedido) {
      const uid = (await usuarioAtual())?.uid || null;
      let p = lerPendente(uid);
      if (p) {
        const salvo = await chamar("recuperar", { chave: p.chave });
        if (salvo.pedido) return salvo;
      } else {
        p = {
          uid,
          chave: Array.from(aleatorio(), (b) => b.toString(16).padStart(2, "0")).join(""),
        };
        guardar(p);
      }
      return chamar("salvar", { pedido, chave: p.chave });
    },
    concluir() {
      guardar(null);
    },
  };
}
function pedidoAtualCheckoutProtegidoUI(codigo = cupomDescontoAplicado?.codigo || "") {
  const p = dadosPedidoTemporario;
  return {
    tipo: p.tipo,
    nome: document.getElementById("nome-cliente")?.value || clienteLogado?.nome || "",
    telefone: document.getElementById("telefone-cliente")?.value || clienteLogado?.telefone || "",
    itens: carrinho.map((i) => ({
      ...i,
      produtoId: i.produtoId || i.id || null,
      quantidade: Number(i.qtd ?? i.quantidade ?? 1),
      tipoCarne: i.tipoCarne || i.tipo || "",
      observacao: i.obs || i.observacao || "",
    })),
    localizacao: p.mapa || "",
    endereco: document.getElementById("endereco-escrito")?.value || "",
    areaUrbanaConfirmada: p.areaUrbanaConfirmada,
    ...(p.cotacaoFrete ? { cotacaoFrete: p.cotacaoFrete } : {}),
    condominio: document.getElementById("condominio")?.value || "Não",
    cnh: document.getElementById("cnh")?.value || "Não",
    observacao: p.obs || "",
    pagamento:
      Array.from(document.querySelectorAll(".check-pagamento:checked"), (c) => c.value).join(
        " + ",
      ) || "Pix",
    descontoFidelidade: descontoFidelidade || 0,
    cupomDescontoCodigo: codigo,
  };
}
function aplicarCotacaoCheckoutProtegidoUI(pedido) {
  carrinho = pedido.itens.map((i) => ({
    ...i,
    id: i.produtoId,
    qtd: i.quantidade,
    obs: i.observacao,
    desc: i.descricao,
  }));
  carrinhoVersao++;
  descontoCupom = pedido.descontoCupom;
  descontoFidelidade = pedido.descontoFidelidade;
  descontoCreditoEntregaUI = pedido.descontoCreditoEntrega;
  const p = dadosPedidoTemporario;
  Object.assign(p, {
    subtotal: pedido.itens.reduce((s, i) => s + i.subtotal, 0),
    taxa: pedido.taxaEntrega,
    km: pedido.distanciaKm,
    mapa: pedido.localizacao || p.mapa,
    foraDaArea: pedido.distanciaKm > 15,
  });
  if (typeof atualizarCarrinho === "function") atualizarCarrinho();
  refazerBeneficiosRevisaoUI();
}
function finalizarPedidoCheckoutProtegidoUI(p) {
  if (p.cancelado) {
    checkoutProtegidoUI.concluir();
    return mostrarAvisoUI(
      "Este pedido foi cancelado. Confira os itens antes de criar outro pedido.",
      "conferir",
    );
  }
  const mensagem = montarMensagemPedidoWhatsUI({
    ...p,
    total: p.valorTotal,
    taxa: p.taxaEntrega,
    km: p.distanciaKm,
    mapa: p.localizacao,
    data: new Date(p.dataMs).toLocaleString("pt-BR", { timeZone: "America/Cuiaba" }),
  });
  abrirMensagemWhatsPedidoUI(mensagem);
  carrinho = [];
  dadosPedidoTemporario = {};
  descontoCupom = 0;
  descontoFidelidade = 0;
  descontoCreditoEntregaUI = 0;
  cupomDescontoAplicado = null;
  revisaoCarrinhoVersao = -1;
  const observacao = document.getElementById("observacao");
  if (observacao) observacao.value = "";
  const revisao = document.getElementById("revisao-pedido");
  if (revisao) revisao.style.display = "none";
  const lista = document.getElementById("lista-conferencia");
  if (lista) lista.replaceChildren();
  atualizarCarrinho();
  if (typeof fecharModalCheck === "function") fecharModalCheck();
  if (typeof fecharCheckoutUI === "function") fecharCheckoutUI("inicio");
  estadoBeneficiosDeliveryUI = null;
  checkoutProtegidoUI.concluir();
}
if (typeof module !== "undefined" && module.exports) module.exports = { criarCheckoutProtegidoUI };
else {
  let storage;
  try {
    storage = window.sessionStorage;
  } catch {}
  window.checkoutProtegidoUI = criarCheckoutProtegidoUI({
    auth: typeof firebase.auth === "function" ? firebase.auth() : {},
    storage,
  });
  document.addEventListener("DOMContentLoaded", () => checkoutProtegidoUI.ativo().catch(() => {}));
}
