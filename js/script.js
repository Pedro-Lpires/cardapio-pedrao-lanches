
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
        nome: "Baguncinha", preco: 25, desc: "Pão, hambúrguer artesanal, salsicha, ovo, presunto, mussarela, alface e tomate", precoIndustrial: 18, img: "bg.png"
    },
    {
        nome: "Baguncinha com Bacon", preco: 26,  precoIndustrial: 23, desc: "Pão, hambúrguer artesanal, salsicha, bacon, ovo, presunto, mussarela, alface e tomate", img: "bg-com-bacon.png"
    },
    {
        nome: "Baguncinha de Frango", preco: 25, desc: "Pão, filé de frango, salsicha, ovo, presunto, mussarela, alface e tomate", img: "baguncinha-de-frango.png"
    },
    {
        nome: "Burrito cuiabano", preco: 20, precoIndustrial: 18, precoFrango: 20, desc: "Pão, hambúrguer artesanal triturado, molho vermelho, alface e tomate picado, presunto mussarela. * (opção de substituir o hamburguer por filé de frango)" , img: "burrito.png"
    },
    {
        nome: "X-Burguer", preco: 18, precoIndustrial: 15, desc: "Pão, hambúrguer artesanal, 1 fatia de presunto e 1 de mussarela", img: "xburguer.png"
    },
     {
        nome: "X-Bacon", preco: 25, precoIndustrial: 23, desc: "Pão, hambúrguer artesanal, bacon, presunto e mussarela",img: "x-bacon.png"
    },
    {
        nome: "X-Bacon Salada", preco: 28, precoIndustrial: 25, desc: "Pão, hambúrguer artesanal, bacon, presunto, mussarela, alface e tomate", img: "bacon-salada.png"
    },
     {
        nome: "X-Salada", preco: 20,  precoIndustrial: 17, desc: "Pão, hambúrguer artesanal, presunto, mussarela, alface e tomate",img: "xsalada.png"
    },
    {
        nome: "X-Frango Bacon Salada", preco: 28, desc: "Pão, Filé de frango, bacon, presunto, mussarela, alface e tomate", img: "frango-bacon-salada.png"
    },
    {
        nome: "Frango Salada", preco: 23, desc: "Pão, filé de frango, presunto, mussarela, alface, tomate e milho verde)" ,img: "frango-salada.png"
    },
    {
        nome: "Americano Especial", preco: 26, precoIndustrial: 23, desc: "Pão, hambúrguer artesanal, 2 ovos, 2 fatias de presunto, 2 fatias de mussarela, alface e tomate", img: "americano-especial.png"
    },
    {
        nome: "Bauru", preco: 11, desc: "Pão, 2 fatias de presunto, 2 fatias de mussarela", img: "bauru.png"
    },
     {
        nome: "X-Egg", preco: 25,  precoIndustrial: 21, desc: "Pão, hambúrguer artesanal, 2 ovos, presunto, mussarela, alface e tomate", img: "xegg.png"
    },
    {
        nome: "X-Calabresa", preco: 25,  precoIndustrial: 21, desc: "Pão, hambúrguer artesanal, calabresa, presunto, mussarela", img: "x-calabresa.png"
    },
    {
        nome: "X-Calabresa Salada", preco: 26,  precoIndustrial: 23, desc: "Pão, hambúrguer artesanal, calabresa, presunto, mussarela, alface e tomate", img: "calabresa-salada.png"
    },
    {
        nome: "Hot Dog Prensado de Frango", preco: 18, desc: "Pão, salsicha grelhada na chapa, frango picotado, presunto, mussarela, batata palha e milho verde)", img: "prensado.png"
    },
    {
        nome: "Hot Dog Prensado de Calabresa", preco: 18, desc: "Pão, salsicha grelhada na chapa, frango picotado, presunto, mussarela, batata palha e milho verde)", img: "prensado.png"
    },
    {
        nome: "Hot Dog Prensado Bacon", preco: 20, desc: "Pão, salsicha grelhada na chapa, bacon, presunto, mussarela, batata palha e milho verde)", img: "prensado.png"
    },
    {
        nome: "Hot Dog simples", preco: 9, desc: "Pão, 1 salsicha, molho, batata palha", img: "hot-dog.jpg"
    },
    {
        nome: "Hot Dog especial", preco: 15, desc: "Pão, 2 salsicha, molho, mussarela, milho verde e batata palha", img: "hot-dog.jpg"
    },
    {
        nome: "X-Mignon", preco: 28, desc: "Pão, 2 fatias de presunto e 2 fatias de mussarela", img: "xmignon.png"
    },
    {
        nome: "Mignon Salada", preco: 28, desc: "Pão, filé mignon, presunto, mussarela, alface e tomate", img: "xmignon-salada.png"
    },
    {
        nome: "Paulistinha", preco: 28, desc: "Pão, filé mignon, cebola grelhada,  presunto, mussarela e tomate", img: "paulistinha.png"
    },
    {
        nome: "Paulistão", preco: 31, desc: "Pão, filé mignon, cebola grelhada, calabresa, ovo, presunto, mussarela e tomate", img: "paulistao.png"
    },
    {
        nome: "X-Bagunça", preco: 30,  precoIndustrial: 27, desc: "Pão, hambúrguer artesanal, salsicha, calabresa, bacon, ovo, presunto, mussarela, alface e tomate", img: "x-bg.png"
    },
    {
        nome: "X-Filé Bagunça", preco: 33, desc: "Pão, filé mignon, salsicha, calabresa, bacon, ovo, presunto, mussarela, alface e tomate", img: "x-file-bg.png"
    },
    {
        nome: "Frango Bagunça", preco: 30, desc: "Pão, filé de frango, salsicha, calabresa, bacon, ovo, presunto, mussarela, alface e tomate", img: "frango-bagunca.png"
    },
    {
        nome: "Big Big", preco: 30,  precoIndustrial: 28, desc: "Pão, 2 hambúrguer artesanal, 2 ovos, 2 fatias de presunto, 2 fatias de mussarela, batata palha, milho verde, alface e tomate", img: "big.png"
    },
    {
        nome: "X-tudo", preco: 45,  precoIndustrial: 43, desc: "Pão, hambúrguer artesanal, filé mignon, filé de frango, salsicha, calabresa, bacon, ovo, presunto, mussarela, alface, tomate, batata palha e milho verde)", img: "x-tudo.png"
    },
    
    
];
const listaCombos = [
    
    {
        nome: "Combo 3 Caseiro",
        preco: 80,
        desc: "3 Baguncinha Caseiro + Refrigerante 1,5L",
        img:"3baguncinha.png"
    },
    {
        nome: "Combo 3 X-Bacon",
        preco: 80,
        desc: "3 X-Bacon + Refrigerante 1,5L",
        img:"3xbacon.png"
    },
    {
        nome: "Combo 3 X-Bagunça",
        preco: 95,
        desc: "3 X-Bagunça + Refrigerante 1,5L ",
        img:"3xbagunca.png"
    },
    {
        nome: "Combo 3 Big Big",
        preco: 95,
        desc: "3 Big BIG + Refrigerante 1,5L ",
        img:"3big.png"
    },
    {
        nome: "Combo 5 Artesanal",
        preco: 130,
        desc: "5 Baguncinha Caseiro + Refrigerante 2L ",
        img:"5baguncinha.png"
    },
    
    {
        nome: "Combo 4 Industrial",
        preco: 75,
        desc: "4 Baguncinha industrial + Refrigerante 1,5L",
        img:"4baguncinha.png"
    },

    { 
        nome: "Combo 2 X-Tudo", 
        preco: 110, 
        desc: "2 X-Tudo + Batata Frita média + Refrigerante 1,5L ", 
        img: "2tudo.png" 
    },
    
    {
        nome: "Combo 2 Filé Bagunça",
        preco: 85,
        desc: "2 Filé Mignon Bagunça + Batata Frita média + Refrigerante 1,5L ",
        img:"2filebagunca.png"
    },
    {
        nome: "Combo 2 X-Bagunça",
        preco: 80,
        desc: "2 X-Bagunça + Batata Frita média + Refrigerante 1,5L ",
        img:"2xbagunca.png"
    },
    {
        nome: "Combo 2 Big Big",
        preco: 80,
        desc: "2 Big BIG + Batata Frita média + Refrigerante 1,5L ",
        img:"2big.png"
    },
     {
        nome: "Combo 2 Artesanal",
        preco: 70,
        desc: "2 Baguncinha Caseiro + 2 Batata Frita pequena + 2 Refrigerantes latas",
        img:"2baguncinhaartesanal.png"
    },
    
    {
        nome: "Combo 2 Industrial",
        preco: 56,
        desc: "2 Baguncinha Industrial + 1 Batata Frita Média + 2 Refrigerantes latas",
        img:"2baguncinhaindustrial.png"
    },
    
   
    
];

