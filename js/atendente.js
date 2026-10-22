/**
 * Atendimento: mesas, comandas, entregas, retiradas e pagamentos. IDs dos elementos e nomes usados em onclick são contratos com o HTML.
 *
 * Organização e caminhos: consulte GUIA-DO-CODIGO.md.
 */

let mesaAbertaAtual = null;
let comandaAbertaAtual = null;
let listenerChamadosMesaAtendente = null;

let chamadosMesaAbertosAtendente = [];
let pedidoEntregaAtual = null;
let pedidoRetiradaAtual = null;
let contextoMolhosPedido = "entrega";
let indiceItemEntregaEmEdicao = null;
let indiceItemRetiradaEmEdicao = null;
let modoRemoverItem = false;
let modoEditarItem = false;
let selecaoPagamentoSeparado = [];
let modoPagamentoSeparado = "itens";
let itensPagamentoSeparadoAtual = [];

let cupomPagamentoSeparadoAtual = null;

let cuponsPagamentoSeparadoAtuais = [];
let cupomPagamentoAtendenteAtual = null;

let cuponsPagamentoAtendenteAtuais = [];
let clientePagamentoSeparadoAtual = null;

let contextoPagamentoSeparadoAtual = null;
let areaDestinoComandaAtual = null;

async function loginAtendente() {
  const codigo = document.getElementById("codigo-atendente").value.trim();

  if (!codigo) {
    alert("Digite o código.");

    return;
  }

  const snap = await db
    .collection("atendentes")
    .where("codigo", "==", codigo)
    .where("ativo", "==", true)
    .get();

  if (snap.empty) {
    alert("Código inválido.");

    return;
  }

  const atendente = snap.docs[0];

  localStorage.setItem("atendenteId", atendente.id);

  localStorage.setItem("atendenteNome", atendente.data().nome);

  location.href = "painel-atendente.html";
}
const nomeAtendente = localStorage.getItem("atendenteNome");

const boxNome = document.getElementById("nome-atendente");

if (boxNome && nomeAtendente) {
  boxNome.innerText = `Bem-vindo, ${nomeAtendente}`;
}

function logoutAtendente() {
  localStorage.removeItem("atendenteId");

  localStorage.removeItem("atendenteNome");

  location.href = "atendente.html";
}
async function abrirEntregaAtendente() {
  const areaEntrega = document.getElementById("area-entrega-atendente");

  const areaConsumo = document.getElementById("area-consumo-local");

  const areaMesa = document.getElementById("area-mesa-atendente");

  const areaComanda = document.getElementById("area-comanda-atendente");

  const areaProdutos = document.getElementById("area-produtos-comanda");

  if (!areaEntrega) {
    return;
  }

  // =========================
  // SE ENTREGA JÁ ESTÁ ABERTA
  // SEGUNDO CLIQUE = FECHAR
  // =========================

  if (areaEntrega.style.display !== "none") {
    areaEntrega.style.display = "none";

    areaEntrega.innerHTML = "";

    return;
  }

  // =========================
  // FECHAR OUTRAS ÁREAS
  // =========================

  if (areaConsumo) {
    areaConsumo.style.display = "none";

    areaConsumo.innerHTML = "";

    areaConsumo.dataset.tela = "";
  }

  if (areaMesa) {
    areaMesa.style.display = "none";

    areaMesa.innerHTML = "";
  }

  if (areaComanda) {
    areaComanda.style.display = "none";

    areaComanda.innerHTML = "";
  }

  if (areaProdutos) {
    areaProdutos.style.display = "none";

    areaProdutos.innerHTML = "";
  }

  // =========================
  // LIMPAR ESTADOS DE COMANDA
  // =========================

  mesaAbertaAtual = null;

  comandaAbertaAtual = null;

  areaDestinoComandaAtual = null;

  // =========================
  // ABRIR ENTREGA
  // =========================

  areaEntrega.style.display = "block";

  areaEntrega.innerHTML = `

        <h3>
            🛵 Entregas
        </h3>


        <button
            type="button"
            onclick="
                criarNovoPedidoEntrega()
            "
        >
            ➕ Criar Pedido
        </button>

    `;
}
async function abrirRetiradaAtendente() {
  const areaRetirada = document.getElementById("area-retirada-atendente");

  const areaEntrega = document.getElementById("area-entrega-atendente");

  const areaConsumo = document.getElementById("area-consumo-local");

  const areaMesa = document.getElementById("area-mesa-atendente");

  const areaComanda = document.getElementById("area-comanda-atendente");

  const areaProdutos = document.getElementById("area-produtos-comanda");

  if (!areaRetirada) {
    return;
  }

  // =========================
  // SE JÁ ESTÁ ABERTA
  // SEGUNDO CLIQUE = FECHAR
  // =========================

  if (areaRetirada.style.display !== "none") {
    areaRetirada.style.display = "none";

    areaRetirada.innerHTML = "";

    return;
  }

  // =========================
  // FECHAR ENTREGA
  // =========================

  if (areaEntrega) {
    areaEntrega.style.display = "none";

    areaEntrega.innerHTML = "";
  }

  // =========================
  // FECHAR CONSUMO LOCAL
  // =========================

  if (areaConsumo) {
    areaConsumo.style.display = "none";

    areaConsumo.innerHTML = "";

    areaConsumo.dataset.tela = "";
  }

  if (areaMesa) {
    areaMesa.style.display = "none";

    areaMesa.innerHTML = "";
  }

  if (areaComanda) {
    areaComanda.style.display = "none";

    areaComanda.innerHTML = "";
  }

  if (areaProdutos) {
    areaProdutos.style.display = "none";

    areaProdutos.innerHTML = "";
  }

  // =========================
  // LIMPAR ESTADOS DE COMANDA
  // =========================

  mesaAbertaAtual = null;

  comandaAbertaAtual = null;

  areaDestinoComandaAtual = null;

  // =========================
  // ABRIR RETIRADA
  // =========================

  areaRetirada.style.display = "block";

  areaRetirada.innerHTML = `

    <h3>
        📦 Retirada
    </h3>


    <button
        type="button"
        onclick="
            criarNovoPedidoRetirada()
        "
    >
        ➕ Criar Pedido
    </button>


    <hr>


    <h4>
        Pedidos em Retirada
    </h4>


    <div
        id="lista-pedidos-retirada-atendente"
    >
        <p>
            Carregando...
        </p>
    </div>

`;

  // =========================
  // CARREGAR PEDIDOS
  // =========================

  await carregarPedidosRetiradaAtendente();
}

function obterJanelaAtualPedidosAtendente() {
  const agora = new Date();

  let inicio;
  let fim;

  // =====================================================
  // ANTES DAS 2H
  // AINDA PERTENCE AO DIA ANTERIOR
  // =====================================================

  if (agora.getHours() < 2) {
    inicio = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() - 1, 2, 0, 0, 0);

    fim = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 2, 0, 0, 0);
  }

  // =====================================================
  // A PARTIR DAS 2H
  // COMEÇA UM NOVO DIA
  // =====================================================
  else {
    inicio = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 2, 0, 0, 0);

    fim = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() + 1, 2, 0, 0, 0);
  }

  return {
    inicioMs: inicio.getTime(),

    fimMs: fim.getTime(),
  };
}

