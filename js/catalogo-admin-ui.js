/** Catálogo administrativo: menus, formulários em janelas e campos por categoria. */
let produtosCatalogoCacheUI = null;
function janelaCatalogoUI(id, titulo, node) {
  const existente = document.getElementById(id);
  if (existente) {
    existente.closest("dialog").close();
    return null;
  }
  const pai = node.parentNode,
    proximo = node.nextSibling,
    display = node.style.display;
  const box = telaSuporteAdmin(id, titulo, () => {
    if (proximo?.parentNode === pai) pai.insertBefore(node, proximo);
    else pai.append(node);
    node.style.display = display;
  });
  box.classList.add("catalogo-ui");
  box.append(node);
  node.style.display = "block";
  return box;
}
function montarCatalogoAdminUI() {
  const adicionais = document.querySelector(".admin-adicionais");
  if (adicionais) {
    const lista = document.getElementById("lista-adicionais-admin");
    const editor = document.createElement("div");
    editor.id = "catalogo-adicional-form";
    editor.hidden = true;
    editor.style.display = "none";
    const h = adicionais.querySelector("h2");
    [...adicionais.children].forEach((el) => {
      if (el !== h && el !== lista && !el.matches('button[onclick="toggleListaAdicionaisAdmin()"]'))
        editor.append(el);
    });
    adicionais.querySelector('button[onclick="toggleListaAdicionaisAdmin()"]')?.remove();
    const menu = document.createElement("div");
    menu.className = "catalogo-menu-ui";
    menu.innerHTML =
      '<button type="button" onclick="abrirAdicionalCatalogoUI()">Criar adicional</button><button type="button" onclick="verAdicionaisCatalogoUI()">Ver adicionais</button>';
    adicionais.append(menu, editor, lista);
    lista.style.display = "none";
  }
  document.getElementById("form-editar-produto-admin")?.remove();
  document.querySelector('button[onclick="toggleListaProdutosAdmin()"]')?.remove();
  const filtro = document.getElementById("filtro-categoria-admin");
  if (filtro && !filtro.querySelector('[value="ocultos"]'))
    filtro.insertAdjacentHTML("beforeend", '<option value="ocultos">Ocultos</option>');
  document.querySelector(".tabs-produto-admin")?.classList.add("catalogo-menu-ui");
  document.getElementById("aba-criar-produto").style.display = "none";
  document.getElementById("aba-editar-produto").style.display = "none";
}
function abrirAdicionalCatalogoUI(edicao = false) {
  const node = document.getElementById("catalogo-adicional-form");
  node.hidden = false;
  const box = janelaCatalogoUI(
    "catalogo-adicional-editor",
    edicao ? "Editar adicional" : "Criar adicional",
    node,
  );
  if (!box) return;
  if (!edicao) {
    adicionalEditandoId = null;
    for (const id of ["nome", "preco", "ordem"])
      document.getElementById("adicional-" + id).value = "";
    document.getElementById("adicional-ativo").checked = true;
    document.getElementById("adicional-esgotado").checked = false;
  }
  const botao = node.querySelector('button[onclick="salvarAdicionalAdmin()"]');
  if (botao) botao.textContent = edicao ? "Salvar alterações" : "Salvar adicional";
}
async function verAdicionaisCatalogoUI() {
  const box = janelaCatalogoUI(
    "catalogo-adicionais-lista",
    "Adicionais cadastrados",
    document.getElementById("lista-adicionais-admin"),
  );
  if (box) await listarAdicionaisAdmin();
}
async function abrirProdutoCatalogoUI(tipo) {
  const criar = tipo === "criar",
    node = document.getElementById(criar ? "aba-criar-produto" : "aba-editar-produto");
  const box = janelaCatalogoUI(
    criar ? "catalogo-produto-criar" : "catalogo-produtos-lista",
    criar ? "Criar produto" : "Produtos cadastrados",
    node,
  );
  if (!box) return;
  if (criar) {
    produtoEditandoId = null;
    organizarFormularioProdutoCatalogoUI("produto-");
    await carregarAdicionaisProduto();
  } else {
    produtosCatalogoCacheUI = null;
    document.getElementById("lista-produtos-admin").style.display = "block";
    await listarProdutosAdmin();
  }
}
function organizarFormularioProdutoCatalogoUI(prefixo, produto = null) {
  const campo = (id) => document.getElementById(prefixo + id);
  const form = campo("nome")?.closest(".form-produto-admin");
  if (!form) return;
  form.classList.add("catalogo-form-produto");
  prepararFotosAdminUI();
  if (!form.dataset.organizado) {
    form.dataset.organizado = "sim";
    const grupos = [...form.querySelectorAll(".grupo-form-admin")];
    const grupo = (nome) => grupos.find((g) => g.querySelector("h3")?.textContent.trim() === nome);
    for (const nome of [
      "Dados básicos",
      "Opções disponíveis",
      "Preços",
      "Adicionais",
      "Configurações",
      "Status",
    ]) {
      const g = grupo(nome);
      if (g) {
        g.dataset.grupoCatalogo = nome;
        form.append(g);
      }
    }
    form.querySelectorAll(":scope > button").forEach((b) => form.append(b));
    form.querySelector(":scope > h3")?.remove();
    campo("tipo-base").querySelector('[value="hamburguer"]').textContent = "Hambúrguer artesanal";
    if (!campo("tipo-base").querySelector('[value="industrial"]'))
      campo("tipo-base").insertAdjacentHTML(
        "beforeend",
        '<option value="industrial">Hambúrguer industrial</option>',
      );
    if (produto?.tipoBase === "industrial") campo("tipo-base").value = "industrial";
    if (produto && !produto.tipoBase && produto.opcoes) {
      const principal = ["artesanal", "industrial", "frango", "file"].find(
        (tipo) => produto.opcoes[tipo],
      );
      campo("tipo-base").value = principal === "artesanal" ? "hamburguer" : principal || "outro";
    }
    const nomes = {
      nome: "Nome do produto",
      descricao: "Descrição",
      categoria: "Categoria",
      "tipo-base": "Carne principal",
      preco: "Preço artesanal",
      "preco-industrial": "Preço industrial",
      "preco-frango": "Preço frango",
      "preco-file": "Preço filé",
      ordem: "Posição no cardápio",
      "qtd-lanches-combo": "Quantidade de lanches no combo",
    };
    for (const [id, nome] of Object.entries(nomes)) {
      const el = campo(id);
      if (!el) continue;
      const wrapper = document.createElement("label");
      wrapper.className = "catalogo-campo-ui";
      wrapper.dataset.campoCatalogo = id;
      const texto = document.createElement("span");
      texto.textContent = nome;
      el.before(wrapper);
      wrapper.append(texto, el);
      if (el.type === "number") {
        el.min = "0";
        el.step = id.includes("preco") ? "0.01" : "1";
      }
    }
    const qtd = campo("qtd-lanches-combo");
    if (qtd) {
      const anterior = qtd.closest("label").previousElementSibling;
      if (anterior?.tagName === "LABEL" && !anterior.querySelector("input")) anterior.remove();
    }
    const imagem = campo("imagem"),
      foto = document.getElementById(prefixo + "imagem-arquivo")?.closest("label");
    const conf = grupo("Configurações");
    conf.querySelector("h3").textContent = "Posição e foto";
    if (foto) {
      foto.classList.add("catalogo-foto-ui");
      conf.append(foto);
    }
    const avancado = document.createElement("details");
    avancado.className = "catalogo-imagem-avancada";
    avancado.innerHTML =
      "<summary>Usar caminho ou URL de imagem (opcional)</summary><p>Para uma imagem já hospedada, informe o caminho do arquivo ou o link. Para enviar do computador, use Escolher arquivo acima.</p>";
    imagem.placeholder = "Ex.: images/baguncinha.png ou https://...";
    avancado.append(imagem);
    conf.append(avancado);
    form.addEventListener("change", () => atualizarCategoriaProdutoCatalogoUI(prefixo));
    if (produto && !produto.opcoes)
      for (const [tipo, chave] of Object.entries({
        artesanal: "preco",
        industrial: "precoIndustrial",
        frango: "precoFrango",
        file: "precoFile",
      }))
        campo("op-" + tipo).checked = Number(produto[chave]) > 0;
  }
  atualizarCategoriaProdutoCatalogoUI(prefixo);
}
function atualizarCategoriaProdutoCatalogoUI(prefixo) {
  const campo = (id) => document.getElementById(prefixo + id),
    form = campo("nome").closest(".form-produto-admin");
  const categoria = campo("categoria").value,
    carne = ["lanches", "combos"].includes(categoria),
    base = campo("tipo-base").value;
  campo("tipo-base").closest("label").hidden = !carne;
  const grupo = (nome) => form.querySelector('[data-grupo-catalogo="' + nome + '"]');
  grupo("Opções disponíveis").hidden = !carne;
  grupo("Adicionais").hidden = categoria === "bebidas";
  for (const tipo of ["artesanal", "industrial", "frango", "file"]) {
    const el = campo("op-" + tipo),
      principal = base === "hamburguer" ? "artesanal" : base;
    if (el.disabled && tipo !== principal) {
      el.checked = false;
      el.disabled = false;
    }
    if (carne && tipo === principal) {
      el.checked = true;
      el.disabled = true;
    }
    const id = tipo === "artesanal" ? "preco" : "preco-" + tipo;
    const visivel = carne
      ? tipo === "artesanal"
        ? el.checked || base === "outro"
        : el.checked
      : tipo === "artesanal";
    campo(id).closest(".catalogo-campo-ui").hidden = !visivel;
  }
  campo("preco").closest("label").querySelector("span").textContent =
    carne && campo("op-artesanal").checked ? "Preço artesanal" : "Preço";
  const combo = campo("qtd-lanches-combo").closest(".catalogo-campo-ui");
  combo.hidden = categoria !== "combos";
  const boxCombo = document.getElementById("box-qtd-lanches-combo");
  if (prefixo === "produto-" && boxCombo)
    boxCombo.style.display = categoria === "combos" ? "block" : "none";
  const permite = campo("adicionais").checked;
  const adicionais = grupo("Adicionais");
  adicionais
    .querySelectorAll("input[type=radio]")
    .forEach((r) => (r.closest("label").hidden = !permite));
  const lista = document.getElementById(
    prefixo === "produto-" ? "lista-adicionais-produto" : "edit-lista-adicionais-produto",
  );
  if (lista) {
    const nome = prefixo === "produto-" ? "modo-adicional" : "edit-modo-adicional";
    lista.style.display =
      permite && form.querySelector('input[name="' + nome + '"]:checked')?.value === "selecionar"
        ? "block"
        : "none";
  }
}
function normalizarProdutoCatalogoUI(p) {
  const carne = ["lanches", "combos"].includes(p.categoria);
  if (!carne) {
    p.tipoBase = "outro";
    p.opcoes = { artesanal: false, industrial: false, frango: false, file: false };
    p.precoIndustrial = 0;
    p.precoFrango = 0;
    p.precoFile = 0;
  } else {
    const principal = p.tipoBase === "hamburguer" ? "artesanal" : p.tipoBase;
    if (principal in p.opcoes) p.opcoes[principal] = true;
    for (const [tipo, chave] of Object.entries({
      industrial: "precoIndustrial",
      frango: "precoFrango",
      file: "precoFile",
    }))
      if (!p.opcoes[tipo]) p[chave] = 0;
    if (!p.opcoes.artesanal && principal !== "outro")
      p.preco =
        Number(
          p[{ industrial: "precoIndustrial", frango: "precoFrango", file: "precoFile" }[principal]],
        ) || 0;
    for (const [tipo, chave] of Object.entries({
      artesanal: "preco",
      industrial: "precoIndustrial",
      frango: "precoFrango",
      file: "precoFile",
    }))
      if (p.opcoes[tipo] && !(Number(p[chave]) > 0))
        throw Error("Informe o preço da opção " + tipo + ".");
  }
  if (!(Number(p.preco) > 0)) throw Error("Informe um preço maior que zero.");
  if (p.categoria === "bebidas") {
    p.permiteAdicionais = false;
    p.modoAdicional = "todos";
    p.adicionaisPermitidos = [];
  }
  if (p.categoria !== "combos") p.comboQtdLanches = 0;
  return p;
}
async function concluirProdutoCatalogoUI(edicao = false) {
  produtosCatalogoCacheUI = null;
  document
    .getElementById(edicao ? "form-editar-produto-admin" : "catalogo-produto-criar")
    ?.closest("dialog")
    .close();
  produtoEditandoId = null;
  if (document.getElementById("catalogo-produtos-lista")) await listarProdutosAdmin();
}
async function concluirAdicionalCatalogoUI() {
  document.getElementById("catalogo-adicional-editor")?.closest("dialog").close();
  if (document.getElementById("catalogo-adicionais-lista")) await listarAdicionaisAdmin();
}
document.addEventListener("DOMContentLoaded", montarCatalogoAdminUI);
