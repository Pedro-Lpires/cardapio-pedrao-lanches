/**
 * Autoatendimento da mesa: sessão, cardápio, personalizações, carrinho e vínculo do cliente. A fila da cozinha é gravada com o pedido.
 *
 * Organização e caminhos: consulte GUIA-DO-CODIGO.md.
 */
// =====================================================
// FIREBASE
// =====================================================

const firebaseConfigAutoatendimento = {
  apiKey: "AIzaSyD2ZQbBk5zTlkwh91cQ3HF-ZBpXzFE3IQk",

  authDomain: "pedrao-lanches.firebaseapp.com",

  projectId: "pedrao-lanches",

  storageBucket: "pedrao-lanches.firebasestorage.app",

  messagingSenderId: "642954187872",

  appId: "1:642954187872:web:38efbecf53357e57b0df05",
};

firebase.initializeApp(firebaseConfigAutoatendimento);

const db = firebase.firestore();

// =====================================================
// ESTADO DO AUTOATENDIMENTO
// =====================================================

let mesaAutoatendimentoAtual = null;

let mesaAutoatendimentoId = null;

let sessaoAutoatendimentoAtual = null;

let produtosAutoatendimento = [];
let adicionaisAutoatendimento = [];

let produtoAutoAtual = null;

let quantidadeProdutoAuto = 1;

let adicionaisAutoSelecionados = {};

let carrinhoAutoatendimento = [];
let indiceItemAutoEmEdicao = null;

let voltarResumoDepoisEdicaoAuto = false;

let comboAutoAtual = null;

let quantidadeComboAuto = 1;

let modoPersonalizacaoComboAuto = "padrao";

let configuracaoTodosComboAuto = null;

let configuracoesLanchesComboAuto = {};

const CHAVE_SESSAO_AUTOATENDIMENTO = "sessaoAutoatendimentoId";

function obterJanelaDiaOperacional() {
  const agora = new Date();

  let inicio;
  let fim;

  // =========================
  // ANTES DAS 2H
  // AINDA É O DIA ANTERIOR
  // =========================

  if (agora.getHours() < 2) {
    inicio = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() - 1, 2, 0, 0, 0);

    fim = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 2, 0, 0, 0);
  }

  // =========================
  // A PARTIR DAS 2H
  // NOVO DIA OPERACIONAL
  // =========================
  else {
    inicio = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 2, 0, 0, 0);

    fim = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() + 1, 2, 0, 0, 0);
  }

  return {
    inicioMs: inicio.getTime(),

    fimMs: fim.getTime(),
  };
}

function obterNumeroMesaDaUrl() {
  const parametros = new URLSearchParams(window.location.search);

  const mesa = Number(parametros.get("mesa"));

  if (!Number.isInteger(mesa) || mesa <= 0) {
    return null;
  }

  return mesa;
}

async function iniciarAutoatendimento() {
  const area = document.getElementById("area-autoatendimento");

  if (!area) {
    return;
  }
  area.innerHTML = htmlCarregandoUI("Abrindo sua mesa…");

  // =========================
  // PEGAR MESA DA URL
  // =========================

  const numeroMesa = obterNumeroMesaDaUrl();

  if (!numeroMesa) {
    area.innerHTML = `
      <div class="auto-estado-qr">
        <section class="auto-aviso-qr" aria-labelledby="auto-aviso-qr-titulo">
          <span class="auto-aviso-qr-icone" aria-hidden="true">📱</span>
          <h2 id="auto-aviso-qr-titulo">Não identificamos sua mesa</h2>
          <p>Escaneie o QR Code disponível na mesa para abrir o cardápio e fazer seu pedido.</p>
          <p class="auto-aviso-qr-ajuda">Se precisar, peça ajuda ao atendente.</p>
        </section>
      </div>
        `;

    return;
  }

  // =========================
  // BUSCAR MESA
  // =========================

  const snapMesa = await lerComPrazoUI(
    db.collection("mesas").where("numero", "==", numeroMesa).limit(1).get(),
  );
  let docMesa = snapMesa.docs[0];
  // As mesmas vinte mesas da grade do atendente, cadastradas no primeiro uso.
  if (!docMesa && numeroMesa <= 20) {
    const ref = db.collection("mesas").doc("mesa-" + numeroMesa);
    await db.runTransaction(async (transacao) => {
      const existente = await transacao.get(ref);
      if (!existente.exists) transacao.set(ref, { numero: numeroMesa, ocupada: false });
    });
    docMesa = await lerComPrazoUI(ref.get());
  }

  if (!docMesa) {
    area.innerHTML = `

            <h2>
                ⚠️ Mesa não encontrada
            </h2>


            <p>
                Mesa ${numeroMesa}
                não está cadastrada.
            </p>

        `;

    return;
  }

  mesaAutoatendimentoId = docMesa.id;

  mesaAutoatendimentoAtual = {
    id: docMesa.id,

    ...docMesa.data(),
  };

  // =========================
  // PROCURAR SESSÃO DO CELULAR
  // =========================

  const sessaoRecuperada = await recuperarSessaoAutoatendimento();

  if (sessaoRecuperada) {
    sessaoAutoatendimentoAtual = sessaoRecuperada;

    await mostrarSessaoAutoatendimento();

    return;
  }

  // =========================
  // SEM SESSÃO
  // MESA JÁ ESTÁ OCUPADA
  // =========================

  if (mesaAutoatendimentoAtual.ocupada === true) {
    mostrarMesaBloqueadaAutoatendimento();

    return;
  }

  // =========================
  // MESA LIVRE
  // PEDIR NOME
  // =========================

  mostrarIdentificacaoAutoatendimento();
}
async function recuperarSessaoAutoatendimento() {
  const sessaoId = localStorage.getItem(CHAVE_SESSAO_AUTOATENDIMENTO);

  if (!sessaoId) {
    return null;
  }

  try {
    const docSessao = await db.collection("sessoesMesa").doc(sessaoId).get();

    // =========================
    // NÃO EXISTE MAIS
    // =========================

    if (!docSessao.exists) {
      localStorage.removeItem(CHAVE_SESSAO_AUTOATENDIMENTO);

      return null;
    }

    const sessao = docSessao.data();

    // =========================
    // SESSÃO ENCERRADA
    // =========================

    if (sessao.status !== "ativa") {
      localStorage.removeItem(CHAVE_SESSAO_AUTOATENDIMENTO);

      return null;
    }

    // =========================
    // SESSÃO É DE OUTRA MESA
    // =========================

    if (sessao.mesaId !== mesaAutoatendimentoId) {
      return null;
    }
    // =====================================================
    // SE JÁ ENVIOU PEDIDO,
    // A COMANDA PRECISA CONTINUAR ABERTA
    // =====================================================

    if (sessao.pedidoEnviado === true) {
      const comandaId = sessao.comandaId;

      // =========================
      // NÃO TEM COMANDA VINCULADA
      // =========================

      if (!comandaId) {
        await docSessao.ref.update({
          status: "encerrada",

          motivoEncerramento: "comanda_inexistente",

          encerradaEm: new Date().toISOString(),

          encerradaEmMs: Date.now(),
        });

        localStorage.removeItem(CHAVE_SESSAO_AUTOATENDIMENTO);

        return null;
      }

      // =========================
      // VERIFICAR COMANDA
      // =========================

      const docComanda = await db.collection("comandas").doc(comandaId).get();

      // =========================
      // COMANDA FOI EXCLUÍDA
      // =========================

      if (!docComanda.exists) {
        await docSessao.ref.update({
          status: "encerrada",

          motivoEncerramento: "comanda_excluida",

          encerradaEm: new Date().toISOString(),

          encerradaEmMs: Date.now(),
        });

        localStorage.removeItem(CHAVE_SESSAO_AUTOATENDIMENTO);

        return null;
      }

      const comanda = docComanda.data();

      // =========================
      // COMANDA NÃO ESTÁ MAIS ABERTA
      // =========================

      if (comanda.status !== "Aberta") {
        await docSessao.ref.update({
          status: "encerrada",

          motivoEncerramento: "comanda_finalizada",

          encerradaEm: new Date().toISOString(),

          encerradaEmMs: Date.now(),
        });

        localStorage.removeItem(CHAVE_SESSAO_AUTOATENDIMENTO);

        return null;
      }
    }

    // =========================
    // VALIDAR DIA OPERACIONAL
    // =========================

    const janela = obterJanelaDiaOperacional();

    const criadoEmMs = Number(sessao.criadoEmMs || 0);

    if (criadoEmMs < janela.inicioMs || criadoEmMs >= janela.fimMs) {
      // Sessão velha.

      await docSessao.ref.update({
        status: "encerrada",

        motivoEncerramento: "fim_dia_operacional",

        encerradaEm: new Date().toISOString(),

        encerradaEmMs: Date.now(),
      });

      localStorage.removeItem(CHAVE_SESSAO_AUTOATENDIMENTO);

      return null;
    }

    // =========================
    // SESSÃO VÁLIDA
    // =========================

    return {
      id: docSessao.id,

      ...sessao,
    };
  } catch (erro) {
    console.error("Erro ao recuperar sessão:", erro);

    return null;
  }
}
function mostrarIdentificacaoAutoatendimento() {
  const area = document.getElementById("area-autoatendimento");

  if (!area) {
    return;
  }

  area.innerHTML = `

        <div
            style="
                max-width:420px;
                margin:40px auto;
                padding:20px;
                text-align:center;
            "
        >

            <h2>
                🍔 Pedrão Lanches
            </h2>


            <h3>
                Mesa ${mesaAutoatendimentoAtual.numero}
            </h3>


            <p>
                Como podemos te chamar?
            </p>


            <input
                type="text"
                id="nome-autoatendimento"
                maxlength="40"
                placeholder="Seu nome"
                autocomplete="off"
            >


            <br><br>


            <button
                type="button"
                onclick="
                    criarSessaoAutoatendimento()
                "
            >
                Começar pedido
            </button>

        </div>

    `;
}
async function criarSessaoAutoatendimento() {
  const inputNome = document.getElementById("nome-autoatendimento");

  const nome = inputNome?.value.trim() || "";

  if (!nome) {
    alert("Digite seu nome.");

    return;
  }

  if (nome.length < 2) {
    alert("Digite um nome válido.");

    return;
  }

  // =========================
  // CONFERIR MESA NOVAMENTE
  // =========================

  const mesaDoc = await db.collection("mesas").doc(mesaAutoatendimentoId).get();

  if (!mesaDoc.exists) {
    alert("Mesa não encontrada.");

    return;
  }

  const mesaAtualizada = mesaDoc.data();

  // =========================
  // ENTRE ABRIR A TELA E
  // DIGITAR O NOME,
  // A MESA PODE TER SIDO OCUPADA
  // =========================

  if (mesaAtualizada.ocupada === true) {
    mesaAutoatendimentoAtual = {
      id: mesaDoc.id,

      ...mesaAtualizada,
    };

    mostrarMesaBloqueadaAutoatendimento();

    return;
  }

  try {
    const agora = new Date();

    const sessaoRef = await db.collection("sessoesMesa").add({
      mesaId: mesaAutoatendimentoId,

      mesaNumero: Number(mesaAtualizada.numero),

      nome: nome,

      // =========================
      // ESTADO DA SESSÃO
      // =========================

      status: "ativa",

      pedidoEnviado: false,

      comandaId: null,

      // =========================
      // LOGIN
      // DEPOIS VINCULAMOS
      // =========================

      clienteId: null,

      clienteLogado: false,

      // =========================
      // DATAS
      // =========================

      criadoEm: agora.toISOString(),

      criadoEmMs: agora.getTime(),

      atualizadoEm: agora.toISOString(),

      atualizadoEmMs: agora.getTime(),
    });

    // =========================
    // GUARDAR SOMENTE O ID
    // NO CELULAR
    // =========================

    localStorage.setItem(
      CHAVE_SESSAO_AUTOATENDIMENTO,

      sessaoRef.id,
    );

    sessaoAutoatendimentoAtual = {
      id: sessaoRef.id,

      mesaId: mesaAutoatendimentoId,

      mesaNumero: mesaAtualizada.numero,

      nome,

      status: "ativa",

      pedidoEnviado: false,

      comandaId: null,
    };

    await mostrarSessaoAutoatendimento();
  } catch (erro) {
    console.error("Erro ao criar sessão:", erro);

    alert("Não foi possível iniciar o atendimento.");
  }
}
async function mostrarSessaoAutoatendimento() {
  const area = document.getElementById("area-autoatendimento");

  if (!area) {
    return;
  }

  // =========================
  // JÁ ENVIOU O PRIMEIRO PEDIDO
  // =========================

  if (sessaoAutoatendimentoAtual.pedidoEnviado === true) {
    mostrarPosPedidoAutoatendimento();

    return;
  }

  // =========================
  // CARDÁPIO
  // =========================

  area.innerHTML = `

        <div
            style="
                padding-bottom:90px;
            "
        >

           <div
    class="auto-cabecalho"
>

    <div
        class="auto-cabecalho-topo"
    >

        <h2>
            🍔 PEDRÃO LANCHES
        </h2>


        <button
            type="button"
            id="btn-login-auto"
            class="btn-login-auto"
            onclick="
                abrirLoginAutoatendimento()
            "
            title="Minha conta"
        >
            👤
        </button>
        

    </div>


    <p>
        Mesa
        <strong>
            ${sessaoAutoatendimentoAtual.mesaNumero}
        </strong>
    </p>


    <p>
    Olá,
    <strong
        id="nome-sessao-auto"
    >
        ${sessaoAutoatendimentoAtual.nome}
    </strong>
    👋
</p>


    <hr>


   
    <h2>
        Cardápio
    </h2>

</div>
<div
    class="auto-categorias"
>

    <button
        type="button"
        onclick="
            irParaCategoriaAuto(
                'secao-auto-lanches'
            )
        "
    >
        🍔 Lanches
    </button>


    <button
        type="button"
        onclick="
            irParaCategoriaAuto(
                'secao-auto-combos'
            )
        "
    >
        🍔🥤 Combos
    </button>


    <button
        type="button"
        onclick="
            irParaCategoriaAuto(
                'secao-auto-batatas'
            )
        "
    >
        🍟 Batatas
    </button>


    <button
        type="button"
        onclick="
            irParaCategoriaAuto(
                'secao-auto-bebidas'
            )
        "
    >
        🥤 Bebidas
    </button>

</div>


            <!-- ===================== -->
            <!-- LANCHES -->
            <!-- ===================== -->

            <section
                id="secao-auto-lanches"
                style="
                    padding:10px;
                "
            >

                <h2>
                    🍔 Lanches
                </h2>


                <div
    id="lista-auto-lanches"
    class="auto-grid-produtos"
>
                    <p>
                        Carregando...
                    </p>
                </div>

            </section>


            <!-- ===================== -->
            <!-- COMBOS -->
            <!-- ===================== -->

            <section
                id="secao-auto-combos"
                style="
                    padding:10px;
                "
            >

                <h2>
                    🍔🥤 Combos
                </h2>


                <div
                    id="lista-auto-combos"
                    class="auto-grid-produtos"
                ></div>

            </section>


            <!-- ===================== -->
            <!-- BATATAS -->
            <!-- ===================== -->

            <section
                id="secao-auto-batatas"
                style="
                    padding:10px;
                "
            >

                <h2>
                    🍟 Batatas
                </h2>


                <div
                    id="lista-auto-batatas"
                    class="auto-grid-produtos"
                ></div>

            </section>


            <!-- ===================== -->
            <!-- BEBIDAS -->
            <!-- ===================== -->

            <section
                id="secao-auto-bebidas"
                style="
                    padding:10px;
                "
            >

                <h2>
                    🥤 Bebidas
                </h2>


                <div
                    id="lista-auto-bebidas"
                    class="auto-grid-produtos"
                ></div>

            </section>

        </div>


        <!-- ========================= -->
        <!-- FOOTER -->
        <!-- ========================= -->

        <div
            style="
                position:fixed;
                left:0;
                right:0;
                bottom:0;
                display:flex;
                z-index:1000;
                background:#111;
                border-top:1px solid #444;
            "
        >

          <div
    class="auto-footer"
>

    <button
        type="button"
        id="btn-enviar-pedido-auto"
        onclick="
            abrirResumoPedidoAuto()
        "
    >
        🛒 Enviar pedido

        <span
            id="contador-carrinho-auto"
            style="display:none;"
        >
            0
        </span>
    </button>

</div>

    `;
  atualizarIconeLoginAuto();

  await carregarAdicionaisAutoatendimento();
  await carregarCardapioAutoatendimento();
}

