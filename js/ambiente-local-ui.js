/* Live Server não executa as APIs. A prévia isolada não usa o banco real. */
function ambienteLocalSemServidorUI() {
  return (
    ["127.0.0.1", "localhost", "[::1]"].includes(location.hostname) &&
    !location.pathname.startsWith("/tests/")
  );
}
function mostrarAmbienteLocalUI(container, pagina) {
  const destino = pagina === "autoatendimento.html" ? pagina + location.search : "admin.html";
  const caixa = document.createElement("section");
  caixa.className = "ambiente-local-ui";
  caixa.innerHTML = `<h2>Você abriu pelo Live Server</h2><p>Esta prévia não executa o servidor que valida o acesso e os pedidos. O banco protegido continua funcionando no site publicado.</p><div class="ambiente-local-acoes"><a data-publicado>Abrir site publicado</a><a data-previa>Testar com dados fictícios</a></div><p class="ambiente-local-ajuda">Para conferir alterações nos arquivos, use a prévia com dados fictícios. Produtos, preços, funcionários e pedidos reais são gerenciados no ADM publicado.</p>`;
  caixa.querySelector("[data-publicado]").href = new URL(
    destino,
    "https://cardapio-pedrao-lanches.vercel.app/",
  ).href;
  const previa = new URL("tests/revisao-browser.html", location.origin);
  previa.searchParams.set("pagina", pagina);
  caixa.querySelector("[data-previa]").href = previa.href;
  container.replaceChildren(caixa);
}
function abrirAmbienteLocalEquipeUI() {
  const janela = document.createElement("dialog");
  janela.className = "ambiente-local-janela-ui";
  mostrarAmbienteLocalUI(janela, "admin.html");
  janela.addEventListener("cancel", (e) => e.preventDefault());
  document.body.append(janela);
  janela.showModal();
}
