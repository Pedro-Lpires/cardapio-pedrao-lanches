const assert = require("node:assert/strict");
const { context: ctx, mockDb } = require("./operacao.test.cjs");
ctx.document.getElementById = () => null;
ctx.avisoOperacao = () => {};
let resposta = true,
  perguntas = 0,
  impressao = null;
ctx.confirmarOperacao = async () => {
  perguntas++;
  return resposta;
};
ctx.abrirImpressaoOperacao = (h) => {
  impressao = h;
  return true;
};
let hora = Date.now();
ctx.Date = class extends Date {
  static now() {
    return hora;
  }
};
const item = { nome: "Baguncinha", categoria: "lanches", quantidade: 3 };
const qtd = (db) =>
  [...db.docs]
    .filter(([k, v]) => k.startsWith("filaCozinha/") && v.status === "aguardando")
    .reduce((s, [, v]) => s + v.itens.reduce((n, i) => n + i.quantidade, 0), 0);
(async () => {
  for (const colecao of ["comandas", "pedidos"])
    for (const pronto of [false, true]) {
      hora += 1000;
      const id = "p",
        ativo = colecao + "_p_ativo";
      const db = mockDb({
        [colecao + "/" + id]: { status: "Aberta", tipo: "Entrega", itens: [item] },
      });
      ctx.db = db;
      const enviar = () => ctx.confirmarProducaoOperacao(colecao, id);
      await enviar();
      assert.equal(qtd(db), 3);
      if (pronto) await ctx.concluirCozinhaOperacao(ativo);
      hora += 100;
      await ctx.limparTelasProducaoOperacao();
      hora += 100;
      await db
        .collection(colecao)
        .doc(id)
        .update({ itens: [{ ...item, quantidade: 4 }] });
      const antes = perguntas;
      await enviar();
      assert.equal(perguntas, antes, "Há itens novos: não pergunta sobre reenvio completo");
      assert.equal(
        db.docs.get("filaCozinha/" + ativo).itens[0].quantidade,
        pronto ? 1 : 4,
        "Só o OK subtrai os três lanches anteriores",
      );
      await enviar();
      assert.equal(qtd(db), pronto ? 1 : 4, "Repetir não duplica remessas");
      await ctx.retirarDaFilaCozinhaOperacao(ativo);
      await enviar();
      assert.equal(qtd(db), pronto ? 1 : 4, "Excluir da tela sem OK permite voltar");
      await ctx.concluirCozinhaOperacao(ativo);
      resposta = false;
      assert.equal(await enviar(), false, "Recusar não reabre o preparo");
      assert.equal(qtd(db), 0);
      impressao = null;
      await ctx.imprimirRegistroOperacao(colecao, id, "cozinha");
      assert.equal(impressao, null, "Recusar impressão já feita não envia");
      resposta = true;
      await enviar();
      assert.equal(qtd(db), 4, "Confirmar reenvia o pedido inteiro");
      await enviar();
      assert.equal(qtd(db), 4, "Reenvio completo continua idempotente enquanto aguarda");
      await ctx.imprimirRegistroOperacao(colecao, id, "cozinha");
      assert.match(impressao, /4 Baguncinha/);
      const detalhe = {
        ...item,
        quantidade: 1,
        adicionais: [{ nome: "Bacon", qtd: 1 }],
        observacao: "Sem salada",
      };
      await db
        .collection(colecao)
        .doc(id)
        .update({ itens: [{ ...item, quantidade: 4 }, detalhe] });
      hora += 100;
      await enviar();
      assert.equal(qtd(db), 5, "Personalização nova vira lote adicional");
      assert.equal(
        (
          await ctx.buscarItensPendentesPreparoOperacao(colecao, id, [
            { ...item, quantidade: 4 },
            detalhe,
          ])
        ).length,
        2,
      );
    }
  console.log(
    "PASS: apenas OK conclui; limpar/excluir mantém pendências; reenvio total exige confirmação, não duplica, preserva lotes novos e observações.",
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