async function carregarAdicionaisAutoatendimento() {
  try {
    const snap = await db.collection("adicionais").where("ativo", "==", true).get();

    adicionaisAutoatendimento = [];

    snap.forEach((doc) => {
      const adicional = {
        id: doc.id,

        ...doc.data(),
      };

      if (adicional.esgotado === true) {
        return;
      }

      adicionaisAutoatendimento.push(adicional);
    });

    adicionaisAutoatendimento.sort((a, b) => Number(a.ordem || 999) - Number(b.ordem || 999));
  } catch (erro) {
    console.error("Erro ao carregar adicionais:", erro);
  }
}
async function carregarCardapioAutoatendimento() {
  try {
    const snap = await db.collection("produtos").where("ativo", "==", true).get();

    produtosAutoatendimento = [];

    snap.forEach((doc) => {
      const produto = {
        id: doc.id,

        ...doc.data(),
      };

      // =========================
      // NÃO MOSTRAR ESGOTADO
      // =========================

      if (produto.esgotado === true) {
        return;
      }

      produtosAutoatendimento.push(produto);
    });

    // =========================
    // ORDENAR
    // =========================

    produtosAutoatendimento.sort((a, b) => {
      return Number(a.ordem || 999) - Number(b.ordem || 999);
    });

    // =========================
    // SEPARAR CATEGORIAS
    // =========================

    const lanches = produtosAutoatendimento.filter((produto) => produto.categoria === "lanches");

    const combos = produtosAutoatendimento.filter((produto) => produto.categoria === "combos");

    const batatas = produtosAutoatendimento.filter((produto) => produto.categoria === "batatas");

    const bebidas = produtosAutoatendimento.filter((produto) => produto.categoria === "bebidas");

    renderizarCategoriaAutoatendimento("lista-auto-lanches", lanches);

    renderizarCategoriaAutoatendimento("lista-auto-combos", combos);

    renderizarCategoriaAutoatendimento("lista-auto-batatas", batatas);

    renderizarCategoriaAutoatendimento("lista-auto-bebidas", bebidas);
  } catch (erro) {
    console.error("Erro ao carregar cardápio:", erro);

    const area = document.getElementById("lista-auto-lanches");

    if (area) {
      area.innerHTML = `

                <p>
                    Não foi possível carregar
                    o cardápio.
                </p>

            `;
    }
  }
}

function renderizarCategoriaAutoatendimento(containerId, produtos) {
  const container = document.getElementById(containerId);

  if (!container) {
    return;
  }

  if (produtos.length === 0) {
    container.innerHTML = `

            <p>
                Nenhum produto disponível.
            </p>

        `;

    return;
  }

  container.innerHTML = "";

  produtos.forEach((produto) => {
    const imagem = produto.imagem || produto.img || "lanche.png";

    const descricao = produto.descricao || produto.desc || "";

    const card = document.createElement("div");

    // Mesma classe usada no
    // cardápio do delivery.

    card.classList.add("card");

    card.innerHTML = `

            <div
                class="card-img"
            >

                <img
                    src="${resolverImagemProduto(imagem)}"
                    alt="${produto.nome || ""}"
                    loading="lazy"
                >

            </div>


            <div
                class="card-info"
            >

                <h3>
                    ${produto.nome || "Produto"}
                </h3>


                <p>
                    ${descricao}
                </p>


                <span
                    class="preco"
                >

                    R$ ${Number(produto.preco || 0).toFixed(2)}

                </span>

            </div>

        `;

    card.onclick = () => {
      abrirProdutoAutoatendimento(produto.id);
    };

    container.appendChild(card);
  });
}
function abrirProdutoAutoatendimento(produtoId) {
  const produto = produtosAutoatendimento.find((produto) => produto.id === produtoId);

  if (!produto) {
    alert("Produto não encontrado.");

    return;
  }

  // =========================
  // COMBO
  // FAREMOS NA PRÓXIMA ETAPA
  // =========================

  if (produto.categoria === "combos") {
    abrirComboAutoatendimento(produto);

    return;
  }

  produtoAutoAtual = produto;

  quantidadeProdutoAuto = 1;

  adicionaisAutoSelecionados = {};

  // =========================
  // PREENCHER MODAL
  // =========================

  document.getElementById("modal-img-auto").src = resolverImagemProduto(
    produto.imagem || produto.img || "lanche.png",
  );

  document.getElementById("modal-nome-auto").textContent = produto.nome || "";

  document.getElementById("modal-desc-auto").textContent = produto.descricao || produto.desc || "";

  document.getElementById("qtd-produto-auto").textContent = "1";

  document.getElementById("obs-produto-auto").value = "";

  // =========================
  // TIPO
  // =========================

  montarTiposProdutoAuto(produto);

  // =========================
  // ADICIONAIS
  // =========================

  montarAdicionaisProdutoAuto(produto);

  const listaAdicionais = document.getElementById("lista-adicionais-auto");

  if (listaAdicionais) {
    listaAdicionais.style.display = "none";
  }

  const botaoAdicionais = document.getElementById("btn-toggle-adicionais-auto");

  if (botaoAdicionais) {
    botaoAdicionais.textContent = "Acréscimos";
  }

  // =========================
  // ABRIR
  // =========================

  const modal = document.getElementById("modal-produto-auto");

  modal.style.display = "flex";

  const conteudo = modal.querySelector(".modal-conteudo");

  if (conteudo) {
    conteudo.scrollTop = 0;
  }
}
function abrirComboAutoatendimento(produto) {
  comboAutoAtual = produto;

  quantidadeComboAuto = 1;

  modoPersonalizacaoComboAuto = "padrao";

  configuracaoTodosComboAuto = null;

  configuracoesLanchesComboAuto = {};

  document.getElementById("combo-img-auto").src = resolverImagemProduto(
    produto.imagem || produto.img || "lanche.png",
  );

  document.getElementById("combo-nome-auto").textContent = produto.nome || "";

  document.getElementById("combo-desc-auto").textContent = produto.descricao || produto.desc || "";

  document.getElementById("qtd-combo-auto").textContent = "1";

  document.getElementById("observacao-combo-auto").value = "";

  const preco = Number(produto.preco || 0);

  const precoArea = document.getElementById("combo-preco-auto");

  precoArea.dataset.precoBase = preco;

  precoArea.textContent = `R$ ${preco.toFixed(2)}`;

  montarPersonalizacaoComboAuto();

  document.getElementById("modal-combo-auto").style.display = "flex";
}
function montarPersonalizacaoComboAuto() {
  const area = document.getElementById("personalizacao-combo-auto");

  if (!area || !comboAutoAtual) {
    return;
  }

  const qtdLanches = Number(comboAutoAtual.comboQtdLanches || 0);

  if (qtdLanches <= 0) {
    area.innerHTML = `

            <p>
                Este combo não possui
                lanches personalizáveis.
            </p>

        `;

    return;
  }

  let htmlLanches = "";

  for (let i = 1; i <= qtdLanches; i++) {
    htmlLanches += `

            <div
                class="lanche-combo-auto"
                id="lanche-combo-auto-${i}"
            >

                <strong>
                    Lanche ${i}
                </strong>


                <div
                    id="status-lanche-combo-auto-${i}"
                    class="resumo-combo-auto"
                ></div>


                <button
                    type="button"
                    onclick="
                        abrirConfiguracaoLancheComboAuto(
                            ${i}
                        )
                    "
                >Escolher</button>


                <button
                    type="button"
                    onclick="
                        limparConfiguracaoLancheComboAuto(
                            ${i}
                        )
                    "
                >
                    Limpar
                </button>


                <div
                    id="config-lanche-combo-auto-${i}"
                    class="config-combo-auto"
                ></div>

            </div>

        `;
  }

  area.innerHTML = `

        <hr>


        <h3>Acréscimos</h3>


        <div
            class="combo-modo-auto"
        >

            <button
                type="button"
                onclick="
                    selecionarModoComboAuto(
                        'todos'
                    )
                "
            >
                Todos
            </button>


            <button
                type="button"
                onclick="
                    selecionarModoComboAuto(
                        'individual'
                    )
                "
            >
                Individual
            </button>

        </div>


        <!-- TODOS -->

        <div
            id="modo-todos-combo-auto"
            style="display:none;"
        >


            <div
                id="resumo-todos-combo-auto"
                class="resumo-combo-auto"
            ></div>


            <p>Os acréscimos e a observação serão aplicados em cada lanche.</p>
<div class="acoes-todos-combo-auto"><button type="button" onclick="abrirConfiguracaoTodosComboAuto()">Escolher</button>



            <button
                type="button"
                onclick="
                    limparConfiguracaoTodosComboAuto()
                "
            >
                Limpar
            </button>


            </div>
<div
                id="config-todos-combo-auto"
                class="config-combo-auto"
            ></div>

        </div>


        <!-- INDIVIDUAL -->

        <div
            id="modo-individual-combo-auto"
            style="display:none;"
        >

            ${htmlLanches}

        </div>

    `;
}

