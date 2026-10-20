/**
 * Administração: pedidos, clientes, cardápio, cupons e cadastros. As funções são chamadas pelos botões de admin.html.
 *
 * Organização e caminhos: consulte GUIA-DO-CODIGO.md.
 */

let vendasFirebase = [];
let periodoAtualAdmin = "hoje";
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

let pararPedidosAdmin = null;
let chaveConsultaPedidosAdmin = "";
let viradaPedidosAdmin = null;
function consultarPedidosPeriodoAdmin(periodo = "hoje") {
  const agora = new Date();
  const janela = janelaOperacionalOperacao();
  let inicio = janela.inicio;
  if (periodo === "semana") {
    const data = new Date(janela.inicio);
    data.setDate(data.getDate() - data.getDay());
    inicio = data.getTime();
  } else if (periodo === "mes") {
    const data = new Date(janela.inicio);
    data.setDate(1);
    inicio = data.getTime();
  }
  const chave = periodo + ":" + inicio;
  if (chave === chaveConsultaPedidosAdmin && pararPedidosAdmin) return;
  pararPedidosAdmin?.();
  clearTimeout(viradaPedidosAdmin);
  chaveConsultaPedidosAdmin = chave;
  pararPedidosAdmin = db
    .collection("pedidos")
    .where("dataMs", ">=", inicio)
    .onSnapshot(
      (snapshot) => {
        vendasFirebase = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        aplicarNumerosDiariosOperacao(vendasFirebase);
        listarPedidosAdmin(periodoAtualAdmin);
      },
      (erro) => {
        const box = document.getElementById("lista-pedidos-admin");
        if (box) box.textContent = "Não foi possível carregar os pedidos: " + erro.message;
      },
    );
  viradaPedidosAdmin = setTimeout(
    () => consultarPedidosPeriodoAdmin(periodoAtualAdmin),
    Math.max(1000, janela.fim - Date.now() + 100),
  );
}
window.addEventListener("pagehide", () => {
  pararPedidosAdmin?.();
  pararPedidosAdmin = null;
  clearTimeout(viradaPedidosAdmin);
});
window.addEventListener("pageshow", (evento) => {
  if (evento.persisted) consultarPedidosPeriodoAdmin(periodoAtualAdmin);
});

let produtoEditandoId = null;

function processar(periodo) {
  if (typeof aplicarNumerosDiariosOperacao === "function")
    aplicarNumerosDiariosOperacao(vendasFirebase);
  periodoAtualAdmin = periodo;
  consultarPedidosPeriodoAdmin(periodo);
  listarPedidosAdmin(periodo);
}

window.onload = () => processar("hoje");

function toggleLoja() {
  console.log("CLIQUEI NO BOTÃO");

  const ref = db.collection("config").doc("loja");

  ref.get().then((doc) => {
    console.log("DOC:", doc.exists, doc.data());

    const atual = doc.exists ? doc.data().aberta : true;

    console.log("VALOR ATUAL:", atual);

    ref
      .set({
        aberta: !atual,
      })
      .then(() => {
        console.log("SALVOU COM SUCESSO");
      })
      .catch((e) => {
        console.error("ERRO AO SALVAR:", e);
      });
  });
}
function limparTelefoneAdmin(valor) {
  return valor.replace(/\D/g, "");
}

async function buscarClienteAdmin() {
  const busca = document.getElementById("admin-busca-cliente").value.trim();
  const box = document.getElementById("resultado-cliente-admin");

  if (!busca) return alert("Digite telefone, nome ou código.");

  const telefone = busca.replace(/\D/g, "");

  let doc = null;
  let telefoneFinal = "";

  if (telefone.length >= 10) {
    doc = await db.collection("clientes").doc(telefone).get();
    telefoneFinal = telefone;
  }

  if (!doc || !doc.exists) {
    const snapCodigo = await db
      .collection("clientes")
      .where("codigoAtivacao", "==", busca)
      .limit(1)
      .get();

    if (!snapCodigo.empty) {
      doc = snapCodigo.docs[0];
      telefoneFinal = doc.id;
    }
  }

  if (!doc || !doc.exists) {
    const snapNome = await db.collection("clientes").where("nome", "==", busca).limit(1).get();

    if (!snapNome.empty) {
      doc = snapNome.docs[0];
      telefoneFinal = doc.id;
    }
  }

  if (!doc || !doc.exists) {
    box.innerHTML = "<p>Cliente não encontrado.</p>";
    return;
  }

  const c = doc.data();

  box.innerHTML = `
        <div class="card-admin-cliente">
            <div class="topo-cliente-admin">
                <h3>${c.nomeReal || c.nome || "Cliente sem nome"}</h3>
                <button type="button" onclick="ativarEdicaoClienteAdmin()">Editar</button>
            </div>

            <div class="dados-cliente-admin">
                <p><strong>Nome usado no site:</strong> ${c.nome || "-"}</p>
                <p><strong>Nome real:</strong> ${c.nomeReal || "-"}</p>
                <p><strong>Telefone:</strong> ${c.telefone || telefoneFinal}</p>
                <p><strong>Fidelidade:</strong> ${c.fidelidadeAtiva ? "Ativa" : "Inativa"}</p>
                <p><strong>Total geral gasto:</strong> R$ ${Number(c.totalGasto || 0).toFixed(2)}</p>
                <p><strong>Total fidelidade:</strong> R$ ${Number(c.totalFidelidade || 0).toFixed(2)}</p>
                <p><strong>Bônus disponível:</strong> R$ ${Number(c.bonusDisponivel || 0).toFixed(2)}</p>
                <p><strong>Bônus gerado total:</strong> R$ ${Number(c.bonusGeradoTotal || 0).toFixed(2)}</p>
                <p><strong>Código:</strong> ${c.codigoAtivacao || "Sem código"}</p>
                <p><strong>Ativado em:</strong> ${c.ativadoEm ? new Date(c.ativadoEm).toLocaleString("pt-BR") : "Não ativado"}</p>
            </div>

            <div id="form-edicao-cliente-admin" style="display:none;">
                <label>Nome usado no site</label>
                <input type="text" id="admin-nome-cliente" value="${c.nome || ""}">

                <label>Nome real</label>
                <input type="text" id="admin-nome-real-cliente" value="${c.nomeReal || ""}">

                <label>Telefone</label>
                <input type="text" id="admin-telefone-editar" value="${c.telefone || telefoneFinal}">

                <label>Código de ativação</label>
                <div class="linha-codigo-admin">
                    <input type="text" id="admin-codigo-cliente" value="${c.codigoAtivacao || ""}">
                    <button type="button" onclick="gerarCodigoCliente()">Gerar código</button>
                </div>

                <label>Total geral gasto</label>
                <input type="number" id="admin-total-gasto" value="${Number(c.totalGasto || 0)}">

                <label>Total fidelidade</label>
                <input type="number" id="admin-total-fidelidade" value="${Number(c.totalFidelidade || 0)}">

                <label>Bônus disponível</label>
                <input type="number" id="admin-bonus-disponivel" value="${Number(c.bonusDisponivel || 0)}">

                <label>Nível do cliente</label>
                <select id="admin-nivel-cliente">${["Sem nível", "Bronze", "Prata", "Ouro", "Diamante", "Lenda"].map((n) => `<option ${n === (c.nivelCliente || "Sem nível") ? "selected" : ""}>${n}</option>`).join("")}</select>

                <button type="button" onclick="salvarClienteAdmin('${telefoneFinal}')">Salvar alterações</button>
            </div>

            <button type="button" onclick="alternarFidelidadeAdmin('${telefoneFinal}', ${!c.fidelidadeAtiva})">
                ${c.fidelidadeAtiva ? "Desativar fidelidade" : "Ativar fidelidade"}
            </button>

            <button type="button" onclick="listarPedidosClienteAdmin('${telefoneFinal}')">
                Ver pedidos anteriores
            </button>

            <div id="pedidos-cliente-admin" style="display:none;"></div>
        </div>
    `;
}

async function salvarClienteAdmin(telefoneAntigo) {
  const nome = document.getElementById("admin-nome-cliente").value.trim();
  const nomeReal = document.getElementById("admin-nome-real-cliente").value.trim();
  const telefoneNovo = document.getElementById("admin-telefone-editar").value.replace(/\D/g, "");
  const codigo = document.getElementById("admin-codigo-cliente").value.trim();

  const totalGasto = Number(document.getElementById("admin-total-gasto").value) || 0;
  const totalFidelidade = Number(document.getElementById("admin-total-fidelidade").value) || 0;
  const bonusDisponivel = Number(document.getElementById("admin-bonus-disponivel").value) || 0;

  if (!nome) return alert("Nome usado no site é obrigatório.");
  if (telefoneNovo.length < 10) return alert("Telefone inválido.");

  const refAntigo = db.collection("clientes").doc(telefoneAntigo);
  const docAntigo = await refAntigo.get();

  if (!docAntigo.exists) return alert("Cliente não encontrado.");

  const dados = docAntigo.data();

  const bonusGeradoTotal = Math.floor(totalFidelidade / 300) * 20;

  const novosDados = {
    ...dados,
    nome,
    nomeReal,
    telefone: telefoneNovo,
    codigoAtivacao: codigo,
    totalGasto,
    totalFidelidade,
    bonusDisponivel,
    bonusGeradoTotal,
    nivelCliente: document.getElementById("admin-nivel-cliente").value,
  };

  await db.collection("clientes").doc(telefoneNovo).set(novosDados);

  if (telefoneNovo !== telefoneAntigo) {
    await refAntigo.delete();
  }

  alert("Cliente atualizado!");
  document.getElementById("admin-busca-cliente").value = telefoneNovo;
  buscarClienteAdmin();
}

async function alternarFidelidadeAdmin(telefone, novoStatus) {
  const dadosAtualizacao = {
    fidelidadeAtiva: novoStatus,
  };

  if (!novoStatus) {
    dadosAtualizacao.codigoAtivacao = "";
  }

  await db.collection("clientes").doc(telefone).update(dadosAtualizacao);

  alert(novoStatus ? "Fidelidade ativada!" : "Fidelidade desativada e código removido!");
  buscarClienteAdmin();
}

