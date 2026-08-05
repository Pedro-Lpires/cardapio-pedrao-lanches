
let mesaAbertaAtual = null;
let comandaAbertaAtual = null;
let modoRemoverItem = false;

async function loginAtendente() {

    const codigo =
        document
            .getElementById(
                "codigo-atendente"
            )
            .value
            .trim();

    if (!codigo) {

        alert(
            "Digite o código."
        );

        return;
    }

    const snap =
        await db
            .collection("atendentes")
            .where(
                "codigo",
                "==",
                codigo
            )
            .where(
                "ativo",
                "==",
                true
            )
            .get();

    if (snap.empty) {

        alert(
            "Código inválido."
        );

        return;
    }

    const atendente =
        snap.docs[0];

    localStorage.setItem(
        "atendenteId",
        atendente.id
    );

    localStorage.setItem(
        "atendenteNome",
        atendente.data().nome
    );

    location.href =
        "painel-atendente.html";
}
const nomeAtendente =
    localStorage.getItem(
        "atendenteNome"
    );

const boxNome =
    document.getElementById(
        "nome-atendente"
    );

if (
    boxNome &&
    nomeAtendente
) {

    boxNome.innerText =
        `Bem-vindo, ${nomeAtendente}`;
}

function logoutAtendente() {

    localStorage.removeItem(
        "atendenteId"
    );

    localStorage.removeItem(
        "atendenteNome"
    );

    location.href =
        "atendente.html";
}
async function abrirConsumoLocal() {

    const area =
        document.getElementById(
            "area-consumo-local"
        );

    area.style.display =
        area.style.display === "none"
            ? "block"
            : "none";

    if (
        area.innerHTML.trim() !== ""
    ) return;

    const snap =
        await db
            .collection("mesas")
            .orderBy("numero")
            .get();

    let html = "";

    snap.forEach(doc => {

        const mesa =
            doc.data();

        html += `

            <button
                class="mesa-atendente"
                onclick="abrirMesaAtendente(
                    '${doc.id}'
                )"
                style="
                    margin:5px;
                    background:
                        ${
                            mesa.ocupada
                                ? "#ff8080"
                                : "#90ee90"
                        };
                "
            >

                Mesa ${mesa.numero}

            </button>

        `;
    });

    area.innerHTML = html;
}

async function abrirMesaAtendente(
    mesaId
) {

    mesaAbertaAtual = mesaId;

    const doc =
        await db
            .collection("mesas")
            .doc(mesaId)
            .get();

    const mesa =
        doc.data();

    const areaMesa =
        document.getElementById(
            "area-mesa-atendente"
        );

    const areaComanda =
        document.getElementById(
            "area-comanda-atendente"
        );

    areaMesa.style.display = "block";
    const areaProdutos =
    document.getElementById(
        "area-produtos-comanda"
    );

if (areaProdutos) {

    areaProdutos.style.display =
        "none";

    areaProdutos.innerHTML = "";

}

    if (areaComanda) {
        areaComanda.style.display = "none";
    }

    const snapComandas =
        await db
            .collection("comandas")
            .where(
                "mesa",
                "==",
                mesa.numero
            )
            .where(
                "status",
                "==",
                "Aberta"
            )
            .get();

    let htmlComandas = "";

    snapComandas.forEach(doc => {

        const c = doc.data();

        htmlComandas += `

            <button
                onclick="
                    abrirComandaVisual(
                        '${doc.id}'
                    )
                "
            >
                👤 ${c.cliente}
            </button>

            <br><br>

        `;
    });

    areaMesa.innerHTML = `

        <h3>
            Mesa ${mesa.numero}
        </h3>

        ${htmlComandas}

        <button
            onclick="
                novaComandaMesa(
                    '${mesaId}'
                )
            "
        >
            ➕ Nova Comanda
        </button>

        <button>
            🔗 Vincular Pedido Existente
        </button>

    `;
}

