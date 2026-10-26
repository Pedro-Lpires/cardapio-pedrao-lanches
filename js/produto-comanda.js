/**
 * Configuração de produtos e combos do atendente. Mantém a mesma personalização ao adicionar ou editar itens da comanda.
 *
 * Organização e caminhos: consulte GUIA-DO-CODIGO.md.
 */
/*

=====================================

PAINEL UNIVERSAL DO PRODUTO

Usado por:

- Cliente

- Atendente

- Edição da Comanda

- Combos

=====================================

*/
let configuracoesLanchesCombo = {};
let configuracaoTodosCombo = null;
let itemComandaEmEdicao = null;
let quantidadeLanchesComboAtual = 0;
let modoPersonalizacaoCombo = "";
let contextoPainelProduto = "comanda";
let adicionaisPainelCacheUI = null;
let adicionaisPainelBuscaUI = null;
async function buscarAdicionaisPainelUI() {
  if (adicionaisPainelCacheUI && Date.now() - adicionaisPainelCacheUI.em < 30000)
    return adicionaisPainelCacheUI.snap;
  if (!adicionaisPainelBuscaUI)
    adicionaisPainelBuscaUI = lerComPrazoUI(db.collection("adicionais").get())
      .then((snap) => {
        adicionaisPainelCacheUI = { snap, em: Date.now() };
        return snap;
      })
      .finally(() => {
        adicionaisPainelBuscaUI = null;
      });
  return adicionaisPainelBuscaUI;
}

async function abrirPainelProduto(comandaId, produtoId) {
  const doc = await db.collection("produtos").doc(produtoId).get();

  if (!doc.exists) return;

  const produto = doc.data();
  if (produto.ativo === false || produto.esgotado) {
    mostrarAvisoUI("Produto indisponível no momento.");
    return;
  }
  modoPersonalizacaoCombo = "";
  configuracoesLanchesCombo = {};
  configuracaoTodosCombo = null;

  if (produto.categoria === "combos") {
    configuracoesLanchesCombo = {};
    configuracaoTodosCombo = null;
    modoPersonalizacaoCombo = "";
  }

  let htmlAdicionais = "";

  if (produto.categoria === "combos") {
    htmlAdicionais = montarPersonalizacaoCombo(produto);
  } else {
    htmlAdicionais = await montarAdicionaisProduto(produto);
  }

  let painel = null;

  // =========================
  // ENTREGA
  // =========================

  if (contextoPainelProduto === "entrega") {
    painel = obterPainelProdutoPedidoUI();
  }

  // =========================
  // RETIRADA
  // =========================
  else if (contextoPainelProduto === "retirada") {
    painel = obterPainelProdutoPedidoUI();
  }

  // =========================
  // COMANDA
  // =========================
  else {
    painel = document.getElementById("area-comanda-atendente");

    const areaProdutos = document.getElementById("area-produtos-comanda");

    if (areaProdutos) {
      areaProdutos.style.display = "none";
    }
  }

  if (!painel) {
    return;
  }

  painel.style.display = "block";

  // =========================
  // OPÇÕES DE TIPO
  // =========================

  const tipos = tiposCarneProdutoOperacao(produto);
  const htmlOpcoes =
    tipos.length > 1
      ? '<hr><h3>Escolha o tipo</h3><div class="tipos-carne-ui" data-quantidade="' +
        tipos.length +
        '">' +
        tipos
          .map(
            (tipo, index) =>
              `<label class="tipo-produto-opcao"><input type="radio" name="tipo-produto" value="${tipo.valor}" data-preco="${tipo.preco}" ${index === 0 ? "checked" : ""} onchange="${produto.categoria === "combos" ? "atualizarPrecoComboPersonalizado" : "atualizarPrecoProduto"}()"><span>${tipo.nome}</span><small>${moedaOperacao(tipo.preco)}</small></label>`,
          )
          .join("") +
        "</div><hr>"
      : "";

  // =========================
  // HTML DO PRODUTO
  // =========================

  painel.innerHTML = `

 <button
    type="button"
    onclick="
        ${
          contextoPainelProduto === "entrega"
            ? `abrirProdutosPedidoEntrega()`
            : contextoPainelProduto === "retirada"
              ? `abrirProdutosPedidoRetirada()`
              : itemComandaEmEdicao
                ? `cancelarEdicaoItemComanda('${comandaId}')`
                : `abrirBuscaProdutos('${comandaId}')`
        }
    "
>
    ${
      contextoPainelProduto === "entrega"
        ? "⬅ Voltar aos Produtos"
        : contextoPainelProduto === "retirada"
          ? "⬅ Voltar aos Produtos"
          : itemComandaEmEdicao
            ? "⬅ Voltar para Comanda"
            : "⬅ Voltar aos Produtos"
    }
</button>


        <h2 class="produto-nome-painel-ui">
            ${produto.nome}
            ${produto.imagem || produto.img ? `<button type="button" class="foto-produto-atalho-ui" data-imagem="${escaparOperacao(resolverImagemProduto(produto.imagem || produto.img))}" data-nome="${escaparOperacao(produto.nome)}" onclick="abrirFotoProdutoUI(this)">Ver foto</button>` : ""}
        </h2>


        <h3
    id="preco-produto-config"
    data-preco-base="${Number(produto.preco || 0)}"
>
            R$ ${Number(produto.preco).toFixed(2)}
        </h3>


        ${htmlOpcoes}


        ${htmlAdicionais}
        <hr>

<h3>
    Observação
</h3>

<textarea
    id="observacao-produto-config"
    placeholder="Ex: sem tomate, sem cebola..."
    rows="3"
    style="
        width:100%;
        max-width:400px;
        box-sizing:border-box;
    "
></textarea>

<hr>
        <h3>
            Quantidade
        </h3>

        <button
            onclick="
                alterarQuantidadeProduto(-1)
            "
        >
            −
        </button>

        <strong
            id="quantidade-produto-config"
            style="
                margin-left:15px;
                margin-right:15px;
            "
        >
            1
        </strong>

        <button
            onclick="
                alterarQuantidadeProduto(1)
            "
        >
            +
        </button>


        <br><br>


 <button
    type="button"
    onclick="
        ${
          contextoPainelProduto === "entrega"
            ? `adicionarProdutoConfiguradoEntrega('${produtoId}')`
            : contextoPainelProduto === "retirada"
              ? `adicionarProdutoConfiguradoRetirada('${produtoId}')`
              : `adicionarProdutoConfiguradoComanda(
                        '${comandaId}',
                        '${produtoId}'
                    )`
        }
    "
>
    ${
      contextoPainelProduto === "entrega"
        ? "➕ Adicionar ao Pedido"
        : contextoPainelProduto === "retirada"
          ? "➕ Adicionar ao Pedido"
          : itemComandaEmEdicao
            ? "💾 Salvar Alterações"
            : "➕ Adicionar"
    }
</button>

    `;
}