function listarPedidosAdmin(periodo = "hoje") {
  const box = document.getElementById("lista-pedidos-admin");
  if (!box) return;

  const agora = new Date();

  const pedidosFiltrados = vendasFirebase
    .filter((p) => {
      if (p.cancelado) return false;

      const dataPedido = new Date(p.dataMs || p.data);
      if (isNaN(dataPedido)) return false;

      if (periodo === "hoje") {
        const janela = janelaOperacionalOperacao();
        return dataPedido.getTime() >= janela.inicio && dataPedido.getTime() < janela.fim;
      }

      if (periodo === "semana") {
        const inicioSemana = new Date(agora);
        inicioSemana.setHours(0, 0, 0, 0);
        inicioSemana.setDate(agora.getDate() - agora.getDay());

        const fimSemana = new Date(inicioSemana);
        fimSemana.setDate(inicioSemana.getDate() + 6);
        fimSemana.setHours(23, 59, 59, 999);

        return dataPedido >= inicioSemana && dataPedido <= fimSemana;
      }

      if (periodo === "mes") {
        return (
          dataPedido.getMonth() === agora.getMonth() &&
          dataPedido.getFullYear() === agora.getFullYear()
        );
      }

      return true;
    })
    .sort((a, b) => {
      const dataA = a.dataMs || new Date(a.data || 0).getTime();
      const dataB = b.dataMs || new Date(b.data || 0).getTime();
      return dataA - dataB;
    });

  if (pedidosFiltrados.length === 0) {
    box.innerHTML = "<p>Nenhum pedido nesse período.</p>";
    return;
  }

  let html = `<p><strong>Total de pedidos no período:</strong> ${pedidosFiltrados.length}</p>`;

  pedidosFiltrados
    .slice()
    .reverse()
    .forEach((pedido, indexReverso) => {
      const numeroPeriodo = pedido.numeroDia || pedido.numero || "-";

      const itens = (pedido.itens || []).map((i) => formatarItemPedidoAdmin(i)).join("<br><br>");
      const valorAdicionais = (pedido.itens || []).reduce((total, item) => {
        return (
          total +
          (item.adicionais || []).reduce((soma, a) => {
            return soma + (Number(a.preco) || 0) * (Number(a.qtd) || 1);
          }, 0)
        );
      }, 0);

      const valorMolhos = (pedido.itens || []).reduce((total, item) => {
        return total + Number(item.totalMolhosPagos || 0);
      }, 0);
      const valorItens = (pedido.itens || []).reduce((total, item) => {
        const valorBase = (Number(item.preco) || 0) * (Number(item.quantidade) || 1);

        const valorMolhos = Number(item.totalMolhosPagos || 0);

        return total + valorBase + valorMolhos;
      }, 0);
      const idDetalhes = `pedido-detalhes-${pedido.id}`;
      html += `
<div class="pedido-admin ${pedido.cancelado ? "pedido-cancelado" : ""} ${pedidoContaFidelidade(pedido) ? "pedido-fidelidade" : ""}">

   <div class="pedido-topo-admin">

    <div>

        <strong>
            Pedido #${numeroPeriodo}
        </strong>

        <br>

        <small>
            ${pedido.nome || "-"}
        </small>

    </div>

    <div class="pedido-total-admin">

        R$ ${Number(pedido.valorTotal || 0).toFixed(2)}

    </div>

</div>

<div class="pedido-info-admin">

    ${pedido.tipo || "-"}

    •

    ${pedido.pagamento || "-"}

</div>

<br>

<button
    type="button"
    onclick="togglePedidoAdmin('${idDetalhes}')"
>
    ▼ Ver detalhes
</button>

    <div
        id="${idDetalhes}"
        data-entrega="${/entrega/i.test(pedido.tipo || "")}"
        style="display:none; margin-top:10px;"
    >

        <small>
            ${pedido.data ? new Date(pedido.data).toLocaleString("pt-BR") : ""}
        </small><br>

        ${pedido.clienteId ? `<span class="tag-login">Login</span>` : `<span class="tag-sem-login">Sem login</span>`}
        ${pedidoContaFidelidade(pedido) ? `<span class="tag-fidelidade">Fidelidade</span>` : ""}

        <p><b>Cliente:</b> ${pedido.nome || "-"}</p>
        <p><b>Telefone:</b> ${pedido.telefone || "-"}</p>
        <p><b>Tipo:</b> ${pedido.tipo === "Local" ? "Consumir no local" : pedido.tipo || "-"}</p>
        <p><b>Pagamento:</b> ${pedido.pagamento || "-"}</p>
        <p><b>Código cliente:</b> ${pedido.codigoCliente || "-"}</p>

        <p><b>Total pago:</b> R$ ${Number(pedido.valorTotal || 0).toFixed(2)}</p>

        <p><b>Valor itens:</b> R$ ${valorItens.toFixed(2)}</p>
<p><b>Acréscimos:</b> R$ ${valorAdicionais.toFixed(2)}</p>

<p><b>Molhos pagos:</b> R$ ${valorMolhos.toFixed(2)}</p>
        <p><b>Taxa entrega:</b> R$ ${Number(pedido.taxaEntrega || 0).toFixed(2)}</p>

        <p><b>Valor antes do desconto:</b> R$ ${Number(pedido.valorAntesDesconto || pedido.valorTotal || 0).toFixed(2)}</p>

        <p><b>Desconto fidelidade:</b> R$ ${Number(pedido.descontoFidelidade || 0).toFixed(2)}</p>

        <p><b>Cupom desconto:</b> ${pedido.cupomDescontoCodigo || "-"} | R$ ${Number(pedido.descontoCupom || 0).toFixed(2)}</p>

        <p>${itens}</p>

        ${
          pedido.cancelado
            ? `<span class="tag-cancelado">Cancelado</span>`
            : `
                <button type="button" onclick="editarPedidoAdmin('${pedido.id}')">
                    Editar pedido
                </button>

                <button type="button" onclick="cancelarPedidoAdmin('${pedido.id}')">
                    Cancelar pedido
                </button>
            `
        }

    </div>

</div>
`;
    });

  box.innerHTML = html;
}

function formatarItemPedidoAdmin(i) {
  let texto = `<strong>${i.quantidade || 1} ${i.nome}</strong>`;

  if (i.adicionais && i.adicionais.length > 0) {
    const adicionais = i.adicionais.map((a) => `• ${a.qtd} ${a.nome}`).join("<br>");

    texto += `<br>➕ <b>Acréscimos:</b><br>${adicionais}`;

    const totalAdicionais = i.adicionais.reduce((t, a) => {
      return t + (Number(a.preco) || 0) * (Number(a.qtd) || 1);
    }, 0);

    texto += `<br>💵 <b>Valor acréscimos:</b> R$ ${totalAdicionais.toFixed(2)}`;
  }

  if (i.observacao) {
    texto += `<br>📝 <b>Obs:</b> ${i.observacao}`;
  }

  if (i.molhosGratis && i.molhosGratis.length > 0) {
    const molhosGratis = i.molhosGratis
      .map((m) => `• ${m.unidade}º Lanche: ${m.texto}`)
      .join("<br>");

    texto += `<br>🍶 <b>Molhos grátis:</b><br>${molhosGratis}`;
  }

  if (i.molhosPagos && i.molhosPagos.length > 0) {
    const molhosPagos = i.molhosPagos.map((m) => `• ${m.qtd} ${m.nome}`).join("<br>");

    texto += `<br>💰 <b>Molhos pagos:</b><br>${molhosPagos}`;

    if (i.totalMolhosPagos) {
      texto += `<br>💵 <b>Valor molhos:</b> R$ ${Number(i.totalMolhosPagos).toFixed(2)}`;
    }
  }

  return texto;
}

async function cancelarPedidoAdmin(idPedido) {
  if (!confirm("Cancelar esse pedido?")) return;

  const ref = db.collection("pedidos").doc(idPedido);
  const doc = await ref.get();

  if (!doc.exists) return alert("Pedido não encontrado.");

  const pedido = doc.data();

  await ref.update({ cancelado: true });

  const telefone = pedido.telefoneLimpo || (pedido.telefone || "").replace(/\D/g, "");

  if (telefone) {
    const refCliente = db.collection("clientes").doc(telefone);
    const docCliente = await refCliente.get();

    if (docCliente.exists) {
      const c = docCliente.data();

      let novoTotal = Number(c.totalGasto || 0) - Number(pedido.valorTotal || 0);
      if (novoTotal < 0) novoTotal = 0;

      await refCliente.update({
        totalGasto: novoTotal,
      });
    }
  }

  alert("Pedido cancelado!");
}

function togglePedidosRecentes() {
  const box = document.getElementById("lista-pedidos-admin");

  if (!box) return;

  box.style.display = box.style.display === "none" ? "block" : "none";
}
function gerarCodigoCliente() {
  const codigo = Math.floor(1000 + Math.random() * 9000);
  document.getElementById("admin-codigo-cliente").value = codigo;
}
function ativarEdicaoClienteAdmin() {
  const form = document.getElementById("form-edicao-cliente-admin");
  if (!form) return;

  form.style.display = form.style.display === "none" ? "block" : "none";
}

async function listarPedidosClienteAdmin(telefone) {
  const box = document.getElementById("pedidos-cliente-admin");
  if (!box) return;

  box.style.display = box.style.display === "none" ? "block" : "none";
  if (box.style.display === "none") return;

  const telefoneLimpo = telefone.replace(/\D/g, "");

  const snapshotCliente = await db
    .collection("pedidos")
    .where("clienteId", "==", telefoneLimpo)
    .get();
  const pedidosCliente = snapshotCliente.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .sort((a, b) => {
      const dataA = a.dataMs || new Date(a.data || 0).getTime();
      const dataB = b.dataMs || new Date(b.data || 0).getTime();
      return dataA - dataB;
    });

  if (pedidosCliente.length === 0) {
    box.innerHTML = "<p>Nenhum pedido encontrado para este cliente.</p>";
    return;
  }

  let html = "<h4>Pedidos anteriores</h4>";

  pedidosCliente
    .slice()
    .reverse()
    .forEach((p, indexReverso) => {
      const numeroCliente = pedidosCliente.length - indexReverso;

      const itens = (p.itens || []).map((i) => `${i.quantidade} ${i.nome}`).join("<br>");

      html += `
                <div class="pedido-cliente-admin ${p.cancelado ? "pedido-cancelado" : ""} ${pedidoContaFidelidade(p) ? "pedido-fidelidade" : ""}">
                    <strong>Pedido #${numeroCliente}</strong><br>
                    <small>${p.data ? new Date(p.data).toLocaleString("pt-BR") : ""}</small>

                    <p><strong>Total pago:</strong> R$ ${Number(p.valorTotal || 0).toFixed(2)}</p>
                    <p><strong>Desconto:</strong> R$ ${Number(p.descontoFidelidade || 0).toFixed(2)}</p>
                    <p>${itens}</p>

                    ${
                      p.cancelado
                        ? "<span>Cancelado</span>"
                        : `
                        <button type="button" onclick="editarPedidoAdmin('${p.id}')">Editar pedido</button>
                        <button type="button" onclick="cancelarPedidoAdmin('${p.id}')">Cancelar pedido</button>
                    `
                    }
                </div>
            `;
    });

  box.innerHTML = html;
}
function pedidoUsouBonus(pedido) {
  return Number(pedido.descontoFidelidade || 0) > 0;
}

