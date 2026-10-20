async function executarTesteFirebase() {
  document.getElementById("executar").disabled = true;
  const out = document.getElementById("resultado");
  const log = (s) => (out.textContent += s + "\n");
  const prefix = "codex-teste-browser-" + Date.now();
  const refs = [
    db.collection("comandas").doc(prefix),
    db.collection("clientes").doc(prefix + "-cliente"),
    db.collection("historicoPagamentosClientes").doc(prefix + "-p1"),
    db.collection("filaCozinha").doc(prefix + "-fila"),
  ];
  let podeLimpar = false;
  const assert = (cond, msg) => {
    if (!cond) throw Error(msg);
  };
  const parte = (id, clienteId) => ({
    id,
    modo: "valor",
    clienteId,
    clienteNome: clienteId ? "TESTE CODEX" : null,
    valorOriginal: 15,
    valorQuitado: 15,
    valorPago: 15,
    valor: 15,
    descontoCupom: 0,
    descontoFidelidade: 0,
    cupomId: null,
    cupomCodigo: null,
    cupomNome: null,
    formas: [{ forma: "Pix", valor: 15 }],
    itens: [],
    pagoEm: Date.now(),
  });
  const patch = (c, p) => {
    const pagamentos = [...(c.pagamentos || []), p];
    const quitado = pagamentos.reduce((n, p) => n + p.valorQuitado, 0);
    return {
      pagamentos,
      valorPago: quitado,
      valorQuitado: quitado,
      saldoPendente: 30 - quitado,
      status: quitado === 30 ? "Fechada" : "Aberta",
    };
  };
  log("Registros: " + prefix);
  try {
    for (const r of refs)
      assert(!(await r.get()).exists, "Registro de teste já existe; operação interrompida.");
    podeLimpar = true;
    await refs[0].set({
      cliente: "TESTE CODEX — não preparar",
      valorTotal: 30,
      status: "Aberta",
      itens: [],
      pagamentos: [],
      testeCodex: true,
    });
    await refs[1].set({
      nome: "TESTE CODEX",
      totalGasto: 0,
      fidelidadeAtiva: false,
      testeCodex: true,
    });
    let c = (await refs[0].get()).data();
    const p1 = parte(prefix + "-p1", refs[1].id);
    await salvarPagamentoSeparadoAtomico(refs[0], c, p1, patch(c, p1), [
      { nome: "Divisão por valor", quantidade: 1, subtotal: 15 },
    ]);
    c = (await refs[0].get()).data();
    assert(c.saldoPendente === 15, "Saldo da primeira parte incorreto.");
    log("PASS: R$ 15 pagos na primeira parte.");
    await salvarPagamentoSeparadoAtomico(refs[0], c, p1, patch(c, p1), []);
    assert((await refs[0].get()).data().pagamentos.length === 1, "Pagamento duplicado.");
    log("PASS: repetição não duplica pagamento.");
    const p2 = parte(prefix + "-p2", null);
    await salvarPagamentoSeparadoAtomico(refs[0], c, p2, patch(c, p2), []);
    c = (await refs[0].get()).data();
    assert(
      c.valorPago === 30 && c.valorQuitado === 30 && c.status === "Fechada",
      "Fechamento incorreto.",
    );
    assert(
      (await refs[1].get()).data().totalGasto === 15,
      "O pagamento sem conta foi atribuído ao cliente.",
    );
    assert((await refs[2].get()).data().valorPago === 15, "Histórico incorreto.");
    log("PASS: R$ 15 + R$ 15 fecham comanda; histórico e cliente corretos.");
    await refs[3].set({
      status: "teste",
      cliente: "TESTE CODEX",
      itens: [],
      criadoEmMs: Date.now(),
      testeCodex: true,
    });
    await concluirCozinhaOperacao(refs[3].id);
    assert((await refs[3].get()).data().status === "pronto", "Conclusão de fila incorreta.");
    log("PASS: conclusão na fila.");
  } catch (e) {
    log("FALHA: " + e.message);
  } finally {
    for (const r of podeLimpar ? refs : []) {
      try {
        await r.delete();
        log("Removido: " + r.path);
      } catch (e) {
        log("LIMPEZA PENDENTE " + r.path + ": " + e.message);
      }
    }
    log("Teste encerrado.");
    document.getElementById("executar").disabled = false;
  }
}
