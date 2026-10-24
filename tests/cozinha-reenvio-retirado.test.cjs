const assert = require("node:assert/strict");
const { context: ctx, mockDb } = require("./operacao.test.cjs");
const clone = (x) => JSON.parse(JSON.stringify(x));
ctx.document.getElementById = () => null;
ctx.confirmarOperacao = async () => true;
let impressao = null;
let aviso = "";
ctx.abrirImpressaoOperacao = (html) => (impressao = html);
ctx.avisoOperacao = (texto) => (aviso = texto);
const lanche = { nome: "Baguncinha", categoria: "lanches", tipoCarne: "artesanal", quantidade: 3 };
const totalNaFila = (db) =>
  [...db.docs.entries()]
    .filter(([id, d]) => id.startsWith("filaCozinha/") && d.status === "aguardando")
    .reduce((s, [, d]) => s + d.itens.reduce((n, i) => n + i.quantidade, 0), 0);

(async () => {
  for (const colecao of ["comandas", "pedidos"]) {
    for (const personalizado of [false, true]) {
      const id = "mesa4";
      const origem = `${colecao}/${id}`;
      const ativo = `${colecao}_${id}_ativo`;
      const fila = "filaCozinha/" + ativo;
      const db = mockDb({
        [origem]: { status: "Aberta", tipo: "Entrega", mesa: 4, itens: [lanche] },
      });
      ctx.db = db;
      const enviar = () => ctx.confirmarProducaoOperacao(colecao, id);
      await enviar();
      await ctx.concluirCozinhaOperacao(ativo);
      const novo = {
        ...lanche,
        quantidade: 1,
        adicionais: [{ nome: "Bacon", qtd: 2 }],
        observacao: "Sem salada",
      };
      const itens = personalizado ? [lanche, novo] : [{ ...lanche, quantidade: 4 }];
      await db.collection(colecao).doc(id).update({ itens });
      await enviar();
      assert.equal(db.docs.get(fila).itens[0].quantidade, 1);
      await ctx.retirarDaFilaCozinhaOperacao(ativo);
      assert.equal(db.docs.get(fila).status, "retirado");
      const antes = JSON.stringify([...db.docs]);
      const pendentes = await ctx.buscarItensPendentesPreparoOperacao(colecao, id, itens);
      assert.equal(pendentes.length, 1);
      assert.equal(pendentes[0].quantidade, 1);
      if (personalizado) {
        assert.deepEqual(clone(pendentes[0].adicionais), novo.adicionais);
        assert.equal(pendentes[0].observacao, "Sem salada");
      }
      impressao = null;
      await ctx.imprimirRegistroOperacao(colecao, id, "cozinha");
      assert.match(impressao, /1 Baguncinha/);
      assert.doesNotMatch(impressao, /[34] Baguncinha/);
      assert.equal(
        JSON.stringify([...db.docs]),
        antes,
        "Imprimir não modifica o preparo nem a compra",
      );
      await ctx.imprimirRegistroOperacao(colecao, id, "geral");
      assert.match(impressao, personalizado ? /3 Baguncinha/ : /4 Baguncinha/);
      if (colecao === "comandas") {
        await ctx.imprimirMesaOperacao(4, "cozinha");
        assert.match(impressao, /1 Baguncinha/);
        assert.doesNotMatch(impressao, /[34] Baguncinha/);
      }
      await enviar();
      await enviar();
      assert.equal(db.docs.get(fila).status, "aguardando");
      assert.equal(db.docs.get(fila).itens[0].quantidade, 1);
      assert.equal([...db.docs.values()].filter((d) => d.status === "pronto").length, 1);
      assert.deepEqual(db.docs.get(origem).itens, itens);
      await ctx.concluirCozinhaOperacao(ativo);
      await enviar();
      impressao = null;
      await ctx.imprimirRegistroOperacao(colecao, id, "cozinha");
      assert.equal(impressao, null, "Não reimprime os quatro itens já prontos");
      assert.match(aviso, /Nenhum item pendente/);
    }
  }
  const agora = Date.now();
  let horario = agora;
  ctx.Date = class extends Date {
    static now() {
      return horario;
    }
  };
  for (const colecao of ["comandas", "pedidos"]) {
    for (const prontoAntesLimpeza of [false, true]) {
      horario += 1000;
      const id = "limpeza";
      const origem = `${colecao}/${id}`;
      const ativo = `${colecao}_${id}_ativo`;
      const fila = "filaCozinha/" + ativo;
      const db = mockDb({
        [origem]: { status: "Aberta", tipo: "Entrega", mesa: 4, itens: [lanche] },
      });
      ctx.db = db;
      const enviar = () => ctx.confirmarProducaoOperacao(colecao, id);
      await enviar();
      if (prontoAntesLimpeza) await ctx.concluirCozinhaOperacao(ativo);
      horario += 100;
      await ctx.limparTelasProducaoOperacao();
      horario += 100;
      await db
        .collection(colecao)
        .doc(id)
        .update({ itens: [{ ...lanche, quantidade: 4 }] });
      await enviar();
      assert.equal(db.docs.get(fila).itens[0].quantidade, 1);
      await ctx.retirarDaFilaCozinhaOperacao(ativo);
      await ctx.imprimirRegistroOperacao(colecao, id, "cozinha");
      assert.match(
        impressao,
        /1 Baguncinha/,
        "Após Limpar e Excluir, imprime apenas o último lanche",
      );
      assert.doesNotMatch(impressao, /[34] Baguncinha/);
      horario += 100;
      await enviar();
      assert.equal(db.docs.get(fila).itens[0].quantidade, 1);
      await ctx.retirarDaFilaCozinhaOperacao(ativo);
      await db
        .collection(colecao)
        .doc(id)
        .update({ itens: [{ ...lanche, quantidade: 6 }] });
      horario += 100;
      await enviar();
      assert.equal(totalNaFila(db), 3, "Um retirado mais dois itens novos em seus lotes");
      await enviar();
      assert.equal(totalNaFila(db), 3, "Repetir envio não duplica itens");
      await ctx.imprimirRegistroOperacao(colecao, id, "cozinha");
      assert.match(impressao, /3 Baguncinha/);
      assert.doesNotMatch(impressao, /6 Baguncinha/);
    }
  }
  // Comanda que já perdeu o registro antigo com a versão anterior do sistema.
  for (const status of ["retirado", "aguardando", "pronto"]) {
    horario += 1000;
    const limpaAntes = horario - 200;
    const atual = { ...lanche, quantidade: 4 };
    const db = mockDb({
      "config/producaoTela": { limpaAntes },
      "comandas/legado": {
        status: "Aberta",
        mesa: 4,
        itens: [atual],
        itensEnviadosCozinha: [atual],
        cozinhaConfirmadaEm: horario - 100,
      },
      "filaCozinha/comandas_legado_ativo": {
        origemColecao: "comandas",
        origemId: "legado",
        status,
        criadoEmMs: horario - 100,
        itens: [{ ...lanche, quantidade: 1 }],
      },
    });
    ctx.db = db;
    impressao = null;
    await ctx.imprimirRegistroOperacao("comandas", "legado", "cozinha");
    if (status === "pronto") assert.equal(impressao, null);
    else assert.match(impressao, /1 Baguncinha/, "Recupera a base da comanda já afetada");
    await ctx.confirmarProducaoOperacao("comandas", "legado");
    const fila = db.docs.get("filaCozinha/comandas_legado_ativo");
    assert.equal(fila.itens[0].quantidade, 1);
    assert.equal(fila.status, status === "pronto" ? "pronto" : "aguardando");
    assert.equal([...db.docs.values()].filter((d) => d.status === "limpo").length, 1);
    await db
      .collection("comandas")
      .doc("legado")
      .update({ itens: [{ ...lanche, quantidade: 6 }] });
    await ctx.confirmarProducaoOperacao("comandas", "legado");
    assert.equal(totalNaFila(db), status === "pronto" ? 2 : 3);
  }
  horario += 1000;
  const dbNovo = mockDb({
    "config/producaoTela": { limpaAntes: horario - 200 },
    "comandas/nova": {
      status: "Aberta",
      mesa: 4,
      itens: [lanche],
      itensEnviadosCozinha: [lanche],
      cozinhaConfirmadaEm: horario - 100,
    },
    "filaCozinha/comandas_nova_ativo": {
      origemColecao: "comandas",
      origemId: "nova",
      status: "retirado",
      criadoEmMs: horario - 100,
      itens: [lanche],
    },
  });
  ctx.db = dbNovo;
  await ctx.confirmarProducaoOperacao("comandas", "nova");
  assert.equal(
    dbNovo.docs.get("filaCozinha/comandas_nova_ativo").itens[0].quantidade,
    3,
    "Um primeiro envio após a limpeza continua integral",
  );
  assert.equal(
    ctx.itensPendentesPreparoOperacao(
      [lanche],
      [{ status: "retirado", criadoEmMs: agora, itens: [lanche] }],
      agora - 1000,
    )[0].quantidade,
    3,
    "Retirar o primeiro envio inteiro permite reenviar os três itens",
  );
  assert.equal(
    ctx.itensPendentesPreparoOperacao(
      [lanche],
      [{ status: "retirado", criadoEmMs: agora - 2000, itens: [lanche] }],
      agora - 1000,
    ).length,
    0,
    "A limpeza global das telas continua preservando os envios anteriores ao corte",
  );
  console.log(
    "PASS: Limpar → adicionar → Excluir → reenviar mantém apenas o retirado + novos; três prontos preservados, impressão pendente, recuperação do registro antigo e conferência geral integral.",
  );
})().catch((erro) => {
  console.error(erro);
  process.exitCode = 1;
});
