/* Janelas secundárias e feedback das ações assíncronas. Carregar após os fluxos da página. */
"use strict";
function atualizarResumoAdicionaisProdutoUI(id) {
  const botao = document.querySelector(
    id === "lista-adicionais"
      ? "#btn-toggle-adicionais"
      : id === "lista-adicionais-auto"
        ? "#btn-toggle-adicionais-auto"
        : ".acrescimos-opcoes-atendente button",
  );
  if (!botao) return;
  const selecionados =
    id === "lista-adicionais"
      ? Object.values(adicionaisSelecionados)
      : id === "lista-adicionais-auto"
        ? Object.values(adicionaisAutoSelecionados)
        : obterAcrescimosSelecionados();
  const itens = selecionados.filter((a) => Number(a.qtd) > 0);
  const quantidade = itens.reduce((total, a) => total + Number(a.qtd), 0);
  botao.textContent = "Acréscimos";
  botao.classList.add("acrescimos-com-contador-ui");
  if (quantidade) {
    const contador = document.createElement("span");
    contador.className = "acrescimos-contador-ui";
    contador.textContent = quantidade;
    contador.setAttribute(
      "aria-label",
      quantidade === 1 ? "1 acréscimo selecionado" : quantidade + " acréscimos selecionados",
    );
    botao.append(contador);
  }
  let resumo = botao.parentElement.querySelector(".adicionais-selecionados-ui");
  if (!resumo) {
    resumo = document.createElement("div");
    resumo.className = "adicionais-selecionados-ui";
    resumo.setAttribute("aria-live", "polite");
    botao.after(resumo);
  }
  resumo.replaceChildren();
  resumo.hidden = !quantidade;
  itens.forEach((a) => {
    const linha = document.createElement("div");
    linha.textContent = "+ " + Number(a.qtd) + " " + a.nome;
    resumo.append(linha);
  });
}
function abrirAcrescimosJanelaUI(id) {
  const conteudo = document.getElementById(id);
  if (!conteudo) return;
  const quantidadePrincipal = document.getElementById("quantidade-produto-config");
  const quantidadeAnterior = quantidadePrincipal?.textContent;
  conteudo.style.display = "none";
  const campos = [...conteudo.querySelectorAll('[id^="qtd-"]')].map((el) => [el, el.textContent]);
  const selecionados =
    id === "lista-adicionais"
      ? structuredClone(adicionaisSelecionados)
      : id === "lista-adicionais-auto"
        ? structuredClone(adicionaisAutoSelecionados)
        : null;
  const janela = abrirJanelaElementoUI(conteudo, "Acréscimos");
  if (!conteudo.querySelector("[data-limpar-acrescimos]")) {
    const limpar = document.createElement("button");
    limpar.dataset.limparAcrescimos = "sim";
    limpar.textContent = "Limpar";
    limpar.onclick = () => {
      conteudo.querySelectorAll('[id^="qtd-"]').forEach((el) => (el.textContent = "0"));
      if (id === "lista-adicionais")
        Object.values(adicionaisSelecionados).forEach((a) => (a.qtd = 0));
      else if (id === "lista-adicionais-auto")
        Object.values(adicionaisAutoSelecionados).forEach((a) => (a.qtd = 0));
      else atualizarPrecoProduto();
    };
    conteudo.append(limpar);
  }
  configurarRascunhoAcrescimosUI(
    janela,
    () => {
      if (id === "lista-adicionais") limitarQuantidadeProdutoComAdicionais();
    },
    () => {
      campos.forEach(([el, valor]) => (el.textContent = valor));
      if (id === "lista-adicionais") adicionaisSelecionados = selecionados;
      if (id === "lista-adicionais-auto") adicionaisAutoSelecionados = selecionados;
      if (id === "area-acrescimos-produto") atualizarPrecoProduto();
      if (quantidadePrincipal && quantidadeAnterior != null)
        quantidadePrincipal.textContent = quantidadeAnterior;
    },
  );
  janela.addEventListener("close", () => atualizarResumoAdicionaisProdutoUI(id), { once: true });
}
function resumoAcrescimosHtmlUI(configs) {
  return configs
    .map((c, n) => {
      const extras = (c?.adicionais || [])
        .filter((a) => Number(a.qtd) > 0)
        .map((a) => `+ ${Number(a.qtd)} ${escaparOperacao(a.nome)}`);
      if (c?.observacao) extras.push(`Obs.: ${escaparOperacao(c.observacao)}`);
      return extras.length
        ? `<div><strong>${c.todos ? "Todos os lanches" : "Lanche " + (c.numero || n + 1)}</strong><br>${extras.join("<br>")}</div>`
        : "";
    })
    .join("");
}
function abrirEscolhaAcrescimosComboUI(contexto) {
  const area = document.createElement("div");
  area.innerHTML =
    '<p>Aplicar os mesmos acréscimos em todos ou escolher para cada lanche?</p><div class="cliente-acoes-ui"><button type="button">Todos</button><button type="button">Individual</button></div>';
  document.body.append(area);
  const janela = abrirJanelaElementoUI(area, "Acréscimos");
  area.querySelectorAll("button").forEach(
    (b, n) =>
      (b.onclick = () => {
        janela.close("aplicar");
        if (contexto === "site") escolherModoComboSiteUI(n ? "individual" : "todos");
        else if (contexto === "auto") selecionarModoComboAuto(n ? "individual" : "todos");
        else selecionarModoCombo(n ? "individual" : "todos");
      }),
  );
  janela.addEventListener("close", () => area.remove(), { once: true });
}
function montarBotaoAcrescimosComboUI(area, contexto) {
  if (!area || area.querySelector(".combo-abrir-ui")) return;
  [...area.children].forEach((el) => {
    if (el.matches("h3,p,button")) el.hidden = true;
    if (el.matches(".combo-modo-auto")) el.hidden = true;
    if (el.matches("hr")) el.remove();
  });
  const box = document.createElement("div");
  box.className = "combo-entrada-ui";
  box.innerHTML = `<button type="button" class="combo-abrir-ui" onclick="abrirEscolhaAcrescimosComboUI('${contexto}')">Acréscimos</button><div class="combo-selecao-ui"></div>`;
  area.prepend(box);
}
function atualizarObservacaoComboUI(auto = false) {
  const configs = auto
    ? modoPersonalizacaoComboAuto === "todos"
      ? [{ ...configuracaoTodosComboAuto, todos: true }]
      : Object.entries(configuracoesLanchesComboAuto).map(([n, c]) => ({ ...c, numero: Number(n) }))
    : configuracaoTodosCombo
      ? [{ ...configuracaoTodosCombo, todos: true }]
      : Object.entries(configuracoesLanchesCombo).map(([n, c]) => ({ ...c, numero: Number(n) }));
  const tem = configs.some((c) => c?.adicionais?.some((a) => Number(a.qtd) > 0));
  const resumo = document.querySelector(
    auto
      ? "#personalizacao-combo-auto .combo-selecao-ui"
      : "#combo-entrada-atendente .combo-selecao-ui",
  );
  if (resumo) resumo.innerHTML = resumoAcrescimosHtmlUI(configs);
  const campo = document.getElementById(
    auto ? "observacao-combo-auto" : "observacao-produto-config",
  );
  if (!campo) return;
  campo.hidden = tem;
  const titulo = campo.previousElementSibling;
  if (titulo?.matches("h3")) titulo.hidden = tem;
  if (tem) campo.value = "";
}
function organizarProdutoPainelUI() {
  const campo = document.getElementById("observacao-produto-config");
  if (!campo || campo.closest(".produto-bloco-ui")) return;
  const titulo = campo.previousElementSibling;
  const caixa = document.createElement("div");
  caixa.className = "produto-bloco-ui";
  campo.before(caixa);
  if (titulo?.matches("h3")) caixa.append(titulo);
  caixa.append(campo);
  const painel = campo.closest(
    "#area-comanda-atendente, #area-entrega-atendente, #area-retirada-atendente",
  );
  if (painel) {
    painel.classList.add("produto-painel-compacto-ui");
    painel.querySelectorAll(":scope > hr, :scope > br").forEach((el) => el.remove());
    if (painel.querySelector("#config-individual-combo")) {
      const seletor = document.createElement("div");
      seletor.id = "combo-entrada-atendente";
      caixa.before(seletor);
      painel.querySelectorAll(":scope > h3, :scope > p, :scope > button").forEach((el) => {
        if (el.matches("h3") && el.textContent.trim() !== "Acréscimos") return;
        if (el.matches("button") && !el.getAttribute("onclick")?.includes("selecionarModoCombo"))
          return;
        el.hidden = true;
      });
      montarBotaoAcrescimosComboUI(seletor, "atendente");
    }
  }
  const botao = document.querySelector('[onclick*="alterarQuantidadeProduto(-1)"]');
  if (botao) {
    const grupo = document.createElement("div");
    grupo.className = "produto-bloco-ui quantidade-painel-ui";
    const tituloQtd = botao.previousElementSibling;
    botao.before(grupo);
    if (tituloQtd?.matches("h3")) grupo.append(tituloQtd);
    let atual = botao;
    while (atual && !atual.matches("hr, h3")) {
      const proximo = atual.nextElementSibling;
      grupo.append(atual);
      atual = proximo;
      if (grupo.querySelectorAll("button").length === 2) break;
    }
  }
}
document.addEventListener("DOMContentLoaded", () => {
  if (typeof montarPersonalizacaoComboAuto === "function") {
    const montar = montarPersonalizacaoComboAuto;
    window.montarPersonalizacaoComboAuto = () => {
      montar();
      montarBotaoAcrescimosComboUI(document.getElementById("personalizacao-combo-auto"), "auto");
    };
  }
  if (typeof abrirPainelProduto === "function") {
    const abrir = abrirPainelProduto;
    window.abrirPainelProduto = async (...args) => {
      await abrir(...args);
      organizarProdutoPainelUI();
    };
  }
  for (const [nome, id] of [
    ["toggleAdicionaisProduto", "lista-adicionais"],
    ["toggleAdicionaisAutoatendimento", "lista-adicionais-auto"],
    ["mostrarAcrescimosProduto", "area-acrescimos-produto"],
  ]) {
    if (typeof window[nome] !== "function") continue;
    window[nome] = () => abrirAcrescimosJanelaUI(id);
  }
  const main = document.querySelector(".admin-body main");
  if (main && !document.getElementById("financeiro-login")) {
    const atalhos = document.createElement("div");
    atalhos.className = "admin-atalhos";
    const botoes = [...main.querySelectorAll("button")].filter((b) =>
      /^(Pedidos e produção|Abrir \/ Fechar Loja|🔒 Administração Avançada)$/.test(
        b.textContent.trim(),
      ),
    );
    atalhos.append(...botoes);
    botoes.forEach((b) => {
      if (b.textContent.includes("Abrir / Fechar")) b.textContent = "Loja";
      if (b.textContent.includes("Administração Avançada")) b.textContent = "ADM avançado";
    });
    main.prepend(atalhos);
  }
  if (typeof buscarClienteAdmin === "function") {
    const buscar = buscarClienteAdmin;
    window.buscarClienteAdmin = async (...args) => {
      if (document.getElementById("admin-busca-cliente").value.trim()) {
        const box = document.getElementById("resultado-cliente-admin");
        if (!box.parentElement.matches("dialog.interface-janela")) box.style.display = "none";
        abrirJanelaElementoUI(box, "Cliente e fidelidade");
        box.innerHTML = htmlCarregandoUI("Buscando cliente…");
      }
      const resultado = await buscar(...args);
      const box = document.getElementById("resultado-cliente-admin");
      const card = box.querySelector(".card-admin-cliente");
      if (card) {
        const acoes = document.createElement("div");
        acoes.className = "cliente-acoes-ui";
        acoes.append(...card.querySelectorAll(":scope > button"));
        card.append(acoes);
      }
      return resultado;
    };
  }
  if (typeof selecionarModoCombo === "function") {
    const selecionar = selecionarModoCombo;
    window.selecionarModoCombo = async (modo) => {
      await selecionar(modo);
      if (modoPersonalizacaoCombo !== modo) return;
      const id = modo === "todos" ? "config-todos-combo" : "config-individual-combo";
      const conteudo = document.getElementById(id);
      if (conteudo) {
        conteudo.style.display = "none";
        abrirJanelaElementoUI(
          conteudo,
          modo === "todos" ? "Todos os lanches" : "Lanches individuais",
        );
      }
    };
    for (const [nome, id, titulo] of [
      [
        "abrirConfiguracaoTodosCombo",
        () => "modal-config-todos-combo",
        () => "Acréscimos em todos",
      ],
      [
        "abrirConfiguracaoLancheCombo",
        (n) => `modal-config-lanche-combo-${n}`,
        (n) => `Acréscimos · Lanche ${n}`,
      ],
    ]) {
      const abrir = window[nome];
      window[nome] = async (...args) => {
        const conteudo = document.getElementById(id(...args));
        if (!conteudo) return;
        const janela = abrirJanelaElementoUI(conteudo, titulo(...args));
        janela.addEventListener(
          "close",
          () => {
            conteudo.innerHTML = "";
          },
          { once: true },
        );
        await abrir(...args);
        conteudo.querySelector('[onclick*="fecharConfiguracao"]')?.remove();
        const salvar =
          nome === "abrirConfiguracaoTodosCombo"
            ? salvarConfiguracaoTodosCombo
            : () => salvarConfiguracaoLancheCombo(args[0]);
        conteudo.querySelector('[onclick*="salvarConfiguracao"]')?.remove();
        const limpar = document.createElement("button");
        limpar.textContent = "Limpar";
        limpar.onclick = () => {
          conteudo.querySelectorAll('[id^="qtd-"]').forEach((el) => (el.textContent = "0"));
          conteudo.querySelectorAll("textarea").forEach((el) => (el.value = ""));
        };
        conteudo.append(limpar);
        configurarRascunhoAcrescimosUI(janela, salvar);
      };
    }
    for (const [nome, id] of [
      ["fecharConfiguracaoTodosCombo", () => "modal-config-todos-combo"],
      ["fecharConfiguracaoLancheCombo", (n) => `modal-config-lanche-combo-${n}`],
    ]) {
      const fechar = window[nome];
      window[nome] = (...args) => {
        const pai = document.getElementById(id(...args))?.parentElement;
        const janela = pai?.matches("dialog.interface-janela") ? pai : null;
        fechar(...args);
        janela?.close();
      };
    }
  }
  if (typeof selecionarModoComboAuto === "function") {
    const selecionar = selecionarModoComboAuto;
    window.selecionarModoComboAuto = async (modo) => {
      if (
        modoPersonalizacaoComboAuto !== modo &&
        (configuracaoTodosComboAuto || Object.keys(configuracoesLanchesComboAuto).length)
      ) {
        if (
          !(await confirmarOperacao(
            "Ao mudar entre Todos e Individual, sua personalização anterior será apagada. Continuar?",
          ))
        )
          return;
        configuracaoTodosComboAuto = null;
        configuracoesLanchesComboAuto = {};
        atualizarResumoTodosComboAuto();
        for (let n = 1; n <= Number(comboAutoAtual?.comboQtdLanches || 0); n++)
          atualizarStatusLancheComboAuto(n);
      }
      selecionar(modo, false);
      const conteudo = document.getElementById(
        modo === "todos" ? "modo-todos-combo-auto" : "modo-individual-combo-auto",
      );
      if (conteudo?.style.display === "block") {
        conteudo.style.display = "none";
        abrirJanelaElementoUI(
          conteudo,
          modo === "todos" ? "Todos os lanches" : "Lanches individuais",
        );
      }
    };
  }
  // O autoatendimento mantém a seleção imediata, mas abre os acréscimos em janela.
  for (const [abrirNome, fecharNome, id, titulo] of [
    [
      "abrirConfiguracaoTodosComboAuto",
      "fecharConfiguracaoTodosComboAuto",
      () => "config-todos-combo-auto",
      () => "Todos os lanches",
    ],
    [
      "abrirConfiguracaoLancheComboAuto",
      "fecharConfiguracaoLancheComboAuto",
      (n) => `config-lanche-combo-auto-${n}`,
      (n) => `Lanche ${n}`,
    ],
  ]) {
    const abrir = window[abrirNome];
    const fechar = window[fecharNome];
    if (typeof abrir !== "function") continue;
    window[abrirNome] = (...args) => {
      const conteudo = document.getElementById(id(...args));
      if (!conteudo) return;
      const anteriorTodos = structuredClone(configuracaoTodosComboAuto);
      const anteriorIndividual = structuredClone(configuracoesLanchesComboAuto);
      const quantidadeAnterior = quantidadeComboAuto;
      if (conteudo.parentElement.matches("dialog.interface-janela")) {
        // Atualiza o conteúdo sem acionar o antigo comportamento de recolher.
        conteudo.style.display = "none";
        abrir(...args);
        conteudo.querySelector(".btn-fechar-modal-auto")?.remove();
        conteudo.querySelector(":scope > h3")?.remove();
        return;
      }
      abrir(...args);
      conteudo.style.display = "none";
      const janela = abrirJanelaElementoUI(conteudo, titulo(...args));
      conteudo.querySelector(".btn-fechar-modal-auto")?.remove();
      conteudo.querySelector(":scope > h3")?.remove();
      janela.classList.add("janela-combo-auto");
      const limpar = document.createElement("button");
      limpar.textContent = "Limpar";
      limpar.onclick = () => {
        conteudo.querySelectorAll('[id^="qtd-"]').forEach((el) => (el.textContent = "0"));
        conteudo.querySelectorAll("textarea").forEach((el) => (el.value = ""));
        if (args.length) sincronizarConfiguracaoLancheComboAuto(args[0]);
        else sincronizarConfiguracaoTodosComboAuto();
      };
      conteudo.append(limpar);
      configurarRascunhoAcrescimosUI(janela, null, () => {
        configuracaoTodosComboAuto = anteriorTodos;
        configuracoesLanchesComboAuto = anteriorIndividual;
        quantidadeComboAuto = quantidadeAnterior;
        const quantidade = document.getElementById("qtd-combo-auto");
        if (quantidade) quantidade.textContent = quantidadeAnterior;
        atualizarResumoTodosComboAuto();
        for (let n = 1; n <= Number(comboAutoAtual?.comboQtdLanches || 0); n++)
          atualizarStatusLancheComboAuto(n);
        atualizarPrecoComboAuto();
      });
      janela.addEventListener(
        "close",
        () => {
          conteudo.innerHTML = "";
        },
        { once: true },
      );
    };
    window[fecharNome] = (...args) => {
      const pai = document.getElementById(id(...args))?.parentElement;
      const janela = pai?.matches("dialog.interface-janela") ? pai : null;
      fechar(...args);
      janela?.close();
    };
  }
  // O indicador pertence ao clique, e não bloqueia a tela ou as ações Voltar/X.
  let botaoDoClique = null;
  document.addEventListener(
    "click",
    (evento) => {
      botaoDoClique = evento.target.closest?.("button");
      queueMicrotask(() => {
        botaoDoClique = null;
      });
    },
    true,
  );
  for (const nome of Object.keys(window)) {
    const descriptor = Object.getOwnPropertyDescriptor(window, nome);
    const original = descriptor?.value;
    if (typeof original !== "function" || original.constructor.name !== "AsyncFunction") continue;
    window[nome] = function (...args) {
      const botao = botaoDoClique;
      if (!botao || botao.dataset.aguardando === "sim") return original.apply(this, args);
      botao.dataset.aguardando = "sim";
      botao.setAttribute("aria-busy", "true");
      const desabilitado = botao.disabled;
      botao.disabled = true;
      return original
        .apply(this, args)
        .catch((erro) => {
          mostrarAvisoUI(
            erro.message || "Não foi possível concluir. Confira sua conexão e tente novamente.",
          );
        })
        .finally(() => {
          delete botao.dataset.aguardando;
          botao.removeAttribute("aria-busy");
          botao.disabled = desabilitado;
        });
    };
  }
});
