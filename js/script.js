const firebaseConfig = {
  apiKey: "AIzaSyD2ZQbBk5zTlkwh91cQ3HF-ZBpXzFE3IQk",
  authDomain: "pedrao-lanches.firebaseapp.com",
  projectId: "pedrao-lanches",
  storageBucket: "pedrao-lanches.firebasestorage.app",
  messagingSenderId: "642954187872",
  appId: "1:642954187872:web:38efbecf53357e57b0df05"
};

firebase.initializeApp(firebaseConfig);

const db = firebase.firestore();

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
    "25/12"  
]; 

const lanches = [
    {
        nome: "Baguncinha", preco: 25, desc: "Pão, hambúrguer artesanal, salsicha, ovo, presunto, mussarela, alface e tomate", precoIndustrial: 18, img: "bg.webp"
    },
    {
        nome: "Baguncinha com Bacon", preco: 26,  precoIndustrial: 23, desc: "Pão, hambúrguer artesanal, salsicha, bacon, ovo, presunto, mussarela, alface e tomate", img: "bg-com-bacon.webp"
    },
    {
        nome: "Baguncinha de Frango", preco: 25, desc: "Pão, filé de frango, salsicha, ovo, presunto, mussarela, alface e tomate", img: "baguncinha-de-frango.webp"
    },
    {
        nome: "Burrito cuiabano", preco: 20, precoIndustrial: 18, precoFrango: 20, desc: "Pão, hambúrguer artesanal triturado, molho vermelho, alface e tomate picado, presunto mussarela. * (opção de substituir o hamburguer por filé de frango)" , img: "burrito.webp"
    },
    {
        nome: "X-Burguer", preco: 18, precoIndustrial: 15, desc: "Pão, hambúrguer artesanal, 1 fatia de presunto e 1 de mussarela", img: "xburguer.webp"
    },
     {
        nome: "X-Bacon", preco: 25, precoIndustrial: 23, desc: "Pão, hambúrguer artesanal, bacon, presunto e mussarela",img: "x-bacon.webp"
    },
    {
        nome: "X-Bacon Salada", preco: 28, precoIndustrial: 25, desc: "Pão, hambúrguer artesanal, bacon, presunto, mussarela, alface e tomate", img: "bacon-salada.webp"
    },
     {
        nome: "X-Salada", preco: 20,  precoIndustrial: 17, desc: "Pão, hambúrguer artesanal, presunto, mussarela, alface e tomate",img: "xsalada.webp"
    },
    {
        nome: "X-Frango Bacon Salada", preco: 28, desc: "Pão, Filé de frango, bacon, presunto, mussarela, alface e tomate", img: "frango-bacon-salada.webp"
    },
    {
        nome: "Frango Salada", preco: 23, desc: "Pão, filé de frango, presunto, mussarela, alface, tomate e milho verde)" ,img: "frango-salada.webp"
    },
    {
        nome: "Americano Especial", preco: 26, precoIndustrial: 23, desc: "Pão, hambúrguer artesanal, 2 ovos, 2 fatias de presunto, 2 fatias de mussarela, alface e tomate", img: "americano-especial.webp"
    },
    {
        nome: "Bauru", preco: 11, desc: "Pão, 2 fatias de presunto, 2 fatias de mussarela", img: "bauru.webp"
    },
     {
        nome: "X-Egg", preco: 25,  precoIndustrial: 21, desc: "Pão, hambúrguer artesanal, 2 ovos, presunto, mussarela, alface e tomate", img: "xegg.webp"
    },
    {
        nome: "X-Calabresa", preco: 25,  precoIndustrial: 21, desc: "Pão, hambúrguer artesanal, calabresa, presunto, mussarela", img: "x-calabresa.webp"
    },
    {
        nome: "X-Calabresa Salada", preco: 26,  precoIndustrial: 23, desc: "Pão, hambúrguer artesanal, calabresa, presunto, mussarela, alface e tomate", img: "calabresa-salada.webp"
    },
    {
        nome: "Hot Dog Prensado de Frango", preco: 18, desc: "Pão, salsicha grelhada na chapa, frango picotado, presunto, mussarela, batata palha e milho verde)", img: "prensado.webp"
    },
    {
        nome: "Hot Dog Prensado de Calabresa", preco: 18, desc: "Pão, salsicha grelhada na chapa, frango picotado, presunto, mussarela, batata palha e milho verde)", img: "prensado.webp"
    },
    {
        nome: "Hot Dog Prensado Bacon", preco: 20, desc: "Pão, salsicha grelhada na chapa, bacon, presunto, mussarela, batata palha e milho verde)", img: "prensado.webp"
    },
    {
        nome: "Hot Dog simples", preco: 9, desc: "Pão, 1 salsicha, molho, batata palha", img: "hot-dog.webp"
    },
    {
        nome: "Hot Dog especial", preco: 15, desc: "Pão, 2 salsicha, molho, mussarela, milho verde e batata palha", img: "hot-dog.webp"
    },
    {
        nome: "X-Mignon", preco: 28, desc: "Pão, 2 fatias de presunto e 2 fatias de mussarela", img: "xmignon.webp"
    },
    {
        nome: "Mignon Salada", preco: 28, desc: "Pão, filé mignon, presunto, mussarela, alface e tomate", img: "xmignon-salada.webp"
    },
    {
        nome: "Paulistinha", preco: 28, desc: "Pão, filé mignon, cebola grelhada,  presunto, mussarela e tomate", img: "paulistinha.webp"
    },
    {
        nome: "Paulistão", preco: 31, desc: "Pão, filé mignon, cebola grelhada, calabresa, ovo, presunto, mussarela e tomate", img: "paulistao.webp"
    },
    {
        nome: "X-Bagunça", preco: 30,  precoIndustrial: 27, desc: "Pão, hambúrguer artesanal, salsicha, calabresa, bacon, ovo, presunto, mussarela, alface e tomate", img: "x-bg.webp"
    },
    {
        nome: "X-Filé Bagunça", preco: 33, desc: "Pão, filé mignon, salsicha, calabresa, bacon, ovo, presunto, mussarela, alface e tomate", img: "x-file-bg.webp"
    },
    {
        nome: "Frango Bagunça", preco: 30, desc: "Pão, filé de frango, salsicha, calabresa, bacon, ovo, presunto, mussarela, alface e tomate", img: "frango-bagunca.webp"
    },
    {
        nome: "Big Big", preco: 30,  precoIndustrial: 28, desc: "Pão, 2 hambúrguer artesanal, 2 ovos, 2 fatias de presunto, 2 fatias de mussarela, batata palha, milho verde, alface e tomate", img: "big.webp"
    },
    {
        nome: "X-tudo", preco: 45,  precoIndustrial: 43, desc: "Pão, hambúrguer artesanal, filé mignon, filé de frango, salsicha, calabresa, bacon, ovo, presunto, mussarela, alface, tomate, batata palha e milho verde)", img: "x-tudo.webp"
    },
    
    
];
const listaCombos = [
    
    {
        nome: "Combo 3 Caseiro",
        preco: 80,
        desc: "3 Baguncinha Caseiro + Refrigerante 1,5L",
        img:"3baguncinha.webp"
    },
    {
        nome: "Combo 3 X-Bacon",
        preco: 80,
        desc: "3 X-Bacon + Refrigerante 1,5L",
        img:"3xbacon.webp"
    },
    {
        nome: "Combo 3 X-Bagunça",
        preco: 95,
        desc: "3 X-Bagunça + Refrigerante 1,5L ",
        img:"3xbagunca.webp"
    },
    {
        nome: "Combo 3 Big Big",
        preco: 95,
        desc: "3 Big BIG + Refrigerante 1,5L ",
        img:"3big.webp"
    },
    {
        nome: "Combo 5 Artesanal",
        preco: 130,
        desc: "5 Baguncinha Caseiro + Refrigerante 2L ",
        img:"5baguncinha.webp"
    },
    
    {
        nome: "Combo 4 Industrial",
        preco: 75,
        desc: "4 Baguncinha industrial + Refrigerante 1,5L",
        img:"4baguncinha.webp"
    },

    { 
        nome: "Combo 2 X-Tudo", 
        preco: 110, 
        desc: "2 X-Tudo + Batata Frita média + Refrigerante 1,5L ", 
        img: "2tudo.webp" 
    },
    
    {
        nome: "Combo 2 Filé Bagunça",
        preco: 85,
        desc: "2 Filé Mignon Bagunça + Batata Frita média + Refrigerante 1,5L ",
        img:"2filebagunca.webp"
    },
    {
        nome: "Combo 2 X-Bagunça",
        preco: 80,
        desc: "2 X-Bagunça + Batata Frita média + Refrigerante 1,5L ",
        img:"2xbagunca.webp"
    },
    {
        nome: "Combo 2 Big Big",
        preco: 80,
        desc: "2 Big BIG + Batata Frita média + Refrigerante 1,5L ",
        img:"2big.webp"
    },
     {
        nome: "Combo 2 Artesanal",
        preco: 70,
        desc: "2 Baguncinha Caseiro + 2 Batata Frita pequena + 2 Refrigerantes latas",
        img:"2baguncinhaartesanal.webp"
    },
    
    {
        nome: "Combo 2 Industrial",
        preco: 56,
        desc: "2 Baguncinha Industrial + 1 Batata Frita Média + 2 Refrigerantes latas",
        img:"2baguncinhaindustrial.webp"
    },
    
   
    
];