function pedidoContaFidelidade(pedido) {
  return pedido.clienteId && pedido.fidelidadeAtivaNoPedido === true;
}
async function editarPedidoAdmin(idPedido) {
  const ref = db.collection("pedidos").doc(idPedido);
  const doc = await ref.get();

  if (!doc.exists) return alert("Pedido não encontrado.");

  const pedido = doc.data();
  const pedidoAntigo = { ...pedido };
  const itens = pedido.itens || [];

  let textoItens = "Itens atuais:\n\n";

  itens.forEach((item, index) => {
    textoItens += `${index + 1}. ${item.nome} - Qtd: ${item.quantidade} - R$ ${item.preco}\n`;
  });

  const opcao = prompt(
    textoItens +
      "\nO que deseja fazer?\n" +
      "1 - Adicionar item\n" +
      "2 - Remover item\n" +
      "3 - Alterar taxa de entrega\n" +
      "4 - Alterar tipo do pedido\n" +
      "5 - Alterar vale fidelidade\n" +
      "6 - Alterar cupom\n" +
      "7 - Alterar molhos pagos\n" +
      "8 - Editar acréscimos\n",
  );

  if (opcao === "1") {
    const termo = prompt("Digite parte do nome do item. Ex: coca, big, bacon, combo");
    if (!termo) return;

    const resultados = buscarItensAdmin(termo);

    if (resultados.length === 0) {
      const addManual = confirm("Nenhum item encontrado. Deseja adicionar manualmente?");
      if (!addManual) return;

      const nomeItem = prompt("Nome do item:");
      const qtd = Number(prompt("Quantidade:", "1")) || 1;
      const preco = Number(prompt("Preço unitário:", "0")) || 0;
      const categoria =
        prompt("Categoria: Lanches, Bebidas, Combos ou Batatas", "Lanches") || "Lanches";

      itens.push({ nome: nomeItem, quantidade: qtd, preco, categoria });
    } else {
      let listaTexto = "Itens encontrados:\n\n";

      resultados.forEach((item, index) => {
        listaTexto += `${index + 1}. ${item.nome} - R$ ${Number(item.preco).toFixed(2)} (${item.categoria})\n`;
      });

      const escolha = Number(prompt(listaTexto + "\nDigite o número do item:"));

      if (!escolha || escolha < 1 || escolha > resultados.length) {
        return alert("Opção inválida.");
      }

      const selecionado = resultados[escolha - 1];
      const qtd = Number(prompt("Quantidade:", "1")) || 1;

      itens.push({
        nome: selecionado.nome,
        quantidade: qtd,
        preco: Number(selecionado.preco) || 0,
        categoria: selecionado.categoria,
      });
    }

    await ref.update({
      itens,
      editadoEm: new Date().toISOString(),
    });

    await recalcularPedidoAdmin(idPedido, pedidoAntigo);
    alert("Item adicionado!");
    return;
  } else if (opcao === "2") {
    const numeroItem = Number(prompt(textoItens + "\nDigite o número do item que deseja remover:"));

    if (!numeroItem || numeroItem < 1 || numeroItem > itens.length) {
      return alert("Item inválido.");
    }

    itens.splice(numeroItem - 1, 1);

    await ref.update({
      itens,
      editadoEm: new Date().toISOString(),
    });

    await recalcularPedidoAdmin(idPedido, pedidoAntigo);
    alert("Item removido!");
    return;
  } else if (opcao === "3") {
    const respostaTaxa = prompt("Nova taxa de entrega:", pedido.taxaEntrega || 0);

    if (respostaTaxa === null) {
      return;
    }

    const novaTaxa = Number(respostaTaxa);

    if (isNaN(novaTaxa)) {
      return alert("Taxa inválida.");
    }

    await ref.update({
      taxaEntrega: novaTaxa,
      editadoEm: new Date().toISOString(),
    });

    await recalcularPedidoAdmin(idPedido, pedidoAntigo);
    alert("Taxa alterada!");
    return;
  } else if (opcao === "4") {
    const escolhaTipo = prompt(
      "Escolha o tipo do pedido:\n" + "1 - Entrega\n" + "2 - Retirada\n" + "3 - Consumir no local",
    );

    let novoTipo = "";

    if (escolhaTipo === "1") novoTipo = "Entrega";
    else if (escolhaTipo === "2") novoTipo = "Retirada";
    else if (escolhaTipo === "3") novoTipo = "Local";
    else return alert("Opção inválida.");

    await ref.update({
      tipo: novoTipo,
      editadoEm: new Date().toISOString(),
    });

    alert("Tipo alterado!");
    return;
  } else if (opcao === "5") {
    const novoVale =
      Number(prompt("Valor do vale fidelidade:", pedido.descontoFidelidade || 0)) || 0;

    await ref.update({
      descontoFidelidade: novoVale,
      editadoEm: new Date().toISOString(),
    });

    await recalcularPedidoAdmin(idPedido, pedidoAntigo);
    alert("Vale fidelidade alterado!");
    return;
  } else if (opcao === "6") {
    const acaoCupom = prompt(
      "O que deseja fazer?\n" + "1 - Adicionar cupom\n" + "2 - Remover cupom",
    );

    if (acaoCupom === "1") {
      const tipoCupom = prompt(
        "Qual tipo de cupom deseja adicionar?\n" +
          "1 - Cupom do pedido\n" +
          "2 - Cupom da taxa de entrega\n" +
          "3 - Cupom de item",
      );

      if (tipoCupom === "1") {
        await aplicarCupomPedidoAdmin(idPedido, pedidoAntigo);
      } else if (tipoCupom === "2") {
        await aplicarCupomTaxaAdmin(idPedido, pedidoAntigo);
      } else if (tipoCupom === "3") {
        await aplicarCupomItemAdmin(idPedido, pedidoAntigo);
      } else {
        return alert("Tipo de cupom inválido.");
      }

      return;
    } else if (acaoCupom === "2") {
      const tipoCupom = prompt(
        "Qual cupom deseja remover?\n" +
          "1 - Cupom do pedido\n" +
          "2 - Cupom da taxa de entrega\n" +
          "3 - Cupom de item\n" +
          "4 - Todos os cupons",
      );

      await removerCupomAdmin(idPedido, pedidoAntigo, tipoCupom);
      return;
    } else {
      return alert("Opção inválida.");
    }
  } else if (opcao === "7") {
    await editarMolhosPagosPedidoAdmin(idPedido, pedidoAntigo);
    return;
  } else if (opcao === "8") {
    await editarAcrescimosPedidoAdmin(idPedido, pedidoAntigo);
    return;
  } else {
    return;
  }
}
async function editarMolhosPagosPedidoAdmin(idPedido, pedidoAntigo) {
  const ref = db.collection("pedidos").doc(idPedido);
  const doc = await ref.get();

  if (!doc.exists) return alert("Pedido não encontrado.");

  const pedido = doc.data();
  const itens = pedido.itens || [];

  let textoItens = "Escolha o item para alterar os molhos pagos:\n\n";

  itens.forEach((item, index) => {
    textoItens += `${index + 1}. ${item.quantidade} ${item.nome}\n`;
  });

  const numeroItem = Number(prompt(textoItens));

  if (!numeroItem || numeroItem < 1 || numeroItem > itens.length) {
    return alert("Item inválido.");
  }

  const item = itens[numeroItem - 1];

  const maionese = Number(prompt("Quantidade de Maionese:", buscarQtdMolho(item, "Maionese"))) || 0;
  const ketchup = Number(prompt("Quantidade de Ketchup:", buscarQtdMolho(item, "Ketchup"))) || 0;
  const mostarda = Number(prompt("Quantidade de Mostarda:", buscarQtdMolho(item, "Mostarda"))) || 0;
  const barbecue = Number(prompt("Quantidade de Barbecue:", buscarQtdMolho(item, "Barbecue"))) || 0;

  const molhosPagos = [];

  [
    { nome: "Maionese", qtd: maionese },
    { nome: "Ketchup", qtd: ketchup },
    { nome: "Mostarda", qtd: mostarda },
    { nome: "Barbecue", qtd: barbecue },
  ].forEach((m) => {
    if (m.qtd > 0) {
      molhosPagos.push({
        nome: m.nome,
        qtd: m.qtd,
        preco: 2,
      });
    }
  });

  item.molhosPagos = molhosPagos;

  item.totalMolhosPagos = molhosPagos.reduce((total, m) => {
    return total + Number(m.qtd) * Number(m.preco);
  }, 0);

  item.preco =
    Number(item.precoBase || item.preco || 0) +
    (item.adicionais || []).reduce((total, a) => {
      return total + (Number(a.preco) || 0) * (Number(a.qtd) || 1);
    }, 0);
  await ref.update({
    itens,
    editadoEm: new Date().toISOString(),
  });

  await recalcularPedidoAdmin(idPedido, pedidoAntigo);

  alert("Molhos pagos atualizados!");
}
function buscarQtdMolho(item, nomeMolho) {
  const molho = (item.molhosPagos || []).find((m) => m.nome === nomeMolho);
  return molho ? Number(molho.qtd || 0) : 0;
}
async function recalcularPedidoAdmin(idPedido, pedidoAntigo = null) {
  const ref = db.collection("pedidos").doc(idPedido);
  const doc = await ref.get();

  if (!doc.exists) return;

  const pedido = doc.data();

  const subtotalItens = (pedido.itens || []).reduce((total, item) => {
    const valorItem = (Number(item.preco) || 0) * (Number(item.quantidade) || 1);

    const valorMolhos = Number(item.totalMolhosPagos || 0);

    const valorAdicionais = (item.adicionais || []).reduce((soma, a) => {
      return soma + (Number(a.preco) || 0) * (Number(a.qtd) || 1);
    }, 0);

    return total + valorItem + valorMolhos + valorAdicionais;
  }, 0);

  const taxa = Number(pedido.taxaEntrega || 0);
  const descontoFidelidade = Number(pedido.descontoFidelidade || 0);
  const descontoCupom = Number(pedido.descontoCupom || 0);

  const valorAntesDesconto = subtotalItens + taxa;

  let valorTotal = valorAntesDesconto - descontoFidelidade - descontoCupom;
  if (valorTotal < 0) valorTotal = 0;

  await ref.update({
    valorAntesDesconto,
    valorTotal,
    editadoEm: new Date().toISOString(),
  });

  const docNovo = await ref.get();
  const pedidoNovo = docNovo.data();

  if (pedidoAntigo && typeof ajustarFidelidadeAposEditarPedido === "function") {
    await ajustarFidelidadeAposEditarPedido(pedidoAntigo, pedidoNovo);
  }
}
async function criarCupomDesconto() {
  const nome = document.getElementById("cupom-nome").value.trim();
  const codigo = document.getElementById("cupom-codigo").value.trim().toUpperCase();
  const tipo = document.getElementById("cupom-tipo").value;
  const modo = document.getElementById("cupom-modo").value;
  const itemGeral = document.getElementById("cupom-item-geral")?.checked || false;
  const itemGeralTipo = document.getElementById("cupom-item-geral-tipo")?.value || "";
  const itemGeralModo = document.getElementById("cupom-item-geral-modo")?.value || "";

  const itemGeralValor = Number(document.getElementById("cupom-item-geral-valor")?.value) || 0;
  const valor = Number(document.getElementById("cupom-valor").value) || 0;
  const kmGratis = Number(document.getElementById("cupom-km-gratis")?.value) || 0;

  const itemNome = document.getElementById("cupom-item-nome")?.value.trim() || "";
  const itemPrecoPromocional =
    Number(document.getElementById("cupom-item-preco-promocional")?.value) || 0;

  const temPedidoMinimo = document.getElementById("cupom-tem-minimo")?.checked || false;
  const pedidoMinimo = Number(document.getElementById("cupom-pedido-minimo")?.value) || 0;

  if (!nome) return alert("Digite o nome do cupom.");
  if (!/^[A-Z0-9_-]{3,30}$/.test(codigo))
    return alert("Use um código de 3 a 30 letras ou números, sem espaços.");
  if (!tipo) return alert("Escolha o tipo do cupom.");
  if (
    tipo !== "item" &&
    !(tipo === "taxa" ? ["valor", "porcentagem", "gratis"] : ["valor", "porcentagem"]).includes(
      modo,
    )
  )
    return alert("Escolha o tipo de desconto.");

  if (temPedidoMinimo && pedidoMinimo <= 0) {
    return alert("Digite o valor mínimo do pedido.");
  }

  if (tipo !== "item" && !(tipo === "taxa" && modo === "gratis")) {
    if (valor <= 0) return alert("Digite o valor do desconto.");
  }

  if (tipo === "item") {
    // ITEM ÚNICO
    if (!itemGeral) {
      if (!itemNome) return alert("Digite o nome do item.");
      if (
        document.getElementById("cupom-item-preco-promocional").value === "" ||
        !Number.isFinite(itemPrecoPromocional) ||
        itemPrecoPromocional < 0
      ) {
        return alert("Digite o preço promocional. Use zero para oferecer o item grátis.");
      }
    }

    // GRUPO DE LANCHES
    else {
      if (!itemGeralTipo) {
        return alert("Escolha o grupo do cupom.");
      }

      if (!itemGeralModo) {
        return alert("Escolha o modo do desconto.");
      }

      if (itemGeralValor <= 0) {
        return alert("Digite o valor do desconto.");
      }
    }
  }

  if (tipo === "taxa" && modo === "gratis" && kmGratis <= 0) {
    return alert("Digite até quantos km a taxa grátis vale.");
  }

  const dados = {
    nome,
    codigo,
    tipo,
    modo,
    valor,
    kmGratis,
    itemNome,
    itemPrecoPromocional,
    temPedidoMinimo,
    pedidoMinimo,
    itemGeral,
    itemGeralTipo,
    itemGeralModo,
    itemGeralValor,
    ativo: true,
    uso: document.getElementById("cupom-uso")?.value === "unico" ? "unico" : "diversos",
    editadoEm: new Date().toISOString(),
  };

  const botao = document.getElementById("cupom-salvar-ui");
  if (botao?.disabled) return;
  if (botao) botao.disabled = true;
  try {
    const ref = db.collection("cuponsDesconto").doc(codigo);
    await db.runTransaction(async (t) => {
      const atual = await t.get(ref);
      if (typeof cupomEmEdicaoUI !== "undefined" && cupomEmEdicaoUI) {
        if (cupomEmEdicaoUI !== codigo || !atual.exists)
          throw Error("Cupom não encontrado para edição.");
        if (atual.data().usadoEm)
          throw Error("Este cupom já foi utilizado e não pode ser alterado.");
        t.update(ref, { ...dados, ativo: atual.data().ativo });
      } else {
        if (atual.exists) throw Error("Já existe um cupom com este código.");
        t.set(ref, { ...dados, criadoEm: new Date().toISOString() });
      }
    });
    await finalizarSalvarCupomUI();
  } catch (erro) {
    const status = document.getElementById("cupom-salvar-status");
    if (status) status.textContent = erro.message;
    else avisoOperacao(erro.message);
  } finally {
    if (botao) botao.disabled = false;
  }
}

