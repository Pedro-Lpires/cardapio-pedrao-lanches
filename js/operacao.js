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
function dialogoOperacao(titulo, entrada = null, confirmacao = false, opcoes = {}) {
  return new Promise((resolve) => {
    const dialog = document.createElement("dialog");
    dialog.className = entrada ? "ui-caixa ui-form-entrada" : "ui-caixa";
    dialog.innerHTML = `<form method="dialog"><h3>${escaparOperacao(titulo)}</h3>${entrada ? `<label>${escaparOperacao(opcoes.label || "Informe abaixo")}<input id="entrada-dialogo-operacao" type="${entrada}" autocomplete="off" required></label>` : ""}<div class="operacao-acoes"><button value="ok" type="submit">${escaparOperacao(opcoes.botao || (confirmacao ? "Confirmar" : "Continuar"))}</button><button value="cancelar" type="button">Cancelar</button></div></form>`;
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
function avisoOperacao(texto) {
  const dialog = document.createElement("dialog");
  dialog.className = "ui-caixa";
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
function cupomUsoUnicoOperacao(cupom) {
  return cupom?.uso === "unico";
}
function verificarDisponibilidadeCupomOperacao(cupom) {
  if (cupom?.usadoEm) throw Error("Este cupom já foi utilizado e não está mais disponível.");
}
async function prepararUsoCupomAtomicoOperacao(t, codigo, clienteId, origem) {
  if (!codigo) return () => {};
  const cupomRef = db.collection("cuponsDesconto").doc(codigo);
  const cupom = await t.get(cupomRef);
  if (!cupom.exists) throw Error("Cupom indisponível.");
  const dados = cupom.data();
  verificarDisponibilidadeCupomOperacao(dados);
  if (!dados.ativo) throw Error("Cupom indisponível.");
  if (dados.clientesPermitidos && !dados.clientesPermitidos.includes(String(clienteId || "")))
    throw Error("Cupom indisponível para esta conta.");
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
    );
    t.set(ref, pedido);
    registrarUso();
  });
}
function lotePagamentoCupomOperacao(codigo, clienteId, comandaRef) {
  if (!codigo) return db.batch();
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
      const registrarUso = await prepararUsoCupomAtomicoOperacao(
        t,
        codigo,
        clienteId,
        comandaRef.path,
      );
      for (const [modo, ref, dados] of escritas)
        t[modo](ref, ...(modo === "delete" ? [] : [dados]));
      registrarUso();
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
    if (cliente?.exists) {
      const c = cliente.data();
      const valorPago = Number(pagamento.valorPago);
      const patch = { totalGasto: Number(c.totalGasto || 0) + valorPago };
      if (c.fidelidadeAtiva) {
        const novoTotal = Number(c.totalFidelidade || 0) + valorPago;
        const gerado = Math.floor(novoTotal / 300) * 20;
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
    carne: item.tipoCarne || item.carne || "",
    adicionais: item.adicionais || [],
    obs: item.observacao || item.obs || "",
    lanchesCombo: item.lanchesCombo || item.lanchesPersonalizados || [],
    bebida: item.bebida || item.bebidaCombo || "",
    bebidas: item.bebidas || [],
    combo: item.combo || null,
  };
}
function agruparItensOperacao(itens) {
  const grupos = new Map();
  for (const item of itens || []) {
    const detalhe = identidadeItemOperacao(item);
    const chave = serializarOperacao(detalhe);
    if (!grupos.has(chave)) grupos.set(chave, { ...item, ...detalhe, quantidade: 0 });
    grupos.get(chave).quantidade += Number(item.quantidade ?? item.qtd ?? 1);
  }
  return [...grupos.values()];
}
function detalhesItemOperacao(item) {
  let html = "";
  if (
    /combo/i.test(item.categoria || item.nome || "") &&
    !(item.lanchesCombo || item.lanchesPersonalizados || []).length &&
    (item.descricao || item.desc)
  )
    html += `<p>${escaparOperacao(item.descricao || item.desc)}</p>`;
  if (item.carne || item.tipoCarne)
    html += `<p>Carne: ${escaparOperacao(item.carne || item.tipoCarne)}</p>`;
  for (const ad of item.adicionais || [])
    html += `<p>+ ${escaparOperacao(ad.qtd || ad.quantidade || 1)} ${escaparOperacao(ad.nome)}</p>`;
  const obs = item.observacao || item.obs;
  if (obs) html += `<p class="producao-obs">Obs.: ${escaparOperacao(obs)}</p>`;
  (item.lanchesCombo || item.lanchesPersonalizados || []).forEach((lanche, i) => {
    if (
      !(lanche.adicionais || []).some((a) => Number(a.qtd ?? a.quantidade ?? 1) > 0) &&
      !String(lanche.observacao || lanche.obs || "").trim()
    )
      return;
    html += `<div class="producao-combo"><strong>Lanche ${i + 1}: ${escaparOperacao(lanche.nome || lanche.tipoCarne || "")}</strong>${detalhesItemOperacao(lanche)}</div>`;
  });
  return html;
}
function itensHtmlOperacao(itens, valores = false) {
  return (valores ? itens : agruparItensOperacao(itens))
    .map(
      (item) =>
        `<article class="producao-item"><strong>${escaparOperacao(item.quantidade ?? item.qtd ?? 1)} × ${escaparOperacao(item.nome)}</strong>${valores ? `<span>${moedaOperacao(item.subtotal ?? Number(item.precoUnitario ?? item.preco ?? 0) * Number(item.quantidade ?? item.qtd ?? 1))}</span>` : ""}${detalhesItemOperacao(item)}</article>`,
    )
    .join("");
}
function bebidasOperacao(itens) {
  const bebidas = [];
  for (const item of itens || []) {
    const qtd = Number(item.quantidade ?? item.qtd ?? 1);
    if (/bebida/i.test(item.categoria || "")) bebidas.push(item);
    const lista = item.bebidas || item.combo?.bebidas || [];
    for (const bebida of Array.isArray(lista) ? lista : [])
      bebidas.push(
        typeof bebida === "string"
          ? { nome: bebida, quantidade: qtd }
          : { ...bebida, quantidade: Number(bebida.quantidade || bebida.qtd || 1) * qtd },
      );
    const bebida = item.bebida || item.bebidaCombo;
    if (bebida)
      bebidas.push(
        typeof bebida === "string"
          ? { nome: bebida, quantidade: qtd }
          : { ...bebida, quantidade: Number(bebida.quantidade || bebida.qtd || 1) * qtd },
      );
    if (!bebida && !lista.length && /combo/i.test(item.categoria || item.nome || "")) {
      const descricao = item.descricao || item.desc || "";
      const trecho = descricao
        .split("+")
        .find((s) => /refrigerante|refri|coca|guaran[aá]|bebida|suco/i.test(s));
      if (trecho) {
        const texto = trecho.trim();
        const match = texto.match(/^(\d+)\s+(.+)/);
        bebidas.push({
          nome: match ? match[2] : texto,
          quantidade: qtd * (match ? Number(match[1]) : 1),
        });
      }
    }
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
        !i.bebida &&
        !i.bebidas?.length,
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
    html += `<h3>Entrega</h3><p>Telefone: ${escaparOperacao(dados.telefone || dados.telefoneCliente || "")}</p><p>Endereço: ${escaparOperacao(dados.endereco || dados.enderecoEscrito || "Não informado")}</p><p>Condomínio: ${escaparOperacao(dados.condominio || "Não informado")}</p>`;
    if (dados.condominio === "Sim" || dados.condominio === true)
      html += `<p>CNH: ${escaparOperacao(dados.cnh || "Não informado")}</p>`;
    html += `<p>Total: <strong>${moedaOperacao(dados.valorTotal)}</strong></p><p>Pagamento: ${escaparOperacao(textoPagamentoOperacao(dados))}</p><h3>Bebidas, incluindo combos</h3>${itensHtmlOperacao(bebidasOperacao(dados.itens)) || "<p>Nenhuma bebida.</p>"}`;
  } else {
    html += `<h3>${tipo === "cozinha" ? "Chapeiro" : "Conferência geral"}</h3>${itensHtmlOperacao(dados.itens || [], tipo === "geral")}`;
    if (dados.observacao) html += `<p>Observação: ${escaparOperacao(dados.observacao)}</p>`;
    if (tipo === "geral")
      html += `<hr>${/entrega/i.test(dados.tipo || "") && Number(dados.taxaEntrega) > 0 ? `<p>Taxa de entrega: ${moedaOperacao(dados.taxaEntrega)}</p>` : ""}<p>Descontos: ${moedaOperacao(Number(dados.descontoCupom || 0) + Number(dados.descontoFidelidade || 0))}</p><h2>Total: ${moedaOperacao(totalConferencia)}</h2><p>Recebido: ${moedaOperacao(recebido)}</p><p>Falta receber: ${moedaOperacao(falta)}</p><p>Pagamento: ${escaparOperacao(textoPagamentoOperacao(dados))}</p><p>Recibo de conferência — não é documento fiscal.</p>`;
  }
  return html;
}
function abrirImpressaoOperacao(html) {
  const janela = window.open("", "_blank", "width=480,height=760");
  if (!janela) return avisoOperacao("Permita abrir a janela de impressão neste navegador.");
  janela.document.write(
    `<!doctype html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Pedrão — impressão</title><style>body{font:14px Arial;color:#000;max-width:76mm;margin:8px auto}h1{font-size:20px}h2{font-size:18px}header{text-align:center}.producao-item{border-bottom:1px dashed #888;padding:10px 0}.producao-item span{float:right}p{margin:5px 0;overflow-wrap:anywhere}.producao-combo{padding-left:12px}button{padding:12px}@page{margin:4mm}@media print{button{display:none}}</style></head><body><button onclick="window.print()">Imprimir / salvar PDF</button>${html}</body></html>`,
  );
  janela.document.close();
  janela.focus();
}
async function imprimirRegistroOperacao(colecao, id, tipo) {
  try {
    const doc = await db.collection(colecao).doc(id).get();
    if (!doc.exists) return avisoOperacao("Registro não encontrado.");
    const dados = doc.data();
    if (colecao === "pedidos" && tipo === "motoboy")
      dados.numeroEntregaDia = await numeroMotoboyOperacao(dados, id);
    dados.itens = await completarItensOperacao(dados.itens);
    if (tipo === "motoboy" && !/entrega/i.test(dados.tipo || ""))
      return avisoOperacao(
        "Este pedido é para consumo no local ou retirada. Use a impressão da cozinha ou geral.",
      );
    abrirImpressaoOperacao(gerarImpressaoOperacao(tipo, dados));
  } catch (e) {
    avisoOperacao("Não foi possível carregar a impressão: " + e.message);
  }
}
async function imprimirMesaOperacao(numero, tipo = "cozinha") {
  const snap = await db
    .collection("comandas")
    .where("mesa", "==", numero)
    .where("status", "==", "Aberta")
    .get();
  if (snap.empty) return avisoOperacao("Esta mesa não tem comandas abertas.");
  const comandas = snap.docs.map((d) => d.data());
  abrirImpressaoOperacao(
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
  box.classList.toggle("central-etapa-modal", !!tipo || !!registroId);
  box.innerHTML = `<div class="operacao-acoes"><h2>${tipo ? "Pedidos de " + escaparOperacao(tipo) : "Pedidos e produção"}</h2><button type="button" onclick="document.getElementById('central-operacao').hidden=true">Fechar</button><a href="cozinha.html" target="_blank" rel="noopener">Abrir tela do chapeiro</a><button type="button" onclick="carregarCentralOperacao()">Atualizar pedidos</button></div><p>Confira o pedido e confirme para enviá-lo à cozinha. As impressões ficam disponíveis aqui.</p><label>Imprimir comandas abertas da mesa <input id="mesa-imprimir-operacao" type="number" min="1" inputmode="numeric"></label><button type="button" onclick="imprimirMesaOperacao(Number(document.getElementById('mesa-imprimir-operacao').value))">Imprimir mesa para chapeiro</button><div id="registros-operacao">Carregando…</div>`;
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
  if (!document.querySelector(".menu-atendente") && (tipo || registroId)) cabecalhoEtapaUI(box);
  if (tipo !== "Mesas" || registroId) {
    box.querySelector("label")?.remove();
    box.querySelector('[onclick^="imprimirMesaOperacao"]')?.remove();
  }
  if (!tipo && !registroId) {
    document.getElementById("registros-operacao").textContent =
      "Escolha Delivery, Retirada ou Mesas para consultar os pedidos.";
    return;
  }
  await carregarCentralOperacao();
}
let viradaCentralOperacao;
async function carregarCentralOperacao() {
  clearTimeout(viradaCentralOperacao);
  if (!tipoCentralOperacao && !idCentralOperacao) return;
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
            ? r.colecao === "comandas" || !!r.mesa
            : String(r.tipo).toLowerCase() === tipoCentralOperacao.toLowerCase())) &&
        !r.cancelado &&
        !/cancelad/i.test(r.status || "") &&
        (r.colecao === "comandas"
          ? r.status === "Aberta"
          : !vinculados.has(r.id) &&
            (idCentralOperacao ||
              (tempoRegistroOperacao(r) >= janela.inicio &&
                tempoRegistroOperacao(r) < janela.fim))),
    );
    const grupo = (r) =>
      r.mesa || r.colecao === "comandas"
        ? "Mesas"
        : /entrega/i.test(r.tipo || "")
          ? "Delivery · Entregas"
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
              : "Retirada";
          const args = `'${r.colecao}','${escaparOperacao(r.id)}'`;
          const recebido = r.pagamentoConfirmado === true || /^pago$/i.test(r.status || "");
          return `<article class="registro-operacao"><h3>${escaparOperacao(titulo)} — ${escaparOperacao(r.nome || r.cliente || "")}</h3><p>${escaparOperacao(r.tipo || "Consumo no local")} · ${moedaOperacao(r.valorTotal)}</p><p class="recebimento-status ${recebido ? "recebido" : ""}">${recebido ? "Recebido confirmado" : "Recebimento ainda não confirmado"}${r.pagamento ? " · " + escaparOperacao(r.pagamento) : ""}</p>${!idCentralOperacao ? `<button onclick="abrirCentralOperacao('${escaparOperacao(r.tipo || "")}','${escaparOperacao(r.id)}')">Abrir pedido</button>` : `${itensHtmlOperacao(r.itens || [])}${acoesRegistroUI(r.colecao, r.id, /entrega/i.test(r.tipo || ""))}<button onclick="solicitarDocumentoClienteOperacao(${args})">Dados para nota fiscal</button>${r.colecao === "pedidos" && !/local/i.test(r.tipo || "") && !recebido ? `<button onclick="confirmarRecebimentoOperacao('${escaparOperacao(r.id)}')">Confirmar recebimento</button>` : ""}`}</article>`;
        })
        .join("") || "<p>Nenhum pedido pendente neste período.</p>";
    if (idCentralOperacao && lista.length) {
      const card = document.querySelector("#registros-operacao>.registro-operacao");
      card
        .querySelector(".ui-acoes-pedido")
        ?.insertAdjacentHTML("beforebegin", molhosAtendenteOperacao(lista[0].itens || []));
    }
    let anterior = "";
    document.querySelectorAll("#registros-operacao>.registro-operacao").forEach((card, i) => {
      const nome = grupo(lista[i]);
      if (nome !== anterior) {
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
function molhosAtendenteOperacao(itens) {
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
            `<li>${escaparOperacao(m.qtd || m.quantidade)} × ${escaparOperacao(m.nome)}${m.preco != null ? " · " + moedaOperacao(Number(m.preco) * Number(m.qtd || m.quantidade)) : ""}</li>`,
        )
        .join("");
      return `<section class="molhos-atendente"><h4>Molhos · ${escaparOperacao(item.nome)}</h4>${linhasGratis ? `<p>Grátis</p><ul>${linhasGratis}</ul>` : ""}${linhasPagos ? `<p>Pagos</p><ul>${linhasPagos}</ul>` : ""}</section>`;
    })
    .join("");
}
async function confirmarRecebimentoOperacao(id) {
  if (!(await confirmarOperacao("O valor deste pedido foi realmente recebido?"))) return;
  try {
    await db
      .collection("pedidos")
      .doc(id)
      .update({ pagamentoConfirmado: true, pagamentoConfirmadoEm: Date.now() });
    await carregarCentralOperacao();
  } catch (e) {
    avisoOperacao("Não foi possível confirmar: " + e.message);
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
async function confirmarProducaoOperacao(colecao, id, automatico = false) {
  if (automatico && colecao !== "comandas") return;
  if (
    !automatico &&
    !(await confirmarOperacao("Pedido conferido? Enviar os itens novos para o chapeiro?"))
  )
    return;
  try {
    const origem = db.collection(colecao).doc(id);
    const fila = db.collection("filaCozinha").doc(`${colecao}_${id}_ativo`);
    const dadosOrigem = (await origem.get()).data();
    const itensCompletos = await completarItensOperacao(dadosOrigem?.itens || []);
    const anteriores = await db.collection("filaCozinha").where("origemId", "==", id).get();
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
      if (serializarOperacao(r.itens || []) !== serializarOperacao(dadosOrigem.itens || []))
        throw Error("O pedido mudou durante a conferência. Atualize antes de enviar.");
      if (colecao === "pedidos" && (r.tipo === "Local" || r.tipo === "Consumo no Local"))
        throw Error("Para consumo local, libere os itens pela comanda vinculada.");
      if (colecao === "comandas" && r.status !== "Aberta")
        throw Error("A comanda não está aberta.");
      const itens = agruparItensOperacao(itensCompletos);
      const enviados = agruparItensOperacao(
        filas.filter((f) => f.status === "pronto").flatMap((f) => f.itens || []),
      );
      const novos = itens
        .map((item) => {
          const comparar = (i) => serializarOperacao(identidadeItemOperacao(i));
          const antigo = enviados.find((i) => comparar(i) === comparar(item));
          return {
            ...item,
            quantidade: Math.max(0, item.quantidade - Number(antigo?.quantidade || 0)),
          };
        })
        .filter((i) => i.quantidade > 0);
      for (const anterior of filas)
        if (anterior.status === "aguardando" && anterior.id !== fila.id)
          t.update(anterior.ref, { status: "substituido", atualizadoEm: Date.now() });
      if (!novos.length) {
        if (filaDoc.exists && filaDoc.data().status === "aguardando")
          t.update(fila, { status: "substituido", atualizadoEm: Date.now() });
        t.update(origem, { itensEnviadosCozinha: itens, cozinhaConfirmadaEm: Date.now() });
        return;
      }
      if (filaDoc.exists && filaDoc.data().status === "pronto")
        t.set(
          db
            .collection("filaCozinha")
            .doc(`${fila.id}_pronto_${filaDoc.data().concluidoEm || Date.now()}`),
          filaDoc.data(),
        );
      t.set(fila, {
        origemColecao: colecao,
        origemId: id,
        numero: r.numero || "",
        tipo: r.tipo || (r.mesa ? "Local" : ""),
        mesa: r.mesa || "",
        cliente: r.nome || r.cliente || "",
        itens: novos,
        observacao: r.observacao || "",
        status: "aguardando",
        criadoEmMs:
          filaDoc.exists && filaDoc.data().status === "aguardando"
            ? filaDoc.data().criadoEmMs
            : Date.now(),
        atualizadoEm: Date.now(),
        confirmadoPor: localStorage.getItem("atendenteNome") || "Admin",
      });
      t.update(origem, { itensEnviadosCozinha: itens, cozinhaConfirmadaEm: Date.now() });
    });
    if (!automatico) avisoOperacao("Itens enviados à cozinha.");
  } catch (e) {
    avisoOperacao(e.message);
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
async function compartilharMotoboyOperacao(colecao, id) {
  const doc = await db.collection(colecao).doc(id).get();
  if (!doc.exists) return;
  const r = doc.data();
  if (colecao === "pedidos") r.numeroEntregaDia = await numeroMotoboyOperacao(r, id);
  if (!/entrega/i.test(r.tipo || ""))
    return avisoOperacao("Envio ao motoboy é exclusivo de pedidos de entrega.");
  r.itens = await completarItensOperacao(r.itens);
  const texto = `Pedrão Lanches\nEntrega ${r.numeroEntregaDia || ""}\nCliente: ${r.nome || r.cliente || ""}\nTelefone: ${r.telefone || ""}\nEndereço: ${r.endereco || "Não informado"}\nCondomínio: ${r.condominio || "Não informado"}\nCNH: ${r.cnh || "Não informado"}\nTotal: ${moedaOperacao(r.valorTotal)}\nPagamento: ${textoPagamentoOperacao(r)}\nBebidas:\n${
    bebidasOperacao(r.itens)
      .map((i) => `${i.quantidade}x ${i.nome}`)
      .join("\n") || "Nenhuma"
  }\nLocalização: ${r.localizacao || r.mapa || "Não informada"}`;
  let box = document.getElementById("compartilhar-motoboy");
  if (!box) {
    box = document.createElement("dialog");
    box.id = "compartilhar-motoboy";
    document.body.append(box);
  }
  box.innerHTML = `<h3>Conferir mensagem para o motoboy</h3><textarea rows="14" readonly>${escaparOperacao(texto)}</textarea><a href="https://wa.me/?text=${encodeURIComponent(texto)}" target="_blank" rel="noopener">Abrir WhatsApp e escolher o motoboy</a><button type="button" onclick="this.closest('dialog').close()">Fechar</button>`;
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
const origensCozinhaOperacao = new Map();
function renderizarFilaCozinhaOperacao() {
  const lista = document.getElementById("fila-cozinha");
  if (!lista) return;
  const ativos = filaOperacao
    .filter((r) => {
      const origem = origensCozinhaOperacao.get(r.origemColecao + "/" + r.origemId);
      return (
        origem?.dados && !origem.dados.cancelado && !/cancelad/i.test(origem.dados.status || "")
      );
    })
    .map((r) => {
      const origem = origensCozinhaOperacao.get(r.origemColecao + "/" + r.origemId).dados;
      return { ...r, tipo: r.tipo || origem.tipo || "", mesa: r.mesa || origem.mesa || "" };
    })
    .sort((a, b) => a.criadoEmMs - b.criadoEmMs);
  document.getElementById("quantidade-cozinha").textContent =
    ativos.length + " pedido(s) aguardando";
  lista.innerHTML =
    ativos
      .map(
        (r, i) =>
          `<article class="cozinha-pedido"><header><h2>${escaparOperacao(rotuloDestinoCozinhaOperacao(r))}</h2><p>${escaparOperacao(r.cliente)} · ${new Date(r.criadoEmMs).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</p>${i === 0 ? "<strong>Próximo pedido</strong>" : ""}</header>${itensHtmlOperacao(r.itens)}${r.observacao ? `<p class="producao-obs">${escaparOperacao(r.observacao)}</p>` : ""}<button class="cozinha-controle" onclick="concluirCozinhaOperacao('${r.id}')">OK — pedido pronto</button></article>`,
      )
      .join("") ||
    '<p class="cozinha-vazia">Tudo em dia. Aguardando novos pedidos confirmados.</p>';
}
function sincronizarOrigensCozinhaOperacao() {
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
    const origem = { dados: null, parar: () => {} };
    origensCozinhaOperacao.set(chave, origem);
    origem.parar = db
      .collection(colecao)
      .doc(id)
      .onSnapshot(
        (doc) => {
          origem.dados = doc.exists ? doc.data() : null;
          renderizarFilaCozinhaOperacao();
        },
        (erro) => {
          document.getElementById("quantidade-cozinha").textContent =
            "Não foi possível conferir o pedido: " + erro.message;
        },
      );
  }
}
function atualizarConcluidosCozinhaOperacao() {
  const caixa = document.getElementById("concluidos-cozinha");
  if (!caixa) return;
  const aberto = caixa.closest("details")?.open;
  if (pararConcluidosCozinhaOperacao) {
    pararConcluidosCozinhaOperacao();
    pararConcluidosCozinhaOperacao = null;
  }
  if (!aberto || !pararFilaCozinhaOperacao) return;
  caixa.textContent = "Carregando concluídos recentes…";
  // Índice simples já disponível: não exige novo índice composto no Firebase.
  pararConcluidosCozinhaOperacao = db
    .collection("filaCozinha")
    .orderBy("concluidoEm", "desc")
    .limit(10)
    .onSnapshot(
      (snap) => {
        const recentes = snap.docs
          .map((doc) => ({ ...doc.data(), id: doc.id }))
          .filter((r) => r.status === "pronto");
        caixa.innerHTML =
          recentes
            .map(
              (r) =>
                `<p>${escaparOperacao(rotuloDestinoCozinhaOperacao(r))} — ${escaparOperacao(r.cliente)} <button onclick="voltarCozinhaOperacao('${r.id}')">Voltar para fila</button></p>`,
            )
            .join("") || "<p>Nenhum pedido concluído.</p>";
      },
      (erro) => {
        caixa.textContent = "Não foi possível carregar os concluídos: " + erro.message;
      },
    );
}
function pararCozinhaOperacao() {
  pararFilaCozinhaOperacao?.();
  pararFilaCozinhaOperacao = null;
  pararConcluidosCozinhaOperacao?.();
  pararConcluidosCozinhaOperacao = null;
  for (const origem of origensCozinhaOperacao.values()) origem.parar();
  origensCozinhaOperacao.clear();
  filaOperacao = [];
}
function iniciarCozinhaOperacao() {
  const lista = document.getElementById("fila-cozinha");
  if (!lista || pararFilaCozinhaOperacao) return;
  if (!sessionStorage.getItem("cozinhaAcessoPedrao")) {
    document.getElementById("cozinha-acesso").hidden = false;
    document.getElementById("quantidade-cozinha").textContent =
      "Entre com o código do funcionário para conectar.";
    return;
  }
  const modo = new URLSearchParams(location.search).get("modo");
  document.body.classList.toggle("cozinha-monitor", modo === "monitor");
  pararFilaCozinhaOperacao = db
    .collection("filaCozinha")
    .where("status", "==", "aguardando")
    .onSnapshot(
      (snap) => {
        filaOperacao = snap.docs.map((doc) => ({ ...doc.data(), id: doc.id }));
        sincronizarOrigensCozinhaOperacao();
        renderizarFilaCozinhaOperacao();
      },
      (erro) => {
        lista.textContent = "Não foi possível conectar a cozinha: " + erro.message;
      },
    );
  const detalhes = document.getElementById("concluidos-cozinha")?.closest("details");
  if (detalhes) detalhes.ontoggle = atualizarConcluidosCozinhaOperacao;
  atualizarConcluidosCozinhaOperacao();
}
window.addEventListener("pagehide", pararCozinhaOperacao);
window.addEventListener("pageshow", (evento) => {
  if (evento.persisted) iniciarCozinhaOperacao();
});

async function entrarCozinhaOperacao() {
  const codigo = document.getElementById("codigo-cozinha").value.trim();
  if (!codigo) return;
  try {
    const snap = await db
      .collection("atendentes")
      .where("codigo", "==", codigo)
      .where("ativo", "==", true)
      .get();
    if (snap.empty)
      return (document.getElementById("cozinha-acesso-status").textContent =
        "Código inválido ou inativo.");
    sessionStorage.setItem("cozinhaAcessoPedrao", snap.docs[0].id);
    document.getElementById("codigo-cozinha").value = "";
    document.getElementById("cozinha-acesso").hidden = true;
    iniciarCozinhaOperacao();
  } catch (e) {
    document.getElementById("cozinha-acesso-status").textContent = "Falha ao entrar: " + e.message;
  }
}
async function concluirCozinhaOperacao(id) {
  try {
    await db
      .collection("filaCozinha")
      .doc(id)
      .update({ status: "pronto", concluidoEm: Date.now() });
  } catch (e) {
    avisoOperacao("Não foi possível concluir: " + e.message);
  }
}
async function voltarCozinhaOperacao(id) {
  try {
    await db.collection("filaCozinha").doc(id).update({ status: "aguardando", concluidoEm: null });
  } catch (e) {
    avisoOperacao("Não foi possível voltar: " + e.message);
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
