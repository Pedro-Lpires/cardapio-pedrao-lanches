/* Montagem de entrega e retirada: catálogo, produto, molhos e pagamento em janelas. */
"use strict";
function pedidoEmMontagemUI(contexto) {
  return contexto === "entrega" ? pedidoEntregaAtual : pedidoRetiradaAtual;
}
function fecharJanelaPedidoUI(id) {
  const janela = document.getElementById(id)?.closest("dialog");
  if (janela?.open) janela.close("aplicar");
}
function novaJanelaPedidoUI(id, titulo, html) {
  const anterior = document.getElementById(id);
  if (anterior) return anterior;
  const conteudo = document.createElement("div");
  conteudo.id = id;
  conteudo.innerHTML = html;
  conteudo.hidden = true;
  document.body.append(conteudo);
  const janela = abrirJanelaElementoUI(conteudo, titulo);
  janela.classList.add("pedido-janela-ui");
  janela.addEventListener("close", () => conteudo.remove(), { once: true });
  return conteudo;
}
function montarPedidoAtendenteUI(contexto) {
  const pedido = pedidoEmMontagemUI(contexto);
  const area = document.getElementById(`area-${contexto}-atendente`);
  if (!pedido || !area) return;
  fecharJanelaPedidoUI("pedido-produto-painel-ui");
  fecharJanelaPedidoUI("pedido-molhos-ui");
  area.classList.remove("produto-painel-compacto-ui");
  const entrega = contexto === "entrega";
  const sufixo = entrega ? "Entrega" : "Retirada";
  const subtotal = pedido.itens.reduce(
    (n, i) => n + Number(i.subtotal || 0) + Number(i.totalMolhosPagos || 0),
    0,
  );
  area.innerHTML = `<div class="pedido-montagem-ui">
    <h3>${entrega ? "🛵 Entrega" : "📦 Retirada"}</h3>
    <section class="pedido-caixa-ui"><strong>${escaparOperacao(pedido.nome)}</strong>
      ${pedido.telefone ? `<p>${escaparOperacao(pedido.telefone)}</p>` : ""}
      ${entrega ? `<p>${escaparOperacao(pedido.endereco)}</p>` : ""}
    </section>
    <div class="pedido-secao-titulo-ui"><h4>Itens do pedido</h4><button type="button" onclick="abrirProdutosPedido${sufixo}()">＋ Adicionar item</button></div>
    <div id="itens-pedido-${contexto}" class="pedido-itens-ui">${
      pedido.itens
        .map(
          (item, index) => `
      <article class="pedido-caixa-ui">
        ${itensHtmlOperacao([item], true)}
        ${molhosAtendenteOperacao([item])}
        <div class="pedido-item-acoes-ui">
          ${["lanches", "combos", "batatas"].includes(item.categoria) ? `<button type="button" onclick="abrirMolhosPedido${sufixo}(${index})">Molhos</button>` : ""}
          <button type="button" onclick="editarItemPedido${sufixo}(${index})">Editar</button>
          <button type="button" onclick="excluirItemPedido${sufixo}(${index})">Excluir</button>
        </div>
      </article>`,
        )
        .join("") || '<p class="pedido-vazio-ui">Adicione os itens para começar.</p>'
    }</div>
    <section class="pedido-caixa-ui pedido-resumo-ui">
      <p>Subtotal <strong id="subtotal-pedido-${contexto}">${moedaOperacao(subtotal)}</strong></p>
      ${entrega ? `<label class="pedido-taxa-ui" for="taxa-pedido-entrega">Taxa de entrega<input type="number" id="taxa-pedido-entrega" min="0" step="0.01" inputmode="decimal" value="${Number(pedido.taxaEntrega || 0).toFixed(2)}" oninput="atualizarTotalPedidoEntrega()"></label>` : ""}
      <p class="pedido-total-ui">Total <strong id="total-pedido-${contexto}">${moedaOperacao(subtotal + (entrega ? Number(pedido.taxaEntrega || 0) : 0))}</strong></p>
    </section>
    <section class="pedido-caixa-ui pedido-pagamento-ui"><h4>Forma de pagamento</h4>
      <button type="button" id="pedido-pagamento-resumo-${contexto}" onclick="abrirPagamentoPedidoUI('${contexto}')">${escaparOperacao(pedido.formaPagamento || "Escolher pagamento")} <span>›</span></button>
      <input hidden type="radio" name="pagamento-${contexto}-atendente" value="${escaparOperacao(pedido.formaPagamento || "")}" ${pedido.formaPagamento ? "checked" : ""}>
    </section>
    <button class="pedido-criar-ui" type="button" onclick="salvarPedido${sufixo}Atendente()">Criar pedido</button>
  </div>`;
}
async function abrirCatalogoPedidoAtendenteUI(contexto) {
  if (!pedidoEmMontagemUI(contexto)) return;
  const conteudo = novaJanelaPedidoUI(
    "pedido-catalogo-ui",
    "Adicionar itens",
    `
    <label class="pedido-busca-ui">Buscar item<input type="search" id="busca-item-pedido-ui" placeholder="Nome do lanche, combo, bebida…" autocomplete="off"></label>
    <div class="pedido-categorias-ui" aria-label="Categorias"></div>
    <div class="pedido-catalogo-lista-ui" aria-live="polite">${htmlCarregandoUI("Carregando cardápio…")}</div>
    <div class="pedido-catalogo-rodape-ui"><span>Os itens ficam salvos no pedido.</span><button type="button" onclick="fecharJanelaPedidoUI('pedido-catalogo-ui')">Concluir</button></div>`,
  );
  if (conteudo.dataset.carregado) return;
  conteudo.dataset.carregado = "sim";
  let categoria = "lanches";
  try {
    const snap = await lerComPrazoUI(db.collection("produtos").get());
    if (!conteudo.isConnected) return;
    const produtos = snap.docs
      .map((d) => ({ ...d.data(), id: d.id }))
      .filter((p) => p.ativo !== false && !p.esgotado);
    produtos.sort(
      (a, b) =>
        Number(a.ordem || 0) - Number(b.ordem || 0) ||
        String(a.nome).localeCompare(String(b.nome), "pt-BR"),
    );
    const categorias = conteudo.querySelector(".pedido-categorias-ui");
    const busca = conteudo.querySelector("input");
    const renderizar = () => {
      const termo = normalizarBuscaUI(busca.value);
      categorias
        .querySelectorAll("button")
        .forEach((b) =>
          b.setAttribute("aria-pressed", String(!termo && b.dataset.categoria === categoria)),
        );
      const encontrados = produtos.filter((p) =>
        termo ? normalizarBuscaUI(p.nome).includes(termo) : p.categoria === categoria,
      );
      const lista = conteudo.querySelector(".pedido-catalogo-lista-ui");
      lista.innerHTML =
        encontrados
          .map(
            (p) =>
              `<article class="pedido-catalogo-card-ui"><div><strong>${escaparOperacao(p.nome)}</strong><small>${moedaOperacao(p.preco)}</small></div><button type="button" data-produto="${escaparOperacao(p.id)}">Adicionar</button></article>`,
          )
          .join("") || "<p>Nenhum item encontrado.</p>";
      lista.querySelectorAll("button").forEach(
        (b) =>
          (b.onclick = async () => {
            if (contexto === "entrega") indiceItemEntregaEmEdicao = null;
            else indiceItemRetiradaEmEdicao = null;
            b.disabled = true;
            try {
              await (
                contexto === "entrega" ? abrirProdutoPedidoEntrega : abrirProdutoPedidoRetirada
              )(b.dataset.produto);
            } catch (erro) {
              mostrarAvisoUI("Não foi possível abrir o item. Tente novamente.");
            } finally {
              b.disabled = false;
            }
          }),
      );
    };
    for (const [valor, nome] of [
      ["lanches", "Lanches"],
      ["combos", "Combos"],
      ["batatas", "Batatas"],
      ["bebidas", "Bebidas"],
    ]) {
      const botao = document.createElement("button");
      botao.type = "button";
      botao.dataset.categoria = valor;
      botao.textContent = nome;
      botao.onclick = () => {
        categoria = valor;
        busca.value = "";
        renderizar();
      };
      categorias.append(botao);
    }
    busca.oninput = renderizar;
    renderizar();
  } catch (erro) {
    conteudo.querySelector(".pedido-catalogo-lista-ui").textContent =
      "Não foi possível carregar. Feche e tente novamente.";
  }
}
function obterPainelProdutoPedidoUI() {
  let painel = document.getElementById("pedido-produto-painel-ui");
  if (!painel) {
    painel = document.createElement("div");
    painel.id = "pedido-produto-painel-ui";
    painel.hidden = true;
    document.body.append(painel);
  }
  return painel;
}
function abrirJanelaProdutoPedidoUI() {
  const painel = document.getElementById("pedido-produto-painel-ui");
  if (!painel) return;
  painel.querySelector(":scope > button")?.remove();
  const editando = Number.isInteger(
    contextoPainelProduto === "entrega" ? indiceItemEntregaEmEdicao : indiceItemRetiradaEmEdicao,
  );
  const salvar = painel.querySelector("button[onclick*='adicionarProdutoConfigurado']");
  if (salvar) salvar.textContent = editando ? "Salvar alterações" : "＋ Adicionar";
  const janela = abrirJanelaElementoUI(painel, editando ? "Editar item" : "Personalizar item");
  janela.classList.add("pedido-janela-ui");
  janela.addEventListener(
    "close",
    () => {
      indiceItemEntregaEmEdicao = null;
      indiceItemRetiradaEmEdicao = null;
      painel.remove();
    },
    { once: true },
  );
}
function abrirPagamentoPedidoUI(contexto) {
  const pedido = pedidoEmMontagemUI(contexto);
  if (!pedido) return;
  const conteudo = novaJanelaPedidoUI(
    "pedido-pagamento-ui",
    "Pagamento",
    `<p>Como o cliente vai pagar?</p><div class="pedido-pagamento-opcoes-ui">${["Pix", "Dinheiro", "Débito", "Crédito"].map((forma) => `<label><input type="radio" name="pedido-pagamento-escolha-ui" value="${forma}" ${pedido.formaPagamento === forma ? "checked" : ""}>${forma}</label>`).join("")}</div><button type="button" class="pedido-pagamento-confirmar-ui">Confirmar pagamento</button>`,
  );
  conteudo.querySelector("button").onclick = () => {
    const selecionado = conteudo.querySelector("input:checked");
    if (!selecionado) return mostrarAvisoUI("Escolha uma forma de pagamento.");
    pedido.formaPagamento = selecionado.value;
    const radio = document.querySelector(`input[name="pagamento-${contexto}-atendente"]`);
    radio.value = selecionado.value;
    radio.checked = true;
    document.getElementById(`pedido-pagamento-resumo-${contexto}`).innerHTML =
      escaparOperacao(selecionado.value) + " <span>›</span>";
    fecharJanelaPedidoUI("pedido-pagamento-ui");
  };
}
function abrirMolhosPedidoUI(index) {
  const item = pedidoEmMontagemUI(contextoMolhosPedido)?.itens[index];
  if (!item) return;
  const direitos =
    Number(item.quantidade || 1) *
    (item.categoria === "combos" ? Number(item.comboQtdLanches || 1) : 1);
  const blocos = Array.from({ length: direitos }, (_, n) => {
    const i = n + 1;
    const salvo = (item.molhosGratis || []).find((m) => Number(m.unidade) === i);
    return `<section class="pedido-molho-unidade-ui"><h4>${item.categoria === "combos" ? `${i}º lanche` : `Unidade ${i}`}</h4><div class="pedido-molho-tipos-ui">${[
      ["semmolho", "Sem molho"],
      ["umdecada", "1 de cada"],
      ["doisiguais", "2 iguais"],
    ]
      .map(
        ([tipo, nome]) =>
          `<label><input type="radio" name="tipo-molho-entrega-${i}" value="${tipo}" ${(salvo?.tipo || "semmolho") === tipo ? "checked" : ""} onchange="renderizarOpcoesMolhoPedido(${index},${i})">${nome}</label>`,
      )
      .join(
        "",
      )}</div><div id="opcoes-molho-entrega-${i}" class="pedido-molho-escolhas-ui"></div></section>`;
  }).join("");
  const conteudo = novaJanelaPedidoUI(
    "pedido-molhos-ui",
    "Molhos",
    `<p><strong>${escaparOperacao(item.nome)}</strong></p>${blocos}<section class="pedido-molho-unidade-ui"><h4>Molhos extras</h4><button type="button" onclick="alternarMolhosPagosEntrega()">Adicionar molhos pagos</button><div id="area-molhos-pagos-entrega" style="display:${(item.molhosPagos || []).length ? "block" : "none"}"><p>R$ 2 por unidade</p>${montarMolhosPagosEntrega(item.molhosPagos || [])}</div><p class="pedido-molhos-total-ui">Extras <strong id="total-molhos-pagos-entrega">${moedaOperacao(item.totalMolhosPagos || 0)}</strong></p></section><button type="button" onclick="salvarMolhosPedido(${index},${direitos})">Salvar molhos</button>`,
  );
  for (let i = 1; i <= direitos; i++) renderizarOpcoesMolhoPedido(index, i);
  return conteudo;
}
function renderizarMolhoPedidoUI(index, unidade) {
  const item = pedidoEmMontagemUI(contextoMolhosPedido)?.itens[index];
  const area = document.getElementById(`opcoes-molho-entrega-${unidade}`);
  if (!item || !area) return;
  const salvo = (item.molhosGratis || []).find((m) => Number(m.unidade) === unidade);
  const tipo = document.querySelector(`input[name="tipo-molho-entrega-${unidade}"]:checked`)?.value;
  if (tipo === "semmolho") {
    area.innerHTML = "<small>Sem molho nesta unidade.</small>";
    return;
  }
  area.innerHTML = ["Maionese", "Ketchup", "Mostarda", "Barbecue"]
    .map(
      (molho) =>
        `<label><input type="${tipo === "umdecada" ? "checkbox" : "radio"}" ${tipo === "umdecada" ? `class="molho-um-entrega-${unidade}"` : `name="molho-dois-entrega-${unidade}"`} value="${molho}" ${(tipo === "umdecada" ? (salvo?.molhos || []).includes(molho) : (salvo?.molho || "Maionese") === molho) ? "checked" : ""}>${tipo === "doisiguais" ? "2 " : ""}${molho}</label>`,
    )
    .join("");
}
function molhosPagosPedidoHtmlUI(selecionados) {
  return ["Maionese", "Ketchup", "Mostarda", "Barbecue"]
    .map(
      (molho) =>
        `<div class="pedido-molho-pago-ui"><span>${molho}</span><button type="button" aria-label="Retirar ${molho}" onclick="alterarMolhoPagoEntrega('${molho}',-1)">−</button><strong id="molho-pago-${molho}">${Number(selecionados.find((m) => m.nome === molho)?.qtd || 0)}</strong><button type="button" aria-label="Adicionar ${molho}" onclick="alterarMolhoPagoEntrega('${molho}',1)">+</button></div>`,
    )
    .join("");
}
