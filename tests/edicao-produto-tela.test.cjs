const fs = require("node:fs"),
  vm = require("node:vm"),
  assert = require("node:assert/strict");
const campos = {};
const campo = (id) => (campos[id] ||= { textContent: "0", value: "", checked: false });
let itemAtual,
  painelPronto = false;
const ctx = vm.createContext({
  document: { getElementById: campo, querySelector: () => campo("radio") },
  db: {
    collection: () => ({
      doc: () => ({ get: async () => ({ exists: true, data: () => ({ itens: [itemAtual] }) }) }),
    }),
  },
  alert: (msg) => assert.fail(msg),
  abrirPainelProduto: async () => {
    await Promise.resolve();
    painelPronto = true;
  },
  mostrarAcrescimosProduto: () => assert.fail("Restaurar extras não deve abrir a janela"),
  selecionarModoCombo: () => assert.fail("Restaurar modo do combo não deve abrir a janela"),
  atualizarPrecoProduto() {},
  atualizarPrecoComboPersonalizado() {},
  atualizarResumoTodosCombo() {},
  atualizarTodosStatusLanchesCombo() {},
});
const fonte = fs.readFileSync("js/atendente.js", "utf8");
for (const nome of [
  "editarItemComanda",
  "editarProdutoNormalComanda",
  "editarComboComanda",
  "editarItemPedidoEntrega",
  "editarItemPedidoRetirada",
]) {
  const inicio = fonte.indexOf("async function " + nome + "(");
  const fim = fonte.slice(inicio + 1).search(/\n(?:async )?function /);
  vm.runInContext(fonte.slice(inicio, fim < 0 ? undefined : inicio + 1 + fim), ctx);
}
(async () => {
  for (const categoria of ["lanches", "batatas"]) {
    itemAtual = {
      categoria,
      produtoId: "produto",
      tipo: "artesanal",
      quantidade: 1,
      observacao: "Sem salada",
      adicionais: [{ id: "tomate", qtd: 2 }],
    };
    painelPronto = false;
    await ctx.editarItemComanda("comanda", 0);
    assert.ok(painelPronto);
    assert.equal(campo("qtd-adicional-tomate").textContent, 2);
    assert.equal(campo("observacao-produto-config").value, "Sem salada");
  }
  for (const modo of ["todos", "individual"]) {
    itemAtual = {
      categoria: "combos",
      produtoId: "combo",
      quantidade: 1,
      modoPersonalizacaoCombo: modo,
      lanchesCombo: [
        {
          numero: 1,
          adicionais: [{ id: "bacon", nome: "Bacon", preco: 5, qtd: 1 }],
          observacao: "Sem cebola",
        },
      ],
    };
    await ctx.editarItemComanda("comanda", 0);
    assert.equal(ctx.modoPersonalizacaoCombo, modo);
    assert.equal(
      (modo === "todos" ? ctx.configuracaoTodosCombo : ctx.configuracoesLanchesCombo[1])
        .adicionais[0].qtd,
      1,
    );
    for (const fluxo of ["Entrega", "Retirada"]) {
      ctx["pedido" + fluxo + "Atual"] = { itens: [itemAtual] };
      await ctx["editarItemPedido" + fluxo](0);
      assert.equal(ctx.modoPersonalizacaoCombo, modo);
    }
  }
  console.log(
    "PASS: editar lanche, batata e combo restaura acréscimos e observações no painel principal, sem abrir janelas secundárias.",
  );
})().catch((erro) => {
  console.error(erro);
  process.exitCode = 1;
});