async function listarCuponsDesconto() {
  return alternarListaCuponsAdminUI();
}

async function alternarCupomDesconto(codigo, status) {
  try {
    const ref = db.collection("cuponsDesconto").doc(codigo);
    await db.runTransaction(async (t) => {
      const doc = await t.get(ref);
      if (!doc.exists) throw Error("Cupom não encontrado.");
      if (doc.data().usadoEm) throw Error("Este cupom já foi utilizado e não pode ser reativado.");
      t.update(ref, { ativo: status });
    });
    await carregarListaCuponsAdminUI();
  } catch (e) {
    avisoOperacao(e.message);
  }
}
async function excluirCupomDesconto(codigo) {
  if (!(await confirmarOperacao("Excluir este cupom?"))) return;
  const ref = db.collection("cuponsDesconto").doc(codigo);
  try {
    await db.runTransaction(async (t) => {
      const doc = await t.get(ref);
      if (doc.exists && doc.data().usadoEm)
        throw Error("Cupons utilizados permanecem no histórico e não podem ser excluídos.");
      t.delete(ref);
    });
    await carregarListaCuponsAdminUI();
  } catch (e) {
    avisoOperacao(e.message);
  }
}

async function editarCupomDesconto(codigo) {
  return abrirEditorCupomAdminUI(codigo);
}

function arredondarPagamento(valor) {
  const inteiro = Math.floor(valor);
  const centavos = valor - inteiro;

  if (centavos < 0.3) {
    return inteiro;
  }

  return inteiro + 1;
}

function normalizarBuscaAdmin(texto) {
  return normalizarBuscaUI(texto);
}

function buscarItensAdmin(termo) {
  const busca = normalizarBuscaAdmin(termo);

  const todos = [
    ...lanches.map((i) => ({ ...i, categoria: "Lanches" })),
    ...listaCombos.map((i) => ({ ...i, categoria: "Combos" })),
    ...bebidas.map((i) => ({ ...i, categoria: "Bebidas" })),
    ...batatas.map((i) => ({ ...i, categoria: "Batatas" })),
  ];

  return todos.filter((item) => {
    const nome = normalizarBuscaAdmin(item.nome);
    const desc = normalizarBuscaAdmin(item.desc);

    return nome.includes(busca) || desc.includes(busca);
  });
}
async function aplicarCupomPedidoAdmin(idPedido, pedidoAntigo) {
  const codigoCupom = prompt("Digite o código do cupom do pedido:");
  if (!codigoCupom) return;

  const codigo = codigoCupom.toUpperCase().trim();

  const cupomRef = db.collection("cuponsDesconto").doc(codigo);
  const cupomDoc = await cupomRef.get();

  if (!cupomDoc.exists) return alert("Cupom não encontrado.");

  const cupom = cupomDoc.data();

  if (!cupom.ativo) return alert("Cupom está desativado.");

  const ref = db.collection("pedidos").doc(idPedido);
  const doc = await ref.get();

  if (!doc.exists) return alert("Pedido não encontrado.");

  const pedido = doc.data();

  const base = Number(pedido.valorAntesDesconto || pedido.valorTotal || 0);

  let desconto = 0;

  if (cupom.modo === "valor") {
    desconto = Number(cupom.valor || 0);
  } else if (cupom.modo === "porcentagem") {
    const totalComDesconto = arredondarPagamento(base - base * (Number(cupom.valor || 0) / 100));

    desconto = base - totalComDesconto;
  }

  if (desconto < 0) desconto = 0;
  if (desconto > base) desconto = base;

  await db.runTransaction(async (t) => {
    const registrarUso = await prepararUsoCupomAtomicoOperacao(
      t,
      codigo,
      pedido.clienteId,
      ref.path,
    );
    t.update(ref, {
      descontoCupomPedido: desconto,
      cupomPedidoCodigo: cupom.codigo,
      cupomPedidoNome: cupom.nome,

      // compatibilidade com o campo antigo
      descontoCupom: desconto,
      cupomDescontoCodigo: cupom.codigo,
      cupomDescontoNome: cupom.nome,

      editadoEm: new Date().toISOString(),
    });
    registrarUso();
  });

  await recalcularPedidoAdmin(idPedido, pedidoAntigo);

  alert("Cupom do pedido aplicado!");
}

async function aplicarCupomItemAdmin(idPedido, pedidoAntigo) {
  alert("Função de cupom de item ainda será criada.");
}

async function removerCupomAdmin(idPedido, pedidoAntigo, tipoCupom) {
  alert("Função de remover cupom ainda será criada.");
}
function atualizarCamposCupomAdmin() {
  const tipo = document.getElementById("cupom-tipo")?.value;
  const modo = document.getElementById("cupom-modo")?.value;
  const temMinimo = document.getElementById("cupom-tem-minimo")?.checked;
  const itemGeral = document.getElementById("cupom-item-geral")?.checked;

  const boxModo = document.getElementById("box-modo-cupom");

  const campoValor = document.getElementById("cupom-valor");
  const campoKm = document.getElementById("campo-km-gratis");

  const campoItem = document.getElementById("campo-item-cupom");
  const campoMinimo = document.getElementById("campo-pedido-minimo");

  const campoItemNome = document.getElementById("cupom-item-nome");
  const campoPrecoPromo = document.getElementById("cupom-item-preco-promocional");

  const campoItemGeral = document.getElementById("campo-item-geral-tipo");

  const campoItemGeralModo = document.getElementById("campo-item-geral-modo");
  const campoItemGeralValor = document.getElementById("campo-item-geral-valor");
  const campoItemGeralCheck = document.getElementById("campo-item-geral-check");
  if (campoItemGeralCheck) {
    campoItemGeralCheck.style.display = tipo === "item" ? "block" : "none";
  }
  if (tipo !== "item") {
    const checkItemGeral = document.getElementById("cupom-item-geral");

    if (checkItemGeral) {
      checkItemGeral.checked = false;
    }

    if (campoItemGeral) campoItemGeral.style.display = "none";
    if (campoItemGeralModo) campoItemGeralModo.style.display = "none";
    if (campoItemGeralValor) campoItemGeralValor.style.display = "none";
  }

  // tipo
  boxModo.style.display = tipo && tipo !== "item" ? "block" : "none";

  campoItem.style.display = tipo === "item" ? "block" : "none";

  // taxa grátis
  if (tipo === "taxa") {
    document.querySelector('#cupom-modo option[value="gratis"]').style.display = "block";
    document.querySelector('#cupom-modo option[value="gratis"]').disabled = false;
  } else {
    document.querySelector('#cupom-modo option[value="gratis"]').style.display = "none";
    document.querySelector('#cupom-modo option[value="gratis"]').disabled = true;

    if (modo === "gratis") {
      document.getElementById("cupom-modo").value = "";
    }
  }

  campoKm.style.display = tipo === "taxa" && modo === "gratis" ? "block" : "none";

  // VALOR normal
  campoValor.style.display =
    tipo && tipo !== "item" && modo && !(tipo === "taxa" && modo === "gratis") ? "block" : "none";

  // pedido mínimo
  campoMinimo.style.display = temMinimo ? "block" : "none";

  // ITEM GERAL
  if (tipo === "item" && itemGeral) {
    // esconde item único
    if (campoItemNome) campoItemNome.style.display = "none";

    if (campoPrecoPromo) campoPrecoPromo.style.display = "none";

    // mostra grupo
    if (campoItemGeral) campoItemGeral.style.display = "block";

    if (campoItemGeralModo) campoItemGeralModo.style.display = "block";

    if (campoItemGeralValor) campoItemGeralValor.style.display = "block";
  } else {
    // item único
    if (campoItemNome) campoItemNome.style.display = "block";

    if (campoPrecoPromo) campoPrecoPromo.style.display = tipo === "item" ? "block" : "none";

    // esconde grupo
    if (campoItemGeral) campoItemGeral.style.display = "none";

    if (campoItemGeralModo) campoItemGeralModo.style.display = "none";

    if (campoItemGeralValor) campoItemGeralValor.style.display = "none";
  }
  document.querySelectorAll("#cupons-editor-corpo .cupom-campo-ui").forEach((label) => {
    const campo = document.getElementById(label.htmlFor);
    label.hidden = !!campo && campo.style.display === "none";
  });
}

function textoCompletoProduto(itemCarrinho) {
  const produto = buscarProdutoAtual(itemCarrinho.nome);
  return normalizarTextoCupomComTipo(`${itemCarrinho.nome} ${produto?.desc || ""}`);
}
async function listarMensagensAdmin() {
  const box = document.getElementById("lista-mensagens-admin");
  box.innerHTML = "<p>Buscando mensagens...</p>";

  const clientesSnap = await db.collection("clientes").get();

  let html = "";

  for (const clienteDoc of clientesSnap.docs) {
    const cliente = clienteDoc.data();

    const msgSnap = await db
      .collection("clientes")
      .doc(clienteDoc.id)
      .collection("mensagens")
      .orderBy("data", "desc")
      .get();

    msgSnap.forEach((doc) => {
      const m = doc.data();

      html += `
                <div class="card-mensagem-admin">
                    <strong>${cliente.nome || "Cliente"}</strong>
                    <p><b>Telefone:</b> ${cliente.telefone || clienteDoc.id}</p>
                    <p><b>Tipo:</b> ${m.tipo}</p>
                    <p>${m.texto}</p>
                   <small>
    ${new Date(m.data).toLocaleString("pt-BR")}
    ${m.remetente === "admin" ? (m.lida ? " • visualizada" : " • enviada") : ""}
</small>

                    <br><br>

                    <button type="button" onclick="responderMensagemAdmin('${clienteDoc.id}')">
                        Responder
                    </button>
                </div>
            `;
    });
  }

  box.innerHTML = html || "<p>Nenhuma mensagem encontrada.</p>";
}

