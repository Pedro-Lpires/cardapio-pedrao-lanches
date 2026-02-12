const lanches = [ { nome: "Baguncinha", preco: 19.99, desc: "Pão, hambúrguer artesanal, salsicha, ovo, presunto, mussarela, alface e tomate" },
    { nome: "Baguncinha simples", preco: 14.99, desc: "Pão, hambúrguer industrial, salsicha, ovo, presunto, mussarela, alface e tomate" },
    { nome: "Baguncinha de Frango", preco: 19.99, desc: "Pão, filé de frango, salsicha, ovo, presunto, mussarela, alface e tomate", img:"baguncinha-de-frango-cortado.png" },
    { nome: "Burrito cuiabano", preco: 16.99, desc: "Pão, hambúrguer artesanal triturado, molho vermelho, alface e tomate picado, presunto mussarela. * (opção de substituir o hamburguer por filé de frango)" },
    { nome: "X-Burguer", preco: 16.99, desc: "Pão, hambúrguer artesanal, 1 fatia de presunto e 1 de mussarela" },
    { nome: "Americano Especial", preco: 23.99, desc: "Pão, hambúrguer artesanal, 2 ovos, 2 fatias de presunto, 2 fatias de mussarela, alface e tomate" },
    { nome: "X-Salada", preco: 19.99, desc: "Pão, hambúrguer artesanal, presunto, mussarela, alface e tomate" },
    { nome: "X-Bacon", preco: 21.99, desc: "Pão, hambúrguer artesanal, bacon, presunto e mussarela" },
    { nome: "X-Bacon Salada", preco: 23.99, desc: "Pão, hambúrguer artesanal, bacon, presunto, mussarela, alface e tomate" },
    { nome: "X-Frango Bacon Salada", preco: 23.99, desc: "Pão, Filé de frango, bacon, presunto, mussarela, alface e tomate" },
    { nome: "Hot Dog Prensado de Frango", preco: 15.99, desc: "Pão, salsicha grelhada na chapa, frango picotado, presunto, mussarela. * (opcional: batata palha e milho verde)", img:"prensado-de-frango-cortado.png" },
    { nome: "Hot Dog Prensado de Calabresa", preco: 15.99, desc: "Pão, salsicha grelhada na chapa, frango picotado, presunto, mussarela. * (opcional: batata palha e milho verde)", img:"prensado-de-frango-cortado.png"},
    { nome: "Hot Dog simples", preco: 8.99, desc: "Pão, 1 salsicha, molho, batata palha", img:"hot-dog.jpg" },
    { nome: "Hot Dog especial", preco: 12.99, desc: "Pão, 1 salsicha, molho, mussarela, milho verde e batata palha", img:"hot-dog.jpg" },
    { nome: "X-Mignon", preco: 23.99, desc: "Pão, 2 fatias de presunto e 2 fatias de mussarela" },
    { nome: "Bauru", preco: 10.99, desc: "Pão, 2 fatias de presunto, 2 fatias de mussarela" },
    { nome: "X-Egg", preco: 20.99, desc: "Pão, hambúrguer artesanal, ovo, presunto, mussarela, alface e tomate" },
    { nome: "X-Calabresa", preco: 20.99, desc: "Pão, hambúrguer artesanal, calabresa, presunto, mussarela" },
    { nome: "Calabresinha", preco: 14.99, desc: "Pão, cebola grelhada, presunto, mussarela" },
    { nome: "X-Calabresa Salada", preco: 21.99, desc: "Pão, hambúrguer artesanal, calabresa, presunto, mussarela, alface e tomate" },
    { nome: "X-tudo", preco: 39.99, desc: "Pão, hambúrguer artesanal, filé mignon, filé de frango, salsicha, calabresa, bacon, ovo, presunto, mussarela, alface e tomate. * (opcional: batata palha e milho verde)" },
    { nome: "X-Bagunça", preco: 25.99, desc: "Pão, hambúrguer artesanal, salsicha, calabresa, bacon, ovo, presunto, mussarela, alface e tomate" },
    { nome: "Baguncinha com Bacon", preco: 21.99, desc: "Pão, hambúrguer artesanal, salsicha, bacon, ovo, presunto, mussarela, alface e tomate" },
    { nome: "Big Big", preco: 26.99, desc: "Pão, 2 hambúrguer artesanal, 2 ovos, 2 fatias de presunto, 2 fatias de mussarela, batata palha, milho verde, alface e tomate" },
    { nome: "X-Filé Bagunça", preco: 27.99, desc: "Pão, filé mignon, salsicha, calabresa, bacon, ovo, presunto, mussarela, alface e tomate" },
    { nome: "Frango Bagunça", preco: 25.99, desc: "Pão, filé de frango, salsicha, calabresa, bacon, ovo, presunto, mussarela, alface e tomate" },
    { nome: "Frango Salada", preco: 19.99, desc: "Pão, filé de frango, presunto, mussarela, alface e tomate. * (opcional: milho verde)" },
    { nome: "Mignon Salada", preco: 24.99, desc: "Pão, filé mignon, presunto, mussarela, alface e tomate", img:"-mignon.salada-cortada.png" },
    { nome: "Pap's Especial", preco: 26.99, desc: "Pão, filé mignon, presunto, mussarela, alface e tomate" },
    { nome: "Paulistinha", preco: 23.99, desc: "Pão, filé mignon, cebola grelhada,  presunto, mussarela e tomate", img:"paulistinha-cortada.png" },
    { nome: "Paulistão", preco: 26.99, desc: "Pão, filé mignon, cebola grelhada, calabresa, ovo, presunto, mussarela e tomate" },
];
const listaCombos = [
    { 
        nome: "Combo Paulistinha", 
        preco: 35.00, 
        desc: "1 Paulistinha + Batata Frita pequena + 1 Refrigerante pequeno(200ml) ", 
        img: "combo-paulistinha.png" 
    },
    { 
        nome: "Combo X-Tudo", 
        preco: 98.00, 
        desc: "2 X-Tudo + Batata Frita média + Refrigerante 1L ", 
        img: "combo-2-xtudo.png" 
    },
    {
        nome: "Combo 4 Industrial",
        preco: 60.00,
        desc: "4 Baguncinha industrial + Refrigerante 1L",
        img:"combo-4-industrial.png"
    },
    {
        nome: "Combo 2 Artesanal",
        preco: 60.00,
        desc: "2 Baguncinha Caseiro + 2 Batata Frita pequena + 2 Refrigerante pequeno(200ml)",
        img:"combo-2-bg-caseiro.png"
    },
    {
        nome: "Combo 3 Caseiro",
        preco: 60.00,
        desc: "3 Baguncinha Caseiro + Refrigerante 1L",
        img:"combo-3-bg-caseiro.png"
    },
    {
        nome: "Combo 3 X-Bacon",
        preco: 70.00,
        desc: "3 X-Bacon + Refrigerante 1L",
        img:"combo-3-xbacon.png"
    },
    {
        nome: "Combo 3 X-Bagunça",
        preco: 81.00,
        desc: "3 X-Bagunça + Refrigerante 1L ",
        img:"combo-3-xbagunca.png"
    },
    {
        nome: "Combo Filé Bagunça",
        preco: 76.00,
        desc: "2 Filé Mignon Bagunça + Batata Frita média + Refrigerante 1L ",
        img:"file-bagunca.png"
    },
    {
        nome: "Combo 5 Artesanal",
        preco: 100.00,
        desc: "5 Baguncinha Caseiro + Refrigerante 2L ",
        img:"combo-5bg-caseiro.png"
    },
    {
        nome: "Combo 2 Industrial",
        preco: 50.00,
        desc: "2 Baguncinha Industrial + 2 Batata Frita pequena + 2 Refrigerante pequeno (200ml)  ",
        img:"2-industrial.png"
    },
    {
        nome: "Combo 2 X-Bagunça",
        preco: 71.00,
        desc: "2 X-Bagunça + Batata Frita média + Refrigerante 1L ",
        img:"combo-2-xbagunca.png"
    },
    {
        nome: "Combo Big Big",
        preco: 75.00,
        desc: "2 Big BIG + Batata Frita média + Refrigerante 1L ",
        img:"combo-big.png"
    },
];