function selecionarModoComboAuto(modo, abrirEditor = true) {
  // Recolher a interface não remove a seleção nem muda o modo de cálculo.
  const alvo = document.getElementById(
    modo === "todos" ? "modo-todos-combo-auto" : "modo-individual-combo-auto",
  );
  if (modo !== "padrao" && alvo?.style.display === "block") {
    alvo.style.display = "none";
    return;
  }

  modoPersonalizacaoComboAuto = modo;

  const todos = document.getElementById("modo-todos-combo-auto");

  const individual = document.getElementById("modo-individual-combo-auto");

  if (todos) {
    todos.style.display = modo === "todos" ? "block" : "none";
  }

  if (individual) {
    individual.style.display = modo === "individual" ? "block" : "none";
  }

  atualizarPrecoComboAuto();

  if (modo === "todos" && abrirEditor) abrirConfiguracaoTodosComboAuto();
}

// Abrir as opções não personaliza o combo: só acréscimos com quantidade positiva.
function permitirAcrescimoComboAuto(valor) {
  if (valor > 0 && quantidadeComboAuto > 1) {
    quantidadeComboAuto = 1;
    const campoQuantidade = document.getElementById("qtd-combo-auto");
    if (campoQuantidade) campoQuantidade.textContent = "1";
    alert(
      "Ajustamos a quantidade para 1 combo e aplicamos seu acréscimo. Pode continuar escolhendo!\n\nDepois de adicionar este ao carrinho, adicione os outros combos separadamente.",
    );
  }
  return true;
}

function comboAutoTemAcrescimos() {
  const configuracoes =
    modoPersonalizacaoComboAuto === "todos"
      ? [configuracaoTodosComboAuto]
      : modoPersonalizacaoComboAuto === "individual"
        ? Object.values(configuracoesLanchesComboAuto)
        : [];
  return configuracoes.some((config) =>
    (config?.adicionais || []).some((adicional) => Number(adicional.qtd || 0) > 0),
  );
}

function alterarQtdComboAuto(valor) {
  if (comboAutoTemAcrescimos()) {
    alert(
      "Este combo tem acréscimos e deve ser adicionado uma unidade por vez. Adicione ao carrinho e depois escolha o próximo combo.",
    );

    return;
  }

  quantidadeComboAuto += valor;

  if (quantidadeComboAuto < 1) {
    quantidadeComboAuto = 1;
  }

  document.getElementById("qtd-combo-auto").textContent = quantidadeComboAuto;

  atualizarPrecoComboAuto();
}