const bebidas = [
    { nome: "Água com gás ", preco: 5.00, desc: "500ml", img: "agua.mineral.webp" },
    { nome: "Água sem gás", preco: 5.00, desc: "500ml", img: "agua.mineral.webp" },
    { nome: "Coca (Lata)", preco: 8.00, desc: "290ml a 350ml",img: "coca-lata.webp" },
    { nome: "Guaraná Antarctica (Lata)", preco: 8.00, desc: "290ml a 350ml", img: "guarana-lata.webp" },
    { nome: "Coca (Garrafinha)", preco: 9.00, desc: "450ml a 600ml", img: "coca-500ml.webp" },
    { nome: "Coca (1L)", preco: 10.00, desc: "1 Litro", img: "coca-1l-casco.webp" },
    { nome: "Fanta (1L)", preco: 10.00, desc: "1 Litro", img: "fanta-1l.webp" },
    { nome: "Coca (1,5L)", preco: 15.00, desc: "1,5 Litros", img: "coca15l.webp" },
    { nome: "Guaraná Antarctica (1,5L)", preco: 15.00, desc: "1,5 Litros", img:"guarana-antarctica-15l.webp" },
    { nome: "Coca 2L", preco: 20.00, desc: "2 Litros", img: "coca2l.webp" },
    { nome: "Guaraná Antarctica 2L", preco: 20.00, desc: "2 Litros", img:"guarana-antarctica-2l.webp" },
];