const bebidas = [
    { nome: "Água com gás ", preco: 5.00, desc: "500ml", img: "agua.mineral.webp" },
    { nome: "Água sem gás", preco: 5.00, desc: "500ml", img: "agua.mineral.webp" },
    { nome: "Coca (Lata)", preco: 8.00, desc: "290ml a 350ml",img: "coca-lata.png" },
    { nome: "Guaraná Antarctica (Lata)", preco: 8.00, desc: "290ml a 350ml", img: "guarana-lata.png" },
    { nome: "Coca (Garrafinha)", preco: 9.00, desc: "450ml a 600ml", img: "coca-500ml.png" },
    { nome: "Coca (1L)", preco: 10.00, desc: "1 Litro", img: "coca-1l-casco.png" },
    { nome: "Fanta (1L)", preco: 10.00, desc: "1 Litro", img: "fanta-1l.png" },
    { nome: "Coca (1,5L)", preco: 15.00, desc: "1,5 Litros", img: "coca1,5l.png" },
    { nome: "Guaraná Antarctica (1,5L)", preco: 15.00, desc: "1,5 Litros", img:"guarana-antarctica-1,5l.png" },
    { nome: "Coca 2L", preco: 20.00, desc: "2 Litros", img: "coca2l.webp" },
    { nome: "Guaraná Antarctica 2L", preco: 20.00, desc: "2 Litros", img:"guarana-antarctica-2l.png" },
];