const bebidas = [ { nome: "Água (com ou sem gás)", preco: 5.00, desc: "500ml", img:"agua.mineral.webp" },
    { nome: "Refrigerante ou Suco (Lata)", preco: 8.00, desc: "290ml a 350ml" },
    { nome: "Refrigerante ou Suco (garrafinha)", preco: 9.00, desc: "450ml a 600ml" },
    { nome: "Refrigerante (1L)", preco: 10.00, desc: "1 Litro", img: "coca-1l-casco.png" },
    { nome: "Refrigerante (1,5L)", preco: 15.00, desc: "1,5 Litros", img:"refri.1,5l.jpg" },
    { nome: "Coca 2L", preco: 20.00, desc: "2 Litros", img:"coca.png" },
    { nome: "Cerveja", preco: 6.00, desc: "290ml", img: "cerveja.jpg" },
];

const batatas = [  { nome: "Batata Pequena", preco: 12.00, desc: "Porção de 150g", img:"batata-frita-pequena-cortada.png" },
    { nome: "Batata Média", preco: 18.00, desc: "Porção de 300g", img:"batata-frita-media-cortada.png" },
    { nome: "Batata Grande", preco: 25.00, desc: "Porção de 450g", img:"batata-frita-grande-cortada.png" }
];

function gerarItens(lista, containerId, imagemPadrao) {
    const container = document.getElementById(containerId);
    if (!container) return;

    lista.forEach(item => {
        const fotoFinal = item.img ? item.img : imagemPadrao;
        const card = document.createElement("div");
        card.classList.add("card");
        card.innerHTML = `
            <img src="images/${fotoFinal}" alt="${item.nome}">
            <h3>${item.nome}</h3>
            <p class="ingredientes">${item.desc}</p>
            <span class="preco">R$ ${item.preco.toFixed(2)}</span>
            <div class="quantidade-controle">
                <button class="btn-qtd" onclick="ajustarQtd(this, -1)">-</button>
                <input type="number" value="0" class="qtd-input" data-nome="${item.nome}" data-preco="${item.preco}" readonly>
                <button class="btn-qtd" onclick="ajustarQtd(this, 1)">+</button>
            </div>
        `;
        container.appendChild(card);
    });
}

