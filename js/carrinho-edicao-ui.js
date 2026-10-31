/* Reutiliza o card do cardápio; o carrinho só muda ao salvar. */
let modoEdicaoCarrinhoUI = false;
let edicaoProdutoCarrinhoUI = null;
const catalogoCarrinhoUI = new Map();
function alternarEdicaoCarrinhoUI() {
  modoEdicaoCarrinhoUI = !modoEdicaoCarrinhoUI;
  atualizarModoEdicaoCarrinhoUI();
  renderizarCarrinho();
}
function atualizarModoEdicaoCarrinhoUI() {
  const botao = document.getElementById("editar-carrinho-ui");
  botao?.setAttribute("aria-pressed", String(modoEdicaoCarrinhoUI));
  if (botao) botao.textContent = modoEdicaoCarrinhoUI ? "Concluir edição" : "Editar";
}
function editarItemCarrinhoUI(indice) {
  const original = carrinho[indice];
  if (!original || !modoEdicaoCarrinhoUI) return;
  const produto =
    catalogoCarrinhoUI.get(original.produtoId) ||
    window.catalogoProdutosDeliveryUI?.get(original.produtoId) ||
    buscarProdutoAtual(original.nome);
  if (!produto || produto.esgotado || produto.somenteAtendente)
    return avisoOperacao("Este item não está disponível no cardápio. Remova-o e escolha outro.");
  const categoria =
    { lanches: "Lanches", combos: "Combos", batatas: "Batatas", bebidas: "Bebidas" }[
      String(original.categoria).toLowerCase()
    ] || "Lanches";
  abrirProduto(produto, categoria);
  edicaoProdutoCarrinhoUI = { indice, original };
  document.getElementById("modal-carrinho").style.display = "none";
  qtdProdutoAtual = Number(original.qtd || original.quantidade || 1);
  document.getElementById("qtd-produto").innerText = qtdProdutoAtual;
  document.getElementById("obs-produto").value = original.obs || original.observacao || "";
  const tipo = String(
    original.tipoCarne || original.tipo || original.nome.match(/\(([^)]+)\)$/)?.[1] || "",
  ).toLowerCase();
  const radios = [...document.querySelectorAll("#modal-opcoes-tipo input")];
  const normalizar = (v) =>
    String(v)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  (radios.find((r) => normalizar(r.value) === normalizar(tipo)) || radios[0])?.click();
  Object.entries(adicionaisSelecionados).forEach(([n, a]) => {
    const salvo = (original.adicionais || []).find((x) => x.nome === a.nome);
    a.qtd = Number(salvo?.qtd || salvo?.quantidade || 0);
    document.getElementById("qtd-adicional-" + n).innerText = a.qtd;
  });
  atualizarResumoAdicionaisProdutoUI("lista-adicionais");
  if (categoria === "Combos" && original.lanchesCombo?.length) {
    comboSiteUI.lanches = original.lanchesCombo.map((c) => ({
      adicionais: Object.fromEntries(
        (c.adicionais || []).map((a) => [
          a.id || adicionais.find((x) => x.nome === a.nome)?.id || a.nome,
          { ...a, qtd: Number(a.qtd || a.quantidade || 0) },
        ]),
      ),
      observacao: c.observacao || "",
    }));
    comboSiteUI.modo = comboSiteUI.lanches.every(
      (c) => JSON.stringify(c) === JSON.stringify(comboSiteUI.lanches[0]),
    )
      ? "todos"
      : "individual";
    atualizarComboSiteUI();
  }
  document.querySelector('#modal-produto button[onclick="adicionarProdutoFinal()"]').textContent =
    "Salvar alterações";
}
document.addEventListener("DOMContentLoaded", () => {
  const gerar = window.gerarItens;
  window.gerarItens = (lista, ...args) => {
    lista.forEach((p) => catalogoCarrinhoUI.set(p.id, p));
    return gerar(lista, ...args);
  };
  const abrir = window.abrirProduto;
  window.abrirProduto = (...args) => {
    edicaoProdutoCarrinhoUI = null;
    const r = abrir(...args);
    document.querySelector('#modal-produto button[onclick="adicionarProdutoFinal()"]').textContent =
      "Adicionar ao carrinho";
    return r;
  };
  const adicionar = window.adicionarProdutoFinal;
  window.adicionarProdutoFinal = () => {
    const edicao = edicaoProdutoCarrinhoUI;
    if (!edicao) return adicionar();
    if (carrinho[edicao.indice] !== edicao.original)
      return avisoOperacao("O carrinho mudou. Abra a edição novamente.");
    const tamanho = carrinho.length;
    adicionar();
    if (carrinho.length !== tamanho + 1) return;
    const novo = carrinho.pop();
    carrinho[edicao.indice] = {
      ...edicao.original,
      ...novo,
      molhosGratis: edicao.original.molhosGratis,
      molhosPagos: edicao.original.molhosPagos,
      totalMolhosPagos: edicao.original.totalMolhosPagos || 0,
    };
    modoEdicaoCarrinhoUI = false;
    edicaoProdutoCarrinhoUI = null;
    atualizarModoEdicaoCarrinhoUI();
    atualizarCarrinho();
    renderizarCarrinho();
  };
  const fecharProduto = window.fecharModalProduto;
  window.fecharModalProduto = (...args) => {
    const editando = edicaoProdutoCarrinhoUI;
    edicaoProdutoCarrinhoUI = null;
    const r = fecharProduto(...args);
    if (editando) {
      document.getElementById("modal-carrinho").style.display = "flex";
      renderizarCarrinho();
    }
    return r;
  };
  const fechar = window.fecharCarrinho;
  window.fecharCarrinho = (...args) => {
    modoEdicaoCarrinhoUI = false;
    atualizarModoEdicaoCarrinhoUI();
    return fechar(...args);
  };
});