function montarAdicionaisProdutoAuto(produto) {
  const box = document.getElementById("box-adicionais-auto");

  const lista = document.getElementById("lista-adicionais-auto");

  if (!box || !lista) {
    return;
  }

  lista.innerHTML = "";

  adicionaisAutoSelecionados = {};
  if (typeof atualizarResumoAdicionaisProdutoUI === "function")
    atualizarResumoAdicionaisProdutoUI("lista-adicionais-auto");

  // =========================
  // BEBIDA
  // =========================

  if (produto.categoria === "bebidas") {
    box.style.display = "none";

    return;
  }

  // =========================
  // PRODUTO NÃO PERMITE
  // =========================

  if (produto.permiteAdicionais === false) {
    box.style.display = "none";

    return;
  }

  let listaAdicionais = [...adicionaisAutoatendimento];

  // =========================
  // BATATA
  // SOMENTE CHEDDAR
  // =========================

  if (produto.categoria === "batatas") {
    listaAdicionais = listaAdicionais.filter((adicional) =>
      String(adicional.nome || "")
        .toLowerCase()
        .includes("cheddar"),
    );
  }

  // =========================
  // ADICIONAIS SELECIONADOS
  // PELO ADM
  // =========================
  else if (produto.modoAdicional === "selecionar") {
    listaAdicionais = listaAdicionais.filter((adicional) =>
      (produto.adicionaisPermitidos || []).includes(adicional.id),
    );
  }

  if (listaAdicionais.length === 0) {
    box.style.display = "none";

    return;
  }

  box.style.display = "block";

  listaAdicionais.forEach((adicional, index) => {
    adicionaisAutoSelecionados[index] = {
      id: adicional.id,

      nome: adicional.nome,

      preco: Number(adicional.preco || 0),

      qtd: 0,
    };

    lista.innerHTML += `

                <div
                    class="item-adicional adicional-combo-auto"
                >

                    <div class="info-adicional-combo-auto">

                        <strong>
                            ${adicional.nome}
                        </strong>

                        <span>
                            R$
                            ${Number(adicional.preco || 0).toFixed(2)}
                        </span>

                    </div>


                    <div
                        class="controle-adicional controle-adicional-combo-auto"
                    >

                        <button
                            type="button"
                            onclick="
                                alterarAdicionalAuto(
                                    ${index},
                                    -1
                                )
                            "
                        >
                            -
                        </button>


                        <span
                            id="qtd-adicional-auto-${index}"
                        >
                            0
                        </span>


                        <button
                            type="button"
                            onclick="
                                alterarAdicionalAuto(
                                    ${index},
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
  if (typeof atualizarResumoAdicionaisProdutoUI === "function")
    atualizarResumoAdicionaisProdutoUI("lista-adicionais-auto");
}
function toggleAdicionaisAutoatendimento() {
  const lista = document.getElementById("lista-adicionais-auto");

  const botao = document.getElementById("btn-toggle-adicionais-auto");

  if (!lista || !botao) {
    return;
  }

  if (lista.style.display === "none") {
    lista.style.display = "block";

    botao.textContent = "Acréscimos";
  } else {
    lista.style.display = "none";

    botao.textContent = "Acréscimos";
  }
}
function abrirConfiguracaoTodosComboAuto() {
  const area = document.getElementById("config-todos-combo-auto");

  if (!area) {
    return;
  }

  area.style.display = "block";

  let html = `

        <button
            type="button"
            class="btn-fechar-modal-auto"
            onclick="
                fecharConfiguracaoTodosComboAuto()
            "
        >
            ×
        </button>


        <h3>
            Todos os lanches
        </h3>


        <p>
            Os acréscimos serão aplicados
            em cada lanche.
        </p>

    `;

  adicionaisAutoatendimento.forEach((adicional) => {
    const salvo = configuracaoTodosComboAuto?.adicionais?.find((item) => item.id === adicional.id);

    const qtd = Number(salvo?.qtd || 0);

    html += `

                    <div
                        class="
                            adicional-combo-auto
                            adicional-todos-auto
                        "
                        data-id="${adicional.id}"
                        data-nome="${adicional.nome}"
                        data-preco="${Number(adicional.preco || 0)}"
                    >

                        <div class="info-adicional-combo-auto">
 <strong>${adicional.nome}</strong>
 <span>R$ ${Number(adicional.preco || 0).toFixed(2)}</span>
 </div>

                        <div class="controle-adicional-combo-auto">


                        <button
                            type="button"
                            onclick="
                                alterarAdicionalTodosComboAuto(
                                    '${adicional.id}',
                                    -1
                                )
                            "
                        >
                            -
                        </button>


                        <span
    id="qtd-todos-combo-auto-${adicional.id}"
>
    ${qtd}
</span>


                        <button
                            type="button"
                            onclick="
                                alterarAdicionalTodosComboAuto(
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

  html += `<label class="combo-observacao-ui">Observação<textarea id="obs-todos-combo-auto" oninput="sincronizarConfiguracaoTodosComboAuto()" placeholder="Ex.: sem cebola">${configuracaoTodosComboAuto?.observacao ?? ""}</textarea></label>`;
  area.innerHTML = html;
}

function alterarQtdProdutoAuto(valor) {
  quantidadeProdutoAuto += valor;

  if (quantidadeProdutoAuto < 1) {
    quantidadeProdutoAuto = 1;
  }

  document.getElementById("qtd-produto-auto").textContent = quantidadeProdutoAuto;
}

function alterarAdicionalAuto(index, valor) {
  const adicional = adicionaisAutoSelecionados[index];

  if (!adicional) {
    return;
  }

  adicional.qtd += valor;

  if (adicional.qtd < 0) {
    adicional.qtd = 0;
  }

  document.getElementById(`qtd-adicional-auto-${index}`).textContent = adicional.qtd;
}

function alterarAdicionalTodosComboAuto(adicionalId, valor) {
  if (!permitirAcrescimoComboAuto(valor)) return;
  const span = document.getElementById(`qtd-todos-combo-auto-${adicionalId}`);

  if (!span) {
    return;
  }

  let qtd = Number(span.textContent || 0);

  qtd += valor;

  if (qtd < 0) {
    qtd = 0;
  }

  span.textContent = qtd;

  sincronizarConfiguracaoTodosComboAuto();
}

// Aplica cada alteração imediatamente, preservando a seleção ao fechar.
function sincronizarConfiguracaoTodosComboAuto() {
  const adicionais = [];

  document.querySelectorAll(".adicional-todos-auto").forEach((elemento) => {
    const id = elemento.dataset.id;

    const qtd = Number(document.getElementById(`qtd-todos-combo-auto-${id}`)?.textContent || 0);

    if (qtd <= 0) {
      return;
    }

    adicionais.push({
      id,

      nome: elemento.dataset.nome,

      preco: Number(elemento.dataset.preco || 0),

      qtd,
    });
  });

  // Preserva observações de combos antigos; novos usam o campo geral do combo.
  const observacao =
    document.getElementById("obs-todos-combo-auto")?.value?.trim() ??
    configuracaoTodosComboAuto?.observacao ??
    "";

  configuracaoTodosComboAuto = {
    adicionais,

    observacao,
  };

  atualizarResumoTodosComboAuto();

  atualizarPrecoComboAuto();
}
function atualizarResumoTodosComboAuto() {
  const area = document.getElementById("resumo-todos-combo-auto");

  if (!area) {
    return;
  }

  if (
    !configuracaoTodosComboAuto ||
    ((configuracaoTodosComboAuto.adicionais || []).length === 0 &&
      !configuracaoTodosComboAuto.observacao)
  ) {
    area.innerHTML = "";

    return;
  }

  const partes = [];

  (configuracaoTodosComboAuto.adicionais || []).forEach((adicional) => {
    partes.push(`+ ${adicional.qtd} ${adicional.nome}`);
  });

  if (configuracaoTodosComboAuto.observacao) {
    partes.push(`Obs: ${configuracaoTodosComboAuto.observacao}`);
  }

  area.innerHTML = partes.join("<br>");
}
function fecharConfiguracaoTodosComboAuto() {
  const area = document.getElementById("config-todos-combo-auto");

  if (area) {
    area.style.display = "none";
  }
}

function limparConfiguracaoTodosComboAuto() {
  configuracaoTodosComboAuto = null;

  atualizarResumoTodosComboAuto();

  atualizarPrecoComboAuto();
}
function abrirConfiguracaoLancheComboAuto(numeroLanche) {
  const area = document.getElementById(`config-lanche-combo-auto-${numeroLanche}`);

  if (!area) {
    return;
  }

  if (area.style.display === "block") {
    fecharConfiguracaoLancheComboAuto(numeroLanche);
    return;
  }

  area.style.display = "block";

  const configuracaoAtual = configuracoesLanchesComboAuto[numeroLanche] || {
    adicionais: [],

    observacao: "",
  };

  let html = `

        <button
            type="button"
            class="btn-fechar-modal-auto"
            onclick="
                fecharConfiguracaoLancheComboAuto(
                    ${numeroLanche}
                )
            "
        >
            ×
        </button>


        <h3>
            Lanche ${numeroLanche}
        </h3>

    `;

  adicionaisAutoatendimento.forEach((adicional) => {
    const salvo = configuracaoAtual.adicionais.find((item) => item.id === adicional.id);

    const qtd = Number(salvo?.qtd || 0);

    html += `

                <div
                    class="
                        adicional-combo-auto
                        adicional-individual-auto-${numeroLanche}
                    "
                    data-id="${adicional.id}"
                    data-nome="${adicional.nome}"
                    data-preco="${Number(adicional.preco || 0)}"
                >

                    <div class="info-adicional-combo-auto">
 <strong>${adicional.nome}</strong>
 <span>R$ ${Number(adicional.preco || 0).toFixed(2)}</span>
 </div>

                    <div class="controle-adicional-combo-auto">


                    <button
                        type="button"
                        onclick="
                            alterarAdicionalLancheComboAuto(
                                ${numeroLanche},
                                '${adicional.id}',
                                -1
                            )
                        "
                    >
                        -
                    </button>


                  <span
    id="qtd-lanche-combo-auto-${numeroLanche}-${adicional.id}"
>
    ${qtd}
</span>


                    <button
                        type="button"
                        onclick="
                            alterarAdicionalLancheComboAuto(
                                ${numeroLanche},
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

  html += `

        <textarea
            id="obs-lanche-combo-auto-${numeroLanche}"
            placeholder="Ex: sem tomate..."
            oninput="sincronizarConfiguracaoLancheComboAuto(${numeroLanche})"
        >${configuracaoAtual.observacao || ""}</textarea>

    `;

  area.innerHTML = html;
}
function alterarAdicionalLancheComboAuto(numeroLanche, adicionalId, valor) {
  if (!permitirAcrescimoComboAuto(valor)) return;
  const span = document.getElementById(`qtd-lanche-combo-auto-${numeroLanche}-${adicionalId}`);

  if (!span) {
    return;
  }

  let qtd = Number(span.textContent || 0);

  qtd += valor;

  if (qtd < 0) {
    qtd = 0;
  }

  span.textContent = qtd;

  sincronizarConfiguracaoLancheComboAuto(numeroLanche);
}
// Aplica cada alteração imediatamente, preservando a seleção ao fechar.
function sincronizarConfiguracaoLancheComboAuto(numeroLanche) {
  const adicionais = [];

  document.querySelectorAll(`.adicional-individual-auto-${numeroLanche}`).forEach((elemento) => {
    const id = elemento.dataset.id;

    const qtd = Number(
      document.getElementById(`qtd-lanche-combo-auto-${numeroLanche}-${id}`)?.textContent || 0,
    );

    if (qtd <= 0) {
      return;
    }

    adicionais.push({
      id,

      nome: elemento.dataset.nome,

      preco: Number(elemento.dataset.preco || 0),

      qtd,
    });
  });

  const observacao =
    document.getElementById(`obs-lanche-combo-auto-${numeroLanche}`)?.value.trim() || "";

  if (adicionais.length === 0 && !observacao) {
    delete configuracoesLanchesComboAuto[numeroLanche];
  } else {
    configuracoesLanchesComboAuto[numeroLanche] = {
      adicionais,

      observacao,
    };
  }

  atualizarStatusLancheComboAuto(numeroLanche);

  atualizarPrecoComboAuto();
}
function atualizarStatusLancheComboAuto(numeroLanche) {
  const area = document.getElementById(`status-lanche-combo-auto-${numeroLanche}`);

  if (!area) {
    return;
  }

  const config = configuracoesLanchesComboAuto[numeroLanche];

  if (!config) {
    area.innerHTML = "Padrão";

    return;
  }

  const partes = [];

  (config.adicionais || []).forEach((adicional) => {
    partes.push(`+ ${adicional.qtd} ${adicional.nome}`);
  });

  if (config.observacao) {
    partes.push(`Obs: ${config.observacao}`);
  }

  area.innerHTML = partes.join("<br>");
}
function limparConfiguracaoLancheComboAuto(numeroLanche) {
  delete configuracoesLanchesComboAuto[numeroLanche];

  atualizarStatusLancheComboAuto(numeroLanche);

  atualizarPrecoComboAuto();

  fecharConfiguracaoLancheComboAuto(numeroLanche);
}

function fecharConfiguracaoLancheComboAuto(numeroLanche) {
  const area = document.getElementById(`config-lanche-combo-auto-${numeroLanche}`);

  if (area) {
    area.style.display = "none";
  }
}
function atualizarPrecoComboAuto() {
  if (typeof atualizarObservacaoComboUI === "function") atualizarObservacaoComboUI(true);
  if (!comboAutoAtual) {
    return;
  }

  const precoBase = Number(comboAutoAtual.preco || 0);

  const qtdLanches = Number(comboAutoAtual.comboQtdLanches || 0);

  let totalAdicionais = 0;

  if (modoPersonalizacaoComboAuto === "todos" && configuracaoTodosComboAuto) {
    (configuracaoTodosComboAuto.adicionais || []).forEach((adicional) => {
      totalAdicionais += Number(adicional.preco || 0) * Number(adicional.qtd || 0) * qtdLanches;
    });
  } else if (modoPersonalizacaoComboAuto === "individual") {
    Object.values(configuracoesLanchesComboAuto).forEach((config) => {
      (config.adicionais || []).forEach((adicional) => {
        totalAdicionais += Number(adicional.preco || 0) * Number(adicional.qtd || 0);
      });
    });
  }

  const precoUnitario = precoBase + totalAdicionais;

  if (comboAutoTemAcrescimos()) {
    quantidadeComboAuto = 1;
    const campoQuantidade = document.getElementById("qtd-combo-auto");
    if (campoQuantidade) campoQuantidade.textContent = "1";
  }
  const quantidade = quantidadeComboAuto;

  const total = precoUnitario * quantidade;

  document.getElementById("combo-preco-auto").textContent = `R$ ${total.toFixed(2)}`;
}
function adicionarComboCarrinhoAuto() {
  if (!comboAutoAtual) {
    return alert("Combo não encontrado.");
  }

  const qtdLanches = Number(comboAutoAtual.comboQtdLanches || 0);

  const temTodos =
    modoPersonalizacaoComboAuto === "todos" &&
    configuracaoTodosComboAuto &&
    ((configuracaoTodosComboAuto.adicionais || []).length > 0 ||
      (configuracaoTodosComboAuto.observacao || "").trim() !== "");

  const temIndividual =
    modoPersonalizacaoComboAuto === "individual" &&
    Object.keys(configuracoesLanchesComboAuto).length > 0;

  const comboPersonalizado = temTodos || temIndividual;

  const quantidade = comboAutoTemAcrescimos() ? 1 : quantidadeComboAuto;

  const lanchesCombo = [];

  for (let numero = 1; numero <= qtdLanches; numero++) {
    let adicionais = [];

    let observacao = "";

    if (temTodos) {
      adicionais = (configuracaoTodosComboAuto.adicionais || []).map((adicional) => ({
        ...adicional,
      }));

      observacao = configuracaoTodosComboAuto.observacao || "";
    } else if (temIndividual) {
      const config = configuracoesLanchesComboAuto[numero];

      if (config) {
        adicionais = (config.adicionais || []).map((adicional) => ({
          ...adicional,
        }));

        observacao = config.observacao || "";
      }
    }

    lanchesCombo.push({
      numero,

      adicionais,

      observacao,
    });
  }

  const totalAdicionais = lanchesCombo.reduce((total, lanche) => {
    const subtotal = (lanche.adicionais || []).reduce((soma, adicional) => {
      return soma + Number(adicional.preco || 0) * Number(adicional.qtd || 0);
    }, 0);

    return total + subtotal;
  }, 0);

  const precoBase = Number(comboAutoAtual.preco || 0);

  const precoUnitario = precoBase + totalAdicionais;

  const novoItem = {
    produtoId: comboAutoAtual.id,

    nome: comboAutoAtual.nome,

    categoria: "combos",

    quantidade,

    precoBase,

    precoUnitario,

    subtotal: precoUnitario * quantidade,

    observacao: document.getElementById("observacao-combo-auto")?.value.trim() || "",

    comboQtdLanches: qtdLanches,
    descricao: comboAutoAtual.desc || comboAutoAtual.descricao || "",
    bebida: comboAutoAtual.bebida || comboAutoAtual.bebidaCombo || "",
    bebidas: comboAutoAtual.bebidas || [],
    comboComponentes: comboAutoAtual.comboComponentes || [],

    comboPersonalizado,

    modoPersonalizacaoCombo: comboPersonalizado ? modoPersonalizacaoComboAuto : "padrao",

    lanchesCombo,

    molhosGratis: [],

    molhosPagos: [],

    totalMolhosPagos: 0,
  };

  const estavaEditando = Number.isInteger(indiceItemAutoEmEdicao);

  if (estavaEditando) {
    carrinhoAutoatendimento[indiceItemAutoEmEdicao] = novoItem;

    indiceItemAutoEmEdicao = null;
  } else {
    carrinhoAutoatendimento.push(novoItem);
  }

  atualizarCarrinhoAuto();

  fecharComboAuto(false);

  // =========================
  // VOLTAR PARA REVISÃO
  // APÓS EDITAR
  // =========================

  if (voltarResumoDepoisEdicaoAuto) {
    voltarResumoDepoisEdicaoAuto = false;

    abrirResumoPedidoAuto();

    return;
  }
}
function fecharComboAuto(voltarResumo = true) {
  const modal = document.getElementById("modal-combo-auto");

  if (modal) {
    modal.style.display = "none";
  }

  // =========================
  // CANCELOU EDIÇÃO
  // =========================

  if (voltarResumo && voltarResumoDepoisEdicaoAuto) {
    indiceItemAutoEmEdicao = null;

    voltarResumoDepoisEdicaoAuto = false;

    abrirResumoPedidoAuto();
  }
}

function fecharModalProdutoAuto(voltarResumo = true) {
  const modal = document.getElementById("modal-produto-auto");

  if (modal) {
    modal.style.display = "none";
  }

  // =========================
  // CANCELOU UMA EDIÇÃO
  // =========================

  if (voltarResumo && voltarResumoDepoisEdicaoAuto) {
    indiceItemAutoEmEdicao = null;

    voltarResumoDepoisEdicaoAuto = false;

    abrirResumoPedidoAuto();
  }
}

function adicionarProdutoCarrinhoAuto() {
  if (!produtoAutoAtual) {
    alert("Produto não encontrado.");

    return;
  }

  // =========================
  // TIPO
  // =========================

  const opcaoTipo = document.querySelector('input[name="tipo-produto-auto"]:checked');

  let tipo = "";

  let precoBase = Number(produtoAutoAtual.preco || 0);

  if (opcaoTipo) {
    tipo = opcaoTipo.value;

    precoBase = Number(opcaoTipo.dataset.preco || precoBase);
  }

  // =========================
  // ADICIONAIS
  // =========================

  const adicionais = Object.values(adicionaisAutoSelecionados)
    .filter((adicional) => Number(adicional.qtd || 0) > 0)
    .map((adicional) => ({
      id: adicional.id,

      nome: adicional.nome,

      preco: Number(adicional.preco || 0),

      qtd: Number(adicional.qtd || 0),
    }));

  // =========================
  // SE PERSONALIZADO,
  // 1 UNIDADE POR VEZ
  // =========================

  if (adicionais.length > 0 && quantidadeProdutoAuto > 1) {
    alert("Para adicionais personalizados, selecione apenas 1 unidade por vez.");

    return;
  }

  const totalAdicionais = adicionais.reduce(
    (total, adicional) => total + Number(adicional.preco || 0) * Number(adicional.qtd || 0),

    0,
  );

  const observacao = document.getElementById("obs-produto-auto")?.value.trim() || "";

  const precoUnitario = precoBase + totalAdicionais;

  const novoItem = {
    produtoId: produtoAutoAtual.id,

    nome: produtoAutoAtual.nome,

    categoria: produtoAutoAtual.categoria || "",

    tipo,

    quantidade: quantidadeProdutoAuto,

    precoBase,

    precoUnitario,

    adicionais,

    observacao,

    subtotal: precoUnitario * quantidadeProdutoAuto,

    molhosGratis: [],

    molhosPagos: [],

    totalMolhosPagos: 0,
  };

  const estavaEditando = Number.isInteger(indiceItemAutoEmEdicao);

  if (estavaEditando) {
    carrinhoAutoatendimento[indiceItemAutoEmEdicao] = novoItem;

    indiceItemAutoEmEdicao = null;
  } else {
    carrinhoAutoatendimento.push(novoItem);
  }

  atualizarCarrinhoAuto();
  console.log("Carrinho autoatendimento:", carrinhoAutoatendimento);

  fecharModalProdutoAuto(false);

  if (voltarResumoDepoisEdicaoAuto) {
    voltarResumoDepoisEdicaoAuto = false;

    abrirResumoPedidoAuto();

    return;
  }
}
function montarDetalhesComboResumoAuto(item) {
  if (item.categoria !== "combos") {
    return "";
  }

  const lanches = item.lanchesCombo || [];

  if (lanches.length === 0) {
    return "";
  }

  let html = `

        <div
            style="
                margin-top:10px;
                padding-left:10px;
            "
        >

    `;

  lanches.forEach((lanche) => {
    const adicionais = lanche.adicionais || [];

    const observacao = lanche.observacao || "";

    html += `

                <div
                    style="
                        margin-bottom:10px;
                    "
                >

                    <strong>
                        Lanche ${lanche.numero}
                    </strong>

            `;

    // =========================
    // PADRÃO
    // =========================

    if (adicionais.length === 0 && !observacao) {
      html += `

                    <br>
                    Padrão

                `;
    }

    // =========================
    // ADICIONAIS
    // =========================

    adicionais.forEach((adicional) => {
      html += `

                        <br>

                        + ${adicional.qtd}
                        ${adicional.nome}

                    `;
    });

    // =========================
    // OBSERVAÇÃO
    // =========================

    if (observacao) {
      html += `

                    <br>

                    Obs:
                    ${observacao}

                `;
    }

    html += `

                </div>

            `;
  });

  html += `

        </div>

    `;

  return html;
}
function abrirResumoPedidoAuto() {
  if (carrinhoAutoatendimento.length === 0) {
    alert("Seu pedido está vazio.");

    return;
  }
  // =========================
  // GARANTIR QUE O MODAL
  // DE PRODUTO NÃO FIQUE
  // POR CIMA DA REVISÃO
  // =========================

  fecharModalProdutoAuto(false);
  const comboAberto = document.getElementById("modal-combo-auto");
  if (comboAberto) comboAberto.style.display = "none";

  const lista = document.getElementById("lista-resumo-auto");

  const totalArea = document.getElementById("total-resumo-auto");

  if (!lista || !totalArea) {
    return;
  }

  let html = "";

  let totalPedido = 0;

  carrinhoAutoatendimento.forEach((item, index) => {
    totalPedido += Number(item.subtotal || 0);

    const adicionaisTexto = (item.adicionais || [])
      .map((adicional) => `+ ${adicional.qtd} ${adicional.nome}`)
      .join("<br>");
    const detalhesCombo = montarDetalhesComboResumoAuto(item);

    html += `<article class="resumo-auto-item"><div class="resumo-auto-item-topo"><strong>${Number(item.quantidade || 1)} ${escaparOperacao(item.nome)}</strong><strong class="resumo-auto-preco">${moedaOperacao(item.subtotal || 0)}</strong></div>${item.tipo ? '<p class="resumo-auto-tipo">' + escaparOperacao(item.tipo) + "</p>" : ""}${adicionaisTexto ? '<div class="resumo-auto-extras">' + adicionaisTexto + "</div>" : ""}${detalhesCombo}${item.observacao ? "<p>Obs.: " + escaparOperacao(item.observacao) + "</p>" : ""}<div class="resumo-auto-acoes"><button type="button" onclick="editarItemCarrinhoAuto(${index})">Editar</button><button type="button" onclick="removerItemCarrinhoAuto(${index})">Remover</button></div></article>`;
  });

  lista.innerHTML = html;

  totalArea.textContent = totalPedido.toFixed(2).replace(".", ",");

  const modalResumo = document.getElementById("modal-resumo-auto");

  modalResumo.style.display = "flex";
  modalResumo.querySelector(".modal-conteudo").scrollTop = 0;
  modalResumo.querySelector("button")?.focus({ preventScroll: true });

  modalResumo.style.zIndex = "3000";
}

function editarItemCarrinhoAuto(index) {
  const item = carrinhoAutoatendimento[index];

  if (!item) {
    alert("Item não encontrado.");

    return;
  }

  // =========================
  // COMBO
  // FAREMOS DEPOIS
  // =========================

  if (item.categoria === "combos") {
    editarComboCarrinhoAuto(index);

    return;
  }

  indiceItemAutoEmEdicao = index;

  voltarResumoDepoisEdicaoAuto = true;

  fecharResumoPedidoAuto();

  // =========================
  // ABRIR PRODUTO
  // =========================

  abrirProdutoAutoatendimento(item.produtoId);

  // =========================
  // QUANTIDADE ANTIGA
  // =========================

  quantidadeProdutoAuto = Number(item.quantidade || 1);

  document.getElementById("qtd-produto-auto").textContent = quantidadeProdutoAuto;

  // =========================
  // OBSERVAÇÃO
  // =========================

  document.getElementById("obs-produto-auto").value = item.observacao || "";

  // =========================
  // TIPO
  // =========================

  if (item.tipo) {
    const radioTipo = document.querySelector(
      `input[
                    name="tipo-produto-auto"
                ][
                    value="${item.tipo}"
                ]`,
    );

    if (radioTipo) {
      radioTipo.checked = true;
    }
  }

  // =========================
  // ADICIONAIS ANTIGOS
  // =========================

  Object.entries(adicionaisAutoSelecionados).forEach(([indexAdicional, adicional]) => {
    const antigo = (item.adicionais || []).find(
      (adicionalAntigo) =>
        adicionalAntigo.id === adicional.id || adicionalAntigo.nome === adicional.nome,
    );

    const quantidade = Number(antigo?.qtd || 0);

    adicional.qtd = quantidade;

    const span = document.getElementById(`qtd-adicional-auto-${indexAdicional}`);

    if (span) {
      span.textContent = quantidade;
    }
  });
  if (typeof atualizarResumoAdicionaisProdutoUI === "function")
    atualizarResumoAdicionaisProdutoUI("lista-adicionais-auto");
}
function editarComboCarrinhoAuto(index) {
  const item = carrinhoAutoatendimento[index];

  if (!item) {
    alert("Combo não encontrado.");

    return;
  }

  const produto = produtosAutoatendimento.find((produto) => produto.id === item.produtoId);

  if (!produto) {
    alert("Produto original do combo não encontrado.");

    return;
  }

  // =========================
  // MARCAR EDIÇÃO
  // =========================

  indiceItemAutoEmEdicao = index;

  voltarResumoDepoisEdicaoAuto = true;

  fecharResumoPedidoAuto();

  // =========================
  // ABRIR COMBO
  // =========================

  abrirComboAutoatendimento(produto);

  // =========================
  // QUANTIDADE
  // =========================

  quantidadeComboAuto = Number(item.quantidade || 1);

  const qtd = document.getElementById("qtd-combo-auto");

  if (qtd) {
    qtd.textContent = quantidadeComboAuto;
  }

  // =========================
  // OBSERVAÇÃO GERAL
  // =========================

  const campoObs = document.getElementById("observacao-combo-auto");

  if (campoObs) {
    campoObs.value = item.observacao || "";
  }

  // =========================
  // RECUPERAR MODO
  // =========================

  const modoSalvo = item.modoPersonalizacaoCombo || "padrao";

  modoPersonalizacaoComboAuto = modoSalvo;

  configuracaoTodosComboAuto = null;

  configuracoesLanchesComboAuto = {};

  // =====================================================
  // APLICAR PARA TODOS
  // =====================================================

  if (modoSalvo === "todos") {
    const primeiroLanche = (item.lanchesCombo || [])[0];

    if (primeiroLanche) {
      configuracaoTodosComboAuto = {
        adicionais: (primeiroLanche.adicionais || []).map((adicional) => ({
          id: adicional.id,

          nome: adicional.nome,

          preco: Number(adicional.preco || 0),

          qtd: Number(adicional.qtd || 0),
        })),

        observacao: primeiroLanche.observacao || "",
      };
    }

    modoPersonalizacaoComboAuto = "todos";

    atualizarResumoTodosComboAuto();
  }

  // =====================================================
  // INDIVIDUAL
  // =====================================================
  else if (modoSalvo === "individual") {
    (item.lanchesCombo || []).forEach((lanche) => {
      const adicionais = (lanche.adicionais || []).map((adicional) => ({
        id: adicional.id,

        nome: adicional.nome,

        preco: Number(adicional.preco || 0),

        qtd: Number(adicional.qtd || 0),
      }));

      const observacao = lanche.observacao || "";

      // Só salva se tiver
      // alguma personalização.

      if (adicionais.length > 0 || observacao) {
        configuracoesLanchesComboAuto[lanche.numero] = {
          adicionais,

          observacao,
        };
      }
    });

    modoPersonalizacaoComboAuto = "individual";

    Object.keys(configuracoesLanchesComboAuto).forEach((numero) => {
      atualizarStatusLancheComboAuto(Number(numero));
    });
  }

  // =====================================================
  // PADRÃO
  // =====================================================
  else {
    modoPersonalizacaoComboAuto = "padrao";

    selecionarModoComboAuto("padrao");
  }

  atualizarPrecoComboAuto();
}

function removerItemCarrinhoAuto(index) {
  carrinhoAutoatendimento.splice(index, 1);

  atualizarCarrinhoAuto();

  if (carrinhoAutoatendimento.length === 0) {
    fecharResumoPedidoAuto();

    return;
  }

  abrirResumoPedidoAuto();
}
function fecharResumoPedidoAuto() {
  const modal = document.getElementById("modal-resumo-auto");

  if (modal) {
    modal.style.display = "none";
  }
}
async function confirmarEnvioPedidoAuto() {
  // =========================
  // VALIDAÇÕES
  // =========================

  if (!sessaoAutoatendimentoAtual) {
    alert("Sessão de atendimento não encontrada.");

    return;
  }

  if (carrinhoAutoatendimento.length === 0) {
    alert("Seu pedido está vazio.");

    return;
  }

  if (sessaoAutoatendimentoAtual.pedidoEnviado === true) {
    alert("Este pedido já foi enviado.");

    mostrarPosPedidoAutoatendimento();

    return;
  }

  const confirmar = await confirmarOperacao("Confirmar e enviar este pedido?");

  if (!confirmar) {
    return;
  }

  // =========================
  // BOTÃO
  // EVITAR CLIQUE DUPLO
  // =========================

  const botao = document.querySelector(
    '#modal-resumo-auto button[onclick*="confirmarEnvioPedidoAuto"]',
  );

  if (botao) {
    botao.disabled = true;

    botao.textContent = "Enviando...";
  }
  let pedidoFoiSalvo = false;

  try {
    const agora = new Date();

    const agoraIso = agora.toISOString();

    const agoraMs = agora.getTime();

    // =========================
    // TOTAL
    // =========================

    const valorTotal = carrinhoAutoatendimento.reduce((total, item) => {
      return total + Number(item.subtotal || 0);
    }, 0);

    // =========================
    // PREPARAR ITENS
    //
    // "preco" fica junto
    // para compatibilidade com ADM
    // =========================

    const itens = carrinhoAutoatendimento.map((item) => {
      return {
        ...item,

        quantidade: Number(item.quantidade || 1),

        precoBase: Number(item.precoBase || 0),

        precoUnitario: Number(item.precoUnitario || item.precoBase || 0),

        // O ADM já usa
        // item.preco em pedidos.
        preco: Number(item.precoUnitario || item.precoBase || 0),

        subtotal: Number(item.subtotal || 0),
      };
    });

    // =========================
    // REFERÊNCIAS
    // =========================

    const sessaoRef = db.collection("sessoesMesa").doc(sessaoAutoatendimentoAtual.id);

    const mesaRef = db.collection("mesas").doc(mesaAutoatendimentoId);

    const comandaRef = db.collection("comandas").doc();

    const pedidoRef = db.collection("pedidos").doc();

    const contadorRef = await prepararContadorPedidoOperacao(db);

    // =====================================================
    // TRANSAÇÃO
    //
    // Isso também impede enviar duas vezes
    // apertando o botão rapidamente.
    // =====================================================

    const resultado = await db.runTransaction(async (transaction) => {
      // =========================
      // LER SESSÃO
      // =========================

      const sessaoDoc = await transaction.get(sessaoRef);

      if (!sessaoDoc.exists) {
        throw new Error("SESSAO_NAO_EXISTE");
      }

      const sessao = sessaoDoc.data();

      if (sessao.status !== "ativa") {
        throw new Error("SESSAO_ENCERRADA");
      }

      // =========================
      // JÁ ENVIOU
      // =========================

      if (sessao.pedidoEnviado === true) {
        throw new Error("PEDIDO_JA_ENVIADO");
      }

      // =========================
      // GARANTIR MESMA MESA
      // =========================

      if (sessao.mesaId !== mesaAutoatendimentoId) {
        throw new Error("MESA_INVALIDA");
      }

      // =========================
      // LER MESA
      // =========================

      const mesaDoc = await transaction.get(mesaRef);

      if (!mesaDoc.exists) {
        throw new Error("MESA_NAO_EXISTE");
      }

      const mesa = mesaDoc.data();

      // =========================
      // CONTADOR DE PEDIDOS
      // =========================

      const contadorDoc = await transaction.get(contadorRef);

      let numeroPedido = 1;

      if (contadorDoc.exists) {
        numeroPedido = Number(contadorDoc.data().ultimoNumero || 0) + 1;
      }

      transaction.set(
        contadorRef,

        {
          ultimoNumero: numeroPedido,
        },

        {
          merge: true,
        },
      );

      // =====================================================
      // CRIAR COMANDA
      // =====================================================

      transaction.set(
        comandaRef,

        {
          cliente: sessao.nome || "Cliente",

          mesa: Number(mesa.numero),

          mesaId: mesaAutoatendimentoId,

          status: "Aberta",

          // =========================
          // ORIGEM
          // =========================

          origem: "autoatendimento",

          sessaoAutoatendimentoId: sessaoDoc.id,

          pedidoOrigemId: pedidoRef.id,

          // =========================
          // CLIENTE LOGADO
          // =========================

          clienteId: sessao.clienteId || null,

          clienteLogado: sessao.clienteLogado === true,

          // =========================
          // ATENDENTE
          // =========================

          atendenteId: null,

          atendenteNome: "Autoatendimento",

          // =========================
          // ITENS
          // =========================

          itens,
          itensEnviadosCozinha: itens,

          valorTotal,

          valorPago: 0,

          // =========================
          // DATA
          // =========================

          criadoEm: agoraMs,

          criadoEmIso: agoraIso,
        },
      );

      // =====================================================
      // CRIAR PEDIDO
      //
      // É O REGISTRO QUE DEPOIS
      // A COZINHA VAI OUVIR.
      // =====================================================

      transaction.set(
        pedidoRef,

        {
          id: pedidoRef.id,

          numero: numeroPedido,
          numeroDia: numeroPedido,
          diaOperacional: contadorRef.id.replace("contadorPedidos_", ""),

          // =========================
          // CLIENTE
          // =========================

          nome: sessao.nome || "Cliente",

          telefone: "",

          telefoneLimpo: "",

          clienteId: sessao.clienteId || null,

          // =========================
          // LOCAL
          // =========================

          tipo: "Local",

          mesa: Number(mesa.numero),

          mesaId: mesaAutoatendimentoId,

          // =========================
          // VÍNCULOS
          // =========================

          comandaId: comandaRef.id,

          sessaoAutoatendimentoId: sessaoDoc.id,

          origem: "autoatendimento",

          // =========================
          // ITENS / VALOR
          // =========================

          itens,

          valorAntesDesconto: valorTotal,

          valorTotal,

          taxaEntrega: 0,

          descontoFidelidade: 0,

          descontoCupom: 0,

          cupomDescontoCodigo: "",

          cupomDescontoNome: "",

          // =========================
          // PAGAMENTO
          //
          // LOCAL PAGA NO FECHAMENTO
          // =========================

          pagamento: "Pendente",

          // =========================
          // COZINHA
          // =========================

          statusCozinha: "novo",

          enviadoCozinhaEm: agoraIso,

          enviadoCozinhaEmMs: agoraMs,

          // =========================
          // CONTROLE
          // =========================

          cancelado: false,

          data: agoraIso,

          dataMs: agoraMs,
        },
      );

      // =====================================================
      transaction.set(db.collection("filaCozinha").doc(comandaRef.id), {
        origemColecao: "comandas",
        origemId: comandaRef.id,
        numero: numeroPedido,
        numeroDia: numeroPedido,
        diaOperacional: contadorRef.id.replace("contadorPedidos_", ""),
        mesa: Number(mesa.numero),
        cliente: sessao.nome || "Cliente",
        itens,
        status: "aguardando",
        criadoEmMs: agoraMs,
        confirmadoPor: "Autoatendimento",
      });

      // MESA FICA OCUPADA
      // =====================================================

      transaction.update(
        mesaRef,

        {
          ocupada: true,
        },
      );

      // =====================================================
      // SESSÃO NÃO PODE ENVIAR OUTRO
      // PEDIDO SOZINHA
      // =====================================================

      transaction.update(
        sessaoRef,

        {
          pedidoEnviado: true,

          comandaId: comandaRef.id,

          pedidoId: pedidoRef.id,

          atualizadoEm: agoraIso,

          atualizadoEmMs: agoraMs,
        },
      );

      return {
        numeroPedido,

        comandaId: comandaRef.id,

        pedidoId: pedidoRef.id,
      };
    });

    pedidoFoiSalvo = true;
    // =====================================================
    // ATUALIZAR ESTADO LOCAL
    // =====================================================

    sessaoAutoatendimentoAtual.pedidoEnviado = true;

    sessaoAutoatendimentoAtual.comandaId = resultado.comandaId;

    sessaoAutoatendimentoAtual.pedidoId = resultado.pedidoId;

    // =========================
    // LIMPAR CARRINHO
    // =========================

    carrinhoAutoatendimento = [];

    atualizarCarrinhoAuto();

    fecharResumoPedidoAuto();

    // =========================
    // TELA PÓS-PEDIDO
    // =========================

    mostrarPosPedidoAutoatendimento();

    console.log("Pedido enviado:", resultado);
  } catch (erro) {
    console.error("Erro no envio/pós-envio:", erro);

    // =====================================================
    // PEDIDO JÁ FOI SALVO
    // O ERRO FOI SOMENTE NA ATUALIZAÇÃO DA TELA
    // =====================================================

    if (pedidoFoiSalvo) {
      console.warn("Pedido foi salvo corretamente, mas ocorreu erro ao atualizar a interface.");

      try {
        carrinhoAutoatendimento = [];

        fecharResumoPedidoAuto();

        mostrarPosPedidoAutoatendimento();
      } catch (erroTela) {
        console.error("Erro ao recuperar tela pós-pedido:", erroTela);
      }

      return;
    }

    if (erro.message === "PEDIDO_JA_ENVIADO") {
      sessaoAutoatendimentoAtual.pedidoEnviado = true;

      mostrarPosPedidoAutoatendimento();

      return;
    }

    if (erro.message === "SESSAO_ENCERRADA") {
      alert("Esta sessão já foi encerrada.");

      return;
    }

    alert("Não foi possível enviar o pedido. Tente novamente.");
  } finally {
    if (botao) {
      botao.disabled = false;

      botao.textContent = "🚀 Confirmar e enviar";
    }
  }
}

function montarTiposProdutoAuto(produto) {
  const area = document.getElementById("modal-opcoes-tipo-auto");

  if (!area) {
    return;
  }

  area.innerHTML = "";

  const tipos = tiposCarneProdutoOperacao(produto);

  if (tipos.length <= 1) {
    area.innerHTML = "";

    return;
  }

  tipos.forEach((tipo, index) => {
    area.innerHTML += `

                <label>

                    <input

                        type="radio"

                        name="tipo-produto-auto"

                        value="${tipo.valor}"

                        data-preco="${tipo.preco}"

                        ${index === 0 ? "checked" : ""}

                    >

                    ${tipo.nome}

                    R$ ${tipo.preco.toFixed(2)}

                </label>

                <br>

            `;
  });
}
function irParaCategoriaAuto(secaoId) {
  const secao = document.getElementById(secaoId);

  if (!secao) {
    return;
  }

  secao.scrollIntoView({
    behavior: "smooth",

    block: "start",
  });
}
function voltarAoTopoCardapio() {
  window.scrollTo({
    top: 0,

    behavior: "smooth",
  });
}
async function abrirLoginAutoatendimento() {
  // =========================
  // JÁ ESTÁ LOGADO
  // =========================

  if (sessaoAutoatendimentoAtual?.clienteLogado === true && sessaoAutoatendimentoAtual?.clienteId) {
    await abrirContaAutoatendimento();

    return;
  }
  const modal = document.getElementById("modal-login-auto");

  if (!modal) {
    return;
  }

  const nomeInput = document.getElementById("login-auto-nome");

  const telefoneInput = document.getElementById("login-auto-telefone");

  const codigoInput = document.getElementById("login-auto-codigo");

  const status = document.getElementById("status-login-auto");

  if (status) {
    status.innerHTML = "";
  }

  if (codigoInput) {
    codigoInput.value = "";
  }

  // =====================================================
  // PREENCHER LOGIN SALVO DO SITE
  // =====================================================

  const loginSalvo = localStorage.getItem("clientePedrao");

  if (loginSalvo) {
    try {
      const dados = JSON.parse(loginSalvo);

      if (nomeInput) {
        nomeInput.value = dados.nome || "";
      }

      if (telefoneInput) {
        telefoneInput.value = String(dados.telefone || "")
          .replace(/\D/g, "")
          .slice(0, 11);
      }

      const salvar = document.getElementById("login-auto-salvar");

      if (salvar) {
        salvar.checked = true;
      }
    } catch (erro) {
      console.warn("Login salvo inválido:", erro);
    }
  }

  modal.style.display = "flex";
}
async function abrirContaAutoatendimento() {
  if (!sessaoAutoatendimentoAtual?.clienteId) {
    return;
  }

  const modal = document.getElementById("modal-conta-auto");

  const area = document.getElementById("conteudo-conta-auto");

  if (!modal || !area) {
    return;
  }

  area.innerHTML = "<p>Carregando...</p>";

  modal.style.display = "flex";

  try {
    const clienteDoc = await db
      .collection("clientes")
      .doc(sessaoAutoatendimentoAtual.clienteId)
      .get();

    if (!clienteDoc.exists) {
      area.innerHTML = `

                <p>
                    Não foi possível encontrar
                    sua conta.
                </p>

            `;

      return;
    }

    const cliente = clienteDoc.data();

    const cuponsCliente = await buscarCuponsClienteAuto(sessaoAutoatendimentoAtual.clienteId);

    // =========================
    // AVATAR
    // =========================

    const avatar =
      cliente.avatar || sessaoAutoatendimentoAtual.clienteAvatar || "images/avatar1.png";

    // =========================
    // BÔNUS
    // =========================

    const bonusDisponivel = Number(cliente.bonusDisponivel || 0);

    const totalFidelidade = Number(cliente.totalFidelidade || 0);

    let htmlBonus = "";

    // Só mostra bloco se
    // fidelidade estiver ativa.
    if (cliente.fidelidadeAtiva === true) {
      // =========================
      // TEM BÔNUS
      // =========================

      if (bonusDisponivel > 0) {
        htmlBonus = `

                    <div
                        class="bloco-conta-auto"
                    >

                        <h3>
                            🎁 Bônus disponível
                        </h3>

                        <strong
                            class="valor-bonus-auto"
                        >
                            R$
                            ${bonusDisponivel.toFixed(2).replace(".", ",")}
                        </strong>

                    </div>

                `;
      } else {
        // =========================
        // QUANTO FALTA
        // =========================

        const progresso = totalFidelidade % 300;

        const falta = progresso === 0 ? 300 : 300 - progresso;

        // Só mostra o valor
        // quando faltar MENOS
        // de R$ 80.
        if (falta < 80) {
          htmlBonus = `

                        <div
                            class="bloco-conta-auto"
                        >

                            <h3>
                                🎁 Falta pouco!
                            </h3>

                            <p>
                                Mais
                                <strong>
                                    R$
                                    ${falta.toFixed(2).replace(".", ",")}
                                </strong>
                                em compras para liberar
                                seu próximo bônus.
                            </p>

                        </div>

                    `;
        } else {
          htmlBonus = `

                        <div
                            class="bloco-conta-auto"
                        >

                            <h3>
                                🎁 Bônus
                            </h3>

                            <p>
                                Continue acumulando
                                benefícios nas suas
                                compras.
                            </p>

                        </div>

                    `;
        }
      }
    }
    let htmlCupons = "";

    if (cuponsCliente.length === 0) {
      htmlCupons = `

        <p>
            Nenhum cupom disponível
            no momento.
        </p>

    `;
    } else {
      htmlCupons = cuponsCliente
        .map((cupom) => {
          let beneficio = "";

          // =========================
          // PEDIDO
          // =========================

          if (cupom.tipo === "pedido" || cupom.tipo === "descontoGeral") {
            if (cupom.modo === "valor") {
              beneficio = `R$ ${Number(cupom.valor || 0)
                .toFixed(2)
                .replace(".", ",")} OFF`;
            } else if (cupom.modo === "porcentagem") {
              beneficio = `${Number(cupom.valor || 0)}% OFF`;
            }
          }

          // =========================
          // TAXA
          // =========================
          else if (cupom.tipo === "taxa") {
            if (cupom.modo === "gratis") {
              beneficio = "Taxa grátis";
            } else if (cupom.modo === "valor") {
              beneficio = `R$ ${Number(cupom.valor || 0)
                .toFixed(2)
                .replace(".", ",")} de desconto`;
            } else if (cupom.modo === "porcentagem") {
              beneficio = `${Number(cupom.valor || 0)}% de desconto`;
            }
          }

          // =========================
          // ITEM
          // =========================
          else if (cupom.tipo === "item") {
            beneficio = "Desconto em item";
          }

          return `

                    <div
                        class="cupom-conta-auto"
                    >

                        <strong>
                            ${cupom.nome || cupom.codigo}
                        </strong>


                        ${
                          beneficio
                            ? `

                                    <span>
                                        ${beneficio}
                                    </span>

                                `
                            : ""
                        }


                        <small>
                            Código:
                            ${cupom.codigo}
                        </small>


                        <small>
                            ${
                              cupom.usosRestantes === 1
                                ? "1 uso disponível"
                                : `${cupom.usosRestantes} usos disponíveis`
                            }
                        </small>

                    </div>

                `;
        })
        .join("");
    }

    // =========================
    // CONTA
    // =========================

    area.innerHTML = `

            <div
                class="perfil-conta-auto"
            >

                <img
                    src="${avatar}"
                    alt="Avatar"
                    class="avatar-conta-auto"
                >


                <h3>
                    ${cliente.nome || "Cliente"}
                </h3>

            </div>


            ${htmlBonus}


          


            <button
                type="button"
                onclick="
                    sairContaAutoatendimento()
                "
            >
                🚪 Sair da conta
            </button>

        `;
  } catch (erro) {
    console.error("Erro ao abrir conta:", erro);

    area.innerHTML = `

            <p>
                Não foi possível carregar
                sua conta.
            </p>

        `;
  }
}
async function buscarCuponsClienteAuto(clienteId) {
  const cuponsDisponiveis = [];

  try {
    const snap = await db.collection("clientes").doc(clienteId).collection("cupons").get();

    if (snap.empty) {
      return [];
    }

    for (const docCupomCliente of snap.docs) {
      const vinculo = docCupomCliente.data();

      const usosRestantes = Number(vinculo.usosRestantes || 0);

      if (vinculo.ativo === false || usosRestantes <= 0) {
        continue;
      }

      const codigo = vinculo.codigo || docCupomCliente.id;

      const cupomDoc = await db.collection("cuponsDesconto").doc(codigo).get();

      if (!cupomDoc.exists) {
        continue;
      }

      const cupom = cupomDoc.data();

      if (cupom.ativo !== true) {
        continue;
      }

      cuponsDisponiveis.push({
        codigo,

        usosRestantes,

        ...cupom,
      });
    }

    return cuponsDisponiveis;
  } catch (erro) {
    console.error("Erro ao buscar cupons do cliente:", erro);

    return [];
  }
}
async function sairContaAutoatendimento() {
  if (!sessaoAutoatendimentoAtual) {
    return;
  }

  // =========================
  // PEDIDO JÁ FOI ENVIADO
  // =========================

  if (sessaoAutoatendimentoAtual.pedidoEnviado === true) {
    localStorage.removeItem("clientePedrao");

    alert(
      "O login salvo neste aparelho foi removido. Esta compra continuará vinculada à sua conta.",
    );

    fecharContaAutoatendimento();

    return;
  }

  const confirmar = await confirmarOperacao("Deseja sair da sua conta?");

  if (!confirmar) {
    return;
  }

  try {
    const nomeTemporario =
      sessaoAutoatendimentoAtual.nomeTemporario || sessaoAutoatendimentoAtual.nome || "Cliente";

    // =========================
    // FIREBASE
    // =========================

    await db.collection("sessoesMesa").doc(sessaoAutoatendimentoAtual.id).update({
      nome: nomeTemporario,

      clienteId: null,

      clienteLogado: false,

      clienteNome: null,

      clienteAvatar: null,

      atualizadoEm: new Date().toISOString(),

      atualizadoEmMs: Date.now(),
    });

    // =========================
    // ESTADO LOCAL
    // =========================

    sessaoAutoatendimentoAtual.nome = nomeTemporario;

    sessaoAutoatendimentoAtual.clienteId = null;

    sessaoAutoatendimentoAtual.clienteLogado = false;

    sessaoAutoatendimentoAtual.clienteNome = null;

    sessaoAutoatendimentoAtual.clienteAvatar = null;

    // =========================
    // LOGIN SALVO
    // =========================

    localStorage.removeItem("clientePedrao");

    // =========================
    // NOME NO TOPO
    // =========================

    const nomeTela = document.getElementById("nome-sessao-auto");

    if (nomeTela) {
      nomeTela.textContent = nomeTemporario;
    }

    atualizarIconeLoginAuto();

    fecharContaAutoatendimento();
  } catch (erro) {
    console.error("Erro ao sair da conta:", erro);

    alert("Não foi possível sair da conta.");
  }
}
function fecharContaAutoatendimento() {
  const modal = document.getElementById("modal-conta-auto");

  if (modal) {
    modal.style.display = "none";
  }
}
function fecharLoginAutoatendimento() {
  const modal = document.getElementById("modal-login-auto");

  if (modal) {
    modal.style.display = "none";
  }
}
document.addEventListener("input", (event) => {
  if (event.target.id === "login-auto-telefone") {
    event.target.value = event.target.value.replace(/\D/g, "").slice(0, 11);
  }
});
async function entrarClienteAutoatendimento() {
  if (!sessaoAutoatendimentoAtual) {
    alert("Sessão da mesa não encontrada.");

    return;
  }

  const nome = document.getElementById("login-auto-nome")?.value.trim() || "";

  const telefone =
    document.getElementById("login-auto-telefone")?.value.replace(/\D/g, "").slice(0, 11) || "";

  const codigo = document.getElementById("login-auto-codigo")?.value.trim() || "";

  const salvarLogin = document.getElementById("login-auto-salvar")?.checked === true;

  // =========================
  // VALIDAR
  // =========================

  if (!nome) {
    alert("Informe seu nome.");

    return;
  }

  if (telefone.length !== 11) {
    alert("Informe o celular completo com DDD.");

    return;
  }

  try {
    // =========================
    // BUSCAR CLIENTE
    // =========================

    const clienteRef = db.collection("clientes").doc(telefone);

    const clienteDoc = await clienteRef.get();

    if (!clienteDoc.exists) {
      alert("Cliente não encontrado. Você pode continuar seu pedido normalmente sem login.");

      return;
    }

    const cliente = clienteDoc.data();
    const nomeConta = cliente.nome || nome;

    const avatarConta = cliente.avatar || "images/avatar1.png";

    const nomeTemporario =
      sessaoAutoatendimentoAtual.clienteLogado === true
        ? sessaoAutoatendimentoAtual.nomeTemporario || ""
        : sessaoAutoatendimentoAtual.nome || "";

    // =========================
    // CONFERIR NOME
    // MESMA REGRA DO SITE
    // =========================

    const nomeDigitado = nome.toLowerCase().trim();

    const nomeCadastrado = String(cliente.nome || "")
      .toLowerCase()
      .trim();

    if (nomeDigitado !== nomeCadastrado) {
      alert("Nome e telefone não conferem com o cadastro.");

      return;
    }

    // =====================================================
    // CÓDIGO DE ATIVAÇÃO OPCIONAL
    // =====================================================

    if (codigo) {
      if (codigo !== cliente.codigoAtivacao) {
        alert("Código inválido ou não pertence a este cliente.");

        return;
      }

      await clienteRef.update({
        fidelidadeAtiva: true,

        ativadoEm: new Date().toISOString(),

        totalFidelidade: Number(cliente.totalFidelidade || 0),
      });

      cliente.fidelidadeAtiva = true;
    }

    // =====================================================
    // ATUALIZAR SESSÃO
    // =====================================================

    await db.collection("sessoesMesa").doc(sessaoAutoatendimentoAtual.id).update({
      // Nome que passa a valer
      nome: nomeConta,

      // Nome digitado ao entrar
      // fica só como histórico.
      nomeTemporario: nomeTemporario,

      clienteId: telefone,

      clienteLogado: true,

      clienteNome: nomeConta,

      clienteAvatar: avatarConta,

      atualizadoEm: new Date().toISOString(),

      atualizadoEmMs: Date.now(),
    });

    // =====================================================
    // SE JÁ EXISTE COMANDA,
    // VINCULAR TAMBÉM
    // =====================================================

    if (sessaoAutoatendimentoAtual.comandaId) {
      await db.collection("comandas").doc(sessaoAutoatendimentoAtual.comandaId).update({
        // IMPORTANTE:
        // troca "gf" por "Pedro"
        cliente: nomeConta,

        clienteId: telefone,

        clienteLogado: true,

        clienteNomeCadastro: nomeConta,
      });
    }

    // =====================================================
    // SE O PEDIDO JÁ FOI CRIADO,
    // VINCULAR AO HISTÓRICO
    // =====================================================

    if (sessaoAutoatendimentoAtual.pedidoId) {
      await db
        .collection("pedidos")
        .doc(sessaoAutoatendimentoAtual.pedidoId)
        .update({
          nome: nomeConta,

          clienteId: telefone,

          telefone: cliente.telefone || telefone,

          telefoneLimpo: telefone,

          codigoCliente: cliente.codigoAtivacao || "",

          fidelidadeAtivaNoPedido: cliente.fidelidadeAtiva === true,
        });
    }

    // =====================================================
    // ESTADO LOCAL
    // =====================================================

    sessaoAutoatendimentoAtual.nome = nomeConta;

    sessaoAutoatendimentoAtual.nomeTemporario = nomeTemporario;

    sessaoAutoatendimentoAtual.clienteId = telefone;

    sessaoAutoatendimentoAtual.clienteLogado = true;

    sessaoAutoatendimentoAtual.clienteNome = nomeConta;

    sessaoAutoatendimentoAtual.clienteAvatar = avatarConta;

    // =====================================================
    // SALVAR LOGIN NESTE APARELHO
    // =====================================================

    if (salvarLogin) {
      localStorage.setItem(
        "clientePedrao",

        JSON.stringify({
          telefone: cliente.telefone || telefone,

          nome: cliente.nome || nome,

          avatar: cliente.avatar || "images/avatar1.png",
        }),
      );
    } else {
      localStorage.removeItem("clientePedrao");
    }
    sessaoAutoatendimentoAtual.nome = nomeConta;

    sessaoAutoatendimentoAtual.nomeTemporario = nomeTemporario;

    sessaoAutoatendimentoAtual.clienteId = telefone;

    sessaoAutoatendimentoAtual.clienteLogado = true;

    sessaoAutoatendimentoAtual.clienteNome = nomeConta;

    sessaoAutoatendimentoAtual.clienteAvatar = avatarConta;

    // =========================
    // ATUALIZAR NOME NA TELA
    // =========================

    const nomeTela = document.getElementById("nome-sessao-auto");

    if (nomeTela) {
      nomeTela.textContent = nomeConta;
    }

    // =========================
    // ATUALIZAR AVATAR
    // =========================

    atualizarIconeLoginAuto();

    fecharLoginAutoatendimento();

    mostrarBoasVindasUI(nomeConta);
  } catch (erro) {
    console.error("Erro no login do autoatendimento:", erro);

    alert("Não foi possível realizar o login.");
  }
}
function atualizarIconeLoginAuto() {
  const botao = document.getElementById("btn-login-auto");

  if (!botao) {
    return;
  }

  if (sessaoAutoatendimentoAtual?.clienteLogado === true) {
    const avatar = sessaoAutoatendimentoAtual.clienteAvatar || "images/avatar1.png";

    botao.innerHTML = `

            <img
                src="${avatar}"
                alt="Minha conta"
                class="avatar-login-auto"
            >

        `;

    botao.title = "Minha conta";
  } else {
    botao.innerHTML = "👤";

    botao.title = "Entrar";
  }
}

function mostrarPosPedidoAutoatendimento() {
  const area = document.getElementById("area-autoatendimento");

  if (!area) {
    return;
  }
  const nomeCliente =
    sessaoAutoatendimentoAtual?.clienteNome || sessaoAutoatendimentoAtual?.nome || "Cliente";

  area.innerHTML = `

        <div
            class="auto-pos-pedido"
        >

            <h2>
                🍔 PEDRÃO LANCHES
            </h2>


            <h3>
                Mesa ${sessaoAutoatendimentoAtual.mesaNumero}
            </h3>


           <p>
   <p>
    Olá,
    <strong
        id="nome-sessao-auto"
    >
        ${nomeCliente}
    </strong>
    👋
</p>


            <div
                class="auto-pedido-enviado"
            >

                <h2>
                    ✅ Pedido enviado!
                </h2>


                <p>
                    Seu pedido foi enviado
                    para preparo.
                </p>

            </div>


            <div
                class="auto-acoes-pos-pedido"
            >

                <button
                    type="button"
                    onclick="
                        chamarAtendenteAuto()
                    "
                >
                    🔔 Chamar atendente
                </button>


                <button
                    type="button"
                    onclick="
                        pedirContaAuto()
                    "
                >
                    💰 Pedir a conta
                </button>

            </div>

        </div>
        

    `;
}

async function criarChamadoAutoatendimento(tipo) {
  if (!sessaoAutoatendimentoAtual) {
    alert("Sessão não encontrada.");

    return false;
  }

  try {
    // =========================
    // VER SE JÁ EXISTE CHAMADO
    // DESTA SESSÃO
    // =========================

    const snap = await db
      .collection("chamadosMesa")
      .where("sessaoAutoatendimentoId", "==", sessaoAutoatendimentoAtual.id)
      .where("status", "==", "aberto")
      .get();

    // =========================
    // JÁ EXISTE UM ABERTO
    // =========================

    if (!snap.empty) {
      const chamadoExistente = snap.docs[0].data();

      if (chamadoExistente.tipo === tipo) {
        alert(
          tipo === "conta"
            ? "A conta já foi solicitada. Aguarde o atendente."
            : "O atendente já foi chamado. Aguarde um momento.",
        );

        return false;
      }

      alert("Você já possui uma solicitação aberta. Aguarde o atendente.");

      return false;
    }

    const agora = new Date();

    await db.collection("chamadosMesa").add({
      mesaId: mesaAutoatendimentoId,

      mesaNumero: Number(sessaoAutoatendimentoAtual.mesaNumero),

      sessaoAutoatendimentoId: sessaoAutoatendimentoAtual.id,

      comandaId: sessaoAutoatendimentoAtual.comandaId || null,

      cliente: sessaoAutoatendimentoAtual.nome || "Cliente",

      tipo,

      origem: "autoatendimento",

      status: "aberto",

      criadoEm: agora.toISOString(),

      criadoEmMs: agora.getTime(),
    });

    return true;
  } catch (erro) {
    console.error("Erro ao criar chamado:", erro);

    alert("Não foi possível enviar a solicitação.");

    return false;
  }
}
async function chamarAtendenteAuto() {
  const enviado = await criarChamadoAutoatendimento("atendente");

  if (!enviado) {
    return;
  }

  alert("🔔 Atendente chamado! Aguarde um momento.");
}
async function pedirContaAuto() {
  const confirmar = await confirmarOperacao("Deseja solicitar a conta?");

  if (!confirmar) {
    return;
  }

  const enviado = await criarChamadoAutoatendimento("conta");

  if (!enviado) {
    return;
  }

  alert("💰 Conta solicitada! O atendente irá até sua mesa.");
}

function mostrarMesaBloqueadaAutoatendimento() {
  const area = document.getElementById("area-autoatendimento");

  if (!area) {
    return;
  }

  area.innerHTML = `

        <div
            style="
                max-width:420px;
                margin:40px auto;
                padding:20px;
                text-align:center;
            "
        >

            <h2>
                Mesa ${mesaAutoatendimentoAtual.numero}
            </h2>


            <p>
                Esta mesa já está
                em atendimento.
            </p>


            <p>
                Para entrar neste atendimento,
                chame um atendente.
            </p>


            <button
                type="button"
                onclick="
                    chamarAtendenteMesaBloqueada()
                "
            >
                🔔 Chamar atendente
            </button>

        </div>

    `;
}
function atualizarCarrinhoAuto() {
  const contador = document.getElementById("contador-carrinho-auto");

  if (!contador) {
    return;
  }

  const quantidadeTotal = carrinhoAutoatendimento.reduce((total, item) => {
    return total + Number(item.quantidade || 0);
  }, 0);

  if (quantidadeTotal <= 0) {
    contador.style.display = "none";

    contador.textContent = "0";

    return;
  }

  contador.style.display = "inline-flex";

  contador.textContent = quantidadeTotal;
}

function obterJanelaChamadosAutoatendimento() {
  const agora = new Date();

  const inicio = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 2, 0, 0, 0);

  // Se ainda não deu 02:00,
  // o dia operacional começou
  // às 02:00 de ontem.
  if (agora.getTime() < inicio.getTime()) {
    inicio.setDate(inicio.getDate() - 1);
  }

  const fim = new Date(inicio);

  fim.setDate(fim.getDate() + 1);

  return {
    inicioMs: inicio.getTime(),

    fimMs: fim.getTime(),
  };
}

async function chamarAtendenteMesaBloqueada() {
  try {
    // =========================
    // EVITAR CHAMADO DUPLICADO
    // =========================

    const snapAberto = await db
      .collection("chamadosMesa")
      .where("mesaId", "==", mesaAutoatendimentoId)
      .where("status", "==", "aberto")
      .get();

    const janela = obterJanelaChamadosAutoatendimento();

    let existeChamadoAtual = false;

    const chamadosAntigos = [];

    snapAberto.forEach((doc) => {
      const chamado = doc.data();

      const criadoEmMs = Number(chamado.criadoEmMs || 0);

      // =========================
      // CHAMADO DO DIA ATUAL
      // =========================

      if (criadoEmMs >= janela.inicioMs && criadoEmMs < janela.fimMs) {
        existeChamadoAtual = true;
      }

      // =========================
      // CHAMADO VELHO ABERTO
      // =========================
      else {
        chamadosAntigos.push(doc.ref);
      }
    });

    // =========================
    // LIMPAR CHAMADOS FANTASMAS
    // =========================

    for (const ref of chamadosAntigos) {
      await ref.update({
        status: "expirado",

        expiradoEm: new Date().toISOString(),

        expiradoEmMs: Date.now(),
      });
    }

    // =========================
    // JÁ EXISTE CHAMADO ATUAL
    // =========================

    if (existeChamadoAtual) {
      alert("O atendente já foi chamado.");

      return;
    }

    const agora = new Date();

    await db.collection("chamadosMesa").add({
      mesaId: mesaAutoatendimentoId,

      mesaNumero: Number(mesaAutoatendimentoAtual.numero),

      tipo: "atendente",

      origem: "autoatendimento",

      status: "aberto",

      criadoEm: agora.toISOString(),

      criadoEmMs: agora.getTime(),
    });

    alert("Atendente chamado! Aguarde um momento.");
  } catch (erro) {
    console.error("Erro ao chamar atendente:", erro);

    alert("Não foi possível chamar o atendente.");
  }
}
document.addEventListener("DOMContentLoaded", () => {
  iniciarAutoatendimento().catch(() => {
    document.getElementById("area-autoatendimento").innerHTML =
      '<p>Não foi possível abrir sua mesa. Confira sua conexão.</p><button onclick="location.reload()">Tentar novamente</button>';
  });
});
