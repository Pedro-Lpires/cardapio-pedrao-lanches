let meuChart = null;

function atualizarGrafico(periodo, lista) {
    const ctx = document.getElementById('meuGrafico').getContext('2d');
    
    
    if (meuChart) { meuChart.destroy(); }

    let dadosAgrupados = {};
    
    
    if (periodo === 'hoje') {
        for(let i=0; i<24; i++) dadosAgrupados[`${i}h`] = 0; 
        lista.forEach(v => {
            let h = new Date(v.data).getHours();
            dadosAgrupados[`${h}h`] = (dadosAgrupados[`${h}h`] || 0) + parseFloat(v.valorTotal);
        });
    } else if (periodo === 'semana') {
        ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].forEach(d => dadosAgrupados[d] = 0);
        lista.forEach(v => {
            let d = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'][new Date(v.data).getDay()];
            dadosAgrupados[d] += parseFloat(v.valorTotal);
        });
    } else {
        lista.forEach(v => {
            let d = new Date(v.data).getDate();
            dadosAgrupados[d] = (dadosAgrupados[d] || 0) + parseFloat(v.valorTotal);
        });
    }

    meuChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: Object.keys(dadosAgrupados),
            datasets: [{
                label: 'Vendas R$',
                data: Object.values(dadosAgrupados),
                borderColor: '#e50914',
                backgroundColor: 'rgba(229, 9, 20, 0.2)',
                fill: true,
                tension: 0.3
            }]
        },
        options: {
            scales: {
                y: { ticks: { color: 'white' } },
                x: { ticks: { color: 'white' } }
            },
            plugins: { legend: { labels: { color: 'white' } } }
        }
    });
}
function processar(periodo) {
    let vendas = JSON.parse(localStorage.getItem('vendas') || '[]');
    let agora = new Date();
    let soma = { geral: 0, lanches: 0, bebidas: 0, combos: 0, batatas: 0, motoboy: 0, ent: 0, ret: 0, local: 0 };

    let filtrados = []; 

    vendas.forEach(v => {
        let dv = new Date(v.data);
        let ok = false;

        if (periodo === 'hoje') {
            ok = dv.toDateString() === agora.toDateString();
        } 
        else if (periodo === 'semana') {
    let inicioSemana = new Date(agora);
    inicioSemana.setHours(0,0,0,0);
    inicioSemana.setDate(agora.getDate() - agora.getDay()); 

    let fimSemana = new Date(inicioSemana);
    fimSemana.setDate(inicioSemana.getDate() + 6); 
    fimSemana.setHours(23,59,59,999);

    ok = dv >= inicioSemana && dv <= fimSemana;
}
        else if (periodo === 'mes') {
            ok = dv.getMonth() === agora.getMonth() && dv.getFullYear() === agora.getFullYear();
        }

        if (ok) {
            filtrados.push(v); 

            let totalPedido = Number(v.valorTotal) || 0;
            soma.geral += totalPedido;

            if (v.itens) {
                v.itens.forEach(i => {
                    let sub = (Number(i.preco) || 0) * (Number(i.quantidade) || 1);
                    let nome = (i.nome || "").toLowerCase();
                    let cat = (i.categoria || "").toLowerCase();

                    if (cat === 'bebidas' || nome.includes('coca') || nome.includes('fanta') || nome.includes('guaraná')) {
                        soma.bebidas += sub;
                    } 
                    else if (cat === 'combos' || nome.includes('combo')) {
                        soma.combos += sub;
                    } 
                    else if (cat === 'batatas' || nome.includes('batata')) {
                        soma.batatas += sub;
                    } 
                    else {
                        soma.lanches += sub;
                    }
                });
            }

            soma.motoboy += Number(v.taxaEntrega) || 0;
            if (v.tipo === 'Entrega') {
    soma.ent += totalPedido;
} 
else if (v.tipo === 'Retirada') {
    soma.ret += totalPedido;
} 
else if (v.tipo === 'Local') {
    soma.local += totalPedido;
}
        }
    });

    atualizarGrafico(periodo, filtrados);

    const f = (n) => n.toLocaleString('pt-br', {style:'currency', currency:'BRL'});
    
    const campos = {
        'resumo-geral': soma.geral,
        'resumo-lanches': soma.lanches,
        'resumo-bebidas': soma.bebidas,
        'resumo-combos': soma.combos,
        'resumo-batatas': soma.batatas,
        'resumo-taxas-motoboy': soma.motoboy,
        'resumo-faturamento-entrega': soma.ent,
        'resumo-faturamento-retirada': soma.ret,
        'resumo-faturamento-local': soma.local
    };

    for (let id in campos) {
        let el = document.getElementById(id);
        if (el) el.innerText = f(campos[id]);
    }
}


window.onload = () => processar('hoje');


