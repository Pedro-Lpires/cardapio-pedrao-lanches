/* Cobrança pontual da compra, sem alterar preço de catálogo ou enviar preparo à chapa. */
function itemAcrescimoPedidoUI(motivo, valor) {
  motivo = String(motivo || "").trim();
  valor = Number(valor);
  if (motivo.length < 3 || motivo.length > 150) throw Error("Descreva o motivo do valor extra.");
  if (
    !Number.isFinite(valor) ||
    valor <= 0 ||
    valor > 9999 ||
    Math.abs(valor * 100 - Math.round(valor * 100)) > 0.00001
  )
    throw Error("Informe um valor maior que zero, com até duas casas decimais.");
  return {
    nome: "Valor extra: " + motivo,
    categoria: "ajuste",
    ajustePedido: true,
    quantidade: 1,
    precoUnitario: valor,
    preco: valor,
    subtotal: valor,
  };
}
function abrirAcrescimoPedidoUI(aplicar, original = null) {
  const janela = janelaEditorUI("Adicionar valor");
  const area = janela.querySelector(".editor-corpo-ui");
  area.innerHTML =
    '<form class="editor-form-ui"><p>Para uma troca ou cobrança combinada com o cliente. O preço dos produtos permanece igual.</p><label>Motivo<input name="motivo" required minlength="3" maxlength="150" placeholder="Ex.: troca das latas por refrigerante de 1 L"></label><label>Valor a acrescentar (R$)<input name="valor" type="number" min="0.01" max="9999" step="0.01" inputmode="decimal" required placeholder="0,00"></label><p role="status"></p><button type="submit">Adicionar ao total</button></form>';
  if (original) {
    area.querySelector("[name=motivo]").value = original.nome.replace(/^Valor extra: /, "");
    area.querySelector("[name=valor]").value = original.subtotal;
  }
  area.querySelector("form").onsubmit = async (e) => {
    e.preventDefault();
    const f = e.currentTarget,
      b = f.querySelector("button");
    b.disabled = true;
    try {
      await aplicar(itemAcrescimoPedidoUI(f.elements.motivo.value, f.elements.valor.value));
      janela.close();
    } catch (erro) {
      f.querySelector("[role=status]").textContent = erro.message;
      b.disabled = false;
    }
  };
}
async function adicionarValorComandaTransacaoUI(id, item) {
  const ref = db.collection("comandas").doc(id);
  await db.runTransaction(async (t) => {
    const doc = await t.get(ref);
    if (!doc.exists || doc.data().status !== "Aberta") throw Error("Esta comanda não está aberta.");
    const c = doc.data();
    t.update(ref, {
      itens: [...(c.itens || []), item],
      valorTotal: (centavosOperacao(c.valorTotal) + centavosOperacao(item.subtotal)) / 100,
    });
  });
}
function abrirAcrescimoComandaUI(id) {
  abrirAcrescimoPedidoUI(async (item) => {
    await adicionarValorComandaTransacaoUI(id, item);
    await abrirComandaVisual(id);
  });
}
async function substituirValorComandaTransacaoUI(id, indice, original, novo) {
  const ref = db.collection("comandas").doc(id);
  await db.runTransaction(async (t) => {
    const doc = await t.get(ref);
    if (!doc.exists || doc.data().status !== "Aberta") throw Error("Esta comanda não está aberta.");
    const c = doc.data(),
      itens = [...(c.itens || [])];
    if (serializarOperacao(itens[indice]) !== serializarOperacao(original))
      throw Error("O item mudou. Reabra a edição.");
    if (
      (c.pagamentos || []).some((p) =>
        (p.itens || []).some((i) => Number(i.itemIndex) === indice && Number(i.quantidade) > 0),
      )
    )
      throw Error("Este valor já foi pago e não pode ser editado.");
    const valorTotal =
      (centavosOperacao(c.valorTotal) -
        centavosOperacao(original.subtotal) +
        centavosOperacao(novo.subtotal)) /
      100;
    const pago = Math.max(
      Number(c.valorPago || 0),
      (c.pagamentos || []).reduce((s, p) => s + Number(p.valorQuitado ?? p.valor ?? 0), 0),
    );
    if (centavosOperacao(valorTotal) < centavosOperacao(pago))
      throw Error("O total ficaria menor que o valor já quitado.");
    itens[indice] = novo;
    t.update(ref, { itens, valorTotal });
  });
}
