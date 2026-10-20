/**
 * Busca e expansão do cardápio: exibe cinco produtos por categoria e pesquisa também os itens recolhidos.
 *
 * Organização e caminhos: consulte GUIA-DO-CODIGO.md.
 */
// A busca e o limite visual usam a mesma lista completa de produtos.
const LIMITE_PRODUTOS_CARDAPIO = 5;
const categoriasExpandidasCardapio = new Set();
const normalizarBuscaCardapio = (texto) =>
  String(texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
function calcularVisibilidadeCardapio(textos, busca, expandida = false) {
  const termo = normalizarBuscaCardapio(busca);
  return textos.map((texto, i) =>
    termo
      ? normalizarBuscaCardapio(texto).includes(termo)
      : expandida || i < LIMITE_PRODUTOS_CARDAPIO,
  );
}
function atualizarVisibilidadeCardapio(
  texto = document.getElementById("busca-produto")?.value || "",
) {
  const buscando = !!normalizarBuscaCardapio(texto);
  let encontrados = 0;
  document.querySelectorAll('#tela-inicio .grid[id^="container-"]').forEach((grid) => {
    const cards = Array.from(grid.children).filter((c) => c.classList.contains("card"));
    const expandida = categoriasExpandidasCardapio.has(grid.id);
    const visiveis = calcularVisibilidadeCardapio(
      cards.map((c) => c.textContent),
      texto,
      expandida,
    );
    cards.forEach((card, i) => {
      card.hidden = !visiveis[i];
      if (visiveis[i]) encontrados++;
    });
    const titulo = document.getElementById(grid.id.replace("container-", ""));
    if (titulo) titulo.hidden = buscando && !visiveis.some(Boolean);
    grid.hidden = buscando && !visiveis.some(Boolean);
    let botao = document.getElementById("ver-mais-" + grid.id);
    if (!botao) {
      botao = document.createElement("button");
      botao.type = "button";
      botao.id = "ver-mais-" + grid.id;
      botao.className = "btn-ver-mais-cardapio";
      botao.setAttribute("aria-controls", grid.id);
      botao.addEventListener("click", () => {
        if (categoriasExpandidasCardapio.has(grid.id)) categoriasExpandidasCardapio.delete(grid.id);
        else categoriasExpandidasCardapio.add(grid.id);
        atualizarVisibilidadeCardapio();
        if (!categoriasExpandidasCardapio.has(grid.id))
          titulo?.scrollIntoView({ block: "start", behavior: "smooth" });
      });
      grid.after(botao);
    }
    botao.hidden = buscando || cards.length <= LIMITE_PRODUTOS_CARDAPIO;
    botao.setAttribute("aria-expanded", String(expandida));
    botao.textContent = expandida
      ? "Ver menos"
      : `Ver mais (${Math.max(0, cards.length - LIMITE_PRODUTOS_CARDAPIO)})`;
  });
  const vazio = document.getElementById("busca-sem-resultados");
  if (vazio) vazio.hidden = !buscando || encontrados > 0;
}
document.addEventListener("DOMContentLoaded", () => {
  atualizarVisibilidadeCardapio();
  document.getElementById("modal-produto")?.addEventListener("keydown", (e) => {
    if (e.key === "Escape") fecharModalProduto();
    if (e.key === "Tab") {
      const controles = Array.from(
        e.currentTarget.querySelectorAll("button,input,textarea,select,a[href]"),
      ).filter((el) => !el.disabled && el.getClientRects().length > 0);
      const primeiro = controles[0],
        ultimo = controles.at(-1);
      if (e.shiftKey && document.activeElement === primeiro) {
        e.preventDefault();
        ultimo?.focus();
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault();
        primeiro?.focus();
      }
    }
  });
});
