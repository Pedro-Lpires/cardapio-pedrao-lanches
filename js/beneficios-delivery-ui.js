let descontoCreditoEntregaUI = 0;
let estadoBeneficiosDeliveryUI = null;
function pedidoBeneficiosRevisaoUI() {
  const p = dadosPedidoTemporario || {},
    c = cupomDescontoAplicado;
  const descontoTaxa =
    c?.tipo === "taxa"
      ? descontoCupom
      : ["pedido", "descontoGeral"].includes(c?.tipo) && c.modo === "porcentagem"
        ? Math.min(descontoCupom, (Number(p.taxa || 0) * Number(c.valor || 0)) / 100)
        : 0;
  return {
    tipo: p.tipo,
    itens: carrinho.map((i) => ({
      preco: Number(i.preco || 0),
      quantidade: Number(i.qtd || 1),
      totalMolhosPagos: Number(i.totalMolhosPagos || 0),
    })),
    taxaEntrega: Number(p.taxa || 0),
    descontoCupom,
    descontoFidelidade,
    descontoCupomTaxa: descontoTaxa,
  };
}
function refazerBeneficiosRevisaoUI() {
  const p = dadosPedidoTemporario;
  if (!p?.tipo || document.getElementById("revisao-pedido")?.style.display !== "block") return;
  exibirRevisao(
    p.itens,
    p.subtotal,
    p.taxa,
    p.tipo,
    p.obs,
    p.mapa,
    p.km,
    p.foraDaArea,
    p.areaUrbanaConfirmada,
  );
}
async function carregarBeneficiosDeliveryUI(forcar = false) {
  const id = String(clienteLogado?.telefone || "");
  if (!forcar && estadoBeneficiosDeliveryUI?.id === id) {
    if (estadoBeneficiosDeliveryUI.carregado) return estadoBeneficiosDeliveryUI;
    if (estadoBeneficiosDeliveryUI.promessa) return estadoBeneficiosDeliveryUI.promessa;
  }
  const estado = { id, carregado: false };
  estadoBeneficiosDeliveryUI = estado;
  estado.promessa = (async () => {
    const config = await lerBeneficiosEntregaUI();
    let cliente = clienteLogado;
    if (config.ativo && id) cliente = await sincronizarRankMensalClienteUI(id);
    if (estadoBeneficiosDeliveryUI !== estado) return estadoBeneficiosDeliveryUI;
    estado.config = config;
    estado.cliente = cliente;
    estado.carregado = true;
    configBeneficiosPerfilUI = config;
    if (cliente && clienteLogado?.telefone === id) Object.assign(clienteLogado, cliente);
    return estado;
  })();
  try {
    return await estado.promessa;
  } catch (e) {
    if (estadoBeneficiosDeliveryUI === estado) estadoBeneficiosDeliveryUI = null;
    throw e;
  }
}
function atualizarConfigBeneficiosDeliveryUI(config) {
  if (!estadoBeneficiosDeliveryUI?.carregado) return;
  estadoBeneficiosDeliveryUI.config = config;
  refazerBeneficiosRevisaoUI();
}
function aplicarBeneficiosRevisaoDeliveryUI() {
  const box = document.getElementById("detalhe-valores"),
    total = document.getElementById("resumo-total");
  let linha = document.getElementById("linha-beneficios-entrega-ui");
  if (!linha) {
    linha = document.createElement("p");
    linha.id = "linha-beneficios-entrega-ui";
    linha.setAttribute("role", "status");
    box.insertBefore(linha, total.parentElement);
  }
  const estado = estadoBeneficiosDeliveryUI;
  if (!estado?.carregado || estado.id !== String(clienteLogado?.telefone || "")) {
    descontoCreditoEntregaUI = 0;
    linha.textContent = "Conferindo benefícios…";
    carregarBeneficiosDeliveryUI()
      .then(refazerBeneficiosRevisaoUI)
      .catch(() => {
        linha.textContent =
          "Não foi possível conferir os benefícios. Tente novamente antes de enviar.";
      });
    return 0;
  }
  const cliente = estado.id && clienteLogado?.rankMensal ? clienteLogado : estado.cliente;
  const b = calcularBeneficioEntregaUI(cliente, estado.config, pedidoBeneficiosRevisaoUI());
  descontoCreditoEntregaUI = b.centavos / 100;
  linha.hidden = !estado.config.ativo || dadosPedidoTemporario.tipo !== "Entrega";
  linha.textContent =
    b.centavos > 0
      ? `Benefícios · crédito de entrega: -${moedaOperacao(b.centavos / 100)}`
      : b.motivo;
  return descontoCreditoEntregaUI;
}
async function conferirBeneficiosAntesEnvioUI() {
  if (!dadosPedidoTemporario?.tipo) return true;
  const anterior = centavosOperacao(descontoCreditoEntregaUI),
    estado = await carregarBeneficiosDeliveryUI(true);
  const b = calcularBeneficioEntregaUI(estado.cliente, estado.config, pedidoBeneficiosRevisaoUI());
  if (anterior !== b.centavos) {
    refazerBeneficiosRevisaoUI();
    mostrarAvisoUI(
      "Seus benefícios foram atualizados. Confira o novo total antes de enviar.",
      "conferir",
    );
    return false;
  }
  return true;
}
