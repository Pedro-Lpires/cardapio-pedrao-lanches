const { ErroRecuperacao } = require("./recuperacao-acesso.cjs");
const {
  competenciaRankMensalUI,
  anteriorRankMensalUI,
  nivelRankMensalUI,
  eventosRankPedidoMensalUI,
  eventosRankComandaMensalUI,
} = require("../../js/rank-mensal.js");
const cents = (v) => {
  const n = Math.round(Number(v || 0) * 100);
  if (!Number.isSafeInteger(n) || n < 0) throw Error("Registro financeiro inválido.");
  return n;
};
function recebimentos(p) {
  if (Array.isArray(p.recebimentosPedido)) return p.recebimentosPedido;
  const confirmado = p.pagamentoConfirmado === true || /^pago$/i.test(p.status || "");
  const valor = Number(p.valorRecebido ?? p.valorPago ?? (confirmado ? p.valorTotal : 0)) || 0;
  return valor > 0
    ? [
        {
          valor,
          pagoEm: p.pagamentoConfirmadoEm || p.pagoEm || p.dataMs || p.data,
          taxaEntrega: /entrega/i.test(p.tipo || "") ? Number(p.taxaEntrega || 0) : 0,
        },
      ]
    : [];
}
async function sincronizarRankClienteServidor({ db, pessoa, em }) {
  const ref = db.collection("clientes").doc(pessoa.clienteId);
  function conferir(doc) {
    if (!doc.exists || doc.data().authUid !== pessoa.uid)
      throw new ErroRecuperacao(403, "Confira a conta vinculada a esta sessão.");
    return doc.data();
  }
  const inicial = conferir(await ref.get());
  const mes = competenciaRankMensalUI(em),
    aceitos = [mes, anteriorRankMensalUI(mes)];
  if (!inicial.rankMensal?.importadoEm) {
    const [pedidos, comandas, historico] = await Promise.all(
      ["pedidos", "comandas", "historicoPagamentosClientes"].map((c) =>
        db.collection(c).where("clienteId", "==", pessoa.clienteId).get(),
      ),
    );
    const origens = new Map();
    for (const d of pedidos.docs) origens.set("pedidos/" + d.id, "pedidos");
    for (const d of comandas.docs) origens.set("comandas/" + d.id, "comandas");
    for (const d of historico.docs) {
      const id = d.data().comandaId;
      if (typeof id === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(id))
        origens.set("comandas/" + id, "comandas");
    }
    for (const [caminho, colecao] of origens) {
      const id = caminho.split("/")[1],
        origem = db.collection(colecao).doc(id);
      const movimento = db
        .collection("rankMovimentos")
        .doc(encodeURIComponent(pessoa.clienteId + "|" + colecao + "_" + id));
      await db.runTransaction(async (t) => {
        const [cd, od, md] = await Promise.all([t.get(ref), t.get(origem), t.get(movimento)]);
        const c = conferir(cd);
        if (!od.exists) return;
        const p = od.data();
        if (colecao === "pedidos" && p.clienteId !== pessoa.clienteId) return;
        const eventos = (
          colecao === "pedidos"
            ? eventosRankPedidoMensalUI(p, { centavos: cents, recebimentos })
            : eventosRankComandaMensalUI(p, pessoa.clienteId, { centavos: cents })
        ).filter((e) => aceitos.includes(e.mes));
        const anteriores = md.exists ? md.data().eventos || [] : [];
        if (!eventos.length && !anteriores.length) return;
        const meses = { ...c.rankMensal?.meses };
        for (const e of anteriores)
          meses[e.mes] = Math.max(0, Number(meses[e.mes] || 0) - e.centavos);
        for (const e of eventos) meses[e.mes] = Number(meses[e.mes] || 0) + e.centavos;
        t.update(ref, { rankMensal: { ...c.rankMensal, versao: 1, meses } });
        t.set(movimento, {
          clienteId: pessoa.clienteId,
          chave: colecao + "_" + id,
          eventos,
          atualizadoEm: em,
        });
      });
    }
  }
  return db.runTransaction(async (t) => {
    const c = conferir(await t.get(ref));
    const rankMensal = {
      ...c.rankMensal,
      versao: 1,
      meses: { ...c.rankMensal?.meses },
      importadoEm: c.rankMensal?.importadoEm || em,
      competencia: mes,
      avaliadoEm: em,
    };
    const nivelCliente = nivelRankMensalUI({ ...c, rankMensal }, em);
    if (
      !c.rankMensal?.importadoEm ||
      c.rankMensal.competencia !== mes ||
      c.nivelCliente !== nivelCliente
    )
      t.update(ref, { rankMensal, nivelCliente });
    return { ...c, rankMensal, nivelCliente, telefone: pessoa.clienteId };
  });
}
module.exports = { sincronizarRankClienteServidor };
