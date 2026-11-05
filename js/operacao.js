/**
 * Serviços compartilhados: pagamentos, numeração, impressão, central de pedidos e cozinha. Mantém transações e regras de negócio fora dos estilos.
 *
 * Organização e caminhos: consulte GUIA-DO-CODIGO.md.
 */
/* Ferramentas compartilhadas de pagamento, produção e impressão. */
const escaparOperacao = (valor) =>
  String(valor ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
const moedaOperacao = (valor) =>
  Number(valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const centavosOperacao = (valor) => Math.round(Number(valor || 0) * 100);
// Somente novas metas usam R$ 10: preserva bônus já conquistados na regra anterior.
function bonusAcumuladoFidelidadeOperacao(cliente, novoTotal) {
  const metas =
    Math.floor(Math.max(0, centavosOperacao(novoTotal)) / 30000) -
    Math.floor(Math.max(0, centavosOperacao(cliente.totalFidelidade)) / 30000);
  return Math.max(0, Number(cliente.bonusGeradoTotal || 0) + metas * 10);
}
function baseFidelidadePedidoOperacao(pedido) {
  return (
    (pedido.itens || []).reduce(
      (s, i) =>
        s +
        centavosOperacao(
          i.subtotal ??
            Number(i.precoUnitario ?? i.preco ?? 0) * Number(i.quantidade ?? i.qtd ?? 1),
        ) +
        centavosOperacao(i.totalMolhosPagos),
      0,
    ) / 100
  );
}
function nivelFidelidadeOperacao(cliente, ativa = cliente?.fidelidadeAtiva) {
  if (!ativa) return "Sem nível";
  if (typeof nivelRankMensalUI === "function")
    return nivelRankMensalUI({ ...cliente, fidelidadeAtiva: true });
  if (cliente?.nivelCliente === "Lenda") return "Imortal";
  return ["Bronze", "Prata", "Ouro", "Diamante", "Imortal"].includes(cliente?.nivelCliente)
    ? cliente.nivelCliente
    : "Bronze";
}
async function garantirNivelFidelidadeOperacao(telefone) {
  const ref = db.collection("clientes").doc(telefone);
  return db.runTransaction(async (t) => {
    const doc = await t.get(ref);
    if (!doc.exists) return;
    const c = doc.data();
    if (c.fidelidadeAtiva && c.nivelCliente !== nivelFidelidadeOperacao(c))
      t.update(ref, { nivelCliente: nivelFidelidadeOperacao(c) });
  });
}
function serializarOperacao(valor) {
  if (Array.isArray(valor)) return "[" + valor.map(serializarOperacao).join(",") + "]";
  if (valor && typeof valor === "object")
    return (
      "{" +
      Object.keys(valor)
        .sort()
        .map((k) => JSON.stringify(k) + ":" + serializarOperacao(valor[k]))
        .join(",") +
      "}"
    );
  return JSON.stringify(valor);
}
// Resumo local de alteração: evita repetir a conferência ao apenas visualizar a comanda.
function assinaturaItensProducaoOperacao(itens) {
  const texto = serializarOperacao(itens || []);
  let a = 2166136261,
    b = 3335557771;
  for (let i = 0; i < texto.length; i++) {
    const c = texto.charCodeAt(i);
    a = Math.imul(a ^ c, 16777619);
    b = Math.imul(b ^ c, 2246822519);
  }
  return (
    texto.length +
    ":" +
    (a >>> 0).toString(16).padStart(8, "0") +
    (b >>> 0).toString(16).padStart(8, "0")
  );
}
function dialogoOperacao(titulo, entrada = null, confirmacao = false, opcoes = {}) {
  return new Promise((resolve) => {
    const dialog = document.createElement("dialog");
    dialog.className = entrada ? "ui-caixa ui-form-entrada" : "ui-caixa";
    dialog.innerHTML = `<form method="dialog"><h3>${escaparOperacao(titulo)}</h3>${entrada ? `<label>${escaparOperacao(opcoes.label || "Informe abaixo")}<input id="entrada-dialogo-operacao" type="${entrada}" autocomplete="off" ${opcoes.obrigatorio === false ? "" : "required"}></label>` : ""}<div class="operacao-acoes"><button value="ok" type="submit">${escaparOperacao(opcoes.botao || (confirmacao ? "Confirmar" : "Continuar"))}</button><button value="cancelar" type="button">Cancelar</button></div></form>`;
    if (entrada) dialog.querySelector("input").value = opcoes.valor ?? "";
    const cancelar = dialog.querySelector('[value="cancelar"]');
    cancelar.textContent = "×";
    cancelar.className = "ui-x";
    cancelar.setAttribute("aria-label", "Fechar e cancelar");
    cancelar.onclick = () => dialog.close("cancelar");
    dialog.prepend(cancelar);
    dialog.addEventListener(
      "close",
      () => {
        const valor =
          dialog.returnValue === "ok"
            ? entrada
              ? dialog.querySelector("input").value
              : true
            : null;
        dialog.remove();
        resolve(valor);
      },
      { once: true },
    );
    document.body.append(dialog);
    dialog.showModal();
  });
}
function confirmarOperacao(texto) {
  return dialogoOperacao(texto, null, true);
}
function solicitarEntradaOperacao(texto, tipo = "text") {
  return dialogoOperacao(texto, tipo);
}
function solicitarTextoUI(texto, valor = "") {
  return dialogoOperacao(texto, "text", false, { valor, obrigatorio: false });
}
function avisoOperacao(texto) {
  if (
    typeof mostrarAvisoUI === "function" &&
    typeof personagemAvisoPedraoUI === "function" &&
    personagemAvisoPedraoUI({ mensagem: texto })
  ) {
    mostrarAvisoUI(texto);
    return;
  }
  const dialog = document.createElement("dialog");
  dialog.className = "ui-caixa ui-aviso-operacao";
  dialog.innerHTML = `<p>${escaparOperacao(texto)}</p><button type="button" class="ui-x" aria-label="Fechar aviso">×</button>`;
  dialog.querySelector("button").onclick = () => dialog.close();
  dialog.addEventListener("close", () => dialog.remove(), { once: true });
  document.body.append(dialog);
  dialog.showModal();
}
function saldoComandaPagamento(comanda) {
  const quitado = (comanda.pagamentos || []).reduce(
    (n, p) => n + centavosOperacao(p.valorQuitado ?? p.valor ?? 0),
    0,
  );
  return Math.max(0, centavosOperacao(comanda.valorTotal) - quitado) / 100;
}
async function abrirPagamentoSaldoJuntoUI(id, comanda) {
  const saldo = saldoComandaPagamento(comanda);
  if (saldo <= 0) return avisoOperacao("Esta comanda já está quitada.");
  modoPagamentoSeparado = "saldo";
  selecaoPagamentoSeparado = [];
  itensPagamentoSeparadoAtual = [
    {
      nome: "Saldo restante da comanda",
      quantidade: 1,
      qtd: 1,
      precoUnitario: saldo,
      subtotal: saldo,
      tipo: "pagamento_por_valor",
    },
  ];
  cupomPagamentoSeparadoAtual = null;
  cuponsPagamentoSeparadoAtuais = [];
  await abrirBeneficiosPagamentoSeparado(
    id,
    saldo,
    comanda.clienteId || null,
    comanda.cliente || null,
  );
}
async function abrirPagamentoSeparadoPorValor(id) {
  const doc = await db.collection("comandas").doc(id).get();
  if (!doc.exists) return avisoOperacao("Comanda não encontrada.");
  const saldo = saldoComandaPagamento(doc.data());
  modoPagamentoSeparado = "valor";
  document.getElementById("area-fechamento-comanda").innerHTML = `
        <button type="button" onclick="abrirPagamentoSeparado('${escaparOperacao(id)}')">Voltar para itens</button>
        <p>Saldo pendente: <strong>${moedaOperacao(saldo)}</strong></p>
        <label for="valor-parte-comanda">Valor que esta pessoa vai pagar</label>
        <input id="valor-parte-comanda" type="text" inputmode="decimal" placeholder="15,00" autocomplete="off">
        <button type="button" onclick="continuarPagamentoPorValor('${escaparOperacao(id)}')">Continuar para pagamento</button>`;
  document.getElementById("valor-parte-comanda").focus();
}
function lerValorOperacao(texto) {
  texto = String(texto).trim();
  if (!/^\d+(?:[,.]\d{1,2})?$/.test(texto)) return NaN;
  return Number(texto.replace(",", "."));
}
async function continuarPagamentoPorValor(id) {
  const valor = lerValorOperacao(document.getElementById("valor-parte-comanda").value);
  const doc = await db.collection("comandas").doc(id).get();
  if (!doc.exists || doc.data().status !== "Aberta")
    return avisoOperacao("Esta comanda não está aberta.");
  if (
    !Number.isFinite(valor) ||
    valor <= 0 ||
    centavosOperacao(valor) > centavosOperacao(saldoComandaPagamento(doc.data()))
  ) {
    return avisoOperacao("Informe um valor maior que zero e até o saldo pendente.");
  }
  modoPagamentoSeparado = "valor";
  selecaoPagamentoSeparado = [];
  // Não associa frações a produtos: cupons por item não são elegíveis neste modo.
  itensPagamentoSeparadoAtual = [
    {
      nome: "Divisão da comanda por valor",
      quantidade: 1,
      qtd: 1,
      precoUnitario: valor,
      subtotal: valor,
      tipo: "pagamento_por_valor",
    },
  ];
  cupomPagamentoSeparadoAtual = null;
  cuponsPagamentoSeparadoAtuais = [];
  await abrirIdentificacaoPagamentoSeparado(id, valor);
}
function tiposCarneProdutoOperacao(produto) {
  const categoria = String(produto.categoria || "").toLowerCase();
  if (categoria && !["lanches", "combos"].includes(categoria)) return [];
  const opcoes = produto.opcoes;
  const tipos = [
    { valor: "artesanal", nome: "Artesanal", preco: Number(produto.preco) || 0 },
    { valor: "industrial", nome: "Industrial", preco: Number(produto.precoIndustrial) || 0 },
    { valor: "frango", nome: "Frango", preco: Number(produto.precoFrango) || 0 },
    { valor: "file", nome: "Filé", preco: Number(produto.precoFile) || 0 },
  ].filter((t) => t.preco > 0 && (opcoes ? opcoes[t.valor] === true : true));
  const principal = produto.tipoBase === "hamburguer" ? "artesanal" : produto.tipoBase;
  return tipos.sort((a, b) => Number(b.valor === principal) - Number(a.valor === principal));
}
function aplicarTipoComboOperacao(produto, tipo) {
  const opcoes = tiposCarneProdutoOperacao(produto);
  if (opcoes.length < 2) return produto;
  const escolhido =
    opcoes.find((opcao) => opcao.valor === String(tipo || "").toLowerCase()) || opcoes[0];
  const descricao = String(produto.descricao || produto.desc || "").replace(
    /artesanal|industrial/gi,
    escolhido.valor,
  );
  return {
    ...produto,
    preco: escolhido.preco,
    tipo: escolhido.valor,
    tipoCarne: escolhido.valor,
    descricao,
    desc: descricao,
    comboComponentes: (produto.comboComponentes || []).map((componente) =>
      componente.categoria === "lanches"
        ? { ...componente, tipoCarne: escolhido.nome }
        : { ...componente },
    ),
  };
}
function cupomUsoUnicoOperacao(cupom) {
  return cupom?.uso === "unico";
}
function verificarDisponibilidadeCupomOperacao(cupom) {
  if (cupom?.usadoEm) throw Error("Este cupom já foi utilizado e não está mais disponível.");
}
async function prepararUsoCupomAtomicoOperacao(t, codigo, clienteId, origem, contextoRank) {
  if (!codigo) return () => {};
  const cupomRef = db.collection("cuponsDesconto").doc(codigo);
  const cupom = await t.get(cupomRef);
  if (!cupom.exists) throw Error("Cupom indisponível.");
  const dados = cupom.data();
  verificarDisponibilidadeCupomOperacao(dados);
  if (!dados.ativo) throw Error("Cupom indisponível.");
  if (dados.clientesPermitidos && !dados.clientesPermitidos.includes(String(clienteId || "")))
    throw Error("Cupom indisponível para esta conta.");
  if (dados.rankRegra) await verificarRankCupomTransacaoUI(t, dados, clienteId, contextoRank);
  if (!cupomUsoUnicoOperacao(dados)) return () => {};
  return () =>
    t.update(cupomRef, {
      ativo: false,
      usadoEm: Date.now(),
      usadoPor: clienteId || "",
      origemUso: origem,
    });
}
async function salvarPedidoComCupomOperacao(ref, pedido) {
  return db.runTransaction(async (t) => {
    if ((await t.get(ref)).exists) return;
    const registrarUso = await prepararUsoCupomAtomicoOperacao(
      t,
      pedido.cupomDescontoCodigo,
      pedido.clienteId,
      ref.path,
      typeof contextoCupomPedidoRankUI === "function" ? contextoCupomPedidoRankUI(pedido) : null,
    );
    const beneficio =
      typeof prepararBeneficioEntregaUI === "function"
        ? await prepararBeneficioEntregaUI(t, pedido, "reservar")
        : { patch: {}, salvar: () => {} };
    t.set(ref, { ...pedido, ...beneficio.patch });
    registrarUso();
    beneficio.salvar();
  });
}
function lotePagamentoCupomOperacao(codigo, clienteId, comandaRef) {
  if (!codigo && typeof prepararRankMensalUI !== "function") return db.batch();
  const escritas = [];
  const lote = {
    set: (r, d) => escritas.push(["set", r, d]),
    update: (r, d) => escritas.push(["update", r, d]),
    delete: (r) => escritas.push(["delete", r]),
  };
  lote.commit = () =>
    db.runTransaction(async (t) => {
      const atual = await t.get(comandaRef);
      if (!atual.exists || atual.data().status !== "Aberta")
        throw Error("Esta comanda já foi encerrada.");
      const patchCupom =
        escritas.find(([modo, ref]) => modo === "update" && ref.path === comandaRef.path)?.[2] ||
        {};
      const registrarUso = await prepararUsoCupomAtomicoOperacao(
        t,
        codigo,
        clienteId,
        comandaRef.path,
        {
          base: Number(patchCupom.valorOriginal || 0),
          itens: atual.data().itens || [],
          desconto: Number(patchCupom.descontoCupom || 0),
        },
      );
      const salvarRank =
        typeof prepararRankMensalUI === "function"
          ? await prepararRankMensalUI(
              t,
              lancamentosComandaRankMensalUI(comandaRef.id, { ...atual.data(), ...patchCupom }),
            )
          : () => {};
      for (const [modo, ref, dados] of escritas)
        t[modo](ref, ...(modo === "delete" ? [] : [dados]));
      registrarUso();
      salvarRank();
    });
  return lote;
}
async function salvarPagamentoSeparadoAtomico(ref, anterior, pagamento, atualizacao, itens) {
  const historicoRef = db.collection("historicoPagamentosClientes").doc(pagamento.id);
  const clienteRef = pagamento.clienteId
    ? db.collection("clientes").doc(pagamento.clienteId)
    : null;
  await db.runTransaction(async (t) => {
    const atual = await t.get(ref);
    const historico = await t.get(historicoRef);
    const cliente = clienteRef ? await t.get(clienteRef) : null;
    const cupomRef = pagamento.cupomId
      ? db.collection("cuponsDesconto").doc(pagamento.cupomId)
      : null;
    const cupom = cupomRef ? await t.get(cupomRef) : null;
    if (historico.exists || (atual.data()?.pagamentos || []).some((p) => p.id === pagamento.id))
      return;
    const registrarUso = await prepararUsoCupomAtomicoOperacao(
      t,
      pagamento.cupomId,
      pagamento.clienteId,
      historicoRef.path,
      {
        base: Number(pagamento.valorOriginal || 0),
        itens,
        desconto: Number(pagamento.descontoCupom || 0),
      },
    );
    if (!atual.exists || atual.data().status !== "Aberta")
      throw Error("A comanda já foi encerrada.");
    if (
      cupomRef &&
      (!cupom.exists ||
        !cupom.data().ativo ||
        (cupom.data().clientesPermitidos &&
          !cupom.data().clientesPermitidos.includes(String(pagamento.clienteId || ""))))
    )
      throw Error("O cupom não está mais disponível para esta conta.");
    if (
      cupom?.exists &&
      cupom.data().temPedidoMinimo &&
      centavosOperacao(pagamento.valorOriginal) < centavosOperacao(cupom.data().pedidoMinimo)
    )
      throw Error("Esta parte não atinge mais a compra mínima do cupom.");
    if (
      serializarOperacao(atual.data().pagamentos || []) !==
      serializarOperacao(anterior.pagamentos || [])
    ) {
      // O fluxo antigo acrescenta a parte à própria lista anterior antes de salvar.
      const antes = (anterior.pagamentos || []).filter((p) => p.id !== pagamento.id);
      if (serializarOperacao(atual.data().pagamentos || []) !== serializarOperacao(antes))
        throw Error("Outro pagamento foi registrado. Reabra o pagamento e confira o saldo.");
    }
    if (serializarOperacao(atual.data().itens || []) !== serializarOperacao(anterior.itens || []))
      throw Error("Os itens mudaram. Reabra o pagamento para conferir.");
    if (
      centavosOperacao(pagamento.valorQuitado) >
      centavosOperacao(saldoComandaPagamento(atual.data()))
    )
      throw Error("Esta parte ultrapassa o saldo atual.");
    if (pagamento.modo === "itens") {
      const pagos = {};
      (atual.data().pagamentos || []).forEach((p) =>
        (p.itens || []).forEach(
          (i) => (pagos[i.itemIndex] = (pagos[i.itemIndex] || 0) + Number(i.quantidade)),
        ),
      );
      for (const item of pagamento.itens) {
        const original = atual.data().itens[item.itemIndex];
        if (
          !original ||
          item.quantidade + (pagos[item.itemIndex] || 0) >
            Number(original.quantidade || original.qtd || 1)
        )
          throw Error("Um dos itens já foi pago. Reabra a seleção.");
      }
    }
    const salvarRank =
      typeof prepararRankMensalUI === "function"
        ? await prepararRankMensalUI(
            t,
            lancamentosComandaRankMensalUI(ref.id, { ...atual.data(), ...atualizacao }),
          )
        : () => {};
    if (cliente?.exists) {
      const c = cliente.data();
      const valorPago = Number(pagamento.valorPago);
      const patch = { totalGasto: Number(c.totalGasto || 0) + valorPago };
      if (c.fidelidadeAtiva) {
        const novoTotal = Number(c.totalFidelidade || 0) + valorPago;
        const gerado = bonusAcumuladoFidelidadeOperacao(c, novoTotal);
        const bonus =
          Number(c.bonusDisponivel || 0) +
          Math.max(0, gerado - Number(c.bonusGeradoTotal || 0)) -
          Number(pagamento.descontoFidelidade || 0);
        if (bonus < -0.001) throw Error("O bônus disponível mudou. Reabra os benefícios.");
        Object.assign(patch, {
          totalFidelidade: novoTotal,
          bonusGeradoTotal: gerado,
          bonusDisponivel: Math.max(0, bonus),
        });
      } else if (pagamento.descontoFidelidade > 0)
        throw Error("A fidelidade deste cliente não está ativa.");
      t.update(clienteRef, patch);
    } else if (clienteRef) throw Error("O cadastro do cliente não está disponível.");
    salvarRank();
    const lista = atualizacao.pagamentos;
    const valorPago = lista.reduce((n, p) => n + centavosOperacao(p.valorPago ?? p.valor), 0) / 100;
    const valorQuitado =
      lista.reduce((n, p) => n + centavosOperacao(p.valorQuitado ?? p.valor), 0) / 100;
    const saldoPendente =
      Math.max(0, centavosOperacao(atual.data().valorTotal) - centavosOperacao(valorQuitado)) / 100;
    registrarUso();
    t.update(ref, {
      ...atualizacao,
      valorPago,
      valorQuitado,
      saldoPendente,
      status: saldoPendente === 0 ? "Fechada" : "Aberta",
      pagamentoParcial: saldoPendente > 0,
    });
    if (clienteRef)
      t.set(historicoRef, {
        clienteId: pagamento.clienteId,
        clienteAuthUid: cliente?.exists ? cliente.data().authUid || null : null,
        clienteNome: pagamento.clienteNome || "",
        comandaId: ref.id,
        pedidoId: anterior.pedidoOrigemId || null,
        mesa: anterior.mesa || null,
        origem: "consumo_local",
        tipo: "pagamento_comanda",
        modo: pagamento.modo,
        itens,
        valorOriginal: pagamento.valorOriginal,
        valorPago: pagamento.valorPago,
        descontoCupom: pagamento.descontoCupom,
        descontoFidelidade: pagamento.descontoFidelidade,
        cupomCodigo: pagamento.cupomCodigo,
        cupomNome: pagamento.cupomNome,
        formas: pagamento.formas,
        criadoEm: pagamento.pagoEm,
        criadoEmMs: pagamento.pagoEm,
        data: new Date(pagamento.pagoEm).toISOString(),
      });
  });
}

// Consolidação só combina itens com a mesma personalização.
function identidadeItemOperacao(item) {
  return {
    nome: item.nome || "Item",
    categoria: item.categoria || "",
    carne: item.tipoCarne || item.carne || item.tipo || "",
    adicionais: item.adicionais || [],
    obs: item.observacao || item.obs || "",
    lanchesCombo: item.lanchesCombo || item.lanchesPersonalizados || [],
    bebida: item.bebida || item.bebidaCombo || "",
    bebidas: item.bebidas || [],
    comboComponentes: item.comboComponentes || [],
    combo: item.combo || null,
  };
}
function agruparItensOperacao(itens) {
  const grupos = new Map();
  for (const item of itens || []) {
    const detalhe = identidadeItemOperacao(item);
    const chave = serializarOperacao(detalhe);
    if (!grupos.has(chave))
      grupos.set(chave, {
        ...item,
        ...detalhe,
        quantidade: 0,
        ...(item.leituraChapeiro ? { repeticoesPersonalizacaoChapeiro: 0 } : {}),
      });
    const grupo = grupos.get(chave);
    grupo.quantidade += Number(item.quantidade ?? item.qtd ?? 1);
    if (item.leituraChapeiro)
      grupo.repeticoesPersonalizacaoChapeiro += Number(item.repeticoesPersonalizacaoChapeiro || 1);
  }
  return [...grupos.values()];
}
// Limpar/retirar apenas ocultam registros; somente OK conclui o preparo.
function itensPendentesPreparoOperacao(itens, filas, corteEnvio) {
  const concluidos = agruparItensOperacao(
    filas.filter((f) => f.status === "pronto" && !f.reenviadoEm).flatMap((f) => f.itens || []),
  );
  const chave = (item) => serializarOperacao(identidadeItemOperacao(item));
  const quantidades = new Map(concluidos.map((item) => [chave(item), item.quantidade]));
  return agruparItensOperacao(itens)
    .map((item) => ({
      ...item,
      quantidade: Math.max(0, item.quantidade - (quantidades.get(chave(item)) || 0)),
    }))
    .filter((item) => item.quantidade > 0);
}
// A edição registra qual linha foi alterada, inclusive quando há itens iguais.
function registrarEdicaoPreparoComandaOperacao(comanda, indice, depois) {
  const antes = comanda.itens[indice];
  const chave = (item) => serializarOperacao(identidadeItemOperacao(item));
  const quantidade = (item) => Number(item.quantidade ?? item.qtd ?? 1);
  const edicoes = comanda.edicoesPendentesCozinha || [];
  if (chave(antes) === chave(depois) && quantidade(antes) === quantidade(depois)) return edicoes;
  const deslocamento = comanda.itens
    .slice(0, indice)
    .filter((item) => chave(item) === chave(antes))
    .reduce((soma, item) => soma + quantidade(item), 0);
  return [...edicoes, { antes, depois, deslocamento }];
}
function aplicarEdicoesPreparoOperacao(filas, edicoes, corte) {
  const chave = (item) => serializarOperacao(identidadeItemOperacao(item));
  const quantidade = (item) => Number(item.quantidade ?? item.qtd ?? 1);
  const corrigidas = filas
    .map((fila) => ({ ...fila, itens: (fila.itens || []).map((item) => ({ ...item })) }))
    .sort(
      (a, b) =>
        Number(a.criadoEmMs) - Number(b.criadoEmMs) || String(a.id).localeCompare(String(b.id)),
    );
  for (const edicao of edicoes || []) {
    let deslocamento = Number(edicao.deslocamento || 0);
    let anteriores = quantidade(edicao.antes);
    let novas = quantidade(edicao.depois);
    for (const fila of corrigidas) {
      if (!["aguardando", "retirado", "pronto", "limpo"].includes(fila.status)) continue;
      fila.itens = fila.itens.flatMap((item) => {
        if (!anteriores || chave(item) !== chave(edicao.antes)) return [item];
        const total = quantidade(item);
        const ignoradas = Math.min(deslocamento, total);
        deslocamento -= ignoradas;
        const atingidas = Math.min(anteriores, total - ignoradas);
        anteriores -= atingidas;
        const alteradas = Math.min(novas, atingidas);
        novas -= alteradas;
        if (
          !atingidas ||
          !["aguardando", "retirado"].includes(fila.status) ||
          Number(fila.criadoEmMs) < corte
        )
          return [item];
        return [
          ...(total > atingidas ? [{ ...item, quantidade: total - atingidas }] : []),
          ...(alteradas ? [{ ...edicao.depois, quantidade: alteradas }] : []),
        ];
      });
    }
  }
  return corrigidas;
}
// Preserva cada envio que ainda está na chapa; só a sobra vira uma nova remessa.
function distribuirLotesPreparoOperacao(pendentes, filas, corte) {
  const chave = (item) => serializarOperacao(identidadeItemOperacao(item));
  const restantes = new Map(
    agruparItensOperacao(pendentes).map((item) => [chave(item), { ...item }]),
  );
  const lotes = filas
    .filter((f) => ["aguardando", "retirado"].includes(f.status) && Number(f.criadoEmMs) >= corte)
    .sort(
      (a, b) =>
        Number(a.criadoEmMs) - Number(b.criadoEmMs) || String(a.id).localeCompare(String(b.id)),
    )
    .map((fila) => ({
      fila,
      itens: agruparItensOperacao(fila.itens).flatMap((item) => {
        const restante = restantes.get(chave(item));
        const quantidade = Math.min(item.quantidade, restante?.quantidade || 0);
        if (!quantidade) return [];
        restante.quantidade -= quantidade;
        return [{ ...restante, quantidade }];
      }),
    }));
  return { lotes, novos: [...restantes.values()].filter((item) => item.quantidade > 0) };
}
async function buscarItensPendentesPreparoOperacao(colecao, id, itens, dadosOrigem = null) {
  const [config, snap] = await Promise.all([
    db.collection("config").doc("producaoTela").get(),
    db.collection("filaCozinha").where("origemId", "==", id).get(),
  ]);
  const corte = Math.max(
    janelaOperacionalOperacao().inicio,
    Number(config.data()?.limpaAntes || 0) + 1,
  );
  const filas = snap.docs
    .map((d) => ({ ...d.data(), id: d.id }))
    .filter((f) => f.origemColecao === colecao);
  return itensPendentesPreparoOperacao(itens, filas, corte);
}
function componentesComboOperacao(item) {
  if (!/combo/i.test(item.categoria || item.nome || "")) return [];
  if (item.comboComponentes?.length)
    return item.comboComponentes.map((c) => ({
      ...c,
      quantidade: Number(c.quantidade || c.qtd || 1),
    }));
  const descricao = String(item.descricao || item.desc || "").trim();
  const partes =
    descricao && /^\d+\s/.test(descricao)
      ? descricao.split("+")
      : [String(item.nome || "").replace(/^combo\s*/i, "")];
  return partes
    .map((parte, n) => {
      const match = parte.trim().match(/^(\d+)\s+(.+)/);
      const nome = match ? match[2].trim() : parte.trim();
      const categoria = /refrigerante|refri|coca|guaran[aá]|bebida|suco|[aá]gua|cerveja/i.test(nome)
        ? "bebidas"
        : /batata/i.test(nome)
          ? "batatas"
          : "lanches";
      return {
        nome,
        categoria,
        quantidade: match
          ? Number(match[1])
          : categoria === "lanches" && n === 0
            ? Number(item.comboQtdLanches || item.lanchesCombo?.length || 1)
            : 1,
        tipoCarne: categoria === "lanches" ? item.tipoCarne || item.carne || item.tipo || "" : "",
      };
    })
    .filter((c) => c.nome && c.quantidade > 0);
}
function detalhesComponentesComboOperacao(item) {
  const componentes = componentesComboOperacao(item);
  if (!componentes.length) return "";
  const quantidade = Number(item.quantidade ?? item.qtd ?? 1);
  return (
    '<ul class="combo-componentes-ui" aria-label="Itens do combo">' +
    componentes
      .map(
        (c) =>
          "<li>" +
          escaparOperacao(quantidade * c.quantidade) +
          " " +
          escaparOperacao(c.nome) +
          (c.tipoCarne ? " · " + escaparOperacao(c.tipoCarne) : "") +
          "</li>",
      )
      .join("") +
    "</ul>"
  );
}
function detalhesLanchesComboOperacao(item) {
  const lanches = item.lanchesCombo || item.lanchesPersonalizados || [];
  if (!lanches.length) return "";
  const assinatura = (l) =>
    serializarOperacao({
      adicionais: (l.adicionais || [])
        .filter((a) => Number(a.qtd ?? a.quantidade ?? 1) > 0)
        .map((a) => ({ nome: a.nome, qtd: Number(a.qtd ?? a.quantidade ?? 1) }))
        .sort((a, b) => a.nome.localeCompare(b.nome)),
      obs: l.observacao || l.obs || "",
    });
  const todos =
    item.modoPersonalizacaoCombo === "todos" ||
    (!item.modoPersonalizacaoCombo &&
      lanches.length > 1 &&
      lanches.every((l) => assinatura(l) === assinatura(lanches[0])));
  const detalhe = (l) =>
    detalhesItemOperacao({ ...l, lanchesCombo: [], lanchesPersonalizados: [] });
  if (todos) {
    const html = detalhe(lanches[0]);
    return html ? '<div class="producao-combo"><strong>Todos com:</strong>' + html + "</div>" : "";
  }
  const repeticoes = item.leituraChapeiro ? Number(item.repeticoesPersonalizacaoChapeiro || 1) : 1;
  return Array.from({ length: repeticoes }, () => lanches)
    .flat()
    .map((l, n) => {
      const html = detalhe(l);
      return html
        ? '<div class="producao-combo"><strong>' +
            (item.leituraChapeiro ? "1 lanche com:" : "Lanche " + (l.numero || n + 1)) +
            "</strong>" +
            html +
            "</div>"
        : "";
    })
    .join("");
}
function itensChapeiroOperacao(itens) {
  const bebida = (nome) =>
    /refrigerante|refri|coca|guaran[aá]|bebida|suco|[aá]gua|cerveja/i.test(nome || "");
  return (itens || []).flatMap((item) => {
    if (item.ajustePedido || item.categoria === "ajuste") return [];
    if (
      /bebida/i.test(item.categoria || "") ||
      (!/combo/i.test(item.categoria || item.nome || "") && bebida(item.nome))
    )
      return [];
    if (!/combo/i.test(item.categoria || item.nome || "")) return [item];
    const quantidade = Number(item.quantidade ?? item.qtd ?? 1);
    return componentesComboOperacao(item)
      .filter((c) => c.categoria !== "bebidas")
      .map((c, n) => {
        const nome = c.nome;
        const lanche = c.categoria === "lanches";
        return {
          ...item,
          nome,
          quantidade: quantidade * c.quantidade,
          categoria: c.categoria,
          tipo: lanche ? item.tipo || "" : "",
          carne: lanche ? item.carne || "" : "",
          tipoCarne: lanche ? item.tipoCarne || item.carne || item.tipo || c.tipoCarne || "" : "",
          comboComponentes: [],
          leituraChapeiro: true,
          repeticoesPersonalizacaoChapeiro: quantidade,
          descricao: "",
          desc: "",
          bebida: "",
          bebidas: [],
          lanchesCombo: lanche ? item.lanchesCombo || item.lanchesPersonalizados || [] : [],
          lanchesPersonalizados: [],
          adicionais: lanche ? item.adicionais || [] : [],
          observacao: lanche ? item.observacao || "" : "",
          obs: lanche ? item.obs || "" : "",
        };
      });
  });
}
function detalhesItemOperacao(item) {
  let html = detalhesComponentesComboOperacao(item);
  if (item.carne || item.tipoCarne || item.tipo)
    html += `<p>Tipo: ${escaparOperacao(item.carne || item.tipoCarne || item.tipo)}</p>`;
  for (const ad of item.adicionais || [])
    html += `<p>+ ${escaparOperacao(ad.qtd || ad.quantidade || 1)} ${escaparOperacao(ad.nome)}</p>`;
  const obs = item.observacao || item.obs;
  if (obs)
    html += `<p class="producao-obs">${/combo/i.test(item.categoria || item.nome || "") ? "Obs. geral:" : "Obs.:"} ${escaparOperacao(obs)}</p>`;
  html += detalhesLanchesComboOperacao(item);
  return html;
}
function itensHtmlOperacao(itens, valores = false) {
  return (valores ? itens : agruparItensOperacao(itens))
    .map(
      (item) =>
        `<article class="producao-item"><strong>${escaparOperacao(item.quantidade ?? item.qtd ?? 1)} ${escaparOperacao(item.nome)}</strong>${valores ? `<span>${moedaOperacao(item.subtotal ?? Number(item.precoUnitario ?? item.preco ?? 0) * Number(item.quantidade ?? item.qtd ?? 1))}</span>` : ""}${detalhesItemOperacao(item)}</article>`,
    )
    .join("");
}
// Esta consolidação é só de leitura do chapeiro; mantém os itens da compra intactos.
function agruparPreparoChapeiroOperacao(itens) {
  const normalizar = (valor) =>
    String(valor || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
  const grupos = new Map();
  for (const item of itensChapeiroOperacao(itens)) {
    const quantidade = Number(item.quantidade ?? item.qtd ?? 1);
    if (quantidade <= 0) continue;
    const tipo = item.tipoCarne || item.carne || item.tipo || "";
    const categoria = item.categoria || (/batata/i.test(item.nome) ? "batatas" : "lanches");
    const chave = serializarOperacao([
      normalizar(item.nome),
      normalizar(tipo),
      normalizar(categoria),
    ]);
    if (!grupos.has(chave))
      grupos.set(chave, {
        nome: item.nome,
        tipo,
        categoria: normalizar(categoria),
        quantidade: 0,
        padrao: 0,
        personalizacoes: new Map(),
      });
    const grupo = grupos.get(chave);
    grupo.quantidade += quantidade;
    const adicionar = (config, qtd) => {
      const adicionais = new Map();
      for (const ad of [...(item.adicionais || []), ...(config?.adicionais || [])]) {
        const unidades = Number(ad.qtd ?? ad.quantidade ?? 1);
        if (unidades <= 0) continue;
        const nome = normalizar(ad.nome);
        if (!adicionais.has(nome))
          adicionais.set(nome, { nome: String(ad.nome || "").trim(), qtd: 0 });
        adicionais.get(nome).qtd += unidades;
      }
      const lista = [...adicionais.values()].sort((a, b) =>
        normalizar(a.nome).localeCompare(normalizar(b.nome)),
      );
      const observacao = [
        ...new Set(
          [item.observacao || item.obs || "", config?.observacao || config?.obs || ""]
            .map((obs) => String(obs).trim())
            .filter(Boolean),
        ),
      ].join(" / ");
      if (!lista.length && !observacao) {
        grupo.padrao += qtd;
        return;
      }
      const assinatura = serializarOperacao({
        adicionais: lista.map((ad) => ({ nome: normalizar(ad.nome), qtd: ad.qtd })),
        observacao: normalizar(observacao),
      });
      if (!grupo.personalizacoes.has(assinatura))
        grupo.personalizacoes.set(assinatura, { quantidade: 0, adicionais: lista, observacao });
      grupo.personalizacoes.get(assinatura).quantidade += qtd;
    };
    const lanches = item.lanchesCombo || item.lanchesPersonalizados || [];
    if (item.leituraChapeiro && lanches.length) {
      const repeticoes = Number(item.repeticoesPersonalizacaoChapeiro || 1);
      const porCombo = Math.max(1, Math.round(quantidade / repeticoes));
      for (let n = 1; n <= porCombo; n++) {
        const config =
          item.modoPersonalizacaoCombo === "todos"
            ? lanches[0]
            : lanches.find((l, i) => Number(l.numero || i + 1) === n);
        adicionar(config, repeticoes);
      }
    } else adicionar(null, quantidade);
  }
  return [...grupos.values()].map((grupo) => ({
    ...grupo,
    personalizacoes: [...grupo.personalizacoes.values()],
  }));
}
function itensHtmlChapeiroOperacao(itens) {
  const normalizar = (v) =>
    String(v || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
  const chave = (g) => normalizar(g.nome) + "|" + normalizar(g.tipo);
  const totais = new Map(
    agruparPreparoChapeiroOperacao(itens).map((g) => [chave(g), g.quantidade]),
  );
  const detalhes = (grupo, total = grupo.quantidade) =>
    grupo.personalizacoes
      .map(
        (config) =>
          '<div class="producao-combo preparo-personalizacao"><strong>' +
          (config.quantidade === total && total > 1
            ? "Todos com:"
            : (grupo.quantidade === 1 ? "" : config.quantidade + " ") +
              (grupo.categoria === "batatas"
                ? config.quantidade === 1
                  ? "porção com:"
                  : "porções com:"
                : config.quantidade === 1
                  ? "lanche com:"
                  : "lanches com:")) +
          "</strong>" +
          config.adicionais
            .map((ad) => "<p>+ " + ad.qtd + " " + escaparOperacao(ad.nome) + "</p>")
            .join("") +
          (config.observacao
            ? '<p class="producao-obs">Obs.: ' + escaparOperacao(config.observacao) + "</p>"
            : "") +
          "</div>",
      )
      .join("");
  const recados = new Map();
  const preparo = (itens || []).map((item) => {
    const configs = item.lanchesCombo || item.lanchesPersonalizados || [];
    const compartilhada =
      item.modoPersonalizacaoCombo === "todos" &&
      configs.length &&
      configs.every(
        (c) => (c.observacao || c.obs || "") === (configs[0].observacao || configs[0].obs || ""),
      )
        ? configs[0].observacao || configs[0].obs
        : "";
    const obs = item.observacao || item.obs || compartilhada;
    if (!/combo/i.test(item.categoria || item.nome || "") || !obs) return item;
    const componentes = componentesComboOperacao(item);
    const lanches = componentes.filter((c) => c.categoria === "lanches");
    if (!lanches.length) return item;
    const limpo = {
      ...item,
      observacao: "",
      obs: "",
      comboComponentes: lanches,
      lanchesCombo: configs.map((c) =>
        (c.observacao || c.obs) === obs ? { ...c, observacao: "", obs: "" } : c,
      ),
      lanchesPersonalizados: [],
    };
    const grupos = agruparPreparoChapeiroOperacao([limpo]);
    const primeiro = grupos[0];
    const acompanhamentos = componentes.filter(
      (c) => c.categoria !== "lanches" && c.categoria !== "bebidas",
    );
    const multiplicador = Number(item.quantidade ?? item.qtd ?? 1);
    const html =
      '<div class="producao-combo preparo-personalizacao preparo-obs-combo">' +
      grupos
        .map((g) =>
          g.personalizacoes.length
            ? detalhes(g, totais.get(chave(g)))
            : g.quantidade === totais.get(chave(g))
              ? ""
              : "<strong>" +
                g.quantidade +
                (g.quantidade === 1 ? " lanche" : " lanches") +
                "</strong>",
        )
        .join("") +
      acompanhamentos
        .map(
          (c) =>
            "<p><strong>" +
            multiplicador * c.quantidade +
            " " +
            escaparOperacao(c.nome) +
            "</strong></p>",
        )
        .join("") +
      '<p class="producao-obs">Obs. geral: ' +
      escaparOperacao(obs) +
      "</p></div>";
    const id = chave(primeiro);
    recados.set(id, (recados.get(id) || "") + html);
    // Mantém o total dos lanches agrupado; o preparo deste grupo aparece no bloco acima.
    return { ...limpo, adicionais: [], lanchesCombo: [], lanchesPersonalizados: [] };
  });
  return agruparPreparoChapeiroOperacao(preparo)
    .map(
      (grupo) =>
        '<article class="producao-item preparo-agrupado"><strong>' +
        grupo.quantidade +
        " " +
        escaparOperacao(grupo.nome) +
        "</strong>" +
        (grupo.tipo ? "<p>Tipo: " + escaparOperacao(grupo.tipo) + "</p>" : "") +
        detalhes(grupo) +
        (recados.get(chave(grupo)) || "") +
        "</article>",
    )
    .join("");
}
function bebidasOperacao(itens) {
  const bebidas = [];
  for (const item of itens || []) {
    const qtd = Number(item.quantidade ?? item.qtd ?? 1);
    if (/bebida/i.test(item.categoria || "")) bebidas.push(item);
    const explicitas = item.bebidas || item.combo?.bebidas || [];
    const singular = item.bebida || item.bebidaCombo;
    const lista = explicitas.length
      ? explicitas
      : singular
        ? [singular]
        : componentesComboOperacao(item).filter((c) => c.categoria === "bebidas");
    for (const bebida of Array.isArray(lista) ? lista : [])
      bebidas.push(
        typeof bebida === "string"
          ? { nome: bebida, quantidade: qtd }
          : { ...bebida, quantidade: Number(bebida.quantidade || bebida.qtd || 1) * qtd },
      );
  }
  return agruparItensOperacao(bebidas);
}
function textoPagamentoOperacao(dados) {
  if (dados.pagamentos?.length)
    return dados.pagamentos
      .flatMap((p) => p.formas || (p.forma ? [p] : []))
      .map((p) => `${p.forma}: ${moedaOperacao(p.valor)}`)
      .join(", ");
  return dados.pagamento || dados.formaPagamento || "Não informado";
}
async function completarItensOperacao(itens) {
  if (
    !(itens || []).some(
      (i) =>
        /combo/i.test(i.categoria || i.nome || "") &&
        !i.descricao &&
        !i.desc &&
        !i.comboComponentes?.length,
    )
  )
    return itens || [];
  const snap = await db.collection("produtos").get();
  const produtos = snap.docs.map((d) => ({ ...d.data(), id: d.id }));
  return (itens || []).map((item) => {
    const produto = produtos.find(
      (p) =>
        p.id === item.produtoId ||
        String(p.nome).trim().toLowerCase() === String(item.nome).trim().toLowerCase(),
    );
    if (!produto) return item;
    return {
      ...item,
      descricao: item.descricao || item.desc || produto.descricao || produto.desc || "",
      bebida: item.bebida || item.bebidaCombo || produto.bebida || produto.bebidaCombo || "",
      bebidas: item.bebidas?.length ? item.bebidas : produto.bebidas || [],
      comboComponentes: item.comboComponentes?.length
        ? item.comboComponentes
        : produto.comboComponentes || [],
      comboQtdLanches: item.comboQtdLanches || produto.comboQtdLanches || 1,
    };
  });
}
function gerarImpressaoOperacao(tipo, dados) {
  const titulo =
    tipo === "motoboy"
      ? `Entrega ${dados.numeroEntregaDia || dados.numeroDia || ""}`
      : tipo === "cozinha"
        ? rotuloDestinoCozinhaOperacao(dados)
        : dados.mesa
          ? `Mesa ${dados.mesa}`
          : "Conferência do pedido";
  const nome = dados.nome || dados.cliente || dados.clienteNome || "";
  const recebido = Number(
    dados.valorPago ??
      (dados.pagamentoConfirmado || /^pago$/i.test(dados.status || "") ? dados.valorTotal : 0),
  );
  const falta =
    dados.status === "Fechada"
      ? 0
      : Math.max(
          0,
          Number(
            dados.saldoPendente ??
              (dados.mesa
                ? saldoComandaPagamento(dados)
                : Number(dados.valorTotal || 0) - recebido),
          ),
        );
  const totalConferencia = dados.mesa ? recebido + falta : Number(dados.valorTotal || 0);
  let html = `<header><h1>Pedrão Lanches</h1><h2>${escaparOperacao(titulo)}</h2><p>${escaparOperacao(nome)}</p></header>`;
  if (tipo === "motoboy") {
    if (Number(dados.descontoCreditoEntrega) > 0)
      html += `<p>Taxa integral do motoboy: ${moedaOperacao(dados.taxaEntrega)} · parte da loja: ${moedaOperacao(dados.descontoCreditoEntrega)}</p>`;
    html += `<h3>Entrega</h3><p>Telefone: ${escaparOperacao(dados.telefone || dados.telefoneCliente || "")}</p><p>Endereço: ${escaparOperacao(dados.endereco || dados.enderecoEscrito || "Não informado")}</p><p>Condomínio: ${escaparOperacao(dados.condominio || "Não informado")}</p>`;
    if (dados.condominio === "Sim" || dados.condominio === true)
      html += `<p>CNH: ${escaparOperacao(dados.cnh || "Não informado")}</p>`;
    html += `<p>Total: <strong>${moedaOperacao(dados.valorTotal)}</strong></p><p>Pagamento: ${escaparOperacao(textoPagamentoOperacao(dados))}</p><h3>Bebidas, incluindo combos</h3>${itensHtmlOperacao(bebidasOperacao(dados.itens)) || "<p>Nenhuma bebida.</p>"}`;
  } else {
    html += `<h3>${tipo === "cozinha" ? "Chapeiro" : "Conferência geral"}</h3>${tipo === "cozinha" ? itensHtmlChapeiroOperacao(dados.itens || []) : itensHtmlOperacao(dados.itens || [], tipo === "geral")}`;
    if (tipo !== "cozinha" && dados.observacao)
      html += `<p>Observação: ${escaparOperacao(dados.observacao)}</p>`;
    if (tipo === "geral")
      html += `<hr>${/entrega/i.test(dados.tipo || "") && Number(dados.taxaEntrega) > 0 ? `<p>Taxa de entrega: ${moedaOperacao(dados.taxaEntrega)}</p>` : ""}<p>Descontos: ${moedaOperacao(Number(dados.descontoCupom || 0) + Number(dados.descontoFidelidade || 0) + Number(dados.descontoCreditoEntrega || 0))}</p><h2>Total: ${moedaOperacao(totalConferencia)}</h2><p>Recebido: ${moedaOperacao(recebido)}</p><p>Falta receber: ${moedaOperacao(falta)}</p><p>Pagamento: ${escaparOperacao(textoPagamentoOperacao(dados))}</p><p>Recibo de conferência — não é documento fiscal.</p>`;
  }
  return html;
}
function abrirImpressaoOperacao(html) {
  const janela = window.open("", "_blank", "width=480,height=760");
  if (!janela) {
    avisoOperacao("Permita abrir a janela de impressão neste navegador.");
    return false;
  }
  janela.document.write(
    `<!doctype html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Pedrão — impressão</title><style>body{font:14px Arial;color:#000;max-width:76mm;margin:8px auto}h1{font-size:20px}h2{font-size:18px}header{text-align:center}.producao-item{border-bottom:1px dashed #888;padding:10px 0}.producao-item span{float:right}p{margin:5px 0;overflow-wrap:anywhere}.producao-combo{padding-left:12px}article,section,div,strong{min-width:0;max-width:100%;box-sizing:border-box;overflow-wrap:anywhere}button{padding:12px}@page{margin:4mm}@media screen{body{box-sizing:border-box;max-width:600px;margin:0 auto;padding:16px;font-size:17px;line-height:1.5}button{display:block;width:100%;margin-bottom:20px;font-size:16px}h1{font-size:24px}h2{font-size:22px}}@media print{body{max-width:76mm;padding:0;margin:8px auto;font-size:14px}button{display:none}}</style></head><body><button onclick="window.print()">Imprimir / salvar PDF</button>${html}</body></html>`,
  );
  janela.document.close();
  janela.focus();
  return true;
}
async function imprimirRegistroOperacao(colecao, id, tipo) {
  try {
    const doc = await db.collection(colecao).doc(id).get();
    if (!doc.exists) {
      avisoOperacao("Registro não encontrado.");
      return false;
    }
    const dados = doc.data();
    if (colecao === "pedidos" && tipo === "motoboy")
      dados.numeroEntregaDia = await numeroMotoboyOperacao(dados, id);
    dados.itens = await completarItensOperacao(dados.itens);
    if (tipo === "cozinha") {
      if (!itensChapeiroOperacao(dados.itens).length) {
        avisoOperacao("Este pedido não tem itens para preparar na chapa.");
        return false;
      }
      dados.itens = await buscarItensPendentesPreparoOperacao(colecao, id, dados.itens, dados);
      if (!itensChapeiroOperacao(dados.itens).length) {
        if (
          !(await confirmarOperacao(
            "O chapeiro já fez todos os itens deste pedido. Deseja reenviar tudo para ele?",
          ))
        )
          return false;
        if (!(await confirmarProducaoOperacao(colecao, id, false, true))) return false;
        dados.itens = await completarItensOperacao(doc.data().itens);
      }
    }
    if (tipo === "motoboy" && !/entrega/i.test(dados.tipo || "")) {
      avisoOperacao(
        "Este pedido é para consumo no local ou retirada. Use a impressão da cozinha ou geral.",
      );
      return false;
    }
    return abrirImpressaoOperacao(gerarImpressaoOperacao(tipo, dados));
  } catch (e) {
    avisoOperacao("Não foi possível carregar a impressão: " + e.message);
    return false;
  }
}
async function imprimirMesaOperacao(numero, tipo = "cozinha") {
  const snap = await db
    .collection("comandas")
    .where("mesa", "==", numero)
    .where("status", "==", "Aberta")
    .get();
  if (snap.empty) {
    avisoOperacao("Esta mesa não tem comandas abertas.");
    return false;
  }
  const comandas = await Promise.all(
    snap.docs.map(async (d) => {
      const comanda = d.data();
      if (tipo !== "cozinha") return comanda;
      const itens = await completarItensOperacao(comanda.itens || []);
      return {
        ...comanda,
        itens: await buscarItensPendentesPreparoOperacao("comandas", d.id, itens, comanda),
      };
    }),
  );
  if (tipo === "cozinha" && !itensChapeiroOperacao(comandas.flatMap((c) => c.itens)).length) {
    avisoOperacao("Nenhum item pendente para o chapeiro nesta mesa.");
    return false;
  }
  return abrirImpressaoOperacao(
    gerarImpressaoOperacao(tipo, {
      mesa: numero,
      cliente: comandas.map((c) => c.cliente || c.nome || "").join(", "),
      itens: await completarItensOperacao(comandas.flatMap((c) => c.itens || [])),
      valorTotal: comandas.reduce((n, c) => n + Number(c.valorTotal || 0), 0),
      valorPago: comandas.reduce((n, c) => n + Number(c.valorPago || 0), 0),
      saldoPendente: comandas.reduce((n, c) => n + saldoComandaPagamento(c), 0),
      pagamentos: comandas.flatMap((c) => c.pagamentos || []),
    }),
  );
}

let tipoCentralOperacao = null;
let modoCancelamentoCentralUI = false;
let idCentralOperacao = null;
let registrosOperacao = [];
let filaOperacao = [];
let ouvintesOperacao = [];
function diaOperacionalPedidoOperacao(agora = Date.now()) {
  return new Date(janelaOperacionalOperacao(agora).inicio).toISOString().slice(0, 10);
}
function aplicarNumerosDiariosOperacao(pedidos) {
  const porDia = new Map();
  for (const p of [...pedidos].sort(
    (a, b) =>
      tempoRegistroOperacao(a) - tempoRegistroOperacao(b) ||
      String(a.id || "").localeCompare(String(b.id || "")),
  )) {
    const dia = p.diaOperacional || diaOperacionalPedidoOperacao(tempoRegistroOperacao(p));
    const proximo = (porDia.get(dia) || 0) + 1;
    p.numeroDia = Number(p.numeroDia) || proximo;
    p.diaOperacional = dia;
    p.numero = p.numeroDia;
    porDia.set(dia, Math.max(proximo, p.numeroDia));
  }
  return pedidos;
}
async function prepararContadorPedidoOperacao(banco, tipo = "todos") {
  const dia = diaOperacionalPedidoOperacao(),
    ref = banco
      .collection("config")
      .doc((tipo === "Entrega" ? "contadorEntregas_" : "contadorPedidos_") + dia);
  const atual = await ref.get();
  if (atual.exists) return ref;
  const pedidos = await banco.collection("pedidos").get();
  const hoje = aplicarNumerosDiariosOperacao(pedidos.docs.map((d) => ({ ...d.data(), id: d.id })))
    .filter(
      (p) => p.diaOperacional === dia && (tipo !== "Entrega" || /entrega/i.test(p.tipo || "")),
    )
    .sort((a, b) => tempoRegistroOperacao(a) - tempoRegistroOperacao(b));
  const ultimo = hoje.reduce(
    (n, p, i) =>
      Math.max(n, tipo === "Entrega" ? Number(p.numeroEntregaDia || i + 1) : p.numeroDia),
    0,
  );
  await banco.runTransaction(async (t) => {
    if (!(await t.get(ref)).exists) t.set(ref, { ultimoNumero: ultimo, diaOperacional: dia });
  });
  return ref;
}
async function reservarNumeroEntregaOperacao(banco) {
  const ref = await prepararContadorPedidoOperacao(banco, "Entrega");
  return banco.runTransaction(async (t) => {
    const d = await t.get(ref),
      numero = Number(d.data()?.ultimoNumero || 0) + 1;
    t.set(ref, { ultimoNumero: numero });
    return numero;
  });
}
async function numeroMotoboyOperacao(dados, id) {
  if (dados.numeroEntregaDia) return dados.numeroEntregaDia;
  const snap = await db.collection("pedidos").get(),
    dia = dados.diaOperacional || diaOperacionalPedidoOperacao(tempoRegistroOperacao(dados));
  const entregas = snap.docs
    .map((d) => ({ ...d.data(), id: d.id }))
    .filter(
      (p) =>
        /entrega/i.test(p.tipo || "") &&
        (p.diaOperacional || diaOperacionalPedidoOperacao(tempoRegistroOperacao(p))) === dia,
    )
    .sort(
      (a, b) => tempoRegistroOperacao(a) - tempoRegistroOperacao(b) || a.id.localeCompare(b.id),
    );
  const posicao = entregas.findIndex((p) => p.id === id);
  return posicao >= 0 ? posicao + 1 : "";
}
function rotuloDestinoCozinhaOperacao(dados) {
  return dados.mesa
    ? `Mesa ${dados.mesa}`
    : /entrega/i.test(dados.tipo || "")
      ? "Entrega"
      : /retirada/i.test(dados.tipo || "")
        ? "Retirada"
        : /local|consumo/i.test(dados.tipo || "")
          ? "Consumir no local"
          : "Pedido · conferir modalidade";
}
async function numeroInternoPedidoOperacao(dados, id) {
  if (dados.numeroDia) return dados.numeroDia;
  const snap = await db.collection("pedidos").get();
  const pedidos = aplicarNumerosDiariosOperacao(snap.docs.map((d) => ({ ...d.data(), id: d.id })));
  return pedidos.find((p) => p.id === id)?.numeroDia || "";
}
async function abrirCentralOperacao(tipo = null, registroId = null) {
  if (registroId && !tipo) tipo = tipoCentralOperacao;
  tipoCentralOperacao = tipo;
  idCentralOperacao = registroId;
  modoCancelamentoCentralUI = false;
  let box = document.getElementById("central-operacao");
  if (!box) {
    box = document.createElement("section");
    box.id = "central-operacao";
    box.className = "central-operacao";
    const destino = document.querySelector("main");
    if (destino) destino.prepend(box);
    else if (document.querySelector(".menu-atendente"))
      document.querySelector(".menu-atendente").after(box);
    else document.body.append(box);
  }
  box.hidden = false;
  box.style.display = "block";
  observarCorteProducaoOperacao();
  box.classList.add("central-etapa-modal");
  box.classList.remove("cancelando-pedidos-ui");
  box.innerHTML = `<div class="ui-navegacao"><button class="ui-voltar" onclick="${tipo || registroId ? "abrirCentralOperacao()" : "fecharCentralProducaoUI()"}">← Voltar</button><button class="ui-x" aria-label="Fechar produção" onclick="fecharCentralProducaoUI()">×</button></div><h2>${tipo ? "Pedidos de " + escaparOperacao(tipo) : "Pedidos e produção"}</h2><p>${tipo ? "Confira os pedidos desta categoria. Abra um pedido para ver os detalhes e as opções de impressão." : "Escolha o tipo de pedido. As ferramentas da cozinha ficam em Chapeiro."}</p><div class="operacao-acoes central-ferramentas-pedidos-ui">${tipo || registroId ? `<button type="button" onclick="carregarCentralOperacao()">Atualizar pedidos</button>${!registroId ? '<button type="button" id="cancelar-pedidos-central-ui" aria-pressed="false" onclick="alternarCancelamentoPedidosCentralUI()">Cancelar pedidos</button>' : ""}` : '<button type="button" onclick="abrirControlesChapeiroOperacao()">Chapeiro</button>'}</div><div class="operacao-imprimir-mesa-ui"><label>Imprimir comandas abertas da mesa <input id="mesa-imprimir-operacao" type="number" min="1" inputmode="numeric"></label><button type="button" onclick="imprimirMesaOperacao(Number(document.getElementById('mesa-imprimir-operacao').value))">Imprimir mesa para chapeiro</button></div><div id="registros-operacao">${htmlCarregandoUI("Carregando pedidos…")}</div>`;
  const categorias = document.createElement("div");
  categorias.className = "operacao-acoes";
  categorias.setAttribute("aria-label", "Tipo de pedido");
  categorias.hidden = !!tipo || !!registroId;
  for (const [valor, nome] of [
    ["Entrega", "Delivery"],
    ["Retirada", "Retirada"],
    ["Mesas", "Mesas"],
  ]) {
    const b = document.createElement("button");
    b.textContent = nome;
    b.setAttribute("aria-pressed", String(tipo === valor));
    b.onclick = () => abrirCentralOperacao(valor);
    categorias.append(b);
  }
  box.querySelector(".operacao-acoes").after(categorias);
  if (document.querySelector(".menu-atendente"))
    box.querySelector('a[href="cozinha.html"]')?.remove();
  if (document.querySelector(".menu-atendente") || tipo || registroId)
    box.querySelector('[onclick*="hidden=true"]')?.remove();
  if (tipo !== "Mesas" || registroId) {
    box.querySelector(".operacao-imprimir-mesa-ui")?.remove();
  }
  if (!tipo && !registroId) {
    document.getElementById("registros-operacao").textContent =
      "Escolha Delivery, Retirada ou Mesas para consultar os pedidos.";
    return;
  }
  await carregarCentralOperacao();
}
function atualizarModoCancelamentoPedidosCentralUI() {
  document
    .getElementById("central-operacao")
    ?.classList?.toggle("cancelando-pedidos-ui", modoCancelamentoCentralUI);
  const botao = document.getElementById("cancelar-pedidos-central-ui");
  if (botao) {
    botao.textContent = modoCancelamentoCentralUI ? "Concluir cancelamento" : "Cancelar pedidos";
    botao.setAttribute?.("aria-pressed", String(modoCancelamentoCentralUI));
  }
  document
    .querySelectorAll("#central-operacao [data-cancelar-pedido-ui]")
    .forEach((b) => (b.hidden = !modoCancelamentoCentralUI));
}
function alternarCancelamentoPedidosCentralUI() {
  modoCancelamentoCentralUI = !modoCancelamentoCentralUI;
  atualizarModoCancelamentoPedidosCentralUI();
}
function fecharCentralProducaoUI() {
  modoCancelamentoCentralUI = false;
  const box = document.getElementById("central-operacao");
  box.hidden = true;
  box.style.display = "none";
  if (document.querySelector(".menu-atendente")) fecharFluxoAtendenteUI();
}
function abrirControlesChapeiroOperacao() {
  const box = janelaProducaoOperacao("controles-chapeiro", "Chapeiro");
  box.innerHTML =
    '<p>Gerencie os pedidos que aparecem na chapa. A limpeza preserva os pedidos e pagamentos no histórico.</p><div class="operacao-acoes"><a class="botao-padrao" href="cozinha.html" target="_blank" rel="noopener">Abrir tela</a><button onclick="abrirFilaChapeiroOperacao()">Fila do chapeiro</button><button onclick="abrirFilaChapeiroOperacao()">Atualizar fila</button><button onclick="limparTelasProducaoOperacao()">Limpar telas</button></div>';
}
let viradaCentralOperacao;
async function carregarCentralOperacao() {
  clearTimeout(viradaCentralOperacao);
  if (!tipoCentralOperacao && !idCentralOperacao) return;
  const registrosTela = document.getElementById("registros-operacao");
  if (registrosTela) registrosTela.innerHTML = htmlCarregandoUI("Carregando pedidos do dia…");
  const tipoSolicitado = tipoCentralOperacao,
    idSolicitado = idCentralOperacao;
  viradaCentralOperacao = setTimeout(
    () => {
      const box = document.getElementById("central-operacao");
      if (box && !box.hidden) carregarCentralOperacao();
    },
    Math.max(1000, janelaOperacionalOperacao().fim - Date.now() + 100),
  );
  try {
    const snaps = await Promise.all(
      ["pedidos", "comandas"].map(async (colecao) => {
        if (idSolicitado) {
          const doc = await db.collection(colecao).doc(idSolicitado).get();
          return { docs: doc.exists ? [doc] : [] };
        }
        return colecao === "pedidos"
          ? db.collection(colecao).where("dataMs", ">=", janelaOperacionalOperacao().inicio).get()
          : db.collection(colecao).where("status", "==", "Aberta").get();
      }),
    );
    if (tipoSolicitado !== tipoCentralOperacao || idSolicitado !== idCentralOperacao) return;
    registrosOperacao = snaps.flatMap((snap, i) =>
      snap.docs.map((d) => ({ ...d.data(), id: d.id, colecao: i ? "comandas" : "pedidos" })),
    );
    aplicarNumerosDiariosOperacao(registrosOperacao.filter((r) => r.colecao === "pedidos"));
    // Pedidos locais vinculados são exibidos pela comanda para não duplicar preparo.
    const vinculados = new Set(
      registrosOperacao
        .filter((r) => r.colecao === "comandas")
        .map((r) => r.pedidoOrigemId)
        .filter(Boolean),
    );
    const janela = janelaOperacionalOperacao();
    const lista = registrosOperacao.filter(
      (r) =>
        (!idCentralOperacao || r.id === idCentralOperacao) &&
        (!tipoCentralOperacao ||
          (tipoCentralOperacao === "Mesas"
            ? r.colecao === "comandas" || !!r.mesa || /local/i.test(r.tipo || "")
            : String(r.tipo).toLowerCase() === tipoCentralOperacao.toLowerCase())) &&
        !r.cancelado &&
        !/cancelad/i.test(r.status || "") &&
        (r.colecao === "comandas"
          ? r.status === "Aberta" &&
            (idCentralOperacao || tempoRegistroOperacao(r) >= janelaOperacionalOperacao().inicio)
          : !r.vinculadoComanda &&
            !vinculados.has(r.id) &&
            (idCentralOperacao ||
              (tempoRegistroOperacao(r) >= janelaOperacionalOperacao().inicio &&
                tempoRegistroOperacao(r) < janela.fim))),
    );
    const grupo = (r) =>
      r.mesa || r.colecao === "comandas"
        ? "Mesas"
        : /entrega/i.test(r.tipo || "")
          ? "Delivery · Entregas"
          : /local/i.test(r.tipo || "")
            ? "Consumo no local · aguardando mesa"
            : "Retiradas";
    lista.sort(
      (a, b) =>
        grupo(a).localeCompare(grupo(b)) || tempoRegistroOperacao(a) - tempoRegistroOperacao(b),
    );
    document.getElementById("registros-operacao").innerHTML =
      lista
        .map((r) => {
          const titulo = r.mesa
            ? `Mesa ${r.mesa}`
            : /entrega/i.test(r.tipo || "")
              ? "Entrega"
              : /local/i.test(r.tipo || "")
                ? "Consumo no local"
                : "Retirada";
          const args = `'${r.colecao}','${escaparOperacao(r.id)}'`;
          const recebido =
            r.colecao === "pedidos"
              ? saldoPedidoOperacao(r) === 0 &&
                (valorRecebidoPedidoOperacao(r) > 0 || Number(r.valorTotal) === 0)
              : r.pagamentoConfirmado === true || /^pago$/i.test(r.status || "");
          const localSemMesa =
            r.colecao === "pedidos" && /local/i.test(r.tipo || "") && !r.vinculadoComanda;
          const acoes = localSemMesa
            ? typeof abrirSelecaoMesaLocalSiteUI === "function"
              ? `<button type="button" onclick="abrirSelecaoMesaLocalSiteUI('${escaparOperacao(r.id)}')">Vincular a uma mesa</button>`
              : "<p>Vincule este pedido a uma mesa no painel do atendente antes de liberar a produção.</p>"
            : acoesRegistroUI(r.colecao, r.id, /entrega/i.test(r.tipo || ""));
          const status = recebido
            ? r.retirado
              ? "Retirado e pago"
              : "Pagamento recebido"
            : valorRecebidoPedidoOperacao(r) > 0
              ? `Falta receber ${moedaOperacao(saldoPedidoOperacao(r))}`
              : "Pagamento ainda não confirmado";
          return `<article class="registro-operacao">${!idCentralOperacao && r.colecao === "pedidos" && !r.mesa && !r.comandaId && !r.vinculadoComanda ? `<button class="cancelar-pedido-x-ui" type="button" data-cancelar-pedido-ui hidden aria-label="Cancelar pedido de ${escaparOperacao(r.nome || r.cliente || "cliente")}" onclick="cancelarPedidoPerfilUI('${escaparOperacao(r.id)}')">×</button>` : ""}<h3>${escaparOperacao(titulo)} — ${escaparOperacao(r.nome || r.cliente || "")}</h3><div class="pedido-lista-valor-ui"><p>${escaparOperacao(r.tipo || "Consumo no local")} · ${moedaOperacao(r.valorTotal)}</p>${!idCentralOperacao && r.colecao === "pedidos" && /^(Entrega|Retirada)$/i.test(r.tipo || "") && typeof abrirEditorPedidoUI === "function" ? `<button type="button" onclick="editarPedidoOperacao('${escaparOperacao(r.id)}')">Editar</button>` : ""}</div>${Number(r.descontoCreditoEntrega) > 0 ? `<p class="beneficio-pedido-ui">Benefícios: ${moedaOperacao(r.descontoCreditoEntrega)} no frete · taxa integral do motoboy: ${moedaOperacao(r.taxaEntrega)}</p>` : ""}${avisoDistanciaEntregaOperacao(r)}<p class="recebimento-status ${recebido ? "recebido" : ""}">${status}${r.pagamento ? " · " + escaparOperacao(r.pagamento) : ""}</p>${Number(r.valorADevolver || 0) > 0 ? `<p class="recebimento-status">Valor a devolver: ${moedaOperacao(r.valorADevolver)}</p>` : ""}${!idCentralOperacao ? acoesResumoPedidoOperacao(r, recebido) : `${itensHtmlOperacao(r.itens || [])}${r.observacao ? `<section class="molhos-atendente"><h4>Observação do pedido</h4><p>${escaparOperacao(r.observacao).replaceAll("\n", "<br>")}</p></section>` : ""}${acoes}<div class="registro-acoes-secundarias-ui"><button onclick="solicitarDocumentoClienteOperacao(${args})">Dados para nota fiscal</button></div>`}</article>`;
        })
        .join("") || "<p>Nenhum pedido pendente neste período.</p>";
    if (idCentralOperacao && lista.length) {
      const card = document.querySelector("#registros-operacao>.registro-operacao");
      card
        .querySelector(".ui-acoes-pedido")
        ?.insertAdjacentHTML("beforebegin", molhosAtendenteOperacao(lista[0].itens || []));
    }
    atualizarModoCancelamentoPedidosCentralUI();
    let anterior = "";
    document.querySelectorAll("#registros-operacao>.registro-operacao").forEach((card, i) => {
      const nome = grupo(lista[i]);
      if (!tipoCentralOperacao && nome !== anterior) {
        const h = document.createElement("h2");
        h.textContent = nome;
        card.before(h);
      }
      anterior = nome;
    });
  } catch (e) {
    document.getElementById("registros-operacao").textContent =
      "Não foi possível carregar os pedidos: " + e.message;
  }
}
function acoesResumoPedidoOperacao(r, recebido) {
  const id = escaparOperacao(r.id),
    externo = r.colecao === "pedidos" && /^(Entrega|Retirada)$/i.test(r.tipo || "");
  const retirada = r.tipo === "Retirada";
  return `<div class="pedido-lista-acoes-ui"><button type="button" onclick="abrirCentralOperacao('${escaparOperacao(r.tipo || "")}','${id}')">Abrir pedido</button>${externo && (!recebido || (retirada && !r.retirado)) ? `<button type="button" onclick="confirmarRecebimentoOperacao('${id}',${retirada})">${retirada ? (recebido ? "Confirmar retirada" : "Confirmar pagamento") : "Confirmar recebimento"}</button>` : ""}</div>`;
}
function distanciaEntregaOperacao(pedido) {
  const salva = Number(pedido.distanciaKm ?? pedido.km);
  if (Number.isFinite(salva) && salva > 0) return salva;
  // Pedidos antigos guardavam apenas o link do GPS. Usa o mesmo ponto e cálculo do delivery.
  const ponto = String(pedido.localizacao || pedido.mapa || "").match(
    /[?&]q=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,
  );
  if (!ponto) return null;
  const rad = (n) => (n * Math.PI) / 180,
    lat = Number(ponto[1]),
    lon = Number(ponto[2]);
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  const origem = [-15.553076945525193, -56.05602240360688];
  const a =
    Math.sin(rad(lat - origem[0]) / 2) ** 2 +
    Math.cos(rad(origem[0])) * Math.cos(rad(lat)) * Math.sin(rad(lon - origem[1]) / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
function avisoDistanciaEntregaOperacao(pedido) {
  if (!/^entrega$/i.test(pedido.tipo || "")) return "";
  const km = distanciaEntregaOperacao(pedido);
  if (!(km > 10)) return "";
  const distancia = km.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
  return `<p class="pedido-distancia-aviso-ui">${km > 15 ? `Fora da nossa área de entrega (${distancia} km). Consulte um motoboy antes de confirmar. Pode haver demora.` : `Percurso longo (${distancia} km). Pode haver demora na entrega.`}</p>`;
}
function editarPedidoOperacao(id) {
  return abrirEditorPedidoUI(id, {
    modo: document.querySelector(".menu-atendente") ? "atendente" : "admin",
    aoSalvar: carregarCentralOperacao,
  });
}
function molhosAtendenteOperacao(itens, mostrarNome = true) {
  return itens
    .map((item) => {
      const gratis = item.molhosGratis || [],
        pagos = item.molhosPagos || [];
      if (!gratis.length && !pagos.length) return "";
      const linhasGratis = gratis
        .map(
          (m) =>
            `<li>Unidade ${escaparOperacao(m.unidade || 1)}: ${escaparOperacao(m.texto || (m.tipo === "semmolho" ? "Sem molho" : m.molhos?.join(" + ") || m.molho || "Não informado"))}</li>`,
        )
        .join("");
      const linhasPagos = pagos
        .filter((m) => Number(m.qtd || m.quantidade || 0) > 0)
        .map(
          (m) =>
            `<li>${escaparOperacao(m.qtd || m.quantidade)} ${escaparOperacao(m.nome)}${m.preco != null ? " · " + moedaOperacao(Number(m.preco) * Number(m.qtd || m.quantidade)) : ""}</li>`,
        )
        .join("");
      return `<section class="molhos-atendente">${mostrarNome ? `<h4>Molhos · ${escaparOperacao(item.nome)}</h4>` : ""}${linhasGratis ? `${mostrarNome ? "<p>Grátis</p>" : "<h4>Molhos grátis</h4>"}<ul>${linhasGratis}</ul>` : ""}${linhasPagos ? `${mostrarNome ? "<p>Pagos</p>" : "<h4>Molhos pagos</h4>"}<ul>${linhasPagos}</ul>` : ""}</section>`;
    })
    .join("");
}
function recebimentosPedidoOperacao(pedido) {
  if (Array.isArray(pedido.recebimentosPedido)) return pedido.recebimentosPedido;
  const confirmado = pedido.pagamentoConfirmado === true || /^pago$/i.test(pedido.status || "");
  const valor =
    Number(pedido.valorRecebido ?? pedido.valorPago ?? (confirmado ? pedido.valorTotal : 0)) || 0;
  if (valor <= 0) return [];
  return [
    {
      id: "legado",
      valor,
      pagoEm:
        pedido.pagamentoConfirmadoEm ||
        pedido.pagoEm ||
        pedido.dataMs ||
        tempoRegistroOperacao(pedido),
      forma: pedido.pagamento || pedido.formaPagamento || "Não informado",
      formas: pedido.formas || [
        { forma: pedido.pagamento || pedido.formaPagamento || "Não informado", valor },
      ],
      taxaEntrega: /entrega/i.test(pedido.tipo || "") ? Number(pedido.taxaEntrega || 0) : 0,
      descontoCupom: Number(pedido.descontoCupom || 0),
      descontoFidelidade: Number(pedido.descontoFidelidade || 0),
      itens: pedido.itens || [],
      itensPedido: pedido.itens || [],
    },
  ];
}
function valorRecebidoPedidoOperacao(pedido) {
  return (
    recebimentosPedidoOperacao(pedido).reduce((n, r) => n + centavosOperacao(r.valor), 0) / 100
  );
}
function saldoPedidoOperacao(pedido) {
  return (
    Math.max(
      0,
      centavosOperacao(pedido.valorTotal) - centavosOperacao(valorRecebidoPedidoOperacao(pedido)),
    ) / 100
  );
}
function diferencaItensRecebimentoOperacao(itens, anteriores) {
  const chave = (i) =>
    serializarOperacao({
      produtoId: i.produtoId || i.id || "",
      nome: i.nome,
      tipo: i.tipoCarne || i.tipo || "",
    });
  const total = (i) =>
    centavosOperacao(
      i.subtotal ?? Number(i.precoUnitario ?? i.preco ?? 0) * Number(i.quantidade ?? i.qtd ?? 1),
    );
  const valores = new Map();
  const valoresMolhos = new Map();
  for (const item of anteriores)
    valores.set(chave(item), (valores.get(chave(item)) || 0) + total(item));
  for (const item of anteriores)
    valoresMolhos.set(
      chave(item),
      (valoresMolhos.get(chave(item)) || 0) + centavosOperacao(item.totalMolhosPagos),
    );
  return itens
    .map((item) => {
      const k = chave(item),
        atual = total(item),
        antes = valores.get(k) || 0,
        descontado = Math.min(atual, antes);
      valores.set(k, antes - descontado);
      const molho = centavosOperacao(item.totalMolhosPagos),
        antesMolho = valoresMolhos.get(k) || 0;
      valoresMolhos.set(k, Math.max(0, antesMolho - molho));
      return {
        ...item,
        subtotal: (atual - descontado) / 100,
        totalMolhosPagos: Math.max(0, molho - antesMolho) / 100,
      };
    })
    .filter((item) => item.subtotal > 0 || item.totalMolhosPagos > 0);
}
async function registrarRecebimentoPedidoOperacao(id, retirar, conferido) {
  const ref = db.collection("pedidos").doc(id);
  return db.runTransaction(async (t) => {
    const doc = await t.get(ref);
    const p = doc.data();
    if (
      !doc.exists ||
      p.cancelado ||
      p.vinculadoComanda ||
      p.comandaId ||
      p.mesa ||
      /local/i.test(p.tipo || "") ||
      /cancelad/i.test(p.status || "")
    )
      throw Error("Este pedido não está disponível para recebimento. Confira a comanda vinculada.");
    if (retirar && p.tipo !== "Retirada") throw Error("Este pedido não é de retirada.");
    if (p.beneficiosConferirPagamento)
      throw Error("Confira a divisão do pagamento em Editar antes de confirmar o recebimento.");
    if (
      conferido &&
      (centavosOperacao(p.valorTotal) !== centavosOperacao(conferido.valorTotal) ||
        p.pagamento !== conferido.pagamento ||
        serializarOperacao(p.formas) !== serializarOperacao(conferido.formas) ||
        assinaturaItensProducaoOperacao(p.itens) !==
          assinaturaItensProducaoOperacao(conferido.itens))
    )
      throw Error("O pedido mudou durante a confirmação. Confira o novo valor antes de receber.");
    const recebimentos = [...recebimentosPedidoOperacao(p)];
    const saldo = saldoPedidoOperacao(p);
    const agora = Date.now();
    if (saldo > 0) {
      const anterior = recebimentos.at(-1);
      const jaTaxa = recebimentos.reduce((n, r) => n + centavosOperacao(r.taxaEntrega), 0);
      const diferencaDesconto = (campo) =>
        Math.max(
          0,
          centavosOperacao(p[campo]) -
            recebimentos.reduce((n, r) => n + centavosOperacao(r[campo]), 0),
        ) / 100;
      recebimentos.push({
        id: "recebimento-" + agora + "-" + recebimentos.length,
        valor: saldo,
        pagoEm: agora,
        forma: p.pagamento || p.formaPagamento || "Não informado",
        formas:
          p.formas?.length &&
          centavosOperacao(p.formas.reduce((n, f) => n + Number(f.valor || 0), 0)) ===
            centavosOperacao(saldo)
            ? p.formas
            : [{ forma: p.pagamento || p.formaPagamento || "Não informado", valor: saldo }],
        taxaEntrega: /entrega/i.test(p.tipo || "")
          ? Math.min(saldo, Math.max(0, centavosOperacao(p.taxaEntrega) - jaTaxa) / 100)
          : 0,
        descontoCupom: diferencaDesconto("descontoCupom"),
        descontoFidelidade: diferencaDesconto("descontoFidelidade"),
        itens: anterior
          ? diferencaItensRecebimentoOperacao(
              p.itens || [],
              anterior.itensPedido || anterior.itens || [],
            )
          : p.itens || [],
        itensPedido: p.itens || [],
        confirmadoPor: localStorage.getItem("atendenteNome") || "Admin",
      });
    }
    const valorPago = recebimentos.reduce((n, r) => n + centavosOperacao(r.valor), 0) / 100;
    const patch = {
      recebimentosPedido: recebimentos,
      valorPago,
      valorRecebido: valorPago,
      saldoPendente: 0,
      pagamentoConfirmado: true,
      pagamentoConfirmadoEm: recebimentos.at(-1)?.pagoEm || p.pagamentoConfirmadoEm || agora,
      valorADevolver:
        Math.max(0, centavosOperacao(valorPago) - centavosOperacao(p.valorTotal)) / 100,
    };
    if (retirar && !p.retirado)
      Object.assign(patch, {
        retirado: true,
        retiradoEmMs: agora,
        retiradoEm: new Date(agora).toISOString(),
      });
    const salvarRank =
      typeof prepararRankMensalUI === "function"
        ? await prepararRankMensalUI(t, [
            {
              clienteId: p.clienteId,
              chave: "pedidos_" + id,
              eventos: eventosRankPedidoMensalUI({ ...p, ...patch }),
            },
          ])
        : () => {};
    const beneficio =
      typeof prepararBeneficioEntregaUI === "function"
        ? await prepararBeneficioEntregaUI(t, p, "confirmar")
        : { patch: {}, salvar: () => {} };
    const fidelidade =
      typeof prepararFidelidadeCheckoutUI === "function"
        ? await prepararFidelidadeCheckoutUI(t, p, { ...p, ...patch })
        : { patch: {}, salvar: () => {} };
    t.update(ref, { ...patch, ...beneficio.patch, ...fidelidade.patch });
    salvarRank();
    beneficio.salvar();
    fidelidade.salvar();
    return { ...patch, ...beneficio.patch, ...fidelidade.patch };
  });
}
async function confirmarRecebimentoOperacao(id, retirar = false) {
  try {
    const doc = await db.collection("pedidos").doc(id).get();
    if (!doc.exists) throw Error("Pedido não encontrado.");
    const p = doc.data(),
      saldo = saldoPedidoOperacao(p);
    if (p.beneficiosConferirPagamento) {
      avisoOperacao(
        "O benefício alterou o total deste pedido. Abra Editar e confira os valores das formas de pagamento antes de receber.",
      );
      return false;
    }
    retirar = retirar || p.tipo === "Retirada";
    const texto = retirar
      ? `Confirmar retirada do pedido #${p.numero || "-"}? ${saldo > 0 ? "Ao confirmar, você declara que recebeu " + moedaOperacao(saldo) + "." : "O pagamento já está confirmado."}`
      : `Confirmar o recebimento de ${moedaOperacao(saldo)} deste pedido?`;
    if (!(await confirmarOperacao(texto))) return false;
    await registrarRecebimentoPedidoOperacao(id, retirar, p);
    await carregarCentralOperacao();
    return true;
  } catch (e) {
    avisoOperacao("Não foi possível confirmar: " + e.message);
    return false;
  }
}
function tempoRegistroOperacao(r) {
  const valor = r.criadoEmMs || r.dataMs || r.criadoEm || r.data;
  return valor?.toMillis
    ? valor.toMillis()
    : typeof valor === "number"
      ? valor
      : new Date(valor || 0).getTime();
}
function janelaOperacionalOperacao(agora = Date.now()) {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Cuiaba",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(agora - 2 * 3600000));
  const get = (k) => p.find((x) => x.type === k).value;
  const inicio = Date.parse(`${get("year")}-${get("month")}-${get("day")}T02:00:00-04:00`);
  return { inicio, fim: inicio + 86400000 };
}
let corteManualProducaoOperacao = 0,
  pararConfigProducaoOperacao = null;
let viradaFilaCozinhaOperacao = null,
  inicioAssinaturaCozinhaOperacao = null;
let registrosDiaCozinhaOperacao = [],
  modoRemoverCozinhaOperacao = false;
function inicioProducaoOperacao(agora = Date.now()) {
  return Math.max(
    janelaOperacionalOperacao(agora).inicio,
    corteManualProducaoOperacao ? corteManualProducaoOperacao + 1 : 0,
  );
}
function aplicarCorteProducaoOperacao(valor) {
  const novo = Number(valor || 0);
  if (novo === corteManualProducaoOperacao) return;
  corteManualProducaoOperacao = novo;
  if (pararFilaCozinhaOperacao) assinarFilaDiaCozinhaOperacao();
  const central = document.getElementById("central-operacao");
  if (central && !central.hidden) carregarCentralOperacao();
}
function observarCorteProducaoOperacao() {
  if (pararConfigProducaoOperacao) return;
  pararConfigProducaoOperacao = db
    .collection("config")
    .doc("producaoTela")
    .onSnapshot(
      (doc) => aplicarCorteProducaoOperacao(doc.exists ? doc.data().limpaAntes : 0),
      (erro) => console.error("Não foi possível sincronizar a limpeza da produção.", erro),
    );
}
async function limparTelasProducaoOperacao() {
  if (
    !(await confirmarOperacao(
      "Limpar apenas as telas do chapeiro? Os pedidos continuam disponíveis para o atendente até a virada do período.",
    ))
  )
    return;
  try {
    const ref = db.collection("config").doc("producaoTela");
    const corte = await db.runTransaction(async (t) => {
      const doc = await t.get(ref);
      const tempo = Math.max(Date.now(), Number(doc.data()?.limpaAntes || 0) + 1);
      t.set(
        ref,
        { limpaAntes: tempo, limpoPor: localStorage.getItem("atendenteNome") || "Admin" },
        { merge: true },
      );
      return tempo;
    });
    aplicarCorteProducaoOperacao(corte);
  } catch (e) {
    avisoOperacao("Não foi possível limpar as telas: " + e.message);
  }
}
function janelaProducaoOperacao(id, titulo, aoFechar) {
  const antiga = document.getElementById(id);
  if (antiga) return antiga;
  const dialog = document.createElement("dialog");
  dialog.className = "ui-caixa suporte-admin-tela producao-janela";
  dialog.innerHTML =
    '<header class="suporte-admin-cabecalho"><button class="suporte-voltar" type="button">← Voltar</button><h3>' +
    escaparOperacao(titulo) +
    '</h3><button class="ui-x" type="button" aria-label="Fechar">×</button></header><div class="suporte-admin-conteudo" id="' +
    id +
    '"></div>';
  dialog.querySelectorAll("header button").forEach((b) => (b.onclick = () => dialog.close()));
  dialog.addEventListener(
    "close",
    () => {
      aoFechar?.();
      dialog.remove();
    },
    { once: true },
  );
  document.body.append(dialog);
  dialog.showModal();
  return dialog.querySelector(".suporte-admin-conteudo");
}
async function abrirFilaChapeiroOperacao() {
  janelaProducaoOperacao("gestao-fila-cozinha", "Fila do chapeiro", pararCozinhaOperacao);
  observarCorteProducaoOperacao();
  if (!pararFilaCozinhaOperacao) assinarFilaDiaCozinhaOperacao();
}
async function abrirConcluidosCozinhaOperacao() {
  janelaProducaoOperacao("concluidos-cozinha", "Pedidos concluídos");
  atualizarConcluidosCozinhaOperacao();
}
function alternarRemocaoCozinhaOperacao() {
  modoRemoverCozinhaOperacao = !modoRemoverCozinhaOperacao;
  renderizarFilaCozinhaOperacao();
}
async function retirarDaFilaCozinhaOperacao(id) {
  if (
    !(await confirmarOperacao(
      "Retirar este pedido da tela do chapeiro? O pedido e o pagamento permanecem registrados.",
    ))
  )
    return;
  try {
    const ref = db.collection("filaCozinha").doc(id);
    await db.runTransaction(async (t) => {
      const doc = await t.get(ref);
      if (!doc.exists || doc.data().status !== "aguardando")
        throw Error("Este pedido já saiu da fila.");
      t.update(ref, { status: "retirado", retiradoEm: Date.now() });
    });
    modoRemoverCozinhaOperacao = false;
    renderizarFilaCozinhaOperacao();
  } catch (e) {
    avisoOperacao(e.message);
  }
}
function assinarFilaDiaCozinhaOperacao() {
  pararFilaCozinhaOperacao?.();
  pararFilaCozinhaOperacao = null;
  clearTimeout(viradaFilaCozinhaOperacao);
  for (const origem of origensCozinhaOperacao.values()) origem.parar();
  origensCozinhaOperacao.clear();
  filaOperacao = [];
  registrosDiaCozinhaOperacao = [];
  modoRemoverCozinhaOperacao = false;
  const inicio = inicioProducaoOperacao();
  inicioAssinaturaCozinhaOperacao = inicio;
  filaCozinhaCarregandoOperacao = true;
  renderizarFilaCozinhaOperacao();
  atualizarConcluidosCozinhaOperacao();
  // Um único índice de data: lê apenas o dia atual, sem índice composto ou varredura histórica.
  pararFilaCozinhaOperacao = db
    .collection("filaCozinha")
    .where("criadoEmMs", ">=", inicio)
    .onSnapshot(
      (snap) => {
        if (inicio !== inicioAssinaturaCozinhaOperacao) return;
        filaCozinhaCarregandoOperacao = false;
        registrosDiaCozinhaOperacao = snap.docs
          .map((d) => ({ ...d.data(), id: d.id }))
          .filter(
            (r) =>
              Number(r.criadoEmMs) >= inicio &&
              Number(r.criadoEmMs) < janelaOperacionalOperacao().fim,
          );
        filaOperacao = registrosDiaCozinhaOperacao.filter((r) => r.status === "aguardando");
        if (typeof processarSomFilaCozinhaUI === "function")
          processarSomFilaCozinhaUI(registrosDiaCozinhaOperacao, inicio);
        sincronizarOrigensCozinhaOperacao();
        renderizarFilaCozinhaOperacao();
        atualizarConcluidosCozinhaOperacao();
      },
      (erro) => {
        if (inicio !== inicioAssinaturaCozinhaOperacao) return;
        filaCozinhaCarregandoOperacao = false;
        const lista =
          document.getElementById("fila-cozinha") || document.getElementById("gestao-fila-cozinha");
        if (lista) lista.textContent = "Não foi possível conectar a fila: " + erro.message;
        const contador = document.getElementById("quantidade-cozinha");
        if (contador)
          contador.textContent = "Falha ao conectar. Reabra a tela para tentar novamente.";
      },
    );
  viradaFilaCozinhaOperacao = setTimeout(
    assinarFilaDiaCozinhaOperacao,
    Math.max(1000, janelaOperacionalOperacao().fim - Date.now() + 50),
  );
}
const enviosCozinhaEmAndamentoUI = new Set();
async function confirmarProducaoOperacao(colecao, id, automatico = false, reenviarTudo = false) {
  if (automatico && colecao !== "comandas") return false;
  const chaveEnvio = colecao + "/" + id;
  if (enviosCozinhaEmAndamentoUI.has(chaveEnvio)) return false;
  enviosCozinhaEmAndamentoUI.add(chaveEnvio);
  let concluirCarregamento =
    typeof iniciarCarregamentoUI === "function"
      ? iniciarCarregamentoUI("Conferindo e enviando para a cozinha…")
      : () => {};
  try {
    const configProducao = await db.collection("config").doc("producaoTela").get();
    const corteEnvio = Math.max(
      janelaOperacionalOperacao().inicio,
      Number(configProducao.data()?.limpaAntes || 0) + 1,
    );
    const origem = db.collection(colecao).doc(id);
    const fila = db.collection("filaCozinha").doc(`${colecao}_${id}_ativo`);
    const proximoLote = db.collection("filaCozinha").doc();
    const dadosOrigem = (await origem.get()).data();
    const itensCompletos = await completarItensOperacao(dadosOrigem?.itens || []);
    const anteriores = await db.collection("filaCozinha").where("origemId", "==", id).get();
    if (
      !automatico &&
      !reenviarTudo &&
      itensChapeiroOperacao(itensCompletos).length &&
      !itensChapeiroOperacao(
        itensPendentesPreparoOperacao(
          itensCompletos,
          anteriores.docs.map((d) => d.data()).filter((f) => f.origemColecao === colecao),
          corteEnvio,
        ),
      ).length
    ) {
      concluirCarregamento();
      if (
        !(await confirmarOperacao(
          "O chapeiro já fez todos os itens deste pedido. Deseja reenviar tudo para ele?",
        ))
      )
        return false;
      reenviarTudo = true;
      concluirCarregamento =
        typeof iniciarCarregamentoUI === "function"
          ? iniciarCarregamentoUI("Reenviando para a cozinha…")
          : () => {};
    }
    await db.runTransaction(async (t) => {
      const doc = await t.get(origem);
      const filaDoc = await t.get(fila);
      const filas = [];
      for (const anterior of anteriores.docs) {
        const ref = db.collection("filaCozinha").doc(anterior.id);
        const atual = await t.get(ref);
        if (atual.exists && atual.data().origemColecao === colecao)
          filas.push({ ref, id: anterior.id, ...atual.data() });
      }
      if (filaDoc.exists && !filas.some((f) => f.id === fila.id))
        filas.push({ ref: fila, id: fila.id, ...filaDoc.data() });
      if (!doc.exists || doc.data().cancelado || /cancelad/i.test(doc.data().status || ""))
        throw Error("Pedido indisponível.");
      const r = doc.data();
      if (Number(r.cozinhaEnvioRevisao || 0) !== Number(dadosOrigem.cozinhaEnvioRevisao || 0))
        throw Error(
          "A fila foi atualizada durante o envio. Envie novamente para conferir os itens pendentes.",
        );
      if (serializarOperacao(r.itens || []) !== serializarOperacao(dadosOrigem.itens || []))
        throw Error("O pedido mudou durante a conferência. Atualize antes de enviar.");
      if (colecao === "pedidos" && (r.tipo === "Local" || r.tipo === "Consumo no Local"))
        throw Error("Para consumo local, libere os itens pela comanda vinculada.");
      if (colecao === "comandas" && r.status !== "Aberta")
        throw Error("A comanda não está aberta.");
      const itens = agruparItensOperacao(itensCompletos);
      const filasEditadas = aplicarEdicoesPreparoOperacao(
        filas,
        r.edicoesPendentesCozinha,
        corteEnvio,
      );
      const pendentes = reenviarTudo
        ? itens
        : itensPendentesPreparoOperacao(itens, filasEditadas, corteEnvio);
      const { lotes, novos } = distribuirLotesPreparoOperacao(
        pendentes,
        reenviarTudo ? [] : filasEditadas,
        corteEnvio,
      );
      if (reenviarTudo)
        for (const f of filas)
          if (f.ref && f.status === "pronto" && !f.reenviadoEm)
            t.update(f.ref, { reenviadoEm: Date.now() });
      const manterAtivo = lotes.some((l) => l.fila.id === fila.id && l.itens.length);
      const destino = manterAtivo ? proximoLote : fila;
      for (const lote of lotes) {
        if (novos.length && lote.fila.id === destino.id) continue;
        t.update(lote.fila.ref, {
          itens: lote.itens,
          observacao: "",
          status: lote.itens.length ? "aguardando" : "substituido",
          criadoEmMs:
            lote.fila.status === "retirado"
              ? Math.max(Date.now(), corteEnvio)
              : lote.fila.criadoEmMs,
          atualizadoEm: Date.now(),
        });
      }
      if (!novos.length) {
        t.update(origem, {
          itensEnviadosCozinha: itens,
          cozinhaItensVersao: assinaturaItensProducaoOperacao(r.itens),
          cozinhaConfirmadaEm: Date.now(),
          cozinhaEnvioRevisao: Number(r.cozinhaEnvioRevisao || 0) + 1,
          edicoesPendentesCozinha: [],
        });
        return;
      }
      if (destino.id === fila.id && filaDoc.exists && filaDoc.data().status === "pronto")
        t.set(
          db
            .collection("filaCozinha")
            .doc(`${fila.id}_pronto_${filaDoc.data().concluidoEm || Date.now()}`),
          { ...filaDoc.data(), ...(reenviarTudo ? { reenviadoEm: Date.now() } : {}) },
        );
      else if (
        destino.id === fila.id &&
        filaDoc.exists &&
        Number(filaDoc.data().criadoEmMs) < corteEnvio
      )
        t.set(db.collection("filaCozinha").doc(`${fila.id}_limpo_${filaDoc.data().criadoEmMs}`), {
          ...filaDoc.data(),
          status: "limpo",
        });
      t.set(destino, {
        origemColecao: colecao,
        origemId: id,
        numero: r.numero || "",
        tipo: r.tipo || (r.mesa ? "Local" : ""),
        mesa: r.mesa || "",
        cliente: r.nome || r.cliente || "",
        itens: novos,
        observacao: "",
        status: "aguardando",
        criadoEmMs: filas.reduce(
          (maior, f) => Math.max(maior, Number(f.criadoEmMs || 0) + 1),
          Math.max(Date.now(), corteEnvio),
        ),
        atualizadoEm: Date.now(),
        confirmadoPor: localStorage.getItem("atendenteNome") || "Admin",
      });
      t.update(origem, {
        itensEnviadosCozinha: itens,
        cozinhaItensVersao: assinaturaItensProducaoOperacao(r.itens),
        cozinhaConfirmadaEm: Date.now(),
        cozinhaEnvioRevisao: Number(r.cozinhaEnvioRevisao || 0) + 1,
        edicoesPendentesCozinha: [],
      });
    });
    return true;
  } catch (e) {
    avisoOperacao(e.message);
    return false;
  } finally {
    concluirCarregamento();
    enviosCozinhaEmAndamentoUI.delete(chaveEnvio);
  }
}
async function cancelarPreparoComandaOperacao(id) {
  const filas = await db.collection("filaCozinha").where("origemId", "==", id).get();
  const batch = db.batch();
  for (const f of filas.docs)
    if (f.data().origemColecao === "comandas")
      batch.update(db.collection("filaCozinha").doc(f.id), {
        status: "cancelado",
        canceladoEm: Date.now(),
      });
  await batch.commit();
}
function linkLocalizacaoMotoboyUI(local, endereco) {
  let ponto = "";
  try {
    const url = new URL(local);
    const consulta =
      url.searchParams.get("p") ||
      url.searchParams.get("q") ||
      url.searchParams.get("ll") ||
      url.searchParams.get("query") ||
      "";
    const match = consulta.match(/^(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)$/);
    if (match && Math.abs(Number(match[1])) <= 90 && Math.abs(Number(match[2])) <= 180)
      ponto = `${Number(match[1])},${Number(match[2])}`;
  } catch {
    /* Sem GPS salvo, permite buscar o endereço informado. */
  }
  const busca = String(endereco || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!ponto && !busca) return "";
  // Mensagens podem ser montadas no Live Server; o destinatário precisa do site público.
  const url = new URL("https://cardapio-pedrao-lanches.vercel.app/localizacao.html");
  url.searchParams.set(ponto ? "p" : "q", ponto || busca);
  return url.href;
}
async function compartilharMotoboyOperacao(colecao, id) {
  const doc = await db.collection(colecao).doc(id).get();
  if (!doc.exists) return;
  const r = doc.data();
  if (colecao === "pedidos") r.numeroEntregaDia = await numeroMotoboyOperacao(r, id);
  if (!/entrega/i.test(r.tipo || ""))
    return avisoOperacao("Envio ao motoboy é exclusivo de pedidos de entrega.");
  r.itens = await completarItensOperacao(r.itens);
  const linha = (valor) =>
    String(valor || "")
      .replace(/\s+/g, " ")
      .trim();
  const local = r.localizacao || r.mapa || "";
  const localizacao = linkLocalizacaoMotoboyUI(local, r.endereco);
  const texto = `Pedrão Lanches\nEntrega ${r.numeroEntregaDia || ""}\nCliente: ${linha(r.nome || r.cliente)}\nTelefone: ${r.telefone || ""}\nEndereço: ${linha(r.endereco) || "Não informado"}\nCondomínio: ${r.condominio || "Não informado"} | CNH: ${r.cnh || "Não informado"}\nTotal: ${moedaOperacao(r.valorTotal)}\nPagamento: ${textoPagamentoOperacao(r)}${Number(r.descontoCreditoEntrega) > 0 ? `\nTaxa integral do motoboy: ${moedaOperacao(r.taxaEntrega)} | parte da loja: ${moedaOperacao(r.descontoCreditoEntrega)}` : ""}\nBebidas: ${
    bebidasOperacao(r.itens)
      .map((i) => `${i.quantidade} ${linha(i.nome)}`)
      .join("; ") || "Nenhuma"
  }${r.observacao ? `\nObs.: ${linha(r.observacao)}` : ""}${localizacao ? `\nLocalização: ${localizacao}` : ""}`;
  let box = document.getElementById("compartilhar-motoboy");
  if (!box) {
    box = document.createElement("dialog");
    box.id = "compartilhar-motoboy";
    document.body.append(box);
  }
  const mensagem = textoWhatsAppSemEmojisUI(texto);
  box.innerHTML = `<h3>Conferir mensagem para o motoboy</h3><textarea rows="14" readonly>${escaparOperacao(mensagem)}</textarea><a href="https://wa.me/?text=${encodeURIComponent(mensagem)}" target="_blank" rel="noopener">Abrir WhatsApp e escolher o motoboy</a><button type="button" onclick="this.closest('dialog').close()">Fechar</button>`;
  box.showModal();
}
async function solicitarDocumentoClienteOperacao(colecao, id) {
  const nome = await solicitarEntradaOperacao("Nome completo ou razão social para a nota fiscal:");
  if (!nome?.trim()) return;
  const documento = await solicitarEntradaOperacao("CPF ou CNPJ:");
  if (!documento) return;
  const digitos = documento.replace(/\D/g, "");
  if (![11, 14].includes(digitos.length))
    return avisoOperacao("Informe CPF com 11 dígitos ou CNPJ com 14 dígitos.");
  try {
    await db
      .collection(colecao)
      .doc(id)
      .update({
        solicitacaoFiscal: {
          nome: nome.trim(),
          documento: digitos,
          pessoa: digitos.length === 11 ? "fisica" : "juridica",
          status: "pendente",
          solicitadaEm: Date.now(),
        },
      });
    avisoOperacao("Dados guardados para emissão pelo responsável fiscal.");
  } catch (e) {
    avisoOperacao("Não foi possível guardar os dados: " + e.message);
  }
}
// A cozinha acompanha apenas a fila ativa e as origens desses registros.
// Não consulta coleções inteiras de pedidos/comandas em cada mudança da fila.
let pararFilaCozinhaOperacao = null;
let pararConcluidosCozinhaOperacao = null;
let filaCozinhaCarregandoOperacao = false;
const origensCozinhaOperacao = new Map();
function renderizarFilaCozinhaOperacao() {
  const gestao = document.getElementById("gestao-fila-cozinha");
  const lista = document.getElementById("fila-cozinha") || gestao;
  if (!lista) return;
  const protegida = typeof equipeProtegidaAtivaUI === "function" && equipeProtegidaAtivaUI();
  const esperandoOrigens =
    !protegida &&
    filaOperacao.some(
      (r) => origensCozinhaOperacao.get(r.origemColecao + "/" + r.origemId)?.carregando,
    );
  const possuiOrigemCarregada = filaOperacao.some(
    (r) => origensCozinhaOperacao.get(r.origemColecao + "/" + r.origemId)?.dados,
  );
  if (filaCozinhaCarregandoOperacao || (esperandoOrigens && !possuiOrigemCarregada)) {
    lista.innerHTML = htmlCarregandoUI("Carregando pedidos…");
    const contador = document.getElementById("quantidade-cozinha");
    if (contador) contador.textContent = "Conectando à chapa…";
    return;
  }
  const ativos = filaOperacao
    .filter((r) => {
      const origem = origensCozinhaOperacao.get(r.origemColecao + "/" + r.origemId);
      return (
        Number(r.criadoEmMs) >= inicioProducaoOperacao() &&
        (protegida ||
          (origem?.dados &&
            !origem.dados.cancelado &&
            !/cancelad/i.test(origem.dados.status || "")))
      );
    })
    .map((r) => {
      const origem = protegida
        ? {}
        : origensCozinhaOperacao.get(r.origemColecao + "/" + r.origemId).dados;
      return { ...r, tipo: r.tipo || origem.tipo || "", mesa: r.mesa || origem.mesa || "" };
    })
    .filter((r) => itensChapeiroOperacao(r.itens).length > 0)
    .sort((a, b) => a.criadoEmMs - b.criadoEmMs);
  const contador = document.getElementById("quantidade-cozinha");
  if (contador) contador.textContent = ativos.length + " pedido(s) aguardando";
  const remover = document.getElementById("cozinha-remover");
  if (remover) {
    remover.textContent = modoRemoverCozinhaOperacao ? "Concluir exclusão" : "Excluir";
    remover.setAttribute("aria-pressed", String(modoRemoverCozinhaOperacao));
  }
  lista.innerHTML =
    ativos
      .map(
        (r, i) =>
          `${i === 0 ? '<p class="cozinha-proximo">Próximo pedido</p>' : ""}<article class="cozinha-pedido">${modoRemoverCozinhaOperacao && !gestao ? `<button class="cozinha-controle cozinha-remover-x" aria-label="Retirar pedido" onclick="retirarDaFilaCozinhaOperacao('${r.id}')">×</button>` : ""}<header><h2>${escaparOperacao(rotuloDestinoCozinhaOperacao(r))}</h2><p>${escaparOperacao(r.cliente)} · ${new Date(r.criadoEmMs).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</p></header>${itensHtmlChapeiroOperacao(r.itens)}${gestao ? `<button onclick="retirarDaFilaCozinhaOperacao('${r.id}')">Retirar da tela</button>` : `${modoRemoverCozinhaOperacao ? "" : `<button class="cozinha-controle" onclick="concluirCozinhaOperacao('${r.id}')">OK</button>`}`}</article>`,
      )
      .join("") ||
    '<p class="cozinha-vazia">Tudo em dia. Aguardando novos pedidos confirmados.</p>';
}
function sincronizarOrigensCozinhaOperacao() {
  if (typeof equipeProtegidaAtivaUI === "function" && equipeProtegidaAtivaUI()) {
    for (const origem of origensCozinhaOperacao.values()) origem.parar();
    origensCozinhaOperacao.clear();
    return; // O snapshot da fila já contém o preparo; não expõe pagamentos nem endereços à chapa.
  }
  const chaves = new Set(filaOperacao.map((r) => r.origemColecao + "/" + r.origemId));
  for (const [chave, origem] of origensCozinhaOperacao) {
    if (!chaves.has(chave)) {
      origem.parar();
      origensCozinhaOperacao.delete(chave);
    }
  }
  for (const chave of chaves) {
    if (origensCozinhaOperacao.has(chave)) continue;
    const [colecao, id] = chave.split("/");
    if (!["comandas", "pedidos"].includes(colecao) || !id) continue;
    const origem = { dados: null, carregando: true, parar: () => {} };
    origensCozinhaOperacao.set(chave, origem);
    origem.parar = db
      .collection(colecao)
      .doc(id)
      .onSnapshot(
        (doc) => {
          origem.carregando = false;
          origem.dados = doc.exists ? doc.data() : null;
          renderizarFilaCozinhaOperacao();
        },
        (erro) => {
          origem.carregando = false;
          renderizarFilaCozinhaOperacao();
          const contador = document.getElementById("quantidade-cozinha");
          if (contador)
            contador.textContent = "Não foi possível conferir o pedido: " + erro.message;
          else console.error("Não foi possível conferir o pedido da fila.", erro);
        },
      );
  }
}
function atualizarConcluidosCozinhaOperacao() {
  const caixa = document.getElementById("concluidos-cozinha");
  if (!caixa) return;
  const recentes = registrosDiaCozinhaOperacao
    .filter((r) => r.status === "pronto" && Number(r.criadoEmMs) >= inicioProducaoOperacao())
    .sort((a, b) => Number(b.concluidoEm) - Number(a.concluidoEm));
  caixa.innerHTML =
    recentes
      .map(
        (r) =>
          '<article class="producao-concluido"><strong>' +
          escaparOperacao(rotuloDestinoCozinhaOperacao(r)) +
          " · " +
          escaparOperacao(r.cliente) +
          "</strong><small>" +
          new Date(r.concluidoEm).toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit",
          }) +
          "</small>" +
          itensHtmlChapeiroOperacao(r.itens || []) +
          "<button onclick=\"voltarCozinhaOperacao('" +
          escaparOperacao(r.id) +
          "')\">Voltar para fila</button></article>",
      )
      .join("") || "<p>Nenhum pedido concluído neste dia.</p>";
}
function pararCozinhaOperacao() {
  filaCozinhaCarregandoOperacao = false;
  clearTimeout(viradaFilaCozinhaOperacao);
  inicioAssinaturaCozinhaOperacao = null;
  registrosDiaCozinhaOperacao = [];
  pararFilaCozinhaOperacao?.();
  pararFilaCozinhaOperacao = null;
  pararConcluidosCozinhaOperacao?.();
  pararConcluidosCozinhaOperacao = null;
  for (const origem of origensCozinhaOperacao.values()) origem.parar();
  origensCozinhaOperacao.clear();
  filaOperacao = [];
}
let restaurandoAcessoMonitorCozinhaUI = false;
async function restaurarAcessoMonitorCozinhaUI(id) {
  if (restaurandoAcessoMonitorCozinhaUI) return;
  restaurandoAcessoMonitorCozinhaUI = true;
  try {
    const doc = await db.collection("atendentes").doc(id).get();
    if (doc.exists && doc.data().ativo === true && permiteFuncionarioUI(doc.data(), "chapa")) {
      sessionStorage.setItem("cozinhaAcessoPedrao", id);
      document.getElementById("cozinha-acesso").hidden = true;
      iniciarCozinhaOperacao();
    } else {
      localStorage.removeItem("cozinhaAcessoPedrao");
      document.getElementById("cozinha-acesso").hidden = false;
      document.getElementById("cozinha-acesso-status").textContent =
        "Este funcionário não tem acesso ativo à chapa.";
    }
  } catch (e) {
    document.getElementById("cozinha-acesso").hidden = false;
    document.getElementById("cozinha-acesso-status").textContent =
      "Não foi possível conferir o acesso. Tente novamente.";
  } finally {
    restaurandoAcessoMonitorCozinhaUI = false;
  }
}
function iniciarCozinhaOperacao() {
  const lista = document.getElementById("fila-cozinha");
  if (!lista || pararFilaCozinhaOperacao) return;
  const modo = new URLSearchParams(location.search).get("modo");
  document.body.classList.toggle("cozinha-monitor", modo === "monitor");
  if (typeof equipeProtegidaAtivaUI === "function" && equipeProtegidaAtivaUI()) {
    if (!perfilEquipeProtegidaUI || !["chapa", "ambos"].includes(perfilEquipeProtegidaUI.perfil))
      return;
    observarCorteProducaoOperacao();
    assinarFilaDiaCozinhaOperacao();
    return;
  }
  if (!sessionStorage.getItem("cozinhaAcessoPedrao")) {
    const acesso = localStorage.getItem("cozinhaAcessoPedrao");
    if (acesso) {
      restaurarAcessoMonitorCozinhaUI(acesso);
      return;
    }
    document.getElementById("cozinha-acesso").hidden = false;
    document.getElementById("quantidade-cozinha").textContent =
      "Entre com o código do funcionário para conectar.";
    return;
  }
  observarCorteProducaoOperacao();
  assinarFilaDiaCozinhaOperacao();
}
window.addEventListener("pagehide", () => {
  pararCozinhaOperacao();
  pararConfigProducaoOperacao?.();
  pararConfigProducaoOperacao = null;
  clearTimeout(viradaCentralOperacao);
});
document.addEventListener("visibilitychange", () => {
  if (
    !document.hidden &&
    pararFilaCozinhaOperacao &&
    inicioAssinaturaCozinhaOperacao !== inicioProducaoOperacao()
  )
    assinarFilaDiaCozinhaOperacao();
});
window.addEventListener("pageshow", (evento) => {
  if (evento.persisted) iniciarCozinhaOperacao();
});

async function entrarCozinhaOperacao() {
  const codigo = document.getElementById("codigo-cozinha").value.trim();
  if (!codigo) return;
  try {
    if (typeof acessoEquipeDisponivelUI === "function" && (await acessoEquipeDisponivelUI())) {
      const perfil = await entrarEquipeProtegidaUI(codigo, false);
      if (!["chapa", "ambos"].includes(perfil.perfil))
        throw Error("Este código libera apenas Atendimento.");
      registrarAcessoFuncionarioUI(perfil.id, perfil);
      location.reload();
      return;
    }
    const snap = await db
      .collection("atendentes")
      .where("codigo", "==", codigo)
      .where("ativo", "==", true)
      .get();
    if (snap.docs.length !== 1)
      return (document.getElementById("cozinha-acesso-status").textContent =
        "Código inválido ou inativo.");
    if (!permiteFuncionarioUI(snap.docs[0].data(), "chapa"))
      return (document.getElementById("cozinha-acesso-status").textContent =
        "Este código libera apenas Atendimento.");
    registrarAcessoFuncionarioUI(snap.docs[0].id, snap.docs[0].data());
    document.getElementById("codigo-cozinha").value = "";
    document.getElementById("cozinha-acesso").hidden = true;
    iniciarCozinhaOperacao();
  } catch (e) {
    document.getElementById("cozinha-acesso-status").textContent = "Falha ao entrar: " + e.message;
  }
}
async function concluirCozinhaOperacao(id) {
  try {
    const ref = db.collection("filaCozinha").doc(id);
    await db.runTransaction(async (t) => {
      const doc = await t.get(ref);
      if (
        !doc.exists ||
        doc.data().status !== "aguardando" ||
        Number(doc.data().criadoEmMs) < inicioProducaoOperacao()
      )
        throw Error("Este pedido já saiu da fila do dia.");
      t.update(ref, { status: "pronto", concluidoEm: Date.now() });
    });
  } catch (e) {
    avisoOperacao(e.message);
  }
}
async function voltarCozinhaOperacao(id) {
  try {
    const ref = db.collection("filaCozinha").doc(id);
    await db.runTransaction(async (t) => {
      const doc = await t.get(ref);
      if (
        !doc.exists ||
        doc.data().status !== "pronto" ||
        Number(doc.data().criadoEmMs) < inicioProducaoOperacao()
      )
        throw Error("Este pedido não pertence aos concluídos do dia atual.");
      t.update(ref, { status: "aguardando", concluidoEm: null });
    });
  } catch (e) {
    avisoOperacao(e.message);
  }
}
function filtrarCardapioPedrao(texto) {
  if (typeof atualizarVisibilidadeCardapio === "function") {
    atualizarVisibilidadeCardapio(texto);
    return;
  }
  const termo = texto.trim().toLocaleLowerCase("pt-BR");
  document
    .querySelectorAll("#tela-inicio .grid > *")
    .forEach(
      (card) => (card.hidden = !card.textContent.toLocaleLowerCase("pt-BR").includes(termo)),
    );
}
document.addEventListener("DOMContentLoaded", () => {
  const menu = document.querySelector(".menu-atendente");
  if (menu) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = "Pedidos e produção";
    b.onclick = () => abrirCentralOperacao();
    menu.prepend(b);
  }
  const admin = document.querySelector(".admin-body main");
  if (admin && !document.getElementById("financeiro-login")) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = "Pedidos e produção";
    b.onclick = () => abrirCentralOperacao();
    admin.prepend(b);
  }
  iniciarCozinhaOperacao();
});
window.addEventListener("pagehide", () => ouvintesOperacao.forEach((stop) => stop()));