async function responderMensagemAdmin(clienteId) {
  const texto = prompt("Digite a resposta para o cliente:");

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
let chamadoAdminAberto = null;
let clienteChamadoAdmin = null;

async function listarChamadosAdmin(status = "aberto", categoriaFiltro = "todos") {
  const box = document.getElementById("lista-chamados-admin");

  box.innerHTML = "<p>Buscando chamados...</p>";

  const clientesSnap = await db.collection("clientes").get();
  let chamados = [];

  for (const clienteDoc of clientesSnap.docs) {
    const cliente = clienteDoc.data();

    const snap = await db.collection("clientes").doc(clienteDoc.id).collection("chamados").get();

    snap.forEach((doc) => {
      const c = doc.data();

      if (status !== "todos" && c.status !== status) return;
      if (categoriaFiltro !== "todos" && c.categoria !== categoriaFiltro) return;
      chamados.push({
        id: doc.id,
        clienteId: clienteDoc.id,
        cliente,
        ...c,
      });
    });
  }

  // chamados.sort((a, b) => new Date(b.atualizadoEm || b.criadoEm) - new Date(a.atualizadoEm || a.criadoEm));

  if (chamados.length === 0) {
    box.innerHTML = "<p>Nenhum chamado encontrado.</p>";
    return;
  }

  let html = "";

  const chamadosNumerados = [...chamados]
    .sort((a, b) => new Date(a.criadoEm) - new Date(b.criadoEm))
    .map((c, index) => ({
      ...c,
      numeroChamado: index + 1,
    }));

  const chamadosRecentes = chamadosNumerados.sort(
    (a, b) => new Date(b.atualizadoEm || b.criadoEm) - new Date(a.atualizadoEm || a.criadoEm),
  );

  chamadosRecentes.forEach((c) => {
    const categoria =
      c.categoria === "reclamacao"
        ? "Reclamação"
        : c.categoria === "feedback"
          ? "Feedback"
          : "Outros";

    html += `
            <div class="card-chamado-admin">
                <strong>Suporte #${c.numeroChamado}</strong>
                <p><b>Cliente:</b> ${c.clienteNome || c.cliente.nome || "-"}</p>
                <p><b>Telefone:</b> ${c.clienteTelefone || c.cliente.telefone || c.clienteId}</p>
                <p><b>Tipo:</b> ${categoria}</p>
                <p><b>Status:</b> ${c.status}</p>
                 <button type="button" onclick="abrirChamadoAdmin('${c.clienteId}', '${c.id}')">
    Abrir conversa
</button>

<button type="button" onclick="togglePerfilClienteAdmin('${c.clienteId}', '${c.id}')">
    Ver perfil do cliente
</button>

            </div>
        `;
  });

  box.innerHTML = html;
}
function telaSuporteAdmin(id, titulo, aoFechar) {
  let conteudo = document.getElementById(id);
  if (conteudo) return conteudo;
  const dialog = document.createElement("dialog");
  dialog.className = "ui-caixa suporte-admin-tela";
  dialog.innerHTML =
    '<header class="suporte-admin-cabecalho"><button type="button" class="suporte-voltar">← Voltar</button><h3>' +
    escaparOperacao(titulo) +
    '</h3><button type="button" class="ui-x" aria-label="Fechar">×</button></header><div class="suporte-admin-conteudo" id="' +
    escaparOperacao(id) +
    '"></div>';
  dialog
    .querySelectorAll("header button")
    .forEach((botao) => (botao.onclick = () => dialog.close()));
  dialog.addEventListener(
    "close",
    () => {
      if (aoFechar) aoFechar();
      dialog.remove();
    },
    { once: true },
  );
  document.body.append(dialog);
  dialog.showModal();
  return dialog.querySelector(".suporte-admin-conteudo");
}
let chatAbertoAdmin = null;

async function abrirChamadoAdmin(clienteId, chamadoId) {
  if (window.listenerChamadoAdmin) {
    window.listenerChamadoAdmin();
    window.listenerChamadoAdmin = null;
  }
  document.querySelectorAll(".suporte-admin-tela [id^=chat-chamado-]").forEach((el) => {
    if (el.id !== `chat-chamado-${chamadoId}`) el.closest("dialog").close();
  });
  const chat = telaSuporteAdmin(`chat-chamado-${chamadoId}`, "Conversa do suporte", () => {
    if (chatAbertoAdmin === chamadoId) {
      if (window.listenerChamadoAdmin) window.listenerChamadoAdmin();
      window.listenerChamadoAdmin = null;
      chatAbertoAdmin = null;
    }
  });
  chatAbertoAdmin = chamadoId;
  clienteChamadoAdmin = clienteId;
  chamadoAdminAberto = chamadoId;

  chat.innerHTML = "<p>Carregando conversa...</p>";

  const chamadoRef = db.collection("clientes").doc(clienteId).collection("chamados").doc(chamadoId);

  const chamadoDoc = await chamadoRef.get();
  if (!chat.isConnected) return;
  if (!chamadoDoc.exists) {
    chat.innerHTML = "<p>Chamado não encontrado.</p>";
    return;
  }
  const chamado = chamadoDoc.data();

  if (window.listenerChamadoAdmin) {
    window.listenerChamadoAdmin();
    window.listenerChamadoAdmin = null;
  }

  window.listenerChamadoAdmin = chamadoRef
    .collection("mensagens")
    .orderBy("data")
    .onSnapshot((snapshot) => {
      let mensagens = [];

      snapshot.forEach((doc) => {
        mensagens.push(doc.data());
      });

      let html = `
                <div class="chat-admin-box">
                    <div class="suporte-admin-resumo"><strong>${escaparOperacao(chamado.clienteNome || "Cliente")}</strong><button type="button" onclick="togglePerfilClienteAdmin('${clienteId}', '${chamadoId}')">Ver perfil</button></div>

                    <p><b>Status:</b> ${chamado.status}</p>

                    ${
                      chamado.possuiPedidoRelacionado && chamado.pedidoRelacionadoId
                        ? `
                            <div class="pedido-anexado-suporte">
                                <p><b>📦 Pedido anexado:</b></p>
                                <button type="button" onclick="verPedidoAnexadoSuporte('${chamado.pedidoRelacionadoId}', '${chamado.pedidoRelacionadoColecao || "pedidos"}')">
                                    Ver pedido relacionado
                                </button>
                            </div>
                        `
                        : ""
                    }

                    ${
                      chamado.status === "finalizado"
                        ? `<p><b>Finalizado por:</b> ${chamado.finalizadoPor === "cliente" ? "Cliente" : "Admin"}</p>`
                        : ""
                    }
            `;

      mensagens.forEach((m) => {
        const ehAdmin = m.remetente === "admin";

        html += `
                    <div class="linha-msg ${ehAdmin ? "linha-admin" : "linha-cliente"}">
                        <img
                            src="${ehAdmin ? "images/avatar-admin.png" : chamado.clienteAvatar || "images/avatar1.png"}"
                            class="avatar-msg"
                        >

                        <div class="msg-chat ${ehAdmin ? "msg-admin" : "msg-cliente"}">
                            <strong>${ehAdmin ? "Admin" : chamado.clienteNome || "Cliente"}</strong>
                            <p>${escaparOperacao(m.texto)}</p>
                            <small>
                                ${new Date(m.data).toLocaleString("pt-BR")}
                                ${
                                  m.remetente === "admin"
                                    ? m.lida
                                      ? " • visualizada"
                                      : " • enviada"
                                    : ""
                                }
                            </small>
                        </div>
                    </div>
                `;
      });

      if (chamado.status !== "finalizado") {
        html += `
                    <div class="suporte-admin-compositor">
                      <textarea id="resposta-admin-chamado" aria-label="Resposta ao cliente" placeholder="Responder cliente..."></textarea>
                      <button type="button" aria-label="Enviar resposta" onclick="responderChamadoAdmin()">➤</button>
                    </div>
                    <button type="button" onclick="finalizarChamadoAdmin()">Encerrar chamado</button>
                `;
      }

      html += `</div>`;

      chat.innerHTML = html;
    });
}

async function responderChamadoAdmin() {
  const textarea = document.getElementById("resposta-admin-chamado");
  const texto = textarea.value.trim();

  if (!texto) return alert("Digite a resposta.");

  const chamadoRef = db
    .collection("clientes")
    .doc(clienteChamadoAdmin)
    .collection("chamados")
    .doc(chamadoAdminAberto);

  await chamadoRef.collection("mensagens").add({
    texto,
    remetente: "admin",
    data: new Date().toISOString(),
    lida: false,
  });

  await chamadoRef.update({
    atualizadoEm: new Date().toISOString(),
  });

  textarea.value = "";

  // A assinatura ativa atualiza a conversa sem reabrir o pop-up.
}

async function finalizarChamadoAdmin() {
  if (
    !(await dialogoOperacao("Deseja encerrar este chamado?", null, true, {
      botao: "Encerrar chamado",
    }))
  )
    return;

  const chamadoRef = db
    .collection("clientes")
    .doc(clienteChamadoAdmin)
    .collection("chamados")
    .doc(chamadoAdminAberto);

  await chamadoRef.update({
    status: "finalizado",
    finalizadoPor: "admin",
    finalizadoEm: new Date().toISOString(),
    atualizadoEm: new Date().toISOString(),
  });

  document.getElementById(`chat-chamado-${chamadoAdminAberto}`)?.closest("dialog").close();
  avisoOperacao("Chamado encerrado.");
  listarChamadosAdmin("aberto");
}
let perfilClienteAbertoAdmin = null;
let pedidosClienteAbertoAdmin = false;
async function togglePerfilClienteAdmin(clienteId, chamadoId) {
  await verPerfilClienteAdmin(clienteId, chamadoId);
}

async function verPerfilClienteAdmin(clienteId, chamadoId) {
  const box = telaSuporteAdmin(`perfil-cliente-${chamadoId}`, "Perfil do cliente");

  box.innerHTML = "<p>Carregando perfil do cliente...</p>";

  const clienteDoc = await db.collection("clientes").doc(clienteId).get();

  if (!clienteDoc.exists) {
    box.innerHTML = "<p>Cliente não encontrado.</p>";
    return;
  }

  const c = clienteDoc.data();

  const nivelCliente = c.fidelidadeAtiva
    ? c.nivelCliente || c.nivel || "Cliente Bronze"
    : "Sem nível";

  box.innerHTML = `
        <div class="card-perfil-suporte-admin">


            <img src="${c.avatar || "images/avatar1.png"}" class="avatar-admin-cliente">

            <p><b>Nome:</b> ${c.nome || "-"}</p>
            <p><b>Telefone:</b> ${c.telefone || clienteId}</p>
            <p><b>Código de ativação:</b> ${c.codigoAtivacao || "Sem código"}</p>
            <p><b>Fidelidade:</b> ${c.fidelidadeAtiva ? "Ativa" : "Inativa"}</p>
            <p><b>Nível:</b> ${nivelCliente}</p>
            <p><b>Total geral gasto:</b> R$ ${Number(c.totalGasto || 0).toFixed(2)}</p>
            <p><b>Total fidelidade:</b> R$ ${Number(c.totalFidelidade || 0).toFixed(2)}</p>
            <p><b>Bônus disponível:</b> R$ ${Number(c.bonusDisponivel || 0).toFixed(2)}</p>
            <p><b>Bônus gerado total:</b> R$ ${Number(c.bonusGeradoTotal || 0).toFixed(2)}</p>

           <button type="button" onclick="togglePedidosClienteSuporteAdmin('${clienteId}', '${chamadoId}')">
    Ver pedidos do cliente
</button>


        </div>
    `;
  box.closest("dialog").scrollTop = 0;
}
async function copiarResumoPedidoSuporte(pedidoId, numeroCliente = "-") {
  const doc = await db.collection("pedidos").doc(pedidoId).get();

  if (!doc.exists) {
    return alert("Pedido não encontrado.");
  }

  const p = doc.data();

  const itens = (p.itens || []).map((i) => `${i.quantidade || i.qtd || 1} ${i.nome}`).join("\n");

  const resumo = `Pedido
Cliente: ${p.nome || p.clienteNome || "-"}
Tipo: ${p.tipo || "-"}
Pagamento: ${p.pagamento || "-"}
Total: R$ ${Number(p.valorTotal || 0).toFixed(2)}

Itens:
${itens}`;

  await navigator.clipboard.writeText(resumo);

  alert("Resumo copiado. Agora você pode colar na resposta do suporte.");
}

async function togglePedidosClienteSuporteAdmin(clienteId, chamadoId) {
  const box = telaSuporteAdmin(`pedidos-cliente-${chamadoId}`, "Pedidos do cliente");
  box.innerHTML = "<p>Carregando pedidos...</p>";

  const pedidosSnap = await db.collection("pedidos").where("clienteId", "==", clienteId).get();

  let pedidos = [];

  pedidosSnap.forEach((doc) => {
    pedidos.push({
      id: doc.id,
      ...doc.data(),
    });
  });

  pedidos.sort(
    (a, b) =>
      Number(b.dataMs || new Date(b.data || 0).getTime()) -
      Number(a.dataMs || new Date(a.data || 0).getTime()),
  );

  if (pedidos.length === 0) {
    box.innerHTML = "<p>Nenhum pedido encontrado.</p>";
    return;
  }

  let html = "<h3>📦 Pedidos do cliente</h3>";

  aplicarNumerosDiariosOperacao(pedidos);
  pedidos.forEach((p, index) => {
    const numeroCliente = pedidos.length - index;

    const dataPedido = p.data ? new Date(p.data).toLocaleString("pt-BR") : "-";

    const itens = (p.itens || [])
      .map((i) => `${i.quantidade || i.qtd || 1} ${i.nome}`)
      .join("<br>");

    html += `
            <div class="pedido-suporte-admin">
                <strong>Pedido #${numeroCliente}</strong>
                <small>${dataPedido}</small>

                <p><b>Tipo:</b> ${p.tipo || "-"}</p>
                <p><b>Pagamento:</b> ${p.pagamento || "-"}</p>
                <p><b>Total pago:</b> R$ ${Number(p.valorTotal || 0).toFixed(2)}</p>
                <p><b>Antes do desconto:</b> R$ ${Number(p.valorAntesDesconto || p.valorTotal || 0).toFixed(2)}</p>
        
                <p><b>Desconto fidelidade:</b> R$ ${Number(p.descontoFidelidade || 0).toFixed(2)}</p>
                <p><b>Cupom:</b> ${p.cupomDescontoCodigo || "-"} | R$ ${Number(p.descontoCupom || 0).toFixed(2)}</p>

                <p>${itens}</p>

                <button type="button" onclick="copiarResumoPedidoSuporte('${p.id}', ${numeroCliente})">
                    Copiar resumo deste pedido
                </button>
            </div>
        `;
  });

  box.innerHTML = html;
}
async function verPedidoAnexadoSuporte(pedidoId, colecao = "pedidos") {
  if (!["pedidos", "historicoPagamentosClientes"].includes(colecao)) return;
  const box = telaSuporteAdmin("suporte-pedido-detalhe", "Pedido relacionado");
  box.innerHTML = "<p>Carregando pedido...</p>";
  try {
    const doc = await db.collection(colecao).doc(pedidoId).get();
    if (!doc.exists) {
      box.innerHTML = "<p>Pedido não encontrado.</p>";
      return;
    }
    const p = doc.data(),
      esc = escaparOperacao;
    const itens = (p.itens || [])
      .map(
        (item) =>
          "<li><strong>" +
          esc(item.quantidade || item.qtd || 1) +
          " × " +
          esc(item.nome || "Item") +
          "</strong>" +
          (item.observacao || item.obs ? "<p>" + esc(item.observacao || item.obs) + "</p>" : "") +
          "</li>",
      )
      .join("");
    box.innerHTML =
      '<article class="suporte-pedido-ficha"><h3>Pedido #' +
      esc(p.numero || p.numeroPedido || "—") +
      "</h3><dl>" +
      [
        ["Cliente", p.nome || p.clienteNome || "—"],
        ["Tipo", p.tipo || "—"],
        ["Pagamento", p.pagamento || "—"],
      ]
        .map(([label, valor]) => "<div><dt>" + label + "</dt><dd>" + esc(valor) + "</dd></div>")
        .join("") +
      "</dl><section><h4>Itens</h4><ul>" +
      (itens || "<li>Itens não registrados neste pagamento.</li>") +
      '</ul></section><p class="suporte-pedido-total">Total <strong>' +
      moedaOperacao(p.valorTotal ?? p.valorPago ?? p.valor ?? 0) +
      "</strong></p></article>";
  } catch {
    box.innerHTML = "<p>Não foi possível consultar o pedido. Tente novamente.</p>";
  }
}
async function listarUsuariosOnline() {
  const box = document.getElementById("lista-usuarios-online");

  box.innerHTML = "<p>Buscando usuários online...</p>";

  if (document.hidden || box.style.display === "none") return;
  if (box.checkVisibility && !box.checkVisibility()) return;
  const snap = await db
    .collection("usuariosOnline")
    .where("ultimaAtividade", ">=", new Date(Date.now() - 120000).toISOString())
    .get();

  let usuarios = [];

  snap.forEach((doc) => {
    usuarios.push(doc.data());
  });

  const agora = Date.now();

  usuarios = usuarios.filter((u) => {
    const ultima = new Date(u.ultimaAtividade).getTime();

    const diff = agora - ultima;

    return diff < 120000;
  });

  usuarios.sort((a, b) => new Date(b.ultimaAtividade) - new Date(a.ultimaAtividade));

  if (usuarios.length === 0) {
    box.innerHTML = "<p>Ninguém online no momento.</p>";

    return;
  }

  let html = `
        <div class="box-online-admin">
            <h3>🟢 Usuários online</h3>
    `;

  usuarios.forEach((u) => {
    html += `
            <div class="card-online-admin">

                <img
                    src="${u.avatar || "images/avatar1.png"}"
                    class="avatar-online-admin"
                >

                <div>

                    <p>
                        <b>${u.nome || "Sem cadastro"}</b>
                    </p>

                    <p>
                        ${u.telefone || "Sem telefone"}
                    </p>

                   <div class="info-online-status">

    <small class="status-online">
        ${u.logado ? "🟢 Logado" : "⚫ Sem cadastro"}
    </small>

    ${
      u.logado
        ? `
            <small>
                <b>Código:</b>
                ${u.codigoAtivacao || "Sem código"}
            </small>

            <small>
                <b>Fidelidade:</b>
                ${u.fidelidadeAtiva ? "✔ Ativa" : "❌ Inativa"}
            </small>
        `
        : ""
    }

</div>

                </div>

            </div>
        `;
  });

  html += `</div>`;

  box.innerHTML = html;
}
let intervaloOnlineAdmin = null;

async function toggleUsuariosOnlineAdmin() {
  const box = document.getElementById("lista-usuarios-online");

  if (box.style.display === "block") {
    box.style.display = "none";
    box.innerHTML = "";

    if (intervaloOnlineAdmin) {
      clearInterval(intervaloOnlineAdmin);
      intervaloOnlineAdmin = null;
    }

    return;
  }

  box.style.display = "block";
  await listarUsuariosOnline();

  intervaloOnlineAdmin = setInterval(() => {
    if (!document.hidden && box.style.display === "block") listarUsuariosOnline();
  }, 30000);
}
async function salvarProdutoAdmin() {
  const nome = document.getElementById("produto-nome").value.trim();
  const descricao = document.getElementById("produto-descricao").value.trim();

  if (!nome) return alert("Digite o nome do produto.");
  const modoAdicional =
    document.querySelector('input[name="modo-adicional"]:checked')?.value || "todos";

  let adicionaisPermitidos = [];

  if (modoAdicional === "selecionar") {
    document.querySelectorAll(".check-adicional-item:checked").forEach((check) => {
      adicionaisPermitidos.push(check.value);
    });
  }

  const produto = {
    nome,
    descricao,
    categoria: document.getElementById("produto-categoria").value,
    tipoBase: document.getElementById("produto-tipo-base").value,
    comboQtdLanches: Number(document.getElementById("produto-qtd-lanches-combo").value) || 1,

    preco: Number(document.getElementById("produto-preco").value) || 0,
    precoIndustrial: Number(document.getElementById("produto-preco-industrial").value) || 0,
    precoFrango: Number(document.getElementById("produto-preco-frango").value) || 0,
    precoFile: Number(document.getElementById("produto-preco-file").value) || 0,

    imagem: document.getElementById("produto-imagem").value.trim(),
    ordem: Number(document.getElementById("produto-ordem").value) || 999,

    opcoes: {
      artesanal: document.getElementById("produto-op-artesanal").checked,
      industrial: document.getElementById("produto-op-industrial").checked,
      frango: document.getElementById("produto-op-frango").checked,
      file: document.getElementById("produto-op-file").checked,
    },
    modoAdicional,
    adicionaisPermitidos,
    permiteAdicionais: document.getElementById("produto-adicionais").checked,
    ativo: document.getElementById("produto-ativo").checked,
    esgotado: document.getElementById("produto-esgotado").checked,

    criadoEm: new Date().toISOString(),
  };

  try {
    normalizarProdutoCatalogoUI(produto);
  } catch (erro) {
    return avisoOperacao(erro.message);
  }
  if (produtoEditandoId) {
    await db.collection("produtos").doc(produtoEditandoId).update(produto);
  } else {
    await db.collection("produtos").add(produto);
  }

  alert("Produto salvo!");
  document.getElementById("produto-nome").value = "";
  document.getElementById("produto-descricao").value = "";
  document.getElementById("produto-preco").value = "";
  document.getElementById("produto-preco-industrial").value = "";
  document.getElementById("produto-preco-frango").value = "";
  document.getElementById("produto-preco-file").value = "";
  document.getElementById("produto-imagem").value = "";
  document.getElementById("produto-ordem").value = "";
  await concluirProdutoCatalogoUI();
}

async function listarProdutosAdmin() {
  const box = document.getElementById("lista-produtos-admin");
  box.innerHTML = "<p>Carregando produtos...</p>";

  if (!produtosCatalogoCacheUI) {
    const snap = await db.collection("produtos").get();
    produtosCatalogoCacheUI = snap.docs.map((doc) => ({ ...doc.data(), id: doc.id }));
  }
  let produtos = [...produtosCatalogoCacheUI];

  const filtroCategoria = document.getElementById("filtro-categoria-produtos")?.value || "todos";

  if (filtroCategoria !== "todos") {
    produtos = produtos.filter((p) => p.categoria === filtroCategoria);
  }
  const busca = normalizarBuscaUI(document.getElementById("buscar-produto-admin")?.value);
  const categoriaFiltro = document.getElementById("filtro-categoria-admin")?.value || "";

  if (busca) {
    produtos = produtos.filter((p) => normalizarBuscaUI(p.nome).includes(busca));
  }

  if (categoriaFiltro === "ocultos") produtos = produtos.filter((p) => p.ativo === false);
  else if (categoriaFiltro) produtos = produtos.filter((p) => p.categoria === categoriaFiltro);
  produtos.sort((a, b) => {
    if (a.categoria !== b.categoria) {
      return a.categoria.localeCompare(b.categoria);
    }

    return Number(a.ordem || 999) - Number(b.ordem || 999);
  });

  if (produtos.length === 0) {
    box.innerHTML = "<p>Nenhum produto neste filtro.</p>";
    return;
  }

  let html = "";

  produtos.forEach((p) => {
    html += `
            <div class="card-produto-admin">
                <strong>${escaparOperacao(p.nome)}</strong>

                <p>
                    <b>Categoria:</b> ${p.categoria} |
                    <b>Ordem:</b> ${p.ordem}
                </p>

                <p>
                    <b>Preço:</b> R$ ${Number(p.preco || 0).toFixed(2)}
                </p>

                <p>
                    ${p.ativo ? "✅ Ativo" : "🙈 Invisível"} |
                    ${p.esgotado ? "❌ Esgotado" : "🟢 Disponível"}
                </p>

                <button type="button" onclick="alternarProdutoAtivo('${p.id}', ${!p.ativo})">
                    ${p.ativo ? "Ocultar" : "Mostrar"}
                </button>

                <button type="button" onclick="alternarProdutoEsgotado('${p.id}', ${!p.esgotado})">
                    ${p.esgotado ? "Marcar disponível" : "Marcar esgotado"}
                </button>

                <button type="button" onclick="editarProdutoAdmin('${p.id}')">
                    Editar
                </button>

                <button type="button" onclick="excluirProdutoAdmin('${p.id}')">
                    Excluir
                </button>
            </div>
        `;
  });

  box.innerHTML = html;
}

async function salvarAdicionalAdmin() {
  const nome = document.getElementById("adicional-nome").value.trim();
  const preco = Number(document.getElementById("adicional-preco").value) || 0;
  const ordem = Number(document.getElementById("adicional-ordem").value) || 999;

  if (!nome) return alert("Digite o nome do adicional.");
  if (preco < 0) return avisoOperacao("O preço do adicional não pode ser negativo.");

  const dadosAdicional = {
    nome,
    preco,
    ordem,
    ativo: document.getElementById("adicional-ativo").checked,
    esgotado: document.getElementById("adicional-esgotado").checked,
    criadoEm: new Date().toISOString(),
  };

  if (adicionalEditandoId) {
    await db.collection("adicionais").doc(adicionalEditandoId).update(dadosAdicional);
  } else {
    await db.collection("adicionais").add(dadosAdicional);
  }

  adicionalEditandoId = null;

  await concluirAdicionalCatalogoUI();
  avisoOperacao("Adicional salvo.");
}

async function carregarAdicionaisProduto() {
  const box = document.getElementById("lista-adicionais-produto");

  const snap = await db.collection("adicionais").where("ativo", "==", true).get();

  let html = "";

  snap.forEach((doc) => {
    const a = doc.data();

    html += `
            <label class="check-adicional-produto">
                <input
                    type="checkbox"
                    class="check-adicional-item"
                    value="${doc.id}"
                >
                ${a.nome}
            </label>
        `;
  });

  box.innerHTML = html;
}
async function alternarProdutoAtivo(id, novoStatus) {
  await db.collection("produtos").doc(id).update({
    ativo: novoStatus,
  });

  produtosCatalogoCacheUI = null;
  await listarProdutosAdmin();
}

async function alternarProdutoEsgotado(id, novoStatus) {
  await db.collection("produtos").doc(id).update({
    esgotado: novoStatus,
  });

  produtosCatalogoCacheUI = null;
  await listarProdutosAdmin();
}

async function excluirProdutoAdmin(id) {
  if (!confirm("Deseja excluir este produto?")) return;

  await db.collection("produtos").doc(id).delete();

  produtosCatalogoCacheUI = null;
  await listarProdutosAdmin();
}
async function editarProdutoAdmin(id) {
  const doc = await db.collection("produtos").doc(id).get();

  if (!doc.exists) return alert("Produto não encontrado.");

  const p = { ...doc.data() };
  for (const chave of ["nome", "descricao", "imagem", "img"])
    if (p[chave]) p[chave] = escaparOperacao(p[chave]);

  produtoEditandoId = id;

  const box = telaSuporteAdmin("form-editar-produto-admin", "Editar produto");
  box.classList.add("catalogo-ui");

  box.innerHTML = `
        <div class="form-produto-admin">
            <h3>Editando: ${p.nome}</h3>

            <div class="grupo-form-admin">
                <h3>Dados básicos</h3>

                <input id="edit-produto-nome" value="${p.nome || ""}" placeholder="Nome">

                <textarea id="edit-produto-descricao" placeholder="Descrição">${p.descricao || ""}</textarea>

                <div class="linha-form-admin">
                    <select id="edit-produto-categoria">
                        <option value="lanches" ${p.categoria === "lanches" ? "selected" : ""}>Lanches</option>
                        <option value="combos" ${p.categoria === "combos" ? "selected" : ""}>Combos</option>
                        <option value="bebidas" ${p.categoria === "bebidas" ? "selected" : ""}>Bebidas</option>
                        <option value="batatas" ${p.categoria === "batatas" ? "selected" : ""}>Batatas</option>
                    </select>

                    <select id="edit-produto-tipo-base">
                        <option value="hamburguer" ${p.tipoBase === "hamburguer" ? "selected" : ""}>Hambúrguer</option>
                        <option value="frango" ${p.tipoBase === "frango" ? "selected" : ""}>Frango</option>
                        <option value="file" ${p.tipoBase === "file" ? "selected" : ""}>Filé</option>
                        <option value="outro" ${p.tipoBase === "outro" ? "selected" : ""}>Outro</option>
                    </select>
                </div>
            </div>

            <div class="grupo-form-admin">
                <h3>Preços</h3>

                <div class="linha-form-admin">
                    <input id="edit-produto-preco" type="number" value="${p.preco || ""}" placeholder="Preço principal">
                    <input id="edit-produto-preco-industrial" type="number" value="${p.precoIndustrial || ""}" placeholder="Preço industrial">
                    <input id="edit-produto-preco-frango" type="number" value="${p.precoFrango || ""}" placeholder="Preço frango">
                    <input id="edit-produto-preco-file" type="number" value="${p.precoFile || ""}" placeholder="Preço filé">
                </div>
            </div>

            <div class="grupo-form-admin">
                <h3>Configurações</h3>

                <div class="linha-form-admin">
                    <input id="edit-produto-imagem" value="${p.imagem || p.img || ""}" placeholder="Imagem">
                    <input id="edit-produto-ordem" type="number" value="${p.ordem || ""}" placeholder="Posição">
                    <label>Quantidade de lanches no combo</label>
                    <input id="edit-produto-qtd-lanches-combo" type="number" value="${p.comboQtdLanches || 1}" placeholder="Qtd. lanches combo">
                </div>
            </div>

            <div class="grupo-form-admin">
                <h3>Opções disponíveis</h3>

                <label><input type="checkbox" id="edit-produto-op-artesanal" ${p.opcoes?.artesanal ? "checked" : ""}> Artesanal</label>
                <label><input type="checkbox" id="edit-produto-op-industrial" ${p.opcoes?.industrial ? "checked" : ""}> Industrial</label>
                <label><input type="checkbox" id="edit-produto-op-frango" ${p.opcoes?.frango ? "checked" : ""}> Frango</label>
                <label><input type="checkbox" id="edit-produto-op-file" ${p.opcoes?.file ? "checked" : ""}> Filé</label>
            </div>

          <div class="grupo-form-admin">
    <h3>Adicionais</h3>

    <label>
        <input type="checkbox"
               id="edit-produto-adicionais"
               ${p.permiteAdicionais ? "checked" : ""}>
        Permite adicionais
    </label>

    <label>
        <input type="radio"
               name="edit-modo-adicional"
               value="todos"
               ${p.modoAdicional !== "selecionar" ? "checked" : ""}>
        Todos
    </label>

    <label>
        <input type="radio"
               name="edit-modo-adicional"
               value="selecionar"
               ${p.modoAdicional === "selecionar" ? "checked" : ""}>
        Selecionar específicos
    </label>

    <div id="edit-lista-adicionais-produto"></div>
</div>

<div class="grupo-form-admin">
    <h3>Status</h3>

    <label>
        <input type="checkbox"
               id="edit-produto-ativo"
               ${p.ativo ? "checked" : ""}>
        Produto ativo
    </label>

    <label>
        <input type="checkbox"
               id="edit-produto-esgotado"
               ${p.esgotado ? "checked" : ""}>
        Produto esgotado
    </label>
</div>

            <button type="button" onclick="salvarEdicaoProdutoAdmin('${id}')">
                Salvar alterações
            </button>
        </div>
    `;
  await carregarAdicionaisEdicaoProduto(p);
  organizarFormularioProdutoCatalogoUI("edit-produto-", p);
  box.closest("dialog").scrollTop = 0;
}

async function editarAcrescimosPedidoAdmin(idPedido, pedidoAntigo) {
  const ref = db.collection("pedidos").doc(idPedido);
  const doc = await ref.get();

  if (!doc.exists) {
    return alert("Pedido não encontrado.");
  }

  const pedido = doc.data();
  const itens = pedido.itens || [];

  let textoItens = "Escolha o item:\n\n";

  itens.forEach((item, index) => {
    textoItens += `${index + 1}. ${item.nome}\n`;
  });

  const numeroItem = Number(prompt(textoItens));

  if (!numeroItem || numeroItem < 1 || numeroItem > itens.length) {
    return alert("Item inválido.");
  }

  const item = itens[numeroItem - 1];

  const acao = prompt(
    "O que deseja fazer?\n\n" +
      "1 - Adicionar acréscimo\n" +
      "2 - Remover acréscimo\n" +
      "3 - Limpar todos\n" +
      "4 - Sair",
  );

  if (acao === "4" || acao === null) {
    return;
  }

  if (acao === "3") {
    item.adicionais = [];

    await ref.update({
      itens,
      editadoEm: new Date().toISOString(),
    });

    await recalcularPedidoAdmin(idPedido, pedidoAntigo);

    alert("Acréscimos removidos!");
    return;
  }

  if (acao === "2") {
    const adicionais = item.adicionais || [];

    if (!adicionais.length) {
      return alert("Esse item não possui acréscimos.");
    }

    let lista = "Escolha o acréscimo para remover:\n\n";

    adicionais.forEach((a, index) => {
      lista += `${index + 1}. ${a.nome} (${a.qtd})\n`;
    });

    const remover = Number(prompt(lista));

    if (!remover || remover < 1 || remover > adicionais.length) {
      return alert("Opção inválida.");
    }

    adicionais.splice(remover - 1, 1);

    await ref.update({
      itens,
      editadoEm: new Date().toISOString(),
    });

    await recalcularPedidoAdmin(idPedido, pedidoAntigo);

    alert("Acréscimo removido!");
    return;
  }

  if (acao === "1") {
    const snap = await db.collection("adicionais").get();

    let adicionaisDisponiveis = [];

    snap.forEach((doc) => {
      const a = doc.data();

      if (a.ativo && !a.esgotado) {
        adicionaisDisponiveis.push(a);
      }
    });

    adicionaisDisponiveis.sort((a, b) => Number(a.ordem || 999) - Number(b.ordem || 999));

    if (!item.adicionais) {
      item.adicionais = [];
    }

    while (true) {
      let lista = "Escolha o acréscimo:\n\n";

      adicionaisDisponiveis.forEach((a, index) => {
        lista += `${index + 1}. ${a.nome} - R$ ${Number(a.preco).toFixed(2)}\n`;
      });

      const escolha = Number(prompt(lista));

      if (!escolha || escolha < 1 || escolha > adicionaisDisponiveis.length) {
        break;
      }

      const adicional = adicionaisDisponiveis[escolha - 1];

      item.adicionais.push({
        nome: adicional.nome,
        preco: Number(adicional.preco) || 0,
        qtd: 1,
      });

      const continuar = confirm("Adicionar outro acréscimo?");

      if (!continuar) {
        break;
      }
    }

    await ref.update({
      itens,
      editadoEm: new Date().toISOString(),
    });

    await recalcularPedidoAdmin(idPedido, pedidoAntigo);

    alert("Acréscimos atualizados!");
  }
}

async function salvarEdicaoProdutoAdmin(id) {
  const editModoAdicional =
    document.querySelector('input[name="edit-modo-adicional"]:checked')?.value || "todos";

  let editAdicionaisPermitidos = [];

  if (editModoAdicional === "selecionar") {
    document.querySelectorAll(".edit-check-adicional-item:checked").forEach((check) => {
      editAdicionaisPermitidos.push(check.value);
    });
  }

  const produto = {
    nome: document.getElementById("edit-produto-nome").value.trim(),
    descricao: document.getElementById("edit-produto-descricao").value.trim(),
    categoria: document.getElementById("edit-produto-categoria").value,
    tipoBase: document.getElementById("edit-produto-tipo-base").value,

    permiteAdicionais: document.getElementById("edit-produto-adicionais").checked,
    modoAdicional: editModoAdicional,
    adicionaisPermitidos: editAdicionaisPermitidos,

    preco: Number(document.getElementById("edit-produto-preco").value) || 0,
    precoIndustrial: Number(document.getElementById("edit-produto-preco-industrial").value) || 0,
    precoFrango: Number(document.getElementById("edit-produto-preco-frango").value) || 0,
    precoFile: Number(document.getElementById("edit-produto-preco-file").value) || 0,

    imagem: document.getElementById("edit-produto-imagem").value.trim(),
    ordem: Number(document.getElementById("edit-produto-ordem").value) || 999,
    comboQtdLanches: Number(document.getElementById("edit-produto-qtd-lanches-combo").value) || 1,

    opcoes: {
      artesanal: document.getElementById("edit-produto-op-artesanal").checked,
      industrial: document.getElementById("edit-produto-op-industrial").checked,
      frango: document.getElementById("edit-produto-op-frango").checked,
      file: document.getElementById("edit-produto-op-file").checked,
    },

    ativo: document.getElementById("edit-produto-ativo").checked,
    esgotado: document.getElementById("edit-produto-esgotado").checked,

    editadoEm: new Date().toISOString(),
  };

  if (!produto.nome) return avisoOperacao("Digite o nome do produto.");
  try {
    normalizarProdutoCatalogoUI(produto);
  } catch (erro) {
    return avisoOperacao(erro.message);
  }
  await db.collection("produtos").doc(id).update(produto);
  await concluirProdutoCatalogoUI(true);
  avisoOperacao("Produto atualizado.");
}

async function importarProdutosFixosParaFirebase() {
  if (!confirm("Importar produtos atuais para o Firebase? Faça isso só uma vez.")) {
    return;
  }

  const produtosFixos = [
    ...lanches.map((p) => ({
      ...p,
      categoria: "lanches",
      tipoBase: "hamburguer",
    })),

    ...listaCombos.map((p) => ({
      ...p,
      categoria: "combos",
      tipoBase: "hamburguer",
    })),

    ...bebidas.map((p) => ({
      ...p,
      categoria: "bebidas",
      tipoBase: "outro",
    })),

    ...batatas.map((p) => ({
      ...p,
      categoria: "batatas",
      tipoBase: "outro",
    })),
  ];

  for (let i = 0; i < produtosFixos.length; i++) {
    const p = produtosFixos[i];

    const produto = {
      nome: p.nome || "",
      descricao: p.desc || p.descricao || "",
      categoria: p.categoria,
      tipoBase: p.tipoBase,

      preco: Number(p.preco || 0),
      precoIndustrial: Number(p.precoIndustrial || 0),
      precoFrango: Number(p.precoFrango || 0),
      precoFile: Number(p.precoFile || 0),

      imagem: p.img || p.imagem || "",
      ordem: i + 1,

      opcoes: {
        artesanal: !!p.preco,
        industrial: !!p.precoIndustrial,
        frango: !!p.precoFrango,
        file: !!p.precoFile,
      },

      permiteAdicionais: true,
      modoAdicional: "todos",
      adicionaisPermitidos: [],

      ativo: true,
      esgotado: false,

      importadoDoCodigo: true,
      criadoEm: new Date().toISOString(),
    };

    await db.collection("produtos").add(produto);
  }

  alert("Produtos importados com sucesso!");
  listarProdutosAdmin();
}
async function listarAdicionaisAdmin() {
  const box = document.getElementById("lista-adicionais-admin");

  box.innerHTML = "<p>Carregando adicionais...</p>";

  const snap = await db.collection("adicionais").get();

  let adicionais = [];

  snap.forEach((doc) => {
    adicionais.push({
      id: doc.id,
      ...doc.data(),
    });
  });

  adicionais.sort((a, b) => Number(a.ordem || 999) - Number(b.ordem || 999));

  if (adicionais.length === 0) {
    box.innerHTML = "<p>Nenhum adicional criado.</p>";
    return;
  }

  let html = "";

  adicionais.forEach((a) => {
    html += `
            <div class="card-produto-admin">

                <strong>${a.nome}</strong>

                <p>
                    <b>Preço:</b>
                    R$ ${Number(a.preco || 0).toFixed(2)}
                </p>

                <p>
                    <b>Ordem:</b>
                    ${a.ordem || 999}
                </p>

                <p>
                    ${a.ativo ? "✅ Ativo" : "🙈 Invisível"}
                    |
                    ${a.esgotado ? "❌ Esgotado" : "🟢 Disponível"}
                </p>

                <button
                    onclick="editarAdicionalAdmin('${a.id}')"
                >
                    Editar
                </button>

                <button
                    onclick="alternarAdicionalAtivo('${a.id}', ${!a.ativo})"
                >
                    ${a.ativo ? "Ocultar" : "Mostrar"}
                </button>

                <button
                    onclick="alternarAdicionalEsgotado('${a.id}', ${!a.esgotado})"
                >
                    ${a.esgotado ? "Marcar disponível" : "Marcar esgotado"}
                </button>

                <button
                    onclick="excluirAdicionalAdmin('${a.id}')"
                >
                    Excluir
                </button>

            </div>
        `;
  });

  box.innerHTML = html;
}

let adicionalEditandoId = null;

async function editarAdicionalAdmin(id) {
  const doc = await db.collection("adicionais").doc(id).get();

  if (!doc.exists) return alert("Adicional não encontrado.");

  const a = doc.data();
  abrirAdicionalCatalogoUI(true);
  adicionalEditandoId = id;

  document.getElementById("adicional-nome").value = a.nome || "";
  document.getElementById("adicional-preco").value = a.preco || "";
  document.getElementById("adicional-ordem").value = a.ordem || "";
  document.getElementById("adicional-ativo").checked = a.ativo || false;
  document.getElementById("adicional-esgotado").checked = a.esgotado || false;

  const btn = document.querySelector('button[onclick="salvarAdicionalAdmin()"]');
  if (btn) btn.innerText = "Atualizar adicional";

  document.getElementById("catalogo-adicional-editor").closest("dialog").scrollTop = 0;
}
async function importarAdicionaisFixosParaFirebase() {
  if (!confirm("Importar adicionais antigos para o Firebase? Faça isso só uma vez.")) return;

  const adicionaisFixos = [
    { nome: "Hambúrguer Caseiro", preco: 8 },
    { nome: "Hambúrguer Industrial", preco: 4 },
    { nome: "Filé de Frango", preco: 6 },
    { nome: "Filé Mignon", preco: 9 },
    { nome: "Bacon", preco: 5 },
    { nome: "Salsicha", preco: 3 },
    { nome: "Calabresa", preco: 4 },
    { nome: "Presunto", preco: 2 },
    { nome: "Mussarela", preco: 3 },
    { nome: "Alface", preco: 2 },
    { nome: "Tomate", preco: 2 },
    { nome: "Cebola", preco: 2 },
    { nome: "Milho", preco: 2 },
    { nome: "Batata Palha", preco: 2 },
    { nome: "Cheddar", preco: 3 },
  ];

  for (let i = 0; i < adicionaisFixos.length; i++) {
    await db.collection("adicionais").add({
      ...adicionaisFixos[i],
      ordem: i + 1,
      ativo: true,
      esgotado: false,
      criadoEm: new Date().toISOString(),
    });
  }

  alert("Adicionais importados!");
  listarAdicionaisAdmin();
  carregarAdicionaisProduto();
}
async function alternarAdicionalAtivo(id, novoStatus) {
  await db.collection("adicionais").doc(id).update({
    ativo: novoStatus,
  });

  listarAdicionaisAdmin();
  carregarAdicionaisProduto();
}

async function alternarAdicionalEsgotado(id, novoStatus) {
  await db.collection("adicionais").doc(id).update({
    esgotado: novoStatus,
  });

  listarAdicionaisAdmin();
  carregarAdicionaisProduto();
}

async function excluirAdicionalAdmin(id) {
  if (!(await confirmarOperacao("Excluir este adicional?"))) return;

  await db.collection("adicionais").doc(id).delete();

  listarAdicionaisAdmin();
  carregarAdicionaisProduto();
}
let listaProdutosAberta = false;
let listaAdicionaisAberta = false;

function toggleListaProdutosAdmin() {
  const box = document.getElementById("lista-produtos-admin");

  if (!box) return;

  const estaAberta = box.style.display === "block" && box.innerHTML.trim() !== "";

  if (estaAberta) {
    box.innerHTML = "";
    box.style.display = "none";
    listaProdutosAberta = false;
    return;
  }

  box.style.display = "block";
  listaProdutosAberta = true;
  listarProdutosAdmin();
}

function toggleListaAdicionaisAdmin() {
  const box = document.getElementById("lista-adicionais-admin");

  listaAdicionaisAberta = !listaAdicionaisAberta;

  if (listaAdicionaisAberta) {
    listarAdicionaisAdmin();
    box.style.display = "block";
  } else {
    box.innerHTML = "";
    box.style.display = "none";
  }
}
function abrirAbaProdutoAdmin(tipo) {
  return abrirProdutoCatalogoUI(tipo);
}
document.querySelectorAll('input[name="modo-adicional"]').forEach((radio) => {
  radio.addEventListener("change", () => {
    const lista = document.getElementById("lista-adicionais-produto");
    lista.style.display = radio.value === "selecionar" && radio.checked ? "block" : "none";
  });
});
function atualizarCampoComboProduto() {
  const categoria = document.getElementById("produto-categoria").value;
  const box = document.getElementById("box-qtd-lanches-combo");

  box.style.display = categoria === "combos" ? "block" : "none";
}

document.getElementById("produto-categoria").addEventListener("change", atualizarCampoComboProduto);
atualizarCampoComboProduto();
async function carregarAdicionaisEdicaoProduto(produto) {
  const box = document.getElementById("edit-lista-adicionais-produto");
  if (!box) return;

  const modo = produto.modoAdicional || "todos";

  box.style.display = modo === "selecionar" ? "block" : "none";

  const snap = await db.collection("adicionais").where("ativo", "==", true).get();

  let html = "";

  snap.forEach((doc) => {
    const a = doc.data();

    html += `
            <label class="check-adicional-produto">
                <input
                    type="checkbox"
                    class="edit-check-adicional-item"
                    value="${doc.id}"
                    ${produto.adicionaisPermitidos?.includes(doc.id) ? "checked" : ""}
                >
                ${a.nome}
            </label>
        `;
  });

  box.innerHTML = html;

  document.querySelectorAll('input[name="edit-modo-adicional"]').forEach((radio) => {
    radio.addEventListener("change", () => {
      box.style.display = radio.value === "selecionar" && radio.checked ? "block" : "none";
    });
  });
}
let pedidoAbertoAtual = null;

function togglePedidoAdmin(id) {
  const box = document.getElementById(id);

  if (!box) return;

  if (pedidoAbertoAtual && pedidoAbertoAtual !== id) {
    const anterior = document.getElementById(pedidoAbertoAtual);

    if (anterior) {
      anterior.style.display = "none";
    }
  }

  if (box.style.display === "none") {
    box.style.display = "block";

    pedidoAbertoAtual = id;
  } else {
    box.style.display = "none";

    pedidoAbertoAtual = null;
  }
}
async function salvarAtendenteAdmin() {
  const nome = document.getElementById("atendente-nome").value.trim();

  const codigo = document.getElementById("atendente-codigo").value.trim();

  if (!nome) {
    return alert("Digite o nome.");
  }

  if (!codigo) {
    return alert("Digite o código.");
  }

  await db.collection("atendentes").add({
    nome,
    codigo,

    ativo: true,

    criadoEm: new Date().toISOString(),
  });

  alert("Atendente salvo!");

  document.getElementById("atendente-nome").value = "";
  document.getElementById("atendente-codigo").value = "";

  listarAtendentesAdmin();
}
async function listarAtendentesAdmin() {
  const box = document.getElementById("lista-atendentes-admin");

  box.innerHTML = "<p>Carregando...</p>";

  const snap = await db.collection("atendentes").get();

  if (snap.empty) {
    box.innerHTML = "<p>Nenhum atendente cadastrado.</p>";

    return;
  }

  let html = "";

  snap.forEach((doc) => {
    const a = doc.data();

    html += `

    <div class="card-atendente-admin">

        <strong>${a.nome}</strong>

        <p>
            Código:
            ${a.codigo}
        </p>

        <p>
            Status:
            ${a.ativo ? "🟢 Ativo" : "🔴 Inativo"}
        </p>

        <button
            type="button"
            onclick="toggleAtendenteAdmin(
                '${doc.id}',
                ${a.ativo}
            )"
        >
            ${a.ativo ? "Desativar" : "Ativar"}
        </button>

    </div>

`;
  });

  box.innerHTML = html;
}
async function toggleAtendenteAdmin(id, ativoAtual) {
  await db.collection("atendentes").doc(id).update({
    ativo: !ativoAtual,
  });

  listarAtendentesAdmin();
}
let adminAvancadoLiberado = false;

async function liberarAreaAvancadaAdmin() {
  if (adminAvancadoLiberado) {
    const area = document.getElementById("area-admin-avancada");

    area.style.display = area.style.display === "none" ? "block" : "none";

    return;
  }

  const senhaDigitada = await solicitarEntradaOperacao("Digite a senha administrativa", "password");

  if (!senhaDigitada) return;

  const doc = await db.collection("config").doc("admin").get();

  if (!doc.exists) {
    alert("Configuração não encontrada.");

    return;
  }

  const senhaCorreta = String(doc.data().senhaMestre || "");

  if (senhaDigitada !== senhaCorreta) {
    alert("Senha incorreta.");

    return;
  }

  adminAvancadoLiberado = true;

  document.getElementById("area-admin-avancada").style.display = "block";
}
function abrirFinanceiroAdmin() {
  window.open("financeiro.html", "_blank");
}