function atualizarPrecoProduto() {
  // =========================
  // PREÇO BASE
  // =========================

  const opcaoTipo = document.querySelector('input[name="tipo-produto"]:checked');

  const precoTela = document.getElementById("preco-produto-config");

  if (!precoTela) {
    return;
  }

  let precoBase = 0;

  if (opcaoTipo) {
    precoBase = Number(opcaoTipo.dataset.preco || 0);
  } else {
    precoBase = Number(precoTela.dataset.precoBase || 0);
  }

  // =========================
  // ADICIONAIS
  // =========================

  let totalAdicionais = 0;

  document.querySelectorAll(".adicional-produto-config").forEach((adicional) => {
    const preco = Number(adicional.dataset.preco || 0);

    const id = adicional.dataset.id;

    const elementoQuantidade = document.getElementById(`qtd-adicional-${id}`);

    const quantidade = Number(elementoQuantidade?.textContent || 0);

    let multiplicadorCombo = 1;

    const campoQtdCombo = document.getElementById("qtd-lanches-acrescimos-combo");

    if (campoQtdCombo) {
      multiplicadorCombo = Number(campoQtdCombo.value || 1);
    }

    totalAdicionais += preco * quantidade * multiplicadorCombo;
  });

  // =========================
  // PREÇO UNITÁRIO CONFIGURADO
  // =========================

  const precoFinal = precoBase + totalAdicionais;

  precoTela.textContent = `R$ ${precoFinal.toFixed(2)}`;
  if (typeof atualizarResumoAdicionaisProdutoUI === "function")
    atualizarResumoAdicionaisProdutoUI("area-acrescimos-produto");
}

async function carregarCategoriaProdutos(comandaId, categoria, manterAberta = false) {
  const area = document.getElementById("area-produtos-comanda");
  if (area?.dataset) {
    if (
      !manterAberta &&
      !area.dataset.buscaAtivaUi &&
      area.dataset.categoriaAtivaUi === categoria
    ) {
      area.dataset.categoriaAtivaUi = "";
      document.getElementById("lista-categoria-produtos").innerHTML = "";
      return;
    }
    area.dataset.categoriaAtivaUi = categoria;
    area.dataset.buscaAtivaUi = "";
    const busca = document.getElementById("busca-produto-atendente");
    if (busca) busca.value = "";
  }
  contextoPainelProduto = "comanda";

  const lista = document.getElementById("lista-categoria-produtos");

  lista.innerHTML = htmlCarregandoUI("Carregando produtos…");

  const snap = await db.collection("produtos").orderBy("ordem").get();

  let html = "";

  snap.forEach((doc) => {
    const p = doc.data();

    if (!p.ativo || p.esgotado) return;

    if (p.categoria != categoria) return;

    html += `

<button
onclick="
abrirPainelProduto(
'${comandaId}',
'${doc.id}'
)
"
>

${p.nome}

</button>

<br><br>

`;
  });

  document.getElementById("resultado-busca-produtos").innerHTML = "";

  lista.innerHTML = html;
}
async function montarAdicionaisProduto(produto) {
  if (String(produto.categoria).toLowerCase() === "bebidas" || !produto.permiteAdicionais) {
    return "";
  }

  const snap = await buscarAdicionaisPainelUI();

  let adicionais = [];

  snap.forEach((doc) => {
    const adicional = {
      id: doc.id,
      ...doc.data(),
    };

    if (!adicional.ativo) return;

    if (adicional.esgotado) return;

    if (
      produto.modoAdicional === "selecionar" &&
      !(produto.adicionaisPermitidos || []).includes(doc.id)
    ) {
      return;
    }

    adicionais.push(adicional);
  });

  adicionais.sort((a, b) => Number(a.ordem || 999) - Number(b.ordem || 999));

  if (adicionais.length === 0) {
    return "";
  }

  const qtdLanchesCombo = Number(produto.comboQtdLanches || 1);

  const ehCombo = produto.categoria === "combos" && qtdLanchesCombo > 1;

  let htmlQuantidadeCombo = "";

  if (ehCombo) {
    htmlQuantidadeCombo = `

            <div
                id="area-aplicar-acrescimos-combo"
                style="margin-bottom:15px;"
            >

                <h4>
                    Aplicar os acréscimos em:
                </h4>

                <select
                    id="qtd-lanches-acrescimos-combo"
                    onchange="
                        atualizarPrecoProduto()
                    "
                >

                    <option
                        value="${qtdLanchesCombo}"
                    >
                        Todos os ${qtdLanchesCombo} lanches
                    </option>

        `;

    for (let i = 1; i < qtdLanchesCombo; i++) {
      htmlQuantidadeCombo += `

                <option value="${i}">
                    ${i} ${i === 1 ? "lanche" : "lanches"}
                </option>

            `;
    }

    htmlQuantidadeCombo += `

                </select>

            </div>

        `;
  }

  let htmlLista = "";

  adicionais.forEach((adicional) => {
    htmlLista += `

            <div
                class="adicional-produto-config adicional-combo-auto"
                data-id="${adicional.id}"
                data-nome="${adicional.nome}"
                data-preco="${Number(adicional.preco || 0)}"
                style="
                    margin-bottom:15px;
                "
            >
<div class="info-adicional-combo-auto">

                    <strong>
                        ${adicional.nome}
                    </strong>

                    <span>R$ ${Number(adicional.preco || 0).toFixed(2)}</span>

                </div>


                <div class="controle-adicional-combo-auto">

                    <button
                        type="button"
                        onclick="
                            alterarQuantidadeAdicional(
                                '${adicional.id}',
                                -1
                            )
                        "
                    >
                        −
                    </button>


                    <strong
                        id="qtd-adicional-${adicional.id}"
                        class="qtd-adicional-produto"
                        data-adicional-id="${adicional.id}"
                        style="
                            margin-left:12px;
                            margin-right:12px;
                        "
                    >
                        0
                    </strong>


                    <button
                        type="button"
                        onclick="
                            alterarQuantidadeAdicional(
                                '${adicional.id}',
                                1
                            )
                        "
                    >
                        +
                    </button>

                </div>

            </div>

        `;
  });

  return `

        <hr>

        <div class="acrescimos-opcoes-atendente"><button type="button" onclick="mostrarAcrescimosProduto(true)">Acréscimos</button></div>


        <div
            id="area-acrescimos-produto"
            style="
                display:none;
                margin-top:15px;
            "
        >

            ${htmlQuantidadeCombo}

            <h3>
                Adicionais
            </h3>

            <div class="adicionais-grade-atendente">${htmlLista}</div>

        </div>

    `;
}
function configuracaoComboTemAlteracoes(configuracao) {
  return (
    !!configuracao &&
    ((configuracao.adicionais || []).some((a) => Number(a.qtd ?? a.quantidade ?? 0) > 0) ||
      !!(configuracao.observacao || "").trim())
  );
}
function configuracoesAtivasCombo() {
  return modoPersonalizacaoCombo === "todos"
    ? [configuracaoTodosCombo]
    : modoPersonalizacaoCombo === "individual"
      ? Object.values(configuracoesLanchesCombo)
      : [];
}
function alterarQuantidadeProduto(valor) {
  const elemento = document.getElementById("quantidade-produto-config");

  if (!elemento) return;

  const configuracoes = configuracoesAtivasCombo();
  const temAcrescimos =
    produtoTemAcrescimos() ||
    configuracoes.some((c) =>
      (c?.adicionais || []).some((a) => Number(a.qtd ?? a.quantidade ?? 0) > 0),
    );
  if (valor > 0 && (temAcrescimos || configuracoes.some(configuracaoComboTemAlteracoes))) {
    elemento.textContent = "1";
    alert(
      temAcrescimos
        ? "Retire os acréscimos para aumentar a quantidade."
        : "Remova as observações dos lanches para aumentar a quantidade.",
    );
    return;
  }

  let quantidade = Number(elemento.textContent) || 1;

  quantidade += valor;

  if (quantidade < 1) {
    quantidade = 1;
  }

  elemento.textContent = quantidade;
}
function alterarQuantidadeAdicional(adicionalId, valor) {
  const elemento = document.getElementById(`qtd-adicional-${adicionalId}`);

  if (!elemento) {
    return;
  }

  let quantidade = Number(elemento.textContent) || 0;

  quantidade += valor;

  if (quantidade < 0) {
    quantidade = 0;
  }

  elemento.textContent = quantidade;

  atualizarPrecoProduto();
  ajustarQuantidadePorAcrescimos();
}

