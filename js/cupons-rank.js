/* Regras compartilhadas entre cadastro, delivery e pagamentos de comandas. */
const niveisCupomRankUI = ["Bronze", "Prata", "Ouro", "Diamante", "Imortal"];

function niveisPermitidosCupomRankUI(regra) {
  if (!regra || !["todos", "exclusivo", "crescente"].includes(regra.acesso))
    throw Error("A regra de rank deste cupom está indisponível.");
  if (regra.acesso === "todos") return [...niveisCupomRankUI];
  const indice = niveisCupomRankUI.indexOf(regra.nivel);
  if (indice < 0) throw Error("Escolha o rank do cupom.");
  return regra.acesso === "exclusivo" ? [regra.nivel] : niveisCupomRankUI.slice(indice);
}

function validarRegraCupomRankUI(regra) {
  if (!regra) return null;
  const permitidos = niveisPermitidosCupomRankUI(regra);
  if (regra.descontoPorRank) {
    for (const nivel of permitidos) {
      const valor = Number(regra.percentuais?.[nivel]);
      if (!Number.isFinite(valor) || valor <= 0 || valor > 100)
        throw Error(`Informe um desconto maior que zero e até 100% para ${nivel}.`);
    }
  }
  return regra;
}

function resolverCupomRankUI(cupom, cliente) {
  if (!cupom.rankRegra) return cupom;
  const regra = validarRegraCupomRankUI(cupom.rankRegra);
  if (
    cliente?.fidelidadeAtiva &&
    typeof nivelRankMensalUI === "function" &&
    !cliente.rankMensal?.importadoEm
  )
    throw Error(
      "Entre na sua conta e aguarde a conferência das compras para usar cupons por rank.",
    );
  if (!cliente) throw Error("Entre na sua conta para usar este cupom por rank.");
  if (cliente.fidelidadeAtiva !== true)
    throw Error("Este cupom exige um rank ativo. Ative sua fidelidade para participar.");
  const nivel = nivelFidelidadeOperacao(cliente, true);
  if (!niveisPermitidosCupomRankUI(regra).includes(nivel)) {
    const acesso =
      regra.acesso === "exclusivo"
        ? `é exclusivo do rank ${regra.nivel}`
        : `exige o rank ${regra.nivel} ou superior`;
    throw Error(`Ops! Este cupom ${acesso}. Seu rank atual é ${nivel}. Talvez na próxima!`);
  }
  const percentual = regra.descontoPorRank ? Number(regra.percentuais[nivel]) : null;
  return {
    ...cupom,
    rankAplicado: nivel,
    percentualRankAplicado: percentual,
    ...(percentual === null
      ? {}
      : {
          modo: "porcentagem",
          valor: percentual,
          itemGeralModo: "porcentagem",
          itemGeralValor: percentual,
        }),
  };
}

function textoRegraCupomRankUI(cupom) {
  const r = cupom.rankRegra;
  if (!r) return "Sem restrição de rank";
  const acesso =
    r.acesso === "todos"
      ? "Todos os ranks ativos"
      : r.acesso === "exclusivo"
        ? `Somente ${r.nivel}`
        : `${r.nivel} ou superior`;
  return (
    acesso +
    (r.descontoPorRank
      ? " · " +
        niveisPermitidosCupomRankUI(r)
          .map((n) => `${n}: ${r.percentuais?.[n]}%`)
          .join(" / ")
      : "")
  );
}

