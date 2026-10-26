/* Cancelamento sem finalizar venda. Pagamentos existentes continuam no histórico. */
async function cancelarComandasMesasOperacao({
  comandaId = "",
  pagamentosConfirmados = false,
} = {}) {
  const mesas = await db.collection("mesas").get();
  return db.runTransaction(async (t) => {
    // Ler as mesas primeiro faz o envio concorrente de um novo pedido invalidar a operação.
    const mesasLidas = await Promise.all(
      mesas.docs.map((d) => t.get(db.collection("mesas").doc(d.id))),
    );
    const abertas = await db.collection("comandas").where("status", "==", "Aberta").get();
    const comandas = await Promise.all(
      abertas.docs.map((d) => t.get(db.collection("comandas").doc(d.id))),
    );
    const cancelar = comandas.filter(
      (d) => d.exists && d.data().status === "Aberta" && (!comandaId || d.id === comandaId),
    );
    if (comandaId && !cancelar.length) throw Error("Esta comanda não está mais aberta.");
    const pagas = cancelar.filter((d) => (d.data().pagamentos || []).length > 0);
    if (pagas.length && !pagamentosConfirmados)
      throw Error(
        "Há pagamento registrado. Confirme novamente para cancelar; o pagamento será mantido no histórico.",
      );
    const ids = new Set(cancelar.map((d) => d.id));
    const numeros = new Set(cancelar.map((d) => Number(d.data().mesa)));
    const liberar = mesasLidas.filter(
      (d) =>
        d.exists &&
        (!comandaId || numeros.has(Number(d.data().numero))) &&
        !comandas.some(
          (c) =>
            c.exists &&
            c.data().status === "Aberta" &&
            Number(c.data().mesa) === Number(d.data().numero) &&
            !ids.has(c.id),
        ),
    );
    const mesaIds = new Set(liberar.map((d) => d.id));
    const [filas, sessoes, chamados] = await Promise.all([
      Promise.all(
        cancelar.map((d) => db.collection("filaCozinha").where("origemId", "==", d.id).get()),
      ),
      db.collection("sessoesMesa").where("status", "==", "ativa").get(),
      db.collection("chamadosMesa").where("status", "==", "aberto").get(),
    ]);
    const auxiliares = [
      ...filas.flatMap((s) =>
        s.docs
          .filter((d) => d.data().origemColecao === "comandas")
          .map((d) => ["filaCozinha", d.id]),
      ),
      ...sessoes.docs.filter((d) => mesaIds.has(d.data().mesaId)).map((d) => ["sessoesMesa", d.id]),
      ...chamados.docs
        .filter((d) => mesaIds.has(d.data().mesaId))
        .map((d) => ["chamadosMesa", d.id]),
    ];
    const documentos = await Promise.all(
      auxiliares.map(async ([colecao, id]) => ({
        colecao,
        ref: db.collection(colecao).doc(id),
        doc: await t.get(db.collection(colecao).doc(id)),
      })),
    );
    const agora = Date.now();
    const alteracoes = cancelar.map((d) => ({
      ref: db.collection("comandas").doc(d.id),
      dados: {
        status: "Cancelada",
        canceladoEm: agora,
        motivoCancelamento: comandaId ? "cancelamento_atendente" : "limpeza_mesas",
        pagamentosPreservados: (d.data().pagamentos || []).length > 0,
      },
    }));
    for (const mesa of liberar) {
      if (mesa.data().ocupada)
        alteracoes.push({
          ref: db.collection("mesas").doc(mesa.id),
          dados: { ocupada: false, limpaEm: agora },
        });
    }
    for (const { colecao, ref, doc } of documentos) {
      if (!doc.exists) continue;
      const r = doc.data();
      if (
        colecao === "filaCozinha" &&
        ids.has(r.origemId) &&
        !["pronto", "concluido", "retirado", "entregue", "cancelado"].includes(r.status)
      )
        alteracoes.push({ ref, dados: { status: "cancelado", canceladoEm: agora } });
      if (colecao === "sessoesMesa" && r.status === "ativa" && mesaIds.has(r.mesaId))
        alteracoes.push({
          ref,
          dados: {
            status: "encerrada",
            motivoEncerramento: "limpeza_mesa",
            encerradaEmMs: agora,
            encerradaEm: new Date(agora).toISOString(),
          },
        });
      if (colecao === "chamadosMesa" && r.status === "aberto" && mesaIds.has(r.mesaId))
        alteracoes.push({
          ref,
          dados: { status: "cancelado", canceladoEmMs: agora, motivoCancelamento: "limpeza_mesa" },
        });
    }
    if (alteracoes.length > 450)
      throw Error(
        "Há muitos registros para limpar de uma vez. Cancele algumas comandas e tente novamente.",
      );
    for (const { ref, dados } of alteracoes) t.update(ref, dados);
    return { comandas: cancelar.length, comPagamento: pagas.length, mesas: liberar.length };
  });
}

let limpandoMesasAtendenteUI = false;
async function limparTodasMesasAtendente() {
  if (limpandoMesasAtendenteUI) return;
  limpandoMesasAtendenteUI = true;
  try {
    const confirmou = await confirmarOperacao(
      "Limpar todas as mesas? As comandas abertas serão canceladas, sem finalizar vendas. Pedidos pendentes sairão da cozinha e as sessões da mesa serão encerradas. Se houver pagamentos registrados, eles permanecerão no histórico.",
    );
    if (!confirmou) return;
    const resultado = await cancelarComandasMesasOperacao({ pagamentosConfirmados: true });
    await abrirConsumoLocal();
    alert(
      `Mesas limpas. ${resultado.comandas} comanda(s) cancelada(s), sem finalização.${resultado.comPagamento ? " Os pagamentos já registrados foram mantidos no histórico." : ""}`,
    );
  } catch (erro) {
    alert("Não foi possível limpar as mesas: " + erro.message);
  } finally {
    limpandoMesasAtendenteUI = false;
  }
}