function produtoTemAcrescimos() {
  let temAcrescimo = false;

  document.querySelectorAll(".adicional-produto-config").forEach((adicional) => {
    const id = adicional.dataset.id;

    const elementoQuantidade = document.getElementById(`qtd-adicional-${id}`);

    const quantidade = Number(elementoQuantidade?.textContent || 0);

    if (quantidade > 0) {
      temAcrescimo = true;
    }
  });

  return temAcrescimo;
}
function ajustarQuantidadePorAcrescimos() {
  const quantidadePrincipal = document.getElementById("quantidade-produto-config");

  if (!quantidadePrincipal) return;

  if (produtoTemAcrescimos()) {
    quantidadePrincipal.textContent = "1";
  }
}
function obterAcrescimosSelecionados() {
  const adicionais = [];
  let qtdLanchesAplicados = 1;

  const campoQtdCombo = document.getElementById("qtd-lanches-acrescimos-combo");

  if (campoQtdCombo) {
    qtdLanchesAplicados = Number(campoQtdCombo.value || 1);
  }
  document.querySelectorAll(".adicional-produto-config").forEach((adicional) => {
    const id = adicional.dataset.id;

    const quantidade = Number(document.getElementById(`qtd-adicional-${id}`)?.textContent || 0);

    if (quantidade <= 0) return;

    adicionais.push({
      id,

      nome: adicional.dataset.nome,

      preco: Number(adicional.dataset.preco || 0),

      qtd: quantidade,

      qtdLanchesAplicados,
    });
  });

  return adicionais;
}
async function adicionarProdutoConfiguradoComanda(comandaId, produtoId) {
  const docProduto = await db.collection("produtos").doc(produtoId).get();

  if (!docProduto.exists) {
    return alert("Produto não encontrado.");
  }

  const produto = docProduto.data();
  if (produto.ativo === false || produto.esgotado) {
    mostrarAvisoUI("Produto indisponível no momento.");
    return;
  }

  // =========================
  // QUANTIDADE
  // =========================

  let quantidade = Number(document.getElementById("quantidade-produto-config")?.textContent || 1);

  // =========================
  // OBSERVAÇÃO GERAL
  // =========================

  const observacao = document.getElementById("observacao-produto-config")?.value.trim() || "";

  // =====================================================
  // COMBO
  // =====================================================

  if (produto.categoria === "combos") {
    await adicionarComboConfiguradoComanda(comandaId, produtoId, produto, quantidade, observacao);

    return;
  }

  // =====================================================
  // PRODUTO NORMAL
  // =====================================================

  // =========================
  // TIPO
  // =========================

  const opcaoTipo = document.querySelector('input[name="tipo-produto"]:checked');

  const tipo = opcaoTipo ? opcaoTipo.value : "";

  // =========================
  // PREÇO BASE
  // =========================

  let precoBase = Number(produto.preco || 0);

  if (opcaoTipo) {
    precoBase = Number(opcaoTipo.dataset.preco || 0);
  }

  // =========================
  // ACRÉSCIMOS
  // =========================

  const adicionais = obterAcrescimosSelecionados();

  const temAcrescimos = adicionais.length > 0;

  // =========================
  // TOTAL ACRÉSCIMOS
  // =========================

  const totalAdicionais = adicionais.reduce((total, adicional) => {
    return total + Number(adicional.preco || 0) * Number(adicional.qtd || 0);
  }, 0);

  const precoUnitario = precoBase + totalAdicionais;

  // =========================
  // BUSCAR COMANDA
  // =========================

  const refComanda = db.collection("comandas").doc(comandaId);

  const docComanda = await refComanda.get();

  if (!docComanda.exists) {
    return alert("Comanda não encontrada.");
  }

  const comanda = docComanda.data();

  const itens = comanda.itens || [];

  // =========================
  // ITEM
  // =========================

  const novoItem = {
    produtoId,

    nome: produto.nome,

    categoria: produto.categoria || "",

    tipo,

    quantidade,

    precoBase,

    precoUnitario,

    adicionais,

    observacao,

    subtotal: precoUnitario * quantidade,
  };
  // =====================================
  // EDITANDO ITEM EXISTENTE
  // =====================================

  if (itemComandaEmEdicao && itemComandaEmEdicao.comandaId === comandaId) {
    const indice = itemComandaEmEdicao.index;

    if (!itens[indice]) {
      alert("Item para edição não encontrado.");

      itemComandaEmEdicao = null;

      return;
    }

    const itemAntigo = itens[indice];
    const edicoesPendentesCozinha = registrarEdicaoPreparoComandaOperacao(
      comanda,
      indice,
      novoItem,
    );

    const pedidoOrigemId = itemAntigo.pedidoOrigemId || null;

    // =========================
    // PRESERVAR ORIGEM
    // =========================

    if (pedidoOrigemId) {
      novoItem.pedidoOrigemId = pedidoOrigemId;

      novoItem.pedidoOrigemNumero = itemAntigo.pedidoOrigemNumero || null;

      novoItem.origemPedidoExistente = true;
    }
    // Substitui o item antigo
    // pelo item atualizado

    itens[indice] = novoItem;

    // Recalcular total da comanda

    const novoTotal = itens.reduce((total, item) => {
      return total + Number(item.subtotal || 0);
    }, 0);

    await refComanda.update({
      itens,

      valorTotal: novoTotal,
      edicoesPendentesCozinha,
    });
    if (pedidoOrigemId) {
      await sincronizarPedidoOrigemDaComanda(comandaId, pedidoOrigemId);
    }

    // Sai do modo edição

    itemComandaEmEdicao = null;

    modoEditarItem = false;

    // Volta para a comanda

    abrirComandaVisual(comandaId);

    return;
  }

  // =========================
  // PRODUTO SEM ACRÉSCIMOS
  // =========================

  if (!temAcrescimos) {
    const itemExistente = itens.find(
      (item) =>
        item.produtoId === produtoId &&
        (item.tipo || "") === tipo &&
        (!item.adicionais || item.adicionais.length === 0) &&
        (item.observacao || "") === observacao,
    );

    if (itemExistente) {
      itemExistente.quantidade = Number(itemExistente.quantidade || 0) + quantidade;

      itemExistente.subtotal =
        Number(itemExistente.precoUnitario || 0) * Number(itemExistente.quantidade || 1);
    } else {
      itens.push(novoItem);
    }
  }

  // =========================
  // PRODUTO COM ACRÉSCIMO
  // =========================
  else {
    itens.push(novoItem);
  }

  // =========================
  // TOTAL COMANDA
  // =========================

  const novoTotal = itens.reduce((total, item) => {
    return total + Number(item.subtotal || 0);
  }, 0);

  await refComanda.update({
    itens,

    valorTotal: novoTotal,
  });

  abrirBuscaProdutos(comandaId);
}
function mostrarAcrescimosProduto(mostrar) {
  const area = document.getElementById("area-acrescimos-produto");

  if (!area) return;

  area.style.display = mostrar ? "block" : "none";

  if (!mostrar) {
    document.querySelectorAll(".qtd-adicional-produto").forEach((elemento) => {
      elemento.textContent = "0";
    });

    atualizarPrecoProduto();

    ajustarQuantidadePorAcrescimos();
  }
}
function montarPersonalizacaoCombo(produto) {
  const qtdLanches = Number(produto.comboQtdLanches || 0);
  quantidadeLanchesComboAtual = qtdLanches;

  if (qtdLanches <= 0) {
    return `
            <p>
                Este combo não possui
                lanches configuráveis.
            </p>
        `;
  }

  let htmlLanches = "";

  for (let i = 1; i <= qtdLanches; i++) {
    htmlLanches += `

    <div
        class="lanche-combo-config"
        id="lanche-combo-${i}"
        style="
            border:1px solid #ccc;
            padding:10px;
            margin-bottom:10px;
            border-radius:8px;
        "
    >

        <strong>
            Lanche ${i}
        </strong>

        <span
            id="status-lanche-combo-${i}"
        >
            — Padrão
        </span>

        <br><br>

        <button
            type="button"
            onclick="
                abrirConfiguracaoLancheCombo(
                    ${i}
                )
            "
        >
            Escolher
        </button>

        <button
            type="button"
            onclick="
                limparConfiguracaoLancheCombo(
                    ${i}
                )
            "
        >
            Limpar
        </button>

        <div
            id="modal-config-lanche-combo-${i}"
            style="
                display:none;
                position:relative;
                margin-top:15px;
                border:2px solid #444;
                padding:15px;
                border-radius:10px;
            "
        ></div>

    </div>

`;
  }

  return `

        <hr>

        <h3>
            Acréscimos
        </h3>

        <p>
            Como deseja configurar
            os lanches?
        </p>


        <button
            type="button"
            onclick="
                selecionarModoCombo(
                    'todos'
                )
            "
        >
            Todos
        </button>


        <button
            type="button"
            onclick="
                selecionarModoCombo(
                    'individual'
                )
            "
        >
            Individual
        </button>


        <div
            id="config-todos-combo"
            style="
                display:none;
                margin-top:15px;
            "
        >

            <h4>
    Todos os ${qtdLanches} lanches
</h4>

<p>
    A mesma configuração será
    aplicada em todos.
</p>

<div
    id="resumo-todos-combo"
    style="
        margin-bottom:15px;
    "
>
    Padrão
</div>

<button
    type="button"
    onclick="
        abrirConfiguracaoTodosCombo()
    "
>
    Escolher
</button>

<button
    type="button"
    onclick="
        limparConfiguracaoTodosCombo()
    "
>
    Limpar
</button>

<div
    id="modal-config-todos-combo"
    style="
        display:none;
        position:relative;
        margin-top:15px;
        border:2px solid #444;
        padding:15px;
        border-radius:10px;
    "
></div>

        </div>


        <div
            id="config-individual-combo"
            style="
                display:none;
                margin-top:15px;
            "
        >

            ${htmlLanches}

        </div>

        <div
    id="modal-config-lanche-combo"
    style="
        display:none;
        border:2px solid #444;
        padding:15px;
        margin-top:15px;
        border-radius:10px;
    "
></div>

    `;
}
async function selecionarModoCombo(modo) {
  const areaTodos = document.getElementById("config-todos-combo");

  const areaIndividual = document.getElementById("config-individual-combo");

  if (!areaTodos || !areaIndividual) {
    return;
  }

  // =========================
  // SE JÁ ESTÁ NO MESMO MODO
  // =========================

  if (modoPersonalizacaoCombo === modo) {
    return;
  }

  // =========================
  // TROCAR DE TODOS
  // PARA INDIVIDUAL
  // =========================

  if (
    modo === "individual" &&
    configuracaoTodosCombo &&
    ((configuracaoTodosCombo.adicionais || []).length > 0 ||
      (configuracaoTodosCombo.observacao || "").trim() !== "")
  ) {
    const confirmar = await confirmarOperacao(
      "Ao mudar para Individual, a configuração aplicada a todos será apagada. Continuar?",
    );

    if (!confirmar) {
      return;
    }

    configuracaoTodosCombo = null;
    atualizarResumoTodosCombo();
  }

  // =========================
  // TROCAR DE INDIVIDUAL
  // PARA TODOS
  // =========================

  if (modo === "todos" && Object.keys(configuracoesLanchesCombo).length > 0) {
    const confirmar = await confirmarOperacao(
      "Ao mudar para Aplicar para todos, as personalizações individuais serão apagadas. Continuar?",
    );

    if (!confirmar) {
      return;
    }

    configuracoesLanchesCombo = {};
    atualizarTodosStatusLanchesCombo();
    atualizarResumoTodosCombo();
  }

  // =========================
  // SALVAR MODO ATUAL
  // =========================

  modoPersonalizacaoCombo = modo;

  // =========================
  // MOSTRAR ÁREA
  // =========================

  if (modo === "todos") {
    areaTodos.style.display = "block";

    areaIndividual.style.display = "none";
  }

  if (modo === "individual") {
    areaTodos.style.display = "none";

    areaIndividual.style.display = "block";
  }

  // =========================
  // ATUALIZAR PREÇO
  // =========================

  atualizarPrecoComboPersonalizado();
}
async function abrirConfiguracaoLancheCombo(numeroLanche) {
  document.querySelectorAll('[id^="modal-config-lanche-combo-"]').forEach((area) => {
    area.style.display = "none";
  });

  const modal = document.getElementById(`modal-config-lanche-combo-${numeroLanche}`);

  if (!modal) return;

  modal.style.display = "block";

  modal.innerHTML = htmlCarregandoUI("Carregando…");

  const snap = await buscarAdicionaisPainelUI();

  let adicionais = [];

  snap.forEach((doc) => {
    const adicional = {
      id: doc.id,
      ...doc.data(),
    };

    if (!adicional.ativo) return;

    if (adicional.esgotado) return;

    adicionais.push(adicional);
  });

  adicionais.sort((a, b) => Number(a.ordem || 999) - Number(b.ordem || 999));

  const configuracaoAtual = configuracoesLanchesCombo[numeroLanche] || {
    adicionais: [],
    observacao: "",
  };

  let htmlAdicionais = "";

  adicionais.forEach((adicional) => {
    const salvo = configuracaoAtual.adicionais.find((item) => item.id === adicional.id);

    const quantidade = salvo ? Number(salvo.qtd || 0) : 0;

    htmlAdicionais += `

            <div class="adicional-lanche-combo adicional-combo-auto" data-id="${adicional.id}" data-nome="${adicional.nome}" data-preco="${Number(adicional.preco || 0)}">
<div class="info-adicional-combo-auto"><strong>${adicional.nome}</strong><span>R$ ${Number(adicional.preco || 0).toFixed(2)}</span></div>
<div class="controle-adicional-combo-auto"><button type="button" onclick="alterarAdicionalLancheCombo('${adicional.id}', -1)">−</button><span id="qtd-combo-adicional-${adicional.id}">${quantidade}</span><button type="button" onclick="alterarAdicionalLancheCombo('${adicional.id}', 1)">+</button></div>
</div>

        `;
  });

  modal.innerHTML = `

    <button
        type="button"
        onclick="
            fecharConfiguracaoLancheCombo(
                ${numeroLanche}
            )
        "
        style="
            position:absolute;
            top:8px;
            right:8px;
        "
    >
        ✕
    </button>

    <h3>
        Lanche ${numeroLanche}
    </h3>

    ${htmlAdicionais}

    <br>
    <hr>

<h4>
    Observação
</h4>

<textarea
    id="observacao-lanche-combo-${numeroLanche}"
    placeholder="Ex: sem tomate, sem salada..."
    rows="3"
    style="
        width:100%;
        box-sizing:border-box;
        margin-bottom:15px;
    "
>${configuracaoAtual.observacao || ""}</textarea>
    

    <button
        type="button"
        onclick="
            salvarConfiguracaoLancheCombo(
                ${numeroLanche}
            )
        "
    >
        OK
    </button>

`;
}
async function abrirConfiguracaoTodosCombo() {
  const modal = document.getElementById("modal-config-todos-combo");

  if (!modal) return;

  modal.style.display = "block";

  modal.innerHTML = htmlCarregandoUI("Carregando…");

  const snap = await buscarAdicionaisPainelUI();

  let adicionais = [];

  snap.forEach((doc) => {
    const adicional = {
      id: doc.id,
      ...doc.data(),
    };

    if (!adicional.ativo) return;

    if (adicional.esgotado) return;

    adicionais.push(adicional);
  });

  adicionais.sort((a, b) => Number(a.ordem || 999) - Number(b.ordem || 999));

  let htmlAdicionais = "";

  adicionais.forEach((adicional) => {
    const salvo = configuracaoTodosCombo?.adicionais?.find((item) => item.id === adicional.id);

    const quantidade = salvo ? Number(salvo.qtd || 0) : 0;

    htmlAdicionais += `

            <div class="adicional-todos-combo adicional-combo-auto" data-id="${adicional.id}" data-nome="${adicional.nome}" data-preco="${Number(adicional.preco || 0)}">
<div class="info-adicional-combo-auto"><strong>${adicional.nome}</strong><span>R$ ${Number(adicional.preco || 0).toFixed(2)}</span></div>
<div class="controle-adicional-combo-auto"><button type="button" onclick="alterarAdicionalTodosCombo('${adicional.id}', -1)">−</button><span id="qtd-todos-adicional-${adicional.id}">${quantidade}</span><button type="button" onclick="alterarAdicionalTodosCombo('${adicional.id}', 1)">+</button></div>
</div>

        `;
  });

  const observacaoAtual = configuracaoTodosCombo?.observacao || "";

  modal.innerHTML = `

    <button
        type="button"
        onclick="
            fecharConfiguracaoTodosCombo()
        "
        style="
            position:absolute;
            top:8px;
            right:8px;
        "
    >
        ✕
    </button>

    <h3>
        Todos os ${quantidadeLanchesComboAtual} lanches
    </h3>

    <p>
        Os acréscimos abaixo serão
        aplicados em cada lanche.
    </p>

    ${htmlAdicionais}
    <hr>

<h4>
    Observação
</h4>

<textarea
    id="observacao-todos-combo"
    placeholder="Ex: sem tomate, sem salada..."
    rows="3"
    style="
        width:100%;
        box-sizing:border-box;
        margin-bottom:15px;
    "
>${observacaoAtual}</textarea>

    <br>

    <button
        type="button"
        onclick="
            salvarConfiguracaoTodosCombo()
        "
    >
        OK
    </button>

`;
}
function alterarAdicionalLancheCombo(adicionalId, valor) {
  const elemento = document.getElementById(`qtd-combo-adicional-${adicionalId}`);

  if (!elemento) return;

  let quantidade = Number(elemento.textContent) || 0;

  quantidade += valor;

  if (quantidade < 0) {
    quantidade = 0;
  }

  elemento.textContent = quantidade;
}

