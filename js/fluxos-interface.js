/**
 * Fluxos de interface: revisão do pedido, consumo local, seletores de período e login do autoatendimento. Aparência em css/componentes/.
 *
 * Organização e caminhos: consulte GUIA-DO-CODIGO.md.
 */
"use strict";
function configurarAcoesDestinoPedidoUI(janela, imprimir, enviar, rotulo) {
  janela.innerHTML = `<button class="ui-x" aria-label="Fechar opções">×</button><h2>${rotulo}</h2><div class="operacao-acoes"><button type="button" data-acao="imprimir">Imprimir</button><button type="button" data-acao="enviar">${rotulo === "Motoboy" ? "Enviar WhatsApp" : "Tela"}</button></div>`;
  janela.querySelector(".ui-x").onclick = () => janela.close();
  const executar = async (acao) => {
    const botoes = janela.querySelectorAll(".operacao-acoes button");
    botoes.forEach((botao) => (botao.disabled = true));
    try {
      if ((await acao()) !== false) janela.close();
    } catch (erro) {
      avisoOperacao("Não foi possível concluir: " + erro.message);
    } finally {
      botoes.forEach((botao) => (botao.disabled = false));
    }
  };
  janela.querySelector('[data-acao="imprimir"]').onclick = () => executar(imprimir);
  janela.querySelector('[data-acao="enviar"]').onclick = () => executar(enviar);
}
function abrirDestinoPedidoUI(destino, colecao, id) {
  const d = document.createElement("dialog");
  d.className = "ui-caixa destino-pedido-ui";
  configurarAcoesDestinoPedidoUI(
    d,
    () => imprimirRegistroOperacao(colecao, id, destino),
    () =>
      destino === "cozinha"
        ? confirmarProducaoOperacao(colecao, id)
        : compartilharMotoboyOperacao(colecao, id),
    destino === "cozinha" ? "Cozinha" : "Motoboy",
  );
  d.addEventListener("close", () => d.remove(), { once: true });
  document.body.append(d);
  d.showModal();
}
function abrirCozinhaMesaUI(numero) {
  const d = document.createElement("dialog");
  d.className = "ui-caixa destino-pedido-ui";
  configurarAcoesDestinoPedidoUI(
    d,
    () => imprimirMesaOperacao(Number(numero), "cozinha"),
    () => enviarMesaCozinhaUI(Number(numero)),
    `Cozinha · Mesa ${Number(numero)}`,
  );
  d.addEventListener("close", () => d.remove(), { once: true });
  document.body.append(d);
  d.showModal();
}
function semanasDoMesUI(mes) {
  const [a, m] = mes.split("-").map(Number),
    primeiro = new Date(Date.UTC(a, m - 1, 1)),
    fim = new Date(Date.UTC(a, m, 1));
  primeiro.setUTCDate(primeiro.getUTCDate() - primeiro.getUTCDay());
  const semanas = [];
  for (let d = primeiro; d < fim; d = new Date(d.getTime() + 7 * 86400000)) {
    const ate = new Date(d.getTime() + 6 * 86400000);
    semanas.push({
      dia: d.toISOString().slice(0, 10),
      rotulo: `${d.toLocaleDateString("pt-BR", { timeZone: "UTC" })} a ${ate.toLocaleDateString("pt-BR", { timeZone: "UTC" })}`,
    });
  }
  return semanas;
}
function montarSeletorFinanceiroUI() {
  const tipo = document.getElementById("periodo-financeiro"),
    dia = document.getElementById("dia-financeiro");
  if (!tipo || !dia) return;
  const label = document.querySelector('label[for="dia-financeiro"]');
  label.textContent = "Dia";
  tipo.closest("label").after(label);
  label.after(dia);
  tipo.onchange = () => atualizarSeletorFinanceiroUI();
  const extra = document.createElement("div");
  extra.id = "seletor-periodo-extra";
  dia.after(extra);
  atualizarSeletorFinanceiroUI();
}
function atualizarSeletorFinanceiroUI() {
  const tipo = document.getElementById("periodo-financeiro").value,
    dia = document.getElementById("dia-financeiro"),
    box = document.getElementById("seletor-periodo-extra");
  const atual = dia.value || diaCuiabaFinanceiro(new Date());
  dia.value = atual;
  dia.hidden = tipo !== "dia";
  document.querySelector('label[for="dia-financeiro"]').hidden = tipo !== "dia";
  box.replaceChildren();
  if (tipo === "dia") return;
  if (tipo === "ano") {
    box.innerHTML = `<label>Ano<input id="ano-financeiro" type="number" min="2000" max="2200" value="${atual.slice(0, 4)}"></label>`;
    box.querySelector("input").onchange = (e) => {
      dia.value = e.target.value + "-01-01";
    };
    dia.value = atual.slice(0, 4) + "-01-01";
    return;
  }
  box.innerHTML = `<label>Mês<input id="mes-financeiro" type="month" value="${atual.slice(0, 7)}"></label>${tipo === "semana" ? '<label>Semana · domingo a sábado<select id="semana-financeiro"></select></label>' : ""}`;
  const mudar = () => {
    const mes = box.querySelector("input").value;
    if (!mes) return;
    if (tipo === "mes") {
      dia.value = mes + "-01";
      return;
    }
    const semanas = semanasDoMesUI(mes),
      select = box.querySelector("select");
    select.innerHTML = semanas.map((s) => `<option value="${s.dia}">${s.rotulo}</option>`).join("");
    const contem = semanas.find(
      (s) =>
        atual >= s.dia &&
        atual <
          new Date(new Date(s.dia + "T00:00:00Z").getTime() + 7 * 86400000)
            .toISOString()
            .slice(0, 10),
    );
    if (contem) select.value = contem.dia;
    dia.value = select.value;
    select.onchange = () => (dia.value = select.value);
  };
  box.querySelector("input").onchange = mudar;
  mudar();
}
let checkoutEtapaUI = "revisao";
function montarConsumoLocalUI(itens, nome, telefone, cliente, obs = "", agora = Date.now()) {
  const produtos = itens.map((i) => ({
    nome: i.nome,
    tipoCarne: i.tipoCarne || i.tipo || "",
    produtoId: i.produtoId || i.id || null,
    categoria: i.categoria || "Lanches",
    quantidade: Number(i.qtd || i.quantidade || 1),
    preco: Number(i.preco || 0),
    adicionais: i.adicionais || [],
    observacao: i.obs || i.observacao || "",
    lanchesCombo: i.lanchesCombo || [],
    comboQtdLanches: i.comboQtdLanches || 0,
    comboComponentes: i.comboComponentes || [],
    descricao: i.descricao || i.desc || "",
  }));
  const subtotal = produtos.reduce((n, i) => n + i.preco * i.quantidade, 0);
  const pedido = {
    nome,
    telefone,
    telefoneLimpo: telefone.replace(/\D/g, ""),
    clienteId: cliente?.telefone || null,
    itens: produtos,
    valorTotal: subtotal,
    valorAntesDesconto: subtotal,
    taxaEntrega: 0,
    tipo: "Local",
    pagamento: "A definir no local",
    pagamentoConfirmado: false,
    descontoCupom: 0,
    descontoFidelidade: 0,
    observacao: obs,
    data: new Date(agora).toISOString(),
    dataMs: agora,
  };
  const linhas = produtos
    .map(
      (i) =>
        `${i.quantidade} ${i.nome}${i.adicionais.map((a) => `\n  + ${a.qtd || a.quantidade || 1} ${a.nome}`).join("")}${i.observacao ? "\n  Obs.: " + i.observacao : ""}${i.lanchesCombo
          .map((l, n) => {
            const ad = (l.adicionais || []).map((a) => `+ ${a.qtd || 1} ${a.nome}`);
            if (l.observacao || l.obs) ad.push("Obs.: " + (l.observacao || l.obs));
            return ad.length ? "\n  Lanche " + (n + 1) + ": " + ad.join("; ") : "";
          })
          .join("")}`,
    )
    .join("\n\n");
  return {
    pedido,
    mensagem: `*PEDRÃO LANCHES*\n*Consumir no local*\nNome: ${nome}\nCelular: ${telefone}\n\n${linhas}\n\nSubtotal: ${moedaOperacao(subtotal)}${obs ? "\nObservação: " + obs : ""}`,
  };
}
let enviandoConsumoLocalUI = false;
async function enviarConsumoLocalUI() {
  if (typeof permitirPedidoLojaUI === "function" && !permitirPedidoLojaUI()) return;
  if (enviandoConsumoLocalUI) return;
  const nome = document.getElementById("nome-cliente").value.trim(),
    telefone = document.getElementById("telefone-cliente").value.replace(/\D/g, "");
  if (!nome || telefone.length !== 11)
    return avisoOperacao("Informe nome e celular completo com DDD.");
  if (!carrinho.length || revisaoCarrinhoVersao !== carrinhoVersao)
    return avisoOperacao("Confira os itens novamente antes de enviar.");
  enviandoConsumoLocalUI = true;
  try {
    const { pedido, mensagem } = montarConsumoLocalUI(
      carrinho,
      nome,
      telefone,
      clienteLogado,
      dadosPedidoTemporario.obs,
    );
    if (!(await salvarPedidoFirebase(pedido))) {
      if (typeof permitirPedidoLojaUI === "function" && !permitirPedidoLojaUI()) return;
      return avisoOperacao("Não foi possível salvar. Tente novamente.");
    }
    window.open("https://wa.me/5565992386045?text=" + encodeURIComponent(mensagem), "_blank");
    carrinho = [];
    dadosPedidoTemporario = {};
    revisaoCarrinhoVersao = -1;
    atualizarCarrinho();
    fecharCheckoutUI("inicio");
  } finally {
    enviandoConsumoLocalUI = false;
  }
}
function ajustarValoresRevisaoUI() {
  if (dadosPedidoTemporario.tipo === "Local") return;
  const taxa = document.getElementById("resumo-taxa"),
    molhos = document.getElementById("linha-molhos-pagos");
  if (!taxa) return;
  taxa.closest("p").hidden = dadosPedidoTemporario.tipo !== "Entrega";
  molhos.closest("p").hidden = !(
    carrinho.reduce((n, i) => n + Number(i.totalMolhosPagos || 0), 0) > 0
  );
  const cnh = document.getElementById("campo-cnh");
  cnh.style.display =
    dadosPedidoTemporario.tipo === "Entrega" &&
    document.getElementById("condominio").value === "Sim"
      ? "block"
      : "none";
}
function abrirEtapaCheckoutUI(etapa) {
  checkoutEtapaUI = etapa;
  const entrega = document.getElementById("checkout-entrega-ui");
  document.getElementById("revisao-pedido").hidden = etapa !== "revisao";
  entrega.hidden = etapa !== "entrega";
  ajustarValoresRevisaoUI();
  if (etapa === "entrega") {
    document.getElementById("finalizar-pedido").classList.add("checkout-entrega-ativa");
    entrega.scrollIntoView({ block: "start" });
  } else {
    document.getElementById("finalizar-pedido").classList.remove("checkout-entrega-ativa");
    document.getElementById("revisao-pedido").scrollIntoView({ block: "start" });
  }
}
function fecharCheckoutUI(destino = "finalizar") {
  document.getElementById("checkout-entrega-ui").hidden = true;
  document.getElementById("revisao-pedido").hidden = false;
  document.getElementById("revisao-pedido").style.display = "none";
  document.getElementById("finalizar-pedido").classList.remove("checkout-entrega-ativa");
  if (destino !== "finalizar") abrirTela(destino);
}
function montarCheckoutUI() {
  const revisao = document.getElementById("revisao-pedido");
  if (!revisao) return;
  const etapa = document.createElement("section");
  etapa.id = "checkout-entrega-ui";
  etapa.hidden = true;
  etapa.innerHTML =
    '<div class="ui-navegacao"><button class="ui-voltar" onclick="abrirEtapaCheckoutUI(\'revisao\')">← Voltar</button><button class="ui-x" aria-label="Fechar finalização" onclick="fecharCheckoutUI()">×</button></div><h2>Entrega e pagamento</h2>';
  const inicio = document.getElementById("box-condominio");
  let n = inicio;
  while (n) {
    const proximo = n.nextSibling;
    etapa.append(n);
    n = proximo;
  }
  revisao.after(etapa);
  const continuar = document.createElement("button");
  continuar.textContent = "Continuar";
  continuar.onclick = () =>
    dadosPedidoTemporario.tipo === "Local"
      ? enviarConsumoLocalUI()
      : abrirEtapaCheckoutUI("entrega");
  revisao.append(continuar);
  const cab = document.createElement("div");
  cab.className = "ui-navegacao";
  cab.innerHTML =
    '<button class="ui-voltar" onclick="fecharCheckoutUI()">← Voltar</button><button class="ui-x" aria-label="Fechar revisão" onclick="fecharCheckoutUI()">×</button>';
  revisao.prepend(cab);
  document.getElementById("endereco-escrito").placeholder =
    "Ajude o motoboy: rua, número, bairro e ponto de referência";
  document.querySelector("#box-endereco-salvo>label").textContent = "Endereço por escrito";
  document.querySelector(".linha-salvar-endereco").hidden = true;
  const salvos = document.createElement("button");
  salvos.type = "button";
  salvos.className = "btn-enderecos-salvos-ui";
  salvos.textContent = "Endereços salvos";
  salvos.onclick = async () => {
    if (!clienteLogado) return avisoOperacao("Entre na sua conta para consultar endereços salvos.");
    await carregarEnderecosNaRevisao("Entrega");
    const s = document.getElementById("select-endereco-salvo");
    s.style.display = "block";
    s.focus();
  };
  const tituloEndereco = document.querySelector("#box-endereco-salvo>label");
  tituloEndereco.htmlFor = "endereco-escrito";
  const cabecalhoEndereco = document.createElement("div");
  cabecalhoEndereco.className = "cabecalho-endereco-ui";
  tituloEndereco.before(cabecalhoEndereco);
  cabecalhoEndereco.append(tituloEndereco, salvos);
  document.getElementById("select-endereco-salvo").style.display = "none";
  const original = exibirRevisao;
  window.exibirRevisao = (...args) => {
    if (typeof permitirPedidoLojaUI === "function" && !permitirPedidoLojaUI()) return;
    const local = args[3] === "Local",
      anterior = etapa.hidden;
    revisao.classList.toggle("revisao-local", local);
    continuar.textContent = local ? "Enviar para o WhatsApp" : "Continuar";
    document.querySelectorAll("#detalhe-valores>*").forEach((e) => (e.hidden = false));
    if (local) {
      dadosPedidoTemporario = {
        itens: args[0],
        subtotal: args[1],
        taxa: 0,
        tipo: "Local",
        obs: args[4] || "",
      };
      revisaoCarrinhoVersao = carrinhoVersao;
      descontoFidelidade = 0;
      descontoCupom = 0;
      cupomDescontoAplicado = null;
      document.getElementById("lista-conferencia").innerHTML = itensHtmlOperacao(
        carrinho.map((i) => ({ ...i, quantidade: i.qtd, observacao: i.obs })),
      );
      document.getElementById("resumo-subtotal").textContent = moedaOperacao(args[1]);
      const linha = document.getElementById("resumo-subtotal").closest("p");
      document.querySelectorAll("#detalhe-valores>*").forEach((e) => (e.hidden = e !== linha));
      revisao.style.display = "block";
    } else original(...args);
    revisao.hidden = !anterior;
    ajustarValoresRevisaoUI();
  };
  const finalizarOriginal = finalizarPedido;
  window.finalizarPedido = (...args) => {
    if (typeof permitirPedidoLojaUI === "function" && !permitirPedidoLojaUI()) return;
    etapa.hidden = true;
    revisao.hidden = false;
    return finalizarOriginal(...args);
  };
  document.getElementById("condominio").addEventListener("change", ajustarValoresRevisaoUI);
  const endOriginal = carregarEnderecosNaRevisao;
  window.carregarEnderecosNaRevisao = async (...args) => {
    const texto = document.getElementById("endereco-escrito").value;
    await endOriginal(...args);
    if (texto) document.getElementById("endereco-escrito").value = texto;
    document.getElementById("select-endereco-salvo").style.display = "none";
  };
  const perfil = document.getElementById("perfil-logado");
  perfil.querySelector(".ui-x")?.remove();
  const enderecoBtn = [...perfil.querySelectorAll("button")].find(
    (b) => b.textContent.trim() === "Endereços",
  );
  if (enderecoBtn) {
    const formulario = document.getElementById("perfil-form"),
      area = document.getElementById("area-perfil");
    const acoes = document.createElement("div");
    acoes.className = "perfil-edicao-acoes";
    formulario.append(acoes);
    acoes.append(document.getElementById("btn-entrar-perfil"), enderecoBtn);
    const modoOriginal = abrirPerfilModo;
    window.abrirPerfilModo = (modo) => {
      area.replaceChildren();
      enderecoBtn.hidden = modo !== "editar";
      return modoOriginal(modo);
    };
    enderecoBtn.hidden = true;
    const enderecosOriginal = abrirEnderecosCliente;
    window.abrirEnderecosCliente = async (...args) => {
      abrirJanelaElementoUI(area, "Seus endereços");
      await enderecosOriginal(...args);
      area.querySelector(":scope > h3")?.remove();
      const novo = document.createElement("button");
      novo.textContent = "Adicionar endereço";
      novo.onclick = adicionarEndereco;
      area.append(novo);
    };
    const adicionarOriginal = adicionarEndereco;
    window.adicionarEndereco = () => {
      document.getElementById("form-endereco")?.remove();
      adicionarOriginal();
      const form = document.getElementById("form-endereco");
      form.querySelector("h3")?.remove();
      form.style.display = "none";
      const janela = abrirJanelaElementoUI(form, "Novo endereço");
      janela.addEventListener("close", () => form.remove(), { once: true });
    };
    for (const nome of ["mostrarPedidosCliente", "abrirBonusCliente", "mostrarPainelCliente"]) {
      const original = window[nome];
      if (typeof original === "function")
        window[nome] = (...args) => {
          perfil.append(area);
          return original(...args);
        };
    }
  }
  const modal = document.querySelector("#modal-carrinho .conteudo-carrinho");
  modal.querySelector("h2").remove();
  modal.append(modal.querySelector(".acoes-carrinho"));
}
let modoContaAutoUI = "escolha";
async function buscarContaPorCodigoAutoUI(banco, codigo) {
  const resultado = await banco
    .collection("clientes")
    .where("codigoAtivacao", "==", codigo.trim())
    .limit(2)
    .get();
  if (resultado.docs.length !== 1)
    throw Error(
      resultado.docs.length
        ? "Este código está vinculado a mais de uma conta. Procure o atendimento."
        : "Código de ativação não encontrado.",
    );
  const doc = resultado.docs[0],
    cliente = doc.data(),
    telefone = String(cliente.telefone || doc.id).replace(/\D/g, "");
  if (!cliente.nome || telefone.length !== 11)
    throw Error("Cadastro incompleto. Procure o atendimento.");
  return { nome: cliente.nome, telefone };
}
async function entrarContaAutoUI() {
  const codigo = document.getElementById("login-auto-codigo").value.trim(),
    status = document.getElementById("status-login-auto"),
    botao = document.getElementById("auto-confirmar-conta");
  status.textContent = "";
  botao.disabled = true;
  try {
    const nome = document.getElementById("login-auto-nome").value.trim();
    const telefone = document.getElementById("login-auto-telefone").value.replace(/\D/g, "");
    if (codigo && !(nome && telefone.length === 11)) {
      const conta = await buscarContaPorCodigoAutoUI(db, codigo);
      document.getElementById("login-auto-nome").value = conta.nome;
      document.getElementById("login-auto-telefone").value = conta.telefone;
    }
    await entrarClienteAutoatendimento();
  } catch (e) {
    status.textContent = e.message;
    mostrarAvisoUI(e.message);
  } finally {
    botao.disabled = false;
  }
}
function mostrarModoContaAutoUI(modo) {
  modoContaAutoUI = modo;
  const m = document.getElementById("modal-login-auto");
  m.dataset.modo = modo;
  m.querySelector("#auto-escolha-conta").hidden = modo !== "escolha";
  m.querySelector("#auto-form-conta").hidden = modo === "escolha";
  m.querySelector("#auto-voltar-escolha").hidden = modo === "escolha";
  m.querySelector("#auto-form-conta h3").textContent = modo === "criar" ? "Criar login" : "Login";
  m.querySelector("#auto-grupo-codigo").hidden = modo === "criar";
  m.querySelector("#auto-confirmar-conta").textContent =
    modo === "criar" ? "Criar login" : "Entrar";
}
async function criarContaAutoUI() {
  const nome = document.getElementById("login-auto-nome").value.trim(),
    telefone = document.getElementById("login-auto-telefone").value.replace(/\D/g, "");
  const status = document.getElementById("status-login-auto");
  if (nome.length < 2 || telefone.length !== 11) {
    status.textContent = "Informe nome e celular completo com DDD.";
    return;
  }
  try {
    const ref = db.collection("clientes").doc(telefone);
    await db.runTransaction(async (t) => {
      if ((await t.get(ref)).exists) throw Error("Este celular já tem conta. Escolha Login.");
      t.set(ref, {
        nome,
        telefone,
        nomeReal: "",
        fidelidadeAtiva: false,
        nivelCliente: "Sem nível",
        bonusDisponivel: 0,
        totalGasto: 0,
        totalFidelidade: 0,
        bonusGeradoTotal: 0,
        avatar: "images/avatar1.png",
        criadoEm: Date.now(),
      });
    });
    document.getElementById("login-auto-codigo").value = "";
    await entrarClienteAutoatendimento();
  } catch (e) {
    status.textContent = e.message;
  }
}
function montarContaAutoUI() {
  const modal = document.querySelector("#modal-login-auto .modal-conteudo");
  if (!modal) return;
  const ids = [
    "login-auto-nome",
    "login-auto-telefone",
    "login-auto-codigo",
    "login-auto-salvar",
    "status-login-auto",
  ];
  const campos = Object.fromEntries(ids.map((id) => [id, document.getElementById(id)]));
  const x = modal.querySelector(".btn-fechar-modal-auto");
  modal.replaceChildren(x);
  modal.insertAdjacentHTML(
    "beforeend",
    '<button id="auto-voltar-escolha" class="ui-voltar" onclick="mostrarModoContaAutoUI(\'escolha\')">← Voltar</button><h2>Minha conta</h2><div id="auto-escolha-conta"><button onclick="mostrarModoContaAutoUI(\'login\')">Login</button><button onclick="mostrarModoContaAutoUI(\'criar\')">Criar login</button></div><div id="auto-form-conta"><h3>Login</h3></div>',
  );
  const form = modal.querySelector("#auto-form-conta");
  for (const [id, label] of [
    ["login-auto-nome", "Nome"],
    ["login-auto-telefone", "Celular"],
  ]) {
    const l = document.createElement("label");
    l.textContent = label;
    l.append(campos[id]);
    form.append(l);
  }
  const cod = document.createElement("div");
  cod.id = "auto-grupo-codigo";
  cod.innerHTML =
    '<div class="auto-ou">ou</div><label for="login-auto-codigo">Código de ativação</label>';
  cod.append(campos["login-auto-codigo"]);
  campos["login-auto-codigo"].placeholder = "Entre somente com seu código";
  form.append(cod);
  const salvar = document.createElement("label");
  salvar.className = "auto-lembrar";
  salvar.append(campos["login-auto-salvar"], document.createTextNode(" Lembrar neste dispositivo"));
  form.append(salvar);
  const b = document.createElement("button");
  b.id = "auto-confirmar-conta";
  b.onclick = () => (modoContaAutoUI === "criar" ? criarContaAutoUI() : entrarContaAutoUI());
  form.append(b, campos["status-login-auto"]);
  const original = abrirLoginAutoatendimento;
  window.abrirLoginAutoatendimento = async () => {
    await original();
    mostrarModoContaAutoUI("escolha");
  };
  mostrarModoContaAutoUI("escolha");
}
function atualizarLimparBuscaUI() {
  document.querySelectorAll(".busca-limpar").forEach((b) => {
    const input = b.parentElement.querySelector("input[type=search]");
    if (input) b.hidden = !input.value;
  });
}
document.addEventListener("DOMContentLoaded", () => {
  montarSeletorFinanceiroUI();
  montarCheckoutUI();
  montarContaAutoUI();
  atualizarLimparBuscaUI();
  document.addEventListener("input", atualizarLimparBuscaUI);
  document.addEventListener("click", () => requestAnimationFrame(atualizarLimparBuscaUI));
  if (typeof renderizarChamadosMesaAtendente === "function") {
    const render = renderizarChamadosMesaAtendente;
    window.renderizarChamadosMesaAtendente = (...args) => {
      const resultado = render(...args);
      const area = document.getElementById("area-chamados-mesa-atendente");
      if (area) cabecalhoEtapaUI(area);
      return resultado;
    };
  }
  const concluidos = document.querySelector(".cozinha-body details");
  if (concluidos) document.querySelector(".cozinha-body>header").append(concluidos);
});
if (typeof module !== "undefined") module.exports = { semanasDoMesUI, buscarContaPorCodigoAutoUI };