const batatas = [
    { nome: "Batata Pequena", preco: 15.00, desc: "Porção de 150g", img: "batata-frita-pequena-cortada.webp" },
    { nome: "Batata Média", preco: 20.00, desc: "Porção de 300g", img:"batata-frita-media-cortada.webp" },
    { nome: "Batata Grande", preco: 30.00, desc: "Porção de 450g", img:"batata-frita-grande-cortada.webp" }
];


let carrinho = [];
let dadosPedidoTemporario = {}; 
let lancheSendoEscolhido = null;

function gerarItens(lista, containerId, imagemPadrao) {
    const container = document.getElementById(containerId);
    if (!container) return;

    lista.forEach(item => {
        const fotoFinal = item.img ? item.img : imagemPadrao;
        const card = document.createElement("div");
        card.classList.add("card");
        
        let botaoHTML;

        
        if (item.precoIndustrial || item.precoFrango) {
            botaoHTML = `
                <button class="btn-escolher" onclick="abrirModal(
                    '${item.nome}', 
                    ${item.preco || 0}, 
                    ${item.precoIndustrial || 0}, 
                    ${item.precoFrango || 0}
                )">
                    ESCOLHER
                </button>
            `;
        } 
        
    
        else {
            let categoria = "Lanches";

            if (containerId.includes("bebidas")) categoria = "Bebidas";
            else if (containerId.includes("batatas")) categoria = "Batatas";
            else if (containerId.includes("combos")) categoria = "Combos";

            botaoHTML = `
                <button class="btn-escolher" onclick="adicionarDiretoCarrinho(
                    '${item.nome}', 
                    ${item.preco}, 
                    '${categoria}'
                )">
                    ADICIONAR
                </button>
            `;
        }

        card.innerHTML = `
            <img src="images/${fotoFinal}" alt="${item.nome}" loading="lazy">
            <h3>${item.nome}</h3>
            <p class="ingredientes">${item.desc}</p>
            <span class="preco">R$ ${item.preco.toFixed(2)}</span>
            ${botaoHTML}
        `;

        container.appendChild(card);
    });
}

