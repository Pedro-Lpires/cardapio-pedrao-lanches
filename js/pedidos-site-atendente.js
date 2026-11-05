/* Pedidos do site aguardam conferência. Consumo local só entra na cozinha pela comanda. */
"use strict";
let pedidosSitePendentesUI = [],
  pararPedidosSiteUI = null,
  viradaPedidosSiteUI = null;
let pedidosSiteInicioUI = null,
  pedidosSiteRecebidosUI = false;
let versaoEscutaPedidosSiteUI = 0,
  tentativaEscutaPedidosSiteUI = 0,
  repetirEscutaPedidosSiteUI = null;
const pedidosSiteVistosUI = new Set();
let janelaPedidoLocalUI = null,
  areaPedidoLocalUI = null,
  etapaPedidoLocalUI = "lista";
let pedidoLocalAtualUI = null,
  mesaPedidoLocalAtualUI = null,
  consultaPedidoLocalUI = 0;

function pedidoConsumoLocalSiteUI(pedido) {
  return /^(local|consumo no local)$/i.test(String(pedido.tipo || "").trim());
}
function pedidoLocalSemMesaUI(pedido) {
  return (
    pedidoConsumoLocalSiteUI(pedido) &&
    !pedido.mesa &&
    !pedido.mesaId &&
    !pedido.comandaId &&
    !pedido.vinculadoComanda &&
    !pedido.sincronizadoComComanda &&
    !pedido.cancelado &&
    !pedido.retirado &&
    !/finalizad|cancelad/i.test(pedido.status || "")
  );
}
async function buscarPedidosLocalSemMesaUI() {
  const snap = await db
    .collection("pedidos")
    .where("tipo", "in", ["Local", "Consumo no Local"])
    .get();
  const janela = janelaOperacionalOperacao();
  const candidatos = snap.docs
    .map((doc) => ({ ...doc.data(), id: doc.id }))
    .filter(
      (p) =>
        pedidoLocalSemMesaUI(p) &&
        tempoRegistroOperacao(p) >= janela.inicio &&
        tempoRegistroOperacao(p) < janela.fim,
    );
  const vinculados = new Set();
  for (let i = 0; i < candidatos.length; i += 10) {
    const comandas = await db
      .collection("comandas")
      .where(
        "pedidoOrigemId",
        "in",
        candidatos.slice(i, i + 10).map((p) => p.id),
      )
      .get();
    comandas.docs.forEach((doc) => vinculados.add(doc.data().pedidoOrigemId));
  }
  return candidatos
    .filter((p) => !vinculados.has(p.id))
    .sort((a, b) => tempoRegistroOperacao(b) - tempoRegistroOperacao(a));
}
function pedidoSitePendenteUI(pedido, janela = janelaOperacionalOperacao()) {
  const ms = tempoRegistroOperacao(pedido);
  if (
    pedido.origem === "atendente" ||
    pedido.origem === "autoatendimento" ||
    pedido.cancelado ||
    pedido.retirado ||
    /finalizad|cancelad/i.test(pedido.status || "") ||
    pedido.vinculadoComanda ||
    ms < janela.inicio ||
    ms >= janela.fim
  )
    return false;
  if (!["Entrega", "Retirada"].includes(pedido.tipo)) return false;
  return pedido.cozinhaItensVersao
    ? pedido.cozinhaItensVersao !== assinaturaItensProducaoOperacao(pedido.itens || [])
    : !pedido.cozinhaConfirmadaEm;
}
function atualizarContadoresPedidosSiteUI() {
  for (const [tipo, id] of [
    ["Entrega", "contador-pedidos-entrega"],
    ["Retirada", "contador-pedidos-retirada"],
  ]) {
    const total = pedidosSitePendentesUI.filter((p) => p.tipo === tipo).length;
    const contador = document.getElementById(id);
    if (contador) {
      contador.textContent = String(total);
      contador.hidden = !total;
    }
  }
  const atalho = document.getElementById("abrir-pedidos-local-site");
  if (atalho) atalho.textContent = "Pedidos para consumir no local sem mesa";
}
function processarPedidosSiteUI(pedidos, inicio) {
  if (pedidosSiteInicioUI !== inicio) {
    pedidosSiteInicioUI = inicio;
    pedidosSiteVistosUI.clear();
    pedidosSiteRecebidosUI = false;
  }
  pedidosSitePendentesUI = pedidos.filter((p) => pedidoSitePendenteUI(p));
  const novos = [];
  for (const pedido of pedidosSitePendentesUI) {
    const chave = pedido.id + ":" + assinaturaItensProducaoOperacao(pedido.itens || []);
    if (!pedidosSiteVistosUI.has(chave)) {
      pedidosSiteVistosUI.add(chave);
      if (pedidosSiteRecebidosUI) novos.push(pedido);
    }
  }
  pedidosSiteRecebidosUI = true;
  atualizarContadoresPedidosSiteUI();
  if (novos.length && typeof avisarSomPedidosSiteUI === "function") avisarSomPedidosSiteUI(novos);
}
function encerrarPedidosSiteUI() {
  versaoEscutaPedidosSiteUI++;
  clearTimeout(repetirEscutaPedidosSiteUI);
  pararPedidosSiteUI?.();
  pararPedidosSiteUI = null;
  clearTimeout(viradaPedidosSiteUI);
  viradaPedidosSiteUI = null;
}
async function iniciarPedidosSiteUI() {
  if (!document.querySelector(".menu-atendente")) return;
  encerrarPedidosSiteUI();
  const versao = versaoEscutaPedidosSiteUI;
  if (typeof inicializacaoEquipeProtegidaUI !== "undefined") await inicializacaoEquipeProtegidaUI;
  if (versao !== versaoEscutaPedidosSiteUI) return;
  if (
    typeof equipeProtegidaAtivaUI === "function" &&
    equipeProtegidaAtivaUI() &&
    !perfilEquipeProtegidaUI
  )
    return;
  const janela = janelaOperacionalOperacao();
  pararPedidosSiteUI = db
    .collection("pedidos")
    .where("dataMs", ">=", janela.inicio)
    .where("dataMs", "<", janela.fim)
    .onSnapshot(
      (snap) => {
        if (versao !== versaoEscutaPedidosSiteUI) return;
        tentativaEscutaPedidosSiteUI = 0;
        const status = document.getElementById("pedidos-site-status");
        if (status) status.hidden = true;
        processarPedidosSiteUI(
          snap.docs.map((doc) => ({ ...doc.data(), id: doc.id })),
          janela.inicio,
        );
      },
      (erro) => {
        if (versao !== versaoEscutaPedidosSiteUI) return;
        console.error("Não foi possível acompanhar os pedidos do site:", erro);
        const status = document.getElementById("pedidos-site-status");
        if (status) {
          status.hidden = false;
          status.replaceChildren();
          const texto = document.createElement("span");
          texto.textContent = "A conexão com os pedidos foi interrompida. Tentando reconectar… ";
          const repetir = document.createElement("button");
          repetir.type = "button";
          repetir.textContent = "Tentar novamente";
          repetir.onclick = () => {
            tentativaEscutaPedidosSiteUI = 0;
            return iniciarPedidosSiteUI();
          };
          status.append(texto, repetir);
        }
        if (tentativaEscutaPedidosSiteUI < 5) {
          const atraso = Math.min(30000, 2000 * 2 ** tentativaEscutaPedidosSiteUI++);
          repetirEscutaPedidosSiteUI = setTimeout(iniciarPedidosSiteUI, atraso);
        } else if (status)
          status.querySelector("span").textContent =
            "Sem conexão com os pedidos. Toque para tentar novamente. ";
      },
    );
  viradaPedidosSiteUI = setTimeout(
    iniciarPedidosSiteUI,
    Math.max(1000, janela.fim - Date.now() + 100),
  );
}
function montarAtalhoPedidosLocalSiteUI(area) {
  const botao = document.createElement("button");
  botao.type = "button";
  botao.id = "abrir-pedidos-local-site";
  botao.className = "pedidos-local-site-atalho-ui";
  botao.onclick = abrirPedidosConsumoLocalSiteUI;
  area.prepend(botao);
  atualizarContadoresPedidosSiteUI();
}
function prepararJanelaPedidoLocalUI() {
  if (janelaPedidoLocalUI?.open) return janelaPedidoLocalUI;
  areaPedidoLocalUI = document.createElement("div");
  areaPedidoLocalUI.id = "pedidos-local-site-lista-ui";
  areaPedidoLocalUI.hidden = true;
  document.body.append(areaPedidoLocalUI);
  const area = areaPedidoLocalUI;
  const janela = abrirJanelaElementoUI(area, "Consumo no local · pedidos do site");
  janela.classList.add("pedidos-local-site-janela-ui");
  janelaPedidoLocalUI = janela;
  janela.querySelector(".ui-voltar").onclick = () => {
    if (etapaPedidoLocalUI === "destino") abrirSelecaoMesaLocalSiteUI(pedidoLocalAtualUI);
    else if (etapaPedidoLocalUI === "mesas") renderizarPedidosLocalSiteUI();
    else janela.close();
  };
  janela.addEventListener(
    "close",
    () => {
      consultaPedidoLocalUI++;
      area.remove();
      if (janelaPedidoLocalUI === janela) {
        janelaPedidoLocalUI = null;
        areaPedidoLocalUI = null;
      }
    },
    { once: true },
  );
  return janela;
}
function abrirPedidosConsumoLocalSiteUI() {
  prepararJanelaPedidoLocalUI();
  renderizarPedidosLocalSiteUI();
}
async function renderizarPedidosLocalSiteUI() {
  if (!areaPedidoLocalUI) return;
  const consulta = ++consultaPedidoLocalUI;
  etapaPedidoLocalUI = "lista";
  areaPedidoLocalUI.innerHTML = htmlCarregandoUI("Buscando pedidos sem mesa…");
  try {
    const pedidos = await buscarPedidosLocalSemMesaUI();
    if (consulta !== consultaPedidoLocalUI || !janelaPedidoLocalUI?.open) return;
    areaPedidoLocalUI.innerHTML =
      "<p>Vincule o pedido a uma mesa e confira os itens antes de liberar para o chapeiro.</p>" +
      (pedidos
        .map(
          (p) =>
            `<article class="registro-operacao"><h3>Pedido #${escaparOperacao(p.numero || "-")} · ${escaparOperacao(p.nome || "Cliente")}</h3><p>${moedaOperacao(p.valorTotal)}</p>${itensHtmlOperacao(p.itens || [])}<button type="button" onclick="abrirSelecaoMesaLocalSiteUI('${escaparOperacao(p.id)}')">Escolher mesa</button></article>`,
        )
        .join("") || "<p>Nenhum pedido de consumo no local aguardando mesa.</p>");
  } catch (erro) {
    if (consulta === consultaPedidoLocalUI && areaPedidoLocalUI)
      areaPedidoLocalUI.textContent = "Não foi possível consultar os pedidos: " + erro.message;
  }
}
async function listarVinteMesasPedidoUI() {
  const snap = await db.collection("mesas").orderBy("numero").get();
  const mesas = new Map();
  for (const doc of snap.docs) {
    const numero = Number(doc.data().numero);
    if (numero >= 1 && numero <= 20 && !mesas.has(numero))
      mesas.set(numero, { ...doc.data(), id: doc.id });
  }
  const faltantes = Array.from({ length: 20 }, (_, i) => i + 1).filter((n) => !mesas.has(n));
  if (faltantes.length)
    await db.runTransaction(async (t) => {
      const atuais = await Promise.all(
        faltantes.map((n) => t.get(db.collection("mesas").doc("mesa-" + n))),
      );
      faltantes.forEach((n, i) => {
        const ref = db.collection("mesas").doc("mesa-" + n),
          dados = atuais[i].exists ? atuais[i].data() : { numero: n, ocupada: false };
        if (!atuais[i].exists) t.set(ref, dados);
        mesas.set(n, { ...dados, id: ref.id });
      });
    });
  return [...mesas.values()].sort((a, b) => a.numero - b.numero);
}
async function abrirSelecaoMesaLocalSiteUI(pedidoId) {
  prepararJanelaPedidoLocalUI();
  const consulta = ++consultaPedidoLocalUI;
  etapaPedidoLocalUI = "mesas";
  pedidoLocalAtualUI = pedidoId;
  areaPedidoLocalUI.innerHTML = htmlCarregandoUI("Buscando as 20 mesas…");
  try {
    const [pedido, mesas] = await Promise.all([
      db.collection("pedidos").doc(pedidoId).get(),
      listarVinteMesasPedidoUI(),
    ]);
    if (consulta !== consultaPedidoLocalUI || !janelaPedidoLocalUI?.open) return;
    if (!pedido.exists || !pedidoLocalSemMesaUI(pedido.data()))
      throw Error("Este pedido não está disponível para consumo no local.");
    areaPedidoLocalUI.innerHTML = `<h3>Pedido #${escaparOperacao(pedido.data().numero || "-")} · ${escaparOperacao(pedido.data().nome || "Cliente")}</h3><p>Escolha a mesa</p><div class="mesas-atendente-grade">${mesas.map((m) => `<button type="button" class="mesa-atendente" style="background:${m.ocupada ? "#ff8080" : "#90ee90"}" onclick="escolherComandaPedidoLocalSiteUI('${escaparOperacao(pedidoId)}','${escaparOperacao(m.id)}')">Mesa ${m.numero}</button>`).join("")}</div>`;
  } catch (erro) {
    if (consulta === consultaPedidoLocalUI && areaPedidoLocalUI)
      areaPedidoLocalUI.textContent = erro.message;
  }
}
async function escolherComandaPedidoLocalSiteUI(pedidoId, mesaId) {
  const consulta = ++consultaPedidoLocalUI;
  etapaPedidoLocalUI = "destino";
  mesaPedidoLocalAtualUI = mesaId;
  areaPedidoLocalUI.innerHTML = htmlCarregandoUI("Buscando comandas da mesa…");
  try {
    const mesa = await db.collection("mesas").doc(mesaId).get();
    if (!mesa.exists) throw Error("Mesa não encontrada.");
    const comandas = await db
      .collection("comandas")
      .where("mesa", "==", mesa.data().numero)
      .where("status", "==", "Aberta")
      .get();
    if (consulta !== consultaPedidoLocalUI || !janelaPedidoLocalUI?.open) return;
    areaPedidoLocalUI.innerHTML = `<h3>Mesa ${mesa.data().numero}</h3><p>Escolha uma comanda ou crie outra para este cliente.</p>${comandas.docs.map((doc) => `<article class="registro-operacao"><strong>${escaparOperacao(doc.data().cliente || "Cliente")}</strong><p>${moedaOperacao(doc.data().valorTotal)}</p><button type="button" onclick="vincularPedidoComandaExistente('${escaparOperacao(pedidoId)}','${escaparOperacao(mesaId)}','${escaparOperacao(doc.id)}')">Vincular nesta comanda</button></article>`).join("")}<button type="button" onclick="vincularPedidoNovaComanda('${escaparOperacao(pedidoId)}','${escaparOperacao(mesaId)}')">Criar comanda com este pedido</button>`;
  } catch (erro) {
    if (consulta === consultaPedidoLocalUI && areaPedidoLocalUI)
      areaPedidoLocalUI.textContent = erro.message;
  }
}
async function converterRetiradaConsumoLocalUI(pedidoId) {
  if (
    !(await confirmarOperacao(
      "Mudar este pedido de Retirada para Consumo no local? Ele ficará disponível para vincular a uma mesa.",
    ))
  )
    return false;
  const ref = db.collection("pedidos").doc(pedidoId);
  await db.runTransaction(async (t) => {
    const doc = await t.get(ref),
      p = doc.data();
    if (!doc.exists || p.cancelado || p.retirado || p.vinculadoComanda)
      throw Error("Pedido indisponível para mudar de tipo.");
    if (pedidoConsumoLocalSiteUI(p)) return;
    if (p.tipo !== "Retirada") throw Error("Este pedido não é de Retirada.");
    t.update(ref, {
      tipo: "Local",
      tipoOriginal: p.tipoOriginal || "Retirada",
      alteradoPorAtendente: true,
      tipoAlteradoEmMs: Date.now(),
      tipoAlteradoEm: new Date().toISOString(),
    });
  });
  return true;
}
async function vincularPedidoLocalTransacaoUI(pedidoId, mesaId, comandaId = null) {
  const pedidoRef = db.collection("pedidos").doc(pedidoId);
  const comandaRef = comandaId
    ? db.collection("comandas").doc(comandaId)
    : db.collection("comandas").doc();
  const mesaRef = db.collection("mesas").doc(mesaId);
  const anterior = await pedidoRef.get();
  if (!anterior.exists) throw Error("Pedido não encontrado.");
  const vinculoAnterior = await db
    .collection("comandas")
    .where("pedidoOrigemId", "==", pedidoId)
    .limit(1)
    .get();
  if (!vinculoAnterior.empty) throw Error("Este pedido já está vinculado a uma comanda.");
  const antes = anterior.data();
  const itensPedido = await prepararItensPedidoParaComanda(
    antes.itens || [],
    pedidoId,
    antes.numero || null,
  );
  const filaSnap = await db.collection("filaCozinha").where("origemId", "==", pedidoId).get();
  const filas = await Promise.all(
    filaSnap.docs
      .filter((d) => d.data().origemColecao === "pedidos")
      .map(async (doc) => ({
        ref: db.collection("filaCozinha").doc(doc.id),
        antes: doc.data(),
        itens: await prepararItensPedidoParaComanda(
          doc.data().itens || [],
          pedidoId,
          antes.numero || null,
        ),
      })),
  );
  await db.runTransaction(async (t) => {
    const [pedidoDoc, comandaDoc, mesaDoc, ...filasDoc] = await Promise.all([
      t.get(pedidoRef),
      t.get(comandaRef),
      t.get(mesaRef),
      ...filas.map((f) => t.get(f.ref)),
    ]);
    if (!pedidoDoc.exists || !mesaDoc.exists || (comandaId && !comandaDoc.exists))
      throw Error("Pedido, comanda ou mesa não encontrado.");
    const pedido = pedidoDoc.data(),
      mesa = mesaDoc.data(),
      comanda = comandaDoc.data() || {};
    if (!pedidoConsumoLocalSiteUI(pedido))
      throw Error(
        "Somente pedidos de consumo no local podem ser vinculados. Altere o tipo da retirada primeiro.",
      );
    if (
      !pedidoLocalSemMesaUI(pedido) ||
      pedido.cancelado ||
      pedido.retirado ||
      /finalizad|cancelad/i.test(pedido.status || "")
    )
      throw Error("Este pedido já foi vinculado ou não está mais disponível.");
    if (comandaId && (comanda.status !== "Aberta" || Number(comanda.mesa) !== Number(mesa.numero)))
      throw Error("A comanda não está aberta nesta mesa.");
    if (serializarOperacao(pedido.itens || []) !== serializarOperacao(antes.itens || []))
      throw Error("Os itens do pedido mudaram. Abra o vínculo novamente.");
    filasDoc.forEach((doc, i) => {
      if (
        !doc.exists ||
        doc.data().origemColecao !== "pedidos" ||
        doc.data().origemId !== pedidoId ||
        serializarOperacao(doc.data().itens || []) !==
          serializarOperacao(filas[i].antes.itens || [])
      )
        throw Error("A produção mudou durante o vínculo. Confira novamente.");
    });
    const itensAnteriores = comanda.itens || [],
      itens = [...itensAnteriores, ...itensPedido];
    const totalPedido = itensPedido.reduce((n, i) => n + Number(i.subtotal || 0), 0);
    const valorTotal =
      itens.reduce(
        (n, i) =>
          n +
          centavosOperacao(
            i.subtotal ??
              Number(i.precoUnitario ?? i.preco ?? 0) * Number(i.quantidade ?? i.qtd ?? 1),
          ),
        0,
      ) / 100;
    let pagamentos = [...(comanda.pagamentos || [])];
    const legado = pagamentos.some((p) => p.forma);
    if (
      legado ||
      (!pagamentos.length && Number(comanda.valorPago || comanda.valorQuitado || 0) > 0)
    ) {
      const formas = legado
        ? pagamentos
        : [{ forma: "Não informado", valor: Number(comanda.valorPago || 0) }];
      const pago = Number(
        comanda.valorPago ??
          comanda.valorFinal ??
          formas.reduce((n, f) => n + Number(f.valor || 0), 0),
      );
      pagamentos = [
        {
          id: "legado-" + comandaRef.id,
          modo: "valor",
          valorPago: pago,
          valorQuitado: Number(comanda.valorQuitado ?? pago),
          pagoEm: comanda.fechadoEm || comanda.pagoEm || comanda.criadoEm || Date.now(),
          formas,
          descontoCupom: Number(comanda.descontoCupom || 0),
          descontoFidelidade: Number(comanda.descontoFidelidade || 0),
          itens: itensAnteriores.map((item, i) => ({
            itemIndex: i,
            quantidade: Number(item.quantidade || item.qtd || 1),
          })),
        },
      ];
    }
    const recebimentos = recebimentosPedidoOperacao(pedido);
    const totalRecebido = valorRecebidoPedidoOperacao(pedido);
    const quitadoPedido =
      saldoPedidoOperacao(pedido) === 0 ? totalPedido : Math.min(totalRecebido, totalPedido);
    let quitadoDistribuido = 0;
    recebimentos.forEach((recebimento, index) => {
      const ultimo = index === recebimentos.length - 1;
      const valorQuitado = ultimo
        ? quitadoPedido - quitadoDistribuido
        : Math.round(((quitadoPedido * Number(recebimento.valor)) / totalRecebido) * 100) / 100;
      quitadoDistribuido += valorQuitado;
      pagamentos.push({
        id: "pedido-" + pedidoId + "-" + recebimento.id,
        pedidoOrigemId: pedidoId,
        modo: "pedido",
        clienteId: pedido.clienteId || null,
        clienteNome: pedido.nome || "",
        valorOriginal: valorQuitado,
        valorPago: Number(recebimento.valor),
        valorQuitado,
        descontoCupom: Number(recebimento.descontoCupom || 0),
        descontoFidelidade: Number(recebimento.descontoFidelidade || 0),
        pagoEm: recebimento.pagoEm,
        formas: recebimento.formas || [
          { forma: recebimento.forma || "Não informado", valor: Number(recebimento.valor) },
        ],
        itensFinanceiro: recebimento.itens || [],
        itens:
          ultimo && quitadoPedido >= totalPedido
            ? itensPedido.map((item, i) => ({
                itemIndex: itensAnteriores.length + i,
                quantidade: Number(item.quantidade || 1),
              }))
            : [],
      });
    });
    const valorPago = pagamentos.length
      ? pagamentos.reduce((n, p) => n + Number(p.valorPago ?? p.valor ?? 0), 0)
      : Number(comanda.valorPago || 0);
    const valorQuitado = pagamentos.length
      ? pagamentos.reduce((n, p) => n + Number(p.valorQuitado ?? p.valor ?? 0), 0)
      : Number(comanda.valorQuitado || 0);
    const patch = {
      itens,
      valorTotal,
      pagamentos,
      valorPago,
      valorQuitado,
      saldoPendente: Math.max(0, valorTotal - valorQuitado),
      status: "Aberta",
    };
    if (pedido.observacao)
      patch.observacao = [
        comanda.observacao,
        `Pedido #${pedido.numero || "-"}: ${pedido.observacao}`,
      ]
        .filter(Boolean)
        .join("\n");
    if (!comandaId)
      Object.assign(patch, {
        cliente: pedido.nome || "Cliente",
        clienteId: pedido.clienteId || null,
        telefone: pedido.telefone || "",
        mesa: mesa.numero,
        atendenteId: localStorage.getItem("atendenteId") || "",
        atendenteNome: localStorage.getItem("atendenteNome") || "",
        criadoEm: Date.now(),
        pedidoOrigemId: pedidoId,
        pedidoOrigemNumero: pedido.numero || null,
      });
    t.set(comandaRef, patch, { merge: true });
    t.update(mesaRef, { ocupada: true });
    t.update(pedidoRef, {
      itens: itensPedido,
      itensAntesVinculo: pedido.itens || [],
      valorTotalAntesVinculo: Number(pedido.valorTotal || 0),
      valorTotal: totalPedido,
      taxaEntrega: 0,
      tipoOriginal: pedido.tipoOriginal || pedido.tipo,
      tipo: "Consumo no Local",
      vinculadoComanda: true,
      comandaId: comandaRef.id,
      mesa: mesa.numero,
      alteradoPorAtendente: true,
      tipoAlteradoEmMs: Date.now(),
      tipoAlteradoEm: new Date().toISOString(),
    });
    filasDoc.forEach((doc, i) =>
      t.update(filas[i].ref, {
        origemColecao: "comandas",
        origemId: comandaRef.id,
        origemPedidoId: pedidoId,
        tipo: "Local",
        mesa: mesa.numero,
        cliente: pedido.nome || "Cliente",
        itens: agruparItensOperacao(filas[i].itens),
        atualizadoEm: Date.now(),
      }),
    );
  });
  return comandaRef.id;
}
async function concluirVinculoPedidoLocalUI(pedidoId, mesaId, comandaId = null) {
  if (
    !(await confirmarOperacao(
      comandaId
        ? "Adicionar este pedido à comanda escolhida?"
        : "Criar uma comanda com este pedido?",
    ))
  )
    return;
  try {
    const id = await vincularPedidoLocalTransacaoUI(pedidoId, mesaId, comandaId);
    janelaPedidoLocalUI?.close();
    await abrirComandaVinculadaPedido(mesaId, id);
    avisoOperacao("Pedido vinculado. Confira os itens e libere a produção pela comanda.");
  } catch (erro) {
    avisoOperacao(erro.message);
  }
}
async function confirmarPagamentoRetiradaAtendenteUI(pedidoId) {
  await confirmarRecebimentoOperacao(pedidoId);
  await carregarPedidosRetiradaAtendente();
}
document.addEventListener("DOMContentLoaded", iniciarPedidosSiteUI);
window.addEventListener("pagehide", encerrarPedidosSiteUI);
window.addEventListener("pageshow", (evento) => {
  if (evento.persisted) iniciarPedidosSiteUI();
});
window.addEventListener("online", () => {
  tentativaEscutaPedidosSiteUI = 0;
  iniciarPedidosSiteUI();
});
