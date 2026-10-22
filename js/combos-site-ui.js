/* Personalização do combo no cardápio público, usando as mesmas janelas e cartões. */
let comboSiteUI = { modo: "todos", lanches: [] };
function temAdicionaisComboSiteUI() {
  return comboSiteUI.lanches.some((c) => Object.values(c.adicionais).some((a) => a.qtd > 0));
}
function extrasComboSiteUI() {
  return comboSiteUI.lanches.reduce(
    (total, c) =>
      total + Object.values(c.adicionais).reduce((s, a) => s + Number(a.preco) * a.qtd, 0),
    0,
  );
}
function atualizarComboSiteUI() {
  const obs = document.getElementById("obs-produto");
  const tem =
    extrasComboSiteUI() > 0 ||
    comboSiteUI.lanches.some((c) => Object.values(c.adicionais).some((a) => a.qtd > 0));
  obs.hidden = tem;
  if (tem) obs.value = "";
  document.querySelectorAll("[data-site-resumo]").forEach((el) => {
    const n = Number(el.dataset.siteResumo);
    const configs = n === -2 ? comboSiteUI.lanches : [comboSiteUI.lanches[n < 0 ? 0 : n]];
    el.innerHTML = configs
      .map((c, i) => {
        const linhas = Object.values(c.adicionais)
          .filter((a) => a.qtd > 0)
          .map((a) => "+ " + a.qtd + " " + escaparOperacao(a.nome));
        if (c.observacao) linhas.push("Obs.: " + escaparOperacao(c.observacao));
        return linhas.length
          ? "<div>" +
              (n === -2 ? "<strong>Lanche " + (i + 1) + "</strong><br>" : "") +
              linhas.join("<br>") +
              "</div>"
          : "";
      })
      .join("");
    if (!el.innerHTML && n >= -1) el.textContent = "Padrão";
  });
}
function configurarVoltaTipoComboSiteUI(janela) {
  janela.querySelector(".ui-voltar").onclick = () => {
    janela.close("aplicar");
    abrirEscolhaAcrescimosComboUI("site");
  };
}
async function escolherModoComboSiteUI(modo) {
  if (
    modo !== comboSiteUI.modo &&
    comboSiteUI.lanches.some(
      (c) => Object.values(c.adicionais).some((a) => a.qtd > 0) || c.observacao,
    )
  ) {
    if (
      !(await confirmarOperacao(
        "Ao mudar entre Todos e Individual, sua personalização anterior será apagada. Continuar?",
      ))
    )
      return;
    comboSiteUI.lanches.forEach((c) => {
      c.adicionais = {};
      c.observacao = "";
    });
    atualizarComboSiteUI();
  }
  comboSiteUI.modo = modo;
  if (modo === "todos") {
    const area = document.createElement("div");
    area.innerHTML =
      '<p>Os acréscimos e a observação serão aplicados em cada lanche.</p><div data-site-resumo="-1"></div><div class="cliente-acoes-ui"><button onclick="abrirExtrasComboSiteUI(-1)">Escolher</button><button onclick="limparExtrasComboSiteUI(-1)">Limpar</button></div>';
    document.body.append(area);
    const janela = abrirJanelaElementoUI(area, "Todos os lanches");
    configurarVoltaTipoComboSiteUI(janela);
    janela.addEventListener("close", () => area.remove(), { once: true });
    atualizarComboSiteUI();
  } else {
    const area = document.createElement("div");
    area.innerHTML = comboSiteUI.lanches
      .map(
        (c, n) =>
          `<section class="produto-bloco-ui"><strong>Lanche ${n + 1}</strong><div data-site-resumo="${n}"></div><div class="cliente-acoes-ui"><button onclick="abrirExtrasComboSiteUI(${n})">Escolher</button><button onclick="limparExtrasComboSiteUI(${n})">Limpar</button></div></section>`,
      )
      .join("");
    document.body.append(area);
    const janela = abrirJanelaElementoUI(area, "Lanches individuais");
    configurarVoltaTipoComboSiteUI(janela);
    atualizarComboSiteUI();
    janela.addEventListener("close", () => area.remove(), { once: true });
  }
}
function limparExtrasComboSiteUI(n) {
  const alvos = n < 0 ? comboSiteUI.lanches : [comboSiteUI.lanches[n]];
  alvos.forEach((c) => {
    c.adicionais = {};
    c.observacao = "";
  });
  atualizarComboSiteUI();
}
function abrirExtrasComboSiteUI(n) {
  const anterior = structuredClone(comboSiteUI);
  const area = document.createElement("div");
  const config = comboSiteUI.lanches[n < 0 ? 0 : n];
  const permitidos = adicionais.filter(
    (a) =>
      produtoAtual.permiteAdicionais !== false &&
      (produtoAtual.modoAdicional !== "selecionar" ||
        produtoAtual.adicionaisPermitidos?.includes(a.id)),
  );
  const descricao = document.createElement("p");
  descricao.textContent =
    n < 0
      ? "Os acréscimos e a observação serão aplicados em cada lanche."
      : `Escolha os acréscimos e a observação do lanche ${n + 1}.`;
  area.append(descricao);
  permitidos.forEach((a) => {
    const row = document.createElement("div");
    row.className = "adicional-combo-auto";
    row.innerHTML =
      '<div class="info-adicional-combo-auto"><strong></strong><span></span></div><div class="controle-adicional-combo-auto"><button type="button">−</button><span></span><button type="button">+</button></div>';
    row.querySelector("strong").textContent = a.nome;
    row.querySelector(".info-adicional-combo-auto span").textContent = moedaOperacao(a.preco);
    const qtd = row.querySelector(".controle-adicional-combo-auto span");
    qtd.textContent = config.adicionais[a.id]?.qtd || 0;
    row.querySelectorAll("button").forEach(
      (b, i) =>
        (b.onclick = () => {
          const quantidade = Math.max(0, Number(qtd.textContent) + (i ? 1 : -1));
          qtd.textContent = quantidade;
          const alvos = n < 0 ? comboSiteUI.lanches : [config];
          alvos.forEach(
            (c) =>
              (c.adicionais[a.id] = {
                id: a.id,
                nome: a.nome,
                preco: Number(a.preco || 0),
                qtd: quantidade,
              }),
          );
          atualizarComboSiteUI();
        }),
    );
    area.append(row);
  });
  const label = document.createElement("label");
  label.className = "combo-observacao-ui";
  label.textContent = "Observação";
  const obs = document.createElement("textarea");
  obs.value = config.observacao;
  obs.placeholder = "Ex.: sem cebola";
  obs.oninput = () => {
    (n < 0 ? comboSiteUI.lanches : [config]).forEach((c) => (c.observacao = obs.value));
  };
  label.append(obs);
  area.append(label);
  const limpar = document.createElement("button");
  limpar.textContent = "Limpar";
  limpar.onclick = () => {
    limparExtrasComboSiteUI(n);
    area
      .querySelectorAll(".controle-adicional-combo-auto span")
      .forEach((s) => (s.textContent = "0"));
    obs.value = "";
  };
  area.append(limpar);
  document.body.append(area);
  const janela = abrirJanelaElementoUI(area, n < 0 ? "Todos os lanches" : `Lanche ${n + 1}`);
  configurarRascunhoAcrescimosUI(
    janela,
    () => {
      atualizarComboSiteUI();
      limitarQuantidadeProdutoComAdicionais();
    },
    () => {
      comboSiteUI = anterior;
      atualizarComboSiteUI();
    },
  );
  janela.addEventListener("close", () => area.remove(), { once: true });
}
document.addEventListener("DOMContentLoaded", () => {
  const abrir = abrirProduto;
  window.abrirProduto = (item, categoria) => {
    abrir(item, categoria);
    if (String(categoria || "").toLowerCase() !== "combos") return;
    comboSiteUI = {
      modo: "todos",
      lanches: Array.from({ length: Math.max(1, Number(item.comboQtdLanches || 1)) }, () => ({
        adicionais: {},
        observacao: "",
      })),
    };
    const box = document.getElementById("box-adicionais-produto");
    box.style.display = "block";
    let opcoes = document.getElementById("combo-site-opcoes-ui");
    if (!opcoes) {
      opcoes = document.createElement("div");
      opcoes.id = "combo-site-opcoes-ui";
      box.after(opcoes);
    }
    box.style.display = "none";
    opcoes.hidden = false;
    opcoes.innerHTML =
      '<button class="combo-abrir-ui" onclick="abrirEscolhaAcrescimosComboUI(\'site\')">Acréscimos</button><div class="combo-selecao-ui" data-site-resumo="-2"></div>';
    document.getElementById("obs-produto").hidden = false;
  };
  const adicionar = adicionarProdutoFinal;
  window.adicionarProdutoFinal = () => {
    if (String(categoriaProdutoAtual).toLowerCase() !== "combos") return adicionar();
    const extras = extrasComboSiteUI();
    if (limitarQuantidadeProdutoComAdicionais()) return;
    const tamanho = carrinho.length;
    adicionar();
    if (carrinho.length <= tamanho) return;
    const item = carrinho[carrinho.length - 1];
    item.lanchesCombo = comboSiteUI.lanches.map((c, n) => ({
      numero: n + 1,
      adicionais: Object.values(c.adicionais).filter((a) => a.qtd > 0),
      observacao: c.observacao.trim(),
    }));
    item.preco = Number(item.precoBase) + extras;
    atualizarCarrinho();
  };
  const abrirComCombo = window.abrirProduto;
  window.abrirProduto = (...args) => {
    const opcoes = document.getElementById("combo-site-opcoes-ui");
    if (opcoes) opcoes.hidden = true;
    document.getElementById("obs-produto").hidden = false;
    abrirComCombo(...args);
    const tipos = document.getElementById("modal-opcoes-tipo");
    if (tipos) tipos.hidden = !tipos.querySelector("input");
  };
});

function resumoComboTextoSiteUI(item) {
  return (item.lanchesCombo || [])
    .map((c, n) => {
      const partes = (c.adicionais || []).map((a) => `${a.qtd} ${a.nome}`);
      if (c.observacao) partes.push(`Obs.: ${c.observacao}`);
      return partes.length ? `Lanche ${n + 1}: ${partes.join("; ")}` : "";
    })
    .filter(Boolean)
    .join("\n");
}
function resumoComboHtmlSiteUI(item) {
  const texto = resumoComboTextoSiteUI(item);
  return texto
    ? `<div class="combo-resumo-ui">${escaparOperacao(texto).replaceAll("\n", "<br>")}</div>`
    : "";
}
