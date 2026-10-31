/* Página estática de escolha do mapa. Não consulta o banco nem pede GPS. */
function destinosLocalizacaoUI(busca) {
  const params = new URLSearchParams(busca);
  const ponto = params.get("p") || "";
  const match = ponto.match(/^(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)$/);
  let coordenadas = "";
  if (match && Math.abs(Number(match[1])) <= 90 && Math.abs(Number(match[2])) <= 180)
    coordenadas = `${Number(match[1])},${Number(match[2])}`;
  // Um p inválido não deve virar uma busca por outro endereço silenciosamente.
  if (ponto && !coordenadas) return null;
  const endereco = (params.get("q") || "").replace(/\s+/g, " ").trim().slice(0, 500);
  if (!coordenadas && !endereco) return null;
  const waze = new URL("https://waze.com/ul");
  waze.searchParams.set(coordenadas ? "ll" : "q", coordenadas || endereco);
  waze.searchParams.set("navigate", "yes");
  const maps = new URL("https://www.google.com/maps");
  maps.searchParams.set("q", coordenadas || endereco);
  return { waze: waze.href, maps: maps.href, porEndereco: !coordenadas };
}
document.addEventListener("DOMContentLoaded", () => {
  const destino = destinosLocalizacaoUI(location.search);
  document.getElementById("erro-localizacao").hidden = !!destino;
  if (!destino) {
    document.getElementById("descricao-localizacao").hidden = true;
    return;
  }
  document.getElementById("abrir-waze").href = destino.waze;
  document.getElementById("abrir-maps").href = destino.maps;
  if (destino.porEndereco)
    document.getElementById("descricao-localizacao").textContent =
      "Buscar o endereço informado em qual aplicativo?";
  document.getElementById("opcoes-localizacao").hidden = false;
});
