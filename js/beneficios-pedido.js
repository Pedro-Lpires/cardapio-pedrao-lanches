/* Crédito/estorno do perfil por pedido. Cada operação é atômica e idempotente. */
function movimentoFidelidadeCheckoutUI(cliente, atual, novo, cancelar = false, em = Date.now()) {
  const cents = (v) => Math.round(Number(v || 0) * 100);
  const ledger = atual.beneficiosPerfil || {};
  const reserva = atual.fidelidadeReserva || {};
  const debitoAnterior =
    reserva.status === "reservado" ? Number(reserva.centavos || 0) : cents(ledger.bonusUsado);
  const desconto = cancelar || /local/i.test(novo.tipo || "") ? 0 : cents(novo.descontoFidelidade);
  if (![0, 1000].includes(desconto))
    throw Error("Use R$ 10 de bônus ou remova o desconto de fidelidade.");
  const local = /local/i.test(novo.tipo || "");
  const pago = cancelar || local ? 0 : Math.max(0, cents(novo.valorPago ?? novo.valorRecebido));
  const frete = Math.max(
    0,
    cents(novo.taxaEntrega) - cents(novo.descontoCupomTaxa) - cents(novo.descontoCreditoEntrega),
  );
  const produtos = (novo.itens || []).reduce(
    (s, i) =>
      s +
      cents(
        i.subtotal ?? Number(i.precoUnitario ?? i.preco ?? 0) * Number(i.quantidade ?? i.qtd ?? 1),
      ) +
      cents(i.totalMolhosPagos),
    0,
  );
  const base =
    !cancelar && cliente.fidelidadeAtiva && !/local/i.test(novo.tipo || "")
      ? Math.max(
          0,
          Math.min(
            produtos -
              Math.max(0, cents(novo.descontoCupom) - cents(novo.descontoCupomTaxa)) -
              desconto,
            pago - frete,
          ),
        )
      : 0;
  const totalAnterior = cents(cliente.totalFidelidade),
    total = Math.max(
      0,
      totalAnterior + base - cents(atual.baseFidelidadeCreditada ?? ledger.baseFidelidade),
    );
  const gerado = Math.max(
    0,
    cents(cliente.bonusGeradoTotal) +
      (Math.floor(total / 30000) - Math.floor(totalAnterior / 30000)) * 1000,
  );
  const saldo =
    cents(cliente.bonusDisponivel) +
    debitoAnterior -
    desconto +
    gerado -
    cents(cliente.bonusGeradoTotal);
  if (saldo < 0 && desconto > debitoAnterior)
    throw Error("O cliente não tem saldo de fidelidade para este desconto.");
  const contou =
    !cancelar &&
    !local &&
    (pago > 0 || novo.pagamentoConfirmado === true || ledger.pedidoContado === true);
  const usado = pago > 0 || novo.pagamentoConfirmado === true;
  return {
    cliente: {
      bonusDisponivel: Math.max(0, saldo) / 100,
      totalFidelidade: total / 100,
      totalGasto:
        Math.max(
          0,
          cents(cliente.totalGasto) +
            base -
            cents(atual.baseFidelidadeCreditada ?? ledger.baseFidelidade),
        ) / 100,
      bonusGeradoTotal: gerado / 100,
      pedidosTotal: Math.max(
        0,
        Number(cliente.pedidosTotal || 0) + Number(contou) - Number(!!ledger.pedidoContado),
      ),
      gastoTotal: Math.max(0, cents(cliente.gastoTotal) + pago - cents(ledger.gastoTotal)) / 100,
      ...(contou
        ? { ultimaCompra: novo.data || cliente.ultimaCompra || new Date(em).toISOString() }
        : {}),
    },
    pedido: {
      baseFidelidadeCreditada: base / 100,
      beneficiosPerfil: {
        regra: 3,
        baseFidelidade: base / 100,
        bonusUsado: desconto / 100,
        bonusGerado:
          (gerado - cents(cliente.bonusGeradoTotal)) / 100 + Number(ledger.bonusGerado || 0),
        pedidoContado: contou,
        gastoTotal: pago / 100,
      },
      ...(reserva.status || desconto
        ? {
            fidelidadeReserva: {
              ...reserva,
              centavos: desconto,
              status: desconto ? (usado ? "utilizado" : "reservado") : "devolvido",
              atualizadoEm: em,
            },
          }
        : {}),
    },
  };
}
async function prepararFidelidadeCheckoutUI(t, atual, novo, cancelar = false) {
  if (atual.checkoutProtegido !== 1 || !atual.clienteId) return { patch: {}, salvar: () => {} };
  const ref = db.collection("clientes").doc(atual.clienteId),
    doc = await t.get(ref);
  if (!doc.exists || doc.data().authUid !== atual.clienteAuthUid)
    throw Error("Confira a conta vinculada ao pedido antes de alterar os benefícios.");
  const movimento = movimentoFidelidadeCheckoutUI(doc.data(), atual, novo, cancelar);
  return {
    patch: movimento.pedido,
    estorno: cancelar
      ? {
          base: Number(
            atual.baseFidelidadeCreditada ?? atual.beneficiosPerfil?.baseFidelidade ?? 0,
          ),
          bonus: Math.max(
            0,
            Number(doc.data().bonusGeradoTotal || 0) - movimento.cliente.bonusGeradoTotal,
          ),
          bonusDevolvido:
            atual.fidelidadeReserva?.status === "reservado"
              ? Number(atual.fidelidadeReserva.centavos || 0) / 100
              : Number(atual.beneficiosPerfil?.bonusUsado || 0),
        }
      : null,
    salvar: () => t.update(ref, movimento.cliente),
  };
}
function nivelComprasPedidoUI(c) {
  if (!c.fidelidadeAtiva) return "Sem nível";
  // Compras enviadas não promovem mais por quantidade ou gasto vitalício.
  return nivelFidelidadeOperacao(c);
}
async function registrarBeneficiosPedidoOperacao(id) {
  const ref = db.collection("pedidos").doc(id);
  return db.runTransaction(async (t) => {
    const doc = await t.get(ref),
      p = doc.data();
    if (
      !doc.exists ||
      p.cancelado ||
      !p.clienteId ||
      p.beneficiosPerfil ||
      /local/i.test(p.tipo || "")
    )
      return null;
    const cr = db.collection("clientes").doc(p.clienteId),
      cd = await t.get(cr);
    if (!cd.exists) return null;
    const c = cd.data(),
      local = /local/i.test(p.tipo || "");
    const base = c.fidelidadeAtiva && !local ? baseFidelidadePedidoOperacao(p) : 0;
    const usado = base > 0 ? Number(p.descontoFidelidade || 0) : 0;
    const total = Number(c.totalFidelidade || 0) + base;
    const gerado = bonusAcumuladoFidelidadeOperacao(c, total);
    const bonus = Number(c.bonusDisponivel || 0) + gerado - Number(c.bonusGeradoTotal || 0) - usado;
    if (bonus < -0.001)
      throw Error("O saldo de fidelidade mudou. Confira o pedido antes de usar o bônus.");
    const patch = {
      pedidosTotal: Number(c.pedidosTotal || 0) + 1,
      gastoTotal: Number(c.gastoTotal || 0) + Number(p.valorTotal || 0),
      ultimaCompra: p.data || new Date().toISOString(),
    };
    if (base > 0)
      Object.assign(patch, {
        totalFidelidade: total,
        totalGasto: Number(c.totalGasto || 0) + base,
        bonusGeradoTotal: gerado,
        bonusDisponivel: Math.max(0, bonus),
      });
    patch.nivelCliente = nivelComprasPedidoUI({ ...c, ...patch });
    t.update(cr, patch);
    t.update(ref, {
      beneficiosPerfil: {
        regra: 2,
        baseFidelidade: base,
        bonusUsado: usado,
        bonusGerado: gerado - Number(c.bonusGeradoTotal || 0),
        pedidoContado: true,
        gastoTotal: Number(p.valorTotal || 0),
      },
      baseFidelidadeCreditada: base,
    });
    return { ...c, ...patch };
  });
}
async function cancelarPedidoPerfilTransacaoUI(id) {
  const ref = db.collection("pedidos").doc(id);
  const fila = await db.collection("filaCozinha").where("origemId", "==", id).get();
  return db.runTransaction(async (t) => {
    const doc = await t.get(ref),
      p = doc.data();
    if (!doc.exists) throw Error("Pedido não encontrado.");
    if (p.cancelado) return false;
    if (p.vinculadoComanda || p.comandaId || p.mesa)
      throw Error("Este pedido já está em uma mesa. Cancele pela comanda da mesa.");
    const clienteId = p.clienteId || p.telefoneLimpo || String(p.telefone || "").replace(/\D/g, "");
    const cr = clienteId ? db.collection("clientes").doc(clienteId) : null;
    const cd = cr ? await t.get(cr) : null;
    const filas = await Promise.all(
      fila.docs.map((d) => t.get(db.collection("filaCozinha").doc(d.id))),
    );
    const salvarRank =
      typeof prepararRankMensalUI === "function"
        ? await prepararRankMensalUI(t, [{ clienteId, chave: "pedidos_" + id, eventos: [] }])
        : () => {};
    const beneficio =
      typeof prepararBeneficioEntregaUI === "function"
        ? await prepararBeneficioEntregaUI(t, p, "cancelar")
        : { patch: {}, salvar: () => {} };
    const fidelidade = await prepararFidelidadeCheckoutUI(t, p, p, true);
    const estorno = fidelidade.estorno || { base: 0, bonus: 0, bonusDevolvido: 0 };
    if (cd?.exists && p.checkoutProtegido !== 1) {
      const c = cd.data(),
        ledger = p.beneficiosPerfil;
      const legado = !ledger && p.origem === "site_delivery" && !/local/i.test(p.tipo || "");
      const contou = ledger?.pedidoContado || legado;
      const base = ledger
        ? Number(p.baseFidelidadeCreditada ?? ledger.baseFidelidade)
        : legado && p.fidelidadeAtivaNoPedido
          ? baseFidelidadePedidoOperacao(p) -
            (p.itens || []).reduce((s, i) => s + Number(i.totalMolhosPagos || 0), 0) +
            Number(p.taxaEntrega || 0)
          : 0;
      const patch = {};
      if (contou)
        Object.assign(patch, {
          pedidosTotal: Math.max(0, Number(c.pedidosTotal || 0) - 1),
          gastoTotal: Math.max(
            0,
            Number(c.gastoTotal || 0) - Number(ledger?.gastoTotal ?? p.valorTotal ?? 0),
          ),
        });
      if (base > 0) {
        const total = Math.max(0, Number(c.totalFidelidade || 0) - base);
        const metas =
          Math.floor(centavosOperacao(c.totalFidelidade) / 30000) -
          Math.floor(centavosOperacao(total) / 30000);
        const retirado = Math.min(
          Number(c.bonusGeradoTotal || 0),
          Math.max(0, metas) * (ledger ? 10 : 20),
        );
        const devolvido = Number(ledger?.bonusUsado ?? p.descontoFidelidade ?? 0);
        Object.assign(patch, {
          totalFidelidade: total,
          totalGasto: Math.max(0, Number(c.totalGasto || 0) - base),
          bonusGeradoTotal: Math.max(0, Number(c.bonusGeradoTotal || 0) - retirado),
          bonusDisponivel: Math.max(0, Number(c.bonusDisponivel || 0) - retirado + devolvido),
        });
        Object.assign(estorno, { base, bonus: retirado, bonusDevolvido: devolvido });
      }
      if (contou) patch.nivelCliente = nivelComprasPedidoUI({ ...c, ...patch });
      if (Object.keys(patch).length) t.update(cr, patch);
    }
    for (const f of filas)
      if (f.exists && f.data().origemColecao === "pedidos" && f.data().status !== "pronto")
        t.update(db.collection("filaCozinha").doc(f.id), {
          status: "cancelado",
          canceladoEm: Date.now(),
        });
    t.update(ref, {
      ...beneficio.patch,
      ...fidelidade.patch,
      cancelado: true,
      status: "Cancelado",
      canceladoEm: Date.now(),
      estornoPerfil: estorno,
    });
    salvarRank();
    beneficio.salvar();
    fidelidade.salvar();
    return true;
  });
}
if (typeof module !== "undefined" && module.exports)
  module.exports = { movimentoFidelidadeCheckoutUI };
async function cancelarPedidoPerfilUI(id) {
  if (
    !(await confirmarOperacao(
      "Cancelar este pedido e estornar seus benefícios? Pagamentos registrados ficam no histórico. Se houver valor recebido, confira a devolução no caixa.",
    ))
  )
    return;
  try {
    await cancelarPedidoPerfilTransacaoUI(id);
    if (typeof carregarCentralOperacao === "function") await carregarCentralOperacao();
    avisoOperacao("Pedido cancelado. Perfil e fidelidade atualizados.");
  } catch (e) {
    avisoOperacao(e.message);
  }
}