function salvarConfiguracaoLancheCombo(numeroLanche) {
  const adicionais = [];

  // =========================
  // PEGAR ADICIONAIS
  // =========================

  document.querySelectorAll(".adicional-lanche-combo").forEach((adicional) => {
    const id = adicional.dataset.id;

    const quantidade = Number(
      document.getElementById(`qtd-combo-adicional-${id}`)?.textContent || 0,
    );

    if (quantidade <= 0) {
      return;
    }

    adicionais.push({
      id,

      nome: adicional.dataset.nome,

      preco: Number(adicional.dataset.preco || 0),

      qtd: quantidade,
    });
  });

  // =========================
  // PEGAR OBSERVAÇÃO
  // =========================

  const observacao =
    document.getElementById(`observacao-lanche-combo-${numeroLanche}`)?.value.trim() || "";

  // =========================
  // SALVAR CONFIGURAÇÃO
  // =========================

  if (adicionais.length === 0 && !observacao) {
    // Sem adicional e sem observação:
    // continua sendo lanche padrão

    delete configuracoesLanchesCombo[numeroLanche];
  } else {
    configuracoesLanchesCombo[numeroLanche] = {
      adicionais,

      observacao,
    };
  }

  // =========================
  // ATUALIZAR TELA
  // =========================

  atualizarStatusLancheCombo(numeroLanche);

  atualizarPrecoComboPersonalizado();

  // =========================
  // FECHAR E VOLTAR AO LANCHE
  // =========================

  fecharConfiguracaoLancheCombo(numeroLanche);
}
function atualizarStatusLancheCombo(numeroLanche) {
  const status = document.getElementById(`status-lanche-combo-${numeroLanche}`);

  if (!status) return;

  const configuracao = configuracoesLanchesCombo[numeroLanche];

  if (!configuracao || ((configuracao.adicionais || []).length === 0 && !configuracao.observacao)) {
    status.innerHTML = "— Padrão";

    return;
  }

  let partesResumo = [];

  if (configuracao.adicionais && configuracao.adicionais.length > 0) {
    const resumoAdicionais = configuracao.adicionais
      .map((adicional) => {
        return `${adicional.qtd} ${adicional.nome}`;
      })
      .join(", ");

    partesResumo.push(resumoAdicionais);
  }

  if (configuracao.observacao) {
    partesResumo.push(`Obs: ${configuracao.observacao}`);
  }

  status.innerHTML = `— ✅ ${partesResumo.join(" | ")}`;
}
function fecharConfiguracaoLancheCombo(numeroLanche) {
  const modal = document.getElementById(`modal-config-lanche-combo-${numeroLanche}`);

  if (!modal) return;

  modal.style.display = "none";

  modal.innerHTML = "";

  const cardLanche = document.getElementById(`lanche-combo-${numeroLanche}`);

  if (cardLanche) {
    cardLanche.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }
}
function alterarAdicionalTodosCombo(adicionalId, valor) {
  const elemento = document.getElementById(`qtd-todos-adicional-${adicionalId}`);

  if (!elemento) return;

  let quantidade = Number(elemento.textContent) || 0;

  quantidade += valor;

  if (quantidade < 0) {
    quantidade = 0;
  }

  elemento.textContent = quantidade;
}