const batatas = [
    { nome: "Batata Pequena", preco: 15.00, desc: "Porção de 150g", img: "batata-frita-pequena-cortada.png" },
    { nome: "Batata Média", preco: 20.00, desc: "Porção de 300g", img:"batata-frita-media-cortada.png" },
    { nome: "Batata Grande", preco: 30.00, desc: "Porção de 450g", img:"batata-frita-grande-cortada.png" }
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
            <img src="images/${fotoFinal}" alt="${item.nome}">
            <h3>${item.nome}</h3>
            <p class="ingredientes">${item.desc}</p>
            <span class="preco">R$ ${item.preco.toFixed(2)}</span>
            ${botaoHTML}
        `;

        container.appendChild(card);
    });
}

function adicionarDiretoCarrinho(nome, preco, categoria = "Lanches") {
    carrinho.push({ nome, qtd: 1, preco, categoria });
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


function confirmarEscolha() {
    const qtdInd = parseInt(document.getElementById('qtd-industrial').value) || 0;
    const qtdArt = parseInt(document.getElementById('qtd-artesanal').value) || 0;
    const qtdFrango = parseInt(document.getElementById('qtd-frango').value) || 0;

    if (qtdInd > 0) carrinho.push({ 
        nome: `${lancheSendoEscolhido.nome} (Industrial)`, 
        qtd: qtdInd, 
        preco: lancheSendoEscolhido.precoIndustrial,
        categoria: "Lanches"
    });

    if (qtdArt > 0) carrinho.push({ 
        nome: `${lancheSendoEscolhido.nome} (Artesanal)`, 
        qtd: qtdArt, 
        preco: lancheSendoEscolhido.precoArtesanal,
        categoria: "Lanches"
    });

    if (qtdFrango > 0) carrinho.push({ 
        nome: `${lancheSendoEscolhido.nome} (Frango)`, 
        qtd: qtdFrango, 
        preco: lancheSendoEscolhido.precoFrango,
        categoria: "Lanches"
    });

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

function limparCarrinho() {
    if (confirm("Deseja realmente apagar todo o pedido e recomeçar?")) {
       
        document.querySelectorAll('.qtd-input').forEach(input => {
            input.value = 0;
        });

        
        if (typeof valorTotal !== 'undefined') valorTotal = 0; 
        if (typeof carrinho !== 'undefined') carrinho = [];
        if (typeof subtotal !== 'undefined') subtotal = 0;

        
        const totalFlutuante = document.getElementById('valor-total-flutuante');
        if (totalFlutuante) totalFlutuante.innerText = "0,00";
        
        const resumoTotal = document.getElementById('resumo-total');
        if (resumoTotal) resumoTotal.innerText = "0,00";

        
        document.getElementById('observacao').value = "";
        document.getElementById('revisao-pedido').style.display = 'none';
        
        
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}
function finalizarPedido() {
    const tipoEnvio = document.querySelector('input[name="tipo"]:checked');
    const obs = document.getElementById('observacao').value;
    
    let itensPedido = [];
    let valorLanches = 0;

    carrinho.forEach(item => {
        itensPedido.push(`${item.qtd}x ${item.nome} (R$ ${(item.preco * item.qtd).toFixed(2)})`);
        valorLanches += (item.preco * item.qtd);
    });

    if (itensPedido.length === 0) return alert("Seu carrinho está vazio!");
    if (!tipoEnvio) return alert("Escolha Entrega ou Retirada!");

    if (tipoEnvio.value === "Retirada") {
        exibirRevisao(itensPedido, valorLanches, 0, "Retirada", obs);
        return;
    }

    alert("Por favor, autorize a localização para calcularmos sua taxa de entrega.");
    navigator.geolocation.getCurrentPosition(pos => {
        const latCliente = pos.coords.latitude;
        const lonCliente = pos.coords.longitude;
        const kmDistancia = calcularDistancia(LAT_ESTABELECIMENTO, LON_ESTABELECIMENTO, latCliente, lonCliente);
        
       
        let taxa = 0;
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
    else if (kmDistancia <= 12) taxa = 18;
    else if (kmDistancia <= 13) taxa = 19;
    else if (kmDistancia <= 14) taxa = 20;
    else if (kmDistancia <= 15) taxa = 21;
    else if (kmDistancia <= 16) taxa = 22;
    else if (kmDistancia <= 17) taxa = 23;
    else if (kmDistancia <= 18) taxa = 24;
    else if (kmDistancia <= 19) taxa = 25;
    else if (kmDistancia <= 20) taxa = 26;    
        else taxa = 26 + (Math.floor(kmDistancia - 20) * 2); 
        
        const agora = new Date();
        const diaSemana = agora.getDay(); 
        const dataFormatada = `${agora.getDate()}/${agora.getMonth() + 1}`;
        
        if (diaSemana === 0 || diaSemana === 6 || feriados.includes(dataFormatada)) {
            taxa += 1; 
        }
        const localizacaoLink = `https://www.google.com/maps?q=${latCliente},${lonCliente}`;
      exibirRevisao(itensPedido, valorLanches, taxa, "Entrega", obs, localizacaoLink, kmDistancia);
    }, () => {
        alert("Não conseguimos calcular sua taxa sem a localização. Por favor, escolha a opção Retirada ou tente novamente.");

        const divRevisao = document.getElementById('revisao-pedido');
    divRevisao.style.display = 'block';

    
    divRevisao.scrollIntoView({ behavior: 'smooth' });

    });
}
function toggleTroco() {
    const isDinheiro = document.getElementById('check-dinheiro').checked;
    document.getElementById('valor-troco').style.display = isDinheiro ? 'block' : 'none';
}

