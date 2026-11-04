/**
 * Delivery: cardápio, carrinho, finalização, perfil e histórico do cliente. Estilos estão em css/; funções globais continuam disponíveis aos atributos onclick.
 *
 * Organização e caminhos: consulte GUIA-DO-CODIGO.md.
 */

const firebaseConfig = {
  apiKey: "AIzaSyD2ZQbBk5zTlkwh91cQ3HF-ZBpXzFE3IQk",
  authDomain: "pedrao-lanches.firebaseapp.com",
  projectId: "pedrao-lanches",
  storageBucket: "pedrao-lanches.firebasestorage.app",
  messagingSenderId: "642954187872",
  appId: "1:642954187872:web:38efbecf53357e57b0df05",
};

firebase.initializeApp(firebaseConfig);
const db =
  typeof dbEquipeProtegidaUI === "function" && location.pathname.endsWith("/painel-atendente.html")
    ? dbEquipeProtegidaUI()
    : firebase.firestore();

let lojaAberta = null;

const LAT_ESTABELECIMENTO = -15.553076945525193;
const LON_ESTABELECIMENTO = -56.05602240360688;

const feriados = [
  "1/1",
  "3/4",
  "8/4",
  "21/4",
  "1/5",
  "4/6",
  "7/9",
  "12/10",
  "2/11",
  "15/11",
  "20/11",
  "25/12",
];

let carrinho = [];
let dadosPedidoTemporario = {};
let lancheSendoEscolhido = null;
let carrinhoVersao = 0;
let revisaoCarrinhoVersao = -1;
let molhosPagosTemp = {
  Maionese: 0,
  Ketchup: 0,
  Mostarda: 0,
  Barbecue: 0,
};

const PRECO_MOLHO_PAGO = 2;

function gerarItens(lista, containerId, imagemPadrao) {
  const container = document.getElementById(containerId);
  if (!container) return;

  window.catalogoProdutosDeliveryUI ||= new Map();
  lista
    .filter((item) => !item.somenteAtendente)
    .forEach((item) => {
      window.catalogoProdutosDeliveryUI.set(item.id || item.nome, item);
      const fotoFinal = item.imagem || item.img || imagemPadrao;

      let categoria = "Lanches";
      if (containerId.includes("bebidas")) categoria = "Bebidas";
      else if (containerId.includes("batatas")) categoria = "Batatas";
      else if (containerId.includes("combos")) categoria = "Combos";

      const card = document.createElement("div");
      card.classList.add("card");

      if (item.esgotado) {
        card.classList.add("produto-esgotado");
      }

      card.innerHTML = `
    <div class="card-img">
        <img src="${resolverImagemProduto(fotoFinal)}" alt="${item.nome}" loading="lazy">
    </div>

    <div class="card-info">
        <h3>${item.nome}</h3>
      <p>${item.desc || item.descricao || ""}</p>
        <span class="preco">R$ ${item.preco.toFixed(2)}</span>
        ${item.esgotado ? `<span class="tag-esgotado">ESGOTADO</span>` : ""}
    </div>
`;
      const imagemCard = card.querySelector("img");
      imagemCard?.addEventListener(
        "error",
        () => {
          imagemCard.src = "images/logo-trailer.webp";
        },
        { once: true },
      );

      card.onclick = () => {
        if (item.esgotado) {
          alert("Produto esgotado no momento.");
          return;
        }

        abrirProduto(item, categoria);
      };

      container.appendChild(card);
    });
  if (typeof atualizarVisibilidadeCardapio === "function") atualizarVisibilidadeCardapio();
}
let qtdProdutoAtual = 1;

function alterarQtdProduto(valor) {
  const quantidade = Math.max(1, qtdProdutoAtual + valor);
  if (limitarQuantidadeProdutoComAdicionais(quantidade)) return;
  qtdProdutoAtual = quantidade;
  document.getElementById("qtd-produto").innerText = qtdProdutoAtual;
}
function limitarQuantidadeProdutoComAdicionais(quantidade = qtdProdutoAtual) {
  const combo = categoriaProdutoAtual === "Combos";
  const temAdicional = combo
    ? typeof temAdicionaisComboSiteUI === "function" && temAdicionaisComboSiteUI()
    : Object.values(adicionaisSelecionados).some((a) => Number(a.qtd) > 0);
  if (quantidade <= 1 || !temAdicional) return false;
  qtdProdutoAtual = 1;
  document.getElementById("qtd-produto").innerText = "1";
  const itens = combo ? "Combos" : categoriaProdutoAtual === "Lanches" ? "Lanches" : "Itens";
  alert(`${itens} com adicionais devem ser adicionados ao carrinho uma unidade por vez.`);
  return true;
}
let adicionais = [];
async function carregarAdicionaisFirebase() {
  const snap = await db.collection("adicionais").where("ativo", "==", true).get();

  adicionais = [];

  snap.forEach((doc) => {
    const a = {
      id: doc.id,
      ...doc.data(),
    };

    if (a.esgotado) return;

    adicionais.push(a);
  });

  adicionais.sort((a, b) => Number(a.ordem || 999) - Number(b.ordem || 999));
}

let produtoAtual = {};
let focoAntesProduto = null;
let categoriaProdutoAtual = "Lanches";
let adicionaisSelecionados = {};
let avatarClienteAtual = "images/avatares/sem-rank/maionese.webp";
let cupomDescontoAplicado = null;
let onlineSessionId = localStorage.getItem("onlineSessionIdPedrao");
let indiceMolhoAtual = null;
let molhosGratisTempUI = [];
let janelaMolhoUnidadeUI = null;
let escolhaMolhoTempUI = null;
let unidadeMolhoTempUI = null;
let etapaMolhoUnidadeUI = "tipo";

if (!onlineSessionId) {
  onlineSessionId = "online_" + Date.now() + "_" + Math.random().toString(36).substring(2, 8);

  localStorage.setItem("onlineSessionIdPedrao", onlineSessionId);
}
let descontoCupom = 0;
let descontosCupons = {
  pedido: 0,
  taxa: 0,
  item: 0,
  total: 0,
  aplicados: [],
};

function abrirProduto(item, categoria = "Lanches") {
  if (item?.somenteAtendente) return;
  if (typeof permitirPedidoLojaUI === "function" && !permitirPedidoLojaUI()) return;
  focoAntesProduto = document.activeElement;
  produtoAtual = item;
  categoriaProdutoAtual = categoria;
  adicionaisSelecionados = {};
  qtdProdutoAtual = 1;
  document.getElementById("qtd-produto").innerText = "1";

  document.getElementById("modal-produto").style.display = "flex";
  document.querySelector("#modal-produto .btn-fechar-produto")?.focus({ preventScroll: true });
  document.querySelector("#modal-produto .modal-conteudo").scrollTop = 0;
  document.getElementById("modal-img").src = resolverImagemProduto(
    item.imagem || item.img || "lanche.png",
  );
  document.getElementById("modal-desc").innerText = item.desc || item.descricao || "";
  document.getElementById("modal-nome").innerText = item.nome;
  document.getElementById("obs-produto").value = "";
  const categoriaObs = String(item.categoria || categoria).toLowerCase();
  document.getElementById("obs-produto").placeholder = categoriaObs.includes("batata")
    ? "Ex.: caprichada, embalar separada..."
    : categoriaObs.includes("bebida")
      ? "Ex.: mandar canudo, copo..."
      : "Ex.: sem cebola, bem passado...";
  document.getElementById("lista-adicionais").style.display = "none";
  document.getElementById("lista-adicionais").classList.remove("aberta");
  document.getElementById("lista-adicionais").hidden = true;
  document.getElementById("btn-toggle-adicionais").setAttribute("aria-expanded", "false");
  document.getElementById("btn-toggle-adicionais").innerText = "Acréscimos";

  const boxAdicionais = document.getElementById("box-adicionais-produto");

  montarOpcoes(item);
  if (categoria === "Bebidas" || categoria === "Combos") {
    boxAdicionais.style.display = "none";
  } else {
    boxAdicionais.style.display = "block";
    montarAdicionais(categoria);
  }
}
function toggleAdicionaisProduto() {
  const lista = document.getElementById("lista-adicionais");
  const btn = document.getElementById("btn-toggle-adicionais");

  if (lista.style.display === "none") {
    lista.style.display = "block";
    lista.hidden = false;
    lista.classList.add("aberta");
    btn.setAttribute("aria-expanded", "true");
    btn.innerText = "Acréscimos";
  } else {
    lista.style.display = "none";
    lista.hidden = true;
    lista.classList.remove("aberta");
    btn.setAttribute("aria-expanded", "false");
    btn.innerText = "Acréscimos";
  }
}
function montarOpcoes(item) {
  const div = document.getElementById("modal-opcoes-tipo");
  const tipos = tiposCarneProdutoOperacao(item);
  div.dataset.quantidade = String(tipos.length);
  if (tipos.length <= 1) {
    div.innerHTML = "";
    return;
  }
  div.innerHTML = tipos
    .map(
      (tipo, index) =>
        '<label><input type="radio" name="tipo-produto" value="' +
        tipo.nome +
        '" data-preco="' +
        tipo.preco +
        '" ' +
        (index === 0 ? "checked" : "") +
        "><span>" +
        tipo.nome +
        "</span><small>" +
        moedaOperacao(tipo.preco) +
        "</small></label>",
    )
    .join("");
}
function montarAdicionais(categoria = "Lanches") {
  const lista = document.getElementById("lista-adicionais");
  lista.innerHTML = "";
  adicionaisSelecionados = {};
  if (typeof atualizarResumoAdicionaisProdutoUI === "function")
    atualizarResumoAdicionaisProdutoUI("lista-adicionais");

  let listaAdicionais = [...adicionais];
  if (categoria === "Batatas") {
    listaAdicionais = adicionais.filter((a) =>
      String(a.nome || "")
        .toLowerCase()
        .includes("cheddar"),
    );
  }

  if (produtoAtual.permiteAdicionais === false) {
    listaAdicionais = [];
  } else if (produtoAtual.modoAdicional === "selecionar") {
    listaAdicionais = adicionais.filter((a) => produtoAtual.adicionaisPermitidos?.includes(a.id));
  }

  if (categoria === "Bebidas" || categoria === "Combos") {
    listaAdicionais = [];
  }

  if (listaAdicionais.length === 0) {
    lista.innerHTML = "<p>Nenhum adicional disponível para este produto.</p>";
    return;
  }

  listaAdicionais.forEach((adicional, index) => {
    adicionaisSelecionados[index] = {
      qtd: 0,
      nome: adicional.nome,
      preco: Number(adicional.preco) || 0,
    };

    lista.innerHTML += `
            <div class="item-adicional adicional-combo-auto">
                <div class="info-adicional-combo-auto">
                    <strong>${adicional.nome}</strong>
                    <span>R$ ${Number(adicional.preco || 0).toFixed(2)}</span>
                </div>

                <div class="controle-adicional controle-adicional-combo-auto">
                    <button type="button" onclick="alterarAdicional(${index}, -1)">-</button>
                    <span id="qtd-adicional-${index}">0</span>
                    <button type="button" onclick="alterarAdicional(${index}, 1)">+</button>
                </div>
            </div>
        `;
  });
  if (typeof atualizarResumoAdicionaisProdutoUI === "function")
    atualizarResumoAdicionaisProdutoUI("lista-adicionais");
}

function alterarAdicional(index, valor) {
  adicionaisSelecionados[index].qtd += valor;

  if (adicionaisSelecionados[index].qtd < 0) {
    adicionaisSelecionados[index].qtd = 0;
  }

  document.getElementById(`qtd-adicional-${index}`).innerText = adicionaisSelecionados[index].qtd;
}
function adicionarOuSomar(nome, qtd, preco, categoria = "Lanches") {
  if (typeof permitirPedidoLojaUI === "function" && !permitirPedidoLojaUI()) return;
  const existente = carrinho.find((item) => item.nome === nome);

  if (existente) {
    existente.qtd += qtd;
  } else {
    carrinho.push({ nome, qtd, preco, categoria });
  }
}
function adicionarProdutoFinal() {
  if (typeof permitirPedidoLojaUI === "function" && !permitirPedidoLojaUI()) return;
  let tipoSelecionado = document.querySelector('input[name="tipo-produto"]:checked');
  let nomeFinal = produtoAtual.nome;
  let precoBase = produtoAtual.preco;

  if (tipoSelecionado) {
    const tipo = tipoSelecionado.value;

    if (tipo === "Industrial") precoBase = produtoAtual.precoIndustrial;
    if (tipo === "Frango") precoBase = produtoAtual.precoFrango;
    if (tipo === "Filé") precoBase = produtoAtual.precoFile;
    if (tipoSelecionado.dataset.preco) precoBase = Number(tipoSelecionado.dataset.preco);

    nomeFinal += ` (${tipo})`;
  }

  let adicionais = [];
  let totalExtras = 0;

  Object.values(adicionaisSelecionados).forEach((a) => {
    if (a.qtd > 0) {
      adicionais.push({
        nome: a.nome,
        qtd: a.qtd,
        preco: a.preco,
      });

      totalExtras += a.preco * a.qtd;
    }
  });

  const temAdicional = adicionais.length > 0;

  if (temAdicional && limitarQuantidadeProdutoComAdicionais()) return;

  const obs = document.getElementById("obs-produto").value.trim();

  const itemCarrinho = {
    produtoId: produtoAtual.id || null,
    tipoCarne: tipoSelecionado?.value.toLowerCase() || "",
    descricao: produtoAtual.descricao || produtoAtual.desc || "",
    nome: nomeFinal,
    qtd: qtdProdutoAtual,
    preco: precoBase + totalExtras,
    precoBase: precoBase,
    adicionais: adicionais,
    obs: obs,
    categoria: categoriaProdutoAtual,
    comboQtdLanches: produtoAtual.comboQtdLanches || 1,
    comboComponentes:
      String(categoriaProdutoAtual).toLowerCase() === "combos"
        ? aplicarTipoComboOperacao(produtoAtual, tipoSelecionado?.value).comboComponentes || []
        : produtoAtual.comboComponentes || [],
    molhosGratis: null,

    molhosPagos: [],

    totalMolhosPagos: 0,
  };

  carrinho.push(itemCarrinho);

  carrinhoVersao++;
  atualizarCarrinho();

  fecharModalProduto();
}

function adicionarDiretoCarrinho(nome, preco, categoria = "Lanches") {
  if (typeof permitirPedidoLojaUI === "function" && !permitirPedidoLojaUI()) return;
  const itemExistente = carrinho.find((item) => item.nome === nome);

  if (itemExistente) {
    itemExistente.qtd++;
  } else {
    carrinho.push({ nome, qtd: 1, preco, categoria });
  }

  atualizarCarrinho();
}

function fecharModalProduto() {
  const modal = document.getElementById("modal-produto");
  if (modal) {
    modal.style.display = "none";
    if (focoAntesProduto?.isConnected) focoAntesProduto.focus({ preventScroll: true });
  }
}

function fecharModal() {
  const modal = document.getElementById("modal-opcoes");
  modal.style.display = "none";

  document.getElementById("qtd-artesanal").value = 0;
  document.getElementById("qtd-industrial").value = 0;
}

function atualizarCarrinho() {
  carrinhoVersao++;
  const botao = document.getElementById("botao-flutuante");
  const valorTexto = document.getElementById("valor-total-flutuante");

  let total = carrinho.reduce((sum, item) => sum + item.preco * item.qtd, 0);

  const telaInicioAtiva = document.getElementById("tela-inicio")?.classList.contains("ativa");

  if (total > 0 && telaInicioAtiva) {
    botao.style.display = "flex";
    valorTexto.innerText = total.toFixed(2).replace(".", ",");
  } else {
    botao.style.display = "none";
  }
}

