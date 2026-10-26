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
const db = firebase.firestore();

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

  lista.forEach((item) => {
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
let avatarClienteAtual = "images/avatar1.webp";
let cupomDescontoAplicado = null;
let onlineSessionId = localStorage.getItem("onlineSessionIdPedrao");
let indiceMolhoAtual = null;

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
        ? item.adicionais.map((a) => `${a.qtd} ${a.nome}`).join(" + ")
        : "";

    const obsTexto = item.obs || "";

    const temAdicional = item.adicionais && item.adicionais.length > 0;

    const valorItem = (Number(item.preco) || 0) * (Number(item.qtd) || 1);

    const div = document.createElement("div");
    div.classList.add("item-carrinho");

    div.innerHTML = `
            <div class="info-item-carrinho">

                <strong class="nome-item">
                    ${item.qtd} ${item.nome}
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
                            📝 Obs: ${obsTexto}
                        </small>
                    `
                    : ""
                }

            </div>

            <div class="acoes-item">
                <button onclick="diminuirItem(${index})">➖</button>
                <button onclick="aumentarItem(${index})">➕</button>
            </div>
        `;

    container.appendChild(div);
  });
}
function aumentarItem(index) {
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
  if (await confirmarOperacao("Deseja realmente apagar todo o pedido e recomeçar?")) {
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

function finalizarPedido() {
  if (typeof permitirPedidoLojaUI === "function" && !permitirPedidoLojaUI()) return;
  const nomeContato = document.getElementById("nome-cliente");
  const telefoneContato = document.getElementById("telefone-cliente");
  if (
    !nomeContato.value.trim() ||
    (telefoneContato?.value || "").replace(/\D/g, "").length !== 11
  ) {
    avisoOperacao("Informe nome e celular completo com DDD antes de continuar.");
    (!nomeContato.value.trim() ? nomeContato : telefoneContato)?.focus();
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

  pedirPermissaoLocalizacaoUI().then((autorizado) => {
    if (!autorizado) return;

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

        let foraDaArea = false;
        let taxa = 0;
        if (kmDistancia > 15) {
          foraDaArea = true;

          alert(
            "🚫 Fora da área de entrega.\n\n" +
              "Você pode enviar o pedido mesmo assim e vamos verificar 👍",
          );
        }

        if (kmDistancia <= 2) taxa = 6;
        else if (kmDistancia <= 3) taxa = 7;
        else if (kmDistancia <= 4) taxa = 8;
        else if (kmDistancia <= 5) taxa = 10;
        else if (kmDistancia <= 6) taxa = 11;
        else if (kmDistancia <= 7) taxa = 13;
        else if (kmDistancia <= 8) taxa = 14;
        else if (kmDistancia <= 9) taxa = 15;
        else if (kmDistancia <= 10) taxa = 16;
        else if (kmDistancia <= 11) taxa = 17;
        else taxa = 17 + Math.ceil(kmDistancia - 11) * 2;

        const agora = new Date();
        const diaSemana = agora.getDay();
        const dataFormatada = `${agora.getDate()}/${agora.getMonth() + 1}`;

        if (diaSemana === 0 || diaSemana === 6 || feriados.includes(dataFormatada)) {
          taxa += 1;
        }

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

function exibirRevisao(itens, subtotal, taxa, tipo, obs, mapa = "", km = 0, foraDaArea = false) {
  if (typeof permitirPedidoLojaUI === "function" && !permitirPedidoLojaUI()) return;
  dadosPedidoTemporario = { itens, subtotal, taxa, tipo, obs, mapa, km, foraDaArea };
  revisaoCarrinhoVersao = carrinhoVersao;

  const itensFormatados = carrinho.map((item) => {
    const temAdicional = item.adicionais && item.adicionais.length > 0;

    let texto = `
        <strong>
            ${item.qtd} ${item.nome}
            ${!temAdicional ? `(R$ ${Number(item.preco || 0).toFixed(2)})` : ""}
        </strong>
    `;

    if (temAdicional) {
      const adicionaisTexto = item.adicionais.map((a) => `${a.qtd} ${a.nome}`).join(" + ");

      texto += `<br><small>➕ Acréscimos: ${adicionaisTexto}</small>`;
      texto += `<br><strong>Valor com acréscimos: R$ ${Number(item.preco || 0).toFixed(2)}</strong>`;
    }

    if (item.obs) {
      texto += `<br><small>📝 Obs: ${item.obs}</small>`;
    }
    if (item.molhosGratis && item.molhosGratis.length > 0) {
      const molhosTexto = item.molhosGratis.map((m) => `#${m.unidade}: ${m.texto}`).join("<br>");

      texto += `
        <br>
        <small>
            🍶 Molhos:<br>${molhosTexto}
        </small>
    `;
    }
    if (item.molhosPagos && item.molhosPagos.length > 0) {
      const pagosTexto = item.molhosPagos.map((m) => `${m.qtd} ${m.nome}`).join("<br>");

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

    if (podeTerMolho) {
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

  const totalAntesDesconto = subtotal + taxa;

  let bonusAtual = Number(clienteLogado?.bonusDisponivel || 0);
  let totalGastoAtual = Number(clienteLogado?.totalFidelidade || 0);

  const proximaMeta = (Math.floor(totalGastoAtual / 300) + 1) * 300;

  const vaiGerarBonusNestePedido =
    clienteLogado &&
    clienteLogado.fidelidadeAtiva &&
    totalAntesDesconto >= 20 &&
    totalGastoAtual + totalAntesDesconto >= proximaMeta;

  if (
    clienteLogado &&
    clienteLogado.fidelidadeAtiva &&
    totalAntesDesconto >= 20 &&
    (bonusAtual >= 20 || vaiGerarBonusNestePedido)
  ) {
    descontoFidelidade = 20;
    total -= descontoFidelidade;

    if (total < 0) total = 0;
  } else {
    descontoFidelidade = 0;
  }

  const box = document.getElementById("detalhe-valores");

  let bonusEl = document.getElementById("linha-bonus");
  if (clienteLogado && clienteLogado.fidelidadeAtiva) {
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

  let cupomEl = document.getElementById("linha-desconto-cupom");

  if (descontoCupom > 0) {
    const totalBaseCupom = total;

    total -= descontoCupom;
    if (total < 0) total = 0;

    total = arredondarPagamento(total);

    descontoCupom = totalBaseCupom - total;
    if (descontoCupom < 0) descontoCupom = 0;

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
  if (typeof permitirPedidoLojaUI === "function" && !permitirPedidoLojaUI()) return;
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

  totalFinal = arredondarPagamento(totalFinal);

  const pedidoFirebase = {
    nome: nomeCliente || clienteLogado?.nome || "",
    telefone: telefoneFinalCliente,
    telefoneLimpo: telefoneLimpo,
    clienteId: clienteLogado ? clienteLogado.telefone : null,

    itens: itensProcessados,
    valorTotal: totalFinal,
    valorAntesDesconto: valorAntesDesconto,
    descontoFidelidade: descontoFidelidade || 0,
    fidelidadeAtivaNoPedido: clienteLogado ? !!clienteLogado.fidelidadeAtiva : false,
    cupomDescontoCodigo: cupomDescontoAplicado ? cupomDescontoAplicado.codigo : "",
    cupomDescontoNome: cupomDescontoAplicado ? cupomDescontoAplicado.nome : "",
    descontoCupom: descontoCupom || 0,
    codigoCliente: clienteLogado ? clienteLogado.codigoAtivacao || "" : "",
    taxaEntrega: Number(d.taxa) || 0,
    tipo: d.tipo,
    endereco: document.getElementById("endereco-escrito")?.value.trim() || "",
    condominio,
    cnh,
    localizacao: d.mapa || "",
    pagamento: pagamento,
    trocoPara: precisaTroco && valorTroco ? Number(valorTroco) : null,
    observacao: d.obs || "",

    data: new Date().toISOString(),
    dataMs: Date.now(),
  };

  const numeroPedido = await salvarPedidoFirebase(pedidoFirebase);
  if (numeroPedido === null) return;
  if (clienteLogado) {
    const clienteRef = db.collection("clientes").doc(clienteLogado.telefone);

    const clienteDoc = await clienteRef.get();

    if (clienteDoc.exists) {
      const cliente = clienteDoc.data();

      await clienteRef.update({
        pedidosTotal: Number(cliente.pedidosTotal || 0) + 1,
        gastoTotal: Number(cliente.gastoTotal || 0) + Number(totalFinal || 0),
        ultimaCompra: new Date().toISOString(),
      });

      await atualizarNivelCliente(clienteLogado.telefone);
    }
  }
  let msg = `*PEDRÃO LANCHES - PEDIDO*\n`;
  const agora = new Date();
  const dataHora = agora.toLocaleString("pt-BR");

  msg += `📅 *Feito em:* ${dataHora}\n`;
  msg += `--------------------------\n`;
  msg += `--------------------------\n`;

  if (nomeCliente) msg += `*Cliente:* ${nomeCliente}\n`;
  if (telefoneCliente) msg += `*Telefone:* ${telefoneCliente}\n`;

  msg += `--------------------------\n`;
  const itensWhats = carrinho.map((item) => {
    let texto = `*${item.qtd} ${item.nome}*`;
    if (typeof resumoComboTextoSiteUI === "function" && item.lanchesCombo?.length)
      texto += "\n" + resumoComboTextoSiteUI(item);

    if (item.adicionais && item.adicionais.length > 0) {
      const adicionaisTexto = item.adicionais.map((a) => `${a.qtd} ${a.nome}`).join(" + ");

      texto += `\n➕ *Acréscimos:* ${adicionaisTexto}`;
    }

    texto += `\n💰 *Valor:* R$ ${Number(item.preco || 0).toFixed(2)}`;

    if (item.obs) {
      texto += `\n📝 *Obs:* ${item.obs}`;
    }
    if (item.molhosGratis && item.molhosGratis.length > 0) {
      const molhosTexto = item.molhosGratis
        .map((m) => `${m.unidade}º Lanche: ${m.texto}`)
        .join("\n");

      texto += `\n🍶 *Molhos grátis:*\n${molhosTexto}`;
    }
    if (item.molhosPagos && item.molhosPagos.length > 0) {
      const molhosPagosTexto = item.molhosPagos.map((m) => `• ${m.qtd} ${m.nome}`).join("\n");

      const valorMolhos = item.totalMolhosPagos || 0;

      texto += `\n💰 *Molhos pagos:*\n${molhosPagosTexto}`;

      texto += `\n💵 *Valor dos molhos pagos:* R$ ${valorMolhos.toFixed(2)}`;
    }

    return texto;
  });

  msg += `*Pedido:*\n${itensWhats.join("\n\n")}\n`;
  msg += `--------------------------\n`;

  if (d.obs && d.obs.trim() !== "") {
    msg += `*OBS:* ${d.obs}\n`;
    msg += `--------------------------\n`;
  }
  if (descontoCupom > 0) {
    msg += `🏷️ *Cupom de desconto:* ${cupomDescontoAplicado.codigo} -R$ ${descontoCupom.toFixed(2)}\n`;
  }

  if (d.tipo === "Local") msg += `*Tipo:* Consumir no local 🍔\n`;
  else msg += `*Tipo:* ${d.tipo}\n`;

  if (d.tipo === "Entrega") {
    msg += `*Taxa:* R$ ${Number(d.taxa).toFixed(2)}`;

    if (d.km) {
      msg += ` (${d.km.toFixed(2)} km)`;
    }

    msg += `\n`;
  }

  msg += `--------------------------\n`;
  if (totalMolhosPagos > 0) {
    msg += `*Molhos pagos:* R$ ${totalMolhosPagos.toFixed(2)}\n`;
  }

  totalFinal = arredondarPagamento(totalFinal);

  if (clienteLogado && clienteLogado.fidelidadeAtiva) {
    const refCliente = db.collection("clientes").doc(clienteLogado.telefone);
    const docCliente = await refCliente.get();
    const dadosCliente = docCliente.data();

    const totalFidelidadeAtual = Number(dadosCliente.totalFidelidade) || 0;
    const bonusDisponivelAtual = Number(dadosCliente.bonusDisponivel) || 0;
    const bonusGeradoTotalAtual = Number(dadosCliente.bonusGeradoTotal) || 0;

    const valorParaFidelidade = Number(d.subtotal || 0) + Number(d.taxa || 0);
    const novoTotalFidelidade = totalFidelidadeAtual + valorParaFidelidade;

    const bonusTotalQueDeveriaTer = Math.floor(novoTotalFidelidade / 300) * 20;
    const bonusNovoGerado = bonusTotalQueDeveriaTer - bonusGeradoTotalAtual;

    let novoBonusDisponivel = bonusDisponivelAtual + bonusNovoGerado;

    if (descontoFidelidade > 0) {
      novoBonusDisponivel -= descontoFidelidade;
    }

    if (novoBonusDisponivel < 0) novoBonusDisponivel = 0;

    await refCliente.update({
      totalGasto: firebase.firestore.FieldValue.increment(valorParaFidelidade),
      totalFidelidade: novoTotalFidelidade,
      bonusDisponivel: novoBonusDisponivel,
      bonusGeradoTotal: bonusTotalQueDeveriaTer,
    });

    clienteLogado.totalGasto = (clienteLogado.totalGasto || 0) + valorParaFidelidade;
    clienteLogado.totalFidelidade = novoTotalFidelidade;
    clienteLogado.bonusDisponivel = novoBonusDisponivel;
    clienteLogado.bonusGeradoTotal = bonusTotalQueDeveriaTer;
  }

  msg += `*Total:* ${totalFinal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}\n`;
  if (descontoFidelidade > 0) {
    msg += `🎁 *Desconto fidelidade aplicado:* -R$ 20,00\n`;
  }

  msg += `*Pagamento:* ${pagamento}\n`;

  if (precisaTroco && valorTroco) {
    msg += `*Troco para:* R$ ${Number(valorTroco).toFixed(2)}\n`;
  }

  msg += `--------------------------\n`;

  if (d.tipo === "Entrega" && d.mapa) {
    msg += `📍 *Local:* ${d.mapa}\n\n`;
  }
  const enderecoEscrito = document.getElementById("endereco-escrito")?.value.trim();

  if (d.tipo === "Entrega" && enderecoEscrito) {
    msg += `*Endereço escrito:*\n${enderecoEscrito}\n`;
    msg += `--------------------------\n`;
  }
  msg += `*Condomínio:* ${condominio}\n`;

  if (condominio === "Sim") {
    msg += `*Precisa de CNH:* ${cnh}\n`;
  }
  if (d.foraDaArea) {
    msg += `\n❌ *FORA DA ÁREA DE ENTREGA*\n`;
    msg += `Distância: ${d.km.toFixed(2)} km\n`;
    msg += ` Taxa estimada: R$ ${Number(d.taxa).toFixed(2)}\n`;
    msg += `-> Estou ciente que a taxa pode sofrer alteração\n`;
    msg += `- Conseguem entregar mesmo assim?\n`;
    msg += `--------------------------\n`;
  }

  const url = `https://wa.me/5565992386045?text=${encodeURIComponent(msg)}`;
  window.open(url, "_blank");

  descontoFidelidade = 0;
  carrinho = [];
  dadosPedidoTemporario = {};
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
  const nome = document.getElementById("perfil-nome").value.trim();
  const telefone = limparTelefonePerfil();
  const codigo = document.getElementById("codigo-ativacao").value.trim();
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
    avatarClienteAtual = clienteLogado.avatar || "images/avatar1.webp";
    selecionarAvatar(avatarClienteAtual);

    if (codigo) {
      if (codigo === clienteLogado.codigoAtivacao && !clienteLogado.fidelidadeAtiva) {
        await ref.update({
          fidelidadeAtiva: true,
          nivelCliente: nivelFidelidadeOperacao(clienteLogado, true),
          ativadoEm: new Date().toISOString(),
          totalFidelidade: clienteLogado.totalFidelidade || 0,
          avatar: avatarClienteAtual,
        });

        clienteLogado.fidelidadeAtiva = true;
        clienteLogado.nivelCliente = nivelFidelidadeOperacao(clienteLogado);
        clienteLogado.ativadoEm = new Date().toISOString();

        mostrarAtivacaoCdaPedraoUI();
      } else if (codigo !== clienteLogado.codigoAtivacao) {
        alert(
          "Entramos na sua conta, mas o CDA informado está errado. Seria interessante você não esquecer ele!",
          "codigoLogin",
        );
      } else mostrarBoasVindasUI(clienteLogado.nome || nome);
    } else {
      mostrarBoasVindasUI(clienteLogado.nome || nome);
    }
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

  area.innerHTML = htmlCarregandoUI("Buscando pedidos…");

  const telefone = String(clienteLogado.telefone || "").replace(/\D/g, "");

  // =========================
  // PEDIDOS NORMAIS
  // =========================

  const [snapPedidos, snapLocal] = await Promise.all([
    lerComPrazoUI(db.collection("pedidos").where("clienteId", "==", telefone).get()),
    lerComPrazoUI(
      db.collection("historicoPagamentosClientes").where("clienteId", "==", telefone).get(),
    ),
  ]);

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
      Number(registro.descontoCupom || 0) + Number(registro.descontoFidelidade || 0);

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

  const ref = db.collection("clientes").doc(clienteLogado.telefone);
  const doc = await ref.get();
  const dados = doc.data();

  const fidelidadeAtiva = dados.fidelidadeAtiva || false;
  const totalFidelidade = Number(dados.totalFidelidade) || 0;
  const bonusDisponivel = Number(dados.bonusDisponivel) || 0;

  const progresso = totalFidelidade % 300;
  const falta = 300 - progresso;

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
    <p>Bônus disponível: <strong>R$ ${bonusDisponivel.toFixed(2)}</strong></p>
    <p>Faltam R$ ${falta.toFixed(2)} para gerar mais R$20 de bônus.</p>

    <div style="background:#222;border-radius:10px;overflow:hidden;margin-top:10px;">
        <div style="
            width:${(progresso / 300) * 100}%;
            background:#2ecc71;
            padding:10px;
            text-align:center;
            color:#fff;
            font-weight:bold;
        ">
            R$ ${progresso.toFixed(0)} / R$ 300
        </div>
    </div>
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
            <strong>${e.nome}</strong><br>
            ${e.enderecoCompleto || `${e.rua}, ${e.numero} - ${e.bairro}`}<br>
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
  abrirPedidosCliente();
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

  abrirBonusCliente();
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
                ${e.nome} - ${e.rua}, ${e.numero} - ${e.bairro}
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

  const todasListas = [...lanches, ...listaCombos, ...bebidas, ...batatas];

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

  // CUPOM DO PEDIDO
  if (cupom.tipo === "pedido" || cupom.tipo === "descontoGeral") {
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

        if (cupom.itemGeralTipo === "geral") {
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

  cupomDescontoAplicado = cupom;
  descontoCupom = desconto;

  retorno.innerText = "Cupom aplicado com sucesso!";

  exibirRevisao(
    dadosPedidoTemporario.itens,
    dadosPedidoTemporario.subtotal,
    dadosPedidoTemporario.taxa,
    dadosPedidoTemporario.tipo,
    dadosPedidoTemporario.obs,
    dadosPedidoTemporario.mapa,
    dadosPedidoTemporario.km,
    dadosPedidoTemporario.foraDaArea,
  );
}
function arredondarPagamento(valor) {
  const inteiro = Math.floor(valor);
  const centavos = valor - inteiro;

  if (centavos < 0.3) {
    return inteiro;
  }

  return inteiro + 1;
}
async function ajustarFidelidadeAposEditarPedido(pedidoAntigo, pedidoNovo) {
  if (!pedidoNovo.clienteId || !pedidoNovo.fidelidadeAtivaNoPedido) return;

  const refCliente = db.collection("clientes").doc(pedidoNovo.clienteId);
  const docCliente = await refCliente.get();

  if (!docCliente.exists) return;

  const c = docCliente.data();

  const antes = Number(pedidoAntigo.valorAntesDesconto || pedidoAntigo.valorTotal || 0);
  const depois = Number(pedidoNovo.valorAntesDesconto || pedidoNovo.valorTotal || 0);

  const diferenca = depois - antes;

  let totalFidelidade = Number(c.totalFidelidade || 0) + diferenca;
  if (totalFidelidade < 0) totalFidelidade = 0;

  const bonusGeradoTotal = Math.floor(totalFidelidade / 300) * 20;

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

function logoutCliente() {
  if (typeof encerrarContadorClienteUI === "function") encerrarContadorClienteUI();
  if (onlineSessionId) {
    db.collection("usuariosOnline").doc(onlineSessionId).delete();
  }

  if (typeof encerrarBeneficiosPedraoUI === "function") encerrarBeneficiosPedraoUI();
  clienteLogado = null;
  localStorage.removeItem("clientePedrao");

  document.getElementById("perfil-nome").value = "";
  document.getElementById("perfil-telefone").value = "";
  document.getElementById("codigo-ativacao").value = "";
  if (document.getElementById("area-perfil")) document.getElementById("area-perfil").innerHTML = "";

  selecionarAvatar("images/avatar1.webp");

  abrirPerfilModo("home");
  limparTelaMensagensCliente();
  alert("Você saiu da conta.");
}
window.addEventListener("load", async () => {
  if (!document.getElementById("perfil-form")) return;

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

    avatarClienteAtual = clienteLogado.avatar || "images/avatar1.webp";

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

      selecionarAvatar(clienteLogado.avatar || "images/avatar1.webp");
    }
  }

  if (modo === "logado") {
    logado.style.display = "block";
  }
}

function atualizarTelaClienteLogado() {
  if (!clienteLogado) return;
  if (typeof acompanharBeneficiosClientePedraoUI === "function")
    acompanharBeneficiosClientePedraoUI(clienteLogado, (atual) => {
      if (!clienteLogado || clienteLogado.telefone !== atual.telefone) return;
      const mudou =
        clienteLogado.nivelCliente !== atual.nivelCliente ||
        clienteLogado.fidelidadeAtiva !== atual.fidelidadeAtiva;
      clienteLogado = { ...clienteLogado, ...atual };
      if (mudou) atualizarTelaClienteLogado();
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
    clienteLogado.avatar || "images/avatar1.webp";
  if (typeof aplicarAvatarClienteUI === "function")
    aplicarAvatarClienteUI(document.getElementById("perfil-logado-avatar"), clienteLogado);

  const ativo = clienteLogado.fidelidadeAtiva;

  const status = document.getElementById("perfil-status-cda");

  status.innerText = ativo ? "Ativado" : "Desativado";

  status.className = ativo ? "status-cda ativo" : "status-cda inativo";

  const btnBonus = document.getElementById("btn-bonus-perfil");

  const nivelEl = document.getElementById("perfil-dado-nivel");

  const linhaNivel = nivelEl.parentElement;

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
  consultaMensagensUI++;
  if (window.listenerChamadoCliente) window.listenerChamadoCliente();
  window.listenerChamadoCliente = null;
  document.getElementById("modal-mensagens").style.display = "none";
}

async function abrirAbaMensagens(tipo) {
  const consulta = ++consultaMensagensUI;
  abaMensagemAtual = tipo;

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

function etapaSuporteCliente(etapa = "inicio") {
  if (etapa !== "chat") consultaMensagensUI++;
  if (etapa !== "chat" && window.listenerChamadoCliente) {
    window.listenerChamadoCliente();
    window.listenerChamadoCliente = null;
  }
  document.getElementById("lista-chamados-cliente").style.display =
    etapa === "lista" ? "block" : "none";
  document.getElementById("suporte-menu").style.display = etapa === "inicio" ? "grid" : "none";
  document.getElementById("form-novo-chamado").style.display = etapa === "novo" ? "grid" : "none";
  document.getElementById("chat-chamado-cliente").style.display =
    etapa === "chat" ? "block" : "none";
  if (etapa === "lista")
    listarChamadosCliente().catch(() => {
      document.getElementById("lista-chamados-cliente").innerHTML =
        '<p>Não foi possível buscar seus suportes.</p><button onclick="etapaSuporteCliente(\'lista\')">Tentar novamente</button><button onclick="etapaSuporteCliente()">Voltar</button>';
    });
}
function abrirFormNovoChamado() {
  etapaSuporteCliente("novo");
}

async function listarChamadosCliente() {
  if (!clienteLogado) return;

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

  if (snap.empty) {
    box.innerHTML = `<button onclick="etapaSuporteCliente()">← Voltar</button><p>Nenhum suporte aberto.</p>`;
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

  let html =
    '<button type="button" onclick="etapaSuporteCliente()">← Voltar</button><h3>Suportes abertos</h3><div class="suporte-categorias">';
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

  box.innerHTML = html + "</div>";
}
function filtrarSuportesCliente(tipo) {
  document.getElementById("suporte-blocos").hidden = false;
  document.querySelectorAll("#suporte-blocos .card-chamado-cliente").forEach((card) => {
    card.hidden = card.dataset.categoria !== tipo;
  });
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

  await listarChamadosCliente();

  abrirChamadoCliente(chamadoRef.id);
}

window.abrirChamadoCliente = async function (chamadoId) {
  const consulta = ++consultaMensagensUI;
  const mesmoChamado = chamadoClienteAbertoId === chamadoId;

  chamadoClienteAbertoId = chamadoId;

  const chat = document.getElementById("chat-chamado-cliente");
  const form = document.getElementById("form-novo-chamado");

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
        '<button onclick="etapaSuporteCliente()">← Voltar</button><p>Não foi possível abrir a conversa. Confira sua conexão e tente novamente.</p>';
    return;
  }
  if (consulta !== consultaMensagensUI) return;
  const chamado = chamadoDoc.data();
  if (!chamado) {
    chat.innerHTML =
      '<p>Este suporte não está mais disponível.</p><button onclick="etapaSuporteCliente()">Voltar</button>';
    return;
  }

  window.listenerChamadoCliente = chamadoRef
    .collection("mensagens")
    .orderBy("data")
    .onSnapshot(
      async (snapshot) => {
        if (consulta !== consultaMensagensUI) return;
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

        let html = `<h3>Conversa do suporte</h3>`;

        mensagens.forEach((m) => {
          const ehCliente = m.remetente === "cliente";

          html += `
                    <div class="linha-msg ${ehCliente ? "linha-cliente" : "linha-admin"}">
                        <img
                            src="${ehCliente ? clienteLogado.avatar || "images/avatar1.webp" : "images/personagens-pedrao/ui/mago-tranquilo.webp"}"
                            class="avatar-msg"
                            alt="${ehCliente ? "Você" : "Pedrão Lanches"}"
                        >

                        <div class="msg-chat ${ehCliente ? "msg-cliente" : "msg-admin"}">
                            <strong>${ehCliente ? "Você" : "Pedrão Lanches"}</strong>
                            <p>${escaparOperacao(m.texto)}</p>
                            <small>${new Date(m.data).toLocaleString("pt-BR")}</small>
                        </div>
                    </div>
                `;
        });

        if (chamado.status !== "finalizado") {
          html += `
                    <div class="suporte-compositor">
                      <textarea id="resposta-chamado-cliente" aria-label="Mensagem" placeholder="Continuar conversa..."></textarea>
                      <button type="button" aria-label="Enviar mensagem" onclick="enviarMensagemChamadoCliente()">➤</button>
                    </div>
                    <div class="acoes-chat-cliente"><button type="button" onclick="finalizarChamadoCliente('${chamadoId}')">Encerrar chat</button></div>
                `;
        } else {
          html += `<p><strong>Este suporte foi finalizado.</strong></p>`;
        }

        const campoAtual = chat.querySelector("textarea");
        const textoAtual = campoAtual ? campoAtual.value : rascunho;
        chat.innerHTML =
          `<button type="button" onclick="etapaSuporteCliente()">← Voltar</button>` + html;
        const campoNovo = chat.querySelector("textarea");
        if (campoNovo) campoNovo.value = textoAtual;

        const modal = document.querySelector("#modal-mensagens .conteudo-carrinho");

        if (modal) {
          modal.scrollTop = modal.scrollHeight;
        }
      },
      () => {
        if (consulta === consultaMensagensUI)
          chat.innerHTML =
            '<button onclick="etapaSuporteCliente()">← Voltar</button><p>Não foi possível atualizar a conversa. Confira sua conexão e abra novamente.</p>';
      },
    );
};

function retomarMensagensClienteUI() {
  if (document.hidden || !clienteLogado) return;
  const modal = document.getElementById("modal-mensagens");
  if (!modal || modal.style.display !== "flex") return;
  if (abaMensagemAtual !== "suporte") abrirAbaMensagens(abaMensagemAtual);
  else if (
    document.getElementById("chat-chamado-cliente").style.display === "block" &&
    chamadoClienteAbertoId
  )
    abrirChamadoCliente(chamadoClienteAbertoId);
  else if (document.getElementById("lista-chamados-cliente").style.display === "block")
    etapaSuporteCliente("lista");
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
  const texto = document.getElementById("resposta-chamado-cliente").value.trim();

  if (!texto) return alert("Digite uma mensagem.");
  if (!chamadoClienteAbertoId) return alert("Abra um suporte primeiro.");

  const chamadoRef = db
    .collection("clientes")
    .doc(clienteLogado.telefone)
    .collection("chamados")
    .doc(chamadoClienteAbertoId);

  const chamadoDoc = await chamadoRef.get();
  const chamado = chamadoDoc.data();

  if (!chamado || chamado.status === "finalizado") {
    alert("Este suporte já foi finalizado. Abra um novo suporte se precisar.");
    listarChamadosCliente();
    etapaSuporteCliente();
    return;
  }

  await chamadoRef.collection("mensagens").add({
    texto,
    remetente: "cliente",
    data: new Date().toISOString(),
    lida: false,
  });

  await chamadoRef.update({
    atualizadoEm: new Date().toISOString(),
  });

  abrirChamadoCliente(chamadoClienteAbertoId);
}

async function finalizarChamadoCliente(chamadoId) {
  if (
    !(await dialogoOperacao("Deseja encerrar este chat?", null, true, { botao: "Encerrar chat" }))
  )
    return;

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
  etapaSuporteCliente();

  document.getElementById("chat-chamado-cliente").style.display = "none";

  document.getElementById("form-novo-chamado").style.display = "none";
  document.getElementById("chat-chamado-cliente").style.display = "none";

  listarChamadosCliente();
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
        const snap = await db
          .collection(colecao)
          .where("clienteId", "==", clienteLogado.telefone)
          .get();
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
  const dadosOnline = {
    sessionId: onlineSessionId,

    nome: clienteLogado?.nome || "Sem cadastro",

    telefone: clienteLogado?.telefone || "",

    avatar: clienteLogado?.avatar || "images/avatar1.webp",

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

  for (let i = 1; i <= qtdDireitos; i++) {
    const molhoSalvo = item.molhosGratis?.find((m) => Number(m.unidade) === i);
    const tipoSalvo = molhoSalvo?.tipo || "semmolho";

    blocos += `
            <div class="bloco-molho-item">

               <h4>
    ${
      String(item.categoria || "")
        .toLowerCase()
        .includes("combo")
        ? `${i}º Lanche`
        : `${item.nome} #${i}`
    }
</h4>

            <div class="opcoes-tipo-molho">

    <label class="radio-molho">
        <input
            type="radio"
            name="tipo-molho-${i}"
            value="semmolho"
            ${tipoSalvo === "semmolho" ? "checked" : ""}
        >
        Sem molho
    </label>

    <label class="radio-molho">
        <input
            type="radio"
            name="tipo-molho-${i}"
            value="umdecada"
            ${tipoSalvo === "umdecada" ? "checked" : ""}
        >
        1 de cada escolhido
    </label>

    <label class="radio-molho">
        <input
            type="radio"
            name="tipo-molho-${i}"
            value="doisiguais"
            ${tipoSalvo === "doisiguais" ? "checked" : ""}
        >
        2 iguais
    </label>

</div>
<div id="opcoes-molho-${i}" class="opcoes-molho-unidade"></div>

</div>
        `;
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
        <button onclick="salvarMolhosItem()">
            Salvar molhos
        </button>
    `;

  document.getElementById("modal-molhos").style.display = "flex";

  configurarEventosMolhoPorUnidade(qtdDireitos);
}
function toggleAreaMolhosPagos() {
  const area = document.getElementById("area-molhos-pagos");
  if (!area) return;

  area.style.display =
    area.style.display === "none" || area.style.display === "" ? "block" : "none";
}
function salvarMolhosItem() {
  const item = carrinho[indiceMolhoAtual];

  if (!item) return alert("Item não encontrado.");

  let qtd = Number(item.qtd) || 1;

  const categoriaItem = String(item.categoria || "").toLowerCase();

  if (categoriaItem.includes("combo")) {
    qtd = Number(item.comboQtdLanches) || 1;
  }
  let molhosGratis = [];

  for (let i = 1; i <= qtd; i++) {
    const tipo = document.querySelector(`input[name="tipo-molho-${i}"]:checked`)?.value;

    if (tipo === "semmolho") {
      molhosGratis.push({
        unidade: i,
        tipo: "semmolho",
        texto: "Sem molho",
      });
    } else if (tipo === "umdecada") {
      const escolhidos = [];

      document.querySelectorAll(`.molho-um-${i}:checked`).forEach((check) => {
        escolhidos.push(check.value);
      });

      molhosGratis.push({
        unidade: i,
        tipo: "umdecada",
        molhos: escolhidos,
        texto: escolhidos.length ? escolhidos.join(" + ") : "Sem molho",
      });
    } else if (tipo === "doisiguais") {
      const molho = document.querySelector(`input[name="molho-dois-${i}"]:checked`)?.value || "";

      molhosGratis.push({
        unidade: i,
        tipo: "doisiguais",
        molho,
        texto: molho ? `2 ${molho}` : "Sem molho",
      });
    }
  }
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

  fecharModalMolhos();

  exibirRevisao(
    dadosPedidoTemporario.itens,
    dadosPedidoTemporario.subtotal,
    dadosPedidoTemporario.taxa,
    dadosPedidoTemporario.tipo,
    dadosPedidoTemporario.obs,
    dadosPedidoTemporario.mapa,
    dadosPedidoTemporario.km,
    dadosPedidoTemporario.foraDaArea,
  );
}

function fecharModalMolhos() {
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

function configurarEventosMolhoPorUnidade(qtd) {
  for (let i = 1; i <= qtd; i++) {
    document.querySelectorAll(`input[name="tipo-molho-${i}"]`).forEach((radio) => {
      radio.addEventListener("change", () => {
        renderizarOpcoesMolhoUnidade(i);
      });
    });

    renderizarOpcoesMolhoUnidade(i);
  }
}

function renderizarOpcoesMolhoUnidade(i) {
  const item = carrinho[indiceMolhoAtual];
  const molhoSalvo = item?.molhosGratis?.find((m) => Number(m.unidade) === i);

  const tipo = document.querySelector(`input[name="tipo-molho-${i}"]:checked`)?.value;

  const box = document.getElementById(`opcoes-molho-${i}`);
  if (!box) return;

  if (tipo === "semmolho") {
    box.innerHTML = `<p>Sem molho neste item.</p>`;
  } else if (tipo === "umdecada") {
    const salvos = molhoSalvo?.molhos || [];

    box.innerHTML = `
            <label><input type="checkbox" class="molho-um-${i}" value="Maionese" ${salvos.includes("Maionese") ? "checked" : ""}> Maionese</label>
            <label><input type="checkbox" class="molho-um-${i}" value="Ketchup" ${salvos.includes("Ketchup") ? "checked" : ""}> Ketchup</label>
            <label><input type="checkbox" class="molho-um-${i}" value="Mostarda" ${salvos.includes("Mostarda") ? "checked" : ""}> Mostarda</label>
            <label><input type="checkbox" class="molho-um-${i}" value="Barbecue" ${salvos.includes("Barbecue") ? "checked" : ""}> Barbecue</label>
        `;
  } else if (tipo === "doisiguais") {
    const molho = molhoSalvo?.molho || "Maionese";

    box.innerHTML = `
            <label><input type="radio" name="molho-dois-${i}" value="Maionese" ${molho === "Maionese" ? "checked" : ""}> 2 Maionese</label>
            <label><input type="radio" name="molho-dois-${i}" value="Ketchup" ${molho === "Ketchup" ? "checked" : ""}> 2 Ketchup</label>
            <label><input type="radio" name="molho-dois-${i}" value="Mostarda" ${molho === "Mostarda" ? "checked" : ""}> 2 Mostarda</label>
            <label><input type="radio" name="molho-dois-${i}" value="Barbecue" ${molho === "Barbecue" ? "checked" : ""}> 2 Barbecue</label>
        `;
  }
}
function calcularTotalMolhosPagos() {
  let total = 0;

  carrinho.forEach((item) => {
    total += Number(item.totalMolhosPagos || 0);
  });

  return total;
}
