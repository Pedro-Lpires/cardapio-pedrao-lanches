/* Edição de um pedido existente. O rascunho só é persistido ao salvar. */
function clonarEdicaoPedidoUI(valor) {
  return JSON.parse(JSON.stringify(valor));
}
function valorItemEdicaoUI(item) {
  return Number(
    item.subtotal ??
      Number(item.precoUnitario ?? item.preco ?? 0) * Number(item.quantidade ?? item.qtd ?? 1),
  );
}
function calcularEdicaoPedidoUI(pedido) {
  const subtotal =
    pedido.itens.reduce(
      (s, i) => s + centavosOperacao(valorItemEdicaoUI(i)) + centavosOperacao(i.totalMolhosPagos),
      0,
    ) / 100;
  const taxaEntrega = pedido.tipo === "Entrega" ? Number(pedido.taxaEntrega || 0) : 0;
  const valorAntesDesconto = (centavosOperacao(subtotal) + centavosOperacao(taxaEntrega)) / 100;
  const valorTotal =
    Math.max(
      0,
      centavosOperacao(valorAntesDesconto) -
        centavosOperacao(pedido.descontoCupom) -
        centavosOperacao(pedido.descontoFidelidade) -
        centavosOperacao(pedido.descontoCreditoEntrega) +
        centavosOperacao(pedido.ajusteArredondamento),
    ) / 100;
  return { subtotal, taxaEntrega, valorAntesDesconto, valorTotal };
}
function assinaturaEdicaoPedidoUI(p) {
  return serializarOperacao([
    p.itens,
    p.valorTotal,
    p.nome,
    p.telefone,
    p.endereco,
    p.tipo,
    p.pagamento,
    p.descontoCupom,
    p.descontoFidelidade,
    p.descontoCreditoEntrega,
    p.creditoEntrega,
    p.editadoEm,
    p.recebimentosPedido,
    p.pagamentoConfirmado,
    p.retirado,
  ]);
}
async function salvarEdicaoPedidoTransacaoUI(id, original, rascunho) {
  if (!rascunho.nome?.trim()) throw Error("Informe o nome do cliente.");
  if (rascunho.telefone && !/^\d{11}$/.test(rascunho.telefone))
    throw Error("O celular deve ter 11 números com DDD.");
  if (!["Entrega", "Retirada", "Local"].includes(rascunho.tipo))
    throw Error("Escolha o tipo do pedido.");
  if (!rascunho.itens.length) throw Error("Mantenha pelo menos um item no pedido.");
  for (const i of rascunho.itens) {
    if (
      !i.nome?.trim() ||
      !Number.isInteger(Number(i.quantidade ?? i.qtd)) ||
      Number(i.quantidade ?? i.qtd) < 1 ||
      !Number.isFinite(valorItemEdicaoUI(i)) ||
      valorItemEdicaoUI(i) < 0 ||
      !Number.isFinite(Number(i.totalMolhosPagos || 0)) ||
      Number(i.totalMolhosPagos || 0) < 0
    )
      throw Error("Confira nome, quantidade e preço dos itens.");
  }
  for (const k of ["taxaEntrega", "descontoCupom", "descontoFidelidade"])
    if (!Number.isFinite(Number(rascunho[k] || 0)) || Number(rascunho[k] || 0) < 0)
      throw Error("Taxas e descontos não podem ser negativos.");
  if (
    !Number.isFinite(Number(rascunho.ajusteArredondamento || 0)) ||
    !Number.isFinite(Number(rascunho.trocoPara || 0)) ||
    Number(rascunho.trocoPara || 0) < 0
  )
    throw Error("Confira o ajuste e o troco.");
  const ref = db.collection("pedidos").doc(id);
  return db.runTransaction(async (t) => {
    const d = await t.get(ref);
    if (!d.exists) throw Error("Pedido não encontrado.");
    const atual = d.data();
    if (atual.cancelado || atual.mesa || atual.comandaId || atual.vinculadoComanda)
      throw Error("Este pedido está cancelado ou ligado a uma mesa. Edite pela comanda da mesa.");
    if (assinaturaEdicaoPedidoUI(atual) !== assinaturaEdicaoPedidoUI(original))
      throw Error("O pedido foi alterado em outra tela. Feche e abra a edição novamente.");
    const recebimentosPedido = clonarEdicaoPedidoUI(recebimentosPedidoOperacao(atual));
    for (const [indice, formas] of Object.entries(rascunho.correcaoRecebimentos || {})) {
      const r = recebimentosPedido[Number(indice)];
      if (
        !r ||
        !Array.isArray(formas) ||
        centavosOperacao(formas.reduce((n, f) => n + Number(f.valor || 0), 0)) !==
          centavosOperacao(r.valor) ||
        formas.some((f) => !f.forma || !Number.isFinite(Number(f.valor)) || Number(f.valor) < 0)
      )
        throw Error("Confira as formas dos recebimentos anteriores.");
      r.formas = clonarEdicaoPedidoUI(formas);
      r.forma = formas.map((f) => f.forma).join(" + ");
      r.formaCorrigidaEm = Date.now();
    }
    const clienteRef =
      atual.clienteId && (atual.origem === "site_delivery" || atual.fidelidadeAtivaNoPedido)
        ? db.collection("clientes").doc(atual.clienteId)
        : null;
    const clienteDoc = clienteRef ? await t.get(clienteRef) : null;
    if (rascunho.ajusteArredondamento == null)
      rascunho = {
        ...rascunho,
        ajusteArredondamento:
          atual.ajusteArredondamento ??
          (centavosOperacao(atual.valorTotal) -
            centavosOperacao(calcularEdicaoPedidoUI(atual).valorTotal)) /
            100,
      };
    if (typeof limitarBeneficioEdicaoEntregaUI === "function")
      rascunho = {
        ...rascunho,
        descontoCreditoEntrega: limitarBeneficioEdicaoEntregaUI(atual, rascunho),
      };
    const totais = calcularEdicaoPedidoUI(rascunho);
    if (
      centavosOperacao(rascunho.descontoCupom) + centavosOperacao(rascunho.descontoFidelidade) >
      centavosOperacao(totais.valorAntesDesconto)
    )
      throw Error("Os descontos ultrapassam o valor do pedido.");
    const recebido = valorRecebidoPedidoOperacao(atual);
    const patch = {
      nome: rascunho.nome.trim(),
      telefone: rascunho.telefone || "",
      endereco: rascunho.tipo === "Entrega" ? rascunho.endereco || "" : "",
      tipo: rascunho.tipo,
      pagamento: rascunho.pagamento || "Não informado",
      formaPagamento: rascunho.pagamento || "Não informado",
      observacao: rascunho.observacao || "",
      itens: clonarEdicaoPedidoUI(rascunho.itens),
      condominio: rascunho.tipo === "Entrega" ? rascunho.condominio || "Não" : "Não",
      cnh:
        rascunho.tipo === "Entrega" && rascunho.condominio === "Sim"
          ? rascunho.cnh || "Não"
          : "Não",
      trocoPara:
        rascunho.pagamento === "Dinheiro" && Number(rascunho.trocoPara) > 0
          ? Number(rascunho.trocoPara)
          : null,
      ajusteArredondamento: Number(rascunho.ajusteArredondamento || 0),
      descontoCupom: Number(rascunho.descontoCupom || 0),
      descontoFidelidade: Number(rascunho.descontoFidelidade || 0),
      descontoCreditoEntrega: Number(rascunho.descontoCreditoEntrega || 0),
      ...totais,
      recebimentosPedido,
      valorPago: recebido,
      valorRecebido: recebido,
      saldoPendente:
        Math.max(0, centavosOperacao(totais.valorTotal) - centavosOperacao(recebido)) / 100,
      valorADevolver:
        Math.max(0, centavosOperacao(recebido) - centavosOperacao(totais.valorTotal)) / 100,
      pagamentoConfirmado: centavosOperacao(recebido) >= centavosOperacao(totais.valorTotal),
      editadoEm: new Date().toISOString(),
      editadoPor: localStorage.getItem("atendenteNome") || "Admin",
    };
    if (patch.saldoPendente > 0 || rascunho.tipo !== "Retirada") patch.retirado = false;
    // Não reaproveita uma divisão de pagamento anterior para um novo saldo.
    if (atual.pagamento !== patch.pagamento || patch.valorTotal !== atual.valorTotal)
      patch.formas = [];
    if (rascunho.modoPagamentoEditor === "misto") {
      const formas = rascunho.formas || [];
      if (
        formas.length < 2 ||
        formas.some(
          (f) =>
            !["Pix", "Dinheiro", "Cartão", "Débito", "Crédito"].includes(f.forma) ||
            !Number.isFinite(Number(f.valor)) ||
            Number(f.valor) <= 0,
        ) ||
        centavosOperacao(formas.reduce((n, f) => n + Number(f.valor), 0)) !==
          centavosOperacao(patch.saldoPendente)
      )
        throw Error("A divisão do pagamento deve somar o saldo que falta receber.");
      patch.formas = clonarEdicaoPedidoUI(formas);
      patch.beneficiosConferirPagamento = false;
    } else if (rascunho.modoPagamentoEditor === "unico") {
      patch.formas = [];
      patch.beneficiosConferirPagamento = false;
    }
    const beneficio =
      typeof prepararBeneficioEntregaUI === "function"
        ? await prepararBeneficioEntregaUI(t, atual, "ajustar", patch.descontoCreditoEntrega)
        : { patch: {}, salvar: () => {} };
    Object.assign(patch, beneficio.patch);
    const salvarRank =
      typeof prepararRankMensalUI === "function"
        ? await prepararRankMensalUI(t, [
            {
              clienteId: atual.clienteId,
              chave: "pedidos_" + id,
              eventos: eventosRankPedidoMensalUI({ ...atual, ...patch }),
            },
          ])
        : () => {};
    if (clienteDoc?.exists) {
      const c = clienteDoc.data(),
        clientePatch = {};
      if (atual.origem === "site_delivery")
        clientePatch.gastoTotal = Math.max(
          0,
          Number(c.gastoTotal || 0) + patch.valorTotal - Number(atual.valorTotal || 0),
        );
      if (
        atual.fidelidadeAtivaNoPedido &&
        (!atual.beneficiosPerfil || atual.beneficiosPerfil.baseFidelidade > 0)
      ) {
        const delta = baseFidelidadePedidoOperacao(rascunho) - baseFidelidadePedidoOperacao(atual);
        if (atual.beneficiosPerfil) {
          patch.baseFidelidadeCreditada =
            Number(atual.baseFidelidadeCreditada ?? atual.beneficiosPerfil.baseFidelidade) + delta;
        }
        clientePatch.totalGasto = Math.max(0, Number(c.totalGasto || 0) + delta);
        clientePatch.totalFidelidade = Math.max(0, Number(c.totalFidelidade || 0) + delta);
        const geradoAntes = Number(c.bonusGeradoTotal || 0);
        clientePatch.bonusGeradoTotal = bonusAcumuladoFidelidadeOperacao(
          c,
          clientePatch.totalFidelidade,
        );
        const bonus =
          Number(c.bonusDisponivel || 0) +
          clientePatch.bonusGeradoTotal -
          geradoAntes +
          Number(atual.descontoFidelidade || 0) -
          patch.descontoFidelidade;
        if (bonus < 0 && patch.descontoFidelidade > Number(atual.descontoFidelidade || 0))
          throw Error("O cliente não tem saldo de fidelidade para este desconto.");
        clientePatch.bonusDisponivel = Math.max(0, bonus);
      }
      if (Object.keys(clientePatch).length) t.update(clienteRef, clientePatch);
    }
    if (atual.beneficiosPerfil)
      patch.beneficiosPerfil = {
        ...atual.beneficiosPerfil,
        gastoTotal: patch.valorTotal,
        bonusUsado: patch.descontoFidelidade,
      };
    // O vínculo e os identificadores são preservados; a produção é conferida separadamente.
    t.update(ref, patch);
    salvarRank();
    beneficio.salvar();
    return { ...atual, ...patch };
  });
}
function janelaEditorUI(titulo) {
  const d = document.createElement("dialog");
  d.className = "editor-pedido-ui";
  d.innerHTML = `<header><button type="button" data-voltar>← Voltar</button><h2>${escaparOperacao(titulo)}</h2><button type="button" data-fechar aria-label="Fechar edição">×</button></header><div class="editor-corpo-ui"></div>`;
  for (const b of d.querySelectorAll("[data-voltar],[data-fechar]")) b.onclick = () => d.close();
  d.addEventListener("close", () => d.remove(), { once: true });
  document.body.append(d);
  d.showModal();
  return d;
}
function campoEditorUI(nome, valor, tipo = "text", attrs = "") {
  return `<label>${escaparOperacao(nome)}<input type="${tipo}" value="${escaparOperacao(valor ?? "")}" ${attrs}></label>`;
}
async function abrirEditorPedidoUI(id, opcoes = {}) {
  try {
    const doc = await db.collection("pedidos").doc(id).get();
    if (!doc.exists) throw Error("Pedido não encontrado.");
    let original = doc.data();
    if (original.mesa || original.comandaId || original.vinculadoComanda)
      throw Error("Edite este pedido pela comanda da mesa vinculada.");
    let p = clonarEdicaoPedidoUI(original);
    p.nome = p.nome || p.cliente || "";
    p.telefone = p.telefone || p.telefoneCliente || "";
    p.itens = p.itens || [];
    p.pagamento = p.pagamento || p.formaPagamento || "Dinheiro";
    p.ajusteArredondamento =
      p.ajusteArredondamento ??
      (centavosOperacao(p.valorTotal) - centavosOperacao(calcularEdicaoPedidoUI(p).valorTotal)) /
        100;
    if (/local/i.test(p.tipo)) p.tipo = "Local";
    const d = janelaEditorUI(`Editar pedido #${p.numero || "—"}`),
      box = d.querySelector(".editor-corpo-ui");
    const render = () => {
      const valores = calcularEdicaoPedidoUI(p),
        recebido = valorRecebidoPedidoOperacao(original);
      box.innerHTML = `<form class="editor-form-ui"><section><h3>Cliente e atendimento</h3><div class="editor-grade-ui">${campoEditorUI("Nome", p.nome, "text", 'name="nome" required')}${campoEditorUI("Celular com DDD", p.telefone, "tel", 'name="telefone" maxlength="11" inputmode="numeric" pattern="[0-9]{11}"')}<label>Tipo<select name="tipo">${["Entrega", "Retirada", "Local"].map((v) => `<option ${v === p.tipo ? "selected" : ""}>${v}</option>`).join("")}</select></label><label>Pagamento<select name="pagamento">${[...new Set(["Dinheiro", "Pix", "Cartão", p.pagamento])].map((v) => `<option ${v === p.pagamento ? "selected" : ""}>${escaparOperacao(v)}</option>`).join("")}</select></label></div><label>Endereço<textarea name="endereco">${escaparOperacao(p.endereco || "")}</textarea></label><label>Observação do pedido<textarea name="observacao">${escaparOperacao(p.observacao || "")}</textarea></label></section><section><div class="editor-secao-ui"><h3>Itens</h3><div class="editor-acoes-ui"><button type="button" data-adicionar>Adicionar item</button><button type="button" data-adicionar-valor>Adicionar valor</button></div></div><div class="editor-itens-ui">${p.itens.map((i, n) => `<article><strong>${escaparOperacao(i.quantidade ?? i.qtd ?? 1)} × ${escaparOperacao(i.nome)}</strong><p>${moedaOperacao(valorItemEdicaoUI(i) + Number(i.totalMolhosPagos || 0))}${i.tipo ? " · " + escaparOperacao(i.tipo) : ""}</p>${i.observacao || i.obs ? `<p>${escaparOperacao(i.observacao || i.obs)}</p>` : ""}<div class="editor-acoes-ui"><button type="button" data-item="${n}">Editar item</button><button type="button" data-remover="${n}">Remover</button></div></article>`).join("")}</div></section><section><h3>Valores</h3><div class="editor-grade-ui">${campoEditorUI("Taxa de entrega (R$)", valores.taxaEntrega, "number", 'name="taxaEntrega" min="0" step="0.01"')}${campoEditorUI("Desconto de cupom (R$)", p.descontoCupom || 0, "number", 'name="descontoCupom" min="0" step="0.01"')}${campoEditorUI("Vale fidelidade (R$)", p.descontoFidelidade || 0, "number", 'name="descontoFidelidade" min="0" step="0.01"')}</div><div class="editor-resumo-ui" aria-live="polite"></div></section><p role="status" class="editor-status-ui"></p><footer><button type="submit">Salvar alterações</button>${opcoes.modo === "admin" && typeof abrirClientePedidoAdminUI === "function" ? '<button type="button" data-cliente>Cliente e benefícios</button>' : ""}</footer></form>`;
      const f = box.querySelector("form");
      const dadosEntrega = document.createElement("div");
      dadosEntrega.className = "editor-grade-ui";
      dadosEntrega.innerHTML = `<label>Condomínio<select name="condominio">${["Não", "Sim"].map((v) => `<option ${v === p.condominio ? "selected" : ""}>${v}</option>`).join("")}</select></label><label>Precisa de CNH<select name="cnh">${["Não", "Sim"].map((v) => `<option ${v === p.cnh ? "selected" : ""}>${v}</option>`).join("")}</select></label>${campoEditorUI("Troco para (R$)", p.trocoPara || "", "number", 'name="trocoPara" min="0" step="0.01"')}`;
      f.querySelector("section").append(dadosEntrega);
      dadosEntrega.prepend(f.elements.taxaEntrega.closest("label"));
      const atualizarCamposTipo = () => {
        for (const nome of ["endereco", "taxaEntrega", "condominio", "cnh"]) {
          f.elements[nome].closest("label").hidden =
            p.tipo !== "Entrega" || (nome === "cnh" && p.condominio !== "Sim");
        }
        f.elements.trocoPara.closest("label").hidden =
          p.pagamento !== "Dinheiro" && !p.formas?.some((x) => x.forma === "Dinheiro");
      };
      atualizarCamposTipo();
      const ajuste = document.createElement("div");
      ajuste.innerHTML = campoEditorUI(
        "Ajuste de arredondamento (R$)",
        p.ajusteArredondamento,
        "number",
        'name="ajusteArredondamento" step="0.01"',
      );
      f.querySelector(".editor-resumo-ui").before(ajuste);
      const historico = recebimentosPedidoOperacao(original);
      if (historico.length) {
        const detalhes = document.createElement("details");
        detalhes.innerHTML =
          "<summary>Corrigir forma dos pagamentos já recebidos</summary><p>Esta correção mantém o valor e a data de cada recebimento.</p>" +
          historico
            .map((r, n) => {
              const formas = p.correcaoRecebimentos?.[n] ||
                r.formas || [{ forma: r.forma, valor: r.valor }];
              return (
                "<strong>" +
                moedaOperacao(r.valor) +
                "</strong>" +
                formas
                  .map(
                    (f, k) =>
                      "<label>" +
                      moedaOperacao(f.valor) +
                      '<select data-recibo="' +
                      n +
                      '" data-forma="' +
                      k +
                      '">' +
                      [...new Set(["Pix", "Dinheiro", "Cartão", f.forma])]
                        .map(
                          (v) =>
                            "<option " +
                            (v === f.forma ? "selected" : "") +
                            ">" +
                            escaparOperacao(v) +
                            "</option>",
                        )
                        .join("") +
                      "</select></label>",
                  )
                  .join("")
              );
            })
            .join("");
        f.querySelector("footer").before(detalhes);
        detalhes.querySelectorAll("select").forEach(
          (sel) =>
            (sel.onchange = () => {
              const n = Number(sel.dataset.recibo),
                k = Number(sel.dataset.forma),
                r = historico[n];
              p.correcaoRecebimentos ||= {};
              p.correcaoRecebimentos[n] ||= clonarEdicaoPedidoUI(
                r.formas || [{ forma: r.forma, valor: r.valor }],
              );
              p.correcaoRecebimentos[n][k].forma = sel.value;
            }),
        );
        historico.forEach((r, n) => {
          const b = document.createElement("button");
          b.type = "button";
          b.className = "editor-personalizar-ui";
          b.textContent = "Dividir / corrigir recebimento " + moedaOperacao(r.valor);
          b.onclick = () => {
            const draft = {
              itens: [],
              tipo: "Retirada",
              taxaEntrega: 0,
              ajusteArredondamento: Number(r.valor),
              pagamento: r.forma,
              formas: clonarEdicaoPedidoUI(
                p.correcaoRecebimentos?.[n] || r.formas || [{ forma: r.forma, valor: r.valor }],
              ),
            };
            abrirPagamentoEditorUI(draft, 0, () => {
              p.correcaoRecebimentos ||= {};
              p.correcaoRecebimentos[n] = draft.formas.length
                ? draft.formas
                : [{ forma: draft.pagamento, valor: r.valor }];
              render();
            });
          };
          detalhes.append(b);
        });
        const label = f.elements.pagamento.closest("label");
        label.firstChild.textContent = "Forma do próximo recebimento";
      }
      const escolhaPagamento = f.elements.pagamento;
      escolhaPagamento.hidden = true;
      const botaoPagamento = document.createElement("button");
      botaoPagamento.type = "button";
      const atualizarPagamento = () =>
        (botaoPagamento.textContent =
          p.formas?.length > 1
            ? p.formas.map((f) => f.forma + " " + moedaOperacao(f.valor)).join(" + ")
            : p.pagamento);
      atualizarPagamento();
      escolhaPagamento.after(botaoPagamento);
      botaoPagamento.onclick = () =>
        abrirPagamentoEditorUI(p, recebido, () => {
          atualizarPagamento();
          atualizarCamposTipo();
        });
      const resumo = () => {
        if (typeof limitarBeneficioEdicaoEntregaUI === "function")
          p.descontoCreditoEntrega = limitarBeneficioEdicaoEntregaUI(original, p);
        const t = calcularEdicaoPedidoUI(p),
          saldo = Math.max(0, t.valorTotal - recebido),
          devolver = Math.max(0, recebido - t.valorTotal);
        box.querySelector(".editor-resumo-ui").innerHTML =
          `${Number(p.descontoCreditoEntrega) > 0 ? `<p>Benefícios no frete: -${moedaOperacao(p.descontoCreditoEntrega)}</p>` : ""}<p>Total do pedido <strong>${moedaOperacao(t.valorTotal)}</strong></p><p>Já recebido <strong>${moedaOperacao(recebido)}</strong></p><p>Falta receber <strong>${moedaOperacao(saldo)}</strong></p>${devolver > 0 ? `<p class="editor-alerta-ui">Conferir devolução de ${moedaOperacao(devolver)} ao cliente. Salvar não registra estorno.</p>` : ""}<small>Ao alterar itens, confira a produção no pedido antes de enviar à cozinha.</small>`;
      };
      f.oninput = (e) => {
        const el = e.target;
        if (el.name) p[el.name] = el.type === "number" ? Number(el.value) : el.value;
        atualizarCamposTipo();
        resumo();
      };
      f.onchange = f.oninput;
      box.querySelector("[data-adicionar]").onclick = () => abrirCatalogoEdicaoUI(p, render);
      box.querySelector("[data-adicionar-valor]").onclick = () =>
        abrirAcrescimoPedidoUI((item) => {
          p.itens.push(item);
          render();
        });
      box.querySelectorAll("[data-item]").forEach(
        (b) =>
          (b.onclick = () => {
            const n = Number(b.dataset.item);
            if (p.itens[n].ajustePedido)
              abrirAcrescimoPedidoUI((item) => {
                p.itens[n] = item;
                render();
              }, p.itens[n]);
            else abrirItemEdicaoUI(p, n, render);
          }),
      );
      box.querySelectorAll("[data-remover]").forEach(
        (b) =>
          (b.onclick = () => {
            p.itens.splice(Number(b.dataset.remover), 1);
            render();
          }),
      );
      box
        .querySelector("[data-cliente]")
        ?.addEventListener("click", () => abrirClientePedidoAdminUI(id, original));
      f.onsubmit = async (e) => {
        e.preventDefault();
        const b = f.querySelector("[type=submit]");
        b.disabled = true;
        try {
          original = await salvarEdicaoPedidoTransacaoUI(id, original, p);
          await opcoes.aoSalvar?.();
          d.close();
        } catch (err) {
          box.querySelector("[role=status]").textContent = err.message;
          b.disabled = false;
        }
      };
      resumo();
    };
    render();
  } catch (err) {
    avisoOperacao(err.message);
  }
}
async function abrirCatalogoEdicaoUI(p, aoMudar) {
  const d = janelaEditorUI("Adicionar item"),
    box = d.querySelector(".editor-corpo-ui");
  box.innerHTML =
    '<label>Buscar no cardápio<input type="search" placeholder="Nome do produto"></label><nav class="editor-acoes-ui" data-categorias></nav><div class="editor-catalogo-ui">Carregando…</div>';
  try {
    const s = await db.collection("produtos").get();
    const produtos = s.docs
      .map((x) => ({ ...x.data(), id: x.id }))
      .filter(
        (x) => (x.somenteAtendente ? x.disponivelAtendimento : x.ativo !== false) && !x.esgotado,
      );
    let categoria = "lanches";
    for (const [id, nome] of [
      ["lanches", "Lanches"],
      ["combos", "Combos"],
      ["batatas", "Batatas"],
      ["bebidas", "Bebidas"],
    ]) {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = nome;
      b.onclick = () => {
        categoria = id;
        box.querySelector("input").value = "";
        render();
      };
      box.querySelector("[data-categorias]").append(b);
    }
    const render = () => {
      const termo = box.querySelector("input").value.toLocaleLowerCase("pt-BR");
      const lista = box.querySelector(".editor-catalogo-ui");
      lista.innerHTML =
        produtos
          .filter((x) =>
            termo
              ? x.nome.toLocaleLowerCase("pt-BR").includes(termo)
              : String(x.categoria).toLowerCase() === categoria,
          )
          .map(
            (x) =>
              `<article><strong>${escaparOperacao(x.nome)}</strong><small>${moedaOperacao(x.preco)}</small><button type="button" data-produto="${escaparOperacao(x.id)}">Adicionar</button></article>`,
          )
          .join("") || "<p>Nenhum produto encontrado.</p>";
      lista.querySelectorAll("button").forEach(
        (b) =>
          (b.onclick = async () => {
            const x = produtos.find((x) => x.id === b.dataset.produto);
            const item = {
              ...clonarEdicaoPedidoUI(x),
              produtoId: x.id,
              quantidade: 1,
              qtd: 1,
              precoBase: Number(x.preco || 0),
              precoUnitario: Number(x.preco || 0),
              subtotal: Number(x.preco || 0),
              adicionais: [],
              molhosGratis: [],
              molhosPagos: [],
              totalMolhosPagos: 0,
            };
            const tipos = tiposCarneProdutoOperacao(x);
            if (tipos.length) item.tipo = tipos[0].valor;
            if (x.categoria === "combos")
              item.lanchesCombo = Array.from(
                { length: Number(x.comboQtdLanches || x.qtdLanches || 1) },
                (_, n) => ({ numero: n + 1, adicionais: [], observacao: "" }),
              );
            await abrirItemEdicaoUI(p, -1, aoMudar, item);
          }),
      );
    };
    box.querySelector("input").oninput = render;
    render();
  } catch (err) {
    box.querySelector(".editor-catalogo-ui").textContent = err.message;
  }
}
async function abrirItemEdicaoUI(p, indice, aoMudar, novo = null) {
  const item = clonarEdicaoPedidoUI(novo || p.itens[indice]);
  item.tipo = item.tipo || item.tipoCarne || "";
  const d = janelaEditorUI(novo ? "Adicionar produto" : "Editar item"),
    box = d.querySelector(".editor-corpo-ui");
  box.textContent = "Carregando opções…";
  try {
    const [ps, ads] = await Promise.all([
      item.produtoId ? db.collection("produtos").doc(item.produtoId).get() : Promise.resolve(null),
      db.collection("adicionais").get(),
    ]);
    const produto = ps?.exists ? ps.data() : item,
      tipos = ps?.exists ? tiposCarneProdutoOperacao(produto) : [];
    item.tipo =
      tipos.find((t) => t.valor.toLowerCase() === item.tipo.toLowerCase())?.valor ||
      tipos[0]?.valor ||
      item.tipo;
    const qtd = Number(item.quantidade ?? item.qtd ?? 1);
    const extras = item.lanchesCombo?.length
      ? item.lanchesCombo
      : [
          {
            numero: 1,
            adicionais: item.adicionais || [],
            observacao: item.observacao || item.obs || "",
          },
        ];
    const catalogo = ads.docs
      .map((a) => ({ ...a.data(), id: a.id }))
      .filter((a) => a.ativo !== false);
    const custoExtras = extras.reduce(
      (s, g) =>
        s + (g.adicionais || []).reduce((n, a) => n + Number(a.preco || 0) * Number(a.qtd || 1), 0),
      0,
    );
    const base = Number(
      item.precoBase > 0 ? item.precoBase : valorItemEdicaoUI(item) / qtd - custoExtras,
    );
    const nomeProduto = produto.nome || item.nome;
    let precoBaseAtual = ps?.exists
      ? Number(tipos.find((t) => t.valor === item.tipo)?.preco ?? produto.preco ?? base)
      : base;
    box.innerHTML = `<form class="editor-item-form-ui"><div class="editor-produto-resumo-ui"><h3>${escaparOperacao(nomeProduto)}</h3><output data-total-item>${moedaOperacao(precoBaseAtual * qtd)}</output></div>${tipos.length > 1 ? `<fieldset class="editor-tipos-carne-ui"><legend>Escolha a carne</legend>${tipos.map((t) => `<label><input type="radio" name="tipo" value="${t.valor}" ${t.valor === item.tipo ? "checked" : ""}><span>${escaparOperacao(t.nome)}</span><small>${moedaOperacao(t.preco)}</small></label>`).join("")}</fieldset>` : `<input type="hidden" name="tipo" value="${escaparOperacao(item.tipo)}">`}<div class="editor-item-quantidade-ui"><span>Quantidade</span><div class="editor-contador-ui"><button type="button" data-quantidade="-1" aria-label="Diminuir quantidade">−</button><input type="number" name="quantidade" min="1" max="99" step="1" value="${qtd}" readonly aria-label="Quantidade"><button type="button" data-quantidade="1" aria-label="Aumentar quantidade">+</button></div></div><label>Observação do item<textarea name="observacao" placeholder="${/batata/i.test(item.categoria || "") ? "Ex.: caprichada, embalar separada..." : /bebida/i.test(item.categoria || "") ? "Ex.: mandar canudo, copo..." : "Ex.: sem cebola, bem passado..."}">${escaparOperacao(item.observacao || item.obs || "")}</textarea></label>${extras
      .map((g, n) => {
        const todos = [...catalogo];
        for (const a of g.adicionais || [])
          if (!todos.some((x) => x.id === a.id || x.nome === a.nome)) todos.push(a);
        return `<details class="editor-extras-ui" data-grupo="${n}"><summary>${item.lanchesCombo?.length ? "Lanche " + g.numero + " do combo" : "Acréscimos"}</summary>${item.lanchesCombo?.length ? `<label>Observação deste lanche<textarea data-obs>${escaparOperacao(g.observacao || "")}</textarea></label>` : ""}${todos
          .map((a) => {
            const atual = (g.adicionais || []).find(
              (x) => (x.id && x.id === a.id) || x.nome === a.nome,
            );
            return `<label class="editor-extra-linha-ui"><span>${escaparOperacao(a.nome)} · ${moedaOperacao(atual?.preco ?? a.preco)}</span><input type="number" min="0" max="20" step="1" data-extra="${escaparOperacao(a.id || a.nome)}" data-nome="${escaparOperacao(a.nome)}" data-preco="${Number(atual?.preco ?? a.preco ?? 0)}" value="${Number(atual?.qtd || 0)}" aria-label="Quantidade de ${escaparOperacao(a.nome)}"></label>`;
          })
          .join("")}</details>`;
      })
      .join("")}<details><summary>Molhos pagos</summary>${[
      "Maionese",
      "Ketchup",
      "Mostarda",
      "Barbecue",
    ]
      .map((nome) => {
        const m = (item.molhosPagos || []).find((m) => m.nome === nome);
        return `<label class="editor-extra-linha-ui">${nome}<input data-molho="${nome}" data-preco="${Number(m?.preco ?? 2)}" type="number" min="0" max="99" step="1" value="${Number(m?.qtd || 0)}" aria-label="${nome} pago"></label>`;
      })
      .join(
        "",
      )}</details><details><summary>Molhos grátis</summary><div data-gratis></div></details><p role="status"></p><footer><button type="submit">${novo ? "Adicionar ao pedido" : "Salvar item"}</button></footer></form>`;
    const f = box.querySelector("form"),
      campo = (nome) => f.elements.namedItem(nome);
    const comestivel = !/bebida/i.test(item.categoria || "");
    d.classList.add("editor-item-ui");
    if (!comestivel) box.querySelectorAll("details").forEach((el) => (el.hidden = true));
    const molhos = ["Maionese", "Ketchup", "Mostarda", "Barbecue"];
    const montarGratis = () => {
      const count = comestivel
        ? Math.min(99, Number(campo("quantidade").value)) * (item.lanchesCombo?.length || 1)
        : 0;
      const antigas = [...box.querySelectorAll("[data-gratis] select")].map((s) => s.value);
      box.querySelector("[data-gratis]").innerHTML = Array.from({ length: count }, (_, n) => {
        const g = item.molhosGratis?.[n];
        const valor = antigas[n] ?? valorMolhosGratisEditorUI(g);
        const escolhas = [
          "",
          ...molhos.map((m) => "2:" + m),
          ...Array.from({ length: 15 }, (_, n) =>
            molhos.filter((m, i) => (n + 1) & (1 << i)).join("+"),
          ),
        ];
        if (valor && !escolhas.includes(valor)) escolhas.push(valor);
        return `<div class="editor-molho-unidade-ui"><strong>Unidade ${n + 1}</strong><select aria-label="Molhos da unidade ${n + 1}">${escolhas.map((v) => `<option value="${escaparOperacao(v)}" ${v === valor ? "selected" : ""}>${escaparOperacao(!v ? "Sem molho" : v.startsWith("2:") ? "2 " + v.slice(2) : v.split("+").join(" + "))}</option>`).join("")}</select></div>`;
      }).join("");
    };
    campo("quantidade").onchange = montarGratis;
    montarGratis();
    prepararPersonalizacoesEditorUI(box, d);
    if (item.lanchesCombo?.length) prepararComboItemEditorUI(box, d);
    const personalizacoes = document.createElement("div");
    personalizacoes.className = "editor-item-personalizacoes-ui";
    f.querySelector("details").before(personalizacoes);
    box.querySelectorAll(".editor-personalizar-ui").forEach((b) => personalizacoes.append(b));
    personalizacoes.hidden = !personalizacoes.childElementCount;
    const atualizarTotalItem = () => {
      const escolhido = f.querySelector('input[name="tipo"]:checked') || campo("tipo");
      if (ps?.exists)
        precoBaseAtual = Number(
          tipos.find((t) => t.valor === escolhido?.value)?.preco ?? produto.preco ?? base,
        );
      const acrescimos = [...box.querySelectorAll("[data-extra]")].reduce(
        (n, x) => n + Number(x.value) * Number(x.dataset.preco),
        0,
      );
      const pagos = [...box.querySelectorAll("[data-molho]")].reduce(
        (n, x) => n + Number(x.value) * Number(x.dataset.preco),
        0,
      );
      box.querySelector("[data-total-item]").textContent = moedaOperacao(
        (precoBaseAtual + acrescimos) * Number(campo("quantidade").value) + pagos,
      );
    };
    f.addEventListener("input", atualizarTotalItem);
    f.addEventListener("change", atualizarTotalItem);
    box.querySelectorAll("[data-quantidade]").forEach(
      (b) =>
        (b.onclick = () => {
          const quantidade = campo("quantidade");
          if (
            Number(b.dataset.quantidade) > 0 &&
            !item.lanchesCombo?.length &&
            [...box.querySelectorAll("[data-extra]")].some((x) => Number(x.value) > 0)
          ) {
            box.querySelector("[role=status]").textContent =
              "Com acréscimos, personalize um item por vez. Use quantidade 1.";
            return;
          }
          quantidade.value = String(
            Math.max(1, Math.min(99, Number(quantidade.value) + Number(b.dataset.quantidade))),
          );
          quantidade.dispatchEvent(new Event("change", { bubbles: true }));
        }),
    );
    atualizarTotalItem();
    f.onsubmit = (e) => {
      e.preventDefault();
      const quantidade = Number(campo("quantidade").value);
      const grupos = [...box.querySelectorAll("[data-grupo]")].map((el, n) => ({
        ...extras[n],
        observacao: (el.observacaoExternaUI || el.querySelector("[data-obs]"))?.value || "",
        adicionais: [...el.querySelectorAll("[data-extra]")]
          .filter((x) => Number(x.value) > 0)
          .map((x) => ({
            id: x.dataset.extra,
            nome: x.dataset.nome,
            preco: Number(x.dataset.preco),
            qtd: Number(x.value),
          })),
      }));
      if (quantidade > 1 && !item.lanchesCombo?.length && grupos.some((g) => g.adicionais.length)) {
        box.querySelector("[role=status]").textContent =
          "Personalize os acréscimos em um item por vez. Use quantidade 1.";
        return;
      }
      const precoBase = precoBaseAtual,
        adicional = grupos.reduce(
          (s, g) => s + g.adicionais.reduce((n, a) => n + a.preco * a.qtd, 0),
          0,
        );
      Object.assign(item, {
        nome: nomeProduto,
        quantidade,
        qtd: quantidade,
        precoBase,
        precoUnitario: precoBase + adicional,
        preco: precoBase + adicional,
        subtotal: Math.round((precoBase + adicional) * quantidade * 100) / 100,
        tipo: (f.querySelector('input[name="tipo"]:checked') || campo("tipo"))?.value || "",
        tipoCarne: (f.querySelector('input[name="tipo"]:checked') || campo("tipo"))?.value || "",
        observacao: campo("observacao").value,
        obs: campo("observacao").value,
      });
      if (item.lanchesCombo?.length) {
        item.lanchesCombo = grupos;
        const assinatura = (g) =>
          serializarOperacao({ adicionais: g.adicionais, observacao: g.observacao });
        const iguais = grupos.every((g) => assinatura(g) === assinatura(grupos[0]));
        item.comboPersonalizado = grupos.some((g) => g.adicionais.length || g.observacao);
        item.modoPersonalizacaoCombo = item.comboPersonalizado
          ? iguais
            ? "todos"
            : "individual"
          : "padrao";
      } else item.adicionais = grupos[0].adicionais;
      item.molhosPagos = [...box.querySelectorAll("[data-molho]")]
        .filter((x) => Number(x.value) > 0)
        .map((x) => ({
          nome: x.dataset.molho,
          qtd: Number(x.value),
          preco: Number(x.dataset.preco),
        }));
      item.totalMolhosPagos = item.molhosPagos.reduce((n, m) => n + m.qtd * m.preco, 0);
      item.molhosGratis = [...box.querySelectorAll("[data-gratis] select")].map((s, n) => ({
        unidade: n + 1,
        tipo: !s.value ? "semmolho" : s.value.startsWith("2:") ? "doisiguais" : "umdecada",
        molho: s.value.startsWith("2:") ? s.value.slice(2) : "",
        molhos: s.value && !s.value.startsWith("2:") ? s.value.split("+") : [],
        texto: !s.value
          ? "Sem molho"
          : s.value.startsWith("2:")
            ? "2 " + s.value.slice(2)
            : s.value.split("+").join(" + "),
      }));
      if (novo) p.itens.push(item);
      else p.itens[indice] = item;
      aoMudar();
      d.close();
    };
  } catch (err) {
    box.textContent = err.message;
  }
}