function renderizarCarrinho() {
  const container = document.getElementById("lista-carrinho");
  if (!container) return;

  container.innerHTML = "";

  const totalCarrinho = carrinho.reduce((total, item) => {
    return total + (Number(item.preco) || 0) * (Number(item.qtd) || 1);
  }, 0);

  container.innerHTML += `
        <div class="topo-carrinho">
            <h3>🛒 Seu carrinho</h3>
            <strong>R$ ${totalCarrinho.toFixed(2)}</strong>
        </div>
    `;

  carrinho.forEach((item, index) => {
    const adicionaisTexto =
      item.adicionais && item.adicionais.length > 0
        ? item.adicionais.map((a) => `${Number(a.qtd) || 0} ${escaparOperacao(a.nome)}`).join(" + ")
        : "";

    const obsTexto = escaparOperacao(item.obs || "");

    const temAdicional = item.adicionais && item.adicionais.length > 0;

    const valorItem = (Number(item.preco) || 0) * (Number(item.qtd) || 1);

    const div = document.createElement("div");
    div.classList.add("item-carrinho");

    div.innerHTML = `
            <div class="info-item-carrinho">

                <strong class="nome-item">
                    ${Number(item.qtd) || 1} ${escaparOperacao(item.nome)}
                </strong>

                <span class="valor-item-carrinho">
                    R$ ${valorItem.toFixed(2)}
                </span>

                ${
                  temAdicional
                    ? `
                        <small class="extras-item">
                            ➕ Acréscimos: ${adicionaisTexto}
                        </small>
                    `
                    : ""
                }

                ${typeof resumoComboHtmlSiteUI === "function" ? resumoComboHtmlSiteUI(item) : ""}
                ${
                  obsTexto
                    ? `
                        <small class="obs-item">
                            📝 ${/combo/i.test(item.categoria || item.nome || "") ? "Obs. geral" : "Obs"}: ${obsTexto}
                        </small>
                    `
                    : ""
                }

            </div>

            <div class="acoes-item">
                ${typeof modoEdicaoCarrinhoUI !== "undefined" && modoEdicaoCarrinhoUI ? `<button type="button" aria-label="Editar ${escaparOperacao(item.nome)}" onclick="editarItemCarrinhoUI(${index})">✎</button>` : `<button onclick="diminuirItem(${index})">➖</button><button onclick="aumentarItem(${index})">➕</button>`}
            </div>
        `;

    container.appendChild(div);
  });
}
function aumentarItem(index) {
  const item = carrinho[index];
  if (!item) return;
  if (!item.lanchesCombo?.length && (item.adicionais || []).some((a) => Number(a.qtd) > 0)) {
    alert("Com acréscimos, personalize um item por vez. Adicione outro item separadamente.");
    return;
  }
  carrinho[index].qtd++;

  atualizarCarrinho();
  renderizarCarrinho();
}
function diminuirItem(index) {
  if (carrinho[index].qtd > 1) {
    carrinho[index].qtd--;
  } else {
    carrinho.splice(index, 1);
  }

  atualizarCarrinho();
  renderizarCarrinho();
}
function removerItem(id) {
  carrinho = carrinho.filter((i) => i.id != id);
  atualizarCarrinho();
  renderizarCarrinho();
}
async function limparCarrinho() {
  if (
    await confirmarAvisoPersonagemUI(
      "Deseja realmente apagar todo o pedido e recomeçar?",
      "apagarPedido",
    )
  ) {
    carrinho = [];
    const revisao = document.getElementById("revisao-pedido");
    if (revisao) revisao.style.display = "none";
    const entregaCheckout = document.getElementById("checkout-entrega-ui");
    if (entregaCheckout) entregaCheckout.hidden = true;
    document.getElementById("finalizar-pedido")?.classList.remove("checkout-entrega-ativa");

    const listaConferencia = document.getElementById("lista-conferencia");
    if (listaConferencia) listaConferencia.innerHTML = "";

    dadosPedidoTemporario = {};
    descontoFidelidade = 0;
    cupomDescontoAplicado = null;
    descontoCupom = 0;

    const checkCupom = document.getElementById("check-cupom");
    if (checkCupom) checkCupom.checked = false;

    const areaCupom = document.getElementById("area-cupom-desconto");
    if (areaCupom) areaCupom.style.display = "none";

    const inputCupom = document.getElementById("codigo-cupom-desconto");
    if (inputCupom) inputCupom.value = "";

    const retornoCupom = document.getElementById("retorno-cupom-desconto");
    if (retornoCupom) retornoCupom.innerText = "";

    const linhaCupom = document.getElementById("linha-desconto-cupom");
    if (linhaCupom) linhaCupom.remove();
    atualizarCarrinho();

    const lista = document.getElementById("lista-carrinho");
    if (lista) lista.innerHTML = "";

    const carrinhoBox = document.getElementById("carrinho-box");
    if (carrinhoBox) carrinhoBox.style.display = "none";
    fecharCarrinho(); //

    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}
function abrirCarrinho() {
  if (typeof permitirPedidoLojaUI === "function" && !permitirPedidoLojaUI()) return;
  document.getElementById("modal-carrinho").style.display = "flex";
  renderizarCarrinho();
}
function irParaCategoria(id) {
  abrirTela("inicio");

  setTimeout(() => {
    const secao = document.getElementById(id);
    if (secao) {
      secao.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, 100);
}
function fecharCarrinho() {
  document.getElementById("modal-carrinho").style.display = "none";
}

function irParaFinalizar() {
  if (typeof permitirPedidoLojaUI === "function" && !permitirPedidoLojaUI()) return;
  fecharCarrinho();
  abrirTela("finalizar");

  setTimeout(() => {
    document.getElementById("finalizar-pedido").scrollIntoView({ behavior: "smooth" });
  }, 100);
}

function calcularTaxaEntregaSiteUI(km, agora = new Date()) {
  let taxa;
  if (km <= 2) taxa = 6;
  else if (km <= 3) taxa = 7;
  else if (km <= 4) taxa = 8;
  else if (km <= 5) taxa = 10;
  else if (km <= 6) taxa = 11;
  else if (km <= 7) taxa = 13;
  else if (km <= 8) taxa = 14;
  else if (km <= 9) taxa = 15;
  else if (km <= 10) taxa = 16;
  else taxa = km * 2;
  const data = `${agora.getDate()}/${agora.getMonth() + 1}`;
  if ([0, 6].includes(agora.getDay()) || feriados.includes(data)) taxa += 1;
  return Math.round((taxa + Number.EPSILON) * 100) / 100;
}

function finalizarPedido() {
  if (typeof permitirPedidoLojaUI === "function" && !permitirPedidoLojaUI()) return;
  const nomeContato = document.getElementById("nome-cliente");
  const telefoneContato = document.getElementById("telefone-cliente");
  if (
    !nomeContato.value.trim() ||
    (telefoneContato?.value || "").replace(/\D/g, "").length !== 11
  ) {
    (!nomeContato.value.trim() ? nomeContato : telefoneContato)?.focus();
    avisoOperacao("Informe nome e celular completo com DDD antes de continuar.");
    return;
  }
  cupomDescontoAplicado = null;
  descontoCupom = 0;

  const inputCupom = document.getElementById("codigo-cupom-desconto");
  if (inputCupom) inputCupom.value = "";

  const retornoCupom = document.getElementById("retorno-cupom-desconto");
  if (retornoCupom) retornoCupom.innerText = "";

  const linhaCupom = document.getElementById("linha-desconto-cupom");
  if (linhaCupom) linhaCupom.remove();
  const tipoEnvio = document.querySelector('input[name="tipo"]:checked');
  const obs = document.getElementById("observacao")?.value || "";

  let itensPedido = [];
  let valorLanches = 0;

  const agrupado = {};

  carrinho.forEach((item) => {
    const chave = item.nome;

    if (!agrupado[chave]) {
      agrupado[chave] = {
        nome: item.nome,
        quantidade: 0,
        preco: item.preco,
      };
    }

    agrupado[chave].quantidade += Number(item.qtd) || 1;
    valorLanches += item.preco * item.qtd;
  });

  Object.values(agrupado).forEach((item) => {
    itensPedido.push(
      `${item.quantidade} ${item.nome} (R$ ${(item.preco * item.quantidade).toFixed(2)})`,
    );
  });

  if (itensPedido.length === 0) return alert("Seu carrinho está vazio!");
  if (!tipoEnvio) return alert("Escolha Entrega ou Retirada!");

  if (tipoEnvio.value === "Retirada" || tipoEnvio.value === "Local") {
    exibirRevisao(itensPedido, valorLanches, 0, tipoEnvio.value, obs);
    return;
  }

  dadosPedidoTemporario = {};
  revisaoCarrinhoVersao = -1;
  document.getElementById("revisao-pedido").style.display = "none";
  return perguntarZonaRuralUI().then((area) => {
    if (area === "rural") {
      alert(
        "Os motoboys não atendem essas localidades, conforme os critérios da empresa que nos fornece o serviço. Você pode pedir para retirar ou comer no local.",
        "ruralBloqueada",
      );
      return;
    }
    if (area !== "urbana") return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const latCliente = pos.coords.latitude;
        const lonCliente = pos.coords.longitude;
        const kmDistancia = calcularDistancia(
          LAT_ESTABELECIMENTO,
          LON_ESTABELECIMENTO,
          latCliente,
          lonCliente,
        );

        const foraDaArea = kmDistancia > 15;
        const taxa = calcularTaxaEntregaSiteUI(kmDistancia);
        if (kmDistancia > 10)
          alert(
            foraDaArea
              ? "Seu endereço fica a mais de 15 km e está fora da área de entrega. Você pode enviar o pedido para verificarmos se será possível atender. Se a entrega for aceita, pode haver demora pelo percurso longo."
              : "Seu endereço fica a mais de 10 km. Pode haver demora na entrega por causa do percurso longo.",
            "entregaDistante",
          );

        const localizacaoLink = `https://www.google.com/maps?q=${latCliente},${lonCliente}`;
        exibirRevisao(
          itensPedido,
          valorLanches,
          taxa,
          "Entrega",
          obs,
          localizacaoLink,
          kmDistancia,
          foraDaArea,
          true,
        );
      },
      (erro) => {
        if (erro.code === 1) {
          alert(
            "🚫 Você bloqueou a localização.\n\n" +
              "Para ativar:\n" +
              "1. Clique no cadeado 🔒 na barra do navegador\n" +
              "2. Permita localização\n" +
              "3. Atualize a página\n\n" +
              "Ou escolha RETIRADA.",
          );
        } else if (erro.code === 2) {
          alert("❌ Não conseguimos obter sua localização. Tente novamente.");
        } else if (erro.code === 3) {
          alert("⏱️ Tempo de localização esgotado. Tente novamente.");
        }
      },
    );
  });
}
function toggleTroco() {
  const isDinheiro = document.getElementById("check-dinheiro").checked;
  document.getElementById("valor-troco").style.display = isDinheiro ? "block" : "none";
}

function exibirRevisao(
  itens,
  subtotal,
  taxa,
  tipo,
  obs,
  mapa = "",
  km = 0,
  foraDaArea = false,
  areaUrbanaConfirmada = false,
) {
  if (typeof permitirPedidoLojaUI === "function" && !permitirPedidoLojaUI()) return;
  dadosPedidoTemporario = {
    itens,
    subtotal,
    taxa,
    tipo,
    obs,
    mapa,
    km,
    foraDaArea,
    areaUrbanaConfirmada,
  };
  revisaoCarrinhoVersao = carrinhoVersao;

  const itensFormatados = carrinho.map((item) => {
    const temAdicional = item.adicionais && item.adicionais.length > 0;

    let texto = `
        <strong>
            ${Number(item.qtd) || 1} ${escaparOperacao(item.nome)}
            ${!temAdicional ? `(R$ ${Number(item.preco || 0).toFixed(2)})` : ""}
        </strong>
    `;

    if (temAdicional) {
      const adicionaisTexto = item.adicionais
        .map((a) => `${Number(a.qtd) || 0} ${escaparOperacao(a.nome)}`)
        .join(" + ");

      texto += `<br><small>➕ Acréscimos: ${adicionaisTexto}</small>`;
      texto += `<br><strong>Valor com acréscimos: R$ ${Number(item.preco || 0).toFixed(2)}</strong>`;
    }

    if (item.obs) {
      texto += `<br><small>📝 ${/combo/i.test(item.categoria || item.nome || "") ? "Obs. geral" : "Obs"}: ${escaparOperacao(item.obs)}</small>`;
    }
    if (item.molhosGratis && item.molhosGratis.length > 0) {
      const molhosTexto = item.molhosGratis
        .map((m) => `#${Number(m.unidade) || 1}: ${escaparOperacao(m.texto)}`)
        .join("<br>");

      texto += `
        <br>
        <small>
            🍶 Molhos:<br>${molhosTexto}
        </small>
    `;
    }
    if (item.molhosPagos && item.molhosPagos.length > 0) {
      const pagosTexto = item.molhosPagos
        .map((m) => `${Number(m.qtd) || 0} ${escaparOperacao(m.nome)}`)
        .join("<br>");

      texto += `
        <br>
        <small>
            💰 Molhos pagos:<br>${pagosTexto}
        </small>
    `;
    }
    const categoriaItem = String(item.categoria || "").toLowerCase();
    const podeTerMolho =
      categoriaItem.includes("lanche") ||
      categoriaItem.includes("combo") ||
      categoriaItem.includes("batata");

    if (podeTerMolho && tipo !== "Local") {
      texto += `
        <br>
        <button type="button" class="botao-molhos-item"
                onclick="abrirMolhosItem(${carrinho.indexOf(item)})">
            Molho
        </button>
    `;
    }

    if (typeof resumoComboHtmlSiteUI === "function") texto += resumoComboHtmlSiteUI(item);
    return texto;
  });

  document.getElementById("lista-conferencia").innerHTML = itensFormatados
    .map((item) => `<article class="revisao-item">${item}</article>`)
    .join("");

  document.getElementById("resumo-subtotal").innerText = `R$ ${subtotal.toFixed(2)}`;

  document.getElementById("resumo-taxa").innerText = foraDaArea
    ? `R$ ${taxa.toFixed(2)} (estimada)`
    : `R$ ${taxa.toFixed(2)}`;

  const totalMolhosPagos = calcularTotalMolhosPagos();

  const linhaMolhos = document.getElementById("linha-molhos-pagos");

  if (linhaMolhos) {
    linhaMolhos.innerText = `R$ ${totalMolhosPagos.toFixed(2)}`;
  }

  let total = subtotal + taxa + totalMolhosPagos;

  const totalAntesDesconto = subtotal + totalMolhosPagos;
  const descontoProdutosCupom = Math.max(
    0,
    descontoCupom -
      (typeof pedidoBeneficiosRevisaoUI === "function"
        ? pedidoBeneficiosRevisaoUI().descontoCupomTaxa
        : cupomDescontoAplicado?.tipo === "taxa"
          ? descontoCupom
          : 0),
  );
  const produtosAposCupom = Math.max(0, totalAntesDesconto - descontoProdutosCupom);

  let bonusAtual = Number(clienteLogado?.bonusDisponivel || 0);
  let totalGastoAtual = Number(clienteLogado?.totalFidelidade || 0);

  const proximaMeta = (Math.floor(totalGastoAtual / 300) + 1) * 300;

  const vaiGerarBonusNestePedido =
    !(typeof checkoutProtegidoUI !== "undefined" && checkoutProtegidoUI.habilitado) &&
    clienteLogado &&
    clienteLogado.fidelidadeAtiva &&
    produtosAposCupom >= 10 &&
    totalGastoAtual + totalAntesDesconto >= proximaMeta;

  if (
    tipo !== "Local" &&
    (!(typeof checkoutProtegidoUI !== "undefined" && checkoutProtegidoUI.habilitado) ||
      !!clienteLogado?.authUid) &&
    clienteLogado &&
    clienteLogado.fidelidadeAtiva &&
    produtosAposCupom >= 10 &&
    (bonusAtual >= 10 || vaiGerarBonusNestePedido)
  ) {
    descontoFidelidade = 10;
    total -= descontoFidelidade;

    if (total < 0) total = 0;
  } else {
    descontoFidelidade = 0;
  }

  const box = document.getElementById("detalhe-valores");

  let bonusEl = document.getElementById("linha-bonus");
  if (clienteLogado?.fidelidadeAtiva && Number(clienteLogado.bonusDisponivel || 0) > 0) {
    if (!bonusEl) {
      bonusEl = document.createElement("p");
      bonusEl.id = "linha-bonus";
      bonusEl.style.color = "#2ecc71";
      bonusEl.style.fontWeight = "bold";
      box.insertBefore(bonusEl, document.getElementById("resumo-total").parentElement);
    }

    bonusEl.innerText = `Bônus disponível: R$ ${Number(clienteLogado.bonusDisponivel || 0).toFixed(2)}`;
  } else {
    if (bonusEl) bonusEl.remove();
  }

  let descontoEl = document.getElementById("linha-desconto");
  if (descontoFidelidade > 0) {
    if (!descontoEl) {
      descontoEl = document.createElement("p");
      descontoEl.id = "linha-desconto";
      descontoEl.style.color = "#2ecc71";
      descontoEl.style.fontWeight = "bold";
      box.insertBefore(descontoEl, document.getElementById("resumo-total").parentElement);
    }

    descontoEl.innerText = `Desconto fidelidade: -R$ ${descontoFidelidade.toFixed(2)}`;
  } else {
    if (descontoEl) descontoEl.remove();
  }

  let aviso = document.getElementById("aviso-fora-area");

  if (foraDaArea) {
    if (!aviso) {
      aviso = document.createElement("div");
      aviso.id = "aviso-fora-area";
      aviso.style.marginTop = "10px";
      aviso.style.color = "#ff4444";
      aviso.style.fontWeight = "bold";
      document.getElementById("revisao-pedido").appendChild(aviso);
    }

    aviso.innerHTML = `
            🚫 Fora da área de entrega<br>
            📍 ${km.toFixed(2)} km<br>
            💰 Taxa pode sofrer alteração
        `;
  } else {
    if (aviso) aviso.remove();
  }

  let avisoDistancia = document.getElementById("aviso-entrega-distante-ui");
  if (tipo === "Entrega" && km > 10) {
    if (!avisoDistancia) {
      avisoDistancia = document.createElement("p");
      avisoDistancia.id = "aviso-entrega-distante-ui";
      avisoDistancia.setAttribute("role", "note");
      document.getElementById("revisao-pedido").append(avisoDistancia);
    }
    avisoDistancia.textContent = "O percurso é longo e pode haver demora na entrega.";
  } else avisoDistancia?.remove();

  let cupomEl = document.getElementById("linha-desconto-cupom");

  if (descontoCupom > 0) {
    descontoCupom = Math.min(descontoCupom, total);
    total -= descontoCupom;
    if (total < 0) total = 0;

    // Preserva o percentual exato do cupom; arredonda somente o total final.

    if (!cupomEl) {
      cupomEl = document.createElement("p");
      cupomEl.id = "linha-desconto-cupom";
      cupomEl.style.color = "#2ecc71";
      cupomEl.style.fontWeight = "bold";
      box.insertBefore(cupomEl, document.getElementById("resumo-total").parentElement);
    }

    cupomEl.innerText = `Cupom de desconto: -R$ ${descontoCupom.toFixed(2)}`;
  } else {
    if (cupomEl) cupomEl.remove();
  }
  if (typeof aplicarBeneficiosRevisaoDeliveryUI === "function")
    total = Math.max(0, total - aplicarBeneficiosRevisaoDeliveryUI());
  total = arredondarPagamento(total);
  let textoTotal = `R$ ${total.toFixed(2)}`;

  if (foraDaArea) {
    textoTotal += " (estimado)";
  }

  document.getElementById("resumo-total").innerText = textoTotal;

  carregarEnderecosNaRevisao(tipo);

  const revisao = document.getElementById("revisao-pedido");

  const estavaFechado = revisao.style.display === "none" || revisao.style.display === "";

  revisao.style.display = "block";

  if (estavaFechado) {
    revisao.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }
}
function toggleCupomDesconto() {
  const marcado = document.getElementById("check-cupom").checked;
  const area = document.getElementById("area-cupom-desconto");

  area.style.display = marcado ? "block" : "none";

  if (!marcado) {
    cupomDescontoAplicado = null;
    descontoCupom = 0;

    document.getElementById("codigo-cupom-desconto").value = "";
    document.getElementById("retorno-cupom-desconto").innerText = "";

    exibirRevisao(
      dadosPedidoTemporario.itens,
      dadosPedidoTemporario.subtotal,
      dadosPedidoTemporario.taxa,
      dadosPedidoTemporario.tipo,
      dadosPedidoTemporario.obs,
      dadosPedidoTemporario.mapa,
      dadosPedidoTemporario.km,
      dadosPedidoTemporario.foraDaArea,
      dadosPedidoTemporario.areaUrbanaConfirmada,
    );
  }
}
function estaAberto() {
  const agora = new Date();
  const hora = agora.getHours();
  const dia = agora.getDay();

  if (dia === 5 || dia === 6) {
    return hora >= 18 || hora < 1;
  } else {
    return hora >= 18 || hora < 0.5;
  }
}

function entregaAtiva() {
  const agora = new Date();
  const hora = agora.getHours();
  const minuto = agora.getMinutes();

  return hora < 23 || (hora === 23 && minuto <= 30);
}

async function confirmarEEnviar() {
  if (typeof checkoutProtegidoUI !== "undefined") {
    try {
      if (await checkoutProtegidoUI.ativo()) {
        const anterior = await checkoutProtegidoUI.recuperar();
        if (anterior.pedido) return finalizarPedidoCheckoutProtegidoUI(anterior.pedido);
      }
    } catch (e) {
      return mostrarAvisoUI(e.message, "conferir");
    }
  }
  if (typeof permitirPedidoLojaUI === "function" && !permitirPedidoLojaUI()) return;
  if (typeof conferirBeneficiosAntesEnvioUI === "function") {
    try {
      if (!(await conferirBeneficiosAntesEnvioUI())) return;
    } catch {
      return mostrarAvisoUI(
        "Não foi possível conferir seus benefícios. Tente novamente antes de enviar.",
        "conferir",
      );
    }
  }
  const nomeCliente = document.getElementById("nome-cliente").value;
  const telefoneCliente = document.getElementById("telefone-cliente").value;
  if (!nomeCliente) {
    return alert("Por favor, informe seu nome!");
  }
  const telefoneFinalCliente = telefoneCliente || clienteLogado?.telefone || "";
  const telefoneLimpo = telefoneFinalCliente.replace(/\D/g, "");
  const precisaTroco = document.getElementById("check-dinheiro")?.checked;
  const valorTroco = document.getElementById("valor-troco")?.value;
  if (revisaoCarrinhoVersao !== carrinhoVersao) {
    alert("Seu carrinho mudou. Clique em FINALIZAR PEDIDO novamente para atualizar a revisão.");
    return;
  }

  if (telefoneLimpo && telefoneLimpo.length < 10) {
    return alert("Telefone inválido!");
  }
  const marcados = document.querySelectorAll(".check-pagamento:checked");
  if (marcados.length === 0) {
    return alert("Por favor, selecione uma forma de pagamento!");
  }
  const selectCondominio = document.getElementById("condominio");
  const selectCNH = document.getElementById("cnh");

  const condominio = selectCondominio ? selectCondominio.value : "Não informado";
  const cnh = selectCNH ? selectCNH.value : "Não";
  const d = dadosPedidoTemporario;
  if (!d) return alert("Erro nos dados do pedido. Tente novamente.");
  if (d.tipo === "Entrega" && d.areaUrbanaConfirmada !== true)
    return alert(
      "Confirme o acesso por asfalto e a área atendida. Clique em FINALIZAR PEDIDO novamente.",
      "ruralBloqueada",
    );

  const itensProcessados = carrinho.map((item) => {
    return {
      nome: item.nome || "Produto",
      tipoCarne: item.tipoCarne || "",
      produtoId: item.produtoId || item.id || null,
      descricao: item.desc || item.descricao || obterTextoCompletoProduto(item),
      lanchesCombo: item.lanchesCombo || [],
      comboQtdLanches: item.comboQtdLanches || 0,
      comboComponentes: item.comboComponentes || [],
      bebida: item.bebida || item.bebidaCombo || "",
      bebidas: item.bebidas || [],

      preco: parseFloat(item.preco) || 0,
      precoBase: parseFloat(item.precoBase) || 0,

      quantidade: parseInt(item.qtd) || 1,
      categoria: item.categoria || "Lanches",

      observacao: item.obs || "",
      adicionais: item.adicionais || [],

      molhosGratis: item.molhosGratis || [],
      molhosPagos: item.molhosPagos || [],
      totalMolhosPagos: Number(item.totalMolhosPagos || 0),
    };
  });
  const pagamentosSelecionados = Array.from(marcados).map((el) => el.value);
  const pagamento = pagamentosSelecionados.join(" + ");

  const totalMolhosPagos = calcularTotalMolhosPagos();

  const valorAntesDesconto = (Number(d.subtotal) || 0) + (Number(d.taxa) || 0) + totalMolhosPagos;

  let totalFinal = valorAntesDesconto;

  if (descontoFidelidade > 0) {
    totalFinal -= descontoFidelidade;
  }

  if (descontoCupom > 0) {
    totalFinal -= descontoCupom;
  }

  if (totalFinal < 0) totalFinal = 0;

  const creditoEntrega =
    typeof descontoCreditoEntregaUI === "number" ? descontoCreditoEntregaUI : 0;
  totalFinal = arredondarPagamento(Math.max(0, totalFinal - creditoEntrega));

  const pedidoFirebase = {
    origem: "site_delivery",
    nome: nomeCliente || clienteLogado?.nome || "",
    telefone: telefoneFinalCliente,
    telefoneLimpo: telefoneLimpo,
    clienteId: clienteLogado ? clienteLogado.telefone : null,
    clienteAuthUid: clienteLogado?.authUid || null,

    itens: itensProcessados,
    valorTotal: totalFinal,
    valorAntesDesconto: valorAntesDesconto,
    descontoFidelidade: descontoFidelidade || 0,
    fidelidadeAtivaNoPedido: clienteLogado ? !!clienteLogado.fidelidadeAtiva : false,
    cupomDescontoCodigo: cupomDescontoAplicado ? cupomDescontoAplicado.codigo : "",
    cupomDescontoNome: cupomDescontoAplicado ? cupomDescontoAplicado.nome : "",
    descontoCupom: descontoCupom || 0,
    descontoCreditoEntrega: creditoEntrega,
    ...(creditoEntrega > 0 ? { creditoEntregaMes: competenciaRankMensalUI() } : {}),
    descontoCupomTaxa:
      cupomDescontoAplicado?.tipo === "taxa"
        ? descontoCupom || 0
        : ["pedido", "descontoGeral"].includes(cupomDescontoAplicado?.tipo) &&
            cupomDescontoAplicado?.modo === "porcentagem"
          ? Math.min(
              descontoCupom || 0,
              (Number(d.taxa || 0) * Number(cupomDescontoAplicado.valor || 0)) / 100,
            )
          : 0,
    codigoCliente: clienteLogado ? clienteLogado.codigoAtivacao || "" : "",
    taxaEntrega: Number(d.taxa) || 0,
    distanciaKm: d.tipo === "Entrega" ? Number(d.km) || 0 : 0,
    tipo: d.tipo,
    endereco: document.getElementById("endereco-escrito")?.value.trim() || "",
    condominio,
    cnh,
    localizacao: d.mapa || "",
    areaUrbanaConfirmada: d.tipo === "Entrega" ? d.areaUrbanaConfirmada === true : null,
    pagamento: pagamento,
    trocoPara: precisaTroco && valorTroco ? Number(valorTroco) : null,
    observacao: d.obs || "",

    data: new Date().toISOString(),
    dataMs: Date.now(),
  };

  const numeroPedido = await salvarPedidoFirebase(pedidoFirebase);
  if (numeroPedido === null) return;
  if (pedidoFirebase.checkoutProtegido === 1)
    return finalizarPedidoCheckoutProtegidoUI(pedidoFirebase);
  if (clienteLogado) {
    const atualizado = await registrarBeneficiosPedidoOperacao(pedidoFirebase.id);
    if (atualizado) Object.assign(clienteLogado, atualizado);
  }

  const msg = montarMensagemPedidoWhatsUI({
    nome: nomeCliente,
    telefone: telefoneCliente,
    tipo: d.tipo,
    itens: carrinho,
    total: totalFinal,
    taxa: d.taxa,
    km: d.km,
    mapa: d.mapa,
    endereco: document.getElementById("endereco-escrito")?.value.trim(),
    condominio,
    cnh,
    observacao: d.obs,
    pagamento,
    descontoCupom,
    descontoFidelidade,
    descontoCreditoEntrega: creditoEntrega,
    trocoPara: precisaTroco ? valorTroco : null,
  });
  const url = `https://wa.me/5565992386045?text=${encodeURIComponent(textoWhatsAppSemEmojisUI(msg))}`;
  if (typeof abrirMensagemWhatsPedidoUI === "function") abrirMensagemWhatsPedidoUI(msg);
  else window.open(url, "_blank");

  descontoFidelidade = 0;
  carrinho = [];
  dadosPedidoTemporario = {};
  if (document.getElementById("observacao")) document.getElementById("observacao").value = "";
  revisaoCarrinhoVersao = -1;
  cupomDescontoAplicado = null;
  descontoCupom = 0;

  const revisao = document.getElementById("revisao-pedido");
  if (revisao) revisao.style.display = "none";

  const listaConferencia = document.getElementById("lista-conferencia");
  if (listaConferencia) listaConferencia.innerHTML = "";
  if (typeof atualizarCarrinho === "function") atualizarCarrinho();
  if (typeof fecharModalCheck === "function") fecharModalCheck();
  if (typeof fecharCheckoutUI === "function") fecharCheckoutUI("inicio");
}

async function salvarPedidoFirebase(pedido) {
  if (typeof permitirPedidoLojaUI === "function" && !permitirPedidoLojaUI()) return null;
  try {
    if (!pedido) {
      console.error("Pedido vazio. Não salvou no Firebase.");
      return null;
    }
    if (typeof checkoutProtegidoUI !== "undefined" && (await checkoutProtegidoUI.ativo())) {
      const salvo = await checkoutProtegidoUI.salvar(pedido);
      Object.assign(pedido, salvo.pedido);
      return pedido.numero;
    }

    const contadorRef = await prepararContadorPedidoOperacao(db);

    const numero = await db.runTransaction(async (t) => {
      if (typeof conferirLojaNaTransacaoUI === "function") await conferirLojaNaTransacaoUI(t);
      const doc = await t.get(contadorRef);

      let novoNumero = 1;

      if (doc.exists) {
        novoNumero = doc.data().ultimoNumero + 1;
      }

      t.set(contadorRef, { ultimoNumero: novoNumero });

      return novoNumero;
    });

    pedido.numero = numero;
    pedido.numeroDia = numero;
    pedido.diaOperacional = contadorRef.id.replace("contadorPedidos_", "");
    if (pedido.tipo === "Entrega")
      pedido.numeroEntregaDia = await reservarNumeroEntregaOperacao(db);

    let docRef;
    if (typeof salvarPedidoLojaAbertaUI === "function") {
      docRef = db.collection("pedidos").doc();
      pedido.id = docRef.id;
      await salvarPedidoLojaAbertaUI(docRef, pedido);
    } else if (pedido.cupomDescontoCodigo) {
      docRef = db.collection("pedidos").doc();
      pedido.id = docRef.id;
      await salvarPedidoComCupomOperacao(docRef, pedido);
    } else docRef = await db.collection("pedidos").add(pedido);

    pedido.id = docRef.id;

    if (!pedido.cupomDescontoCodigo && typeof salvarPedidoLojaAbertaUI !== "function")
      await db.collection("pedidos").doc(docRef.id).update({ id: docRef.id });

    return numero;
  } catch (erro) {
    if (erro.code === "LOJA_FECHADA" && typeof atualizarEstadoLojaPublicaUI === "function") {
      atualizarEstadoLojaPublicaUI("fechada");
      permitirPedidoLojaUI();
      return null;
    }
    console.error("Erro ao salvar:", erro);
    avisoOperacao(erro.message || "Não foi possível salvar o pedido.");
    return null;
  }
}

async function carregarProdutosFirebase() {
  const snap = await lerComPrazoUI(db.collection("produtos").where("ativo", "==", true).get());

  let lanches = [];
  let combos = [];
  let bebidas = [];
  let batatas = [];

  snap.forEach((doc) => {
    const p = {
      id: doc.id,
      ...doc.data(),
    };

    if (p.somenteAtendente) return;
    if (p.categoria === "lanches") {
      lanches.push(p);
    } else if (p.categoria === "combos") {
      combos.push(p);
    } else if (p.categoria === "bebidas") {
      bebidas.push(p);
    } else if (p.categoria === "batatas") {
      batatas.push(p);
    }
  });

  lanches.sort((a, b) => a.ordem - b.ordem);
  combos.sort((a, b) => a.ordem - b.ordem);
  bebidas.sort((a, b) => a.ordem - b.ordem);
  batatas.sort((a, b) => a.ordem - b.ordem);

  document.getElementById("container-lanches").innerHTML = "";
  document.getElementById("container-combos").innerHTML = "";
  document.getElementById("container-bebidas").innerHTML = "";
  document.getElementById("container-batatas").innerHTML = "";

  gerarItens(lanches, "container-lanches", "lanche.png");
  gerarItens(combos, "container-combos", "combo.png");
  gerarItens(bebidas, "container-bebidas", "refri-latas.jpg");
  gerarItens(batatas, "container-batatas", "batata-frita.media-cortada.png");
}

const botaoFlutuante = document.getElementById("botao-flutuante");

if (botaoFlutuante) {
  botaoFlutuante.addEventListener("click", abrirCarrinho);
}

document.addEventListener("DOMContentLoaded", () => {
  const tipoInputs = document.querySelectorAll('input[name="tipo"]');
  const campoCondominio = document.getElementById("box-condominio");
  const selectCondominio = document.getElementById("condominio");

  const campoCNH = document.getElementById("campo-cnh");
  const selectCNH = document.getElementById("cnh");

  // Quando escolhe ENTREGA / RETIRADA
  tipoInputs.forEach((input) => {
    input.addEventListener("change", (e) => {
      const tipo = e.target.value;

      if (tipo === "Entrega") {
        campoCondominio.style.display = "block";
      } else {
        campoCondominio.style.display = "none";
        campoCNH.style.display = "none";

        if (selectCondominio) selectCondominio.value = "Não";
        if (selectCNH) selectCNH.value = "Não";
      }
    });
  });

  // Quando muda o condomínio
  if (selectCondominio) {
    selectCondominio.addEventListener("change", () => {
      if (selectCondominio.value === "Sim") {
        campoCNH.style.display = "block";
      } else {
        campoCNH.style.display = "none";

        if (selectCNH) selectCNH.value = "Não";
      }
    });
  }
});

const paginaTemCardapioCliente = document.getElementById("container-lanches");

if (paginaTemCardapioCliente) {
  for (const id of [
    "container-lanches",
    "container-combos",
    "container-bebidas",
    "container-batatas",
  ])
    document.getElementById(id).innerHTML = htmlCarregandoUI("Buscando cardápio…");
  Promise.all([
    carregarProdutosFirebase(),

    carregarAdicionaisFirebase().then(() => {
      const modal = document.getElementById("modal-produto");
      if (
        modal &&
        modal.style.display === "flex" &&
        !Object.values(adicionaisSelecionados).some((a) => a.qtd > 0)
      )
        montarAdicionais(categoriaProdutoAtual);
    }),
  ]).catch(() => {
    paginaTemCardapioCliente.innerHTML =
      '<p>Não foi possível carregar o cardápio. Confira sua conexão.</p><button onclick="location.reload()">Tentar novamente</button>';
  });
}

function calcularDistancia(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function validarQtd(input) {
  if (input.value < 0) input.value = 0;
}
function ajustarQtd(idInput, valor) {
  const input = document.getElementById(idInput);
  let atual = parseInt(input.value) || 0;
  let novo = atual + valor;
  if (novo < 0) novo = 0;
  input.value = novo;
}

let graficoVendas;

function atualizarGrafico(periodo, dadosFiltrados) {
  const ctx = document.getElementById("meuGrafico").getContext("2d");

  if (graficoVendas) graficoVendas.destroy();

  let labels = [];
  let valores = [];
  let agrupado = {};

  if (periodo === "hoje") {
    for (let i = 0; i < 24; i++) agrupado[`${i}h`] = 0;
    dadosFiltrados.forEach((v) => {
      const hora = new Date(v.data || v.dataVenda).getHours();
      agrupado[`${hora}h`] += parseFloat(v.valorTotal);
    });
  } else if (periodo === "semana") {
    const dias = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    dias.forEach((d) => (agrupado[d] = 0));
    dadosFiltrados.forEach((v) => {
      const dia = dias[new Date(v.data || v.dataVenda).getDay()];
      agrupado[dia] += parseFloat(v.valorTotal);
    });
  } else {
    dadosFiltrados.forEach((v) => {
      const diaMes = new Date(v.data || v.dataVenda).getDate();
      agrupado[diaMes] = (agrupado[diaMes] || 0) + parseFloat(v.valorTotal);
    });
  }

  labels = Object.keys(agrupado);
  valores = Object.values(agrupado);

  graficoVendas = new Chart(ctx, {
    type: "line",
    data: {
      labels: labels,
      datasets: [
        {
          label: "Faturamento R$",
          data: valores,
          borderColor: "#ff0000",
          backgroundColor: "rgba(255, 0, 0, 0.1)",
          fill: true,
          tension: 0.3,
        },
      ],
    },
    options: {
      responsive: true,
      scales: {
        y: { beginAtZero: true, grid: { color: "#333" } },
        x: { grid: { color: "#333" } },
      },
      plugins: {
        legend: { labels: { color: "#fff" } },
      },
    },
  });
}

const telInput = document.getElementById("telefone-cliente");

if (telInput) {
  telInput.addEventListener("input", function (e) {
    const campo = e.target;
    const cursor = campo.selectionStart;
    const posicao = campo.value.slice(0, cursor ?? campo.value.length).replace(/\D/g, "").length;
    const valor = campo.value.replace(/\D/g, "").slice(0, 11);
    if (campo.value !== valor) {
      campo.value = valor;
      campo.setSelectionRange(Math.min(posicao, 11), Math.min(posicao, 11));
    }
  });
}

function abrirInfoLojaUI(tipo) {
  const informacoes = {
    preparo: {
      personagem: "infoPreparo",
      mensagem:
        "Esse é o tempo de preparo do seu lanche: no mínimo 15 minutos. O prazo pode aumentar conforme o movimento da cozinha e não inclui o tempo de entrega.",
    },
    whatsapp: {
      personagem: "infoWhatsapp",
      mensagem: "Vamos te encaminhar para o nosso WhatsApp para tirar suas dúvidas, ok?",
      url: "https://wa.me/5565992386045",
    },
    entrega: {
      personagem: "infoEntrega",
      mensagem:
        "Nossas entregas são terceirizadas. As taxas são predefinidas pela empresa que nos fornece os motoboys e calculadas conforme a distância em quilômetros.\n\nNo fechamento do pedido, autorize a localização GPS no navegador. Assim, calculamos a taxa e mostramos o valor antes de você confirmar.",
    },
  };
  const info = informacoes[tipo];
  if (!info) return;
  if (info.url) mostrarAjudaComLinkUI(info.mensagem, info.url, info.personagem);
  else mostrarAvisoUI(info.mensagem, info.personagem);
}

function atualizarHorarioFuncionamento() {
  const el = document.getElementById("horario-funcionamento");
  if (!el) return;
  if (typeof estadoLojaPublicaUI !== "undefined" && estadoLojaPublicaUI !== "aberta") {
    el.textContent =
      estadoLojaPublicaUI === "fechada"
        ? "🔴 FECHADO - Novos pedidos indisponíveis no momento"
        : "Conferindo disponibilidade da loja…";
    el.style.borderColor = "red";
    return;
  }

  const agora = new Date();
  const hora = agora.getHours();
  const dia = agora.getDay();

  let aberto = false;
  let texto = "";

  if (dia === 5 || dia === 6) {
    // sexta e sábado
    aberto = hora >= 18 || hora < 1;
    texto = "18:00 às 01:00";
  } else {
    // outros dias
    aberto = hora >= 18 || hora < 0;
    texto = "18:00 às 00:00";
  }

  if (aberto) {
    el.innerHTML = `🟢 ABERTO AGORA - Funcionamos das ${texto}`;
    el.style.borderColor = "#00ff88";
  } else {
    el.innerHTML = `🔴 FECHADO - Abrimos às 18:00`;
    el.style.borderColor = "red";
  }
}

// roda ao carregar
document.addEventListener("DOMContentLoaded", atualizarHorarioFuncionamento);

// atualiza sozinho a cada minuto
setInterval(atualizarHorarioFuncionamento, 60000);

const modalProdutoSite = document.getElementById("modal-produto");

if (modalProdutoSite) {
  modalProdutoSite.addEventListener("click", function (e) {
    if (e.target.id === "modal-produto") {
      fecharModalProduto();
    }
  });
}

function abrirTela(nome) {
  if (nome === "finalizar" && typeof permitirPedidoLojaUI === "function" && !permitirPedidoLojaUI())
    return;
  if (nome !== "perfil") {
    const avatares = document.getElementById("lista-avatares");
    if (avatares) avatares.style.display = "none";
  }
  document.querySelectorAll(".tela-app").forEach((tela) => {
    tela.classList.remove("ativa");
  });

  const tela = document.getElementById(`tela-${nome}`);
  if (tela) tela.classList.add("ativa");

  atualizarCarrinho();

  window.scrollTo({ top: 0, behavior: "smooth" });
}
async function ativarCodigoClienteLogado() {
  if (!clienteLogado) return alert("Entre na sua conta para ativar o código.");
  const campo = document.getElementById("codigo-ativacao-logado");
  const codigo = String(campo?.value || "").trim();
  if (!codigo) return alert("Digite seu código de ativação.");
  const botao = document.querySelector("#ativar-cda-box .ativar-cda");
  if (botao?.disabled) return;
  if (botao) botao.disabled = true;
  try {
    if (typeof checkoutProtegidoUI !== "undefined" && (await checkoutProtegidoUI.ativo())) {
      const resultado = await checkoutProtegidoUI.ativar(codigo);
      clienteLogado = (await checkoutProtegidoUI.perfil()).cliente;
      campo.value = "";
      atualizarTelaClienteLogado();
      if (resultado.ativado) mostrarAtivacaoCdaPedraoUI();
      return;
    }
    const ref = db.collection("clientes").doc(clienteLogado.telefone);
    const dados = await db.runTransaction(async (transacao) => {
      const doc = await transacao.get(ref);
      const cliente = doc.exists ? doc.data() : null;
      if (!cliente?.codigoAtivacao || codigo !== String(cliente.codigoAtivacao).trim()) {
        return null;
      }
      const nivelCliente = nivelFidelidadeOperacao(cliente, true);
      if (cliente.fidelidadeAtiva) {
        if (cliente.nivelCliente !== nivelCliente) transacao.update(ref, { nivelCliente });
        return { cliente: { ...cliente, nivelCliente }, ativou: false };
      }
      const ativacao = { fidelidadeAtiva: true, nivelCliente, ativadoEm: new Date().toISOString() };
      transacao.update(ref, ativacao);
      return { cliente: { ...cliente, ...ativacao }, ativou: true };
    });
    if (!dados)
      return alert(
        "Esse código não existe ou você digitou errado. Confira e tente novamente.",
        "codigo",
      );
    clienteLogado = dados.cliente;
    campo.value = "";
    atualizarTelaClienteLogado();
    if (dados.ativou) mostrarAtivacaoCdaPedraoUI();
  } catch (erro) {
    if (erro.status === 400 || erro.status === 409) return alert(erro.message, "codigo");
    if (String(erro.code || "").includes("resource-exhausted")) {
      alert(
        "A ativação está temporariamente indisponível. Tente mais tarde ou fale conosco pelo WhatsApp. Seu código ainda não foi verificado.",
      );
    } else {
      alert("Não foi possível verificar o código agora. Confira sua conexão e tente novamente.");
    }
  } finally {
    if (botao) botao.disabled = false;
  }
}

function explicarCodigo() {
  const msg =
    "O código de ativação libera seus benefícios conosco! Mas é só para clientes.\n\n" +
    "Você é cliente? Então envie uma mensagem no nosso WhatsApp que te envio seu código.";

  const texto = encodeURIComponent("Olá, quero receber meu cupom fidelidade do Pedrão Lanches.");
  mostrarAjudaComLinkUI(msg, `https://wa.me/5565992386045?text=${texto}`);
}
let clienteLogado = null;
let descontoFidelidade = 0;

function limparTelefonePerfil() {
  return document.getElementById("perfil-telefone").value.replace(/\D/g, "").slice(0, 11);
}

async function buscarCliente() {
  if (typeof acessoClienteSenhaUI !== "undefined") {
    try {
      if (await window.acessoClienteSenhaUI.ativo()) return entrarClienteSenhaDeliveryUI();
    } catch (erro) {
      alert(erro.message);
      return;
    }
  }
  const nome = document.getElementById("perfil-nome").value.trim();
  const telefone = limparTelefonePerfil();
  const salvarLogin = document.getElementById("check-salvar-login")?.checked || false;

  if (!nome) return alert("Informe seu nome e sobrenome.");
  if (telefone.length !== 11) {
    return alert("Informe o celular completo com DDD. Ex: 65999999999");
  }
  const ref = db.collection("clientes").doc(telefone);
  const doc = await ref.get();

  if (!doc.exists) {
    alert("Cliente não encontrado. Crie um perfil primeiro.");
    return;
  } else {
    clienteLogado = doc.data();
    if (telefone.length !== 11) {
      return alert("Informe o celular completo com DDD. Ex: 65999999999");
    }
    const nomeDigitado = nome.toLowerCase().trim();
    const nomeCadastrado = String(clienteLogado.nome || "")
      .toLowerCase()
      .trim();

    if (nomeDigitado !== nomeCadastrado) {
      clienteLogado = null;
      alert("Nome e telefone não conferem com o cadastro.");
      return;
    }
    avatarClienteAtual = clienteLogado.avatar || "images/avatares/sem-rank/maionese.webp";
    selecionarAvatar(avatarClienteAtual);

    mostrarBoasVindasUI(clienteLogado.nome || nome);
  }

  document.getElementById("nome-cliente").value = clienteLogado.nome || nome;
  document.getElementById("telefone-cliente").value = clienteLogado.telefone || telefone;

  document.getElementById("perfil-nome").value = clienteLogado.nome || nome;
  document.getElementById("perfil-telefone").value = clienteLogado.telefone || telefone;

  if (salvarLogin) {
    localStorage.setItem(
      "clientePedrao",
      JSON.stringify({
        telefone: clienteLogado.telefone,
        nome: clienteLogado.nome,
        avatar: clienteLogado.avatar || avatarClienteAtual,
      }),
    );
  } else {
    localStorage.removeItem("clientePedrao");
  }

  atualizarTelaClienteLogado();
  atualizarStatusOnline();
  limparTelaMensagensCliente();
}
function mostrarPainelCliente() {
  const area = document.getElementById("area-perfil");

  area.innerHTML = `
        <div class="box-perfil-logado">
            <h3>Olá, ${clienteLogado.nome}</h3>
            <p>Telefone: ${clienteLogado.telefone}</p>
            <p>Status fidelidade: ${clienteLogado.fidelidadeAtiva ? "Ativo" : "Não ativo"}</p>
        </div>
    `;
}

function normalizarNomeProduto(nome) {
  return String(nome || "")
    .toLowerCase()
    .replace(/\(artesanal\)/g, "")
    .replace(/\(industrial\)/g, "")
    .replace(/\(frango\)/g, "")
    .replace(/[()]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function abrirPedidosCliente() {
  if (!clienteLogado) {
    return alert("Faça login primeiro.");
  }

  const area = document.getElementById("area-perfil");
  const abaPedido = area.dataset.abaPerfil;

  area.innerHTML = htmlCarregandoUI("Buscando pedidos…");

  const telefone = String(clienteLogado.telefone || "").replace(/\D/g, "");

  // =========================
  // PEDIDOS NORMAIS
  // =========================

  const [snapPedidos, snapLocal] = await Promise.all([
    lerComPrazoUI(
      (typeof consultaHistoricoClienteSenhaUI === "function"
        ? consultaHistoricoClienteSenhaUI("pedidos", clienteLogado)
        : db.collection("pedidos").where("clienteId", "==", telefone)
      ).get(),
    ),
    lerComPrazoUI(
      (typeof consultaHistoricoClienteSenhaUI === "function"
        ? consultaHistoricoClienteSenhaUI("historicoPagamentosClientes", clienteLogado)
        : db.collection("historicoPagamentosClientes").where("clienteId", "==", telefone)
      ).get(),
    ),
  ]);
  if (area.dataset.abaPerfil !== abaPedido) return;

  const historicoCompleto = [];

  snapPedidos.forEach((doc) => {
    const pedido = {
      id: doc.id,

      ...doc.data(),
    };

    if (pedido.cancelado) {
      return;
    }

    const clienteId = String(pedido.clienteId || "").replace(/\D/g, "");

    if (clienteId !== telefone) {
      return;
    }

    historicoCompleto.push({
      origemHistorico: "pedido",

      id: doc.id,

      numero: pedido.numero || null,
      tipo: pedido.tipo || pedido.tipoEntrega || "",

      data: pedido.data || null,

      dataMs: Number(pedido.dataMs || new Date(pedido.data || 0).getTime() || 0),

      itens: pedido.itens || [],

      valorPago: Number(pedido.valorTotal || 0),

      descontoCupom: Number(pedido.descontoCupomTotal ?? pedido.descontoCupom ?? 0),

      descontoFidelidade: Number(pedido.descontoFidelidade || 0),
      descontoCreditoEntrega: Number(pedido.descontoCreditoEntrega || 0),
    });
  });

  // =========================
  // PAGAMENTOS DO
  // CONSUMO LOCAL
  // =========================

  snapLocal.forEach((doc) => {
    const pagamento = doc.data();

    historicoCompleto.push({
      origemHistorico: "consumo_local",

      id: doc.id,

      comandaId: pagamento.comandaId || null,

      mesa: pagamento.mesa || null,

      data: pagamento.data || null,

      dataMs: Number(
        pagamento.criadoEmMs ?? pagamento.criadoEm ?? new Date(pagamento.data || 0).getTime() ?? 0,
      ),

      itens: pagamento.itens || [],

      valorOriginal: Number(pagamento.valorOriginal || 0),

      valorPago: Number(pagamento.valorPago || 0),

      descontoCupom: Number(pagamento.descontoCupom || 0),

      descontoFidelidade: Number(pagamento.descontoFidelidade || 0),

      cupomCodigo: pagamento.cupomCodigo || null,
    });
  });

  // =========================
  // MAIS RECENTE PRIMEIRO
  // =========================

  historicoCompleto.sort((a, b) => Number(b.dataMs || 0) - Number(a.dataMs || 0));

  if (historicoCompleto.length === 0) {
    area.innerHTML = "<p>Nenhum pedido anterior encontrado.</p>";

    return;
  }

  let html = `

        <h3>
            📦 Seus pedidos anteriores
        </h3>

    `;

  historicoCompleto.forEach((registro, index) => {
    const data = registro.data ? new Date(registro.data).toLocaleString("pt-BR") : "";

    const itensTexto = (registro.itens || [])
      .map((item) => {
        return `${Number(item.quantidade ?? item.qtd ?? 1)} ${item.nome || "Item"}`;
      })
      .join("<br>");

    const descontoTotal =
      Number(registro.descontoCupom || 0) +
      Number(registro.descontoFidelidade || 0) +
      Number(registro.descontoCreditoEntrega || 0);

    // =========================
    // CONSUMO LOCAL
    // =========================

    if (registro.origemHistorico === "consumo_local") {
      html += `

                    <div
                        class="pedido-antigo"
                    >

                        <strong>
                            Pedido #${historicoCompleto.length - index}
                        </strong>

                        <br>

                        <small>
                            ${data}
                        </small>


                        <p>
                            ${itensTexto || "Itens não identificados"}
                        </p>


                        <p>
                            <strong>
                                Total pago:
                            </strong>

                            R$ ${Number(registro.valorPago || 0).toFixed(2)}
                        </p>


                        ${
                          descontoTotal > 0
                            ? `
                                    <p>
                                        <strong>
                                            Benefícios:
                                        </strong>

                                        - R$ ${descontoTotal.toFixed(2)}
                                    </p>
                                `
                            : ""
                        }


                        ${
                          registro.cupomCodigo
                            ? `
                                    <p>
                                        🎟 Cupom:
                                        ${registro.cupomCodigo}
                                    </p>
                                `
                            : ""
                        }


                        ${
                          (registro.itens || []).length > 0 &&
                          !(registro.itens || []).some(
                            (item) => item.tipo === "pagamento_por_valor",
                          )
                            ? `
                                    <button
                                        type="button"
                                        onclick='pedirNovamente(
                                            ${JSON.stringify(registro.itens).replace(/'/g, "&#39;")}
                                        )'
                                    >
                                        Pedir novamente
                                    </button>
                                `
                            : ""
                        }

                    </div>

                `;

      return;
    }

    // =========================
    // PEDIDO NORMAL
    // =========================

    html += `

                <div
                    class="pedido-antigo"
                >

                    <strong>
                        Pedido #${historicoCompleto.length - index}
                    </strong>

                    <br>

                    <small>
                        ${data}
                    </small>


                    <p>
                        ${itensTexto}
                    </p>


                    <button
                        type="button"
                        onclick='pedirNovamente(
                            ${JSON.stringify(registro.itens || []).replace(/'/g, "&#39;")}
                        )'
                    >
                        Pedir novamente
                    </button>

                </div>

            `;
  });

  area.innerHTML = html;
}

async function abrirBonusCliente() {
  if (!clienteLogado) return alert("Faça login primeiro");
  const areaBonus = document.getElementById("area-perfil");
  const abaBonus = areaBonus.dataset.abaPerfil;

  const ref = db.collection("clientes").doc(clienteLogado.telefone);
  const doc = await ref.get();
  if (areaBonus.dataset.abaPerfil !== abaBonus) return;
  const dados = doc.data();

  const fidelidadeAtiva = dados.fidelidadeAtiva || false;
  const totalFidelidade = Number(dados.totalFidelidade) || 0;
  const bonusDisponivel = Number(dados.bonusDisponivel) || 0;

  const progresso = totalFidelidade % 300;

  if (!fidelidadeAtiva) {
    document.getElementById("area-perfil").innerHTML = `
            <h3>🎁 Bônus Fidelidade</h3>
            <p>Seu cupom fidelidade ainda não está ativo.</p>
            <p>Clique no botão de interrogação (?) ao lado do código para saber como liberar.</p>
        `;
    return;
  }

  document.getElementById("area-perfil").innerHTML = `
    <h3>🎁 Bônus Fidelidade</h3>
    ${htmlProgressoBonusClienteUI(bonusDisponivel, progresso)}
`;
}
async function abrirEnderecosCliente() {
  if (!clienteLogado) return alert("Faça login primeiro");
  document.getElementById("area-perfil").innerHTML = htmlCarregandoUI("Buscando endereços…");

  const ref = db.collection("clientes").doc(clienteLogado.telefone);
  const doc = await lerComPrazoUI(ref.get());

  const dados = doc.data();
  const enderecos = dados.enderecos || [];

  let html = `<h3>📍 Seus endereços</h3>`;

  enderecos.forEach((e, i) => {
    html += `
        <div class="endereco-box">
            <strong>${escaparOperacao(e.nome)}</strong><br>
            ${escaparOperacao(e.enderecoCompleto || `${e.rua}, ${e.numero} - ${e.bairro}`)}<br>
            ${e.complemento && !String(e.enderecoCompleto || "").includes(e.complemento) ? escaparOperacao(e.complemento) : ""}

            <div class="acoes-endereco">
                <button type="button" onclick="editarEnderecoCliente(${i})">Editar</button>
                <button type="button" onclick="excluirEnderecoCliente(${i})">Excluir</button>
            </div>
        </div>
    `;
  });

  document.getElementById("area-perfil").innerHTML = html;
}
function adicionarEndereco() {
  const area = document.getElementById("area-perfil");

  area.insertAdjacentHTML(
    "beforeend",
    `
        <div class="form-endereco" id="form-endereco">
            <h3>Novo endereço</h3>

            <input type="text" id="endereco-nome" placeholder="Nome do endereço. Ex: Casa, Trabalho">
            <input type="text" id="endereco-rua" placeholder="Rua">
            <input type="text" id="endereco-numero" placeholder="Número">
            <input type="text" id="endereco-bairro" placeholder="Bairro">
            <input type="text" id="endereco-complemento" placeholder="Complemento. Ex: casa verde">

            <button type="button" onclick="salvarEnderecoCliente()">Salvar endereço</button>
        </div>
    `,
  );

  setTimeout(() => {
    document
      .getElementById("form-endereco")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
    document.getElementById("endereco-nome")?.focus();
  }, 100);
}

async function salvarEnderecoCliente() {
  if (!clienteLogado) return alert("Faça login primeiro.");

  const nome = document.getElementById("endereco-nome").value.trim();
  const rua = document.getElementById("endereco-rua").value.trim();
  const numero = document.getElementById("endereco-numero").value.trim();
  const bairro = document.getElementById("endereco-bairro").value.trim();
  const complemento = document.getElementById("endereco-complemento").value.trim();

  if (!nome || !rua || !numero || !bairro) {
    return alert("Preencha nome do endereço, rua, número e bairro.");
  }

  const ref = db.collection("clientes").doc(clienteLogado.telefone);
  const doc = await ref.get();

  const atual = doc.data().enderecos || [];

  atual.push({
    nome,
    rua,
    numero,
    bairro,
    complemento,
  });

  await ref.update({ enderecos: atual });
  document.getElementById("form-endereco")?.closest("dialog")?.close();

  abrirEnderecosCliente();
}
function mostrarPedidosCliente() {
  if (!alternarAbaPerfilUI("pedidos")) return;
  abrirPedidosCliente();
}

function alternarAbaPerfilUI(aba) {
  const area = document.getElementById("area-perfil");
  if (area.dataset.abaPerfil === aba) {
    delete area.dataset.abaPerfil;
    area.replaceChildren();
    return false;
  }
  area.dataset.abaPerfil = aba;
  return true;
}

function mostrarBonusCliente() {
  if (!clienteLogado) {
    return alert("Faça login primeiro.");
  }

  if (!clienteLogado.fidelidadeAtiva) {
    return alert(
      "Ative seu CDA para desbloquear o bônus fidelidade. Vamos liberar esses benefícios!",
      "ativar",
    );
  }

  if (alternarAbaPerfilUI("bonus")) abrirBonusCliente();
}

function mostrarEnderecosCliente() {
  abrirEnderecosCliente();
}
async function carregarEnderecosNaRevisao(tipo) {
  const box = document.getElementById("box-endereco-salvo");
  const select = document.getElementById("select-endereco-salvo");
  const textarea = document.getElementById("endereco-escrito");
  const aviso = document.getElementById("aviso-login-endereco");

  if (!box || !select || !textarea) return;

  if (tipo !== "Entrega") {
    box.style.display = "none";
    return;
  }

  box.style.display = "block";
  textarea.value = "";
  select.innerHTML = `<option value="">Usar endereço salvo</option>`;

  if (!clienteLogado) {
    select.style.display = "none";
    aviso.innerText = "";
    return;
  }

  aviso.innerText = "";
  const ref = db.collection("clientes").doc(clienteLogado.telefone);
  const doc = await ref.get();

  const enderecos = doc.data()?.enderecos || [];
  window.enderecosClienteAtual = enderecos;

  if (enderecos.length === 0) {
    select.style.display = "none";
    return;
  }

  select.style.display = "block";

  enderecos.forEach((e, index) => {
    select.innerHTML += `
            <option value="${index}">
                ${escaparOperacao(e.nome)} - ${escaparOperacao(e.rua)}, ${escaparOperacao(e.numero)} - ${escaparOperacao(e.bairro)}
            </option>
        `;
  });
}

function usarEnderecoSalvo() {
  const select = document.getElementById("select-endereco-salvo");
  const textarea = document.getElementById("endereco-escrito");

  const index = select.value;
  if (index === "") {
    textarea.value = "";
    return;
  }

  const e = window.enderecosClienteAtual[index];

  textarea.value =
    `${e.nome}\n` +
    `${e.enderecoCompleto || [e.rua, e.numero ? "nº " + e.numero : ""].filter(Boolean).join(", ")}\n` +
    (e.bairro ? `Bairro: ${e.bairro}\n` : "") +
    `${e.complemento ? "Complemento: " + e.complemento : ""}`;
  select.style.display = "none";
}
async function salvarEnderecoDaRevisao() {
  if (!clienteLogado) {
    document.getElementById("aviso-login-endereco").textContent =
      "Faça login na Área do Cliente para salvar este endereço.";
    return;
  }

  const texto = document.getElementById("endereco-escrito").value.trim();

  if (!texto) {
    return alert("Digite o endereço antes de salvar.");
  }

  const nome = await solicitarTextoUI("Nome para esse endereço. Ex: Casa, Trabalho, Namorada");

  if (!nome) return alert("Informe um nome para o endereço.");

  const ref = db.collection("clientes").doc(clienteLogado.telefone);
  const doc = await ref.get();

  const atual = doc.data().enderecos || [];

  atual.push({
    nome,
    rua: texto,
    numero: "",
    bairro: "",
    complemento: "",
    enderecoCompleto: texto,
  });

  await ref.update({ enderecos: atual });

  alert("Endereço salvo com sucesso!");
  carregarEnderecosNaRevisao("Entrega");
}
async function excluirEnderecoCliente(index) {
  if (!(await confirmarOperacao("Deseja excluir este endereço?"))) return;

  const ref = db.collection("clientes").doc(clienteLogado.telefone);
  const doc = await ref.get();

  const enderecos = doc.data().enderecos || [];
  enderecos.splice(index, 1);

  await ref.update({ enderecos });

  abrirEnderecosCliente();
}

async function editarEnderecoCliente(index) {
  if (!clienteLogado) return alert("Entre na sua conta para editar endereços.");
  if (document.getElementById("editor-endereco-cliente")) return;
  const ref = db.collection("clientes").doc(clienteLogado.telefone);
  let atual;
  try {
    const doc = await ref.get();
    atual = doc.data()?.enderecos?.[index];
    if (!atual) return alert("Este endereço não está mais disponível. Atualize a lista.");
  } catch (erro) {
    return alert("Não foi possível carregar o endereço. Tente novamente.");
  }
  const focoAnterior = document.activeElement;
  const modal = document.createElement("dialog");
  modal.id = "editor-endereco-cliente";
  modal.className = "editor-endereco-cliente";
  modal.setAttribute("aria-labelledby", "editor-endereco-titulo");
  modal.innerHTML = `
    <form>
      <header><h2 id="editor-endereco-titulo">Editar endereço</h2>
        <button type="button" class="editor-endereco-fechar" aria-label="Fechar edição">×</button>
      </header>
      <label>Nome do endereço<input name="nome" required maxlength="80" placeholder="Ex: Casa, Trabalho" autocomplete="off"></label>
      <label>Rua / endereço<input name="rua" required autocomplete="address-line1"></label>
      <label>Número<input name="numero" autocomplete="off" placeholder="Número ou s/n"></label>
      <label>Bairro<input name="bairro" autocomplete="address-level3"></label>
      <label>Complemento<textarea name="complemento" autocomplete="address-line2" placeholder="Apartamento, referência..."></textarea></label>
      <p class="editor-endereco-status" role="status" aria-live="polite"></p>
      <div class="editor-endereco-acoes">
        <button type="button" class="editor-endereco-cancelar">Cancelar</button>
        <button type="submit">Salvar endereço</button>
      </div>
    </form>`;
  const form = modal.querySelector("form");
  for (const nome of ["nome", "rua", "numero", "bairro", "complemento"]) {
    form.elements.namedItem(nome).value =
      nome === "rua" ? atual.rua || atual.enderecoCompleto || "" : atual[nome] || "";
  }
  let salvando = false;
  const fechar = () => {
    if (!salvando) modal.close();
  };
  modal.querySelector(".editor-endereco-fechar").onclick = fechar;
  modal.querySelector(".editor-endereco-cancelar").onclick = fechar;
  modal.addEventListener("cancel", (evento) => {
    if (salvando) evento.preventDefault();
  });
  modal.addEventListener(
    "close",
    () => {
      modal.remove();
      if (focoAnterior?.isConnected) focoAnterior.focus({ preventScroll: true });
    },
    { once: true },
  );
  form.onsubmit = async (evento) => {
    evento.preventDefault();
    if (salvando) return;
    const valores = Object.fromEntries(
      ["nome", "rua", "numero", "bairro", "complemento"].map((nome) => [
        nome,
        form.elements.namedItem(nome).value.trim(),
      ]),
    );
    const status = modal.querySelector(".editor-endereco-status");
    if (!valores.nome || !valores.rua) {
      status.textContent = "Preencha o nome do endereço e a rua.";
      return;
    }
    salvando = true;
    form.querySelectorAll("button").forEach((botao) => {
      botao.disabled = true;
      if (botao.type === "submit") botao.setAttribute("aria-busy", "true");
    });
    status.textContent = "Salvando endereço…";
    try {
      await db.runTransaction(async (transacao) => {
        const doc = await transacao.get(ref);
        const enderecos = [...(doc.data()?.enderecos || [])];
        if (serializarOperacao(enderecos[index]) !== serializarOperacao(atual)) {
          throw new Error("Este endereço mudou em outra tela. Feche e abra a edição novamente.");
        }
        const { rua, numero, bairro, complemento } = valores;
        enderecos[index] = {
          ...atual,
          ...valores,
          enderecoCompleto:
            rua +
            (numero ? ", nº " + numero : "") +
            (bairro ? " - " + bairro : "") +
            (complemento ? " - " + complemento : ""),
        };
        transacao.update(ref, { enderecos });
      });
      modal.close();
      await abrirEnderecosCliente();
    } catch (erro) {
      status.textContent = erro.message?.includes("outra tela")
        ? erro.message
        : "Não foi possível salvar. Confira sua conexão e tente novamente.";
    } finally {
      salvando = false;
      form.querySelectorAll("button").forEach((botao) => {
        botao.disabled = false;
        if (botao.type === "submit") botao.removeAttribute("aria-busy");
      });
    }
  };
  document.body.append(modal);
  modal.showModal();
}

function buscarProdutoAtual(nomePedido) {
  const nomeBase = nomePedido
    .replace(/\s*\(Artesanal\)/gi, "")
    .replace(/\s*\(Industrial\)/gi, "")
    .replace(/\s*\(Frango\)/gi, "")
    .trim();

  const todasListas = [
    ...(window.catalogoProdutosDeliveryUI?.values() || []),
    ...lanches,
    ...listaCombos,
    ...bebidas,
    ...batatas,
  ].filter((p) => !p.somenteAtendente);

  return todasListas.find((p) => p.nome.toLowerCase().trim() === nomeBase.toLowerCase());
}

function pedirNovamente(itensAntigos) {
  if (typeof permitirPedidoLojaUI === "function" && !permitirPedidoLojaUI()) return;
  carrinho = [];

  itensAntigos.forEach((itemAntigo) => {
    const produtoAtual = buscarProdutoAtual(itemAntigo.nome);
    if (!produtoAtual) return;

    let precoAtual = produtoAtual.preco;
    let nomeFinal = produtoAtual.nome;

    if (itemAntigo.nome.includes("(Industrial)") && produtoAtual.precoIndustrial) {
      precoAtual = produtoAtual.precoIndustrial;
      nomeFinal = `${produtoAtual.nome} (Industrial)`;
    } else if (itemAntigo.nome.includes("(Artesanal)")) {
      precoAtual = produtoAtual.preco;
      nomeFinal = `${produtoAtual.nome} (Artesanal)`;
    } else if (itemAntigo.nome.includes("(Frango)") && produtoAtual.precoFrango) {
      precoAtual = produtoAtual.precoFrango;
      nomeFinal = `${produtoAtual.nome} (Frango)`;
    }

    // Copia todas as escolhas sem compartilhar objetos com o histórico.
    const copia = JSON.parse(JSON.stringify(itemAntigo));
    const adicionais = copia.adicionais || [];
    const calcularExtras = (lista) =>
      (lista || []).reduce(
        (total, adicional) =>
          total + Number(adicional.preco || 0) * Number(adicional.qtd ?? adicional.quantidade ?? 1),
        0,
      );
    const extras = copia.lanchesCombo?.length
      ? copia.lanchesCombo.reduce((total, lanche) => total + calcularExtras(lanche.adicionais), 0)
      : calcularExtras(adicionais);
    const quantidade = Number(itemAntigo.quantidade) || Number(itemAntigo.qtd) || 1;
    const preco = (Number(precoAtual) || 0) + extras;
    carrinho.push({
      ...copia,
      nome: nomeFinal,
      qtd: quantidade,
      quantidade,
      precoBase: Number(precoAtual) || 0,
      preco,
      precoUnitario: preco,
      subtotal: preco * quantidade,
      adicionais,
      obs: copia.obs || copia.observacao || "",
      observacao: copia.observacao || copia.obs || "",
      categoria: itemAntigo.categoria || produtoAtual.categoria || "Lanches",
      comboQtdLanches: copia.comboQtdLanches || produtoAtual.comboQtdLanches || 1,
      molhosGratis: copia.molhosGratis || [],
      molhosPagos: copia.molhosPagos || [],
      totalMolhosPagos: (copia.molhosPagos || []).reduce(
        (total, molho) => total + Number(molho.qtd || 0) * Number(molho.preco ?? PRECO_MOLHO_PAGO),
        0,
      ),
    });
  });

  carrinhoVersao++;
  atualizarCarrinho();
  abrirTela("finalizar");

  setTimeout(() => {
    document.getElementById("finalizar-pedido")?.scrollIntoView({ behavior: "smooth" });
  }, 100);
}

function pedidoUsouBonus(pedido) {
  return Number(pedido.descontoFidelidade || 0) > 0;
}

function pedidoContaFidelidade(pedido) {
  return pedido.clienteId && pedido.fidelidadeAtivaNoPedido === true;
}
async function aplicarCupomDesconto() {
  if (typeof permitirPedidoLojaUI === "function" && !permitirPedidoLojaUI()) return;
  const codigo = document.getElementById("codigo-cupom-desconto").value.trim().toUpperCase();
  const retorno = document.getElementById("retorno-cupom-desconto");

  if (!codigo) {
    retorno.innerText = "Digite um código de cupom.";
    return;
  }

  if (typeof checkoutProtegidoUI !== "undefined") {
    try {
      if (await checkoutProtegidoUI.ativo()) {
        const versao = carrinhoVersao;
        const resultado = await checkoutProtegidoUI.conferir(
          pedidoAtualCheckoutProtegidoUI(codigo),
        );
        if (versao !== carrinhoVersao)
          throw Error("O carrinho mudou. Confira os itens e aplique o cupom novamente.");
        cupomDescontoAplicado = resultado.cupom;
        aplicarCotacaoCheckoutProtegidoUI(resultado.pedido);
        retorno.innerText = "Cupom aplicado com sucesso!";
        return;
      }
    } catch (e) {
      removerCupomDescontoCliente("");
      retorno.innerText = e.message;
      return;
    }
  }

  const doc = await db.collection("cuponsDesconto").doc(codigo).get();

  if (!doc.exists) {
    retorno.innerText = "Cupom não encontrado.";
    removerCupomDescontoCliente("Cupom inválido.");
    return;
  }

  const cupom = doc.data();
  try {
    await verificarDisponibilidadeCupomOperacao(cupom, codigo, clienteLogado?.telefone);
  } catch (erro) {
    removerCupomDescontoCliente(erro.message);
    retorno.innerText = erro.message;
    return;
  }
  if (
    cupom.clientesPermitidos &&
    !cupom.clientesPermitidos.includes(String(clienteLogado?.telefone || ""))
  ) {
    retorno.innerText =
      "Este cupom é exclusivo das contas selecionadas. Entre na conta que recebeu a campanha.";
    removerCupomDescontoCliente("Cupom indisponível para esta conta.");
    return;
  }
  if (!cupom.ativo) {
    retorno.innerText = "Este cupom está desativado.";
    removerCupomDescontoCliente("Cupom inválido.");
    return;
  }

  const subtotal = Number(dadosPedidoTemporario.subtotal || 0);
  const taxa = Number(dadosPedidoTemporario.taxa || 0);
  const km = Number(dadosPedidoTemporario.km || 0);
  const totalBase = subtotal + taxa;

  if (cupom.temPedidoMinimo && subtotal < Number(cupom.pedidoMinimo || 0)) {
    retorno.innerText = `Cupom válido somente para pedidos acima de R$ ${Number(cupom.pedidoMinimo).toFixed(2)}.`;
    removerCupomDescontoCliente("Cupom inválido.");
    return;
  }

  let desconto = 0;
  let cupomResolvido = cupom;
  if (cupom.rankRegra) {
    try {
      if (clienteLogado?.telefone && typeof sincronizarRankMensalClienteUI === "function")
        await sincronizarRankMensalClienteUI(clienteLogado.telefone);
      const clienteDoc = clienteLogado?.telefone
        ? await db.collection("clientes").doc(String(clienteLogado.telefone)).get()
        : null;
      cupomResolvido = resolverCupomRankUI(cupom, clienteDoc?.exists ? clienteDoc.data() : null);
      desconto = calcularCupomRankUI(cupomResolvido, {
        base: subtotal,
        taxa,
        km,
        itens: carrinho,
      }).desconto;
    } catch (e) {
      removerCupomDescontoCliente(e.message);
      retorno.innerText = e.message;
      mostrarAvisoUI(e.message, "cupomRank");
      return;
    }
  }

  // CUPOM DO PEDIDO
  if (cupom.rankRegra) {
    // O cálculo compartilhado acima usa o percentual do rank atual.
  } else if (cupom.tipo === "pedido" || cupom.tipo === "descontoGeral") {
    if (cupom.modo === "valor") {
      desconto = Number(cupom.valor || 0);
    }

    if (cupom.modo === "porcentagem") {
      desconto = totalBase * (Number(cupom.valor || 0) / 100);
    }
  }

  // CUPOM DA TAXA
  else if (cupom.tipo === "taxa") {
    if (taxa <= 0) {
      retorno.innerText = "Este cupom só vale para pedidos com entrega.";
      removerCupomDescontoCliente("Cupom inválido.");
      return;
    }

    if (cupom.modo === "gratis") {
      if (km > Number(cupom.kmGratis || 0)) {
        retorno.innerText = `Taxa grátis válida somente até ${cupom.kmGratis} km.`;
        removerCupomDescontoCliente("Cupom inválido.");
        return;
      }

      desconto = taxa;
    }

    if (cupom.modo === "valor") {
      desconto = Number(cupom.valor || 0);
      if (desconto > taxa) desconto = taxa;
    }

    if (cupom.modo === "porcentagem") {
      desconto = taxa * (Number(cupom.valor || 0) / 100);
    }
  }

  // CUPOM DE ITEM
  else if (cupom.tipo === "item") {
    let achouItem = false;

    carrinho.forEach((item) => {
      const nomeItem = normalizarTextoCupomComTipo(item.nome);
      const precoAtual = Number(item.preco || 0);
      const qtd = Number(item.qtd || 1);

      let itemCombina = false;
      let descontoItem = 0;

      // CUPOM PARA GRUPO DE LANCHES
      if (cupom.itemGeral) {
        const ehIndustrial = nomeItem.includes("industrial");
        const ehArtesanal = nomeItem.includes("artesanal");

        if (["geral", "todos"].includes(cupom.itemGeralTipo)) {
          itemCombina = true;
        }

        if (cupom.itemGeralTipo === "industrial" && ehIndustrial) {
          itemCombina = true;
        }

        if (cupom.itemGeralTipo === "artesanal" && ehArtesanal) {
          itemCombina = true;
        }

        if (cupom.itemGeralTipo === "frango") {
          itemCombina = nomeItem.includes("frango") && !nomeItem.includes("+");
        }

        if (cupom.itemGeralTipo === "file") {
          itemCombina =
            !nomeItem.includes("+") &&
            (nomeItem.includes("mignon") ||
              nomeItem.includes("paulistinha") ||
              nomeItem.includes("paulistao") ||
              nomeItem.includes("paulistão"));
        }

        if (cupom.itemGeralTipo === "hotdog") {
          itemCombina =
            nomeItem.includes("hot dog") ||
            nomeItem.includes("prensado") ||
            nomeItem.includes("salsicha");
        }

        if (cupom.itemGeralTipo === "bebidas") {
          itemCombina = item.categoria === "Bebidas";
        }

        if (cupom.itemGeralTipo === "batatas") {
          itemCombina = item.categoria === "Batatas";
        }

        if (cupom.itemGeralTipo === "combos") {
          itemCombina = item.categoria === "Combos";
        }

        if (itemCombina) {
          if (cupom.itemGeralModo === "valor") {
            descontoItem = Number(cupom.itemGeralValor || 0) * qtd;
          }

          if (cupom.itemGeralModo === "porcentagem") {
            descontoItem = precoAtual * (Number(cupom.itemGeralValor || 0) / 100) * qtd;
          }
        }
      }

      // CUPOM PARA ITEM ÚNICO
      else {
        const nomeCupom = normalizarTextoCupomComTipo(cupom.itemNome);

        const cupomEhIndustrial = nomeCupom.includes("industrial");
        const cupomEhArtesanal = nomeCupom.includes("artesanal") || nomeCupom.includes("caseiro");

        const itemEhIndustrial = nomeItem.includes("industrial");
        const itemEhArtesanal = nomeItem.includes("artesanal");

        const nomeCupomBase = nomeCupom
          .replace("industrial", "")
          .replace("artesanal", "")
          .replace("caseiro", "")
          .trim();

        if (nomeItem.includes(nomeCupomBase)) {
          if (cupomEhIndustrial) {
            itemCombina = itemEhIndustrial;
          } else if (cupomEhArtesanal) {
            itemCombina = itemEhArtesanal;
          } else {
            itemCombina = true;
          }
        }

        if (itemCombina) {
          const precoPromo = Number(cupom.itemPrecoPromocional || 0);

          if (precoAtual > precoPromo) {
            descontoItem = (precoAtual - precoPromo) * qtd;
          }
        }
      }

      if (itemCombina && descontoItem > 0) {
        achouItem = true;
        desconto += descontoItem;
      }
    });

    if (!achouItem) {
      retorno.innerText = "Este cupom não vale para os itens do pedido.";
      removerCupomDescontoCliente("");
      return;
    }
  } else {
    retorno.innerText = "Tipo de cupom inválido.";
    removerCupomDescontoCliente("Cupom inválido.");
    return;
  }

  if (desconto <= 0) {
    retorno.innerText = "Este cupom não gerou desconto para este pedido.";
    removerCupomDescontoCliente("Cupom inválido.");
    return;
  }

  if (desconto > totalBase) desconto = totalBase;

  cupomDescontoAplicado = { ...cupomResolvido, codigo };
  descontoCupom = desconto;

  retorno.innerText = cupomResolvido.rankRegra?.descontoPorRank
    ? `Cupom aplicado: ${cupomResolvido.percentualRankAplicado}% para o rank ${cupomResolvido.rankAplicado}!`
    : "Cupom aplicado com sucesso!";

  exibirRevisao(
    dadosPedidoTemporario.itens,
    dadosPedidoTemporario.subtotal,
    dadosPedidoTemporario.taxa,
    dadosPedidoTemporario.tipo,
    dadosPedidoTemporario.obs,
    dadosPedidoTemporario.mapa,
    dadosPedidoTemporario.km,
    dadosPedidoTemporario.foraDaArea,
    dadosPedidoTemporario.areaUrbanaConfirmada,
  );
}
function arredondarPagamento(valor) {
  const centavos = Math.round(Math.max(0, Number(valor) || 0) * 100);
  return Math.floor((centavos + 70) / 100);
}
async function ajustarFidelidadeAposEditarPedido(pedidoAntigo, pedidoNovo) {
  if (!pedidoNovo.clienteId || !pedidoNovo.fidelidadeAtivaNoPedido) return;

  const refCliente = db.collection("clientes").doc(pedidoNovo.clienteId);
  const docCliente = await refCliente.get();

  if (!docCliente.exists) return;

  const c = docCliente.data();

  const antes = baseFidelidadePedidoOperacao(pedidoAntigo);
  const depois = baseFidelidadePedidoOperacao(pedidoNovo);

  const diferenca = depois - antes;

  let totalFidelidade = Number(c.totalFidelidade || 0) + diferenca;
  if (totalFidelidade < 0) totalFidelidade = 0;

  const bonusGeradoTotal = bonusAcumuladoFidelidadeOperacao(c, totalFidelidade);

  await refCliente.update({
    totalFidelidade,
    bonusGeradoTotal,
  });
}
function atualizarTotalCupons() {
  descontosCupons.total =
    Number(descontosCupons.pedido || 0) +
    Number(descontosCupons.taxa || 0) +
    Number(descontosCupons.item || 0);
}
function removerCupomDescontoCliente(mensagem = "") {
  cupomDescontoAplicado = null;
  descontoCupom = 0;

  const input = document.getElementById("codigo-cupom-desconto");
  const retorno = document.getElementById("retorno-cupom-desconto");

  if (input) input.value = "";
  if (retorno) retorno.innerText = mensagem;

  if (dadosPedidoTemporario && dadosPedidoTemporario.itens) {
    exibirRevisao(
      dadosPedidoTemporario.itens,
      dadosPedidoTemporario.subtotal,
      dadosPedidoTemporario.taxa,
      dadosPedidoTemporario.tipo,
      dadosPedidoTemporario.obs,
      dadosPedidoTemporario.mapa,
      dadosPedidoTemporario.km,
      dadosPedidoTemporario.foraDaArea,
      dadosPedidoTemporario.areaUrbanaConfirmada,
    );
  }
}
function normalizarTextoCupomComTipo(texto) {
  return String(texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[()]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
function obterTextoCompletoProduto(itemCarrinho) {
  const nomeCarrinho = normalizarTextoCupomComTipo(itemCarrinho.nome);

  const listas = [
    ...(lanches || []),
    ...(listaCombos || []),
    ...(bebidas || []),
    ...(batatas || []),
  ];

  let produtoEncontrado = listas.find((produto) => {
    const nomeProduto = normalizarTextoCupomComTipo(produto.nome);

    return nomeCarrinho.includes(nomeProduto) || nomeProduto.includes(nomeCarrinho);
  });

  const nome = itemCarrinho.nome || "";
  const descricao = produtoEncontrado?.desc || produtoEncontrado?.descricao || "";

  return `${nome} ${descricao}`;
}
function toggleAvatares() {
  const box = document.getElementById("lista-avatares");
  if (!box) return;
  if (typeof htmlOpcoesAvataresUI === "function")
    box.innerHTML = htmlOpcoesAvataresUI(clienteLogado || {}, avatarClienteAtual);
  box.style.display = box.style.display === "none" ? "grid" : "none";
}

function selecionarAvatar(caminho) {
  avatarClienteAtual =
    typeof dadosAvatarClienteUI === "function"
      ? dadosAvatarClienteUI(clienteLogado || {}, caminho).src
      : caminho;

  const preview = document.getElementById("avatar-cliente-preview");
  if (typeof aplicarAvatarClienteUI === "function")
    aplicarAvatarClienteUI(preview, clienteLogado || {}, avatarClienteAtual);
  else if (preview) preview.src = caminho;

  const box = document.getElementById("lista-avatares");
  if (box) box.style.display = "none";
}

async function salvarPerfilCliente() {
  if (!clienteLogado) {
    return alert("Faça login primeiro.");
  }

  const nome = document.getElementById("perfil-nome").value.trim();

  const telefone = document.getElementById("perfil-telefone").value.replace(/\D/g, "");

  if (!nome) {
    return alert("Digite seu nome.");
  }

  if (telefone.length < 10) {
    return alert("Telefone inválido.");
  }

  const telefoneAntigo = clienteLogado.telefone;
  if (clienteLogado.authUid && telefone !== telefoneAntigo)
    return alert(
      "Para trocar o celular da conta, fale com a loja. Seu acesso e seu histórico precisam continuar vinculados ao número correto.",
    );

  const dadosAtualizados = {
    ...clienteLogado,
    nome,
    telefone,
    avatar: avatarClienteAtual,
  };

  // se mudou telefone
  if (telefone !== telefoneAntigo) {
    await db.collection("clientes").doc(telefone).set(dadosAtualizados);

    await db.collection("clientes").doc(telefoneAntigo).delete();
  } else {
    await db.collection("clientes").doc(telefone).update({
      nome,
      telefone,
      avatar: avatarClienteAtual,
    });
  }

  clienteLogado = dadosAtualizados;

  localStorage.setItem(
    "clientePedrao",
    JSON.stringify({
      telefone,
      nome,
      avatar: avatarClienteAtual,
    }),
  );

  atualizarTelaClienteLogado();

  alert("Perfil atualizado!");
}

async function logoutCliente() {
  if (typeof encerrarContadorClienteUI === "function") encerrarContadorClienteUI();
  if (onlineSessionId) {
    db.collection("usuariosOnline").doc(onlineSessionId).delete();
  }

  if (typeof encerrarBeneficiosPedraoUI === "function") encerrarBeneficiosPedraoUI();
  if (typeof acessoClienteSenhaUI !== "undefined") await window.acessoClienteSenhaUI.sair();
  clienteLogado = null;
  localStorage.removeItem("clientePedrao");

  document.getElementById("perfil-nome").value = "";
  document.getElementById("perfil-telefone").value = "";
  document.getElementById("codigo-ativacao").value = "";
  if (document.getElementById("area-perfil")) {
    document.getElementById("area-perfil").innerHTML = "";
    delete document.getElementById("area-perfil").dataset.abaPerfil;
  }

  selecionarAvatar("images/avatares/sem-rank/maionese.webp");

  abrirPerfilModo("home");
  limparTelaMensagensCliente();
  alert("Você saiu da conta.");
}
window.addEventListener("load", async () => {
  if (!document.getElementById("perfil-form")) return;
  if (typeof acessoClienteSenhaUI !== "undefined") {
    try {
      if (await window.acessoClienteSenhaUI.ativo()) {
        const cliente = await window.acessoClienteSenhaUI.restaurar();
        if (cliente) await aplicarClienteSenhaUI(cliente);
        return;
      }
    } catch {
      return;
    }
  }

  const clienteSalvo = localStorage.getItem("clientePedrao");

  if (!clienteSalvo) return;

  try {
    const dados = JSON.parse(clienteSalvo);

    if (!dados.telefone) return;

    const doc = await db.collection("clientes").doc(dados.telefone).get();

    if (!doc.exists) {
      localStorage.removeItem("clientePedrao");
      return;
    }

    clienteLogado = doc.data();

    avatarClienteAtual = clienteLogado.avatar || "images/avatares/sem-rank/maionese.webp";

    document.getElementById("perfil-nome").value = clienteLogado.nome || "";

    document.getElementById("perfil-telefone").value = clienteLogado.telefone || "";

    document.getElementById("nome-cliente").value = clienteLogado.nome || "";

    document.getElementById("telefone-cliente").value = clienteLogado.telefone || "";

    selecionarAvatar(avatarClienteAtual);

    atualizarTelaClienteLogado();
  } catch (e) {
    console.error(e);

    localStorage.removeItem("clientePedrao");
  }
});
function abrirPerfilModo(modo) {
  const home = document.getElementById("perfil-home");
  const form = document.getElementById("perfil-form");
  const logado = document.getElementById("perfil-logado");
  document.getElementById("lista-avatares").style.display = "none";
  document.getElementById("box-codigo-login").hidden = modo !== "editar";

  home.style.display = "none";
  form.style.display = "none";
  logado.style.display = "none";

  if (modo === "home") {
    home.style.display = "block";
  }

  if (modo === "login") {
    form.style.display = "block";

    document.getElementById("titulo-form-perfil").innerText = "Login";

    document.getElementById("btn-entrar-perfil").setAttribute("onclick", "criarPerfilCliente()");
    document.getElementById("btn-entrar-perfil").setAttribute("onclick", "buscarCliente()");

    document.getElementById("box-avatar-form").style.display = "none";
  }

  if (modo === "cadastro") {
    form.style.display = "block";

    document.getElementById("titulo-form-perfil").innerText = "Criar Perfil";

    document.getElementById("btn-entrar-perfil").innerText = "Criar Perfil";
    document.getElementById("btn-entrar-perfil").setAttribute("onclick", "buscarCliente()");

    document.getElementById("box-avatar-form").style.display = "flex";
  }

  if (modo === "editar") {
    form.style.display = "block";

    document.getElementById("titulo-form-perfil").innerText = "Editar Perfil";

    document.getElementById("btn-entrar-perfil").innerText = "Salvar Perfil";
    document.getElementById("btn-entrar-perfil").setAttribute("onclick", "salvarPerfilCliente()");

    document.getElementById("box-avatar-form").style.display = "flex";

    if (clienteLogado) {
      document.getElementById("perfil-nome").value = clienteLogado.nome || "";

      document.getElementById("perfil-telefone").value = clienteLogado.telefone || "";

      selecionarAvatar(clienteLogado.avatar || "images/avatares/sem-rank/maionese.webp");
    }
  }

  if (modo === "logado") {
    logado.style.display = "block";
  }
}

function atualizarTelaClienteLogado() {
  if (!clienteLogado) return;
  if (typeof atualizarAvisoSenhaClienteUI === "function")
    atualizarAvisoSenhaClienteUI(clienteLogado);
  if (typeof acompanharBeneficiosClientePedraoUI === "function")
    acompanharBeneficiosClientePedraoUI(clienteLogado, (atual) => {
      if (!clienteLogado || clienteLogado.telefone !== atual.telefone) return;
      const mudou =
        clienteLogado.nivelCliente !== atual.nivelCliente ||
        clienteLogado.fidelidadeAtiva !== atual.fidelidadeAtiva;
      clienteLogado = { ...clienteLogado, ...atual };
      if (mudou) atualizarTelaClienteLogado();
      if (typeof atualizarCartaoRankMensalPerfilUI === "function")
        atualizarCartaoRankMensalPerfilUI(clienteLogado);
    });

  abrirPerfilModo("logado");

  document.getElementById("perfil-logado-nome").innerText = clienteLogado.nome || "Cliente";

  document.getElementById("perfil-dado-nome").innerText = clienteLogado.nome || "-";

  document.getElementById("perfil-dado-telefone").innerText = clienteLogado.telefone || "-";
  document.getElementById("perfil-dado-nivel").innerText =
    clienteLogado.nivelCliente || "Sem nível";
  const ativarCda = document.getElementById("ativar-cda-box");
  if (ativarCda) ativarCda.hidden = clienteLogado.fidelidadeAtiva === true;

  document.getElementById("perfil-logado-avatar").src =
    clienteLogado.avatar || "images/avatares/sem-rank/maionese.webp";
  if (typeof aplicarAvatarClienteUI === "function")
    aplicarAvatarClienteUI(document.getElementById("perfil-logado-avatar"), clienteLogado);

  const ativo = clienteLogado.fidelidadeAtiva;

  const status = document.getElementById("perfil-status-cda");

  status.innerText = ativo ? "Ativado" : "Desativado";

  status.className = ativo ? "status-cda ativo" : "status-cda inativo";

  const btnBonus = document.getElementById("btn-bonus-perfil");

  const nivelEl = document.getElementById("perfil-dado-nivel");

  const linhaNivel = nivelEl.parentElement;
  if (typeof atualizarCartaoRankMensalPerfilUI === "function")
    atualizarCartaoRankMensalPerfilUI(clienteLogado);

  const boxCda = document.getElementById("ativar-cda-box");

  if (ativo) {
    nivelEl.innerText = nivelFidelidadeOperacao(clienteLogado);
    nivelEl.dataset.nivel = nivelEl.innerText.toLowerCase();

    linhaNivel.style.display = "block";

    btnBonus.style.display = "inline-block";

    btnBonus.classList.remove("bonus-bloqueado");

    boxCda.style.display = "none";
  } else {
    linhaNivel.style.display = "none";

    btnBonus.style.display = "inline-block";
    btnBonus.classList.add("bonus-bloqueado");

    boxCda.style.display = "grid";
  }
  atualizarContadorMensagens();
}
let abaMensagemAtual = "geral";
let consultaMensagensUI = 0;

function htmlMensagemCliente(m) {
  // Campanhas antigas juntavam instruções genéricas e código à descrição.
  const texto = m.cupomCodigo
    ? String(m.texto || "").replace(
        /\s*Cupom:\s*[^\n]+\. Confira as condições de uso do cupom\.?\s*$/i,
        "",
      )
    : m.texto;
  const daLoja = m.remetente === "admin";
  const remetente =
    daLoja && !m.cupomCodigo
      ? '<div class="mensagem-remetente-ui"><img src="images/personagens-pedrao/ui/mago-tranquilo.webp" alt="" width="40" height="40"><strong>Pedrão Lanches</strong></div>'
      : "";
  const recompensa =
    daLoja && typeof htmlPersonagemRecompensaPedraoUI === "function"
      ? htmlPersonagemRecompensaPedraoUI(
          m.cupomCodigo ? "cupom" : m.raspadinhaId ? "raspadinha" : "",
        )
      : "";
  let corpo = `<p class="mensagem-descricao">${escaparOperacao(texto)}</p>`;
  if (m.cupomCodigo) {
    corpo = `<details class="mensagem-presente-ui"><summary aria-label="Abrir ou recolher cupom ${escaparOperacao(m.cupomCodigo)}">${recompensa || "Tem cupom pra você!"}</summary><div class="mensagem-presente-conteudo-ui">${corpo}<button type="button" class="mensagem-cupom" data-codigo="${escaparOperacao(m.cupomCodigo)}" onclick="copiarCupomClienteUI(this)"><span>Cupom · toque para copiar</span><strong>${escaparOperacao(m.cupomCodigo)}</strong></button><span class="cupom-copia-status-ui" role="status"></span></div></details>`;
  } else if (m.raspadinhaId) {
    const nome = typeof clienteLogado !== "undefined" ? clienteLogado?.nome : "";
    const chegada = `Chegou coisa boa pra você${nome ? ", " + nome : ""}!`;
    corpo =
      typeof htmlPersonagemRecompensaPedraoUI === "function"
        ? htmlPersonagemRecompensaPedraoUI("raspadinha", "", chegada)
        : `<p>${escaparOperacao(chegada)}</p>`;
    corpo +=
      m.raspadinhaStatus === "usada"
        ? '<span class="raspadinha-status-usada">Usado</span>'
        : `<button type="button" class="raspa-abrir-mensagem-ui" onclick="abrirRaspadinhaCliente('${escaparOperacao(m.raspadinhaId)}')">Abrir</button>`;
  }
  return `<div class="card-mensagem">${remetente}${corpo}<small>${new Date(m.data).toLocaleString("pt-BR")}${m.remetente === "cliente" ? (m.lida ? " • visualizada" : " • enviada") : ""}</small></div>`;
}

function abrirMensagensCliente() {
  document.getElementById("modal-mensagens").style.display = "flex";

  abrirAbaMensagens("geral");
  atualizarContadorMensagens();
}

function fecharMensagensCliente() {
  if (janelaSuporteClienteUI?.open) janelaSuporteClienteUI.close();
  consultaMensagensUI++;
  if (window.listenerChamadoCliente) window.listenerChamadoCliente();
  window.listenerChamadoCliente = null;
  document.getElementById("modal-mensagens").style.display = "none";
}

async function abrirAbaMensagens(tipo) {
  const consulta = ++consultaMensagensUI;
  abaMensagemAtual = tipo;
  if (tipo !== "suporte" && janelaSuporteClienteUI?.open) janelaSuporteClienteUI.close();

  const lista = document.getElementById("lista-mensagens-cliente");

  const boxSuporte = document.getElementById("box-enviar-suporte");
  if (window.listenerChamadoCliente) window.listenerChamadoCliente();
  window.listenerChamadoCliente = null;
  lista.innerHTML = htmlCarregandoUI("Buscando mensagens…");

  boxSuporte.style.display = tipo === "suporte" ? "block" : "none";
  if (tipo === "suporte") {
    lista.innerHTML = "";
    etapaSuporteCliente();
    return;
  }

  if (!clienteLogado) {
    lista.innerHTML = "Faça login.";
    return;
  }

  try {
    const snap = await lerComPrazoUI(
      db
        .collection("clientes")
        .doc(clienteLogado.telefone)
        .collection("mensagens")
        .where("tipo", "==", tipo)
        .get(),
    );
    if (consulta !== consultaMensagensUI) return;
    // A leitura aparece imediatamente; a marcação não bloqueia a navegação.
    const pendentes = snap.docs.filter(
      (doc) => doc.data().remetente === "admin" && !doc.data().lida,
    );
    Promise.all(pendentes.map((doc) => doc.ref.update({ lida: true })))
      .then(() => atualizarContadorMensagens())
      .catch(console.error);

    if (snap.empty) {
      lista.innerHTML = "<p>Nenhuma mensagem.</p>";

      return;
    }

    let mensagens = [];

    snap.forEach((doc) => {
      mensagens.push(doc.data());
    });

    mensagens.sort((a, b) => new Date(b.data) - new Date(a.data));

    // Mensagens antigas ainda sem status: consulta só ao abrir esta lista.
    const estadosAntigos = new Map();
    for (const m of mensagens) {
      if (!m.raspadinhaId || m.raspadinhaStatus) continue;
      if (!estadosAntigos.has(m.raspadinhaId)) {
        const premio = await lerComPrazoUI(db.collection("raspadinhas").doc(m.raspadinhaId).get());
        if (consulta !== consultaMensagensUI) return;
        estadosAntigos.set(m.raspadinhaId, premio.exists ? premio.data().status : "indisponivel");
      }
      m.raspadinhaStatus = estadosAntigos.get(m.raspadinhaId);
    }

    if (consulta === consultaMensagensUI)
      lista.innerHTML = mensagens.map(htmlMensagemCliente).join("");
  } catch (e) {
    console.error(e);

    if (consulta === consultaMensagensUI)
      lista.innerHTML = `<p>Não foi possível buscar as mensagens. Confira sua conexão.</p><button type="button" onclick="abrirAbaMensagens(abaMensagemAtual)">Tentar novamente</button>`;
  }
}

async function enviarMensagemSuporte() {
  const texto = document.getElementById("mensagem-suporte").value.trim();

  if (!texto) {
    return alert("Digite uma mensagem.");
  }

  await db.collection("clientes").doc(clienteLogado.telefone).collection("mensagens").add({
    tipo: "suporte",
    texto,
    remetente: "cliente",
    data: new Date().toISOString(),
    lida: false,
  });

  document.getElementById("mensagem-suporte").value = "";

  abrirAbaMensagens("suporte");
}
async function responderMensagemAdmin(clienteId) {
  const texto = await solicitarTextoUI("Digite a resposta para o cliente:");

  if (!texto) return;

  await db.collection("clientes").doc(clienteId).collection("mensagens").add({
    tipo: "admin",
    texto,
    remetente: "admin",
    data: new Date().toISOString(),
    lida: false,
  });

  listarMensagensAdmin();
}
let chamadoClienteAbertoId = null;
const enviosChamadoClienteUI = new Set();
let janelaSuporteClienteUI = null;
let etapaSuporteClienteUI = "inicio";
let categoriaSuporteClienteUI = "";

function nomeCategoriaSuporteClienteUI(tipo) {
  return (
    { reclamacao: "Reclamação", feedback: "Feedback", outros: "Outros" }[tipo] || "Suportes abertos"
  );
}
function ajustarJanelaSuporteClienteUI() {
  if (!janelaSuporteClienteUI) return;
  const viewport = window.visualViewport;
  janelaSuporteClienteUI.style.setProperty(
    "--suporte-altura-ui",
    (viewport?.height || window.innerHeight) + "px",
  );
  janelaSuporteClienteUI.style.setProperty("--suporte-top-ui", (viewport?.offsetTop || 0) + "px");
}
function atualizarJanelaSuporteClienteUI(etapa) {
  const titulos = {
    lista: "Suportes abertos",
    categoria: nomeCategoriaSuporteClienteUI(categoriaSuporteClienteUI),
    novo: "Novo suporte",
    chat: "Conversa do suporte",
  };
  if (!janelaSuporteClienteUI?.open) {
    const retorno = document.getElementById(
      etapa === "novo" ? "btn-novo-suporte" : "btn-suportes-abertos",
    );
    const janela = abrirJanelaElementoUI(
      document.getElementById("box-enviar-suporte"),
      titulos[etapa],
    );
    janelaSuporteClienteUI = janela;
    janela.id = "janela-suporte-cliente-ui";
    janela.classList.add("suporte-cliente-janela-ui");
    janela.querySelector(".ui-voltar").onclick = voltarSuporteClienteUI;
    janela.querySelector(".ui-x").onclick = () => etapaSuporteCliente();
    janela.querySelector(".ui-x").setAttribute("aria-label", "Fechar suporte");
    janela.addEventListener("cancel", (evento) => {
      evento.preventDefault();
      etapaSuporteCliente();
    });
    window.visualViewport?.addEventListener("resize", ajustarJanelaSuporteClienteUI);
    window.visualViewport?.addEventListener("scroll", ajustarJanelaSuporteClienteUI);
    window.addEventListener("resize", ajustarJanelaSuporteClienteUI);
    janela.addEventListener(
      "close",
      () => {
        if (janelaSuporteClienteUI !== janela) return;
        janelaSuporteClienteUI = null;
        window.visualViewport?.removeEventListener("resize", ajustarJanelaSuporteClienteUI);
        window.visualViewport?.removeEventListener("scroll", ajustarJanelaSuporteClienteUI);
        window.removeEventListener("resize", ajustarJanelaSuporteClienteUI);
        etapaSuporteCliente();
        document.getElementById("box-enviar-suporte").style.display =
          abaMensagemAtual === "suporte" ? "block" : "none";
        if (retorno?.isConnected) retorno.focus({ preventScroll: true });
      },
      { once: true },
    );
  }
  janelaSuporteClienteUI.dataset.etapa = etapa;
  janelaSuporteClienteUI.querySelector(".interface-janela-topo h3").textContent = titulos[etapa];
  janelaSuporteClienteUI.setAttribute("aria-label", titulos[etapa]);
  ajustarJanelaSuporteClienteUI();
}
function voltarSuporteClienteUI() {
  if (etapaSuporteClienteUI === "chat")
    return etapaSuporteCliente(categoriaSuporteClienteUI ? "categoria" : "lista");
  if (etapaSuporteClienteUI === "categoria") return etapaSuporteCliente("lista");
  etapaSuporteCliente();
}

function etapaSuporteCliente(etapa = "inicio") {
  etapaSuporteClienteUI = etapa;
  if (etapa !== "chat" && abaMensagemAtual === "suporte") consultaMensagensUI++;
  if (etapa !== "chat" && window.listenerChamadoCliente) {
    window.listenerChamadoCliente();
    window.listenerChamadoCliente = null;
  }
  document.getElementById("lista-chamados-cliente").style.display = ["lista", "categoria"].includes(
    etapa,
  )
    ? "block"
    : "none";
  document.getElementById("suporte-menu").style.display = etapa === "inicio" ? "grid" : "none";
  document.getElementById("form-novo-chamado").style.display = etapa === "novo" ? "grid" : "none";
  document.getElementById("chat-chamado-cliente").style.display =
    etapa === "chat" ? "flex" : "none";
  if (etapa === "inicio") {
    if (janelaSuporteClienteUI?.open) janelaSuporteClienteUI.close();
    return;
  }
  if (etapa === "lista") categoriaSuporteClienteUI = "";
  atualizarJanelaSuporteClienteUI(etapa);
  if (["lista", "categoria"].includes(etapa)) {
    const consulta = consultaMensagensUI;
    listarChamadosCliente(etapa === "categoria" ? categoriaSuporteClienteUI : "").catch(() => {
      if (consulta === consultaMensagensUI)
        document.getElementById("lista-chamados-cliente").innerHTML =
          '<p>Não foi possível buscar seus suportes.</p><button type="button" onclick="etapaSuporteCliente(\'lista\')">Tentar novamente</button>';
    });
  }
}
function abrirFormNovoChamado() {
  etapaSuporteCliente("novo");
}

async function listarChamadosCliente(categoriaSelecionada = "") {
  if (!clienteLogado) return;
  const consulta = consultaMensagensUI;
  const clienteId = clienteLogado.telefone;

  const box = document.getElementById("lista-chamados-cliente");
  box.innerHTML = htmlCarregandoUI("Buscando suportes…");

  const snap = await lerComPrazoUI(
    db
      .collection("clientes")
      .doc(clienteLogado.telefone)
      .collection("chamados")
      .where("status", "==", "aberto")
      .get(),
  );
  if (consulta !== consultaMensagensUI || clienteLogado?.telefone !== clienteId) return;

  if (snap.empty) {
    box.innerHTML = "<p>Nenhum suporte aberto.</p>";
    return;
  }

  let chamados = [];

  snap.forEach((doc) => {
    chamados.push({
      id: doc.id,
      ...doc.data(),
    });
  });

  chamados.sort((a, b) => new Date(b.criadoEm) - new Date(a.criadoEm));

  let html = '<div class="suporte-categorias">';
  for (const [tipo, nome] of [
    ["feedback", "Feedback"],
    ["reclamacao", "Reclamação"],
    ["outros", "Outros"],
  ]) {
    const total = chamados.filter((c) => c.categoria === tipo).length;
    if (total)
      html +=
        '<button type="button" onclick="filtrarSuportesCliente(\'' +
        tipo +
        "')\">" +
        nome +
        " (" +
        total +
        ")</button>";
  }
  html += '</div><div id="suporte-blocos" class="suporte-grade" hidden>';

  const naoLidas = await Promise.all(
    chamados.map((c) =>
      lerComPrazoUI(
        db
          .collection("clientes")
          .doc(clienteLogado.telefone)
          .collection("chamados")
          .doc(c.id)
          .collection("mensagens")
          .where("remetente", "==", "admin")
          .where("lida", "==", false)
          .get(),
      ),
    ),
  );
  if (consulta !== consultaMensagensUI || clienteLogado?.telefone !== clienteId) return;
  for (let index = 0; index < chamados.length; index++) {
    const c = chamados[index];

    const categoria =
      c.categoria === "reclamacao"
        ? "Reclamação"
        : c.categoria === "feedback"
          ? "Feedback"
          : "Outros";

    const totalNaoLidas = naoLidas[index].size;

    html += `
        <div class="card-chamado-cliente" data-categoria="${escaparOperacao(c.categoria)}">
            <strong>
                Suporte #${index + 1}
                ${totalNaoLidas > 0 ? `<span class="badge-msg">${totalNaoLidas}</span>` : ""}
            </strong>

            <p>${categoria}</p>

            ${
              totalNaoLidas > 0
                ? `<p class="aviso-nova-msg">Nova resposta do Pedrão Lanches</p>`
                : ""
            }

            <small>${new Date(c.criadoEm).toLocaleString("pt-BR")}</small>

            <button type="button" onclick="abrirChamadoCliente('${c.id}')">
                Abrir conversa
            </button>

            <button type="button" onclick="finalizarChamadoCliente('${c.id}')">
                Encerrar chat
            </button>
        </div>
    `;
  }

  box.innerHTML =
    html +
    '</div><p id="suporte-categoria-vazia" hidden>Nenhum suporte aberto nesta categoria.</p>';
  if (categoriaSelecionada) filtrarSuportesCliente(categoriaSelecionada);
}
function filtrarSuportesCliente(tipo) {
  if (!["reclamacao", "feedback", "outros"].includes(tipo)) return;
  categoriaSuporteClienteUI = tipo;
  etapaSuporteClienteUI = "categoria";
  atualizarJanelaSuporteClienteUI("categoria");
  document.querySelector("#lista-chamados-cliente .suporte-categorias").hidden = true;
  document.getElementById("suporte-blocos").hidden = false;
  let visiveis = 0;
  document.querySelectorAll("#suporte-blocos .card-chamado-cliente").forEach((card) => {
    card.hidden = card.dataset.categoria !== tipo;
    if (!card.hidden) visiveis++;
  });
  document.getElementById("suporte-categoria-vazia").hidden = visiveis > 0;
}
async function criarChamadoSuporte() {
  if (!clienteLogado) {
    return alert("Faça login primeiro.");
  }

  const categoria = document.getElementById("categoria-chamado").value;
  const texto = document.getElementById("mensagem-novo-chamado").value.trim();
  const selecionado = document.getElementById("pedido-relacionado-suporte").value || "";
  const [colecaoPedido, pedidoId] = selecionado.split("/");

  const possuiPedido = document.getElementById("suporte-tem-pedido").value === "sim";

  if (!categoria) return alert("Escolha o tipo do suporte.");
  if (!texto) return alert("Digite sua mensagem.");
  if (typeof checkoutProtegidoUI !== "undefined" && (await checkoutProtegidoUI.ativo())) {
    try {
      if (possuiPedido && !selecionado) return alert("Escolha o pedido do histórico.");
      const resultado = await checkoutProtegidoUI.suporte({
        categoria,
        texto,
        referenciaPedido: possuiPedido ? selecionado : "",
      });
      document.getElementById("categoria-chamado").value = "";
      document.getElementById("mensagem-novo-chamado").value = "";
      document.getElementById("form-novo-chamado").style.display = "none";
      categoriaSuporteClienteUI = categoria;
      abrirChamadoCliente(resultado.id);
    } catch (e) {
      mostrarAvisoUI(e.message, "conferir");
    }
    return;
  }
  if (possuiPedido) {
    if (!["pedidos", "historicoPagamentosClientes"].includes(colecaoPedido) || !pedidoId)
      return alert("Escolha o pedido do histórico.");
    const pedido = await db.collection(colecaoPedido).doc(pedidoId).get();
    if (!pedido.exists || pedido.data().clienteId !== clienteLogado.telefone)
      return alert("Pedido não encontrado nesta conta.");
  }

  const chamadoRef = await db
    .collection("clientes")
    .doc(clienteLogado.telefone)
    .collection("chamados")
    .add({
      categoria,
      status: "aberto",
      possuiPedidoRelacionado: possuiPedido,
      pedidoRelacionadoId: possuiPedido ? pedidoId : "",
      pedidoRelacionadoColecao: possuiPedido ? colecaoPedido : "",

      clienteNome: clienteLogado.nome || "",
      clienteTelefone: clienteLogado.telefone || "",
      clienteAvatar: clienteLogado.avatar || "",
      criadoEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString(),
    });

  await chamadoRef.collection("mensagens").add({
    texto,
    remetente: "cliente",
    data: new Date().toISOString(),
    lida: false,
  });

  document.getElementById("categoria-chamado").value = "";
  document.getElementById("mensagem-novo-chamado").value = "";
  document.getElementById("form-novo-chamado").style.display = "none";

  categoriaSuporteClienteUI = categoria;
  abrirChamadoCliente(chamadoRef.id);
}

window.abrirChamadoCliente = async function (chamadoId) {
  const consulta = ++consultaMensagensUI;
  const mesmoChamado = chamadoClienteAbertoId === chamadoId;

  chamadoClienteAbertoId = chamadoId;

  const chat = document.getElementById("chat-chamado-cliente");

  etapaSuporteCliente("chat");
  const rascunho = mesmoChamado ? chat.querySelector("textarea")?.value || "" : "";
  chat.innerHTML = htmlCarregandoUI("Abrindo conversa…");

  if (window.listenerChamadoCliente) {
    window.listenerChamadoCliente();
    window.listenerChamadoCliente = null;
  }

  const chamadoRef = db
    .collection("clientes")
    .doc(clienteLogado.telefone)
    .collection("chamados")
    .doc(chamadoId);

  let chamadoDoc;
  try {
    chamadoDoc = await lerComPrazoUI(chamadoRef.get());
  } catch (erro) {
    if (consulta === consultaMensagensUI)
      chat.innerHTML =
        '<p>Não foi possível abrir a conversa. Confira sua conexão e tente novamente.</p><button type="button" onclick="abrirChamadoCliente(\'' +
        chamadoId +
        "')\">Tentar novamente</button>";
    return;
  }
  if (consulta !== consultaMensagensUI) return;
  const chamado = chamadoDoc.data();
  if (!chamado) {
    chat.innerHTML = "<p>Este suporte não está mais disponível.</p>";
    return;
  }

  chat.innerHTML = `<div class="suporte-conexao-status-ui" role="status" hidden></div><div class="suporte-mensagens-ui" role="log" aria-label="Mensagens do suporte" aria-live="polite"></div><div class="suporte-chat-rodape-ui">
    ${
      chamado.status !== "finalizado"
        ? `
      <div class="suporte-compositor">
        <textarea id="resposta-chamado-cliente" aria-label="Mensagem" placeholder="Continuar conversa..."></textarea>
        <button type="button" aria-label="Enviar mensagem" onclick="enviarMensagemChamadoCliente()">➤</button>
      </div>
      <div class="acoes-chat-cliente"><button type="button" onclick="finalizarChamadoCliente('${chamadoId}')">Encerrar chat</button></div>
    `
        : "<p><strong>Este suporte foi finalizado.</strong></p>"
    }</div>`;
  const campoResposta = chat.querySelector("textarea");
  if (campoResposta) campoResposta.value = rascunho;
  const listaMensagens = chat.querySelector(".suporte-mensagens-ui");
  let primeiraAtualizacao = true;

  window.listenerChamadoCliente = chamadoRef
    .collection("mensagens")
    .orderBy("data")
    .onSnapshot(
      async (snapshot) => {
        if (consulta !== consultaMensagensUI) return;
        chat.querySelector(".suporte-conexao-status-ui").hidden = true;
        let mensagens = [];

        for (const doc of snapshot.docs) {
          const m = doc.data();

          if (m.remetente === "admin" && m.lida === false) {
            doc.ref.update({ lida: true }).catch(console.error);
            m.lida = true;
          }

          mensagens.push(m);
        }

        atualizarContadorMensagens();

        const manterNoFim =
          primeiraAtualizacao ||
          listaMensagens.scrollHeight - listaMensagens.scrollTop - listaMensagens.clientHeight < 80;
        let html = "";

        mensagens.forEach((m) => {
          const ehCliente = m.remetente === "cliente";
          const avatar =
            ehCliente && typeof htmlAvatarClienteUI === "function"
              ? htmlAvatarClienteUI(clienteLogado, "avatar-msg")
              : `<img src="${ehCliente ? escaparOperacao(clienteLogado.avatar || "images/avatares/sem-rank/maionese.webp") : "images/personagens-pedrao/ui/mago-tranquilo.webp"}" class="avatar-msg" alt="${ehCliente ? "Você" : "Pedrão Lanches"}">`;

          html += `
                    <div class="linha-msg ${ehCliente ? "linha-cliente" : "linha-admin"}">
                        ${avatar}

                        <div class="msg-chat ${ehCliente ? "msg-cliente" : "msg-admin"}">
                            <strong>${ehCliente ? "Você" : "Pedrão Lanches"}</strong>
                            <p>${escaparOperacao(m.texto)}</p>
                            <small>${new Date(m.data).toLocaleString("pt-BR")}</small>
                        </div>
                    </div>
                `;
        });

        if (listaMensagens.innerHTML !== html) listaMensagens.innerHTML = html;
        if (manterNoFim) listaMensagens.scrollTop = listaMensagens.scrollHeight;
        primeiraAtualizacao = false;
      },
      () => {
        if (consulta === consultaMensagensUI) {
          const status = chat.querySelector(".suporte-conexao-status-ui");
          status.hidden = false;
          status.innerHTML = `<p>Não foi possível atualizar a conversa. Seu texto foi mantido.</p><button type="button" onclick="abrirChamadoCliente('${chamadoId}')">Tentar novamente</button>`;
        }
      },
    );
};

function retomarMensagensClienteUI() {
  if (document.hidden || !clienteLogado) return;
  const modal = document.getElementById("modal-mensagens");
  if (!modal || modal.style.display !== "flex") return;
  if (abaMensagemAtual !== "suporte") abrirAbaMensagens(abaMensagemAtual);
  else if (etapaSuporteClienteUI === "chat" && chamadoClienteAbertoId)
    abrirChamadoCliente(chamadoClienteAbertoId);
  else if (["lista", "categoria"].includes(etapaSuporteClienteUI))
    etapaSuporteCliente(etapaSuporteClienteUI);
}
document.addEventListener("visibilitychange", retomarMensagensClienteUI);
window.addEventListener("online", retomarMensagensClienteUI);
window.addEventListener("pageshow", (evento) => {
  if (evento.persisted) retomarMensagensClienteUI();
});

function fecharConversaChamadoCliente() {
  if (window.listenerChamadoCliente) {
    window.listenerChamadoCliente();
    window.listenerChamadoCliente = null;
  }

  chamadoClienteAbertoId = null;

  const chat = document.getElementById("chat-chamado-cliente");

  if (chat) {
    chat.innerHTML = "";
    chat.style.display = "none";
  }
}

async function enviarMensagemChamadoCliente() {
  const campo = document.getElementById("resposta-chamado-cliente");
  const chamadoId = chamadoClienteAbertoId,
    clienteId = clienteLogado?.telefone;
  if (!campo || !chamadoId || !clienteId) return alert("Abra um suporte primeiro.");
  const rascunho = campo.value,
    texto = rascunho.trim();
  if (!texto) return alert("Digite uma mensagem.");
  const chave = clienteId + "/" + chamadoId;
  if (enviosChamadoClienteUI.has(chave)) return;
  enviosChamadoClienteUI.add(chave);
  const botao = campo.closest(".suporte-compositor")?.querySelector("button");
  if (botao) botao.disabled = true;
  try {
    const chamadoRef = db
      .collection("clientes")
      .doc(clienteId)
      .collection("chamados")
      .doc(chamadoId);
    const chamado = (await lerComPrazoUI(chamadoRef.get())).data();
    if (!chamado || chamado.status === "finalizado") {
      alert("Este suporte já foi finalizado. Abra um novo suporte se precisar.");
      if (chamadoClienteAbertoId === chamadoId) etapaSuporteCliente("lista");
      return;
    }
    const protegido =
      typeof checkoutProtegidoUI !== "undefined" && (await checkoutProtegidoUI.ativo());
    if (protegido) await checkoutProtegidoUI.responderSuporte({ chamadoId, texto });
    else
      await chamadoRef
        .collection("mensagens")
        .add({ texto, remetente: "cliente", data: new Date().toISOString(), lida: false });
    // O listener atualiza somente as mensagens. Mantém o compositor, o foco e o novo rascunho.
    if (document.getElementById("resposta-chamado-cliente") === campo && campo.value === rascunho) {
      campo.value = "";
      if (document.activeElement === campo || document.activeElement === botao)
        campo.focus({ preventScroll: true });
    }
    if (!protegido)
      chamadoRef.update({ atualizadoEm: new Date().toISOString() }).catch(console.error);
  } catch (erro) {
    console.error("Não foi possível enviar a mensagem:", erro);
    alert("Não foi possível enviar a mensagem. Seu texto foi mantido para tentar novamente.");
  } finally {
    enviosChamadoClienteUI.delete(chave);
    if (botao) botao.disabled = false;
  }
}

async function finalizarChamadoCliente(chamadoId) {
  if (
    !(await dialogoOperacao("Deseja encerrar este chat?", null, true, { botao: "Encerrar chat" }))
  )
    return;

  if (typeof checkoutProtegidoUI !== "undefined" && (await checkoutProtegidoUI.ativo()))
    await checkoutProtegidoUI.encerrarSuporte(chamadoId);
  else
    await db
      .collection("clientes")
      .doc(clienteLogado.telefone)
      .collection("chamados")
      .doc(chamadoId)
      .update({
        status: "finalizado",
        finalizadoPor: "cliente",
        finalizadoEm: new Date().toISOString(),
        atualizadoEm: new Date().toISOString(),
      });

  chamadoClienteAbertoId = null;
  etapaSuporteCliente(categoriaSuporteClienteUI ? "categoria" : "lista");
}
async function togglePedidosSuporteCliente() {
  const box = document.getElementById("box-pedidos-suporte");
  const select = document.getElementById("pedido-relacionado-suporte");
  select.innerHTML = '<option value="">Selecione um pedido</option>';
  if (document.getElementById("suporte-tem-pedido").value !== "sim") {
    box.style.display = "none";
    return;
  }
  box.style.display = "block";
  if (!clienteLogado) return;
  select.innerHTML = '<option value="">Carregando pedidos...</option>';
  try {
    const pedidos = [];
    await Promise.all(
      ["pedidos", "historicoPagamentosClientes"].map(async (colecao) => {
        const consulta =
          typeof consultaHistoricoClienteSenhaUI === "function"
            ? consultaHistoricoClienteSenhaUI(colecao, clienteLogado)
            : db.collection(colecao).where("clienteId", "==", clienteLogado.telefone);
        const snap = await consulta.get();
        snap.forEach((doc) => {
          if (doc.data().status !== "cancelado")
            pedidos.push({ ...doc.data(), id: doc.id, colecao });
        });
      }),
    );
    const data = (p) =>
      Number(p.dataMs || p.criadoEmMs || new Date(p.data || p.criadoEm).getTime() || 0);
    pedidos.sort((a, b) => data(b) - data(a));
    select.innerHTML =
      '<option value="">' +
      (pedidos.length ? "Selecione um pedido" : "Nenhum pedido no histórico") +
      "</option>" +
      pedidos
        .map(
          (p, i) =>
            '<option value="' +
            escaparOperacao(p.colecao + "/" + p.id) +
            '">Pedido #' +
            (pedidos.length - i) +
            " · " +
            new Date(data(p)).toLocaleDateString("pt-BR") +
            "</option>",
        )
        .join("");
  } catch {
    select.innerHTML = '<option value="">Não foi possível carregar. Tente novamente.</option>';
  }
}
async function atualizarStatusOnline() {
  if (document.hidden) return;
  let authUid;
  if (typeof checkoutProtegidoUI !== "undefined" && (await checkoutProtegidoUI.ativo())) {
    authUid = firebase.auth().currentUser?.uid;
    if (!authUid) return;
    if (!onlineSessionId.startsWith("cliente_" + authUid + "_"))
      onlineSessionId = "cliente_" + authUid + "_" + Date.now().toString(36);
  }
  const dadosOnline = {
    ...(authUid ? { authUid } : {}),
    sessionId: onlineSessionId,

    nome: clienteLogado?.nome || "Sem cadastro",

    telefone: clienteLogado?.telefone || "",

    avatar: clienteLogado?.avatar || "images/avatares/sem-rank/maionese.webp",

    clienteId: clienteLogado?.telefone || "",

    logado: !!clienteLogado,
    codigoAtivacao: clienteLogado?.codigoAtivacao || "",

    fidelidadeAtiva: !!clienteLogado?.fidelidadeAtiva,
    nivelCliente: clienteLogado?.nivelCliente || "Sem nível",

    ultimaAtividade: new Date().toISOString(),

    pagina: document.title || "Pedrão Lanches",
  };

  await db.collection("usuariosOnline").doc(onlineSessionId).set(dadosOnline);
}
setInterval(() => {
  atualizarStatusOnline().catch(console.error);
}, 30000);
window.addEventListener("load", () => {
  atualizarStatusOnline().catch(console.error);
});
let buscaContadorMensagensUI = null;
function atualizarContadorMensagens() {
  if (typeof acompanharContadorClienteUI === "function" && acompanharContadorClienteUI())
    return Promise.resolve();
  if (!buscaContadorMensagensUI)
    buscaContadorMensagensUI = buscarContadorMensagensUI()
      .catch(console.error)
      .finally(() => {
        buscaContadorMensagensUI = null;
      });
  return buscaContadorMensagensUI;
}
async function buscarContadorMensagensUI() {
  if (!clienteLogado) return;
  if (!document.getElementById("badge-geral")) return;

  let totalGeral = 0;
  let totalAdmin = 0;
  let totalSuporte = 0;

  const [mensagensSnap, chamadosSnap] = await Promise.all([
    lerComPrazoUI(
      db
        .collection("clientes")
        .doc(clienteLogado.telefone)
        .collection("mensagens")
        .where("lida", "==", false)
        .where("remetente", "==", "admin")
        .get(),
    ),
    lerComPrazoUI(
      db
        .collection("clientes")
        .doc(clienteLogado.telefone)
        .collection("chamados")
        .where("status", "==", "aberto")
        .get(),
    ),
  ]);

  mensagensSnap.forEach((doc) => {
    const m = doc.data();

    if (m.tipo === "geral") {
      totalGeral++;
    }

    if (m.tipo === "admin") {
      totalAdmin++;
    }
  });

  const respostas = await Promise.all(
    chamadosSnap.docs.map((chamadoDoc) =>
      lerComPrazoUI(
        chamadoDoc.ref
          .collection("mensagens")
          .where("lida", "==", false)
          .where("remetente", "==", "admin")
          .get(),
      ),
    ),
  );
  totalSuporte = respostas.reduce((total, snap) => total + snap.size, 0);

  document.getElementById("badge-geral").innerText = totalGeral > 0 ? totalGeral : "";

  document.getElementById("badge-admin").innerText = totalAdmin > 0 ? totalAdmin : "";

  document.getElementById("badge-suporte").innerText = totalSuporte > 0 ? totalSuporte : "";
  const totalTodas = totalGeral + totalAdmin + totalSuporte;

  const btnMensagens = document.querySelector(".btn-mensagens-perfil");

  if (btnMensagens) {
    btnMensagens.innerHTML =
      totalTodas > 0 ? `Mensagens <span class="badge-msg">${totalTodas}</span>` : "Mensagens";
  }
}
function limparTelaMensagensCliente() {
  if (janelaSuporteClienteUI?.open) janelaSuporteClienteUI.close();
  chamadoClienteAbertoId = null;

  const lista = document.getElementById("lista-mensagens-cliente");
  const listaChamados = document.getElementById("lista-chamados-cliente");
  const chat = document.getElementById("chat-chamado-cliente");
  const form = document.getElementById("form-novo-chamado");

  if (lista) lista.innerHTML = "";
  if (listaChamados) listaChamados.innerHTML = "";
  if (chat) {
    chat.innerHTML = "";
    chat.style.display = "none";
  }
  if (form) form.style.display = "none";
}
async function criarPerfilCliente() {
  if (typeof acessoClienteSenhaUI !== "undefined") {
    try {
      if (await window.acessoClienteSenhaUI.ativo()) return cadastrarClienteSenhaDeliveryUI();
    } catch (erro) {
      alert(erro.message);
      return;
    }
  }
  const nome = document.getElementById("perfil-nome").value.trim();
  const telefone = limparTelefonePerfil();
  const salvarLogin = document.getElementById("check-salvar-login")?.checked || false;

  if (!nome) return alert("Informe seu nome.");
  if (telefone.length !== 11) {
    return alert("Informe o celular completo com DDD. Ex: 65999999999");
  }

  const ref = db.collection("clientes").doc(telefone);
  const doc = await ref.get();

  if (doc.exists) {
    alert("Esse telefone já possui cadastro. Faça login.");
    abrirPerfilModo("login");
    return;
  }

  const novoCliente = {
    nome,
    telefone,
    codigoAtivacao: "",
    fidelidadeAtiva: false,

    nivelCliente: "Sem nível",

    pedidosTotal: 0,
    gastoTotal: 0,
    gastoSemana: 0,

    ultimaCompra: null,

    totalGasto: 0,
    totalFidelidade: 0,
    bonusDisponivel: 0,
    bonusGeradoTotal: 0,

    avatar: avatarClienteAtual,
    criadoEm: new Date().toISOString(),
  };

  await ref.set(novoCliente);

  clienteLogado = novoCliente;

  if (salvarLogin) {
    localStorage.setItem(
      "clientePedrao",
      JSON.stringify({
        telefone,
        nome,
        avatar: avatarClienteAtual,
      }),
    );
  }

  limparTelaMensagensCliente();
  atualizarTelaClienteLogado();
  atualizarStatusOnline();

  mostrarBoasVindasUI(nome, true);
}
document.addEventListener("input", (e) => {
  if (e.target.id === "perfil-telefone") {
    e.target.value = e.target.value.replace(/\D/g, "").slice(0, 11);
  }
});
async function atualizarNivelCliente(clienteId) {
  const ref = db.collection("clientes").doc(clienteId);

  const doc = await ref.get();

  if (!doc.exists) return;

  const cliente = doc.data();

  const pedidos = Number(cliente.pedidosTotal || 0);

  const gasto = Number(cliente.gastoTotal || 0);

  const fidelidade = !!cliente.fidelidadeAtiva;

  let nivel = fidelidade ? "Bronze" : "Sem nível";

  if (!fidelidade) {
    nivel = "Sem nível";
  } else if (pedidos >= 1) {
    nivel = "Bronze";
  }

  if (fidelidade && (pedidos >= 5 || gasto >= 300)) {
    nivel = "Prata";
  }

  if (fidelidade && (pedidos >= 15 || gasto >= 700)) {
    nivel = "Ouro";
  }

  if (fidelidade && (pedidos >= 30 || gasto >= 1500)) {
    nivel = "Diamante";
  }

  if (fidelidade && (pedidos >= 60 || gasto >= 4000)) {
    nivel = "Imortal";
  }

  await ref.update({
    nivelCliente: nivel,
  });
}
const checkPersonalizado = document.getElementById("molho-personalizado-check");

if (checkPersonalizado) {
  checkPersonalizado.addEventListener("change", () => {
    document.getElementById("molho-personalizado").style.display = checkPersonalizado.checked
      ? "block"
      : "none";
  });
}

document.querySelectorAll('input[name="modo-molho"]').forEach((radio) => {
  radio.addEventListener("change", () => {
    const modo = document.querySelector('input[name="modo-molho"]:checked')?.value;
    const opcoes = document.getElementById("opcoes-molhos-gratis");

    if (opcoes) {
      opcoes.style.display = modo === "doisiguais" ? "block" : "none";
    }
  });
});

function abrirMolhosItem(index) {
  indiceMolhoAtual = index;

  const item = carrinho[index];
  if (!item) return;
  molhosPagosTemp = {
    Maionese: 0,
    Ketchup: 0,
    Mostarda: 0,
    Barbecue: 0,
  };

  if (item.molhosPagos) {
    item.molhosPagos.forEach((m) => {
      if (m.nome in molhosPagosTemp) molhosPagosTemp[m.nome] = Math.max(0, Number(m.qtd) || 0);
    });
  }

  const conteudo = document.getElementById("conteudo-molhos");

  let qtdDireitos = Number(item.qtd) || 1;

  const categoriaItem = String(item.categoria || "").toLowerCase();

  if (categoriaItem.includes("combo")) {
    qtdDireitos = Number(item.comboQtdLanches) || 1;
  }

  let blocos = "";
  molhosGratisTempUI = [];

  for (let i = 1; i <= qtdDireitos; i++) {
    const molhoSalvo = item.molhosGratis?.find((m) => Number(m.unidade) === i);
    molhosGratisTempUI.push(normalizarMolhoGratisUI(molhoSalvo, i));
    blocos += `<section id="bloco-molho-${i}" class="bloco-molho-item">${htmlBlocoMolhoUI(i)}</section>`;
  }

  conteudo.innerHTML = `
        <h3>${item.nome}</h3>

        ${blocos}

        <hr>

      <h3>💰 Molhos pagos</h3>

<button type="button" class="btn-molhos-pagos" onclick="toggleAreaMolhosPagos()">
    ➕ Adicionar molhos pagos
</button>

<div id="area-molhos-pagos" style="display:none;">
    <p>R$ 2,00 cada unidade</p>

    <div class="molho-pago-linha">
    <span>Maionese</span>
    <button type="button" onclick="alterarMolhoPago('Maionese', -1)">-</button>
    <strong id="molho-pago-Maionese">${molhosPagosTemp.Maionese}</strong>
    <button type="button" onclick="alterarMolhoPago('Maionese', 1)">+</button>
</div>

<div class="molho-pago-linha">
    <span>Ketchup</span>
    <button type="button" onclick="alterarMolhoPago('Ketchup', -1)">-</button>
    <strong id="molho-pago-Ketchup">${molhosPagosTemp.Ketchup}</strong>
    <button type="button" onclick="alterarMolhoPago('Ketchup', 1)">+</button>
</div>

<div class="molho-pago-linha">
    <span>Mostarda</span>
    <button type="button" onclick="alterarMolhoPago('Mostarda', -1)">-</button>
    <strong id="molho-pago-Mostarda">${molhosPagosTemp.Mostarda}</strong>
    <button type="button" onclick="alterarMolhoPago('Mostarda', 1)">+</button>
</div>

<div class="molho-pago-linha">
    <span>Barbecue</span>
    <button type="button" onclick="alterarMolhoPago('Barbecue', -1)">-</button>
    <strong id="molho-pago-Barbecue">${molhosPagosTemp.Barbecue}</strong>
    <button type="button" onclick="alterarMolhoPago('Barbecue', 1)">+</button>
</div>
</div>

    `;

  document.getElementById("modal-molhos").style.display = "flex";
}
function toggleAreaMolhosPagos() {
  const area = document.getElementById("area-molhos-pagos");
  if (!area) return;

  area.style.display =
    area.style.display === "none" || area.style.display === "" ? "block" : "none";
}
function salvarMolhosItem(fechar = true) {
  const item = carrinho[indiceMolhoAtual];

  if (!item) return alert("Item não encontrado.");

  const molhosGratis = molhosGratisTempUI.map((molho, indice) =>
    normalizarMolhoGratisUI(molho, indice + 1),
  );
  const molhosPagos = [];

  Object.keys(molhosPagosTemp).forEach((nome) => {
    const qtd = molhosPagosTemp[nome];

    if (qtd > 0) {
      molhosPagos.push({
        nome,
        qtd,
        preco: PRECO_MOLHO_PAGO,
      });
    }
  });

  item.molhosPagos = molhosPagos;
  item.totalMolhosPagos = molhosPagos.reduce((total, m) => {
    return total + m.qtd * m.preco;
  }, 0);

  item.molhosGratis = molhosGratis;

  if (fechar) fecharModalMolhos(false);

  exibirRevisao(
    dadosPedidoTemporario.itens,
    dadosPedidoTemporario.subtotal,
    dadosPedidoTemporario.taxa,
    dadosPedidoTemporario.tipo,
    dadosPedidoTemporario.obs,
    dadosPedidoTemporario.mapa,
    dadosPedidoTemporario.km,
    dadosPedidoTemporario.foraDaArea,
    dadosPedidoTemporario.areaUrbanaConfirmada,
  );
}

function fecharModalMolhos(aplicar = true) {
  if (aplicar && carrinho[indiceMolhoAtual]) salvarMolhosItem(false);
  if (janelaMolhoUnidadeUI?.open) janelaMolhoUnidadeUI.close();
  document.getElementById("modal-molhos").style.display = "none";
}
function alterarMolhoPago(nome, delta) {
  if (!(nome in molhosPagosTemp)) return;

  molhosPagosTemp[nome] += delta;

  if (molhosPagosTemp[nome] < 0) {
    molhosPagosTemp[nome] = 0;
  }

  const el = document.getElementById(`molho-pago-${nome}`);

  if (el) {
    el.textContent = molhosPagosTemp[nome];
  }
}

function normalizarMolhoGratisUI(escolha, unidade) {
  const nomes = ["Maionese", "Ketchup", "Mostarda", "Barbecue"];
  if (escolha?.tipo === "umdecada") {
    const molhos = nomes.filter((nome) => escolha.molhos?.includes(nome));
    if (molhos.length) return { unidade, tipo: "umdecada", molhos, texto: molhos.join(" + ") };
  }
  if (escolha?.tipo === "doisiguais" && nomes.includes(escolha.molho))
    return { unidade, tipo: "doisiguais", molho: escolha.molho, texto: `2 ${escolha.molho}` };
  return { unidade, tipo: "semmolho", texto: "Sem molho" };
}
function htmlOpcaoMolhoUI(rotulo, selecionado, acao, nome = "") {
  return `<button type="button" class="molho-opcao-ui" aria-pressed="${selecionado}" ${nome ? `data-molho="${nome}"` : ""} onclick="${acao}"><span class="molho-marca-ui" aria-hidden="true">${selecionado ? "✓" : ""}</span><span>${escaparOperacao(rotulo)}</span></button>`;
}
function htmlBlocoMolhoUI(i) {
  const item = carrinho[indiceMolhoAtual];
  const escolha = molhosGratisTempUI[i - 1];
  const comMolho = escolha.tipo !== "semmolho";
  const nome = String(item.categoria || "")
    .toLowerCase()
    .includes("combo")
    ? `${i}º lanche`
    : `${item.nome} #${i}`;
  return `<h4>${escaparOperacao(nome)}</h4><div class="molho-escolhas-ui" role="group" aria-label="Molho para ${escaparOperacao(nome)}">${htmlOpcaoMolhoUI("Sem molho", !comMolho, `definirSemMolhoUI(${i})`)}${htmlOpcaoMolhoUI("Com molho", comMolho, `abrirEscolhaMolhoUI(${i})`)}</div>${comMolho ? `<p class="molho-resumo-ui">${escaparOperacao(escolha.texto)}</p>` : ""}`;
}
function atualizarBlocoMolhoUI(i) {
  const bloco = document.getElementById(`bloco-molho-${i}`);
  if (bloco) bloco.innerHTML = htmlBlocoMolhoUI(i);
}
function definirSemMolhoUI(i) {
  molhosGratisTempUI[i - 1] = normalizarMolhoGratisUI(null, i);
  atualizarBlocoMolhoUI(i);
}
function abrirEscolhaMolhoUI(i) {
  if (janelaMolhoUnidadeUI?.open) return;
  const atual = molhosGratisTempUI[i - 1];
  if (!atual) return;
  unidadeMolhoTempUI = i;
  escolhaMolhoTempUI = { ...atual, molhos: [...(atual.molhos || [])] };
  const janela = document.createElement("dialog");
  janela.className = "janela-molho-unidade-ui";
  janela.setAttribute("aria-labelledby", "titulo-molho-unidade-ui");
  janela.innerHTML =
    '<div class="molhos-cabecalho-ui"><button type="button" class="ui-voltar">← Voltar</button><h3 id="titulo-molho-unidade-ui"></h3><button type="button" class="ui-x" aria-label="Fechar escolha de molhos">×</button></div><div class="molho-janela-conteudo-ui"></div>';
  janelaMolhoUnidadeUI = janela;
  janela.querySelector(".ui-voltar").onclick = () =>
    etapaMolhoUnidadeUI === "molhos" ? renderizarJanelaMolhoUI("tipo") : janela.close();
  janela.querySelector(".ui-x").onclick = () => janela.close();
  janela.addEventListener(
    "close",
    () => {
      janela.remove();
      if (janelaMolhoUnidadeUI === janela) {
        janelaMolhoUnidadeUI = null;
        escolhaMolhoTempUI = null;
        unidadeMolhoTempUI = null;
      }
    },
    { once: true },
  );
  document.body.append(janela);
  renderizarJanelaMolhoUI("tipo");
  janela.showModal();
}
function renderizarJanelaMolhoUI(etapa) {
  const janela = janelaMolhoUnidadeUI;
  if (!janela || !escolhaMolhoTempUI) return;
  etapaMolhoUnidadeUI = etapa;
  janela.dataset.etapa = etapa;
  janela.querySelector("h3").textContent =
    etapa === "tipo" ? "Como quer os molhos?" : "Escolha os molhos";
  const conteudo = janela.querySelector(".molho-janela-conteudo-ui");
  if (etapa === "tipo") {
    conteudo.innerHTML = `<div class="molho-escolhas-ui">${htmlOpcaoMolhoUI("1 de cada", escolhaMolhoTempUI.tipo === "umdecada", "selecionarTipoMolhoUI('umdecada')")}${htmlOpcaoMolhoUI("2 iguais", escolhaMolhoTempUI.tipo === "doisiguais", "selecionarTipoMolhoUI('doisiguais')")}</div>`;
    return;
  }
  const dois = escolhaMolhoTempUI.tipo === "doisiguais";
  const valido =
    normalizarMolhoGratisUI(escolhaMolhoTempUI, unidadeMolhoTempUI).tipo !== "semmolho";
  conteudo.innerHTML = `<p>${dois ? "Escolha um molho para receber 2 unidades." : "Escolha os molhos: você recebe 1 unidade de cada escolhido."}</p><div class="molho-escolhas-ui">${["Maionese", "Ketchup", "Mostarda", "Barbecue"].map((nome) => htmlOpcaoMolhoUI(dois ? `2 ${nome}` : nome, dois ? escolhaMolhoTempUI.molho === nome : escolhaMolhoTempUI.molhos.includes(nome), `alternarMolhoGratisUI('${nome}')`, nome)).join("")}</div><button type="button" class="molho-confirmar-ui" onclick="confirmarMolhoUnidadeUI()" ${valido ? "" : "disabled"}>Usar estes molhos</button>`;
}
function selecionarTipoMolhoUI(tipo) {
  if (!escolhaMolhoTempUI || !["umdecada", "doisiguais"].includes(tipo)) return;
  escolhaMolhoTempUI.tipo = tipo;
  renderizarJanelaMolhoUI("molhos");
}
function alternarMolhoGratisUI(nome) {
  if (!escolhaMolhoTempUI || !["Maionese", "Ketchup", "Mostarda", "Barbecue"].includes(nome))
    return;
  if (escolhaMolhoTempUI.tipo === "doisiguais") escolhaMolhoTempUI.molho = nome;
  else {
    const molhos = escolhaMolhoTempUI.molhos;
    escolhaMolhoTempUI.molhos = molhos.includes(nome)
      ? molhos.filter((m) => m !== nome)
      : [...molhos, nome];
  }
  renderizarJanelaMolhoUI("molhos");
  janelaMolhoUnidadeUI.querySelector(`[data-molho="${nome}"]`)?.focus({ preventScroll: true });
}
function confirmarMolhoUnidadeUI() {
  if (!escolhaMolhoTempUI) return;
  const escolha = normalizarMolhoGratisUI(escolhaMolhoTempUI, unidadeMolhoTempUI);
  if (escolha.tipo === "semmolho") return;
  molhosGratisTempUI[unidadeMolhoTempUI - 1] = escolha;
  atualizarBlocoMolhoUI(unidadeMolhoTempUI);
  janelaMolhoUnidadeUI.close();
}
function calcularTotalMolhosPagos() {
  let total = 0;

  carrinho.forEach((item) => {
    total += Number(item.totalMolhosPagos || 0);
  });

  return total;
}