function exibirRevisao(itens, subtotal, taxa, tipo, obs, mapa = "", km = 0) {
    dadosPedidoTemporario = { itens, subtotal, taxa, tipo, obs, mapa, km };

    document.getElementById('lista-conferencia').innerHTML = itens.join('<br>');
    document.getElementById('resumo-subtotal').innerText = `R$ ${subtotal.toFixed(2)}`;
    document.getElementById('resumo-taxa').innerText = `R$ ${taxa.toFixed(2)}`;
    document.getElementById('resumo-total').innerText = `R$ ${(subtotal + taxa).toFixed(2)}`;

    document.getElementById('revisao-pedido').style.display = 'block';
    document.getElementById('revisao-pedido').scrollIntoView({ behavior: 'smooth' });
}

function confirmarEEnviar() {
    
    const nomeCliente = document.getElementById('nome-cliente').value;
    const telefoneCliente = document.getElementById('telefone-cliente').value;
     if (!nomeCliente) {
        return alert("Por favor, informe seu nome!");
    }

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

    
    try {
        const novaVenda = {
            itens: itensProcessados,
            valorTotal: (parseFloat(d.subtotal) + parseFloat(d.taxa)) || 0,
            taxaEntrega: parseFloat(d.taxa) || 0,
            tipo: d.tipo,
            data: new Date().toISOString()
        };

        let vendas = JSON.parse(localStorage.getItem('vendas') || '[]');
        vendas.push(novaVenda);
        localStorage.setItem('vendas', JSON.stringify(vendas));
    } catch (e) {
        console.error("Erro ao salvar venda:", e);
    }

    
       const pagamento = marcados[0].value;

    
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

    
    msg += `*Tipo:* ${d.tipo}\n`;

    
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

    msg += `--------------------------\n`;

    
    if (d.tipo === "Entrega" && d.mapa) {
        msg += `📍 *Local:* ${d.mapa}\n`;
    }

    
    const url = `https://wa.me/5565992386045?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank");

    
    
    carrinho = [];
    if (typeof atualizarCarrinho === 'function') atualizarCarrinho();
    if (typeof fecharModalCheck === 'function') fecharModalCheck();
}




gerarItens(lanches, "container-lanches", "lanche.png");
gerarItens(listaCombos, "container-combos", "combo.png");
gerarItens(bebidas, "container-bebidas", "refri-latas.jpg");
gerarItens(batatas, "container-batatas", "batata-frita.media-cortada.png");

document.getElementById('botao-flutuante').addEventListener('click', () => {
    document.getElementById('finalizar-pedido').scrollIntoView({ behavior: 'smooth' });
});




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
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
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
        
        for(let i=0; i<24; i++) agrupado[`${i}h`] = 0;
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
            valor = `(${valor.slice(0,2)}) ${valor.slice(2,7)}-${valor.slice(7)}`;
        } else if (valor.length > 2) {
            valor = `(${valor.slice(0,2)}) ${valor.slice(2)}`;
        } else if (valor.length > 0) {
            valor = `(${valor}`;
        }

        e.target.value = valor;
    });
}