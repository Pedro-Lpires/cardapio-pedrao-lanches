/*

=====================================

PAINEL UNIVERSAL DO PRODUTO

Usado por:

- Cliente

- Atendente

- Edição da Comanda

- Combos

=====================================

*/
async function abrirPainelProduto(
    comandaId,
    produtoId
) {
console.log("ABRIU O PAINEL");
    const doc =
        await db
            .collection("produtos")
            .doc(produtoId)
            .get();

    if (!doc.exists)
        return;

    const produto =
        doc.data();
    console.log(produto);

    const painel =
document.getElementById(
"area-comanda-atendente"
);document.getElementById(
    "area-produtos-comanda"
).style.display = "none";

    painel.style.display =
        "block";
console.log("VAI ESCREVER O HTML");
   painel.innerHTML = `

<button
onclick="
abrirComandaVisual(
'${comandaId}'
)
"
>
⬅ Voltar
</button>

<h2>${produto.nome}</h2>

<h3>

R$ ${Number(
produto.preco
).toFixed(2)}

</h3>

`;

console.log("HTML ESCRITO");
}

async function carregarCategoriaProdutos(
    comandaId,
    categoria
) {

    const lista =
        document.getElementById(
            "lista-categoria-produtos"
        );

    lista.innerHTML =
        "Carregando...";

    const snap =
    await db
        .collection("produtos")
        .orderBy("ordem")
        .get();

    let html = "";

   snap.forEach(doc => {

    const p =
        doc.data();

    if (!p.ativo)
        return;

    if (
        p.categoria != categoria
    )
        return;

    html += `

<button
onclick="
abrirPainelProduto(
'${comandaId}',
'${doc.id}'
)
"
>

${p.nome}

</button>

<br><br>

`;

    });

    document.getElementById(
"resultado-busca-produtos"
).innerHTML = "";

lista.innerHTML = html;

}