function itemElegivelCupomRankUI(cupom, item) {
  const normalizar = (v) =>
    String(v || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  const nome = normalizar(`${item.nome || ""} ${item.tipoCarne || item.tipo || ""}`);
  const categoria = normalizar(item.categoria);
  if (cupom.itemGeral) {
    const grupo = cupom.itemGeralTipo;
    if (["todos", "geral"].includes(grupo)) return true;
    if (["bebidas", "batatas", "combos"].includes(grupo))
      return categoria.includes(grupo.slice(0, -1));
    if (grupo === "artesanal") return /artesanal|caseiro/.test(nome);
    if (grupo === "industrial") return nome.includes("industrial");
    if (grupo === "frango") return nome.includes("frango") && !nome.includes("+");
    if (grupo === "file") return /mignon|paulistinha|paulistao/.test(nome) && !nome.includes("+");
    if (grupo === "hotdog") return /hot dog|prensado|salsicha/.test(nome);
    return false;
  }
  const alvo = normalizar(cupom.itemNome);
  const base = alvo.replace(/industrial|artesanal|caseiro/g, "").trim();
  return (
    !!base &&
    nome.includes(base) &&
    (!alvo.includes("industrial") || nome.includes("industrial")) &&
    (!/artesanal|caseiro/.test(alvo) || /artesanal|caseiro/.test(nome))
  );
}

function calcularCupomRankUI(cupom, contexto) {
  const base = Number(contexto.base || 0);
  const taxa = Number(contexto.taxa || 0);
  if (cupom.temPedidoMinimo && base < Number(cupom.pedidoMinimo || 0))
    throw Error(
      `Este cupom exige uma compra mínima de R$ ${Number(cupom.pedidoMinimo).toFixed(2)}.`,
    );
  let desconto = 0;
  let itensElegiveis = 0;
  if (["pedido", "descontoGeral"].includes(cupom.tipo)) {
    desconto =
      cupom.modo === "porcentagem"
        ? ((base + taxa) * Number(cupom.valor)) / 100
        : Number(cupom.valor);
  } else if (cupom.tipo === "taxa") {
    if (taxa <= 0) throw Error("Este cupom só vale para pedidos com entrega.");
    if (cupom.modo === "gratis") {
      if (Number(contexto.km || 0) > Number(cupom.kmGratis || 0))
        throw Error(`Taxa grátis válida somente até ${cupom.kmGratis} km.`);
      desconto = taxa;
    } else
      desconto = Math.min(
        taxa,
        cupom.modo === "porcentagem" ? (taxa * Number(cupom.valor)) / 100 : Number(cupom.valor),
      );
  } else if (cupom.tipo === "item") {
    for (const item of contexto.itens || []) {
      if (!itemElegivelCupomRankUI(cupom, item)) continue;
      const preco = Number(item.precoUnitario ?? item.preco ?? item.precoBase ?? 0);
      const qtd = Number(item.quantidade ?? item.qtd ?? 1);
      const percentual = cupom.rankRegra?.descontoPorRank
        ? cupom.percentualRankAplicado
        : cupom.itemGeral && cupom.itemGeralModo === "porcentagem"
          ? Number(cupom.itemGeralValor)
          : null;
      const porUnidade =
        percentual !== null
          ? (preco * percentual) / 100
          : cupom.itemGeral
            ? Number(cupom.itemGeralValor)
            : preco - Number(cupom.itemPrecoPromocional);
      desconto += Math.min(preco, Math.max(0, porUnidade)) * qtd;
      itensElegiveis += qtd;
    }
  }
  desconto = Math.round(Math.min(base + taxa, Math.max(0, desconto)) * 100) / 100;
  if (!Number.isFinite(desconto) || desconto <= 0)
    throw Error("Este cupom não vale para os itens do pedido.");
  return { desconto, itensElegiveis };
}

function contextoCupomPedidoRankUI(pedido) {
  const itens = pedido.itens || [];
  const base = itens.reduce(
    (s, i) =>
      s +
      Number(i.precoUnitario ?? i.preco ?? i.precoBase ?? 0) * Number(i.quantidade ?? i.qtd ?? 1),
    0,
  );
  return {
    base,
    taxa: Number(pedido.taxaEntrega || 0),
    km: Number(pedido.distanciaKm || 0),
    itens,
    desconto: Number(pedido.descontoCupom || 0),
  };
}

async function verificarRankCupomTransacaoUI(t, cupom, clienteId, contexto) {
  if (!cupom.rankRegra) return;
  const clienteDoc = clienteId
    ? await t.get(db.collection("clientes").doc(String(clienteId)))
    : null;
  const efetivo = resolverCupomRankUI(cupom, clienteDoc?.exists ? clienteDoc.data() : null);
  if (!contexto) throw Error("Reaplique o cupom para conferir seu rank e o desconto atual.");
  const calculado = calcularCupomRankUI(efetivo, contexto).desconto;
  if (Math.round(calculado * 100) !== Math.round(Number(contexto.desconto || 0) * 100))
    throw Error("O rank ou a regra do cupom mudou. Reaplique o cupom antes de continuar.");
}
