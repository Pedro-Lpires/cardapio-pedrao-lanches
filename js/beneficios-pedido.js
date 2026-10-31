/* Crédito/estorno do perfil por pedido. Cada operação é atômica e idempotente. */
function nivelComprasPedidoUI(c) {
  if (!c.fidelidadeAtiva) return "Sem nível";
  const n = Number(c.pedidosTotal || 0),
    v = Number(c.gastoTotal || 0);
  if (n >= 60 || v >= 4000) return "Imortal";
  if (n >= 30 || v >= 1500) return "Diamante";
  if (n >= 15 || v >= 700) return "Ouro";
  if (n >= 5 || v >= 300) return "Prata";
  return "Bronze";
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
    const estorno = { base: 0, bonus: 0, bonusDevolvido: 0 };
    if (cd?.exists) {
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
      cancelado: true,
      status: "Cancelado",
      canceladoEm: Date.now(),
      estornoPerfil: estorno,
    });
    return true;
  });
}
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