function adicionarDiretoCarrinho(nome, preco, categoria = "Lanches") {

    const itemExistente = carrinho.find(item => item.nome === nome);

    if (itemExistente) {
        itemExistente.qtd++;
    } else {
        carrinho.push({ nome, qtd: 1, preco, categoria });
    }

    atualizarCarrinho();
}

function abrirModal(nome, pArt, pInd, pFra) {
    lancheSendoEscolhido = { 
        nome: nome, 
        precoArtesanal: Number(pArt), 
        precoIndustrial: Number(pInd),
        precoFrango: Number(pFra) 
    };

    document.getElementById('modal-nome-lanche').innerText = nome;
    
    document.getElementById('preco-artesanal').innerText = "R$ " + Number(pArt).toFixed(2);
    document.getElementById('preco-industrial').innerText = "R$ " + Number(pInd).toFixed(2);

   
    document.getElementById('qtd-artesanal').value = 0;
    document.getElementById('qtd-industrial').value = 0;
    document.getElementById('qtd-frango').value = 0;


    const divFrango = document.getElementById('container-opcao-frango');
    if (Number(pFra) > 0) {
        divFrango.style.display = 'flex';
        document.getElementById('preco-frango').innerText = "R$ " + Number(pFra).toFixed(2);
    } else {
        divFrango.style.display = 'none';
    }


    document.getElementById('modal-opcoes').style.display = 'flex';
}

function fecharModal() {
    const modal = document.getElementById('modal-opcoes');
    modal.style.display = 'none';
    
    
    document.getElementById('qtd-artesanal').value = 0;
    document.getElementById('qtd-industrial').value = 0;
}

function adicionarOuSomar(nome, qtd, preco, categoria) {
    const existente = carrinho.find(item => item.nome === nome);

    if (existente) {
        existente.qtd += qtd;
    } else {
        carrinho.push({ nome, qtd, preco, categoria });
    }
}
function confirmarEscolha() {
    const qtdInd = parseInt(document.getElementById('qtd-industrial').value) || 0;
    const qtdArt = parseInt(document.getElementById('qtd-artesanal').value) || 0;
    const qtdFrango = parseInt(document.getElementById('qtd-frango').value) || 0;


  if (qtdInd > 0) {
    adicionarOuSomar(
        `${lancheSendoEscolhido.nome} (Industrial)`,
        qtdInd,
        lancheSendoEscolhido.precoIndustrial,
        "Lanches"
    );
}
if (qtdArt > 0) {
    adicionarOuSomar(
        `${lancheSendoEscolhido.nome} (Artesanal)`,
        qtdArt,
        lancheSendoEscolhido.precoArtesanal,
        "Lanches"
    );
}

if (qtdFrango > 0) {
    adicionarOuSomar(
        `${lancheSendoEscolhido.nome} (Frango)`,
        qtdFrango,
        lancheSendoEscolhido.precoFrango,
        "Lanches"
    );
}

    document.getElementById('modal-opcoes').style.display = 'none';
    atualizarCarrinho();
}

function atualizarCarrinho() {
    const botao = document.getElementById('botao-flutuante');
    const valorTexto = document.getElementById('valor-total-flutuante');

    let total = carrinho.reduce((sum, item) => sum + (item.preco * item.qtd), 0);

    if (total > 0) {
        botao.style.display = 'flex';
        valorTexto.innerText = total.toFixed(2).replace('.', ',');
    } else {
        botao.style.display = 'none';
    }
}