function salvarConfiguracaoTodosCombo() {
  const adicionais = [];

  document.querySelectorAll(".adicional-todos-combo").forEach((adicional) => {
    const id = adicional.dataset.id;

    const quantidade = Number(
      document.getElementById(`qtd-todos-adicional-${id}`)?.textContent || 0,
    );

    if (quantidade <= 0) return;

    adicionais.push({
      id,

      nome: adicional.dataset.nome,

      preco: Number(adicional.dataset.preco || 0),

      qtd: quantidade,
    });
  });
  const observacao = document.getElementById("observacao-todos-combo")?.value.trim() || "";

  configuracaoTodosCombo = adicionais.length || observacao ? { adicionais, observacao } : null;

  atualizarResumoTodosCombo();

  atualizarPrecoComboPersonalizado();

  fecharConfiguracaoTodosCombo();
}

function atualizarResumoTodosCombo() {
  const resumo = document.getElementById("resumo-todos-combo");

  if (!resumo) return;

  if (!configuracaoTodosCombo) {
    resumo.innerHTML = "Padrão";

    return;
  }

  const adicionais = configuracaoTodosCombo.adicionais || [];

  const observacao = configuracaoTodosCombo.observacao || "";

  if (adicionais.length === 0 && !observacao) {
    resumo.innerHTML = "Padrão";

    return;
  }

  let partes = [];

  // =========================
  // ADICIONAIS
  // =========================

  adicionais.forEach((adicional) => {
    partes.push(`+ ${adicional.qtd} ${adicional.nome}`);
  });

  // =========================
  // OBSERVAÇÃO
  // =========================

  if (observacao) {
    partes.push(`Obs: ${observacao}`);
  }

  resumo.innerHTML = partes.join("<br>");
}
function atualizarPrecoComboPersonalizado() {
  if (typeof atualizarObservacaoComboUI === "function") atualizarObservacaoComboUI();
  if (configuracoesAtivasCombo().some(configuracaoComboTemAlteracoes)) {
    const quantidade = document.getElementById("quantidade-produto-config");
    if (quantidade) quantidade.textContent = "1";
  }
  const precoTela = document.getElementById("preco-produto-config");

  if (!precoTela) return;

  const opcaoTipo = document.querySelector('input[name="tipo-produto"]:checked');
  const precoBase = Number(opcaoTipo?.dataset.preco || precoTela.dataset.precoBase || 0);

  let totalAdicionais = 0;

  // =========================
  // APLICAR PARA TODOS
  // =========================

  if (configuracaoTodosCombo && configuracaoTodosCombo.adicionais) {
    configuracaoTodosCombo.adicionais.forEach((adicional) => {
      totalAdicionais +=
        Number(adicional.preco || 0) * Number(adicional.qtd || 0) * quantidadeLanchesComboAtual;
    });
  }

  // =========================
  // PERSONALIZADO
  // =========================

  Object.values(configuracoesLanchesCombo).forEach((configuracao) => {
    (configuracao.adicionais || []).forEach((adicional) => {
      totalAdicionais += Number(adicional.preco || 0) * Number(adicional.qtd || 0);
    });
  });

  const total = precoBase + totalAdicionais;

  precoTela.textContent = `R$ ${total.toFixed(2)}`;
}
function limparConfiguracaoLancheCombo(numeroLanche) {
  delete configuracoesLanchesCombo[numeroLanche];

  atualizarStatusLancheCombo(numeroLanche);

  atualizarPrecoComboPersonalizado();

  fecharConfiguracaoLancheCombo(numeroLanche);
}
function fecharConfiguracaoTodosCombo() {
  const modal = document.getElementById("modal-config-todos-combo");

  if (!modal) return;

  modal.style.display = "none";

  modal.innerHTML = "";
}
function limparConfiguracaoTodosCombo() {
  configuracaoTodosCombo = null;

  atualizarResumoTodosCombo();

  atualizarPrecoComboPersonalizado();

  fecharConfiguracaoTodosCombo();
}
function atualizarTodosStatusLanchesCombo() {
  const cards = document.querySelectorAll('[id^="status-lanche-combo-"]');

  cards.forEach((status) => {
    const numero = Number(status.id.replace("status-lanche-combo-", ""));

    atualizarStatusLancheCombo(numero);
  });
}
async function adicionarComboConfiguradoComanda(
  comandaId,
  produtoId,
  produto,
  quantidade,
  observacao,
) {
  produto = aplicarTipoComboOperacao(
    produto,
    document.querySelector('input[name="tipo-produto"]:checked')?.value,
  );
  const qtdLanches = Number(produto.comboQtdLanches || 0);

  // =========================
  // VER SE EXISTE
  // PERSONALIZAÇÃO
  // =========================

  const temConfiguracaoTodos =
    modoPersonalizacaoCombo === "todos" && configuracaoComboTemAlteracoes(configuracaoTodosCombo);

  const temConfiguracaoIndividual =
    modoPersonalizacaoCombo === "individual" &&
    Object.values(configuracoesLanchesCombo).some(configuracaoComboTemAlteracoes);

  const comboPersonalizado = temConfiguracaoTodos || temConfiguracaoIndividual;

  // Combo personalizado
  // sempre representa 1 combo específico

  if (comboPersonalizado) {
    quantidade = 1;
  }

  // =========================
  // MONTAR LANCHES DO COMBO
  // =========================

  const lanchesCombo = [];

  for (let numero = 1; numero <= qtdLanches; numero++) {
    let adicionais = [];

    // =========================
    // APLICAR PARA TODOS
    // =========================

    if (temConfiguracaoTodos) {
      adicionais = (configuracaoTodosCombo.adicionais || []).map((adicional) => ({
        id: adicional.id,

        nome: adicional.nome,

        preco: Number(adicional.preco || 0),

        qtd: Number(adicional.qtd || 0),
      }));
    }

    // =========================
    // PERSONALIZADO
    // =========================
    else if (modoPersonalizacaoCombo === "individual") {
      const configuracao = configuracoesLanchesCombo[numero];

      if (configuracao) {
        adicionais = (configuracao.adicionais || []).map((adicional) => ({
          id: adicional.id,

          nome: adicional.nome,

          preco: Number(adicional.preco || 0),

          qtd: Number(adicional.qtd || 0),
        }));
      }
    }

    let observacaoLanche = "";

    // =========================
    // OBSERVAÇÃO PARA TODOS
    // =========================

    if (temConfiguracaoTodos) {
      observacaoLanche = configuracaoTodosCombo?.observacao || "";
    }

    // =========================
    // OBSERVAÇÃO INDIVIDUAL
    // =========================
    else if (modoPersonalizacaoCombo === "individual") {
      const configuracao = configuracoesLanchesCombo[numero];

      if (configuracao) {
        observacaoLanche = configuracao.observacao || "";
      }
    }
    //SALVAR LANCHE NO COMBO

    lanchesCombo.push({
      numero,

      adicionais,

      observacao: observacaoLanche,
    });
  }

  // =========================
  // CALCULAR ACRÉSCIMOS
  // =========================

  const totalAdicionais = lanchesCombo.reduce((totalLanches, lanche) => {
    const totalLanche = (lanche.adicionais || []).reduce((total, adicional) => {
      return total + Number(adicional.preco || 0) * Number(adicional.qtd || 0);
    }, 0);

    return totalLanches + totalLanche;
  }, 0);

  const precoBase = Number(produto.preco || 0);

  const precoUnitario = precoBase + totalAdicionais;

  // =========================
  // BUSCAR COMANDA
  // =========================

  const refComanda = db.collection("comandas").doc(comandaId);

  const docComanda = await refComanda.get();

  if (!docComanda.exists) {
    return alert("Comanda não encontrada.");
  }

  const comanda = docComanda.data();

  const itens = comanda.itens || [];

  // =========================
  // COMBO NOVO
  // =========================

  const novoItem = {
    produtoId,

    nome: produto.nome,

    categoria: produto.categoria || "combos",
    tipo: produto.tipoCarne || "",

    quantidade,

    precoBase,

    precoUnitario,

    subtotal: precoUnitario * quantidade,

    observacao,

    descricao: produto.desc || produto.descricao || "",
    bebida: produto.bebida || produto.bebidaCombo || "",
    bebidas: produto.bebidas || [],
    comboComponentes: produto.comboComponentes || [],
    comboQtdLanches: qtdLanches,

    comboPersonalizado,

    modoPersonalizacaoCombo: comboPersonalizado ? modoPersonalizacaoCombo : "padrao",

    lanchesCombo,
  };

  // =====================================
  // EDITANDO COMBO EXISTENTE
  // =====================================

  if (itemComandaEmEdicao && itemComandaEmEdicao.comandaId === comandaId) {
    const indice = itemComandaEmEdicao.index;

    if (!itens[indice]) {
      alert("Combo para edição não encontrado.");

      itemComandaEmEdicao = null;

      return;
    }
    const itemAntigo = itens[indice];
    const edicoesPendentesCozinha = registrarEdicaoPreparoComandaOperacao(
      comanda,
      indice,
      novoItem,
    );

    const pedidoOrigemId = itemAntigo.pedidoOrigemId || null;

    if (pedidoOrigemId) {
      novoItem.pedidoOrigemId = pedidoOrigemId;

      novoItem.pedidoOrigemNumero = itemAntigo.pedidoOrigemNumero || null;

      novoItem.origemPedidoExistente = true;
    }

    // Substitui o combo antigo
    itens[indice] = novoItem;

    // =========================
    // RECALCULAR TOTAL
    // =========================

    const novoTotal = itens.reduce((total, item) => {
      return total + Number(item.subtotal || 0);
    }, 0);

    await refComanda.update({
      itens,

      valorTotal: novoTotal,
      edicoesPendentesCozinha,
    });
    if (pedidoOrigemId) {
      await sincronizarPedidoOrigemDaComanda(comandaId, pedidoOrigemId);
    }

    // =========================
    // ENCERRAR EDIÇÃO
    // =========================

    itemComandaEmEdicao = null;

    modoEditarItem = false;

    // =========================
    // VOLTAR PARA COMANDA
    // =========================

    abrirComandaVisual(comandaId);

    return;
  }

  // =========================
  // COMBO PADRÃO
  // =========================

  if (!comboPersonalizado) {
    const comboExistente = itens.find(
      (item) =>
        item.produtoId === produtoId &&
        item.categoria === "combos" &&
        (item.tipo || "") === (novoItem.tipo || "") &&
        !item.comboPersonalizado &&
        (item.observacao || "") === observacao,
    );

    if (comboExistente) {
      comboExistente.quantidade = Number(comboExistente.quantidade || 0) + quantidade;

      comboExistente.subtotal =
        Number(comboExistente.precoUnitario || precoBase) * Number(comboExistente.quantidade || 1);
    } else {
      itens.push(novoItem);
    }
  }

  // =========================
  // COMBO PERSONALIZADO
  // =========================
  else {
    // Não junta com outro.
    // Cada combo personalizado
    // é único.

    itens.push(novoItem);
  }

  // =========================
  // TOTAL COMANDA
  // =========================

  const novoTotal = itens.reduce((total, item) => {
    return total + Number(item.subtotal || 0);
  }, 0);

  await refComanda.update({
    itens,

    valorTotal: novoTotal,
  });

  abrirBuscaProdutos(comandaId);
}
function cancelarEdicaoItemComanda(comandaId) {
  itemComandaEmEdicao = null;

  configuracoesLanchesCombo = {};

  configuracaoTodosCombo = null;

  modoPersonalizacaoCombo = "";

  abrirComandaVisual(comandaId);
}
