/** Recuperação paginada de emissões: cursor persistido e trava entre painéis. */
"use strict";
const FONTES_RECUPERACAO_RASPA = [
  ["pedidos", "pagamentoConfirmadoEm"],
  ["comandas", "fechadoEm"],
  ["historicoPagamentosClientes", "criadoEmMs"],
];
const TAMANHO_LOTE_RECUPERACAO_RASPA = 10;
let timerRecuperacaoRaspa = null;
let tarefaRecuperacaoRaspa = null;
let recuperacaoRaspaLigada = false;
function atualizarStatusRecuperacaoRaspadinha(texto) {
  const status = document.getElementById("raspa-recuperacao-status");
  if (status) status.textContent = texto;
}
function pararRecuperacaoRaspadinha() {
  recuperacaoRaspaLigada = false;
  clearTimeout(timerRecuperacaoRaspa);
}
function agendarRecuperacaoRaspadinha(atraso = 120000) {
  recuperacaoRaspaLigada = true;
  clearTimeout(timerRecuperacaoRaspa);
  timerRecuperacaoRaspa = setTimeout(() => recuperarPendenciasRaspadinha(), atraso);
}
function recuperarPendenciasRaspadinha() {
  if (tarefaRecuperacaoRaspa) return tarefaRecuperacaoRaspa;
  tarefaRecuperacaoRaspa = executarRecuperacaoRaspadinha().finally(() => {
    tarefaRecuperacaoRaspa = null;
  });
  return tarefaRecuperacaoRaspa;
}
async function executarRecuperacaoRaspadinha() {
  const botao = document.getElementById("raspa-conferir");
  if (botao) botao.disabled = true;
  const ref = db.collection("config").doc("recuperacaoRaspadinhas");
  const dono = Date.now() + "-" + codigoRaspadinha();
  let possuiTrava = false;
  let proxima = 120000;
  let processados = 0;
  try {
    // Uma trava com validade permite retomar após fechar o navegador ou perder conexão.
    const estado = await db.runTransaction(async (t) => {
      const doc = await t.get(ref);
      const dados = doc.exists ? doc.data() : {};
      if (Number(dados.travaAte || 0) > Date.now()) return null;
      t.set(ref, { travaDono: dono, travaAte: Date.now() + 120000 }, { merge: true });
      return dados;
    });
    if (!estado) {
      atualizarStatusRecuperacaoRaspadinha("Outro painel já está conferindo as pendências.");
      return;
    }
    possuiTrava = true;
    const regras = await db.collection("campanhasRaspadinhas").where("ativa", "==", true).get();
    const automaticas = regras.docs.map((d) => d.data()).filter((r) => r.modo === "automatico");
    if (!automaticas.length) {
      atualizarStatusRecuperacaoRaspadinha(
        "Nenhuma campanha automática ativa. Cadastre ou ative uma campanha para começar.",
      );
      proxima = 300000;
      return;
    }
    const inicio = Math.min(
      ...automaticas.map((r) => Number(r.criadoEm || r.inicioEm || Date.now())),
    );
    const limite = Date.now();
    let mais = false;
    for (const [colecao, campo] of FONTES_RECUPERACAO_RASPA) {
      if (Date.now() >= limite + 90000)
        throw Error("A conferência demorou. Continuaremos no próximo lote.");
      const salvo = estado.cursores?.[colecao];
      let consulta = db
        .collection(colecao)
        .where(campo, ">=", inicio)
        .where(campo, "<=", limite)
        .orderBy(campo)
        .orderBy("__name__")
        .limit(TAMANHO_LOTE_RECUPERACAO_RASPA);
      if (salvo) consulta = consulta.startAfter(salvo.tempo, salvo.id);
      const lote = await consulta.get();
      for (const doc of lote.docs) {
        const dados = doc.data();
        if (colecao === "historicoPagamentosClientes") {
          if (dados.comandaId)
            await verificarRaspadinhasCompra("comandas", dados.comandaId, null, true);
        } else {
          await verificarRaspadinhasCompra(colecao, doc.id, dados, true);
        }
        processados++;
      }
      if (!lote.docs.length) continue;
      const ultimo = lote.docs.at(-1);
      const cursor = { tempo: Number(ultimo.data()[campo]), id: ultimo.id };
      // Só avança após todo o lote ter sido conferido. Uma falha repete o lote,
      // mas a concessão transacional já existente impede duplicar os prêmios.
      await db.runTransaction(async (t) => {
        const doc = await t.get(ref);
        const atual = doc.data();
        if (atual.travaDono !== dono || Number(atual.travaAte) <= Date.now()) {
          throw Error(
            "Outro painel assumiu a conferência. O lote será verificado novamente com segurança.",
          );
        }
        t.set(
          ref,
          {
            cursores: { ...atual.cursores, [colecao]: cursor },
            conferidoEm: Date.now(),
            travaAte: Date.now() + 120000,
          },
          { merge: true },
        );
      });
      mais ||= lote.docs.length === TAMANHO_LOTE_RECUPERACAO_RASPA;
    }
    proxima = mais ? 30000 : 120000;
    atualizarStatusRecuperacaoRaspadinha(
      mais
        ? `${processados} registros conferidos. O próximo lote continuará automaticamente.`
        : `Conferência em dia. ${processados} registros conferidos neste lote; prêmios elegíveis foram emitidos sem duplicação.`,
    );
  } catch (erro) {
    proxima = 300000;
    atualizarStatusRecuperacaoRaspadinha(
      "Conferência pausada. O progresso foi mantido e será retomado automaticamente. " +
        erro.message,
    );
    console.error("Recuperação de raspadinhas pausada:", erro.message);
  } finally {
    if (possuiTrava) {
      try {
        await db.runTransaction(async (t) => {
          const doc = await t.get(ref);
          if (doc.data()?.travaDono === dono)
            t.set(ref, { travaDono: null, travaAte: 0 }, { merge: true });
        });
      } catch {
        // A trava expira sozinha se o banco estiver indisponível.
      }
    }
    if (botao) botao.disabled = false;
    if (recuperacaoRaspaLigada) agendarRecuperacaoRaspadinha(proxima);
  }
}
