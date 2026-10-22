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
function desativarPagamentoMistoUI(id) {
  const area = document.getElementById(id);
  if (!area) return;
  delete area.dataset.ativo;
  const resumo = area.parentElement.querySelector(".pagamento-misto-resumo-ui");
  if (resumo) resumo.remove();
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
  const botao = area.previousElementSibling;
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
}
function organizarFechamentoUI() {
  const area = document.getElementById("area-fechamento-comanda");
  if (!area) return;
  area.classList.add("pagamento-compacto-ui");
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
