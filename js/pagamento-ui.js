/* Janelas secundárias do fechamento da comanda; conserva campos e valores. */
function htmlResumoPagamentoMistoUI(informado, restante) {
  return `<div class="pagamento-informado-ui">Total informado <strong>${moedaOperacao(informado)}</strong></div><div class="pagamento-restante-ui${restante <= 0 ? " quitado" : ""}"><span>Restante a pagar</span><strong>${moedaOperacao(Math.max(0, restante))}</strong></div>`;
}
function organizarCamposPagamentoMistoUI(area) {
  if (area.querySelector(".pagamento-misto-campos-ui")) return;
  const campos = [...area.querySelectorAll("input")];
  const resumo = area.querySelector('[id^="resumo-"]');
  const grade = document.createElement("div");
  grade.className = "pagamento-misto-campos-ui";
  ["Dinheiro", "Pix", "Débito", "Crédito"].forEach((nome, n) => {
    const linha = document.createElement("label");
    linha.className = "pagamento-misto-campo-ui";
    const titulo = document.createElement("span");
    titulo.textContent = nome;
    const valor = document.createElement("span");
    valor.className = "pagamento-misto-valor-ui";
    valor.append("R$ ", campos[n]);
    linha.append(titulo, valor);
    grade.append(linha);
  });
  area.replaceChildren(grade, resumo);
  area.classList.add("pagamento-misto-conteudo-ui");
  resumo.setAttribute("aria-live", "polite");
  campos.forEach((campo) => {
    campo.inputMode = "decimal";
    campo.addEventListener?.("focus", () => {
      if (Number(campo.value) === 0) campo.value = "";
    });
    campo.addEventListener?.("blur", () => {
      if (!campo.value.trim()) {
        campo.value = "0";
        campo.oninput?.();
      }
    });
  });
  campos[0].oninput?.();
}
function alternarCuponsPagamentoUI() {
  const area = document.getElementById("cupons-disponiveis-pagamento-ui");
  if (!area) return;
  const aberta = area.parentElement.matches("dialog.interface-janela") ? area.parentElement : null;
  if (aberta) {
    aberta.close();
    return;
  }
  const botao = area.previousElementSibling;
  botao?.setAttribute("aria-expanded", "true");
  area.style.display = "none";
  const janela = abrirJanelaElementoUI(area, "Cupons disponíveis");
  janela.classList.add("pagamento-secundario-ui");
  janela.addEventListener("close", () => botao?.setAttribute("aria-expanded", "false"), {
    once: true,
  });
}
function abrirPagamentosRealizadosJanelaUI() {
  const area = document.getElementById("pagamentos-realizados");
  if (!area) return;
  const aberta = area.parentElement?.matches("dialog.interface-janela") ? area.parentElement : null;
  if (aberta) {
    aberta.close();
    return;
  }
  area.style.display = "none";
  if (!area.textContent.trim()) area.textContent = "Nenhum pagamento registrado nesta comanda.";
  const janela = abrirJanelaElementoUI(area, "Pagamentos realizados");
  janela.classList.add("pagamento-secundario-ui");
}
function desativarPagamentoMistoUI(id) {
  const area = document.getElementById(id);
  if (!area) return;
  delete area.dataset.ativo;
  const resumo = botaoPagamentoMistoUI(area, id)?.parentElement.querySelector(
    ".pagamento-misto-resumo-ui",
  );
  if (resumo) resumo.remove();
}
function botaoPagamentoMistoUI(area, id) {
  return document.querySelector?.(`[data-misto-alvo="${id}"]`) || area.previousElementSibling;
}
function abrirPagamentoMistoJanelaUI(id) {
  const area = document.getElementById(id);
  if (!area) return;
  const aberta = area.parentElement.matches("dialog.interface-janela") ? area.parentElement : null;
  if (aberta) {
    aberta.close();
    return;
  }
  const anteriores = [...area.querySelectorAll("input")].map((el) => [el, el.value]);
  const botao = botaoPagamentoMistoUI(area, id);
  organizarCamposPagamentoMistoUI(area);
  area.style.display = "none";
  const janela = abrirJanelaElementoUI(area, "Dividir entre formas de pagamento");
  janela.classList.add("pagamento-secundario-ui");
  configurarRascunhoAcrescimosUI(
    janela,
    () => {
      if (![...area.querySelectorAll("input")].some((el) => Number(el.value) > 0)) {
        desativarPagamentoMistoUI(id);
        return;
      }
      const nome =
        id === "area-pagamento-misto" ? "forma-pagamento-unica" : "forma-pagamento-separado";
      document.querySelectorAll('input[name="' + nome + '"]').forEach((el) => (el.checked = false));
      area.dataset.ativo = "sim";
      let resumo = botao.parentElement.querySelector(".pagamento-misto-resumo-ui");
      if (!resumo) {
        resumo = document.createElement("p");
        resumo.className = "pagamento-misto-resumo-ui";
        botao.after(resumo);
      }
      const formas = ["Dinheiro", "Pix", "Débito", "Crédito"];
      resumo.textContent = [...area.querySelectorAll("input")]
        .map((el, n) => (Number(el.value) > 0 ? formas[n] + ": " + moedaOperacao(el.value) : ""))
        .filter(Boolean)
        .join(" · ");
    },
    () => {
      anteriores.forEach(([el, valor]) => (el.value = valor));
      anteriores[0]?.[0].oninput?.();
    },
  );
  const confirmar = document.createElement("button");
  confirmar.type = "button";
  confirmar.className = "pagamento-confirmar-misto-ui";
  confirmar.textContent = "Confirmar divisão";
  confirmar.onclick = () => {
    const campos = [...area.querySelectorAll("input")];
    const informado = campos.reduce((s, c) => s + centavosOperacao(c.value), 0);
    const esperado = Number(area.querySelector('[id^="resumo-"]')?.dataset.total);
    if (
      campos.some((c) => !Number.isFinite(Number(c.value)) || Number(c.value) < 0) ||
      !Number.isFinite(esperado) ||
      informado !== centavosOperacao(esperado)
    ) {
      mostrarAvisoUI(
        "A divisão deve somar exatamente " + moedaOperacao(esperado) + ". Confira os valores.",
      );
      return;
    }
    janela.querySelector(".ui-voltar").onclick();
  };
  janela.append(confirmar);
}
function organizarFechamentoUI() {
  const area = document.getElementById("area-fechamento-comanda");
  if (!area) return;
  area.classList.add("pagamento-compacto-ui");
  const modos = area.querySelector(".pagamento-separado-modos");
  const realizados = area.querySelector('button[onclick*="alternarPagamentosRealizados"]');
  if (modos && realizados && !modos.contains(realizados)) {
    while (realizados.previousElementSibling?.tagName === "BR")
      realizados.previousElementSibling.remove();
    realizados.textContent = realizados.textContent
      .replace("✅", "")
      .replace("pagamento(s) realizado(s)", "pagamentos realizados")
      .replace("▸", "")
      .trim();
    modos.append(realizados);
    const historico = area.querySelector("#pagamentos-realizados");
    if (historico) modos.after(historico);
  }
  const misto = area.querySelector('button[onclick*="alternarPagamentoMisto"]');
  if (misto && !misto.closest(".pagamento-titulo-forma-ui")) {
    const titulo = [...area.querySelectorAll("h4")].find(
      (h) => h.textContent.trim() === "Forma de pagamento",
    );
    if (titulo) {
      while (misto.previousElementSibling?.tagName === "BR") misto.previousElementSibling.remove();
      const linha = document.createElement("div");
      linha.className = "pagamento-titulo-forma-ui";
      titulo.before(linha);
      misto.dataset.mistoAlvo = area.querySelector("#area-pagamento-misto")
        ? "area-pagamento-misto"
        : "area-pagamento-misto-separado";
      misto.textContent = "Usar mais de uma forma";
      linha.append(titulo, misto);
    }
  }
  const campo = area.querySelector("#busca-cliente-separado");
  if (campo && !campo.closest(".pagamento-busca-linha-ui")) {
    const box = campo.parentElement;
    const buscar = box.querySelector("button");
    const linha = document.createElement("div");
    linha.className = "pagamento-busca-linha-ui";
    campo.before(linha);
    linha.append(campo);
    if (buscar) linha.append(buscar);
    box.querySelectorAll(":scope > br,:scope > hr").forEach((el) => el.remove());
  }
  area.querySelectorAll('[id^="qtd-pagamento-item-"]').forEach((span) => {
    if (span.closest(".pagamento-quantidade-ui")) return;
    const menos = span.previousElementSibling,
      mais = span.nextElementSibling;
    const linha = document.createElement("div");
    linha.className = "pagamento-quantidade-ui";
    menos.before(linha);
    linha.append(menos, span, mais);
    const card = linha.parentElement;
    card.classList.add("pagamento-item-ui");
    card.querySelectorAll(":scope > br").forEach((el) => el.remove());
  });
}
document.addEventListener("DOMContentLoaded", () => {
  if (typeof alternarPagamentosRealizados === "function")
    window.alternarPagamentosRealizados = abrirPagamentosRealizadosJanelaUI;
  if (typeof alternarPagamentoMisto === "function")
    window.alternarPagamentoMisto = () => abrirPagamentoMistoJanelaUI("area-pagamento-misto");
  if (typeof alternarPagamentoMistoSeparado === "function")
    window.alternarPagamentoMistoSeparado = () =>
      abrirPagamentoMistoJanelaUI("area-pagamento-misto-separado");
  for (const nome of [
    "abrirPagamentoTudoJunto",
    "abrirPagamentoSeparado",
    "abrirPagamentoSeparadoPorValor",
    "abrirIdentificacaoPagamentoSeparado",
    "abrirBeneficiosPagamentoSeparado",
    "abrirFormaPagamentoSeparado",
    "buscarClientePagamentoSeparado",
    "selecionarCupomPagamentoAtendente",
    "selecionarCupomPagamentoSeparado",
    "removerCupomPagamentoAtendente",
  ]) {
    const original = window[nome];
    if (typeof original !== "function") continue;
    window[nome] = async function (...args) {
      document.querySelectorAll("dialog.pagamento-secundario-ui").forEach((j) => j.close());
      const retorno = await original.apply(this, args);
      organizarFechamentoUI();
      return retorno;
    };
  }
});