function ajustarQtd(btn, mudanca) {
    const input = btn.parentElement.querySelector('.qtd-input');
    let valor = parseInt(input.value) + mudanca;
    if (valor < 0) valor = 0;
    input.value = valor;
    atualizarCarrinho();
}

function atualizarCarrinho() {
    const inputs = document.querySelectorAll('.qtd-input');
    const botao = document.getElementById('botao-flutuante');
    const valorTexto = document.getElementById('valor-total-flutuante');
    let total = 0;

    inputs.forEach(input => {
        total += (parseInt(input.value) || 0) * (parseFloat(input.getAttribute('data-preco')) || 0);
    });

    if (total > 0) {
        botao.style.display = 'flex';
        valorTexto.innerText = total.toFixed(2).replace('.', ',');
    } else {
        botao.style.display = 'none';
    }
}

function finalizarPedido() {
    const inputs = document.querySelectorAll('.qtd-input');
    const tipoEnvio = document.querySelector('input[name="tipo"]:checked');
    const obs = document.getElementById('observacao').value;
    
    let itensPedido = [];
    let valorTotal = 0;

    inputs.forEach(input => {
        let qtd = parseInt(input.value);
        if (qtd > 0) {
            let nome = input.getAttribute('data-nome');
            let preco = parseFloat(input.getAttribute('data-preco'));
            itensPedido.push(`${qtd}x ${nome} (R$ ${(preco * qtd).toFixed(2)})`);
            valorTotal += (preco * qtd);
        }
    });

    if (itensPedido.length === 0) return alert("Seu carrinho está vazio!");
    if (!tipoEnvio) return alert("Escolha Entrega ou Retirada!");

    let msg = `*PEDRÃO LANCHES - NOVO PEDIDO*\n`;
    msg += `--------------------------\n${itensPedido.join('\n')}\n`;
    if (obs.trim()) msg += `\n*OBS:* ${obs}\n`;
    msg += `--------------------------\n*TOTAL: R$ ${valorTotal.toFixed(2)}*\n*Forma:* ${tipoEnvio.value}`;

    if (tipoEnvio.value === "Entrega") {
        navigator.geolocation.getCurrentPosition(pos => {
            const link = `https://www.google.com/maps?q=${pos.coords.latitude},${pos.coords.longitude}`;
            msg += `\n📍 *Localização:* ${link}`;
            window.open(`https://wa.me/5565992386045?text=${encodeURIComponent(msg)}`, "_blank");
        }, () => {
            window.open(`https://wa.me/5565992386045?text=${encodeURIComponent(msg)}`, "_blank");
        });
    } else {
        window.open(`https://wa.me/5565992386045?text=${encodeURIComponent(msg)}`, "_blank");
    }
}

gerarItens(lanches, "container-lanches", "lanche.png");
gerarItens(listaCombos, "container-combos", "combo.png");
gerarItens(bebidas, "container-bebidas", "refri-latas.jpg");
gerarItens(batatas, "container-batatas", "batata-frita.media-cortada.png");

document.getElementById('botao-flutuante').addEventListener('click', () => {
    document.getElementById('finalizar-pedido').scrollIntoView({ behavior: 'smooth' });
});