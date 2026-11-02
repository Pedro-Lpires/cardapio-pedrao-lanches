/* Benefícios configuráveis. Crédito de frete e rank/fidelidade têm saldos separados. */
function configurarBeneficiosEntregaUI(dados = {}) {
  const c = dados.creditoEntrega || {};
  const numero = (v) => (Number.isFinite(Number(v)) ? Math.max(0, Number(v)) : 0);
  return {
    ativo: c.ativo === true,
    valores: Object.fromEntries(
      ["Bronze", "Prata", "Ouro", "Diamante", "Imortal"].map((n) => [n, numero(c.valores?.[n])]),
    ),
    limitePorPedido: numero(c.limitePorPedido),
    pedidoMinimo: numero(c.pedidoMinimo),
    acumularCupom: c.acumularCupom === true,
    acumularFidelidade: c.acumularFidelidade !== false,
  };
}
function saldoBeneficiosEntregaUI(cliente, config, agora = Date.now()) {
  const mes = competenciaRankMensalUI(agora),
    nivel = nivelFidelidadeOperacao(cliente);
  const conta = cliente?.beneficiosEntrega || {},
    m = conta.meses?.[mes] || {};
  const elegivel =
    config.ativo &&
    cliente?.fidelidadeAtiva === true &&
    !!cliente.rankMensal?.importadoEm &&
    conta.bloqueado !== true;
  const limite = elegivel
    ? Math.max(0, centavosOperacao(config.valores[nivel]) + Number(m.ajuste || 0))
    : 0;
  const reservado = Math.max(0, Number(m.reservado || 0)),
    utilizado = Math.max(0, Number(m.utilizado || 0));
  return {
    mes,
    nivel,
    limite,
    reservado,
    utilizado,
    disponivel: Math.max(0, limite - reservado - utilizado),
    bloqueado: !!conta.bloqueado,
  };
}
function calcularBeneficioEntregaUI(cliente, config, pedido, agora = Date.now()) {
  const saldo = saldoBeneficiosEntregaUI(cliente, config, agora);
  let motivo = "",
    centavos = 0;
  if (!config.ativo) motivo = "";
  else if (pedido.tipo !== "Entrega")
    motivo = "O crédito de entrega fica disponível para pedidos de entrega.";
  else if (!cliente?.fidelidadeAtiva)
    motivo = "Entre em uma conta com fidelidade ativa para usar seus benefícios.";
  else if (saldo.bloqueado) motivo = "O crédito de entrega está pausado para esta conta.";
  else if (!config.acumularCupom && Number(pedido.descontoCupom) > 0)
    motivo = "Este benefício não acumula com cupom. Remova o cupom para usar o crédito de entrega.";
  else if (!config.acumularFidelidade && Number(pedido.descontoFidelidade) > 0)
    motivo = "Este benefício não acumula com o desconto de fidelidade deste pedido.";
  else {
    const itens = centavosOperacao(baseFidelidadePedidoOperacao(pedido));
    const descontoItens =
      Math.max(
        0,
        centavosOperacao(pedido.descontoCupom) - centavosOperacao(pedido.descontoCupomTaxa),
      ) + centavosOperacao(pedido.descontoFidelidade);
    const frete = Math.max(
      0,
      centavosOperacao(pedido.taxaEntrega) - centavosOperacao(pedido.descontoCupomTaxa),
    );
    if (Math.max(0, itens - descontoItens) < centavosOperacao(config.pedidoMinimo))
      motivo = `Compra mínima em produtos após descontos: ${moedaOperacao(config.pedidoMinimo)}.`;
    else if (saldo.disponivel <= 0) motivo = "Sem crédito de entrega disponível neste mês.";
    else
      centavos = Math.min(
        saldo.disponivel,
        frete,
        Math.max(
          0,
          itens +
            centavosOperacao(pedido.taxaEntrega) -
            centavosOperacao(pedido.descontoCupom) -
            centavosOperacao(pedido.descontoFidelidade),
        ),
        config.limitePorPedido > 0 ? centavosOperacao(config.limitePorPedido) : frete,
      );
  }
  return { ...saldo, centavos, motivo };
}
function alterarSaldoBeneficioEntregaUI(cliente, mes, diferencaReserva, diferencaUso, limite) {
  const carteira = cliente.beneficiosEntrega || {},
    m = carteira.meses?.[mes] || {};
  const reservado = Number(m.reservado || 0) + diferencaReserva,
    utilizado = Number(m.utilizado || 0) + diferencaUso;
  if (reservado < 0 || utilizado < 0)
    throw Error("O saldo de benefícios mudou. Reabra o pedido e confira a conta.");
  return {
    ...carteira,
    meses: {
      ...carteira.meses,
      [mes]: {
        ...m,
        reservado,
        utilizado,
        ...(limite == null ? {} : { limite }),
        atualizadoEm: Date.now(),
      },
    },
  };
}
async function prepararBeneficioEntregaUI(t, pedido, acao, novoValor = null) {
  const anterior = pedido.creditoEntrega;
  const declarado = centavosOperacao(pedido.descontoCreditoEntrega);
  if (acao === "reservar" && declarado === 0 && (!pedido.clienteId || pedido.tipo !== "Entrega"))
    return { patch: {}, salvar: () => {} };
  if (acao !== "reservar" && (!anterior || anterior.status === "devolvido"))
    return { patch: {}, salvar: () => {} };
  const cfgDoc =
    acao === "reservar" ? await t.get(db.collection("config").doc("beneficios")) : null;
  const config = configurarBeneficiosEntregaUI(cfgDoc?.exists ? cfgDoc.data() : {});
  if (acao === "reservar" && !config.ativo && declarado === 0)
    return { patch: {}, salvar: () => {} };
  const cr = pedido.clienteId ? db.collection("clientes").doc(String(pedido.clienteId)) : null;
  const cd = cr ? await t.get(cr) : null;
  const cliente = cd?.exists ? cd.data() : null;
  let patch = {},
    carteira;
  if (acao === "reservar") {
    const calculo = calcularBeneficioEntregaUI(cliente, config, pedido);
    if (
      declarado !== calculo.centavos ||
      (declarado > 0 && pedido.creditoEntregaMes !== calculo.mes)
    )
      throw Error("Seus benefícios foram atualizados. Confira o total do pedido novamente.");
    if (!declarado) return { patch: {}, salvar: () => {} };
    carteira = alterarSaldoBeneficioEntregaUI(cliente, calculo.mes, declarado, 0, calculo.limite);
    patch = {
      descontoCreditoEntrega: declarado / 100,
      creditoEntregaMes: calculo.mes,
      creditoEntrega: {
        mes: calculo.mes,
        centavos: declarado,
        status: "reservado",
        reservadoEm: Date.now(),
      },
    };
  } else {
    if (!cliente) throw Error("Não foi possível localizar a conta dos benefícios deste pedido.");
    const valor = Number(anterior.centavos || 0),
      mes = anterior.mes;
    if (acao === "confirmar") {
      if (anterior.status !== "reservado") return { patch: {}, salvar: () => {} };
      carteira = alterarSaldoBeneficioEntregaUI(cliente, mes, -valor, valor);
      patch = { creditoEntrega: { ...anterior, status: "utilizado", utilizadoEm: Date.now() } };
    } else if (acao === "cancelar" || acao === "ajustar") {
      const manter =
        acao === "cancelar" ? 0 : Math.max(0, Math.min(valor, centavosOperacao(novoValor)));
      const devolver = valor - manter;
      if (!devolver) return { patch: {}, salvar: () => {} };
      carteira = alterarSaldoBeneficioEntregaUI(
        cliente,
        mes,
        anterior.status === "reservado" ? -devolver : 0,
        anterior.status === "utilizado" ? -devolver : 0,
      );
      patch = {
        ...(acao === "ajustar" ? { descontoCreditoEntrega: manter / 100 } : {}),
        creditoEntrega: {
          ...anterior,
          centavos: manter,
          status: manter ? anterior.status : "devolvido",
          devolvidoEm: Date.now(),
          devolvidoTotal: Number(anterior.devolvidoTotal || 0) + devolver,
        },
      };
    } else throw Error("Operação de benefício inválida.");
  }
  return { patch, salvar: () => t.update(cr, { beneficiosEntrega: carteira }) };
}
function limitarBeneficioEdicaoEntregaUI(atual, rascunho) {
  const frete =
    rascunho.tipo === "Entrega"
      ? Math.max(
          0,
          centavosOperacao(rascunho.taxaEntrega) - centavosOperacao(rascunho.descontoCupomTaxa),
        )
      : 0;
  const total = Math.max(
    0,
    centavosOperacao(baseFidelidadePedidoOperacao(rascunho)) +
      centavosOperacao(rascunho.taxaEntrega) -
      centavosOperacao(rascunho.descontoCupom) -
      centavosOperacao(rascunho.descontoFidelidade),
  );
  return Math.min(centavosOperacao(atual.descontoCreditoEntrega), frete, total) / 100;
}
async function lerBeneficiosEntregaUI() {
  const doc = await db.collection("config").doc("beneficios").get();
  return configurarBeneficiosEntregaUI(doc.exists ? doc.data() : {});
}
let configBeneficiosPerfilUI = null;
let clienteBeneficiosPerfilUI = null;
function htmlBeneficiosRankPerfilUI(cliente, cfg) {
  if (!cfg.ativo) return "<p>Os benefícios de entrega estão pausados no momento.</p>";
  const saldo = saldoBeneficiosEntregaUI(cliente, cfg);
  if (saldo.bloqueado) return "<p>O uso do crédito de entrega está pausado nesta conta.</p>";
  return (
    '<section class="saldo-beneficios-ui" aria-label="Crédito de entrega"><p>Disponível para usar: <strong>' +
    moedaOperacao(saldo.disponivel / 100) +
    '</strong></p><dl class="beneficios-saldo-lista-ui"><div><dt>Limite do mês</dt><dd>' +
    moedaOperacao(saldo.limite / 100) +
    "</dd></div><div><dt>Utilizado</dt><dd>" +
    moedaOperacao(saldo.utilizado / 100) +
    "</dd></div><div><dt>Reservado</dt><dd>" +
    moedaOperacao(saldo.reservado / 100) +
    "</dd></div></dl><p>Aplicado automaticamente na entrega. O saldo não acumula para o mês seguinte.</p></section>"
  );
}
async function atualizarBeneficiosPerfilUI(cliente) {
  if (!cliente?.telefone) return;
  clienteBeneficiosPerfilUI = cliente;
  // O saldo só aparece na janela aberta a partir do nível, nunca no perfil.
  for (const holder of document.querySelectorAll("#rank-mensal-perfil-ui, .rank-mensal-holder-ui"))
    holder.querySelector(".saldo-beneficios-ui")?.remove();
  const dialog = document.getElementById("beneficios-rank-janela-ui");
  if (!dialog) return;
  if (dialog.dataset.clienteId !== String(cliente.telefone) || !cliente.fidelidadeAtiva) {
    dialog.close();
    return;
  }
  if (!configBeneficiosPerfilUI) configBeneficiosPerfilUI = await lerBeneficiosEntregaUI();
  if (clienteBeneficiosPerfilUI !== cliente || !dialog.isConnected) return;
  if (
    typeof contaBeneficiosPedraoUI !== "undefined" &&
    contaBeneficiosPedraoUI !== String(cliente.telefone)
  )
    return;
  dialog.querySelector("[data-beneficios-conteudo]").innerHTML = htmlBeneficiosRankPerfilUI(
    cliente,
    configBeneficiosPerfilUI,
  );
}
function abrirBeneficiosRankPerfilUI() {
  const cliente = clienteRankMensalPerfilUI;
  if (
    !cliente?.telefone ||
    !cliente.fidelidadeAtiva ||
    document.getElementById("beneficios-rank-janela-ui")
  )
    return;
  const dialog = document.createElement("dialog");
  dialog.id = "beneficios-rank-janela-ui";
  dialog.className = "rank-mensal-janela-ui beneficios-rank-janela-ui";
  dialog.dataset.clienteId = String(cliente.telefone);
  dialog.setAttribute("aria-labelledby", "beneficios-rank-titulo-ui");
  dialog.innerHTML =
    '<div class="rank-mensal-topo-ui"><button type="button" class="rank-mensal-voltar-ui">← Voltar</button><h3 id="beneficios-rank-titulo-ui">Benefícios do rank</h3><button type="button" class="rank-mensal-x-ui" aria-label="Fechar benefícios">×</button></div><div data-beneficios-conteudo role="status">Conferindo seus benefícios…</div>';
  dialog.querySelectorAll("button").forEach((b) => (b.onclick = () => dialog.close()));
  dialog.addEventListener("close", () => dialog.remove(), { once: true });
  document.body.append(dialog);
  dialog.showModal();
  dialog.querySelector(".rank-mensal-voltar-ui").focus({ preventScroll: true });
  atualizarBeneficiosPerfilUI(cliente).catch(() => {
    if (dialog.isConnected)
      dialog.querySelector("[data-beneficios-conteudo]").textContent =
        "Não foi possível consultar seus benefícios. Volte e tente novamente.";
  });
}
async function criarPedidoAtendenteBeneficiosUI(pedido) {
  const id = String(pedido.telefone || "").replace(/\D/g, "");
  if (id.length === 11) {
    const doc = await db.collection("clientes").doc(id).get();
    if (doc.exists) {
      pedido.clienteId = id;
      const cfg = await lerBeneficiosEntregaUI();
      if (cfg.ativo && pedido.tipo === "Entrega") {
        const cliente = await sincronizarRankMensalClienteUI(id);
        const b = calcularBeneficioEntregaUI(cliente, cfg, pedido);
        pedido.descontoCreditoEntrega = b.centavos / 100;
        pedido.creditoEntregaMes = b.mes;
        pedido.valorAntesDesconto = pedido.valorTotal;
        pedido.valorTotal = Math.max(0, centavosOperacao(pedido.valorTotal) - b.centavos) / 100;
        // A forma é uma intenção de pagamento; acompanha o total a receber.
        if (pedido.formas?.length === 1) pedido.formas[0].valor = pedido.valorTotal;
        else if (b.centavos && pedido.formas?.length > 1) {
          pedido.formas = [];
          pedido.beneficiosConferirPagamento = true;
        }
      }
    }
  }
  const ref = db.collection("pedidos").doc();
  await salvarPedidoComCupomOperacao(ref, pedido);
  return ref;
}
let pararConfigBeneficiosUI = null;
function acompanharConfigBeneficiosUI() {
  if (pararConfigBeneficiosUI || !document.querySelector("#revisao-pedido, #conteudo-conta-auto"))
    return;
  const ref = db.collection("config").doc("beneficios");
  if (typeof ref.onSnapshot !== "function") return;
  pararConfigBeneficiosUI = ref.onSnapshot(
    (doc) => {
      configBeneficiosPerfilUI = configurarBeneficiosEntregaUI(doc.exists ? doc.data() : {});
      if (clienteBeneficiosPerfilUI)
        atualizarBeneficiosPerfilUI(clienteBeneficiosPerfilUI).catch(console.error);
      if (typeof atualizarConfigBeneficiosDeliveryUI === "function")
        atualizarConfigBeneficiosDeliveryUI(configBeneficiosPerfilUI);
    },
    (e) => console.error("Não foi possível acompanhar os benefícios.", e),
  );
}
document.addEventListener("DOMContentLoaded", acompanharConfigBeneficiosUI);
window.addEventListener("pagehide", () => {
  pararConfigBeneficiosUI?.();
  pararConfigBeneficiosUI = null;
});
window.addEventListener("pageshow", (e) => {
  if (e.persisted) acompanharConfigBeneficiosUI();
});