function normalizarTextoCupomAtendente(texto) {
  return String(texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[()]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function calcularDescontoCupomAtendente(cupom, valorBase, itens) {
  const base = Number(valorBase || 0);

  const listaItens = itens || [];

  let desconto = 0;

  let itensElegiveis = 0;

  // =========================================
  // CUPOM SOBRE O PEDIDO
  // =========================================

  if (cupom.tipo === "pedido" || cupom.tipo === "descontoGeral") {
    if (cupom.modo === "valor") {
      desconto = Number(cupom.valor || 0);
    } else if (cupom.modo === "porcentagem") {
      desconto = base * (Number(cupom.valor || 0) / 100);
    }
  }

  // =========================================
  // CUPOM DE ITEM
  // =========================================
  else if (cupom.tipo === "item") {
    listaItens.forEach((item) => {
      const nomeItem = normalizarTextoCupomAtendente(
        `${item.nome || ""}
                        ${item.tipo || ""}`,
      );

      const categoria = normalizarTextoCupomAtendente(item.categoria || "");

      const precoAtual = Number(item.precoUnitario ?? item.preco ?? item.precoBase ?? 0);

      const quantidade = Number(item.quantidade ?? item.qtd ?? 1);

      let itemCombina = false;

      let descontoItem = 0;

      // =================================
      // CUPOM PARA GRUPO
      // =================================

      if (cupom.itemGeral === true) {
        const grupo = cupom.itemGeralTipo;

        if (grupo === "geral") {
          itemCombina = true;
        } else if (grupo === "industrial") {
          itemCombina = nomeItem.includes("industrial");
        } else if (grupo === "artesanal") {
          itemCombina = nomeItem.includes("artesanal") || nomeItem.includes("caseiro");
        } else if (grupo === "frango") {
          itemCombina = nomeItem.includes("frango") && !nomeItem.includes("+");
        } else if (grupo === "file") {
          itemCombina =
            !nomeItem.includes("+") &&
            (nomeItem.includes("mignon") ||
              nomeItem.includes("paulistinha") ||
              nomeItem.includes("paulistao"));
        } else if (grupo === "hotdog") {
          itemCombina =
            nomeItem.includes("hot dog") ||
            nomeItem.includes("prensado") ||
            nomeItem.includes("salsicha");
        } else if (grupo === "bebidas") {
          itemCombina = categoria.includes("bebida");
        } else if (grupo === "batatas") {
          itemCombina = categoria.includes("batata");
        } else if (grupo === "combos") {
          itemCombina = categoria.includes("combo");
        }

        // =============================
        // CALCULAR DESCONTO DO GRUPO
        // =============================

        if (itemCombina) {
          if (cupom.itemGeralModo === "valor") {
            descontoItem = Number(cupom.itemGeralValor || 0) * quantidade;
          } else if (cupom.itemGeralModo === "porcentagem") {
            descontoItem = precoAtual * (Number(cupom.itemGeralValor || 0) / 100) * quantidade;
          }
        }
      }

      // =================================
      // CUPOM PARA ITEM ESPECÍFICO
      // =================================
      else {
        const nomeCupom = normalizarTextoCupomAtendente(cupom.itemNome || "");

        const cupomIndustrial = nomeCupom.includes("industrial");

        const cupomArtesanal = nomeCupom.includes("artesanal") || nomeCupom.includes("caseiro");

        const nomeCupomBase = nomeCupom

          .replace("industrial", "")

          .replace("artesanal", "")

          .replace("caseiro", "")

          .trim();

        if (nomeItem.includes(nomeCupomBase)) {
          if (cupomIndustrial) {
            itemCombina = nomeItem.includes("industrial");
          } else if (cupomArtesanal) {
            itemCombina = nomeItem.includes("artesanal") || nomeItem.includes("caseiro");
          } else {
            itemCombina = true;
          }
        }

        if (itemCombina) {
          const precoPromo = Number(cupom.itemPrecoPromocional || 0);

          if (precoAtual > precoPromo) {
            descontoItem = (precoAtual - precoPromo) * quantidade;
          }
        }
      }

      if (itemCombina && descontoItem > 0) {
        desconto += descontoItem;

        itensElegiveis += quantidade;
      }
    });
  }

  // =========================================
  // SEGURANÇA
  // =========================================

  if (desconto < 0) {
    desconto = 0;
  }

  if (desconto > base) {
    desconto = base;
  }

  return {
    desconto,

    itensElegiveis,
  };
}

async function buscarCuponsElegiveisAtendente(valorBase, itens, clienteId = null) {
  const valor = Number(valorBase || 0);

  const snap = await db.collection("cuponsDesconto").where("ativo", "==", true).get();

  const cupons = [];

  snap.forEach((doc) => {
    const cupom = {
      id: doc.id,

      ...doc.data(),
    };

    if (cupom.clientesPermitidos && !cupom.clientesPermitidos.includes(String(clienteId || "")))
      return;

    // =========================
    // TAXA NÃO EXISTE
    // NO CONSUMO LOCAL
    // =========================

    if (cupom.tipo === "taxa") {
      return;
    }

    // =========================
    // PEDIDO MÍNIMO
    // =========================

    if (cupom.temPedidoMinimo === true) {
      const minimo = Number(cupom.pedidoMinimo || 0);

      if (valor < minimo) {
        return;
      }
    }

    // =========================
    // VER SE O CUPOM
    // REALMENTE DÁ DESCONTO
    // =========================

    const resultado = calcularDescontoCupomAtendente(
      cupom,

      valor,

      itens,
    );

    if (resultado.desconto <= 0) {
      return;
    }

    cupons.push({
      ...cupom,

      descontoCalculado: resultado.desconto,

      itensElegiveis: resultado.itensElegiveis,
    });
  });

  const disponiveis = [];
  for (const cupom of cupons) {
    try {
      await verificarDisponibilidadeCupomOperacao(cupom, cupom.id, clienteId);
      disponiveis.push(cupom);
    } catch {}
  }
  return disponiveis;
}

async function carregarPedidosRetiradaAtendente() {
  const area = document.getElementById("lista-pedidos-retirada-atendente");

  if (!area) {
    return;
  }
  const janela = obterJanelaAtualPedidosAtendente();

  // =========================
  // BUSCAR PEDIDOS
  // =========================

  const snap = await db.collection("pedidos").where("tipo", "==", "Retirada").get();

  const pedidos = [];

  snap.forEach((doc) => {
    const pedido = doc.data();

    // =========================
    // CANCELADO
    // =========================

    if (pedido.cancelado === true) {
      return;
    }

    // =========================
    // FINALIZADO
    // =========================

    if (pedido.status === "Finalizado") {
      return;
    }

    // =========================
    // JÁ FOI RETIRADO
    // =========================

    if (pedido.retirado === true) {
      return;
    }

    // =========================
    // SOMENTE TURNO ATUAL
    // =========================

    const dataPedido = Number(pedido.dataMs || 0);

    if (dataPedido < janela.inicioMs || dataPedido >= janela.fimMs) {
      return;
    }

    pedidos.push({
      id: doc.id,

      ...pedido,
    });
  });

  // =========================
  // MAIS NOVOS PRIMEIRO
  // =========================

  pedidos.sort((a, b) => Number(b.dataMs || 0) - Number(a.dataMs || 0));

  // =========================
  // NENHUM PEDIDO
  // =========================

  if (pedidos.length === 0) {
    area.innerHTML = "<p>Nenhum pedido em retirada.</p>";

    return;
  }

  // =========================
  // MONTAR LISTA
  // =========================

  area.innerHTML = pedidos
    .map((pedido) => {
      return `

                    <div
                        style="
                            margin-bottom:15px;
                            padding:12px;
                            border:1px solid #444;
                            border-radius:8px;
                        "
                    >

                        <strong>
                            Pedido #${pedido.numero || "-"}
                        </strong>


                        <br>


                        ${pedido.nome || "Cliente"}


                        <br><br>


                        Total:
                        R$ ${Number(pedido.valorTotal || 0).toFixed(2)}


                        <br>


                        Pagamento:
                        ${pedido.pagamento || "Não informado"}


                        <br><br>


                        <button
                            type="button"
                            onclick="
                                abrirMudancaTipoRetirada(
                                    '${pedido.id}'
                                )
                            "
                        >
                            🔄 Mudar tipo
                        </button>

                        <button
    type="button"
    onclick="
        marcarPedidoComoRetirado(
            '${pedido.id}',
            ${pedido.numero || 0}
        )
    "
>
    ✅ Retirado
</button>

                    </div>

                `;
    })
    .join("");
}
async function abrirMudancaTipoRetirada(pedidoId) {
  const area = document.getElementById("area-retirada-atendente");

  if (!area) {
    return;
  }

  const docPedido = await db.collection("pedidos").doc(pedidoId).get();

  if (!docPedido.exists) {
    alert("Pedido não encontrado.");

    return;
  }

  const pedido = docPedido.data();

  area.innerHTML = `

    <button
    type="button"
    onclick="
        voltarPedidosRetirada()
    "
>
    ⬅ Voltar
</button>


        <h3>
            🔄 Mudar tipo do pedido
        </h3>


        <p>
            <strong>
                Pedido #${pedido.numero || "-"}
            </strong>
        </p>


        <p>
            ${pedido.nome || "Cliente"}
        </p>


        <p>
            Tipo atual:
            <strong>
                Retirada
            </strong>
        </p>


        <hr>


        <button
            type="button"
            onclick="
                iniciarRetiradaParaConsumoLocal(
                    '${pedidoId}'
                )
            "
        >
            🍔 Consumo no Local
        </button>


        <button
            type="button"
            onclick="
                iniciarRetiradaParaEntrega(
                    '${pedidoId}'
                )
            "
        >
            🛵 Entrega
        </button>

    `;
}
function voltarPedidosRetirada() {
  const area = document.getElementById("area-retirada-atendente");

  if (!area) {
    return;
  }

  area.style.display = "none";

  area.innerHTML = "";

  abrirRetiradaAtendente();
}
async function iniciarRetiradaParaEntrega(pedidoId) {
  const area = document.getElementById("area-retirada-atendente");

  if (!area) {
    return;
  }

  const docPedido = await db.collection("pedidos").doc(pedidoId).get();

  if (!docPedido.exists) {
    alert("Pedido não encontrado.");

    return;
  }

  const pedido = docPedido.data();

  area.innerHTML = `

      <button
    type="button"
    onclick="
        abrirMudancaTipoRetirada(
            '${pedidoId}'
        )
    "
>
    ⬅ Voltar
</button>


        <h3>
            🛵 Alterar para Entrega
        </h3>


        <p>
            <strong>
                Pedido #${pedido.numero || "-"}
            </strong>
        </p>


        <p>
            Cliente:
            ${pedido.nome || "Cliente"}
        </p>


        <hr>


        <label>
            Endereço
        </label>

        <br>

        <textarea
            id="endereco-mudanca-entrega"
            placeholder="Rua, número, bairro, complemento..."
        >${pedido.endereco || ""}</textarea>


        <br><br>


        <label>
            Taxa de entrega
        </label>

        <br>

        R$

        <input
            type="number"
            id="taxa-mudanca-entrega"
            min="0"
            step="0.01"
            value="${Number(pedido.taxaEntrega || 0).toFixed(2)}"
        >


        <br><br>


        <button
            type="button"
            onclick="
                confirmarRetiradaParaEntrega(
                    '${pedidoId}'
                )
            "
        >
            ✅ Confirmar alteração
        </button>

    `;
}
async function confirmarRetiradaParaEntrega(pedidoId) {
  const endereco = document.getElementById("endereco-mudanca-entrega")?.value.trim() || "";

  const taxaEntrega = Number(document.getElementById("taxa-mudanca-entrega")?.value || 0);

  if (!endereco) {
    alert("Informe o endereço da entrega.");

    return;
  }

  const refPedido = db.collection("pedidos").doc(pedidoId);

  const docPedido = await refPedido.get();

  if (!docPedido.exists) {
    alert("Pedido não encontrado.");

    return;
  }

  const pedido = docPedido.data();

  // =========================
  // CALCULAR NOVO TOTAL
  // =========================

  const subtotal = Number(
    pedido.subtotal || Number(pedido.valorTotal || 0) - Number(pedido.taxaEntrega || 0),
  );

  const novoTotal = subtotal + taxaEntrega;

  // =========================
  // ATUALIZAR
  // =========================

  await refPedido.update({
    tipo: "Entrega",

    endereco,

    taxaEntrega,

    valorTotal: novoTotal,

    // Histórico da alteração

    tipoOriginal: pedido.tipoOriginal || "Retirada",

    alteradoPorAtendente: true,

    tipoAlteradoEm: new Date().toISOString(),

    tipoAlteradoEmMs: Date.now(),
  });

  alert("Pedido alterado para Entrega.");

  // =========================
  // VOLTAR PARA RETIRADA
  // =========================

  voltarPedidosRetirada();
}
function iniciarRetiradaParaConsumoLocal(pedidoId) {
  abrirSelecaoMesaPedidoExistente(pedidoId);
}

async function abrirSelecaoMesaPedidoExistente(pedidoId) {
  const area = document.getElementById("area-retirada-atendente");

  if (!area) {
    return;
  }

  const docPedido = await db.collection("pedidos").doc(pedidoId).get();

  if (!docPedido.exists) {
    alert("Pedido não encontrado.");

    return;
  }

  const pedido = docPedido.data();

  const snapMesas = await db.collection("mesas").orderBy("numero").get();

  let htmlMesas = "";

  snapMesas.forEach((doc) => {
    const mesa = doc.data();

    htmlMesas += `

            <button
                type="button"
                onclick="
                    selecionarMesaPedidoExistente(
                        '${pedidoId}',
                        '${doc.id}'
                    )
                "
                style="
                    margin:5px;
                    background:
                        ${mesa.ocupada ? "#ff8080" : "#90ee90"};
                "
            >
                Mesa ${mesa.numero}
            </button>

        `;
  });

  area.innerHTML = `

        <button
    type="button"
    onclick="
        abrirMudancaTipoRetirada(
            '${pedidoId}'
        )
    "
>
    ⬅ Voltar
</button>


        <h3>
            🍔 Consumo no Local
        </h3>


        <p>
            <strong>
                Pedido #${pedido.numero || "-"}
            </strong>
        </p>


        <p>
            ${pedido.nome || "Cliente"}
        </p>


        <hr>


        <h4>
            Escolha a mesa
        </h4>


        ${htmlMesas}

    `;
}
async function selecionarMesaPedidoExistente(pedidoId, mesaId) {
  const area = document.getElementById("area-retirada-atendente");

  if (!area) {
    return;
  }

  const mesaDoc = await db.collection("mesas").doc(mesaId).get();

  if (!mesaDoc.exists) {
    alert("Mesa não encontrada.");

    return;
  }

  const mesa = mesaDoc.data();

  // =========================
  // COMANDAS ABERTAS DA MESA
  // =========================

  const snapComandas = await db
    .collection("comandas")
    .where("mesa", "==", mesa.numero)
    .where("status", "==", "Aberta")
    .get();

  let htmlComandas = "";

  snapComandas.forEach((doc) => {
    const comanda = doc.data();

    htmlComandas += `

            <button
                type="button"
                onclick="
                    vincularPedidoComandaExistente(
                        '${pedidoId}',
                        '${mesaId}',
                        '${doc.id}'
                    )
                "
            >
                👤 ${comanda.cliente}
            </button>

            <br><br>

        `;
  });

  area.innerHTML = `

      <button
    type="button"
    onclick="
        abrirSelecaoMesaPedidoExistente(
            '${pedidoId}'
        )
    "
>
    ⬅ Voltar
</button>


        <h3>
            Mesa ${mesa.numero}
        </h3>


        <p>
            Onde deseja colocar este pedido?
        </p>


        <hr>


        ${
          htmlComandas
            ? `
                    <h4>
                        Comandas abertas
                    </h4>

                    ${htmlComandas}

                    <hr>
                `
            : `
                    <p>
                        Nenhuma comanda aberta nesta mesa.
                    </p>
                `
        }


        <button
            type="button"
            onclick="
                vincularPedidoNovaComanda(
                    '${pedidoId}',
                    '${mesaId}'
                )
            "
        >
            ➕ Nova Comanda
        </button>

    `;
}
function limparTipoDoNomePedido(nome) {
  return String(nome || "")
    .replace(/\s*\((artesanal|industrial|frango)\)\s*$/i, "")
    .trim();
}

function descobrirTipoNomePedido(nome, tipoAtual = "") {
  if (tipoAtual) {
    return String(tipoAtual).toLowerCase();
  }

  const texto = String(nome || "").toLowerCase();

  if (texto.includes("(industrial)")) {
    return "industrial";
  }

  if (texto.includes("(frango)")) {
    return "frango";
  }

  if (texto.includes("(artesanal)")) {
    return "artesanal";
  }

  return "";
}
async function localizarProdutoIdPedido(item) {
  if (item.produtoId) {
    return item.produtoId;
  }

  const nomeBase = limparTipoDoNomePedido(item.nome);

  // =========================
  // PRIMEIRO TENTA EXATO
  // =========================

  const snapExato = await db.collection("produtos").where("nome", "==", nomeBase).limit(1).get();

  if (!snapExato.empty) {
    return snapExato.docs[0].id;
  }

  // =========================
  // SEGUNDA TENTATIVA
  // IGNORA MAIÚSCULAS
  // =========================

  const snapProdutos = await db.collection("produtos").get();

  const nomeComparacao = nomeBase.toLowerCase().trim();

  const encontrado = snapProdutos.docs.find((doc) => {
    const produto = doc.data();

    return (
      String(produto.nome || "")
        .toLowerCase()
        .trim() === nomeComparacao
    );
  });

  return encontrado ? encontrado.id : null;
}
async function prepararItensPedidoParaComanda(itensPedido, pedidoId, numeroPedido = null) {
  return await Promise.all(
    (itensPedido || []).map(async (item) => {
      // =========================
      // NORMALIZAR ITEM DO SITE
      // =========================

      const produtoId = await localizarProdutoIdPedido(item);

      const tipo = descobrirTipoNomePedido(item.nome, item.tipo);

      const nomeBase = limparTipoDoNomePedido(item.nome);

      const categoria = String(item.categoria || "").toLowerCase();

      const observacao = item.observacao ?? item.obs ?? "";

      const quantidade = Number(item.quantidade || item.qtd || 1);

      const precoUnitario = Number(item.precoUnitario ?? item.preco ?? item.precoBase ?? 0);

      // =========================
      // VALOR DO PRODUTO
      // SEM MOLHOS PAGOS
      // =========================

      let subtotalProduto;

      if (item.subtotal !== undefined && item.subtotal !== null) {
        subtotalProduto = Number(item.subtotal || 0);
      } else {
        subtotalProduto = precoUnitario * quantidade;
      }

      // =========================
      // CONSUMO NO LOCAL
      // NÃO LEVA MOLHOS INDIVIDUAIS
      // =========================

      return {
        ...item,
        pedidoOrigemId: pedidoId || item.pedidoOrigemId || null,

        pedidoOrigemNumero: numeroPedido ?? item.pedidoOrigemNumero ?? null,

        origemPedidoExistente: true,
        produtoId,
        nome: nomeBase,

        tipo,

        categoria,

        observacao,

        quantidade,

        precoUnitario,

        subtotal: subtotalProduto,

        // Guardamos o valor puro
        // do produto/adicionais.

        subtotalProduto: subtotalProduto,

        // Molhos individuais são
        // removidos porque na mesa
        // são servidos os tubos.

        molhosGratis: [],

        molhosPagos: [],

        totalMolhosPagos: 0,

        origemPedidoExistente: true,
      };
    }),
  );
}
async function vincularPedidoComandaExistente(pedidoId, mesaId, comandaId) {
  const confirmar = await confirmarOperacao("Adicionar este pedido à comanda escolhida?");

  if (!confirmar) {
    return;
  }

  const refPedido = db.collection("pedidos").doc(pedidoId);

  const refComanda = db.collection("comandas").doc(comandaId);

  const [docPedido, docComanda, docMesa] = await Promise.all([
    refPedido.get(),

    refComanda.get(),

    db.collection("mesas").doc(mesaId).get(),
  ]);

  if (!docPedido.exists || !docComanda.exists || !docMesa.exists) {
    alert("Não foi possível localizar pedido, comanda ou mesa.");

    return;
  }

  const pedido = docPedido.data();

  const comanda = docComanda.data();

  const mesa = docMesa.data();

  // =========================
  // EVITAR DUPLICAÇÃO
  // =========================

  if (pedido.vinculadoComanda === true) {
    alert("Este pedido já foi vinculado a uma comanda.");

    return;
  }

  const itensPedido = await prepararItensPedidoParaComanda(
    pedido.itens || [],

    pedidoId,

    pedido.numero || null,
  );

  const itens = [...(comanda.itens || []), ...itensPedido];

  const novoTotal = itens.reduce((total, item) => {
    return total + Number(item.subtotal || 0);
  }, 0);

  // =========================
  // ATUALIZAR COMANDA
  // =========================

  await refComanda.update({
    itens,

    valorTotal: novoTotal,
  });

  // =========================
  // MARCAR MESA OCUPADA
  // =========================

  await db.collection("mesas").doc(mesaId).update({
    ocupada: true,
  });

  // =========================
  // ATUALIZAR PEDIDO ORIGINAL
  // =========================

  await refPedido.update({
    itens: itensPedido,

    valorTotal: itensPedido.reduce((total, item) => total + Number(item.subtotal || 0), 0),

    taxaEntrega: 0,
    tipoOriginal: pedido.tipoOriginal || pedido.tipo || "Retirada",

    tipo: "Consumo no Local",

    vinculadoComanda: true,

    comandaId,

    mesa: mesa.numero,

    alteradoPorAtendente: true,

    tipoAlteradoEm: new Date().toISOString(),

    tipoAlteradoEmMs: Date.now(),
  });

  alert("Pedido vinculado à comanda.");

  await abrirComandaVinculadaPedido(mesaId, comandaId);
}

async function abrirComandaVinculadaPedido(mesaId, comandaId) {
  // =========================
  // FECHAR RETIRADA
  // =========================

  const areaRetirada = document.getElementById("area-retirada-atendente");

  if (areaRetirada) {
    areaRetirada.style.display = "none";

    areaRetirada.innerHTML = "";
  }

  // =========================
  // ABRIR CONSUMO LOCAL
  // =========================

  const areaConsumo = document.getElementById("area-consumo-local");

  if (areaConsumo) {
    areaConsumo.style.display = "block";

    areaConsumo.dataset.tela = "consumo-local";
  }

  await areaConsumoLocalRecarregar();

  await abrirMesaAtendente(mesaId);

  await abrirComandaVisual(comandaId);
}
async function vincularPedidoNovaComanda(pedidoId, mesaId) {
  const refPedido = db.collection("pedidos").doc(pedidoId);

  const [docPedido, mesaDoc] = await Promise.all([
    refPedido.get(),

    db.collection("mesas").doc(mesaId).get(),
  ]);

  if (!docPedido.exists || !mesaDoc.exists) {
    alert("Pedido ou mesa não encontrado.");

    return;
  }

  const pedido = docPedido.data();

  const mesa = mesaDoc.data();

  // =========================
  // EVITAR DUPLICAÇÃO
  // =========================

  if (pedido.vinculadoComanda === true) {
    alert("Este pedido já foi vinculado a uma comanda.");

    return;
  }

  // =========================
  // PREPARAR ITENS
  // =========================

  const itens = await prepararItensPedidoParaComanda(
    pedido.itens || [],

    pedidoId,

    pedido.numero || null,
  );

  const valorTotal = itens.reduce((total, item) => {
    return total + Number(item.subtotal || 0);
  }, 0);

  const atendenteId = localStorage.getItem("atendenteId");

  const atendenteNome = localStorage.getItem("atendenteNome");

  // =========================
  // CRIAR NOVA COMANDA
  // =========================

  const novaComanda = await db.collection("comandas").add({
    cliente: pedido.nome || "Cliente",

    mesa: mesa.numero,

    status: "Aberta",

    atendenteId,

    atendenteNome,

    criadoEm: Date.now(),

    itens,

    valorTotal,

    pedidoOrigemId: pedidoId,

    pedidoOrigemNumero: pedido.numero || null,
  });

  // =========================
  // MARCAR MESA OCUPADA
  // =========================

  await db.collection("mesas").doc(mesaId).update({
    ocupada: true,
  });

  // =========================
  // ATUALIZAR PEDIDO ORIGINAL
  // =========================

  await refPedido.update({
    itens: itens,

    valorTotal: valorTotal,

    taxaEntrega: 0,

    tipoOriginal: pedido.tipoOriginal || pedido.tipo || "Retirada",

    tipo: "Consumo no Local",

    vinculadoComanda: true,

    comandaId: novaComanda.id,

    mesa: mesa.numero,

    alteradoPorAtendente: true,

    tipoAlteradoEm: new Date().toISOString(),

    tipoAlteradoEmMs: Date.now(),
  });

  alert("Nova comanda criada com o pedido.");

  // =========================
  // ABRIR NOVA COMANDA
  // =========================

  await abrirComandaVinculadaPedido(mesaId, novaComanda.id);
}
async function sincronizarPedidoOrigemDaComanda(comandaId, pedidoId) {
  if (!comandaId || !pedidoId) {
    return;
  }

  // =========================
  // BUSCAR COMANDA ATUAL
  // =========================

  const docComanda = await db.collection("comandas").doc(comandaId).get();

  if (!docComanda.exists) {
    return;
  }

  const comanda = docComanda.data();

  // =========================
  // SOMENTE ITENS DESTE PEDIDO
  // =========================

  const itensPedido = (comanda.itens || []).filter((item) => item.pedidoOrigemId === pedidoId);

  // =========================
  // NOVO TOTAL DO PEDIDO
  // =========================

  const novoTotal = itensPedido.reduce((total, item) => {
    return total + Number(item.subtotal || 0);
  }, 0);

  const refPedido = db.collection("pedidos").doc(pedidoId);

  const docPedido = await refPedido.get();

  if (!docPedido.exists) {
    return;
  }

  // =========================
  // SINCRONIZAR
  // =========================

  await refPedido.update({
    itens: itensPedido,

    subtotal: novoTotal,

    valorTotal: novoTotal,

    taxaEntrega: 0,

    sincronizadoComComanda: true,

    sincronizadoComComandaEm: new Date().toISOString(),

    sincronizadoComComandaEmMs: Date.now(),
  });
}

async function marcarPedidoComoRetirado(pedidoId, numeroPedido) {
  const confirmar = await confirmarOperacao(`Confirmar retirada do pedido #${numeroPedido}?`);

  if (!confirmar) {
    return;
  }

  try {
    await db.collection("pedidos").doc(pedidoId).update({
      retirado: true,

      retiradoEm: new Date().toISOString(),

      retiradoEmMs: Date.now(),
    });

    // =========================
    // ATUALIZAR LISTA
    // =========================

    await carregarPedidosRetiradaAtendente();
  } catch (erro) {
    console.error("Erro ao marcar pedido como retirado:", erro);

    alert("Não foi possível marcar o pedido como retirado.");
  }
}
function criarNovoPedidoRetirada() {
  const area = document.getElementById("area-retirada-atendente");

  if (!area) {
    return;
  }

  area.innerHTML = `

        <button
            type="button"
            onclick="
                voltarListaRetirada()
            "
        >
            ⬅ Voltar
        </button>


        <h3>
            📦 Novo Pedido de Retirada
        </h3>


        <label>
            Nome do cliente
        </label>

        <br>

        <input
            type="text"
            id="retirada-nome-cliente"
            placeholder="Nome do cliente"
        >


        <br><br>


        <label>
            Telefone
        </label>

        <br>

        <input
            type="text"
            id="retirada-telefone"
            placeholder="Telefone"
        >


        <br><br>


        <button
            type="button"
            onclick="
                continuarNovoPedidoRetirada()
            "
        >
            Continuar
        </button>

    `;
}
function voltarListaRetirada() {
  const area = document.getElementById("area-retirada-atendente");

  if (!area) {
    return;
  }

  area.style.display = "none";

  area.innerHTML = "";

  abrirRetiradaAtendente();
}
function continuarNovoPedidoRetirada() {
  const nome = document.getElementById("retirada-nome-cliente")?.value.trim() || "";

  const telefone = document.getElementById("retirada-telefone")?.value.trim() || "";

  if (!nome) {
    alert("Informe o nome do cliente.");

    return;
  }

  pedidoRetiradaAtual = {
    nome,

    telefone,

    itens: [],

    formaPagamento: "",
  };

  abrirMontagemPedidoRetirada();
}
function abrirMontagemPedidoRetirada() {
  const area = document.getElementById("area-retirada-atendente");

  if (!area || !pedidoRetiradaAtual) {
    return;
  }

  let htmlItens = "<p>Nenhum item adicionado.</p>";

  if (pedidoRetiradaAtual.itens.length > 0) {
    htmlItens = pedidoRetiradaAtual.itens
      .map((item, index) => {
        const htmlTipo = item.tipo
          ? `
                            <br>
                            Tipo: ${item.tipo}
                        `
          : "";

        let htmlAdicionais = "";

        if (item.adicionais && item.adicionais.length > 0) {
          htmlAdicionais = `

                        <br>

                        <small>
                            ➕ ${item.adicionais
                              .map((adicional) => {
                                return `${adicional.qtd} ${adicional.nome}`;
                              })
                              .join(" + ")}
                        </small>

                    `;
        }

        const htmlObservacao = item.observacao
          ? `

                            <br>

                            <small>
                                📝 ${item.observacao}
                            </small>

                        `
          : "";

        // =========================
        // COMBO
        // =========================

        let htmlCombo = "";

        if (item.categoria === "combos" && item.lanchesCombo && item.lanchesCombo.length > 0) {
          const personalizados = item.lanchesCombo.filter(
            (lanche) =>
              (lanche.adicionais || []).length > 0 || (lanche.observacao || "").trim() !== "",
          );

          if (personalizados.length > 0) {
            htmlCombo = `

                            <div
                                style="
                                    margin-top:8px;
                                    margin-left:10px;
                                "
                            >

                                ${personalizados
                                  .map((lanche) => {
                                    const adicionais = (lanche.adicionais || [])
                                      .map((adicional) => {
                                        return `${adicional.qtd} ${adicional.nome}`;
                                      })
                                      .join(" + ");

                                    return `

                                            <div
                                                style="
                                                    margin-bottom:5px;
                                                "
                                            >

                                                <strong>
                                                    Lanche ${lanche.numero}
                                                </strong>

                                                ${
                                                  adicionais
                                                    ? `
                                                            <br>
                                                            <small>
                                                                ➕ ${adicionais}
                                                            </small>
                                                        `
                                                    : ""
                                                }

                                                ${
                                                  lanche.observacao
                                                    ? `
                                                            <br>
                                                            <small>
                                                                📝 ${lanche.observacao}
                                                            </small>
                                                        `
                                                    : ""
                                                }

                                            </div>

                                        `;
                                  })
                                  .join("")}

                            </div>

                        `;
          }
        }

        // =========================
        // MOLHOS
        // =========================

        let htmlMolhos = "";

        if (item.molhosGratis && item.molhosGratis.length > 0) {
          const configurados = item.molhosGratis.filter((molho) => molho.tipo !== "semmolho");

          if (configurados.length > 0) {
            htmlMolhos += `

                            <br>

                            <small>
                                🍶 Molhos:
                                <br>

                                ${configurados
                                  .map((molho) => {
                                    return `#${molho.unidade}: ${molho.texto}`;
                                  })
                                  .join("<br>")}

                            </small>

                        `;
          }
        }

        if (item.molhosPagos && item.molhosPagos.length > 0) {
          htmlMolhos += `

                        <br>

                        <small>
                            💰 Molhos extras:
                            ${item.molhosPagos
                              .map((molho) => {
                                return `${molho.qtd} ${molho.nome}`;
                              })
                              .join(" + ")}
                        </small>

                    `;
        }

        const podeTerMolhos =
          item.categoria === "lanches" ||
          item.categoria === "combos" ||
          item.categoria === "batatas";

        const htmlBotaoMolhos = podeTerMolhos
          ? `

                            <br><br>

                            <button
                                type="button"
                                onclick="
                                    abrirMolhosPedidoRetirada(
                                        ${index}
                                    )
                                "
                            >
                                🍶 Configurar Molhos
                            </button>

                        `
          : "";

        return `

                    <div
                        style="
                            margin-bottom:12px;
                            padding:10px;
                            border:1px solid #444;
                            border-radius:8px;
                        "
                    >

                        <strong>
                            ${item.quantidade}
                            ${item.nome}
                        </strong>

                        ${htmlTipo}

                        ${htmlAdicionais}

                        ${htmlObservacao}

                        ${htmlCombo}

                        ${htmlMolhos}

                        ${htmlBotaoMolhos}

                        <br><br>

                        <strong>
                            R$ ${Number(item.subtotal || 0).toFixed(2)}
                        </strong>

                        <br><br>


                        <button
                            type="button"
                            onclick="
                                editarItemPedidoRetirada(
                                    ${index}
                                )
                            "
                        >
                            ✏️ Editar
                        </button>


                        <button
                            type="button"
                            onclick="
                                excluirItemPedidoRetirada(
                                    ${index}
                                )
                            "
                        >
                            🗑️ Excluir
                        </button>

                    </div>

                `;
      })
      .join("");
  }

  const subtotalPedido = pedidoRetiradaAtual.itens.reduce((total, item) => {
    return total + Number(item.subtotal || 0) + Number(item.totalMolhosPagos || 0);
  }, 0);
  area.innerHTML = `

        <button
            type="button"
            onclick="
                criarNovoPedidoRetirada()
            "
        >
            ⬅ Voltar
        </button>


        <h3>
            📦 Novo Pedido de Retirada
        </h3>


        <p>
            <strong>Cliente:</strong>
            ${pedidoRetiradaAtual.nome}
        </p>


        ${
          pedidoRetiradaAtual.telefone
            ? `

                    <p>
                        <strong>Telefone:</strong>
                        ${pedidoRetiradaAtual.telefone}
                    </p>

                `
            : ""
        }


        <hr>


        <h4>
            Itens do pedido
        </h4>


        <div
    id="itens-pedido-retirada"
>
    ${htmlItens}
</div>


        <button
            type="button"
            onclick="
                abrirProdutosPedidoRetirada()
            "
        >
            ➕ Adicionar Item
        </button>


        <hr>


        <p>
    Subtotal:
    <strong>
        R$ ${subtotalPedido.toFixed(2)}
    </strong>
</p>
<hr>


<h3>
    Forma de pagamento
</h3>


<label>
    <input
        type="radio"
        name="pagamento-retirada-atendente"
        value="Pix"
        ${pedidoRetiradaAtual.formaPagamento === "Pix" ? "checked" : ""}
        onchange="
            pedidoRetiradaAtual.formaPagamento =
                this.value
        "
    >
    Pix
</label>


<br><br>


<label>
    <input
        type="radio"
        name="pagamento-retirada-atendente"
        value="Dinheiro"
        ${pedidoRetiradaAtual.formaPagamento === "Dinheiro" ? "checked" : ""}
        onchange="
            pedidoRetiradaAtual.formaPagamento =
                this.value
        "
    >
    Dinheiro
</label>


<br><br>


<label>
    <input
        type="radio"
        name="pagamento-retirada-atendente"
        value="Débito"
        ${pedidoRetiradaAtual.formaPagamento === "Débito" ? "checked" : ""}
        onchange="
            pedidoRetiradaAtual.formaPagamento =
                this.value
        "
    >
    Débito
</label>


<br><br>


<label>
    <input
        type="radio"
        name="pagamento-retirada-atendente"
        value="Crédito"
        ${pedidoRetiradaAtual.formaPagamento === "Crédito" ? "checked" : ""}
        onchange="
            pedidoRetiradaAtual.formaPagamento =
                this.value
        "
    >
    Crédito
</label>


<br><br>


<button
    type="button"
    onclick="
        salvarPedidoRetiradaAtendente()
    "
>
    ✅ Criar Pedido
</button>

    `;
}
async function salvarPedidoRetiradaAtendente() {
  if (!pedidoRetiradaAtual) {
    alert("Nenhum pedido em andamento.");

    return;
  }

  // =========================
  // VALIDAR ITENS
  // =========================

  if (!pedidoRetiradaAtual.itens || pedidoRetiradaAtual.itens.length === 0) {
    alert("Adicione pelo menos um item.");

    return;
  }

  // =========================
  // PAGAMENTO
  // =========================

  const pagamentoSelecionado = document.querySelector(
    'input[name="pagamento-retirada-atendente"]:checked',
  );

  if (!pagamentoSelecionado) {
    alert("Informe a forma de pagamento.");

    return;
  }

  const pagamento = pagamentoSelecionado.value;

  pedidoRetiradaAtual.formaPagamento = pagamento;

  // =========================
  // TOTAL
  // =========================

  const subtotal = pedidoRetiradaAtual.itens.reduce((total, item) => {
    return total + Number(item.subtotal || 0) + Number(item.totalMolhosPagos || 0);
  }, 0);

  const valorTotal = subtotal;

  // =========================
  // GERAR NÚMERO DO PEDIDO
  // =========================

  const contadorRef = await prepararContadorPedidoOperacao(db);

  let numeroPedido;

  try {
    numeroPedido = await db.runTransaction(async (transaction) => {
      const doc = await transaction.get(contadorRef);

      let novoNumero = 1;

      if (doc.exists) {
        novoNumero = Number(doc.data().ultimoNumero || 0) + 1;
      }

      transaction.set(
        contadorRef,

        {
          ultimoNumero: novoNumero,
        },
      );

      return novoNumero;
    });
  } catch (erro) {
    console.error("Erro ao gerar número do pedido:", erro);

    alert("Não foi possível gerar o número do pedido.");

    return;
  }

  // =========================
  // MONTAR PEDIDO
  // =========================

  const pedido = {
    numero: numeroPedido,
    numeroDia: numeroPedido,
    diaOperacional: contadorRef.id.replace("contadorPedidos_", ""),

    nome: pedidoRetiradaAtual.nome,

    telefone: pedidoRetiradaAtual.telefone || "",

    itens: pedidoRetiradaAtual.itens,

    subtotal: subtotal,

    // Retirada nunca possui taxa

    taxaEntrega: 0,

    valorTotal: valorTotal,

    tipo: "Retirada",

    pagamento: pagamento,

    origem: "atendente",

    status: "Novo",

    data: new Date().toISOString(),

    dataMs: Date.now(),
  };

  // =========================
  // SALVAR NO FIREBASE
  // =========================

  try {
    if (pedido.tipo === "Entrega")
      pedido.numeroEntregaDia = await reservarNumeroEntregaOperacao(db);
    const docRef = await db.collection("pedidos").add(pedido);

    await docRef.update({
      id: docRef.id,
    });

    alert(`Pedido #${numeroPedido} criado com sucesso.`);

    // =========================
    // LIMPAR ESTADOS
    // =========================

    pedidoRetiradaAtual = null;

    indiceItemRetiradaEmEdicao = null;

    contextoPainelProduto = "comanda";

    contextoMolhosPedido = "entrega";

    // =========================
    // VOLTAR PARA RETIRADA
    // =========================

    const area = document.getElementById("area-retirada-atendente");

    if (area) {
      area.style.display = "none";

      area.innerHTML = "";
    }

    await abrirCentralOperacao("Retirada", docRef.id);
  } catch (erro) {
    console.error("Erro ao salvar pedido de retirada:", erro);

    alert("Erro ao criar o pedido.");
  }
}
async function abrirProdutosPedidoRetirada() {
  const area = document.getElementById("area-retirada-atendente");

  if (!area || !pedidoRetiradaAtual) {
    return;
  }

  area.innerHTML = `

        <button
            type="button"
            onclick="
                abrirMontagemPedidoRetirada()
            "
        >
            ⬅ Voltar para Pedido
        </button>


        <h3>
            ➕ Adicionar Item
        </h3>


        <button
            type="button"
            onclick="
                listarProdutosPedidoRetirada(
                    'lanches'
                )
            "
        >
            🍔 Lanches
        </button>


        <button
            type="button"
            onclick="
                listarProdutosPedidoRetirada(
                    'combos'
                )
            "
        >
            🎁 Combos
        </button>


        <button
            type="button"
            onclick="
                listarProdutosPedidoRetirada(
                    'batatas'
                )
            "
        >
            🍟 Batatas
        </button>


        <button
            type="button"
            onclick="
                listarProdutosPedidoRetirada(
                    'bebidas'
                )
            "
        >
            🥤 Bebidas
        </button>


        <hr>


        <div
            id="lista-produtos-pedido-retirada"
        >

            <p>
                Escolha uma categoria.
            </p>

        </div>

    `;
}
async function listarProdutosPedidoRetirada(categoria) {
  const areaLista = document.getElementById("lista-produtos-pedido-retirada");

  if (!areaLista) {
    return;
  }

  areaLista.innerHTML = "<p>Carregando...</p>";

  const snap = await db.collection("produtos").where("categoria", "==", categoria).get();

  if (snap.empty) {
    areaLista.innerHTML = "<p>Nenhum produto encontrado.</p>";

    return;
  }

  let html = "";

  snap.forEach((doc) => {
    const produto = doc.data();
    if (produto.ativo === false || produto.esgotado) return;

    const preco = Number(produto.preco || 0);

    html += `

            <div
                style="
                    margin-bottom:12px;
                    padding:10px;
                    border:1px solid #444;
                    border-radius:8px;
                "
            >

                <strong>
                    ${produto.nome}
                </strong>

                <br>

                R$ ${preco.toFixed(2)}

                <br><br>


                <button
                    type="button"
                    onclick="
                        abrirProdutoPedidoRetirada(
                            '${doc.id}'
                        )
                    "
                >
                    Adicionar
                </button>

            </div>

        `;
  });

  areaLista.innerHTML = html;
}
async function abrirProdutoPedidoRetirada(produtoId) {
  contextoPainelProduto = "retirada";

  await abrirPainelProduto(null, produtoId);
}
function criarNovoPedidoEntrega() {
  const area = document.getElementById("area-entrega-atendente");

  if (!area) {
    return;
  }

  area.innerHTML = `

        <button
            type="button"
            onclick="
                voltarListaEntregas()
            "
        >
            ⬅ Voltar
        </button>


        <h3>
            🛵 Novo Pedido de Entrega
        </h3>


        <label>
            Nome do cliente
        </label>

        <br>

        <input
            type="text"
            id="entrega-nome-cliente"
            placeholder="Nome do cliente"
        >


        <br><br>


        <label>
            Telefone
        </label>

        <br>

        <input
            type="text"
            id="entrega-telefone"
            placeholder="Telefone"
        >


        <br><br>


        <label>
            Endereço
        </label>

        <br>

        <textarea
            id="entrega-endereco"
            placeholder="Rua, número, bairro, complemento..."
        ></textarea>
        <div class="financeiro-form">
            <label>Condomínio<select id="entrega-condominio"><option>Não</option><option>Sim</option></select></label>
            <label>Precisa de CNH?<select id="entrega-cnh"><option>Não</option><option>Sim</option></select></label>
            <label>Taxa de entrega (R$)<input id="entrega-taxa-manual" type="number" min="0" step="0.01" value="0" inputmode="decimal"></label>
        </div>


        <br><br>


        <button
            type="button"
            onclick="
                continuarNovoPedidoEntrega()
            "
        >
            Continuar
        </button>

    `;
}
function continuarNovoPedidoEntrega() {
  // =========================
  // PEGAR DADOS
  // =========================

  const nome = document.getElementById("entrega-nome-cliente")?.value.trim() || "";

  const telefone = document.getElementById("entrega-telefone")?.value.trim() || "";

  const endereco = document.getElementById("entrega-endereco")?.value.trim() || "";

  // =========================
  // VALIDAR
  // =========================

  if (!nome) {
    alert("Informe o nome do cliente.");

    return;
  }

  if (!endereco) {
    alert("Informe o endereço da entrega.");

    return;
  }

  // =========================
  // GUARDAR TEMPORARIAMENTE
  // =========================

  pedidoEntregaAtual = {
    nome,

    telefone,

    endereco,
    condominio: document.getElementById("entrega-condominio")?.value || "Não",
    cnh: document.getElementById("entrega-cnh")?.value || "Não",
    localizacao: document.getElementById("entrega-localizacao")?.value.trim() || "",

    itens: [],

    taxaEntrega: Math.max(0, Number(document.getElementById("entrega-taxa-manual")?.value || 0)),

    formaPagamento: "",
  };

  // =========================
  // ABRIR MONTAGEM
  // =========================

  abrirMontagemPedidoEntrega();
}
function abrirMontagemPedidoEntrega() {
  const area = document.getElementById("area-entrega-atendente");

  if (!area || !pedidoEntregaAtual) {
    return;
  }
  let htmlItens = "<p>Nenhum item adicionado.</p>";

  if (pedidoEntregaAtual.itens.length > 0) {
    htmlItens = pedidoEntregaAtual.itens
      .map((item, index) => {
        // =========================
        // TIPO
        // =========================

        const htmlTipo = item.tipo
          ? `
                        <br>
                        Tipo: ${item.tipo}
                    `
          : "";

        // =========================
        // ADICIONAIS PRODUTO NORMAL
        // =========================

        let htmlAdicionais = "";

        if (item.adicionais && item.adicionais.length > 0) {
          htmlAdicionais = `

                    <br>

                    <small>
                        ➕ ${item.adicionais
                          .map((adicional) => {
                            return `${adicional.qtd} ${adicional.nome}`;
                          })
                          .join(" + ")}
                    </small>

                `;
        }

        // =========================
        // OBSERVAÇÃO PRODUTO NORMAL
        // =========================

        const htmlObservacao = item.observacao
          ? `

                        <br>

                        <small>
                            📝 ${item.observacao}
                        </small>

                    `
          : "";

        // =========================
        // RESUMO DOS MOLHOS
        // =========================

        let htmlMolhos = "";

        if (item.molhosGratis && item.molhosGratis.length > 0) {
          const configurados = item.molhosGratis.filter((molho) => molho.tipo !== "semmolho");

          if (configurados.length > 0) {
            htmlMolhos += `

            <br>

            <small>
                🍶 Molhos:
                <br>

                ${configurados
                  .map((molho) => {
                    return `#${molho.unidade}: ${molho.texto}`;
                  })
                  .join("<br>")}

            </small>

        `;
          }
        }

        if (item.molhosPagos && item.molhosPagos.length > 0) {
          htmlMolhos += `

        <br>

        <small>
            💰 Molhos extras:
            ${item.molhosPagos
              .map((molho) => {
                return `${molho.qtd} ${molho.nome}`;
              })
              .join(" + ")}
        </small>

    `;
        }
        // =========================
        // BOTÃO DE MOLHOS
        // =========================

        const podeTerMolhos =
          item.categoria === "lanches" ||
          item.categoria === "combos" ||
          item.categoria === "batatas";

        const htmlBotaoMolhos = podeTerMolhos
          ? `

            <br><br>

            <button
                type="button"
                onclick="
                    abrirMolhosPedidoEntrega(
                        ${index}
                    )
                "
            >
                🍶 Configurar Molhos
            </button>

        `
          : "";

        // =========================
        // PERSONALIZAÇÃO DO COMBO
        // =========================

        let htmlCombo = "";

        if (item.categoria === "combos" && item.lanchesCombo && item.lanchesCombo.length > 0) {
          const lanchesPersonalizados = item.lanchesCombo.filter((lanche) => {
            return (lanche.adicionais || []).length > 0 || (lanche.observacao || "").trim() !== "";
          });

          if (lanchesPersonalizados.length > 0) {
            htmlCombo = `

                        <div
                            style="
                                margin-top:8px;
                                margin-left:10px;
                            "
                        >

                            ${lanchesPersonalizados
                              .map((lanche) => {
                                const adicionais = (lanche.adicionais || [])
                                  .map((adicional) => {
                                    return `${adicional.qtd} ${adicional.nome}`;
                                  })
                                  .join(" + ");

                                return `

                                        <div
                                            style="
                                                margin-bottom:5px;
                                            "
                                        >

                                            <strong>
                                                Lanche ${lanche.numero}
                                            </strong>

                                            ${
                                              adicionais
                                                ? `
                                                        <br>
                                                        <small>
                                                            ➕ ${adicionais}
                                                        </small>
                                                    `
                                                : ""
                                            }

                                            ${
                                              lanche.observacao
                                                ? `
                                                        <br>
                                                        <small>
                                                            📝 ${lanche.observacao}
                                                        </small>
                                                    `
                                                : ""
                                            }

                                        </div>

                                    `;
                              })
                              .join("")}

                        </div>

                    `;
          }
        }

        return `

                <div
                    style="
                        margin-bottom:12px;
                        padding:10px;
                        border:1px solid #444;
                        border-radius:8px;
                    "
                >

                    <strong>
                        ${item.quantidade}
                        ${item.nome}
                    </strong>

                    ${htmlTipo}

                    ${htmlAdicionais}

                ${htmlObservacao}

${htmlCombo}

${htmlMolhos}

${htmlBotaoMolhos}

<br><br>

<strong>
    R$ ${Number(item.subtotal || 0).toFixed(2)}
</strong>
<br><br>


<button
    type="button"
    onclick="
        editarItemPedidoEntrega(
            ${index}
        )
    "
>
    ✏️ Editar
</button>


<button
    type="button"
    onclick="
        excluirItemPedidoEntrega(
            ${index}
        )
    "
>
    🗑️ Excluir
</button>

                </div>

            `;
      })
      .join("");
  }
  const subtotalPedido = pedidoEntregaAtual.itens.reduce((total, item) => {
    return total + Number(item.subtotal || 0) + Number(item.totalMolhosPagos || 0);
  }, 0);

  area.innerHTML = `

        <button
            type="button"
            onclick="
                criarNovoPedidoEntrega()
            "
        >
            ⬅ Voltar
        </button>


        <h3>
            🛵 Novo Pedido de Entrega
        </h3>


        <p>
            <strong>Cliente:</strong>
            ${pedidoEntregaAtual.nome}
        </p>


        ${
          pedidoEntregaAtual.telefone
            ? `

                    <p>
                        <strong>Telefone:</strong>
                        ${pedidoEntregaAtual.telefone}
                    </p>

                `
            : ""
        }


        <p>
            <strong>Endereço:</strong>
            ${pedidoEntregaAtual.endereco}
        </p>


        <hr>


        <h4>
            Itens do pedido
        </h4>


       <div
    id="itens-pedido-entrega"
>
    ${htmlItens}
</div>


        <button
            type="button"
            onclick="
                abrirProdutosPedidoEntrega()
            "
        >
            ➕ Adicionar Item
        </button>


        <hr>


        <p>
            Subtotal:
            <strong
                id="subtotal-pedido-entrega"
            >
                R$ ${subtotalPedido.toFixed(2)}
            </strong>
        </p>
        <hr>


<h3>
    Taxa de entrega
</h3>


<label>
    R$
</label>

<input
    type="number"
    id="taxa-pedido-entrega"
    min="0"
    step="0.01"
    value="${Number(pedidoEntregaAtual.taxaEntrega || 0).toFixed(2)}"
    oninput="
        atualizarTotalPedidoEntrega()
    "
>


<br><br>


<p>
    Total:
    <strong
        id="total-pedido-entrega"
    >
        R$ ${(subtotalPedido + Number(pedidoEntregaAtual.taxaEntrega || 0)).toFixed(2)}
    </strong>
</p>


<hr>


<h3>
    Forma de pagamento
</h3>


<label>
    <input
        type="radio"
        name="pagamento-entrega-atendente"
        value="Pix"
        ${pedidoEntregaAtual.formaPagamento === "Pix" ? "checked" : ""}
    >
    Pix
</label>


<br><br>


<label>
    <input
        type="radio"
        name="pagamento-entrega-atendente"
        value="Dinheiro"
        ${pedidoEntregaAtual.formaPagamento === "Dinheiro" ? "checked" : ""}
    >
    Dinheiro
</label>


<br><br>


<label>
    <input
        type="radio"
        name="pagamento-entrega-atendente"
        value="Débito"
        ${pedidoEntregaAtual.formaPagamento === "Débito" ? "checked" : ""}
    >
    Débito
</label>


<br><br>


<label>
    <input
        type="radio"
        name="pagamento-entrega-atendente"
        value="Crédito"
        ${pedidoEntregaAtual.formaPagamento === "Crédito" ? "checked" : ""}
    >
    Crédito
</label>


<br><br>


<button
    type="button"
    onclick="
        salvarPedidoEntregaAtendente()
    "
>
    ✅ Criar Pedido
</button>

    `;
}
function atualizarTotalPedidoEntrega() {
  if (!pedidoEntregaAtual) {
    return;
  }

  const taxa = Number(document.getElementById("taxa-pedido-entrega")?.value || 0);

  pedidoEntregaAtual.taxaEntrega = taxa;

  const subtotal = pedidoEntregaAtual.itens.reduce((total, item) => {
    return total + Number(item.subtotal || 0) + Number(item.totalMolhosPagos || 0);
  }, 0);

  const total = subtotal + taxa;

  const elementoTotal = document.getElementById("total-pedido-entrega");

  if (elementoTotal) {
    elementoTotal.textContent = `R$ ${total.toFixed(2)}`;
  }
}
async function salvarPedidoEntregaAtendente() {
  if (!pedidoEntregaAtual) {
    alert("Nenhum pedido em andamento.");

    return;
  }

  // =========================
  // VALIDAR ITENS
  // =========================

  if (!pedidoEntregaAtual.itens || pedidoEntregaAtual.itens.length === 0) {
    alert("Adicione pelo menos um item.");

    return;
  }

  // =========================
  // TAXA
  // =========================

  const taxaEntrega = Number(document.getElementById("taxa-pedido-entrega")?.value || 0);

  // =========================
  // PAGAMENTO
  // =========================

  const pagamentoSelecionado = document.querySelector(
    'input[name="pagamento-entrega-atendente"]:checked',
  );

  if (!pagamentoSelecionado) {
    alert("Informe a forma de pagamento.");

    return;
  }

  const pagamento = pagamentoSelecionado.value;

  // =========================
  // SUBTOTAL
  // =========================

  const subtotal = pedidoEntregaAtual.itens.reduce((total, item) => {
    return total + Number(item.subtotal || 0) + Number(item.totalMolhosPagos || 0);
  }, 0);

  const valorTotal = subtotal + taxaEntrega;

  // =========================
  // CONTADOR DE PEDIDOS
  // =========================

  const contadorRef = await prepararContadorPedidoOperacao(db);

  let numeroPedido;

  try {
    numeroPedido = await db.runTransaction(async (transaction) => {
      const doc = await transaction.get(contadorRef);

      let novoNumero = 1;

      if (doc.exists) {
        novoNumero = Number(doc.data().ultimoNumero || 0) + 1;
      }

      transaction.set(
        contadorRef,

        {
          ultimoNumero: novoNumero,
        },
      );

      return novoNumero;
    });
  } catch (erro) {
    console.error("Erro ao gerar número do pedido:", erro);

    alert("Não foi possível gerar o número do pedido.");

    return;
  }

  // =========================
  // MONTAR PEDIDO
  // =========================

  const pedido = {
    numero: numeroPedido,
    numeroDia: numeroPedido,
    diaOperacional: contadorRef.id.replace("contadorPedidos_", ""),

    nome: pedidoEntregaAtual.nome,

    telefone: pedidoEntregaAtual.telefone || "",

    endereco: pedidoEntregaAtual.endereco || "",
    condominio: pedidoEntregaAtual.condominio || "Não",
    cnh: pedidoEntregaAtual.cnh || "Não",
    localizacao: pedidoEntregaAtual.localizacao || "",

    itens: pedidoEntregaAtual.itens,

    subtotal: subtotal,

    taxaEntrega: taxaEntrega,

    valorTotal: valorTotal,

    tipo: "Entrega",

    pagamento: pagamento,

    origem: "atendente",

    status: "Novo",

    data: new Date().toISOString(),

    dataMs: Date.now(),
  };

  // =========================
  // SALVAR
  // =========================

  try {
    if (pedido.tipo === "Entrega")
      pedido.numeroEntregaDia = await reservarNumeroEntregaOperacao(db);
    const docRef = await db.collection("pedidos").add(pedido);

    await docRef.update({
      id: docRef.id,
    });

    alert(`Pedido #${numeroPedido} criado com sucesso.`);

    // =========================
    // LIMPAR PEDIDO TEMPORÁRIO
    // =========================

    pedidoEntregaAtual = null;

    indiceItemEntregaEmEdicao = null;

    contextoPainelProduto = "comanda";

    // =========================
    // VOLTAR PARA ENTREGA
    // =========================

    const area = document.getElementById("area-entrega-atendente");

    if (area) {
      area.style.display = "none";

      area.innerHTML = "";
    }

    await abrirCentralOperacao("Entrega", docRef.id);
  } catch (erro) {
    console.error("Erro ao salvar pedido:", erro);

    alert("Erro ao criar o pedido.");
  }
}
async function excluirItemPedidoEntrega(index) {
  if (!pedidoEntregaAtual || !pedidoEntregaAtual.itens[index]) {
    return;
  }

  const item = pedidoEntregaAtual.itens[index];

  const confirmar = await confirmarOperacao(`Excluir ${item.nome} do pedido?`);

  if (!confirmar) return;

  pedidoEntregaAtual.itens.splice(index, 1);

  indiceItemEntregaEmEdicao = null;

  abrirMontagemPedidoEntrega();
}
async function excluirItemPedidoRetirada(index) {
  if (!pedidoRetiradaAtual || !pedidoRetiradaAtual.itens[index]) {
    return;
  }

  const item = pedidoRetiradaAtual.itens[index];

  const confirmar = await confirmarOperacao(`Excluir ${item.nome} do pedido?`);

  if (!confirmar) {
    return;
  }

  pedidoRetiradaAtual.itens.splice(index, 1);

  indiceItemRetiradaEmEdicao = null;

  abrirMontagemPedidoRetirada();
}

async function editarItemPedidoEntrega(index) {
  const item = pedidoEntregaAtual?.itens[index];

  if (!item) return;

  if (!item.produtoId) {
    alert("Produto não possui ID.");

    return;
  }

  indiceItemEntregaEmEdicao = index;

  contextoPainelProduto = "entrega";

  await abrirPainelProduto(null, item.produtoId);

  // =========================
  // QUANTIDADE
  // =========================

  const quantidade = document.getElementById("quantidade-produto-config");

  if (quantidade) {
    quantidade.textContent = Number(item.quantidade || 1);
  }

  // =========================
  // OBSERVAÇÃO
  // =========================

  const observacao = document.getElementById("observacao-produto-config");

  if (observacao) {
    observacao.value = item.observacao || "";
  }

  // =====================================================
  // PRODUTO NORMAL
  // =====================================================

  if (item.categoria !== "combos") {
    // TIPO

    if (item.tipo) {
      const radio = document.querySelector(`input[name="tipo-produto"][value="${item.tipo}"]`);

      if (radio) {
        radio.checked = true;
      }
    }

    // ADICIONAIS

    (item.adicionais || []).forEach((adicional) => {
      const campo = document.getElementById(`qtd-adicional-${adicional.id}`);

      if (campo) {
        campo.textContent = Number(adicional.qtd || 0);
      }
    });

    atualizarPrecoProduto();

    return;
  }

  // =====================================================
  // COMBO
  // =====================================================

  configuracoesLanchesCombo = {};

  configuracaoTodosCombo = null;

  modoPersonalizacaoCombo = "";

  if (item.modoPersonalizacaoCombo === "todos") {
    const primeiroLanche = (item.lanchesCombo || [])[0];

    configuracaoTodosCombo = {
      adicionais: primeiroLanche?.adicionais || [],

      observacao: primeiroLanche?.observacao || "",
    };

    selecionarModoCombo("todos");

    atualizarResumoTodosCombo();
  } else if (item.modoPersonalizacaoCombo === "individual") {
    (item.lanchesCombo || []).forEach((lanche) => {
      if ((lanche.adicionais || []).length > 0 || (lanche.observacao || "").trim()) {
        configuracoesLanchesCombo[lanche.numero] = {
          adicionais: lanche.adicionais || [],

          observacao: lanche.observacao || "",
        };
      }
    });

    selecionarModoCombo("individual");

    atualizarTodosStatusLanchesCombo();
  }

  atualizarPrecoComboPersonalizado();
}
async function editarItemPedidoRetirada(index) {
  const item = pedidoRetiradaAtual?.itens[index];

  if (!item) {
    return;
  }

  if (!item.produtoId) {
    alert("Produto não possui ID.");

    return;
  }

  // =========================
  // MARCAR EDIÇÃO
  // =========================

  indiceItemRetiradaEmEdicao = index;

  contextoPainelProduto = "retirada";

  // =========================
  // ABRIR PRODUTO
  // =========================

  await abrirPainelProduto(null, item.produtoId);

  // =========================
  // QUANTIDADE
  // =========================

  const quantidade = document.getElementById("quantidade-produto-config");

  if (quantidade) {
    quantidade.textContent = Number(item.quantidade || 1);
  }

  // =========================
  // OBSERVAÇÃO
  // =========================

  const observacao = document.getElementById("observacao-produto-config");

  if (observacao) {
    observacao.value = item.observacao || "";
  }

  // =====================================================
  // PRODUTO NORMAL
  // =====================================================

  if (item.categoria !== "combos") {
    // =========================
    // TIPO
    // =========================

    if (item.tipo) {
      const radio = document.querySelector(`input[name="tipo-produto"][value="${item.tipo}"]`);

      if (radio) {
        radio.checked = true;
      }
    }

    // =========================
    // ADICIONAIS
    // =========================

    (item.adicionais || []).forEach((adicional) => {
      const campo = document.getElementById(`qtd-adicional-${adicional.id}`);

      if (campo) {
        campo.textContent = Number(adicional.qtd || 0);
      }
    });

    atualizarPrecoProduto();

    return;
  }

  // =====================================================
  // COMBO
  // =====================================================

  configuracoesLanchesCombo = {};

  configuracaoTodosCombo = null;

  modoPersonalizacaoCombo = "";

  // =========================
  // APLICAR PARA TODOS
  // =========================

  if (item.modoPersonalizacaoCombo === "todos") {
    const primeiroLanche = (item.lanchesCombo || [])[0];

    configuracaoTodosCombo = {
      adicionais: primeiroLanche?.adicionais || [],

      observacao: primeiroLanche?.observacao || "",
    };

    selecionarModoCombo("todos");

    atualizarResumoTodosCombo();
  }

  // =========================
  // INDIVIDUAL
  // =========================
  else if (item.modoPersonalizacaoCombo === "individual") {
    (item.lanchesCombo || []).forEach((lanche) => {
      if ((lanche.adicionais || []).length > 0 || (lanche.observacao || "").trim() !== "") {
        configuracoesLanchesCombo[lanche.numero] = {
          adicionais: lanche.adicionais || [],

          observacao: lanche.observacao || "",
        };
      }
    });

    selecionarModoCombo("individual");

    atualizarTodosStatusLanchesCombo();
  }

  atualizarPrecoComboPersonalizado();
}
function abrirMolhosPedidoRetirada(index) {
  contextoMolhosPedido = "retirada";

  abrirMolhosPedido(index);
}
function abrirMolhosPedidoEntrega(index) {
  contextoMolhosPedido = "entrega";

  abrirMolhosPedido(index);
}

function abrirMolhosPedido(index) {
  const pedidoAtual = contextoMolhosPedido === "entrega" ? pedidoEntregaAtual : pedidoRetiradaAtual;

  if (!pedidoAtual || !pedidoAtual.itens[index]) {
    return;
  }

  const item = pedidoAtual.itens[index];

  const area = document.getElementById(
    contextoMolhosPedido === "entrega" ? "area-entrega-atendente" : "area-retirada-atendente",
  );

  if (!area) return;

  // =========================
  // QUANTIDADE DE DIREITOS
  // =========================

  let qtdDireitos = Number(item.quantidade || 1);

  // Combo:
  // cada lanche do combo
  // possui sua configuração.

  if (item.categoria === "combos") {
    qtdDireitos = Number(item.comboQtdLanches || 1) * Number(item.quantidade || 1);
  }

  // =========================
  // MONTAR LANCHES / UNIDADES
  // =========================

  let blocos = "";

  for (let i = 1; i <= qtdDireitos; i++) {
    const molhoSalvo = (item.molhosGratis || []).find((molho) => Number(molho.unidade) === i);

    const tipoSalvo = molhoSalvo?.tipo || "semmolho";

    blocos += `

            <div
                style="
                    margin-bottom:15px;
                    padding:10px;
                    border:1px solid #444;
                    border-radius:8px;
                "
            >

                <strong>

                    ${item.categoria === "combos" ? `Lanche ${i}` : `${item.nome} #${i}`}

                </strong>


                <br><br>


                <label>

                    <input
                        type="radio"
                        name="tipo-molho-entrega-${i}"
                        value="semmolho"

                        ${tipoSalvo === "semmolho" ? "checked" : ""}

                      onchange="
    renderizarOpcoesMolhoPedido(
        ${index},
        ${i}
    )
"
                    >

                    Sem molho

                </label>


                <br><br>


                <label>

                    <input
                        type="radio"
                        name="tipo-molho-entrega-${i}"
                        value="umdecada"

                        ${tipoSalvo === "umdecada" ? "checked" : ""}

                      onchange="
    renderizarOpcoesMolhoPedido(
        ${index},
        ${i}
    )
"
                    >

                    1 de cada escolhido

                </label>


                <br><br>


                <label>

                    <input
                        type="radio"
                        name="tipo-molho-entrega-${i}"
                        value="doisiguais"

                        ${tipoSalvo === "doisiguais" ? "checked" : ""}

                     onchange="
    renderizarOpcoesMolhoPedido(
        ${index},
        ${i}
    )
"
                    >

                    2 iguais

                </label>


                <div
                    id="opcoes-molho-entrega-${i}"
                    style="
                        margin-top:10px;
                    "
                ></div>

            </div>

        `;
  }

  area.innerHTML = `

       <button
    type="button"
    onclick="
        ${
          contextoMolhosPedido === "entrega"
            ? "abrirMontagemPedidoEntrega()"
            : "abrirMontagemPedidoRetirada()"
        }
    "
>
    ⬅ Voltar
</button>


        <h3>
            🍶 Molhos
        </h3>


        <p>
            <strong>
                ${item.nome}
            </strong>
        </p>


        ${blocos}


        <hr>


        <h3>
            💰 Molhos extras
        </h3>


        <button
            type="button"
            onclick="
                alternarMolhosPagosEntrega()
            "
        >
            ➕ Adicionar molhos pagos
        </button>


        <div
            id="area-molhos-pagos-entrega"
            style="
                display:none;
                margin-top:15px;
            "
        >

            <p>
                R$ 2,00 cada unidade
            </p>

            ${montarMolhosPagosEntrega(item.molhosPagos || [])}

        </div>


        <br>


        <strong
            id="total-molhos-pagos-entrega"
        >
            Extras:
            R$ ${Number(item.totalMolhosPagos || 0).toFixed(2)}
        </strong>


        <br><br>


        <button
            type="button"
         onclick="
    salvarMolhosPedido(
        ${index},
        ${qtdDireitos}
    )
"
        >
            💾 Salvar Molhos
        </button>

    `;

  // Mostrar as opções corretas
  // que já estavam salvas.

  for (let i = 1; i <= qtdDireitos; i++) {
    renderizarOpcoesMolhoPedido(index, i);
  }
}
function renderizarOpcoesMolhoPedido(index, unidade) {
  const pedidoAtual = contextoMolhosPedido === "entrega" ? pedidoEntregaAtual : pedidoRetiradaAtual;

  const item = pedidoAtual?.itens[index];

  if (!item) return;

  const salvo = (item.molhosGratis || []).find((molho) => Number(molho.unidade) === unidade);

  const tipo = document.querySelector(`input[name="tipo-molho-entrega-${unidade}"]:checked`)?.value;

  const area = document.getElementById(`opcoes-molho-entrega-${unidade}`);

  if (!area) return;

  // =========================
  // SEM MOLHO
  // =========================

  if (tipo === "semmolho") {
    area.innerHTML = "<small>Sem molho nesta unidade.</small>";

    return;
  }

  // =========================
  // 1 DE CADA
  // =========================

  if (tipo === "umdecada") {
    const salvos = salvo?.molhos || [];

    area.innerHTML = `

            <p>
                Escolha os molhos:
            </p>


            <label>
                <input
                    type="checkbox"
                    class="molho-um-entrega-${unidade}"
                    value="Maionese"
                    ${salvos.includes("Maionese") ? "checked" : ""}
                >
                Maionese
            </label>

            <br>


            <label>
                <input
                    type="checkbox"
                    class="molho-um-entrega-${unidade}"
                    value="Ketchup"
                    ${salvos.includes("Ketchup") ? "checked" : ""}

                >
                Ketchup
            </label>

            <br>


            <label>
                <input
                    type="checkbox"
                    class="molho-um-entrega-${unidade}"
                    value="Mostarda"
                    ${salvos.includes("Mostarda") ? "checked" : ""}

                >
                Mostarda
            </label>

            <br>


            <label>
                <input
                    type="checkbox"
                    class="molho-um-entrega-${unidade}"
                    value="Barbecue"
                    ${salvos.includes("Barbecue") ? "checked" : ""}

                >
                Barbecue
            </label>

        `;

    return;
  }

  // =========================
  // 2 IGUAIS
  // =========================

  if (tipo === "doisiguais") {
    const molho = salvo?.molho || "Maionese";

    area.innerHTML = `

            <label>

                <input
                    type="radio"
                    name="molho-dois-entrega-${unidade}"
                    value="Maionese"
                    ${molho === "Maionese" ? "checked" : ""}
                >

                2 Maionese

            </label>

            <br>


            <label>

                <input
                    type="radio"
                    name="molho-dois-entrega-${unidade}"
                    value="Ketchup"
                    ${molho === "Ketchup" ? "checked" : ""}
                >

                2 Ketchup

            </label>

            <br>


            <label>

                <input
                    type="radio"
                    name="molho-dois-entrega-${unidade}"
                    value="Mostarda"
                    ${molho === "Mostarda" ? "checked" : ""}
                >

                2 Mostarda

            </label>

            <br>


            <label>

                <input
                    type="radio"
                    name="molho-dois-entrega-${unidade}"
                    value="Barbecue"
                    ${molho === "Barbecue" ? "checked" : ""}
                >

                2 Barbecue

            </label>

        `;
  }
}

function montarMolhosGratisEntrega(selecionados = {}) {
  const molhos = ["Maionese", "Ketchup", "Mostarda", "Barbecue"];

  return molhos
    .map((molho) => {
      const qtd = Number(selecionados[molho] || 0);

      return `

                <div
                    style="
                        margin-bottom:10px;
                    "
                >

                    ${molho}

                    <button
                        type="button"
                        onclick="
                            alterarMolhoGratisEntrega(
                                '${molho}',
                                -1
                            )
                        "
                    >
                        −
                    </button>


                    <span
                        id="molho-gratis-${molho}"
                        style="
                            margin:0 10px;
                        "
                    >
                        ${qtd}
                    </span>


                    <button
                        type="button"
                        onclick="
                            alterarMolhoGratisEntrega(
                                '${molho}',
                                1
                            )
                        "
                    >
                        +
                    </button>

                </div>

            `;
    })
    .join("");
}
function montarMolhosPagosEntrega(selecionados = []) {
  const molhos = ["Maionese", "Ketchup", "Mostarda", "Barbecue"];

  return molhos
    .map((molho) => {
      const salvo = selecionados.find((item) => item.nome === molho);

      const qtd = Number(salvo?.qtd || 0);

      return `

                <div
                    style="
                        margin-bottom:10px;
                    "
                >

                    ${molho}

                    <button
                        type="button"
                        onclick="
                            alterarMolhoPagoEntrega(
                                '${molho}',
                                -1
                            )
                        "
                    >
                        −
                    </button>

                    <span
                        id="molho-pago-${molho}"
                        style="
                            margin:0 10px;
                        "
                    >
                        ${qtd}
                    </span>

                    <button
                        type="button"
                        onclick="
                            alterarMolhoPagoEntrega(
                                '${molho}',
                                1
                            )
                        "
                    >
                        +
                    </button>

                </div>

            `;
    })
    .join("");
}
function alternarMolhosPagosEntrega() {
  const area = document.getElementById("area-molhos-pagos-entrega");

  if (!area) return;

  area.style.display = area.style.display === "none" ? "block" : "none";
}
function alterarMolhoGratisEntrega(molho, alteracao) {
  const elemento = document.getElementById(`molho-gratis-${molho}`);

  if (!elemento) {
    return;
  }

  let quantidade = Number(elemento.textContent || 0);

  quantidade += alteracao;

  if (quantidade < 0) {
    quantidade = 0;
  }

  elemento.textContent = quantidade;
}
function alterarMolhoPagoEntrega(molho, alteracao) {
  const elemento = document.getElementById(`molho-pago-${molho}`);

  if (!elemento) {
    return;
  }

  let quantidade = Number(elemento.textContent || 0);

  quantidade += alteracao;

  if (quantidade < 0) {
    quantidade = 0;
  }

  elemento.textContent = quantidade;

  // =========================
  // ATUALIZAR VALOR
  // =========================

  atualizarTotalMolhosPagosEntrega();
}
function atualizarTotalMolhosPagosEntrega() {
  const molhos = ["Maionese", "Ketchup", "Mostarda", "Barbecue"];

  let quantidadeTotal = 0;

  molhos.forEach((molho) => {
    const elemento = document.getElementById(`molho-pago-${molho}`);

    quantidadeTotal += Number(elemento?.textContent || 0);
  });

  const total = quantidadeTotal * 2;

  const elementoTotal = document.getElementById("total-molhos-pagos-entrega");

  if (elementoTotal) {
    elementoTotal.textContent = `R$ ${total.toFixed(2)}`;
  }
}
function salvarMolhosPedido(index, qtdDireitos) {
  const pedidoAtual = contextoMolhosPedido === "entrega" ? pedidoEntregaAtual : pedidoRetiradaAtual;

  const item = pedidoAtual?.itens[index];

  if (!item) return;

  const molhosGratis = [];

  // =========================
  // MOLHOS GRÁTIS
  // =========================

  for (let i = 1; i <= qtdDireitos; i++) {
    const tipo =
      document.querySelector(`input[name="tipo-molho-entrega-${i}"]:checked`)?.value || "semmolho";

    // SEM MOLHO

    if (tipo === "semmolho") {
      molhosGratis.push({
        unidade: i,

        tipo: "semmolho",

        texto: "Sem molho",
      });
    }

    // 1 DE CADA
    else if (tipo === "umdecada") {
      const escolhidos = [];

      document.querySelectorAll(`.molho-um-entrega-${i}:checked`).forEach((check) => {
        escolhidos.push(check.value);
      });

      molhosGratis.push({
        unidade: i,

        tipo: "umdecada",

        molhos: escolhidos,

        texto: escolhidos.length > 0 ? escolhidos.join(" + ") : "Sem molho",
      });
    }

    // 2 IGUAIS
    else if (tipo === "doisiguais") {
      const molho =
        document.querySelector(`input[name="molho-dois-entrega-${i}"]:checked`)?.value || "";

      molhosGratis.push({
        unidade: i,

        tipo: "doisiguais",

        molho,

        texto: molho ? `2 ${molho}` : "Sem molho",
      });
    }
  }

  // =========================
  // MOLHOS PAGOS
  // =========================

  const nomes = ["Maionese", "Ketchup", "Mostarda", "Barbecue"];

  const molhosPagos = [];

  nomes.forEach((nome) => {
    const qtd = Number(document.getElementById(`molho-pago-${nome}`)?.textContent || 0);

    if (qtd > 0) {
      molhosPagos.push({
        nome,

        qtd,

        preco: 2,
      });
    }
  });

  item.molhosGratis = molhosGratis;

  item.molhosPagos = molhosPagos;

  item.totalMolhosPagos = molhosPagos.reduce((total, molho) => {
    return total + Number(molho.qtd || 0) * 2;
  }, 0);

  if (contextoMolhosPedido === "entrega") {
    abrirMontagemPedidoEntrega();
  } else {
    abrirMontagemPedidoRetirada();
  }
}

async function abrirProdutosPedidoEntrega() {
  const area = document.getElementById("area-entrega-atendente");

  if (!area || !pedidoEntregaAtual) {
    return;
  }

  area.innerHTML = `

        <button
            type="button"
            onclick="
                abrirMontagemPedidoEntrega()
            "
        >
            ⬅ Voltar para Pedido
        </button>


        <h3>
            ➕ Adicionar Item
        </h3>


        <button
            type="button"
            onclick="
                listarProdutosPedidoEntrega(
                    'lanches'
                )
            "
        >
            🍔 Lanches
        </button>


        <button
            type="button"
            onclick="
                listarProdutosPedidoEntrega(
                    'combos'
                )
            "
        >
            🎁 Combos
        </button>


        <button
            type="button"
            onclick="
                listarProdutosPedidoEntrega(
                    'batatas'
                )
            "
        >
            🍟 Batatas
        </button>


        <button
            type="button"
            onclick="
                listarProdutosPedidoEntrega(
                    'bebidas'
                )
            "
        >
            🥤 Bebidas
        </button>


        <hr>


        <div
            id="lista-produtos-pedido-entrega"
        >

            <p>
                Escolha uma categoria.
            </p>

        </div>

    `;
}
async function listarProdutosPedidoEntrega(categoria) {
  const areaLista = document.getElementById("lista-produtos-pedido-entrega");

  if (!areaLista) {
    return;
  }

  areaLista.innerHTML = "<p>Carregando...</p>";

  // =========================
  // BUSCAR PRODUTOS
  // =========================

  const snap = await db.collection("produtos").where("categoria", "==", categoria).get();

  if (snap.empty) {
    areaLista.innerHTML = "<p>Nenhum produto encontrado.</p>";

    return;
  }

  // =========================
  // MONTAR LISTA
  // =========================

  let html = "";

  snap.forEach((doc) => {
    const produto = doc.data();
    if (produto.ativo === false || produto.esgotado) return;

    const preco = Number(produto.preco || 0);

    html += `

            <div
                style="
                    margin-bottom:12px;
                    padding:10px;
                    border:1px solid #444;
                    border-radius:8px;
                "
            >

                <strong>
                    ${produto.nome}
                </strong>

                <br>

                R$ ${preco.toFixed(2)}

                <br><br>


                <button
                    type="button"
                    onclick="
                        abrirProdutoPedidoEntrega(
                            '${doc.id}'
                        )
                    "
                >
                    Adicionar
                </button>

            </div>

        `;
  });

  areaLista.innerHTML = html;
}
async function abrirProdutoPedidoEntrega(produtoId) {
  contextoPainelProduto = "entrega";

  await abrirPainelProduto(null, produtoId);
}
async function adicionarProdutoConfiguradoEntrega(produtoId) {
  await adicionarProdutoConfiguradoPedido(produtoId, "entrega");
}

async function adicionarProdutoConfiguradoRetirada(produtoId) {
  await adicionarProdutoConfiguradoPedido(produtoId, "retirada");
}

async function adicionarProdutoConfiguradoPedido(produtoId, contexto) {
  // =========================
  // DESCOBRIR PEDIDO
  // =========================

  const pedidoAtual = contexto === "entrega" ? pedidoEntregaAtual : pedidoRetiradaAtual;

  if (!pedidoAtual) {
    alert("Nenhum pedido em andamento.");

    return;
  }

  // =========================
  // BUSCAR PRODUTO
  // =========================

  const docProduto = await db.collection("produtos").doc(produtoId).get();

  if (!docProduto.exists) {
    alert("Produto não encontrado.");

    return;
  }

  const produto = docProduto.data();

  // =========================
  // QUANTIDADE
  // =========================

  let quantidade = Number(document.getElementById("quantidade-produto-config")?.textContent || 1);

  // =========================
  // OBSERVAÇÃO
  // =========================

  const observacao = document.getElementById("observacao-produto-config")?.value.trim() || "";

  // =====================================================
  // COMBO
  // =====================================================

  if (produto.categoria === "combos") {
    adicionarComboConfiguradoPedido(produtoId, produto, quantidade, observacao, contexto);

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

  if (temAcrescimos) {
    quantidade = 1;
  }

  // =========================
  // TOTAL DOS ACRÉSCIMOS
  // =========================

  const totalAdicionais = adicionais.reduce((total, adicional) => {
    return total + Number(adicional.preco || 0) * Number(adicional.qtd || 0);
  }, 0);

  const precoUnitario = precoBase + totalAdicionais;

  // =========================
  // NOVO ITEM
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

    molhosGratis: [],

    molhosPagos: [],

    totalMolhosPagos: 0,
  };

  // =========================
  // DESCOBRIR EDIÇÃO
  // =========================

  const indiceEdicao =
    contexto === "entrega" ? indiceItemEntregaEmEdicao : indiceItemRetiradaEmEdicao;

  // =========================
  // EDITANDO ITEM
  // =========================

  if (Number.isInteger(indiceEdicao)) {
    const antigo = pedidoAtual.itens[indiceEdicao];

    // Preservar molhos

    novoItem.molhosGratis = antigo?.molhosGratis || [];

    novoItem.molhosPagos = antigo?.molhosPagos || [];

    novoItem.totalMolhosPagos = Number(antigo?.totalMolhosPagos || 0);

    pedidoAtual.itens[indiceEdicao] = novoItem;

    if (contexto === "entrega") {
      indiceItemEntregaEmEdicao = null;

      abrirMontagemPedidoEntrega();
    } else {
      indiceItemRetiradaEmEdicao = null;

      abrirMontagemPedidoRetirada();
    }

    return;
  }

  const itens = pedidoAtual.itens;

  // =========================
  // PRODUTO PADRÃO
  // PODE AGRUPAR
  // =========================

  if (!temAcrescimos) {
    const itemExistente = itens.find(
      (item) =>
        item.produtoId === produtoId &&
        (item.tipo || "") === tipo &&
        (!item.adicionais || item.adicionais.length === 0) &&
        (item.observacao || "") === observacao &&
        (item.molhosGratis || []).length === 0 &&
        (item.molhosPagos || []).length === 0,
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
  // PERSONALIZADO
  // NÃO AGRUPAR
  // =========================
  else {
    itens.push(novoItem);
  }

  // =========================
  // VOLTAR AO PEDIDO
  // =========================

  if (contexto === "entrega") {
    abrirMontagemPedidoEntrega();
  } else {
    abrirMontagemPedidoRetirada();
  }
}

function adicionarComboConfiguradoEntrega(produtoId, produto, quantidade, observacao) {
  adicionarComboConfiguradoPedido(produtoId, produto, quantidade, observacao, "entrega");
}

function adicionarComboConfiguradoPedido(produtoId, produto, quantidade, observacao, contexto) {
  const pedidoAtual = contexto === "entrega" ? pedidoEntregaAtual : pedidoRetiradaAtual;

  if (!pedidoAtual) {
    return;
  }

  const qtdLanches = Number(produto.comboQtdLanches || 0);

  // =========================
  // VER PERSONALIZAÇÃO
  // =========================

  const temConfiguracaoTodos =
    modoPersonalizacaoCombo === "todos" && configuracaoComboTemAlteracoes(configuracaoTodosCombo);

  const temConfiguracaoIndividual =
    modoPersonalizacaoCombo === "individual" &&
    Object.values(configuracoesLanchesCombo).some(configuracaoComboTemAlteracoes);

  const comboPersonalizado = temConfiguracaoTodos || temConfiguracaoIndividual;

  if (comboPersonalizado) {
    quantidade = 1;
  }

  // =========================
  // MONTAR LANCHES
  // =========================

  const lanchesCombo = [];

  for (let numero = 1; numero <= qtdLanches; numero++) {
    let adicionais = [];

    let observacaoLanche = "";

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

      observacaoLanche = configuracaoTodosCombo.observacao || "";
    }

    // =========================
    // INDIVIDUAL
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

        observacaoLanche = configuracao.observacao || "";
      }
    }

    lanchesCombo.push({
      numero,

      adicionais,

      observacao: observacaoLanche,
    });
  }

  // =========================
  // TOTAL DOS ACRÉSCIMOS
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
  // NOVO COMBO
  // =========================

  const novoItem = {
    produtoId,

    nome: produto.nome,

    categoria: produto.categoria || "combos",

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

    molhosGratis: [],

    molhosPagos: [],

    totalMolhosPagos: 0,
  };

  // =========================
  // DESCOBRIR EDIÇÃO
  // =========================

  const indiceEdicao =
    contexto === "entrega" ? indiceItemEntregaEmEdicao : indiceItemRetiradaEmEdicao;

  // =========================
  // EDITANDO COMBO
  // =========================

  if (Number.isInteger(indiceEdicao)) {
    const antigo = pedidoAtual.itens[indiceEdicao];

    novoItem.molhosGratis = antigo?.molhosGratis || [];

    novoItem.molhosPagos = antigo?.molhosPagos || [];

    novoItem.totalMolhosPagos = Number(antigo?.totalMolhosPagos || 0);

    pedidoAtual.itens[indiceEdicao] = novoItem;

    if (contexto === "entrega") {
      indiceItemEntregaEmEdicao = null;
    } else {
      indiceItemRetiradaEmEdicao = null;
    }

    // Limpar estado temporário

    modoPersonalizacaoCombo = "";

    configuracoesLanchesCombo = {};

    configuracaoTodosCombo = null;

    if (contexto === "entrega") {
      abrirMontagemPedidoEntrega();
    } else {
      abrirMontagemPedidoRetirada();
    }

    return;
  }

  const itens = pedidoAtual.itens;

  // =========================
  // COMBO PADRÃO
  // PODE AGRUPAR
  // =========================

  if (!comboPersonalizado) {
    const comboExistente = itens.find(
      (item) =>
        item.produtoId === produtoId &&
        item.categoria === "combos" &&
        !item.comboPersonalizado &&
        (item.observacao || "") === observacao &&
        (item.molhosGratis || []).length === 0 &&
        (item.molhosPagos || []).length === 0,
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
  // PERSONALIZADO
  // NÃO AGRUPAR
  // =========================
  else {
    itens.push(novoItem);
  }

  // =========================
  // LIMPAR COMBO TEMPORÁRIO
  // =========================

  modoPersonalizacaoCombo = "";

  configuracoesLanchesCombo = {};

  configuracaoTodosCombo = null;

  // =========================
  // VOLTAR
  // =========================

  if (contexto === "entrega") {
    abrirMontagemPedidoEntrega();
  } else {
    abrirMontagemPedidoRetirada();
  }
}

function voltarListaEntregas() {
  const area = document.getElementById("area-entrega-atendente");

  if (!area) {
    return;
  }

  area.style.display = "none";

  area.innerHTML = "";

  abrirEntregaAtendente();
}
async function abrirConsumoLocal() {
  const area = document.getElementById("area-consumo-local");

  const areaMesa = document.getElementById("area-mesa-atendente");

  const areaComanda = document.getElementById("area-comanda-atendente");

  const areaProdutos = document.getElementById("area-produtos-comanda");

  if (!area) {
    return;
  }

  // =====================================================
  // JÁ ESTÁ EM CONSUMO LOCAL
  // → SEGUNDO CLIQUE = MINIMIZAR
  // =====================================================

  if (area.style.display !== "none" && area.dataset.tela === "consumo-local") {
    area.style.display = "none";

    area.innerHTML = "";

    area.dataset.tela = "";

    if (areaMesa) {
      areaMesa.style.display = "none";

      areaMesa.innerHTML = "";
    }

    if (areaComanda) {
      areaComanda.style.display = "none";

      areaComanda.innerHTML = "";
    }

    if (areaProdutos) {
      areaProdutos.style.display = "none";

      areaProdutos.innerHTML = "";
    }

    mesaAbertaAtual = null;

    comandaAbertaAtual = null;

    areaDestinoComandaAtual = null;

    return;
  }

  // =====================================================
  // ESTAVA EM OUTRA TELA
  // EX: COMANDAS ABERTAS
  // → TROCAR DIRETAMENTE
  // =====================================================

  if (areaMesa) {
    areaMesa.style.display = "none";

    areaMesa.innerHTML = "";
  }

  if (areaComanda) {
    areaComanda.style.display = "none";

    areaComanda.innerHTML = "";
  }

  if (areaProdutos) {
    areaProdutos.style.display = "none";

    areaProdutos.innerHTML = "";
  }

  mesaAbertaAtual = null;

  comandaAbertaAtual = null;

  areaDestinoComandaAtual = null;

  // =========================
  // MARCAR TELA ATUAL
  // =========================

  area.dataset.tela = "consumo-local";

  area.style.display = "block";

  // =========================
  // CARREGAR MESAS
  // =========================

  await areaConsumoLocalRecarregar();
}
function abrirChamadosMesaAtendente() {
  const area = document.getElementById("area-chamados-mesa-atendente");

  if (!area) {
    return;
  }

  // =========================
  // SE JÁ ESTÁ ABERTO
  // FECHA
  // =========================

  if (area.style.display === "block") {
    area.style.display = "none";

    return;
  }

  // =========================
  // FECHAR OUTRAS TELAS
  // =========================

  const idsAreas = [
    "area-consumo-local",
    "area-mesa-atendente",
    "area-comanda-atendente",
    "area-produtos-comanda",
    "area-entrega-atendente",
    "area-retirada-atendente",
  ];

  idsAreas.forEach((id) => {
    const elemento = document.getElementById(id);

    if (elemento) {
      elemento.style.display = "none";
    }
  });

  // =========================
  // ABRIR CHAMADOS
  // =========================

  area.style.display = "block";

  renderizarChamadosMesaAtendente();
}
function renderizarChamadosMesaAtendente() {
  const area = document.getElementById("area-chamados-mesa-atendente");

  if (!area) {
    return;
  }

  // =========================
  // NENHUM CHAMADO
  // =========================

  if (chamadosMesaAbertosAtendente.length === 0) {
    area.innerHTML = `

            <h3>
                🔔 Chamados
            </h3>


            <p>
                Nenhuma mesa chamou o atendente.
            </p>

        `;

    return;
  }

  // =========================
  // FILA
  // MAIS ANTIGO PRIMEIRO
  // =========================

  const chamadosOrdenados = [...chamadosMesaAbertosAtendente].sort(
    (a, b) => Number(a.criadoEmMs || 0) - Number(b.criadoEmMs || 0),
  );

  let html = `

        <h3>
            🔔 Chamados
        </h3>


        <p>
            ${chamadosOrdenados.length}
            chamado(s) aguardando atendimento
        </p>


        <hr>

    `;

  chamadosOrdenados.forEach((chamado) => {
    // =========================
    // TEMPO
    // =========================

    const tempo = calcularTempoChamadoMesa(chamado.criadoEmMs);

    // =========================
    // TIPO DO CHAMADO
    // =========================

    const tipoChamado = chamado.tipo || "atendente";

    const ehConta = tipoChamado === "conta";

    const textoChamado = ehConta ? "💰 Solicitou a conta" : "🔔 Chamou o atendente";

    // =========================
    // CLIENTE
    // =========================

    const clienteChamado = chamado.cliente ? `👤 ${chamado.cliente}` : "";

    // =========================
    // CARD
    // =========================

    html += `

                <div
                    style="
                        margin-bottom:15px;
                        padding:12px;
                        border:1px solid #444;
                        border-radius:8px;
                    "
                >

                    <strong>
                        🔴 Mesa ${chamado.mesaNumero || "-"}
                    </strong>


                    ${
                      clienteChamado
                        ? `

                                <br><br>

                                ${clienteChamado}

                            `
                        : ""
                    }


                    <br><br>


                    <strong>
                        ${textoChamado}
                    </strong>


                    <br><br>


                    🕒 ${tempo}


                    <br><br>


                    <button
                        type="button"
                        onclick="
                            atenderChamadoMesa(
                                '${chamado.id}'
                            )
                        "
                    >
                        ✅ Atender
                    </button>

                </div>

            `;
  });

  area.innerHTML = html;
}
function calcularTempoChamadoMesa(criadoEmMs) {
  const tempo = Date.now() - Number(criadoEmMs || Date.now());

  const minutos = Math.floor(tempo / 60000);

  if (minutos <= 0) {
    return "Chamou agora";
  }

  if (minutos === 1) {
    return "Chamou há 1 minuto";
  }

  if (minutos < 60) {
    return `Chamou há ${minutos} minutos`;
  }

  const horas = Math.floor(minutos / 60);

  if (horas === 1) {
    return "Chamou há 1 hora";
  }

  return `Chamou há ${horas} horas`;
}
function iniciarListenerChamadosMesaAtendente() {
  // =========================
  // EVITAR LISTENER DUPLICADO
  // =========================

  if (listenerChamadosMesaAtendente) {
    listenerChamadosMesaAtendente();

    listenerChamadosMesaAtendente = null;
  }

  listenerChamadosMesaAtendente = db
    .collection("chamadosMesa")
    .where("status", "==", "aberto")
    .onSnapshot(
      (snapshot) => {
        const janela = obterJanelaAtualPedidosAtendente();

        const chamados = [];

        snapshot.forEach((doc) => {
          const chamado = doc.data();

          const criadoEmMs = Number(chamado.criadoEmMs || 0);

          // =========================
          // SOMENTE DIA OPERACIONAL
          // 02H → 02H
          // =========================

          if (criadoEmMs < janela.inicioMs || criadoEmMs >= janela.fimMs) {
            return;
          }

          chamados.push({
            id: doc.id,

            ...chamado,
          });
        });

        chamadosMesaAbertosAtendente = chamados;

        atualizarContadorChamadosMesa();

        // =========================
        // SE A TELA ESTÁ ABERTA
        // ATUALIZA AUTOMATICAMENTE
        // =========================

        const area = document.getElementById("area-chamados-mesa-atendente");

        if (area && area.style.display === "block") {
          renderizarChamadosMesaAtendente();
        }
      },

      (erro) => {
        console.error("Erro ao ouvir chamados das mesas:", erro);
      },
    );
}
function atualizarContadorChamadosMesa() {
  const contador = document.getElementById("contador-chamados-mesa");

  if (!contador) {
    return;
  }

  const total = chamadosMesaAbertosAtendente.length;

  if (total <= 0) {
    contador.style.display = "none";

    contador.textContent = "0";

    return;
  }

  contador.style.display = "inline-block";

  contador.textContent = total;
}

async function abrirComandasAbertas() {
  const area = document.getElementById("area-consumo-local");

  if (!area) {
    return;
  }

  // =========================
  // SE COMANDAS ABERTAS
  // JÁ ESTIVER NA TELA,
  // FECHAR
  // =========================

  if (area.style.display !== "none" && area.dataset.tela === "comandas-abertas") {
    area.style.display = "none";

    area.innerHTML = "";

    area.dataset.tela = "";

    mesaAbertaAtual = null;

    comandaAbertaAtual = null;

    areaDestinoComandaAtual = null;

    return;
  }

  // =========================
  // LIMPAR TELA ANTERIOR
  // =========================

  const areaMesa = document.getElementById("area-mesa-atendente");

  const areaComanda = document.getElementById("area-comanda-atendente");

  const areaProdutos = document.getElementById("area-produtos-comanda");

  if (areaMesa) {
    areaMesa.style.display = "none";

    areaMesa.innerHTML = "";
  }

  if (areaComanda) {
    areaComanda.style.display = "none";

    areaComanda.innerHTML = "";
  }

  if (areaProdutos) {
    areaProdutos.style.display = "none";

    areaProdutos.innerHTML = "";
  }

  // =========================
  // LIMPAR ESTADOS
  // =========================

  mesaAbertaAtual = null;

  comandaAbertaAtual = null;

  areaDestinoComandaAtual = null;

  modoRemoverItem = false;

  modoEditarItem = false;
  const snap = await db.collection("comandas").where("status", "==", "Aberta").get();

  if (snap.empty) {
    alert("Não existem comandas abertas.");

    return;
  }

  const comandas = [];

  snap.forEach((doc) => {
    comandas.push({
      id: doc.id,

      ...doc.data(),
    });
  });

  // =========================
  // ORDENAR POR MESA
  // =========================

  comandas.sort((a, b) => Number(a.mesa || 0) - Number(b.mesa || 0));

  // =========================
  // MONTAR LISTAGEM
  // =========================

  let html = `

        <h3>
            📋 Comandas Abertas
        </h3>

    `;

  comandas.forEach((comanda) => {
    const valorTotal = Number(comanda.valorTotal || 0);

    const valorPago = Number(comanda.valorPago || 0);

    const restante = saldoComandaPagamento(comanda);

    const temPagamentoParcial = valorPago > 0 && restante > 0.01;

    const idAreaDetalhe = `detalhe-comanda-${comanda.id}`;

    html += `

            <div class="comanda-card"
                style="
                    margin-bottom:15px;
                    padding:12px;
                    border:1px solid #444;
                    border-radius:8px;
                "
            >

                <strong>
                    Mesa ${comanda.mesa}
                    —
                    ${comanda.cliente || "Cliente"}
                </strong>

                <dl class="comanda-valores"><div><dt>Total</dt><dd>R$ ${valorTotal.toFixed(2)}</dd></div>

                ${
                  temPagamentoParcial
                    ? `

                            <div><dt>Pago</dt><dd>R$ ${valorPago.toFixed(2)}</dd></div>
                            <div><dt>Restante</dt><dd><strong>R$ ${restante.toFixed(2)}</strong></dd></div>

                        `
                    : ""
                }

                </dl>

              <button
    type="button"
    onclick="
        abrirComandaPelaLista(
            '${comanda.id}',
            ${Number(comanda.mesa)},
            '${idAreaDetalhe}'
        )
    "
>
    Abrir Comanda
</button>


<div
    id="${idAreaDetalhe}"
    style="
        display:none;
        margin-top:15px;
        padding-top:15px;
        border-top:1px solid #444;
    "
></div>

${acoesRegistroUI("comandas", comanda.id)}

            </div>

        `;
  });

  // =========================
  // MOSTRAR
  // =========================

  // =========================
  // MOSTRAR COMANDAS ABERTAS
  // =========================

  area.style.display = "block";

  area.dataset.tela = "comandas-abertas";

  area.innerHTML = html;
}
async function abrirComandaPelaLista(comandaId, numeroMesa, areaDestinoId) {
  // =========================
  // FECHAR OUTRA COMANDA
  // QUE ESTEJA ABERTA
  // =========================

  if (areaDestinoComandaAtual && areaDestinoComandaAtual !== areaDestinoId) {
    const areaAnterior = document.getElementById(areaDestinoComandaAtual);

    if (areaAnterior) {
      areaAnterior.innerHTML = "";

      areaAnterior.style.display = "none";
    }
  }

  // =========================
  // ENCONTRAR A MESA
  // =========================

  const snapMesa = await db
    .collection("mesas")
    .where("numero", "==", Number(numeroMesa))
    .limit(1)
    .get();

  if (snapMesa.empty) {
    alert("Mesa da comanda não encontrada.");

    return;
  }

  // =========================
  // DEFINIR MESA ATUAL
  // =========================

  mesaAbertaAtual = snapMesa.docs[0].id;

  // =========================
  // DEFINIR ONDE A COMANDA
  // SERÁ MOSTRADA
  // =========================

  areaDestinoComandaAtual = areaDestinoId;

  // =========================
  // ABRIR COMANDA
  // =========================

  await abrirComandaVisual(comandaId);
}
async function atenderChamadoMesa(chamadoId) {
  const chamado = chamadosMesaAbertosAtendente.find((chamado) => chamado.id === chamadoId);

  if (!chamado) {
    alert("Este chamado não está mais disponível.");

    return;
  }

  const confirmar = await confirmarOperacao(`Atender o chamado da Mesa ${chamado.mesaNumero}?`);

  if (!confirmar) {
    return;
  }

  const atendenteId = localStorage.getItem("atendenteId");

  const atendenteNome = localStorage.getItem("atendenteNome");

  try {
    await db
      .collection("chamadosMesa")
      .doc(chamadoId)
      .update({
        status: "atendido",

        atendenteId: atendenteId || "",

        atendenteNome: atendenteNome || "Atendente",

        atendidoEm: new Date().toISOString(),

        atendidoEmMs: Date.now(),
      });

    // Não precisa remover manualmente.
    // O onSnapshot perceberá que
    // status deixou de ser "aberto"
    // e atualizará tudo sozinho.
  } catch (erro) {
    console.error("Erro ao atender chamado:", erro);

    alert("Não foi possível atender o chamado.");
  }
}

async function abrirMesaAtendente(mesaId) {
  mesaAbertaAtual = mesaId;
  areaDestinoComandaAtual = null;

  const doc = await db.collection("mesas").doc(mesaId).get();

  const mesa = doc.data();

  const areaMesa = document.getElementById("area-mesa-atendente");
  areaMesa.dataset.mesaNumero = mesa.numero;

  const areaComanda = document.getElementById("area-comanda-atendente");

  areaMesa.style.display = "block";
  const areaProdutos = document.getElementById("area-produtos-comanda");

  if (areaProdutos) {
    areaProdutos.style.display = "none";

    areaProdutos.innerHTML = "";
  }

  if (areaComanda) {
    areaComanda.style.display = "none";
  }

  const snapComandas = await db
    .collection("comandas")
    .where("mesa", "==", mesa.numero)
    .where("status", "==", "Aberta")
    .get();

  let htmlComandas = "";

  snapComandas.forEach((doc) => {
    const c = doc.data();

    htmlComandas += `

           <button
    onclick="
        abrirComandaVisual(
            '${doc.id}',
            null
        )
    "
>
    👤 ${c.cliente}
</button>
`;
  });

  areaMesa.innerHTML = `

        <h3>
            Mesa ${mesa.numero}
        </h3>

        <div class="mesa-comandas-grade">${htmlComandas}</div>

        <button
            onclick="
                novaComandaMesa(
                    '${mesaId}'
                )
            "
        >
            ➕ Nova Comanda
        </button>

        <button
    type="button"
    onclick="
        abrirPedidosParaVincularNaMesa(
            '${mesaId}'
        )
    "
>
    🔗 Vincular Pedido Existente
</button>

    `;
}
async function abrirPedidosParaVincularNaMesa(mesaId) {
  const area = document.getElementById("area-mesa-atendente");

  if (!area) {
    return;
  }

  // =========================
  // BUSCAR MESA
  // =========================

  const mesaDoc = await db.collection("mesas").doc(mesaId).get();

  if (!mesaDoc.exists) {
    alert("Mesa não encontrada.");

    return;
  }

  const mesa = mesaDoc.data();

  // =========================
  // BUSCAR RETIRADAS
  // =========================

  const snap = await db.collection("pedidos").where("tipo", "==", "Retirada").get();

  const janela = obterJanelaAtualPedidosAtendente();

  const pedidos = [];

  snap.forEach((doc) => {
    const pedido = doc.data();

    // Cancelado

    if (pedido.cancelado === true) {
      return;
    }

    // Já retirado

    if (pedido.retirado === true) {
      return;
    }

    // Já vinculado

    if (pedido.vinculadoComanda === true) {
      return;
    }

    // Finalizado

    if (pedido.status === "Finalizado") {
      return;
    }

    // =========================
    // SOMENTE DIA OPERACIONAL
    // 2H ATÉ 2H
    // =========================

    const dataPedido = Number(pedido.dataMs || 0);

    if (dataPedido < janela.inicioMs || dataPedido >= janela.fimMs) {
      return;
    }

    pedidos.push({
      id: doc.id,

      ...pedido,
    });
  });

  // Mais novos primeiro

  pedidos.sort((a, b) => Number(b.dataMs || 0) - Number(a.dataMs || 0));

  // =========================
  // MONTAR PEDIDOS
  // =========================

  let htmlPedidos = "";

  if (pedidos.length === 0) {
    htmlPedidos = `

            <p>
                Nenhum pedido de Retirada
                disponível para vincular.
            </p>

        `;
  } else {
    htmlPedidos = pedidos
      .map((pedido) => {
        return `

                        <div
                            style="
                                margin-bottom:12px;
                                padding:10px;
                                border:1px solid #444;
                                border-radius:8px;
                            "
                        >

                            <strong>
                                Pedido #${pedido.numero || "-"}
                            </strong>

                            <br>

                            ${pedido.nome || "Cliente"}

                            <br><br>

                            R$ ${Number(pedido.valorTotal || 0).toFixed(2)}

                            <br>

                            ${pedido.pagamento || "Pagamento não informado"}

                            <br><br>


                            <button
                                type="button"
                                onclick="
                                    escolherDestinoPedidoNaMesa(
                                        '${pedido.id}',
                                        '${mesaId}'
                                    )
                                "
                            >
                                Selecionar Pedido
                            </button>

                        </div>

                    `;
      })
      .join("");
  }

  // =========================
  // MOSTRAR
  // =========================

  area.innerHTML = `

        <button
            type="button"
            onclick="
                abrirMesaAtendente(
                    '${mesaId}'
                )
            "
        >
            ⬅ Voltar
        </button>


        <h3>
            🔗 Vincular Pedido
        </h3>


        <p>
            Mesa ${mesa.numero}
        </p>


        <p>
            Escolha um pedido de Retirada.
        </p>


        <hr>


        ${htmlPedidos}

    `;
}
async function escolherDestinoPedidoNaMesa(pedidoId, mesaId) {
  const area = document.getElementById("area-mesa-atendente");

  if (!area) {
    return;
  }

  // =========================
  // BUSCAR PEDIDO
  // =========================

  const docPedido = await db.collection("pedidos").doc(pedidoId).get();

  if (!docPedido.exists) {
    alert("Pedido não encontrado.");

    return;
  }

  const pedido = docPedido.data();

  // =========================
  // BUSCAR MESA
  // =========================

  const mesaDoc = await db.collection("mesas").doc(mesaId).get();

  if (!mesaDoc.exists) {
    alert("Mesa não encontrada.");

    return;
  }

  const mesa = mesaDoc.data();

  // =========================
  // COMANDAS ABERTAS DA MESA
  // =========================

  const snapComandas = await db
    .collection("comandas")
    .where("mesa", "==", mesa.numero)
    .where("status", "==", "Aberta")
    .get();

  let htmlComandas = "";

  snapComandas.forEach((doc) => {
    const comanda = doc.data();

    htmlComandas += `

            <button
                type="button"
                onclick="
                    vincularPedidoComandaExistente(
                        '${pedidoId}',
                        '${mesaId}',
                        '${doc.id}'
                    )
                "
            >
                👤 ${comanda.cliente || "Cliente"}
            </button>

            <br><br>

        `;
  });

  // =========================
  // MONTAR TELA
  // =========================

  area.innerHTML = `

        <button
            type="button"
            onclick="
                abrirPedidosParaVincularNaMesa(
                    '${mesaId}'
                )
            "
        >
            ⬅ Voltar
        </button>


        <h3>
            🔗 Vincular Pedido
        </h3>


        <p>
            <strong>
                Pedido #${pedido.numero || "-"}
            </strong>
        </p>


        <p>
            Cliente:
            ${pedido.nome || "Cliente"}
        </p>


        <p>
            Mesa:
            ${mesa.numero}
        </p>


        <hr>


        ${
          htmlComandas
            ? `

                    <h4>
                        Comandas abertas
                    </h4>

                    ${htmlComandas}

                    <hr>

                `
            : `

                    <p>
                        Nenhuma comanda aberta nesta mesa.
                    </p>

                    <hr>

                `
        }


        <button
            type="button"
            onclick="
                vincularPedidoNovaComanda(
                    '${pedidoId}',
                    '${mesaId}'
                )
            "
        >
            ➕ Nova Comanda
        </button>

    `;
}

async function abrirMesaNovaAtendente(numero) {
  try {
    // Reutiliza mesas já cadastradas, inclusive as que têm IDs antigos.
    const existentes = await db.collection("mesas").where("numero", "==", numero).limit(1).get();
    let id = existentes.docs[0]?.id;
    if (!id) {
      const ref = db.collection("mesas").doc("mesa-" + numero);
      await db.runTransaction(async (transacao) => {
        const doc = await transacao.get(ref);
        if (!doc.exists) transacao.set(ref, { numero, ocupada: false });
      });
      id = ref.id;
    }
    await abrirMesaAtendente(id);
  } catch (erro) {
    alert("Não foi possível abrir a mesa. Tente novamente.");
  }
}
async function areaConsumoLocalRecarregar() {
  const area = document.getElementById("area-consumo-local");
  if (!area) return;
  const snap = await db.collection("mesas").orderBy("numero").get();
  const mesas = new Map();
  snap.forEach((doc) => mesas.set(Number(doc.data().numero), { ...doc.data(), id: doc.id }));
  // Mesas novas são cadastradas somente no primeiro uso, sem alterar as existentes.
  for (let numero = 1; numero <= 20; numero++) {
    if (!mesas.has(numero)) mesas.set(numero, { numero, ocupada: false });
  }
  area.innerHTML =
    '<div class="mesas-atendente-grade">' +
    [...mesas.values()]
      .sort((a, b) => a.numero - b.numero)
      .map(
        (mesa) =>
          `<button type="button" class="mesa-atendente" style="background:${mesa.ocupada ? "#ff8080" : "#90ee90"}" onclick="${mesa.id ? `abrirMesaAtendente('${escaparOperacao(mesa.id)}')` : `abrirMesaNovaAtendente(${mesa.numero})`}">Mesa ${mesa.numero}</button>`,
      )
      .join("") +
    "</div>";
}
async function adicionarItemComanda(comandaId) {
  alert("Próximo passo: Adicionar produtos");
}
async function abrirComandaVisual(comandaId) {
  comandaAbertaAtual = comandaId;

  const docComanda = await db.collection("comandas").doc(comandaId).get();

  if (!docComanda.exists) {
    if (typeof limparHistoricoComandaUI === "function") limparHistoricoComandaUI(comandaId);
    if (typeof fecharFluxoAtendenteUI === "function") fecharFluxoAtendenteUI();
    return;
  }

  const comanda = docComanda.data();
  if (comanda.status !== "Aberta") {
    if (typeof limparHistoricoComandaUI === "function") limparHistoricoComandaUI(comandaId);
    if (typeof fecharFluxoAtendenteUI === "function") fecharFluxoAtendenteUI();
    return;
  }

  const area = areaDestinoComandaAtual
    ? document.getElementById(areaDestinoComandaAtual)
    : document.getElementById("area-comanda-atendente");

  if (!area) {
    return;
  }

  area.style.display = "block";

  let htmlItens = "";

  if (!comanda.itens || comanda.itens.length === 0) {
    htmlItens = "<p>Nenhum item.</p>";
  } else {
    htmlItens = comanda.itens
      .map((item, index) => {
        const htmlDetalhes = detalhesItemOperacao(item);

        return `
          <div class="comanda-item-linha">
            <div class="comanda-item-resumo">
              <strong>${item.quantidade || 1} ${escaparOperacao(item.nome)}</strong>
              <span>R$ ${Number(item.subtotal || 0).toFixed(2)}</span>
            </div>
            <div class="comanda-item-detalhes">${htmlDetalhes}</div>
            <button type="button" class="comanda-item-acao" data-acao-comanda="editar" ${modoEditarItem ? "" : "hidden"} onclick="editarItemComanda('${comandaId}', ${index})">Editar</button>
            <button type="button" class="comanda-item-acao" data-acao-comanda="remover" ${modoRemoverItem ? "" : "hidden"} onclick="removerItemComanda('${comandaId}', ${index})">Remover</button>
          </div>`;
      })
      .join("");
  }

  area.innerHTML = `

        ${
          areaDestinoComandaAtual
            ? `

            <button
                type="button"
                onclick="
                    fecharComandaNaLista(
                        '${areaDestinoComandaAtual}'
                    )
                "
            >
                ✕ Fechar
            </button>

        `
            : `

            <button
                onclick="
                    abrirMesaAtendente(
                        '${mesaAbertaAtual}'
                    )
                "
            >
                ⬅ Voltar para Mesa
            </button>

        `
        }

        <h3>
            Cliente: ${comanda.cliente}
        </h3>

        <p>
            Mesa: ${comanda.mesa}
        </p>

        <hr>

        <h4>Itens</h4>

        <div class="comanda-itens-lista">${htmlItens}</div>

        <hr>

        <p>
            Total:
            R$ ${Number(comanda.valorTotal || 0).toFixed(2)}
        </p>

        <div class="comanda-acoes-itens">
<button
           onclick="
    abrirBuscaProdutos(
        '${comandaId}'
    )
"
        >
            ➕ Adicionar Item
        </button>

       <button
    onclick="
        ativarRemoverItens(
            '${comandaId}'
        )
    "
>
➖ Remover Item
</button>

       <button
    onclick="
        ativarEditarItens(
            '${comandaId}'
        )
    "
>
    ✏️ Editar Item
</button>

<button
    onclick="
        cancelarComandaAtendente(
            '${comandaId}'
        )
    "
>
    ❌ Cancelar Comanda
</button>

<button
    onclick="
        abrirFechamentoComanda(
            '${comandaId}'
        )
    "
>
    💰 Fechar Comanda
</button>
</div>
<div
    id="area-fechamento-comanda"
    style="
        display:none;
        position:relative;
        margin-top:20px;
        padding:15px;
        border:2px solid #444;
        border-radius:10px;
    "
></div>

    `;
}
async function novaComandaMesa(mesaId) {
  const nomeCliente = await solicitarTextoUI("Nome do cliente");

  if (!nomeCliente) return;

  const mesaDoc = await db.collection("mesas").doc(mesaId).get();

  const mesa = mesaDoc.data();

  const atendenteId = localStorage.getItem("atendenteId");

  const atendenteNome = localStorage.getItem("atendenteNome");

  await db.collection("comandas").add({
    cliente: nomeCliente,

    mesa: mesa.numero,

    status: "Aberta",

    atendenteId,

    atendenteNome,

    criadoEm: Date.now(),

    itens: [],

    valorTotal: 0,
  });

  await db.collection("mesas").doc(mesaId).update({
    ocupada: true,
  });

  areaConsumoLocalRecarregar();

  abrirMesaAtendente(mesaId);
}
async function abrirBuscaProdutos(comandaId) {
  document.getElementById("area-comanda-atendente").style.display = "none";

  const area = document.getElementById("area-produtos-comanda");

  area.style.display = "block";

  area.innerHTML = `

<button
onclick="
abrirComandaVisual(
'${comandaId}'
)
"
>
⬅ Voltar para Comanda
</button>

<h3>

Adicionar Item

</h3>

<input
type="text"
id="busca-produto-atendente"
placeholder="Buscar produto..."
onkeyup="
pesquisarProdutoAtendente(
'${comandaId}'
)
"
>



<div
id="resultado-busca-produtos"
></div>

<div class="comanda-categorias"
style="
display:flex;
gap:10px;
overflow-x:auto;
margin-top:15px;
margin-bottom:15px;
"
>

<button
onclick="
carregarCategoriaProdutos(
'${comandaId}',
'lanches'
)
"
>
🍔 Lanches
</button>

<button
onclick="
carregarCategoriaProdutos(
'${comandaId}',
'combos'
)
"
>
🍔🥤 Combos
</button>

<button
onclick="
carregarCategoriaProdutos(
'${comandaId}',
'batatas'
)
"
>
🍟 Batatas
</button>

<button
onclick="
carregarCategoriaProdutos(
'${comandaId}',
'bebidas'
)
"
>
🥤 Bebidas
</button>

</div>

<div
id="lista-categoria-produtos"
></div>

`;
}
async function pesquisarProdutoAtendente(comandaId) {
  const termo = normalizarBuscaUI(document.getElementById("busca-produto-atendente").value);

  const listaCategoria = document.getElementById("lista-categoria-produtos");

  const resultado = document.getElementById("resultado-busca-produtos");

  const snap = await db.collection("produtos").get();

  let produtosEncontrados = [];

  snap.forEach((doc) => {
    const p = doc.data();
    if (p.ativo === false || p.esgotado) return;

    const nomeProduto = normalizarBuscaUI(p.nome);
    const encontrou = nomeProduto.includes(termo);

    if (!encontrou) return;

    produtosEncontrados.push({
      id: doc.id,

      nome: p.nome,

      preco: p.preco || 0,
    });
  });

  produtosEncontrados.sort((a, b) => a.preco - b.preco);

  let html = "";

  produtosEncontrados.forEach((produto) => {
    html += `

            <button
                onclick="
                    abrirPainelProduto(
                        '${comandaId}',
                        '${produto.id}'
                    )
                "
            >
                ${produto.nome}
                -
                R$ ${Number(produto.preco).toFixed(2)}
            </button>

            <br><br>

        `;
  });

  if (termo === "") {
    resultado.innerHTML = "";

    return;
  }

  listaCategoria.innerHTML = "";

  resultado.innerHTML = html;
}

async function confirmarProdutoComanda(comandaId, produtoId) {
  const quantidade = Number(document.getElementById("quantidade-produto").value);

  if (!quantidade || quantidade <= 0) return;

  const docProduto = await db.collection("produtos").doc(produtoId).get();

  const produto = docProduto.data();

  const docComanda = await db.collection("comandas").doc(comandaId).get();

  const comanda = docComanda.data();

  const itens = comanda.itens || [];
  const pagamentosRealizados = comanda.pagamentos || [];

  const valorComanda = Number(comanda.valorTotal || 0);

  const valorQuitado = pagamentosRealizados.reduce((soma, pagamento) => {
    return soma + Number(pagamento.valorQuitado ?? pagamento.valor ?? 0);
  }, 0);

  const saldoPendente = Math.max(valorComanda - valorQuitado, 0);

  // =========================
  // DESCOBRIR QUANTO DE CADA
  // ITEM JÁ FOI PAGO
  // =========================

  const quantidadesPagas = {};

  pagamentosRealizados.forEach((pagamento) => {
    (pagamento.itens || []).forEach((itemPago) => {
      const index = Number(itemPago.itemIndex);

      quantidadesPagas[index] =
        Number(quantidadesPagas[index] || 0) + Number(itemPago.quantidade || 0);
    });
  });

  itens.push({
    nome: produto.nome,

    quantidade,

    precoUnitario: Number(produto.preco || 0),

    subtotal: Number(produto.preco || 0) * quantidade,
  });

  const novoTotal = itens.reduce((total, item) => total + Number(item.subtotal || 0), 0);

  await db.collection("comandas").doc(comandaId).update({
    itens,

    valorTotal: novoTotal,
  });

  document.getElementById("area-config-produto").style.display = "none";

  abrirComandaVisual(comandaId);
}
async function removerItemComanda(comandaId, indiceItem) {
  const confirmar = await confirmarOperacao("Remover item?");

  if (!confirmar) return;

  const docComanda = await db.collection("comandas").doc(comandaId).get();

  const comanda = docComanda.data();

  const itens = comanda.itens || [];

  const itemRemovido = itens[indiceItem];

  const pedidoOrigemId = itemRemovido?.pedidoOrigemId || null;

  itens.splice(indiceItem, 1);

  const novoTotal = itens.reduce((total, item) => total + Number(item.subtotal || 0), 0);

  await db.collection("comandas").doc(comandaId).update({
    itens,

    valorTotal: novoTotal,
  });
  if (pedidoOrigemId) {
    await sincronizarPedidoOrigemDaComanda(comandaId, pedidoOrigemId);
  }

  modoRemoverItem = false;

  abrirComandaVisual(comandaId);
}
function ativarRemoverItens(comandaId) {
  modoRemoverItem = !modoRemoverItem;

  if (modoRemoverItem) {
    modoEditarItem = false;
  }

  atualizarAcoesItensComandaUI();
}
async function editarItemComanda(comandaId, index) {
  const docComanda = await db.collection("comandas").doc(comandaId).get();

  if (!docComanda.exists) {
    alert("Comanda não encontrada.");

    return;
  }

  const comanda = docComanda.data();

  const itens = comanda.itens || [];

  const item = itens[index];

  if (!item) {
    alert("Item não encontrado.");

    return;
  }

  // =========================
  // COMBO
  // =========================

  if (String(item.categoria || "").toLowerCase() === "combos") {
    await editarComboComanda(comandaId, index, item);

    return;
  }

  // =========================
  // PRODUTO NORMAL
  // =========================

  editarProdutoNormalComanda(comandaId, index, item);
}
async function editarProdutoNormalComanda(comandaId, index, item) {
  if (!item.produtoId) {
    const produtoIdEncontrado = await localizarProdutoIdPedido(item);

    if (!produtoIdEncontrado) {
      alert("Não foi possível localizar este produto no cadastro.");

      return;
    }

    // =========================
    // CORRIGIR ITEM ANTIGO
    // =========================

    item.produtoId = produtoIdEncontrado;

    item.tipo = descobrirTipoNomePedido(item.nome, item.tipo);

    item.nome = limparTipoDoNomePedido(item.nome);

    item.observacao = item.observacao ?? item.obs ?? "";

    item.categoria = String(item.categoria || "").toLowerCase();
  }

  itemComandaEmEdicao = {
    comandaId,
    index,
  };

  // Abre o mesmo painel usado
  // para adicionar produto

  await abrirPainelProduto(comandaId, item.produtoId);

  // =========================
  // QUANTIDADE
  // =========================

  const qtd = document.getElementById("quantidade-produto-config");

  if (qtd) {
    qtd.textContent = Number(item.quantidade || 1);
  }

  // =========================
  // OBSERVAÇÃO
  // =========================

  const observacao = document.getElementById("observacao-produto-config");

  if (observacao) {
    observacao.value = item.observacao || "";
  }

  // =========================
  // TIPO
  // =========================

  if (item.tipo) {
    const opcao = document.querySelector(`input[name="tipo-produto"][value="${item.tipo}"]`);

    if (opcao) {
      opcao.checked = true;
    }
  }

  // =========================
  // ADICIONAIS
  // =========================

  if (item.adicionais && item.adicionais.length > 0) {
    mostrarAcrescimosProduto(true);
  }
  (item.adicionais || []).forEach((adicional) => {
    const quantidade = document.getElementById(`qtd-adicional-${adicional.id}`);

    if (quantidade) {
      quantidade.textContent = Number(adicional.qtd || 0);
    }
  });

  atualizarPrecoProduto();
}
function ativarEditarItens(comandaId) {
  modoEditarItem = !modoEditarItem;

  // Não deixa edição e remoção
  // abertas ao mesmo tempo
  if (modoEditarItem) {
    modoRemoverItem = false;
  }

  atualizarAcoesItensComandaUI();
}
async function editarComboComanda(comandaId, index, item) {
  if (!item.produtoId) {
    const produtoIdEncontrado = await localizarProdutoIdPedido(item);

    if (!produtoIdEncontrado) {
      alert("Não foi possível localizar este combo no cadastro.");

      return;
    }

    // =========================
    // CORRIGIR COMBO ANTIGO
    // =========================

    item.produtoId = produtoIdEncontrado;

    item.nome = limparTipoDoNomePedido(item.nome);

    item.categoria = "combos";

    item.observacao = item.observacao ?? item.obs ?? "";

    // Se veio do site e não possui
    // modo de personalização salvo,
    // trata como combo padrão.

    if (!item.modoPersonalizacaoCombo) {
      item.modoPersonalizacaoCombo = "padrao";
    }

    if (!Array.isArray(item.lanchesCombo)) {
      item.lanchesCombo = [];
    }
  }

  // =========================
  // MARCAR ITEM EM EDIÇÃO
  // =========================

  itemComandaEmEdicao = {
    comandaId,
    index,
  };

  // =========================
  // ABRIR PAINEL DO COMBO
  // =========================

  await abrirPainelProduto(comandaId, item.produtoId);

  // =========================
  // QUANTIDADE
  // =========================

  const elementoQuantidade = document.getElementById("quantidade-produto-config");

  if (elementoQuantidade) {
    elementoQuantidade.textContent = Number(item.quantidade || 1);
  }

  // =========================
  // OBSERVAÇÃO GERAL
  // =========================

  const campoObservacao = document.getElementById("observacao-produto-config");

  if (campoObservacao) {
    campoObservacao.value = item.observacao || "";
  }

  // =========================
  // LIMPAR ESTADO TEMPORÁRIO
  // =========================

  configuracoesLanchesCombo = {};

  configuracaoTodosCombo = null;

  modoPersonalizacaoCombo = "";
  // =========================
  // DESCOBRIR MODO SALVO
  // =========================

  const modoSalvo = item.modoPersonalizacaoCombo || "padrao";

  // =====================================================
  // PERSONALIZADO
  // =====================================================

  if (modoSalvo === "individual") {
    (item.lanchesCombo || []).forEach((lanche) => {
      const adicionais = (lanche.adicionais || []).map((adicional) => ({
        id: adicional.id,

        nome: adicional.nome,

        preco: Number(adicional.preco || 0),

        qtd: Number(adicional.qtd || 0),
      }));

      const observacao = lanche.observacao || "";

      // Só guarda se realmente
      // existir personalização

      if (adicionais.length > 0 || observacao) {
        configuracoesLanchesCombo[lanche.numero] = {
          adicionais,

          observacao,
        };
      }
    });

    // Faz a interface mostrar
    // o modo Personalizado

    selecionarModoCombo("individual");

    atualizarTodosStatusLanchesCombo();
  }

  // =====================================================
  // APLICAR PARA TODOS
  // =====================================================
  else if (modoSalvo === "todos") {
    const primeiroLanche = (item.lanchesCombo || [])[0];

    if (primeiroLanche) {
      configuracaoTodosCombo = {
        adicionais: (primeiroLanche.adicionais || []).map((adicional) => ({
          id: adicional.id,

          nome: adicional.nome,

          preco: Number(adicional.preco || 0),

          qtd: Number(adicional.qtd || 0),
        })),

        observacao: primeiroLanche.observacao || "",
      };
    }

    selecionarModoCombo("todos");

    atualizarResumoTodosCombo();
  }

  // =====================================================
  // COMBO PADRÃO
  // =====================================================
  else {
    modoPersonalizacaoCombo = "";

    configuracoesLanchesCombo = {};

    configuracaoTodosCombo = null;
  }

  // =========================
  // ATUALIZAR PREÇO
  // =========================

  atualizarPrecoComboPersonalizado();
}
async function cancelarComandaAtendente(comandaId) {
  const confirmar = await confirmarOperacao(
    "Cancelar esta comanda? Os itens pendentes também serão retirados da cozinha.",
  );

  if (!confirmar) {
    return;
  }

  // =========================
  // BUSCAR COMANDA
  // =========================

  const refComanda = db.collection("comandas").doc(comandaId);

  const docComanda = await refComanda.get();

  if (!docComanda.exists) {
    alert("Comanda não encontrada.");

    return;
  }

  const comanda = docComanda.data();

  // =========================
  // SEGURANÇA
  // =========================

  if (comanda.status !== "Aberta") {
    alert("Esta comanda não está aberta.");

    return;
  }

  // =========================
  // VERIFICAR PAGAMENTOS
  // =========================

  const pagamentos = comanda.pagamentos || [];

  if (pagamentos.length > 0) {
    alert("Esta comanda já possui pagamento registrado e não pode ser cancelada diretamente.");

    return;
  }

  // =========================
  // CANCELAR
  // =========================

  await refComanda.update({
    status: "Cancelada",

    canceladoEm: Date.now(),
  });
  await cancelarPreparoComandaOperacao(comandaId);

  // =========================
  // VER SE EXISTE OUTRA
  // COMANDA ABERTA NA MESA
  // =========================

  const outrasComandas = await db
    .collection("comandas")
    .where("mesa", "==", comanda.mesa)
    .where("status", "==", "Aberta")
    .get();

  // =========================
  // LIBERAR MESA
  // =========================

  if (outrasComandas.empty && mesaAbertaAtual) {
    await db.collection("mesas").doc(mesaAbertaAtual).update({
      ocupada: false,
    });
  }

  // =========================
  // LIMPAR ESTADOS
  // =========================

  modoRemoverItem = false;

  modoEditarItem = false;

  itemComandaEmEdicao = null;

  selecaoPagamentoSeparado = [];

  comandaAbertaAtual = null;

  // =========================
  // ATUALIZAR MESAS
  // =========================

  await areaConsumoLocalRecarregar();

  // =========================
  // VOLTAR PARA MESA
  // =========================

  await abrirMesaAtendente(mesaAbertaAtual);
}

async function calcularFidelidadeComandaAtendente(comanda) {
  // =========================
  // SEM CLIENTE VINCULADO
  // =========================

  if (!comanda || !comanda.clienteId) {
    return {
      cliente: null,

      descontoFidelidade: 0,

      valorOriginal: Number(comanda?.valorTotal || 0),

      valorFinal: Number(comanda?.valorTotal || 0),

      bonusNovoGerado: 0,

      bonusRestante: 0,
    };
  }

  // =========================
  // USAR A MESMA REGRA
  // DE FIDELIDADE
  // =========================

  return await calcularFidelidadeClientePagamentoSeparado(
    comanda.clienteId,

    Number(comanda.valorTotal || 0),
  );
}

async function buscarCuponsGeraisElegiveisAtendente(valorBase) {
  const valor = Number(valorBase || 0);

  const snap = await db.collection("cuponsDesconto").where("ativo", "==", true).get();

  const cupons = [];

  snap.forEach((doc) => {
    const cupom = {
      id: doc.id,

      ...doc.data(),
    };

    // =========================
    // CONSUMO LOCAL
    // POR ENQUANTO:
    // CUPOM SOBRE O PEDIDO
    // =========================

    if (cupom.tipo !== "pedido") {
      return;
    }

    // =========================
    // PEDIDO MÍNIMO
    // =========================

    if (cupom.temPedidoMinimo === true) {
      const minimo = Number(cupom.pedidoMinimo || 0);

      if (valor < minimo) {
        return;
      }
    }

    cupons.push(cupom);
  });

  return cupons;
}
async function selecionarCupomPagamentoAtendente(cupomId, comandaId) {
  const cupom = cuponsPagamentoAtendenteAtuais.find((item) => item.id === cupomId);

  if (!cupom) {
    alert("Cupom não encontrado.");

    return;
  }

  cupomPagamentoAtendenteAtual = cupom;

  await abrirPagamentoTudoJunto(comandaId, true);
}
async function removerCupomPagamentoAtendente(comandaId) {
  cupomPagamentoAtendenteAtual = null;

  await abrirPagamentoTudoJunto(comandaId, true);
}

async function abrirFechamentoComanda(comandaId) {
  const area = document.getElementById("area-fechamento-comanda");

  if (!area) {
    return;
  }

  const docComanda = await db.collection("comandas").doc(comandaId).get();

  if (!docComanda.exists) {
    alert("Comanda não encontrada.");

    return;
  }

  const comanda = docComanda.data();

  // =========================
  // VALOR ORIGINAL
  // =========================

  const valorOriginal = Number(comanda.valorTotal || 0);

  // =========================
  // CLIENTE / FIDELIDADE
  // =========================

  const fidelidade = await calcularFidelidadeComandaAtendente(comanda);

  const descontoFidelidade = Number(fidelidade.descontoFidelidade || 0);

  const valorFinal = Math.max(
    valorOriginal - descontoFidelidade,

    0,
  );

  // =========================
  // INFORMAÇÃO DO CLIENTE
  // =========================

  let htmlCliente = `

        <p>
            👤 Sem conta vinculada
        </p>

    `;

  if (fidelidade.cliente) {
    htmlCliente = `

            <div
                style="
                    margin:15px 0;
                    padding:12px;
                    border:1px solid #444;
                    border-radius:8px;
                "
            >

                <strong>
                    👤 ${fidelidade.cliente.nome || comanda.cliente || "Cliente"}
                </strong>

            </div>

        `;
  }

  // =========================
  // INFORMAÇÃO DO BÔNUS
  // =========================

  let htmlBonus = "";

  if (descontoFidelidade > 0) {
    htmlBonus = `

            <p
                style="
                    font-weight:bold;
                "
            >
                🎁 Bônus fidelidade:
                - R$ ${descontoFidelidade.toFixed(2)}
            </p>

        `;
  }

  area.style.display = "block";

  area.innerHTML = `

        <button
            type="button"
            onclick="
                fecharPainelPagamento()
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
            Fechar Comanda
        </h3>


        ${htmlCliente}


        <p>
            Valor da comanda:
            <strong>
                R$ ${valorOriginal.toFixed(2)}
            </strong>
        </p>


        ${htmlBonus}


        ${
          descontoFidelidade > 0
            ? `

                    <p>
                        Total após bônus:
                        <strong>
                            R$ ${valorFinal.toFixed(2)}
                        </strong>
                    </p>

                `
            : ""
        }


        <hr>


        <h4>
            Como será o pagamento?
        </h4>


        <button
            type="button"
            onclick="
                abrirPagamentoTudoJunto(
                    '${comandaId}'
                )
            "
        >
            👥 Tudo junto
        </button>


        <button
            type="button"
            onclick="
                abrirPagamentoSeparado(
                    '${comandaId}'
                )
            "
        >
            🧾 Separado
        </button>

    `;

  area.scrollIntoView({
    behavior: "smooth",

    block: "center",
  });
}
function fecharPainelPagamento() {
  const area = document.getElementById("area-fechamento-comanda");

  if (!area) return;

  area.style.display = "none";

  area.innerHTML = "";
}
async function abrirPagamentoTudoJunto(comandaId, preservarCupom = false) {
  const area = document.getElementById("area-fechamento-comanda");

  if (!area) return;

  const docComanda = await db.collection("comandas").doc(comandaId).get();

  if (!docComanda.exists) return;

  const comanda = docComanda.data();

  // =========================
  // VALOR ORIGINAL
  // =========================

  const valorOriginal = Number(comanda.valorTotal || 0);

  // =========================
  // LIMPAR CUPOM
  // SOMENTE AO ABRIR DO ZERO
  // =========================

  if (preservarCupom !== true) {
    cupomPagamentoAtendenteAtual = null;
  }

  // =========================
  // CUPONS DISPONÍVEIS
  // =========================

  cuponsPagamentoAtendenteAtuais = await buscarCuponsElegiveisAtendente(
    valorOriginal,

    comanda.itens || [],
    comanda.clienteId || null,
  );

  // =========================
  // MANTER CUPOM SELECIONADO
  // APÓS RECALCULAR A TELA
  // =========================

  if (cupomPagamentoAtendenteAtual) {
    const cupomAtualizado = cuponsPagamentoAtendenteAtuais.find(
      (cupom) => cupom.id === cupomPagamentoAtendenteAtual.id,
    );

    cupomPagamentoAtendenteAtual = cupomAtualizado || null;
  }

  // =========================
  // DESCONTO DO CUPOM
  // CUPOM VEM PRIMEIRO
  // =========================

  const descontoCupom = Number(cupomPagamentoAtendenteAtual?.descontoCalculado || 0);

  const valorAposCupom = Math.max(
    valorOriginal - descontoCupom,

    0,
  );

  // =========================
  // FIDELIDADE
  // CALCULA SOBRE O VALOR
  // QUE SOBROU APÓS O CUPOM
  // =========================

  const fidelidade = await calcularFidelidadeClientePagamentoSeparado(
    comanda.clienteId || null,

    valorAposCupom,
  );

  const descontoFidelidade = Number(fidelidade.descontoFidelidade || 0);

  // =========================
  // TOTAL FINAL
  // =========================

  const total = Math.max(
    valorAposCupom - descontoFidelidade,

    0,
  );

  let htmlCupons = `



`;

  if (cuponsPagamentoAtendenteAtuais.length === 0) {
    htmlCupons += `

        <p>
            Nenhum cupom disponível
            para esta compra.
        </p>

    `;
  } else {
    cuponsPagamentoAtendenteAtuais.forEach((cupom) => {
      const textoDesconto = `Desconto nesta compra: R$ ${Number(
        cupom.descontoCalculado || 0,
      ).toFixed(2)}`;

      let textoMinimo = "Sem valor mínimo";

      if (cupom.temPedidoMinimo === true) {
        textoMinimo = `Mínimo: R$ ${Number(cupom.pedidoMinimo || 0).toFixed(2)}`;
      }

      htmlCupons += `

                    <div
                        id="cupom-atendente-${cupom.id}"
                        class="cupom-atendente-opcao"
                        style="
                            padding:10px;
                            margin-bottom:10px;
                            border:1px solid #444;
                            border-radius:8px;
                        "
                    >

                        <strong>
                            🎟 ${cupom.codigo}
                        </strong>

                        <br>

                        ${cupom.nome || ""}

                        <br>

                        <strong>
                            ${textoDesconto}
                        </strong>

                        <br>

                        <small>
                            ${textoMinimo}
                        </small>

                        <br><br>

                        <button
                            type="button"
                          onclick="
    selecionarCupomPagamentoAtendente(
        '${cupom.id}',
        '${comandaId}'
    )
"
                        >
                            Usar este cupom
                        </button>

                    </div>

                `;
    });
  }

  if (cupomPagamentoAtendenteAtual) {
    htmlCupons += `

        <div
            style="
                margin-top:15px;
                padding:10px;
                border:1px solid #00c853;
                border-radius:8px;
            "
        >

            ✅ Cupom aplicado:

            <strong>
                ${cupomPagamentoAtendenteAtual.codigo}
            </strong>

            <br><br>

            Desconto:

            <strong>
                - R$ ${descontoCupom.toFixed(2)}
            </strong>

            <br><br>

            <button
                type="button"
                onclick="
                    removerCupomPagamentoAtendente(
                        '${comandaId}'
                    )
                "
            >
                Remover cupom
            </button>

        </div>

    `;
  }
  htmlCupons += `

    <div
        id="status-cupom-atendente"
        style="
            margin-top:10px;
        "
    ></div>

`;

  area.innerHTML = `

        <button
            type="button"
            onclick="
                abrirFechamentoComanda(
                    '${comandaId}'
                )
            "
        >
            ⬅ Voltar
        </button>


        <button
            type="button"
            onclick="
                fecharPainelPagamento()
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
            Tudo junto
        </h3>


     <p>
    Valor da comanda:
    <strong>
        R$ ${valorOriginal.toFixed(2)}
    </strong>
</p>

${
  descontoCupom > 0
    ? `
            <p>
                🎟 Cupom ${cupomPagamentoAtendenteAtual?.codigo || ""}:

                <strong>
                    - R$ ${descontoCupom.toFixed(2)}
                </strong>
            </p>
        `
    : ""
}

${
  descontoFidelidade > 0
    ? `
            <p>
                🎁 Bônus fidelidade:
                <strong>
                    - R$ ${descontoFidelidade.toFixed(2)}
                </strong>
            </p>
        `
    : ""
}


<p>
    Total a pagar:
    <strong>
        R$ ${total.toFixed(2)}
    </strong>
</p>


<hr>


<button type="button" class="cupons-pagamento-abrir-ui" aria-expanded="false" onclick="alternarCuponsPagamentoUI()">Cupons disponíveis</button><div id="cupons-disponiveis-pagamento-ui" style="display:none">${htmlCupons}</div>


<hr>


<h4>
    Forma de pagamento
</h4>


        <label>

            <input
                type="radio"
                name="forma-pagamento-unica" onchange="desativarPagamentoMistoUI('area-pagamento-misto')"
                value="Dinheiro"
            >

            💵 Dinheiro

        </label>


        <br><br>


        <label>

            <input
                type="radio"
                name="forma-pagamento-unica" onchange="desativarPagamentoMistoUI('area-pagamento-misto')"
                value="Pix"
            >

            📱 Pix

        </label>


        <br><br>


        <label>

            <input
                type="radio"
                name="forma-pagamento-unica" onchange="desativarPagamentoMistoUI('area-pagamento-misto')"
                value="Débito"
            >

            💳 Débito

        </label>


        <br><br>


        <label>

            <input
                type="radio"
                name="forma-pagamento-unica" onchange="desativarPagamentoMistoUI('area-pagamento-misto')"
                value="Crédito"
            >

            💳 Crédito

        </label>


        <br><br>


        <button
            type="button"
            onclick="
                alternarPagamentoMisto()
            "
        >
            💳 Usar mais de uma forma
        </button>


        <div
            id="area-pagamento-misto"
            style="
                display:none;
                margin-top:20px;
            "
        >

            <hr>

            <h4>
                Pagamento misto
            </h4>


            <label>
                Dinheiro
            </label>

            <br>

            R$

            <input
                type="number"
                id="pagamento-dinheiro"
                min="0"
                step="0.01"
                value="0"
                oninput="
                    atualizarResumoPagamentoMisto(
                        ${total}
                    )
                "
            >


            <br><br>


            <label>
                Pix
            </label>

            <br>

            R$

            <input
                type="number"
                id="pagamento-pix"
                min="0"
                step="0.01"
                value="0"
                oninput="
                    atualizarResumoPagamentoMisto(
                        ${total}
                    )
                "
            >


            <br><br>


            <label>
                Débito
            </label>

            <br>

            R$

            <input
                type="number"
                id="pagamento-debito"
                min="0"
                step="0.01"
                value="0"
                oninput="
                    atualizarResumoPagamentoMisto(
                        ${total}
                    )
                "
            >


            <br><br>


            <label>
                Crédito
            </label>

            <br>

            R$

            <input
                type="number"
                id="pagamento-credito"
                min="0"
                step="0.01"
                value="0"
                oninput="
                    atualizarResumoPagamentoMisto(
                        ${total}
                    )
                "
            >


            <br><br>


            <div
                id="resumo-pagamento-misto"
            >

                Total informado:
                R$ 0,00

                <br>

                Restante:
                R$ ${total.toFixed(2)}

            </div>

        </div>


        <br><br>


        <button
            type="button"
            onclick="
                confirmarPagamentoTudoJunto(
                    '${comandaId}',
                    ${total}
                )
            "
        >
            ✅ PAGO
        </button>

    `;
}
function alternarPagamentoMisto() {
  const area = document.getElementById("area-pagamento-misto");

  if (!area) return;

  const abrindo = area.style.display === "none";

  area.style.display = abrindo ? "block" : "none";

  // Se abrir o misto,
  // desmarca pagamento único

  if (abrindo) {
    document.querySelectorAll('input[name="forma-pagamento-unica"]').forEach((radio) => {
      radio.checked = false;
    });
  }
}
function atualizarResumoPagamentoMisto(total) {
  const dinheiro = Number(document.getElementById("pagamento-dinheiro")?.value || 0);

  const pix = Number(document.getElementById("pagamento-pix")?.value || 0);

  const debito = Number(document.getElementById("pagamento-debito")?.value || 0);

  const credito = Number(document.getElementById("pagamento-credito")?.value || 0);

  const informado = dinheiro + pix + debito + credito;

  const restante = total - informado;

  const resumo = document.getElementById("resumo-pagamento-misto");

  if (!resumo) return;

  resumo.innerHTML = htmlResumoPagamentoMistoUI(informado, restante);
}
async function confirmarPagamentoTudoJunto(comandaId, total) {
  const areaMisto = document.getElementById("area-pagamento-misto");

  const usandoMisto =
    areaMisto && (areaMisto.dataset?.ativo === "sim" || areaMisto.style.display !== "none");

  let pagamentos = [];

  // =========================
  // PAGAMENTO MISTO
  // =========================

  if (usandoMisto) {
    const formas = [
      {
        forma: "Dinheiro",

        valor: Number(document.getElementById("pagamento-dinheiro")?.value || 0),
      },

      {
        forma: "Pix",

        valor: Number(document.getElementById("pagamento-pix")?.value || 0),
      },

      {
        forma: "Débito",

        valor: Number(document.getElementById("pagamento-debito")?.value || 0),
      },

      {
        forma: "Crédito",

        valor: Number(document.getElementById("pagamento-credito")?.value || 0),
      },
    ];

    pagamentos = formas.filter((pagamento) => pagamento.valor > 0);

    const totalInformado = pagamentos.reduce((soma, pagamento) => soma + pagamento.valor, 0);

    if (centavosOperacao(totalInformado) !== centavosOperacao(total)) {
      alert(`O pagamento precisa fechar exatamente R$ ${Number(total).toFixed(2)}.`);

      return;
    }
  }

  // =========================
  // FORMA ÚNICA
  // =========================
  else {
    const selecionado = document.querySelector('input[name="forma-pagamento-unica"]:checked');

    if (!selecionado) {
      alert("Escolha a forma de pagamento.");

      return;
    }

    pagamentos = [
      {
        forma: selecionado.value,

        valor: Number(total),
      },
    ];
  }

  // =========================
  // CONFIRMAÇÃO MANUAL
  // =========================

  const confirmar = await confirmarOperacao("Pagamento realmente confirmado?");

  if (!confirmar) return;

  // =========================
  // BUSCAR COMANDA
  // =========================

  const refComanda = db.collection("comandas").doc(comandaId);

  const docComanda = await refComanda.get();

  if (!docComanda.exists) return;

  const comanda = docComanda.data();

  if (comanda.status !== "Aberta") {
    alert("Esta comanda já foi finalizada.");

    return;
  }

  // =====================================================
  // RECALCULAR CUPOM + FIDELIDADE
  // NO MOMENTO DO PAGAMENTO
  // =====================================================

  const valorOriginal = Number(comanda.valorTotal || 0);

  // =========================
  // CUPOM
  // VEM PRIMEIRO
  // =========================

  let cupomAplicado = null;

  let descontoCupom = 0;

  if (cupomPagamentoAtendenteAtual?.id) {
    // Busca novamente os cupons válidos
    // para impedir usar cupom que foi
    // desativado ou deixou de ser válido.

    const cuponsElegiveisAgora = await buscarCuponsElegiveisAtendente(
      valorOriginal,

      comanda.itens || [],
      comanda.clienteId || null,
    );

    cupomAplicado =
      cuponsElegiveisAgora.find((cupom) => cupom.id === cupomPagamentoAtendenteAtual.id) || null;

    if (!cupomAplicado) {
      cupomPagamentoAtendenteAtual = null;

      alert("O cupom selecionado não está mais disponível para esta compra.");

      await abrirPagamentoTudoJunto(comandaId);

      return;
    }

    descontoCupom = Number(cupomAplicado.descontoCalculado || 0);
  }

  // =========================
  // VALOR APÓS CUPOM
  // =========================

  const valorAposCupom = Math.max(
    valorOriginal - descontoCupom,

    0,
  );

  // =========================
  // FIDELIDADE
  // VEM DEPOIS DO CUPOM
  // =========================

  const fidelidade = await calcularFidelidadeClientePagamentoSeparado(
    comanda.clienteId || null,

    valorAposCupom,
  );

  const descontoFidelidade = Number(fidelidade.descontoFidelidade || 0);

  // =========================
  // VALOR FINAL
  // =========================

  const valorFinal = Math.max(
    valorAposCupom - descontoFidelidade,

    0,
  );

  // =========================
  // SEGURANÇA
  // =========================

  if (Math.abs(Number(total) - valorFinal) > 0.01) {
    alert("O valor da comanda foi atualizado. Abra o pagamento novamente.");

    await abrirPagamentoTudoJunto(comandaId, true);

    return;
  }

  // =========================
  // REGISTRAR PAGAMENTO
  // =========================

  // =====================================================
  // PREPARAR ATUALIZAÇÕES
  // =====================================================

  const batch = lotePagamentoCupomOperacao(
    cupomAplicado?.id || null,
    comanda.clienteId || null,
    refComanda,
  );

  const agora = Date.now();

  // =========================
  // COMANDA
  // =========================

  batch.update(refComanda, {
    status: "Fechada",

    pagamentos,

    // =========================
    // VALORES
    // =========================

    valorOriginal: valorOriginal,

    descontoCupom: descontoCupom,

    cupomDescontoCodigo: cupomAplicado?.codigo || "",

    cupomDescontoNome: cupomAplicado?.nome || "",

    valorAposCupom: valorAposCupom,

    descontoFidelidade: descontoFidelidade,

    // Total de todos
    // os descontos aplicados
    desconto: descontoCupom + descontoFidelidade,

    valorFinal: valorFinal,

    valorPago: valorFinal,

    fechadoEm: agora,
  });

  // =====================================================
  // ATUALIZAR FIDELIDADE DO CLIENTE
  // =====================================================

  if (fidelidade.cliente && fidelidade.cliente.fidelidadeAtiva === true) {
    const cliente = fidelidade.cliente;

    const clienteRef = db.collection("clientes").doc(cliente.id);

    const totalFidelidadeAtual = Number(cliente.totalFidelidade || 0);

    const bonusDisponivelAtual = Number(cliente.bonusDisponivel || 0);

    const bonusGeradoTotalAtual = Number(cliente.bonusGeradoTotal || 0);

    // O valor original da compra
    // entra na fidelidade.
    const novoTotalFidelidade = totalFidelidadeAtual + valorFinal;

    // =========================
    // BÔNUS TOTAL GERADO
    // R$20 A CADA R$300
    // =========================

    const bonusTotalQueDeveriaTer = Math.floor(novoTotalFidelidade / 300) * 20;

    const bonusNovoGerado = bonusTotalQueDeveriaTer - bonusGeradoTotalAtual;

    let novoBonusDisponivel = bonusDisponivelAtual + bonusNovoGerado;

    // =========================
    // CONSUMIR BÔNUS USADO
    // =========================

    if (descontoFidelidade > 0) {
      novoBonusDisponivel -= descontoFidelidade;
    }

    if (novoBonusDisponivel < 0) {
      novoBonusDisponivel = 0;
    }

    const novoTotalGasto = Number(cliente.totalGasto || 0) + valorFinal;

    batch.update(clienteRef, {
      totalGasto: novoTotalGasto,

      totalFidelidade: novoTotalFidelidade,

      bonusDisponivel: novoBonusDisponivel,

      bonusGeradoTotal: bonusTotalQueDeveriaTer,
    });
  }

  // =====================================================
  // ATUALIZAR PEDIDO ORIGINAL
  // =====================================================

  const pedidoId = comanda.pedidoOrigemId || null;

  if (pedidoId) {
    const pedidoRef = db.collection("pedidos").doc(pedidoId);

    batch.update(pedidoRef, {
      valorAntesDesconto: valorOriginal,

      // =========================
      // CUPOM
      // =========================

      descontoCupom: descontoCupom,

      descontoCupomTotal: descontoCupom,

      descontoCupomPedido:
        cupomAplicado && (cupomAplicado.tipo === "pedido" || cupomAplicado.tipo === "descontoGeral")
          ? descontoCupom
          : 0,

      descontoCupomItem: cupomAplicado && cupomAplicado.tipo === "item" ? descontoCupom : 0,

      descontoCupomTaxa: 0,

      cupomDescontoCodigo: cupomAplicado?.codigo || "",

      cupomDescontoNome: cupomAplicado?.nome || "",

      valorAposCupom: valorAposCupom,

      // =========================
      // FIDELIDADE
      // =========================

      descontoFidelidade: descontoFidelidade,

      // =========================
      // TOTAL
      // =========================

      valorTotal: valorFinal,

      pagamento: pagamentos.map((pagamento) => pagamento.forma).join(" + "),

      pago: true,

      pagoEm: agora,
    });
  }
  // =========================
  // SALVAR TUDO JUNTO
  // =========================

  try {
    await batch.commit();
  } catch (erro) {
    avisoOperacao(erro.message || "Não foi possível registrar o pagamento.");
    return;
  }

  // =========================
  // LIMPAR CUPOM DO PAGAMENTO
  // =========================

  cupomPagamentoAtendenteAtual = null;

  cuponsPagamentoAtendenteAtuais = [];

  // =========================
  // VER OUTRAS COMANDAS
  // =========================

  const outrasComandas = await db
    .collection("comandas")
    .where("mesa", "==", comanda.mesa)
    .where("status", "==", "Aberta")
    .get();

  // =========================
  // LIBERAR MESA
  // =========================

  if (outrasComandas.empty && mesaAbertaAtual) {
    await db.collection("mesas").doc(mesaAbertaAtual).update({
      ocupada: false,
    });
  }

  // =========================
  // LIMPAR ESTADOS
  // =========================

  modoRemoverItem = false;

  modoEditarItem = false;

  itemComandaEmEdicao = null;

  comandaAbertaAtual = null;

  await areaConsumoLocalRecarregar();

  await abrirMesaAtendente(mesaAbertaAtual);
}
async function abrirPagamentoSeparado(comandaId) {
  modoPagamentoSeparado = "itens";
  const area = document.getElementById("area-fechamento-comanda");

  if (!area) return;

  // =========================
  // BUSCAR COMANDA
  // =========================

  const docComanda = await db.collection("comandas").doc(comandaId).get();

  if (!docComanda.exists) {
    alert("Comanda não encontrada.");

    return;
  }

  const comanda = docComanda.data();

  const valorComanda = Number(comanda.valorTotal || 0);

  const itens = comanda.itens || [];

  // =========================
  // PAGAMENTOS JÁ REALIZADOS
  // =========================

  const pagamentosRealizados = comanda.pagamentos || [];

  // =========================
  // VALOR JÁ QUITADO
  // =========================

  const valorQuitado = pagamentosRealizados.reduce((soma, pagamento) => {
    return soma + Number(pagamento.valorQuitado ?? pagamento.valor ?? 0);
  }, 0);

  // =========================
  // SALDO PENDENTE
  // =========================

  const saldoPendente = Math.max(valorComanda - valorQuitado, 0);

  // =========================
  // QUANTIDADES JÁ PAGAS
  // =========================

  const quantidadesPagas = {};

  pagamentosRealizados.forEach((pagamento) => {
    const itensPagos = pagamento.itens || [];

    itensPagos.forEach((itemPago) => {
      const index = Number(itemPago.itemIndex);

      quantidadesPagas[index] =
        Number(quantidadesPagas[index] || 0) + Number(itemPago.quantidade || 0);
    });
  });
  // =========================
  // MONTAR ITENS
  // =========================

  let htmlItens = "";

  itens.forEach((item, index) => {
    const quantidadeOriginal = Number(item.quantidade || 1);

    const quantidadePaga = Number(quantidadesPagas[index] || 0);

    const quantidade = Math.max(quantidadeOriginal - quantidadePaga, 0);
    if (quantidade <= 0) {
      return;
    }

    const precoUnitario = Number(item.precoUnitario || 0);

    htmlItens += `

                <div
                    style="
                        margin-bottom:15px;
                        padding:10px;
                        border:1px solid #444;
                        border-radius:8px;
                    "
                >

                    <strong>
                        ${item.nome}
                    </strong>

                    <br>

                    R$ ${precoUnitario.toFixed(2)}
                    cada

                    <br><br>


                    <button
                        type="button"
                        onclick="
                            alterarQuantidadePagamentoSeparado(
                                ${index},
                                -1,
                                ${quantidade},
                                ${precoUnitario}
                            )
                        "
                    >
                        −
                    </button>


                    <span
                        id="qtd-pagamento-item-${index}"
                        data-preco="${precoUnitario}"
                        data-max="${quantidade}"
                        style="
                            margin:0 10px;
                        "
                    >
                        0
                    </span>


                    <button
                        type="button"
                        onclick="
                            alterarQuantidadePagamentoSeparado(
                                ${index},
                                1,
                                ${quantidade},
                                ${precoUnitario}
                            )
                        "
                    >
                        +
                    </button>


                    <span>
                        de ${quantidade}
                    </span>

                </div>

            `;
  });

  // =========================
  // HISTÓRICO MINIMIZADO
  // =========================

  let htmlPagamentos = "<p>Nenhum pagamento registrado.</p>";

  if (pagamentosRealizados.length > 0) {
    htmlPagamentos = pagamentosRealizados
      .map((pagamento, index) => {
        const formas = (pagamento.formas || [])
          .map((forma) => {
            return `${forma.forma}: R$ ${Number(forma.valor || 0).toFixed(2)}`;
          })
          .join("<br>");
        const itensPagosHtml = (pagamento.itens || [])
          .map((itemPago) => {
            const itemOriginal = itens[Number(itemPago.itemIndex)];

            if (!itemOriginal) {
              return "";
            }

            return `

            ${Number(itemPago.quantidade || 0)}

            ${itemOriginal.nome}

        `;
          })
          .filter((texto) => texto !== "")
          .join("<br>");

        return `

    <div
        style="
            margin-bottom:10px;
            padding:10px;
            border:1px solid #444;
            border-radius:8px;
        "
    >

        <strong>
            Pagamento ${index + 1}
        </strong>

        <br><br>

        <strong>
            Itens pagos:
        </strong>

        <br>

        ${itensPagosHtml || "Itens não identificados"}

        <br><br>

        <strong>
            Valor:
        </strong>

        R$ ${Number(pagamento.valor || 0).toFixed(2)}

        <br>

        <strong>
            Forma:
        </strong>

        <br>

        ${formas}

    </div>

`;
      })
      .join("");
  }

  // =========================
  // MONTAR TELA
  // =========================

  area.innerHTML = `

        <button
            type="button"
            onclick="
                abrirFechamentoComanda(
                    '${comandaId}'
                )
            "
        >
            ⬅ Voltar
        </button>


        <button
            type="button"
            onclick="
                fecharPainelPagamento()
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
            Pagamento separado
        </h3>


        <p>
            Selecione o que esta pessoa
            vai pagar agora.
        </p>


        <hr>


        <div class="operacao-acoes pagamento-separado-modos"><button type="button" onclick="abrirPagamentoSeparadoPorValor('${comandaId}')">Pagar por valor</button></div>
        ${htmlItens}


        <hr>


        <p>
            Selecionado:
            <strong
                id="total-selecionado-pagamento"
            >
                R$ 0,00
            </strong>
        </p>


       <p>
    Total da comanda:
    <strong>
        R$ ${valorComanda.toFixed(2)}
    </strong>
</p>


<p>
    Já quitado:
    <strong>
        R$ ${valorQuitado.toFixed(2)}
    </strong>
</p>


<p>
    Pendente:
    <strong>
        R$ ${saldoPendente.toFixed(2)}
    </strong>
</p>


        <button
            type="button"
            onclick="
                continuarPagamentoSeparado(
                    '${comandaId}'
                )
            "
        >
            Continuar para pagamento
        </button>


        <br><br>


        <button
            type="button"
            onclick="
                alternarPagamentosRealizados()
            "
        >
            ✅ ${pagamentosRealizados.length} pagamento(s) realizado(s) ▸
        </button>


     <div
    id="pagamentos-realizados"
    style="
        display:none;
        margin-top:10px;
    "
>

    ${htmlPagamentos}

</div>

    `;

  area.scrollIntoView({
    behavior: "smooth",

    block: "center",
  });
}
function alterarQuantidadePagamentoSeparado(index, valor, maximo, precoUnitario) {
  const elemento = document.getElementById(`qtd-pagamento-item-${index}`);

  if (!elemento) return;

  let quantidade = Number(elemento.textContent || 0);

  quantidade += Number(valor);

  // Não deixa menor que 0

  if (quantidade < 0) {
    quantidade = 0;
  }

  // Não deixa selecionar
  // mais do que existe

  if (quantidade > maximo) {
    quantidade = maximo;
  }

  elemento.textContent = quantidade;

  atualizarTotalPagamentoSeparado();
}
function atualizarTotalPagamentoSeparado() {
  const elementos = document.querySelectorAll('[id^="qtd-pagamento-item-"]');

  let total = 0;

  elementos.forEach((elemento) => {
    const quantidade = Number(elemento.textContent || 0);

    const preco = Number(elemento.dataset.preco || 0);

    total += quantidade * preco;
  });

  const totalTela = document.getElementById("total-selecionado-pagamento");

  if (totalTela) {
    totalTela.textContent = `R$ ${total.toFixed(2)}`;
  }
}
function alternarPagamentosRealizados() {
  const area = document.getElementById("pagamentos-realizados");

  if (!area) return;

  const aberto = area.style.display !== "none";

  area.style.display = aberto ? "none" : "block";
}
async function continuarPagamentoSeparado(comandaId) {
  modoPagamentoSeparado = "itens";

  const elementos = document.querySelectorAll('[id^="qtd-pagamento-item-"]');

  let total = 0;

  selecaoPagamentoSeparado = [];

  elementos.forEach((elemento) => {
    const quantidade = Number(elemento.textContent || 0);

    const preco = Number(elemento.dataset.preco || 0);

    if (quantidade > 0) {
      // Pegar index através do ID:
      // qtd-pagamento-item-2

      const index = Number(elemento.id.replace("qtd-pagamento-item-", ""));

      selecaoPagamentoSeparado.push({
        itemIndex: index,

        quantidade,
      });

      total += quantidade * preco;
    }
  });

  // =========================
  // NADA SELECIONADO
  // =========================

  if (selecaoPagamentoSeparado.length === 0) {
    alert("Selecione pelo menos um item para pagar.");

    return;
  }

  // =========================
  // BUSCAR COMANDA
  // =========================

  const docComanda = await db.collection("comandas").doc(comandaId).get();

  if (!docComanda.exists) {
    alert("Comanda não encontrada.");

    return;
  }

  const comanda = docComanda.data();

  if (total > saldoComandaPagamento(comanda) + 0.001) {
    alert("A seleção ultrapassa o saldo. Use a divisão por valor para pagar o restante.");
    return;
  }
  const itensComanda = comanda.itens || [];

  // =========================
  // ITENS DESTE PAGAMENTO
  // =========================

  itensPagamentoSeparadoAtual = selecaoPagamentoSeparado

    .map((selecao) => {
      const itemOriginal = itensComanda[Number(selecao.itemIndex)];

      if (!itemOriginal) {
        return null;
      }

      const quantidade = Number(selecao.quantidade || 0);

      const precoUnitario = Number(
        itemOriginal.precoUnitario ?? itemOriginal.preco ?? itemOriginal.precoBase ?? 0,
      );

      return {
        ...itemOriginal,

        // quantidade somente
        // desta parte do pagamento
        quantidade,

        qtd: quantidade,

        precoUnitario,

        subtotal: precoUnitario * quantidade,
      };
    })

    .filter((item) => item !== null);

  // =========================
  // NOVO PAGAMENTO
  // LIMPAR CUPOM ANTERIOR
  // =========================

  cupomPagamentoSeparadoAtual = null;

  cuponsPagamentoSeparadoAtuais = [];

  // =========================
  // ABRIR PAGAMENTO
  // =========================

  abrirIdentificacaoPagamentoSeparado(comandaId, total);
}
async function abrirIdentificacaoPagamentoSeparado(comandaId, total) {
  const area = document.getElementById("area-fechamento-comanda");

  if (!area) {
    return;
  }

  const docComanda = await db.collection("comandas").doc(comandaId).get();

  if (!docComanda.exists) {
    alert("Comanda não encontrada.");

    return;
  }

  const comanda = docComanda.data();

  comanda.clienteId =
    comanda.clienteId || comanda.clienteTelefone || comanda.telefoneCliente || null;
  if (!comanda.clienteId && comanda.sessaoAutoatendimentoId) {
    const sessao = await db.collection("sessoesMesa").doc(comanda.sessaoAutoatendimentoId).get();
    comanda.clienteId = sessao.data()?.clienteId || null;
  }
  let htmlClienteComanda = "";

  // =========================
  // CONTA JÁ VINCULADA
  // =========================

  if (comanda.clienteId) {
    const clienteDoc = await db.collection("clientes").doc(comanda.clienteId).get();

    if (clienteDoc.exists) {
      const cliente = clienteDoc.data();

      htmlClienteComanda = `

                <button
                    type="button"
                    onclick="
                        selecionarClientePagamentoSeparado(
                            '${comandaId}',
                            ${total},
                            '${clienteDoc.id}'
                        )
                    "
                >
                    Continuar como ${escaparOperacao(cliente.nome || comanda.cliente || "Cliente")}
                </button>

                <br><br>

            `;
    }
  }

  area.innerHTML = `

        <button
            type="button"
            onclick="
                abrirPagamentoSeparado(
                    '${comandaId}'
                )
            "
        >
            ⬅ Voltar
        </button>


        <h3>
            Quem está pagando esta parte?
        </h3>


        <p>
            Valor selecionado:
            <strong>
                R$ ${Number(total).toFixed(2)}
            </strong>
        </p>


        ${htmlClienteComanda}


        <button
            type="button"
            onclick="
                mostrarBuscaClientePagamentoSeparado()
            "
        >
            🔎 Usar outro cliente
        </button>


        <br><br>


        <button
            type="button"
            onclick="
                selecionarPagamentoSemConta(
                    '${comandaId}',
                    ${total}
                )
            "
        >
            ➡ Continuar sem conta
        </button>


        <div
            id="busca-cliente-pagamento-separado"
            style="
                display:none;
                margin-top:20px;
            "
        >

            <hr>

            <label>
                Telefone ou código do cliente
            </label>

            <br><br>

            <input
                type="text"
                id="busca-cliente-separado"
                placeholder="Telefone ou código"
            >

            <button
                type="button"
                onclick="
                    buscarClientePagamentoSeparado(
                        '${comandaId}',
                        ${total}
                    )
                "
            >
                Buscar
            </button>


            <div
                id="resultado-cliente-separado"
                style="margin-top:15px;"
            ></div>

        </div>

    `;
}
function mostrarBuscaClientePagamentoSeparado() {
  const area = document.getElementById("busca-cliente-pagamento-separado");

  if (area) {
    area.style.display = "block";
  }
}
async function calcularFidelidadeClientePagamentoSeparado(clienteId, valorOriginal) {
  const resultado = {
    cliente: null,

    descontoFidelidade: 0,

    valorOriginal: Number(valorOriginal),

    valorFinal: Number(valorOriginal),

    vaiGerarBonus: false,
  };

  if (!clienteId) {
    return resultado;
  }

  const clienteDoc = await db.collection("clientes").doc(clienteId).get();

  if (!clienteDoc.exists) {
    return resultado;
  }

  const cliente = clienteDoc.data();

  resultado.cliente = {
    id: clienteDoc.id,

    ...cliente,
  };

  // =========================
  // SEM FIDELIDADE
  // =========================

  if (cliente.fidelidadeAtiva !== true) {
    return resultado;
  }

  const valor = Number(valorOriginal || 0);

  const totalFidelidade = Number(cliente.totalFidelidade || 0);

  const bonusDisponivel = Number(cliente.bonusDisponivel || 0);

  // =========================
  // PRÓXIMA META
  // =========================

  const proximaMeta = (Math.floor(totalFidelidade / 300) + 1) * 300;

  const valorDepoisDoBonus = Math.max(valor - 20, 0);

  const vaiGerarBonus = valor >= 20 && totalFidelidade + valorDepoisDoBonus >= proximaMeta;

  resultado.vaiGerarBonus = vaiGerarBonus;

  // =========================
  // USAR R$ 20
  // =========================

  if (valor >= 20 && (bonusDisponivel >= 20 || vaiGerarBonus)) {
    resultado.descontoFidelidade = 20;

    resultado.valorFinal = Math.max(valor - 20, 0);
  }

  return resultado;
}
async function abrirBeneficiosPagamentoSeparado(
  comandaId,
  valorOriginal,
  clienteId = null,
  clienteNome = null,
) {
  const area = document.getElementById("area-fechamento-comanda");

  if (!area) {
    return;
  }

  // =========================
  // LIMPAR CUPOM ANTERIOR
  // =========================

  cupomPagamentoSeparadoAtual = null;

  // =========================
  // BUSCAR CUPONS VÁLIDOS
  // SOMENTE PARA OS ITENS
  // DESTA PARTE
  // =========================

  cuponsPagamentoSeparadoAtuais = await buscarCuponsElegiveisAtendente(
    valorOriginal,

    itensPagamentoSeparadoAtual,
    clienteId,
  );

  let htmlCupons = "";

  if (cuponsPagamentoSeparadoAtuais.length === 0) {
    htmlCupons = `

            <p>
                Nenhum cupom disponível
                para este pagamento.
            </p>

        `;
  } else {
    cuponsPagamentoSeparadoAtuais.forEach((cupom) => {
      htmlCupons += `

                        <div
                            style="
                                margin-bottom:10px;
                                padding:10px;
                                border:1px solid #444;
                                border-radius:8px;
                            "
                        >

                            <strong>
                                🎟 ${cupom.codigo}
                            </strong>

                            <br>

                            ${cupom.nome || ""}

                            <br><br>

                            Desconto nesta parte:

                            <strong>
                                R$ ${Number(cupom.descontoCalculado || 0).toFixed(2)}
                            </strong>

                            <br><br>

                            <button
                                type="button"
                                onclick="
                                    selecionarCupomPagamentoSeparado(
                                        '${comandaId}',
                                        ${Number(valorOriginal)},
                                        ${clienteId ? `'${clienteId}'` : "null"},
                                        ${
                                          clienteNome
                                            ? `'${String(clienteNome).replaceAll("'", "\\'")}'`
                                            : "null"
                                        },
                                        '${cupom.id}'
                                    )
                                "
                            >
                                Usar este cupom
                            </button>

                        </div>

                    `;
    });
  }

  area.innerHTML = `

        <button
            type="button"
            onclick="
                abrirPagamentoSeparado(
                    '${comandaId}'
                )
            "
        >
            ⬅ Voltar
        </button>


        <h3>
            Benefícios
        </h3>


        <p>
            Valor selecionado:
            <strong>
                R$ ${Number(valorOriginal).toFixed(2)}
            </strong>
        </p>


        ${
          clienteId
            ? `
                    <p>
                        👤 Pagando como:
                        <strong>
                            ${clienteNome || "Cliente"}
                        </strong>
                    </p>
                `
            : `
                    <p>
                        👤 Pagamento sem conta
                    </p>
                `
        }


        <hr>





        <button type="button" class="cupons-pagamento-abrir-ui" aria-expanded="false" onclick="alternarCuponsPagamentoUI()">Cupons disponíveis</button><div id="cupons-disponiveis-pagamento-ui" style="display:none">${htmlCupons}</div>


        <hr>


        <button
            type="button"
            onclick="
                continuarSemCupomPagamentoSeparado(
                    '${comandaId}',
                    ${Number(valorOriginal)},
                    ${clienteId ? `'${clienteId}'` : "null"},
                    ${clienteNome ? `'${String(clienteNome).replaceAll("'", "\\'")}'` : "null"}
                )
            "
        >
            Continuar sem cupom
        </button>

    `;
}

async function selecionarCupomPagamentoSeparado(
  comandaId,
  valorOriginal,
  clienteId,
  clienteNome,
  cupomId,
) {
  const cupom = cuponsPagamentoSeparadoAtuais.find((item) => item.id === cupomId);

  if (!cupom) {
    alert("Cupom não encontrado.");

    return;
  }

  cupomPagamentoSeparadoAtual = cupom;

  await finalizarBeneficiosPagamentoSeparado(comandaId, valorOriginal, clienteId, clienteNome);
}

async function continuarSemCupomPagamentoSeparado(
  comandaId,
  valorOriginal,
  clienteId,
  clienteNome,
) {
  cupomPagamentoSeparadoAtual = null;

  await finalizarBeneficiosPagamentoSeparado(comandaId, valorOriginal, clienteId, clienteNome);
}
async function finalizarBeneficiosPagamentoSeparado(
  comandaId,
  valorOriginal,
  clienteId,
  clienteNome,
) {
  // =========================
  // CUPOM PRIMEIRO
  // =========================

  const descontoCupom = Number(cupomPagamentoSeparadoAtual?.descontoCalculado || 0);

  const valorAposCupom = Math.max(
    Number(valorOriginal) - descontoCupom,

    0,
  );

  // =========================
  // FIDELIDADE DEPOIS
  // =========================

  let descontoFidelidade = 0;

  if (clienteId) {
    const fidelidade = await calcularFidelidadeClientePagamentoSeparado(
      clienteId,

      valorAposCupom,
    );

    descontoFidelidade = Number(fidelidade.descontoFidelidade || 0);
  }

  // =========================
  // TOTAL FINAL
  // =========================

  const valorFinal = Math.max(
    valorAposCupom - descontoFidelidade,

    0,
  );

  // =========================
  // CONTEXTO DESTE PAGAMENTO
  // =========================

  contextoPagamentoSeparadoAtual = {
    comandaId,

    clienteId: clienteId || null,

    clienteNome: clienteNome || null,

    valorOriginal: Number(valorOriginal),

    descontoCupom,

    cupomId: cupomPagamentoSeparadoAtual?.id || null,

    cupomCodigo: cupomPagamentoSeparadoAtual?.codigo || null,

    cupomNome: cupomPagamentoSeparadoAtual?.nome || null,

    valorAposCupom,

    descontoFidelidade,

    valorFinal,
  };

  abrirFormaPagamentoSeparado(comandaId, valorFinal);
}

async function selecionarClientePagamentoSeparado(comandaId, total, clienteId) {
  const docCliente = await db.collection("clientes").doc(clienteId).get();

  if (!docCliente.exists) {
    alert("Cliente não encontrado.");

    return;
  }

  const cliente = docCliente.data();

  await abrirBeneficiosPagamentoSeparado(
    comandaId,

    Number(total),

    clienteId,

    cliente.nome || cliente.nomeReal || "Cliente",
  );
}
async function selecionarPagamentoSemConta(comandaId, total) {
  await abrirBeneficiosPagamentoSeparado(
    comandaId,

    Number(total),

    null,

    null,
  );
}

async function buscarClientePagamentoSeparado(comandaId, total) {
  const input = document.getElementById("busca-cliente-separado");

  const areaResultado = document.getElementById("resultado-cliente-separado");

  if (!input || !areaResultado) {
    return;
  }

  const busca = input.value.trim();

  if (!busca) {
    alert("Digite o telefone ou código.");

    return;
  }

  let clienteDoc = null;

  const telefone = busca.replace(/\D/g, "");

  // =========================
  // TELEFONE
  // =========================

  if (telefone.length >= 10) {
    const doc = await db.collection("clientes").doc(telefone).get();

    if (doc.exists) {
      clienteDoc = doc;
    }
  }

  // =========================
  // CÓDIGO
  // =========================

  if (!clienteDoc) {
    const snap = await db
      .collection("clientes")
      .where("codigoAtivacao", "==", busca)
      .limit(1)
      .get();

    if (!snap.empty) {
      clienteDoc = snap.docs[0];
    }
  }

  if (!clienteDoc) {
    areaResultado.innerHTML = `

            <p>
                ❌ Cliente não encontrado.
            </p>

        `;

    return;
  }

  const cliente = clienteDoc.data();

  areaResultado.innerHTML = `

        <p>
            👤 <strong>
                ${cliente.nome || "Cliente"}
            </strong>
        </p>


        <button
            type="button"
            onclick="
                selecionarClientePagamentoSeparado(
                    '${comandaId}',
                    ${total},
                    '${clienteDoc.id}'
                )
            "
        >
            ✅ Usar esta conta
        </button>

    `;
}

function abrirFormaPagamentoSeparado(comandaId, total) {
  const area = document.getElementById("area-fechamento-comanda");

  if (!area) return;

  let htmlCliente = "";

  if (contextoPagamentoSeparadoAtual?.clienteId) {
    htmlCliente = `

        <div
            style="
                margin:15px 0;
                padding:12px;
                border:1px solid #444;
                border-radius:8px;
            "
        >

            👤 <strong>
                ${contextoPagamentoSeparadoAtual.clienteNome}
            </strong>

            <br><br>

            Valor selecionado:
            R$ ${Number(contextoPagamentoSeparadoAtual.valorOriginal).toFixed(2)}


            ${
              contextoPagamentoSeparadoAtual.descontoFidelidade > 0
                ? `

                        <br><br>

                        🎁 Bônus:
                        - R$ ${Number(contextoPagamentoSeparadoAtual.descontoFidelidade).toFixed(2)}

                    `
                : ""
            }

        </div>

    `;
  }

  area.innerHTML = `

        <button
            type="button"
            onclick="
                abrirPagamentoSeparado(
                    '${comandaId}'
                )
            "
        >
            ⬅ Voltar
        </button>


        <button
            type="button"
            onclick="
                fecharPainelPagamento()
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
            Pagamento separado
        </h3>

${htmlCliente}
        <p>
            Valor a pagar:
            <strong>
                R$ ${Number(total).toFixed(2)}
            </strong>
        </p>


        <hr>


        <h4>
            Forma de pagamento
        </h4>


        <label>

            <input
                type="radio"
                name="forma-pagamento-separado" onchange="desativarPagamentoMistoUI('area-pagamento-misto-separado')"
                value="Dinheiro"
            >

            💵 Dinheiro

        </label>


        <br><br>


        <label>

            <input
                type="radio"
                name="forma-pagamento-separado" onchange="desativarPagamentoMistoUI('area-pagamento-misto-separado')"
                value="Pix"
            >

            📱 Pix

        </label>


        <br><br>


        <label>

            <input
                type="radio"
                name="forma-pagamento-separado" onchange="desativarPagamentoMistoUI('area-pagamento-misto-separado')"
                value="Débito"
            >

            💳 Débito

        </label>


        <br><br>


        <label>

            <input
                type="radio"
                name="forma-pagamento-separado" onchange="desativarPagamentoMistoUI('area-pagamento-misto-separado')"
                value="Crédito"
            >

            💳 Crédito

        </label>


        <br><br>


        <button
            type="button"
            onclick="
                alternarPagamentoMistoSeparado()
            "
        >
            💳 Usar mais de uma forma
        </button>


        <div
            id="area-pagamento-misto-separado"
            style="
                display:none;
                margin-top:20px;
            "
        >

            <hr>

            <h4>
                Pagamento misto
            </h4>


            Dinheiro

            <br>

            R$

            <input
                type="number"
                id="separado-dinheiro"
                min="0"
                step="0.01"
                value="0"
                oninput="
                    atualizarResumoMistoSeparado(
                        ${total}
                    )
                "
            >


            <br><br>


            Pix

            <br>

            R$

            <input
                type="number"
                id="separado-pix"
                min="0"
                step="0.01"
                value="0"
                oninput="
                    atualizarResumoMistoSeparado(
                        ${total}
                    )
                "
            >


            <br><br>


            Débito

            <br>

            R$

            <input
                type="number"
                id="separado-debito"
                min="0"
                step="0.01"
                value="0"
                oninput="
                    atualizarResumoMistoSeparado(
                        ${total}
                    )
                "
            >


            <br><br>


            Crédito

            <br>

            R$

            <input
                type="number"
                id="separado-credito"
                min="0"
                step="0.01"
                value="0"
                oninput="
                    atualizarResumoMistoSeparado(
                        ${total}
                    )
                "
            >


            <br><br>


            <div
                id="resumo-misto-separado"
            >

                Total informado:
                R$ 0,00

                <br>

                Restante:
                R$ ${Number(total).toFixed(2)}

            </div>

        </div>


        <br><br>


        <button
            type="button"
            onclick="
                confirmarPagamentoSeparado(
                    '${comandaId}',
                    ${total}
                )
            "
        >
            ✅ PAGO
        </button>

    `;
}
function alternarPagamentoMistoSeparado() {
  const area = document.getElementById("area-pagamento-misto-separado");

  if (!area) return;

  const abrindo = area.style.display === "none";

  area.style.display = abrindo ? "block" : "none";

  // Se abriu misto,
  // desmarcar forma única

  if (abrindo) {
    document.querySelectorAll('input[name="forma-pagamento-separado"]').forEach((radio) => {
      radio.checked = false;
    });
  }
}
function atualizarResumoMistoSeparado(total) {
  const dinheiro = Number(document.getElementById("separado-dinheiro")?.value || 0);

  const pix = Number(document.getElementById("separado-pix")?.value || 0);

  const debito = Number(document.getElementById("separado-debito")?.value || 0);

  const credito = Number(document.getElementById("separado-credito")?.value || 0);

  const informado = dinheiro + pix + debito + credito;

  const restante = total - informado;

  const resumo = document.getElementById("resumo-misto-separado");

  if (!resumo) return;

  resumo.innerHTML = htmlResumoPagamentoMistoUI(informado, restante);
}
async function atualizarFidelidadePagamentoSeparado(
  clienteId,
  valorPagoAgora,
  descontoFidelidadeAgora,
) {
  if (!clienteId) {
    return;
  }

  const refCliente = db.collection("clientes").doc(clienteId);

  const docCliente = await refCliente.get();

  if (!docCliente.exists) {
    return;
  }

  const cliente = docCliente.data();

  // =========================
  // FIDELIDADE NÃO ATIVA
  // =========================

  if (cliente.fidelidadeAtiva !== true) {
    return;
  }

  const totalFidelidadeAtual = Number(cliente.totalFidelidade || 0);

  const bonusDisponivelAtual = Number(cliente.bonusDisponivel || 0);

  const bonusGeradoTotalAtual = Number(cliente.bonusGeradoTotal || 0);

  const totalGastoAtual = Number(cliente.totalGasto || 0);

  // =========================
  // SOMAR SOMENTE O VALOR
  // REALMENTE PAGO
  // =========================

  const novoTotalFidelidade = totalFidelidadeAtual + Number(valorPagoAgora);

  // =========================
  // CALCULAR BÔNUS GERADO
  // R$ 20 A CADA R$ 300
  // =========================

  const bonusTotalQueDeveriaTer = Math.floor(novoTotalFidelidade / 300) * 20;

  const bonusNovoGerado = bonusTotalQueDeveriaTer - bonusGeradoTotalAtual;

  let novoBonusDisponivel = bonusDisponivelAtual + bonusNovoGerado;

  // =========================
  // DESCONTAR BÔNUS USADO
  // =========================

  if (Number(descontoFidelidadeAgora) > 0) {
    novoBonusDisponivel -= Number(descontoFidelidadeAgora);
  }

  // =========================
  // SEGURANÇA
  // =========================

  if (novoBonusDisponivel < 0) {
    novoBonusDisponivel = 0;
  }

  // =========================
  // ATUALIZAR CLIENTE
  // =========================

  await refCliente.update({
    totalGasto: totalGastoAtual + Number(valorPagoAgora),

    totalFidelidade: novoTotalFidelidade,

    bonusDisponivel: novoBonusDisponivel,

    bonusGeradoTotal: bonusTotalQueDeveriaTer,
  });
}

async function registrarHistoricoPagamentoCliente(clienteId, dados) {
  const telefone = String(clienteId || "").replace(/\D/g, "");

  if (!telefone) {
    return;
  }

  const agora = Date.now();

  await db.collection("historicoPagamentosClientes").add({
    // =========================
    // CLIENTE
    // =========================

    clienteId: telefone,

    clienteNome: dados.clienteNome || "",

    // =========================
    // ORIGEM
    // =========================

    origem: "consumo_local",

    tipo: "pagamento_comanda",

    comandaId: dados.comandaId || null,

    pedidoId: dados.pedidoId || null,

    mesa: dados.mesa || null,

    // =========================
    // ITENS
    // =========================

    itens: Array.isArray(dados.itens) ? dados.itens : [],

    // =========================
    // VALORES
    // =========================

    valorOriginal: Number(dados.valorOriginal || 0),

    descontoCupom: Number(dados.descontoCupom || 0),

    descontoFidelidade: Number(dados.descontoFidelidade || 0),

    valorPago: Number(dados.valorPago || 0),

    // =========================
    // CUPOM
    // =========================

    cupomCodigo: dados.cupomCodigo || null,

    cupomNome: dados.cupomNome || null,

    // =========================
    // FORMAS
    // =========================

    formas: Array.isArray(dados.formas) ? dados.formas : [],

    // =========================
    // DATA
    // =========================

    criadoEm: agora,

    criadoEmMs: agora,

    data: new Date(agora).toISOString(),
  });
}

async function confirmarPagamentoSeparado(comandaId, total) {
  const areaMisto = document.getElementById("area-pagamento-misto-separado");

  const usandoMisto =
    areaMisto && (areaMisto.dataset?.ativo === "sim" || areaMisto.style.display !== "none");

  let pagamentos = [];

  // =========================
  // PAGAMENTO MISTO
  // =========================

  if (usandoMisto) {
    const formas = [
      {
        forma: "Dinheiro",

        valor: Number(document.getElementById("separado-dinheiro")?.value || 0),
      },

      {
        forma: "Pix",

        valor: Number(document.getElementById("separado-pix")?.value || 0),
      },

      {
        forma: "Débito",

        valor: Number(document.getElementById("separado-debito")?.value || 0),
      },

      {
        forma: "Crédito",

        valor: Number(document.getElementById("separado-credito")?.value || 0),
      },
    ];

    pagamentos = formas.filter((pagamento) => pagamento.valor > 0);

    const totalInformado = pagamentos.reduce((soma, pagamento) => {
      return soma + pagamento.valor;
    }, 0);

    if (centavosOperacao(totalInformado) !== centavosOperacao(total)) {
      alert(`O pagamento precisa fechar exatamente R$ ${Number(total).toFixed(2)}.`);

      return;
    }
  }

  // =========================
  // FORMA ÚNICA
  // =========================
  else {
    const selecionado = document.querySelector('input[name="forma-pagamento-separado"]:checked');

    if (!selecionado) {
      alert("Escolha a forma de pagamento.");

      return;
    }

    pagamentos = [
      {
        forma: selecionado.value,

        valor: Number(total),
      },
    ];
  }

  // =========================
  // CONFIRMAÇÃO MANUAL
  // =========================

  const confirmar = await confirmarOperacao("Pagamento realmente confirmado?");

  if (!confirmar) {
    return;
  }

  // =========================
  // BUSCAR COMANDA
  // =========================

  const refComanda = db.collection("comandas").doc(comandaId);

  const docComanda = await refComanda.get();

  if (!docComanda.exists) {
    alert("Comanda não encontrada.");

    return;
  }

  const comanda = docComanda.data();

  if (comanda.status !== "Aberta") {
    alert("Esta comanda já foi finalizada.");

    return;
  }

  // =========================
  // VALORES DESTE PAGAMENTO
  // =========================

  const valorOriginalAgora = Number(contextoPagamentoSeparadoAtual?.valorOriginal ?? total);

  const descontoCupomAgora = Number(contextoPagamentoSeparadoAtual?.descontoCupom || 0);

  const valorAposCupomAgora = Number(
    contextoPagamentoSeparadoAtual?.valorAposCupom ?? valorOriginalAgora - descontoCupomAgora,
  );

  const descontoFidelidadeAgora = Number(contextoPagamentoSeparadoAtual?.descontoFidelidade || 0);

  // Dinheiro que realmente entrou
  const valorPagoAgora = Number(total);

  // Quanto da comanda foi resolvido
  // É o valor ORIGINAL dos itens escolhidos.
  const valorQuitadoAgora = valorOriginalAgora;

  const clienteIdAgora = contextoPagamentoSeparadoAtual?.clienteId || null;

  const clienteNomeAgora = contextoPagamentoSeparadoAtual?.clienteNome || null;

  const cupomIdAgora = contextoPagamentoSeparadoAtual?.cupomId || null;

  const cupomCodigoAgora = contextoPagamentoSeparadoAtual?.cupomCodigo || null;

  const cupomNomeAgora = contextoPagamentoSeparadoAtual?.cupomNome || null;

  // =========================
  // PAGAMENTOS ANTERIORES
  // =========================

  const pagamentosAnteriores = comanda.pagamentos || [];

  // =========================
  // CRIAR PAGAMENTO
  // =========================

  const novoPagamento = {
    id:
      contextoPagamentoSeparadoAtual.pagamentoId ||
      (contextoPagamentoSeparadoAtual.pagamentoId = db
        .collection("historicoPagamentosClientes")
        .doc().id),
    modo: modoPagamentoSeparado,

    tipo: "separado",

    // =========================
    // VALORES
    // =========================

    valorOriginal: valorOriginalAgora,

    descontoCupom: descontoCupomAgora,

    valorAposCupom: valorAposCupomAgora,

    descontoFidelidade: descontoFidelidadeAgora,

    // Dinheiro que realmente entrou
    valor: valorPagoAgora,

    valorPago: valorPagoAgora,

    // Valor dos itens que foi quitado
    valorQuitado: valorQuitadoAgora,

    // =========================
    // CUPOM
    // =========================

    cupomId: cupomIdAgora,

    cupomCodigo: cupomCodigoAgora,

    cupomNome: cupomNomeAgora,

    // =========================
    // CLIENTE
    // =========================

    clienteId: clienteIdAgora,

    clienteNome: clienteNomeAgora,

    formas: pagamentos,

    itens: selecaoPagamentoSeparado.map((item) => ({
      itemIndex: Number(item.itemIndex),

      quantidade: Number(item.quantidade),
    })),

    pagoEm: Date.now(),
  };

  // =========================
  // ADICIONAR AO HISTÓRICO
  // =========================

  pagamentosAnteriores.push(novoPagamento);

  // =========================
  // DINHEIRO QUE ENTROU
  // =========================

  const valorPago = pagamentosAnteriores.reduce((soma, pagamento) => {
    return soma + Number(pagamento.valorPago ?? pagamento.valor ?? 0);
  }, 0);

  // =========================
  // VALOR DA COMANDA QUITADO
  // =========================

  const valorQuitado = pagamentosAnteriores.reduce((soma, pagamento) => {
    return soma + Number(pagamento.valorQuitado ?? pagamento.valor ?? 0);
  }, 0);

  // =========================
  // DESCONTOS ACUMULADOS
  // =========================

  const descontoCupomTotal = pagamentosAnteriores.reduce((soma, pagamento) => {
    return soma + Number(pagamento.descontoCupom || 0);
  }, 0);

  const descontoFidelidadeTotal = pagamentosAnteriores.reduce((soma, pagamento) => {
    return soma + Number(pagamento.descontoFidelidade || 0);
  }, 0);

  const descontoTotal = descontoCupomTotal + descontoFidelidadeTotal;

  // =========================
  // SITUAÇÃO DA COMANDA
  // =========================

  const valorComanda = Number(comanda.valorTotal || 0);

  const totalmentePaga = centavosOperacao(valorQuitado) >= centavosOperacao(valorComanda);

  const saldoPendente = Math.max(valorComanda - valorQuitado, 0);

  // =========================
  // SALVAR PAGAMENTO
  // =========================

  const dadosAtualizacao = {
    pagamentos: pagamentosAnteriores,

    // Dinheiro recebido de verdade
    valorPago,

    // Valor original dos itens
    // que já foram resolvidos
    valorQuitado,

    saldoPendente,

    // =========================
    // DESCONTOS
    // =========================

    descontoCupom: descontoCupomTotal,

    descontoFidelidade: descontoFidelidadeTotal,

    desconto: descontoTotal,

    pagamentoParcial: !totalmentePaga,
  };

  // =========================
  // FIDELIDADE DE QUEM PAGOU
  // =========================
  const itensHistoricoCliente = selecaoPagamentoSeparado

    .map((itemPago) => {
      const itemOriginal = (comanda.itens || [])[Number(itemPago.itemIndex)];

      if (!itemOriginal) {
        return null;
      }

      return {
        nome: itemOriginal.nome || "Item",

        quantidade: Number(itemPago.quantidade || 0),

        precoUnitario: Number(
          itemOriginal.precoUnitario ?? itemOriginal.preco ?? itemOriginal.precoBase ?? 0,
        ),

        categoria: itemOriginal.categoria || "",

        tipo: itemOriginal.tipo || "",
      };
    })

    .filter((item) => item !== null);
  // ITENS DO HISTÓRICO
  // DESTE PAGAMENTO
  // =========================

  const itensHistoricoAgora = selecaoPagamentoSeparado

    .map((selecao) => {
      const itemOriginal = (comanda.itens || [])[Number(selecao.itemIndex)];

      if (!itemOriginal) {
        return null;
      }

      const quantidade = Number(selecao.quantidade || 0);

      const precoUnitario = Number(
        itemOriginal.precoUnitario ?? itemOriginal.preco ?? itemOriginal.precoBase ?? 0,
      );

      return {
        produtoId: itemOriginal.produtoId || null,

        nome: itemOriginal.nome || "Item",

        categoria: itemOriginal.categoria || "",

        tipo: itemOriginal.tipo || "",

        quantidade,

        precoUnitario,

        subtotal: precoUnitario * quantidade,
      };
    })

    .filter((item) => item !== null);

  // =========================
  // SE TERMINOU DE PAGAR
  // =========================

  if (totalmentePaga) {
    dadosAtualizacao.status = "Fechada";

    dadosAtualizacao.fechadoEm = Date.now();

    dadosAtualizacao.pagamentoParcial = false;
  }

  try {
    await salvarPagamentoSeparadoAtomico(
      refComanda,
      comanda,
      novoPagamento,
      dadosAtualizacao,
      itensPagamentoSeparadoAtual,
    );
  } catch (erro) {
    avisoOperacao(erro.message || "Não foi possível salvar o pagamento. Tente novamente.");
    return;
  }

  // =========================
  // SE PAGOU TUDO
  // VERIFICAR A MESA
  // =========================

  if (totalmentePaga) {
    const outrasComandas = await db
      .collection("comandas")
      .where("mesa", "==", comanda.mesa)
      .where("status", "==", "Aberta")
      .get();

    if (outrasComandas.empty && mesaAbertaAtual) {
      await db.collection("mesas").doc(mesaAbertaAtual).update({
        ocupada: false,
      });
    }
  }

  // =========================
  // LIMPAR ESTADOS
  // =========================

  selecaoPagamentoSeparado = [];

  clientePagamentoSeparadoAtual = null;

  contextoPagamentoSeparadoAtual = null;

  itensPagamentoSeparadoAtual = [];

  cupomPagamentoSeparadoAtual = null;

  cuponsPagamentoSeparadoAtuais = [];

  // =========================
  // ATUALIZAR MESAS
  // =========================

  await areaConsumoLocalRecarregar();

  // =========================
  // SE TERMINOU
  // =========================

  if (totalmentePaga) {
    modoRemoverItem = false;

    modoEditarItem = false;

    itemComandaEmEdicao = null;

    comandaAbertaAtual = null;

    await abrirMesaAtendente(mesaAbertaAtual);

    return;
  }

  // =========================
  // AINDA FALTA PAGAR
  // =========================

  if (typeof reiniciarHistoricoPagamentoUI === "function") reiniciarHistoricoPagamentoUI(comandaId);
  await abrirPagamentoSeparado(comandaId);
}
function fecharComandaNaLista(areaDestinoId) {
  const area = document.getElementById(areaDestinoId);

  if (area) {
    area.innerHTML = "";

    area.style.display = "none";
  }

  comandaAbertaAtual = null;

  areaDestinoComandaAtual = null;

  modoRemoverItem = false;

  modoEditarItem = false;
}
if (document.getElementById("area-chamados-mesa-atendente")) {
  iniciarListenerChamadosMesaAtendente();
}

function atualizarAcoesItensComandaUI() {
  document.querySelectorAll("[data-acao-comanda]").forEach((b) => {
    b.hidden = b.dataset.acaoComanda === "editar" ? !modoEditarItem : !modoRemoverItem;
  });
}