async function areaConsumoLocalRecarregar() {

    const area =
        document.getElementById(
            "area-consumo-local"
        );

    if (!area) return;

    area.innerHTML = "";

    const snap =
        await db
            .collection("mesas")
            .orderBy("numero")
            .get();

    let html = "";

    snap.forEach(doc => {

        const mesa =
            doc.data();

        html += `

            <button
                class="mesa-atendente"
                onclick="abrirMesaAtendente(
                    '${doc.id}'
                )"
                style="
                    margin:5px;
                    background:
                        ${
                            mesa.ocupada
                                ? '#ff8080'
                                : '#90ee90'
                        };
                "
            >
                Mesa ${mesa.numero}
            </button>

        `;
    });

    area.innerHTML = html;
}
async function adicionarItemComanda(
    comandaId
) {

    alert(
        "Próximo passo: Adicionar produtos"
    );

}
async function abrirComandaVisual(
    comandaId
) {

    comandaAbertaAtual =
        comandaId;
    document.getElementById(
    "area-mesa-atendente"
).style.display = "none";

    const docComanda =
        await db
            .collection("comandas")
            .doc(comandaId)
            .get();

    if (!docComanda.exists)
        return;

    const comanda =
        docComanda.data();

    const area =
        document.getElementById(
            "area-comanda-atendente"
        );

    area.style.display = "block";

    let htmlItens = "";

    if (
        !comanda.itens ||
        comanda.itens.length === 0
    ) {

        htmlItens =
            "<p>Nenhum item.</p>";

    } else {

        htmlItens =
    comanda.itens.map((item, index) => `

        <div>

         ${modoRemoverItem ? `

<button
    onclick="
        removerItemComanda(
            '${comandaId}',
            ${index}
        )
    "
>
❌
</button>

` : ""}

${item.quantidade || 1}
${item.nome}

        </div>

    `).join("");
    }

    area.innerHTML = `

        <button
            onclick="
                abrirMesaAtendente(
                    '${mesaAbertaAtual}'
                )
            "
        >
            ⬅ Voltar para Mesa
        </button>

        <h3>
            Cliente: ${comanda.cliente}
        </h3>

        <p>
            Mesa: ${comanda.mesa}
        </p>

        <hr>

        <h4>Itens</h4>

        ${htmlItens}

        <hr>

        <p>
            Total:
            R$ ${Number(
                comanda.valorTotal || 0
            ).toFixed(2)}
        </p>

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

        <button>
            ❌ Cancelar Comanda
        </button>

        <button>
            💰 Fechar Comanda
        </button>

    `;
}
async function novaComandaMesa(
    mesaId
) {

    const nomeCliente =
        prompt(
            "Nome do cliente"
        );

    if (!nomeCliente)
        return;

    const mesaDoc =
        await db
            .collection("mesas")
            .doc(mesaId)
            .get();

    const mesa =
        mesaDoc.data();

    const atendenteId =
        localStorage.getItem(
            "atendenteId"
        );

    const atendenteNome =
        localStorage.getItem(
            "atendenteNome"
        );

    await db
        .collection("comandas")
        .add({

            cliente:
                nomeCliente,

            mesa:
                mesa.numero,

            status:
                "Aberta",

            atendenteId,

            atendenteNome,

            criadoEm:
                Date.now(),

            itens: [],

            valorTotal: 0

        });

    await db
        .collection("mesas")
        .doc(mesaId)
        .update({

            ocupada: true

        });

    areaConsumoLocalRecarregar();

    abrirMesaAtendente(
        mesaId
    );
}
async function abrirBuscaProdutos(
    comandaId
) {

    document.getElementById(
        "area-comanda-atendente"
    ).style.display = "none";

    const area =
        document.getElementById(
            "area-produtos-comanda"
        );

    area.style.display =
        "block";

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

<br><br>

<div
id="resultado-busca-produtos"
></div>

<div
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
📦 Combos
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
async function pesquisarProdutoAtendente(
    comandaId
) {

    const termo =
    document
        .getElementById(
            "busca-produto-atendente"
        )
        .value
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replaceAll("-", "")
            .trim();
    
    const listaCategoria =
document.getElementById(
"lista-categoria-produtos"
);

    const resultado =
        document.getElementById(
            "resultado-busca-produtos"
        );

    const snap =
        await db
            .collection(
                "produtos"
            )
            .get();

    let produtosEncontrados = [];

    snap.forEach(doc => {

        const p =
            doc.data();

        const nomeProduto =
    p.nome
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replaceAll("-", "");

       const palavras =
    nomeProduto.split(" ");

const encontrou =
    palavras.some(palavra =>
        palavra.startsWith(
            termo
        )
    );

if (!encontrou)
    return;

        produtosEncontrados.push({

            id: doc.id,

            nome: p.nome,

            preco:
                p.preco || 0

        });

    });

    produtosEncontrados.sort(
        (a, b) =>
            a.preco - b.preco
    );

    let html = "";

    produtosEncontrados.forEach(produto => {

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
                R$ ${Number(
                    produto.preco
                ).toFixed(2)}
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


async function confirmarProdutoComanda(
    comandaId,
    produtoId
) {

    const quantidade =
        Number(
            document
                .getElementById(
                    "quantidade-produto"
                )
                .value
        );

    if (
        !quantidade ||
        quantidade <= 0
    ) return;

    const docProduto =
        await db
            .collection("produtos")
            .doc(produtoId)
            .get();

    const produto =
        docProduto.data();

    const docComanda =
        await db
            .collection("comandas")
            .doc(comandaId)
            .get();

    const comanda =
        docComanda.data();

    const itens =
        comanda.itens || [];

    itens.push({

        nome:
            produto.nome,

        quantidade,

        precoUnitario:
            Number(
                produto.preco || 0
            ),

        subtotal:
            Number(
                produto.preco || 0
            ) * quantidade

    });

    const novoTotal =
        itens.reduce(
            (
                total,
                item
            ) =>
                total +
                Number(
                    item.subtotal || 0
                ),
            0
        );

    await db
        .collection("comandas")
        .doc(comandaId)
        .update({

            itens,

            valorTotal:
                novoTotal

        });

    document.getElementById(
        "area-config-produto"
    ).style.display = "none";

    abrirComandaVisual(
        comandaId
    );
}
async function removerItemComanda(
    comandaId,
    indiceItem
) {

    const confirmar =
        confirm(
            "Remover item?"
        );

    if (!confirmar)
        return;

    const docComanda =
        await db
            .collection("comandas")
            .doc(comandaId)
            .get();

    const comanda =
        docComanda.data();

    const itens =
        comanda.itens || [];

    itens.splice(
        indiceItem,
        1
    );

    const novoTotal =
        itens.reduce(
            (
                total,
                item
            ) =>
                total +
                Number(
                    item.subtotal || 0
                ),
            0
        );

    await db
        .collection("comandas")
        .doc(comandaId)
        .update({

            itens,

            valorTotal:
                novoTotal

        });

  modoRemoverItem = false;

abrirComandaVisual(
    comandaId
);
}
function ativarRemoverItens(
    comandaId
) {

    modoRemoverItem =
        !modoRemoverItem;

    abrirComandaVisual(
        comandaId
    );

}