function renderizarCarrinho() {
    const container = document.getElementById('lista-carrinho');
    if (!container) return;

    container.innerHTML = "";

    carrinho.forEach((item, index) => {
        const div = document.createElement('div');
        div.classList.add('item-carrinho'); 

        div.innerHTML = `
            <span class="nome-item">${item.qtd}x ${item.nome}</span>

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
    carrinho = carrinho.filter(i => i.id != id);
    atualizarCarrinho();
    renderizarCarrinho();
}
function limparCarrinho() {
    if (confirm("Deseja realmente apagar todo o pedido e recomeçar?")) {

        carrinho = [];

        atualizarCarrinho();

        const lista = document.getElementById('lista-carrinho');
        if (lista) lista.innerHTML = "";

        const carrinhoBox = document.getElementById('carrinho-box');
        if (carrinhoBox) carrinhoBox.style.display = "none";
         fecharCarrinho(); // 

        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}
function abrirCarrinho() {
    document.getElementById('modal-carrinho').style.display = 'block';
    renderizarCarrinho();
}

function fecharCarrinho() {
    document.getElementById('modal-carrinho').style.display = 'none';
}

function irParaFinalizar() {
    fecharCarrinho();
    document.getElementById('finalizar-pedido').scrollIntoView({ behavior: 'smooth' });
}


function finalizarPedido() {
    const tipoEnvio = document.querySelector('input[name="tipo"]:checked');
    const obs = document.getElementById('observacao').value;
    
    let itensPedido = [];
    let valorLanches = 0;

    const agrupado = {};

    carrinho.forEach(item => {
        const chave = item.nome;

        if (!agrupado[chave]) {
            agrupado[chave] = {
                nome: item.nome,
                quantidade: 0,
                preco: item.preco
            };
        }

        agrupado[chave].quantidade += Number(item.qtd) || 1;
        valorLanches += item.preco * item.qtd;
    });

    Object.values(agrupado).forEach(item => {
        itensPedido.push(`${item.quantidade}x ${item.nome} (R$ ${(item.preco * item.quantidade).toFixed(2)})`);
    });

    if (itensPedido.length === 0) return alert("Seu carrinho está vazio!");
    if (!tipoEnvio) return alert("Escolha Entrega ou Retirada!");

    if (tipoEnvio.value === "Retirada" || tipoEnvio.value === "Local") {
        exibirRevisao(itensPedido, valorLanches, 0, tipoEnvio.value, obs);
        return;
    }

    alert("Por favor, autorize a localização para calcularmos sua taxa de entrega.");
     
    navigator.geolocation.getCurrentPosition(pos => {
        const latCliente = pos.coords.latitude;
        const lonCliente = pos.coords.longitude;
        const kmDistancia = calcularDistancia(LAT_ESTABELECIMENTO, LON_ESTABELECIMENTO, latCliente, lonCliente);
       
        let foraDaArea = false;
        let taxa = 0;
        if (kmDistancia > 15) {
            foraDaArea = true;

            alert(
                "🚫 Fora da área de entrega.\n\n" +
                "Você pode enviar o pedido mesmo assim e vamos verificar 👍"
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
        else taxa = 17 + (Math.ceil(kmDistancia - 11) * 2);
        
        const agora = new Date();
        const diaSemana = agora.getDay();
        const dataFormatada = `${agora.getDate()}/${agora.getMonth() + 1}`;
        
        if (diaSemana === 0 || diaSemana === 6 || feriados.includes(dataFormatada)) {
            taxa += 1;
        }
    
        const localizacaoLink = `https://www.google.com/maps?q=${latCliente},${lonCliente}`;
        exibirRevisao(itensPedido, valorLanches, taxa, "Entrega", obs, localizacaoLink, kmDistancia, foraDaArea);
    }, (erro) => {

        if (erro.code === 1) {
            alert(
                "🚫 Você bloqueou a localização.\n\n" +
                "Para ativar:\n" +
                "1. Clique no cadeado 🔒 na barra do navegador\n" +
                "2. Permita localização\n" +
                "3. Atualize a página\n\n" +
                "Ou escolha RETIRADA."
            );
        }
        else if (erro.code === 2) {
            alert("❌ Não conseguimos obter sua localização. Tente novamente.");
        }
        else if (erro.code === 3) {
            alert("⏱️ Tempo de localização esgotado. Tente novamente.");
        }

    });
}
    function toggleTroco() {
        const isDinheiro = document.getElementById('check-dinheiro').checked;
        document.getElementById('valor-troco').style.display = isDinheiro ? 'block' : 'none';
    }

    function exibirRevisao(itens, subtotal, taxa, tipo, obs, mapa = "", km = 0, foraDaArea = false) {
        dadosPedidoTemporario = { itens, subtotal, taxa, tipo, obs, mapa, km, foraDaArea };

        document.getElementById('lista-conferencia').innerHTML = itens.join('<br>');
        document.getElementById('resumo-subtotal').innerText = `R$ ${subtotal.toFixed(2)}`;
        const campoTaxa = document.getElementById('resumo-taxa');

if (foraDaArea) {
    campoTaxa.innerText = `R$ ${taxa.toFixed(2)} (estimada)`;
} else {
    campoTaxa.innerText = `R$ ${taxa.toFixed(2)}`;
}

        let aviso = document.getElementById('aviso-fora-area');

        if (foraDaArea) {
            if (!aviso) {
                aviso = document.createElement('div');
                aviso.id = 'aviso-fora-area';
                aviso.style.marginTop = '10px';
                aviso.style.color = '#ff4444';
                aviso.style.fontWeight = 'bold';

                document.getElementById('revisao-pedido').appendChild(aviso); 
            }

            aviso.innerHTML = `
        🚫 Fora da área de entrega<br>
        📍 ${km.toFixed(2)} km<br>
        💰 Taxa pode sofrer alteração
    `;
        } else {
            if (aviso) aviso.remove();
        }
        const total = subtotal + taxa;

if (foraDaArea) {
    document.getElementById('resumo-total').innerText = `R$ ${total.toFixed(2)} (estimado)`;
} else {
    document.getElementById('resumo-total').innerText = `R$ ${total.toFixed(2)}`;
}

        document.getElementById('revisao-pedido').style.display = 'block';
        document.getElementById('revisao-pedido').scrollIntoView({ behavior: 'smooth' });
}
    


    function confirmarEEnviar() {
    
        const nomeCliente = document.getElementById('nome-cliente').value;
        const telefoneCliente = document.getElementById('telefone-cliente').value;
        if (!nomeCliente) {
            return alert("Por favor, informe seu nome!");
        }
        const precisaTroco = document.getElementById('check-dinheiro')?.checked;
        const valorTroco = document.getElementById('valor-troco')?.value;
        const telefoneLimpo = telefoneCliente.replace(/\D/g, '');

        if (telefoneLimpo && telefoneLimpo.length < 10) {
            return alert("Telefone inválido!");
        }
        const marcados = document.querySelectorAll('.check-pagamento:checked');
        if (marcados.length === 0) {
            return alert("Por favor, selecione uma forma de pagamento!");
        }

        const d = dadosPedidoTemporario;
        if (!d) return alert("Erro nos dados do pedido. Tente novamente.");

    
        const itensProcessados = carrinho.map(item => {
            return {
                nome: item.nome || "Produto",
                preco: parseFloat(item.preco) || 0,
                quantidade: parseInt(item.qtd) || 1,
                categoria: item.categoria || "Lanches"
            };
        });
        const pagamentosSelecionados = Array.from(marcados).map(el => el.value);
        const pagamento = pagamentosSelecionados.join(' + ');

        try {
            const pedidoFirebase = {
                nome: nomeCliente,
                telefone: telefoneCliente,
                itens: itensProcessados,
                valorTotal: (parseFloat(d.subtotal) + parseFloat(d.taxa)) || 0,
                taxaEntrega: parseFloat(d.taxa) || 0,
                tipo: d.tipo,
                pagamento: pagamento,
                trocoPara: (precisaTroco && valorTroco) ? Number(valorTroco) : null,
                observacao: d.obs || "",
                data: new Date().toISOString()
            };

            salvarPedidoFirebase(pedidoFirebase);

        } catch (e) {
            console.error("Erro ao salvar no Firebase:", e);
        }

        let msg = `*PEDRÃO LANCHES - NOVO PEDIDO*\n`;
        msg += `--------------------------\n`;
    
        if (nomeCliente) msg += `*Cliente:* ${nomeCliente}\n`;
        if (telefoneCliente) msg += `*Telefone:* ${telefoneCliente}\n`;
    

        msg += `--------------------------\n`;
        msg += `*Pedido:*\n${d.itens.join('\n')}\n`;
        msg += `--------------------------\n`;

    
        if (d.obs && d.obs.trim() !== "") {
            msg += `*OBS:* ${d.obs}\n`;
            msg += `--------------------------\n`;
        }

    
        if (d.tipo === "Local") msg += `*Tipo:* Comer no local 🍔\n`;
        else msg += `*Tipo:* ${d.tipo}\n`;

    
        if (d.tipo === "Entrega") {
            msg += `*Taxa:* R$ ${Number(d.taxa).toFixed(2)}`;
        
            if (d.km) {
                msg += ` (${d.km.toFixed(2)} km)`;
            }

            msg += `\n`;
        }

        msg += `--------------------------\n`;

    
        const totalFinal = (Number(d.subtotal) || 0) + (Number(d.taxa) || 0);
        msg += `*Total:* ${totalFinal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}\n`;

    
        msg += `*Pagamento:* ${pagamento}\n`;

        if (precisaTroco && valorTroco) {
            msg += `*Troco para:* R$ ${Number(valorTroco).toFixed(2)}\n`;
        }

        msg += `--------------------------\n`;

    
        if (d.tipo === "Entrega" && d.mapa) {
            msg += `📍 *Local:* ${d.mapa}\n\n`;
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

 
    
        carrinho = [];
        if (typeof atualizarCarrinho === 'function') atualizarCarrinho();
        if (typeof fecharModalCheck === 'function') fecharModalCheck();
    }

    async function salvarPedidoFirebase(pedido) {
        try {
            await db.collection("pedidos").add(pedido);
            console.log("Pedido salvo no Firebase!");
        } catch (erro) {
            console.error("Erro ao salvar:", erro);
        }
    }



    gerarItens(lanches, "container-lanches", "lanche.png");
    gerarItens(listaCombos, "container-combos", "combo.png");
    gerarItens(bebidas, "container-bebidas", "refri-latas.jpg");
    gerarItens(batatas, "container-batatas", "batata-frita.media-cortada.png");

    document.getElementById('botao-flutuante').addEventListener('click', abrirCarrinho);


    document.querySelectorAll('input[name="tipo"]').forEach(input => {
        input.addEventListener('change', (e) => {
            const campoDistancia = document.getElementById('campo-distancia');
            campoDistancia.style.display = (e.target.value === 'Entrega') ? 'block' : 'none';
        });
    });




    function calcularDistancia(lat1, lon1, lat2, lon2) {
        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
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
        const ctx = document.getElementById('meuGrafico').getContext('2d');
    
    
        if (graficoVendas) graficoVendas.destroy();

        let labels = [];
        let valores = [];
        let agrupado = {};

        if (periodo === 'hoje') {
        
            for (let i = 0; i < 24; i++) agrupado[`${i}h`] = 0;
            dadosFiltrados.forEach(v => {
                const hora = new Date(v.data || v.dataVenda).getHours();
                agrupado[`${hora}h`] += parseFloat(v.valorTotal);
            });
        } else if (periodo === 'semana') {
        
            const dias = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
            dias.forEach(d => agrupado[d] = 0);
            dadosFiltrados.forEach(v => {
                const dia = dias[new Date(v.data || v.dataVenda).getDay()];
                agrupado[dia] += parseFloat(v.valorTotal);
            });
        } else {
        
            dadosFiltrados.forEach(v => {
                const diaMes = new Date(v.data || v.dataVenda).getDate();
                agrupado[diaMes] = (agrupado[diaMes] || 0) + parseFloat(v.valorTotal);
            });
        }

        labels = Object.keys(agrupado);
        valores = Object.values(agrupado);

        graficoVendas = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Faturamento R$',
                    data: valores,
                    borderColor: '#ff0000',
                    backgroundColor: 'rgba(255, 0, 0, 0.1)',
                    fill: true,
                    tension: 0.3
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: { beginAtZero: true, grid: { color: '#333' } },
                    x: { grid: { color: '#333' } }
                },
                plugins: {
                    legend: { labels: { color: '#fff' } }
                }
            }
        });
    }

    const telInput = document.getElementById('telefone-cliente');

    if (telInput) {
        telInput.addEventListener('input', function (e) {
            let valor = e.target.value.replace(/\D/g, '');

            if (valor.length > 11) valor = valor.slice(0, 11);

            if (valor.length > 6) {
                valor = `(${valor.slice(0, 2)}) ${valor.slice(2, 7)}-${valor.slice(7)}`;
            } else if (valor.length > 2) {
                valor = `(${valor.slice(0, 2)}) ${valor.slice(2)}`;
            } else if (valor.length > 0) {
                valor = `(${valor}`;
            }

            e.target.value = valor;
        });
    }

