/* Reconstrói a compra com o catálogo do servidor. Nunca usa preços ou nomes enviados como autoridade. */
const { ErroRecuperacao } = require("./recuperacao-acesso.cjs");
const normalizar = (v) =>
  String(v || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
const moeda = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0 || n > 100000)
    throw new ErroRecuperacao(400, "Valor inválido no pedido.");
  return Math.round(n * 100);
};
function inteiro(v, max = 30) {
  if (!Number.isInteger(v) || v < 1 || v > max)
    throw new ErroRecuperacao(400, "Confira as quantidades do pedido.");
  return v;
}
function texto(v, max = 1000) {
  if (v == null) return "";
  if (typeof v !== "string" || v.length > max)
    throw new ErroRecuperacao(400, "Texto muito grande ou inválido no pedido.");
  return v.trim();
}
function disponivel(p) {
  return p && p.ativo === true && p.esgotado !== true && p.somenteAtendente !== true;
}
function tiposProduto(p) {
  if (!["lanches", "combos"].includes(p.categoria)) return [];
  const principal = p.tipoBase === "hamburguer" ? "artesanal" : p.tipoBase;
  return [
    ["artesanal", "preco", "Artesanal"],
    ["industrial", "precoIndustrial", "Industrial"],
    ["frango", "precoFrango", "Frango"],
    ["file", "precoFile", "Filé"],
  ]
    .filter(([tipo, campo]) => Number(p[campo]) > 0 && (!p.opcoes || p.opcoes[tipo] === true))
    .sort((a, b) => Number(b[0] === principal) - Number(a[0] === principal));
}
function reconstruirItensPedido(entradas, produtos, adicionais, { local = false } = {}) {
  if (!Array.isArray(entradas) || !entradas.length || entradas.length > 50)
    throw new ErroRecuperacao(400, "Seu pedido deve ter de 1 a 50 itens.");
  const extras = new Map(adicionais.map((a) => [String(a.id), a]));
  const buscarExtra = (entrada) =>
    entrada.id
      ? extras.get(String(entrada.id))
      : adicionais.find((a) => normalizar(a.nome) === normalizar(entrada.nome));
  function lerExtras(lista) {
    if (lista == null) return [];
    if (!Array.isArray(lista) || lista.length > 30)
      throw new ErroRecuperacao(400, "Confira os acréscimos.");
    const vistos = new Set();
    return lista.map((e) => {
      const a = e && buscarExtra(e);
      if (!a || a.ativo !== true || a.esgotado === true || vistos.has(a.id))
        throw new ErroRecuperacao(409, "Um acréscimo mudou ou não está disponível. Reabra o item.");
      vistos.add(a.id);
      return {
        id: a.id,
        nome: a.nome,
        preco: moeda(a.preco) / 100,
        qtd: inteiro(e.qtd ?? e.quantidade, 20),
      };
    });
  }
  let unidades = 0;
  return entradas.map((entrada) => {
    if (!entrada || typeof entrada !== "object") throw new ErroRecuperacao(400, "Item inválido.");
    const p = entrada.produtoId
      ? produtos.find((p) => p.id === entrada.produtoId)
      : produtos.find(
          (p) =>
            normalizar(p.nome) ===
            normalizar(entrada.nome).replace(/\s*\((artesanal|industrial|frango|file)\)$/, ""),
        );
    if (!disponivel(p))
      throw new ErroRecuperacao(409, "Um item mudou ou não está disponível. Reabra seu carrinho.");
    const quantidade = inteiro(entrada.quantidade ?? entrada.qtd);
    unidades += quantidade;
    if (unidades > 100)
      throw new ErroRecuperacao(400, "O pedido ultrapassou o limite de unidades. Fale com a loja.");
    const tipos = tiposProduto(p);
    const pedidoTipo = normalizar(entrada.tipoCarne || entrada.tipo).replace("file mignon", "file");
    const escolhido = pedidoTipo ? tipos.find(([tipo]) => tipo === pedidoTipo) : tipos[0];
    if (pedidoTipo && tipos.length && !escolhido)
      throw new ErroRecuperacao(409, "A carne escolhida não está disponível para este item.");
    const precoBase = moeda(escolhido ? p[escolhido[1]] : p.preco);
    if (precoBase === 0)
      throw new ErroRecuperacao(409, "O preço deste item precisa ser conferido pela loja.");
    const itemExtras = lerExtras(entrada.adicionais);
    if (!["lanches", "batatas"].includes(p.categoria) && itemExtras.length)
      throw new ErroRecuperacao(400, "Este item não aceita esses acréscimos.");
    let lanchesCombo = [],
      componentes = [],
      qtdLanches = 0;
    if (p.categoria === "combos") {
      componentes = Array.isArray(p.comboComponentes)
        ? p.comboComponentes.map((c) => ({
            ...c,
            ...(c.categoria === "lanches" && escolhido ? { tipoCarne: escolhido[2] } : {}),
          }))
        : [];
      qtdLanches = Number(
        p.comboQtdLanches ||
          componentes
            .filter((c) => c.categoria === "lanches")
            .reduce((s, c) => s + Number(c.quantidade || 1), 0),
      );
      if (!Number.isInteger(qtdLanches) || qtdLanches < 1 || qtdLanches > 20)
        throw new ErroRecuperacao(409, "A composição do combo precisa ser conferida pela loja.");
      const configuracoes = entrada.lanchesCombo || [];
      if (!Array.isArray(configuracoes) || configuracoes.length > qtdLanches)
        throw new ErroRecuperacao(400, "Confira a personalização do combo.");
      const vistos = new Set();
      lanchesCombo = configuracoes.map((c, i) => {
        const numero = inteiro(c.numero ?? i + 1, qtdLanches);
        if (vistos.has(numero)) throw new ErroRecuperacao(400, "Um lanche do combo está repetido.");
        vistos.add(numero);
        return { numero, adicionais: lerExtras(c.adicionais), observacao: texto(c.observacao) };
      });
    }
    const personalizado = itemExtras.length || lanchesCombo.some((l) => l.adicionais.length);
    if (personalizado && quantidade > 1)
      throw new ErroRecuperacao(
        400,
        "Itens com acréscimos devem ser personalizados uma unidade por vez.",
      );
    const precoExtras = [...itemExtras, ...lanchesCombo.flatMap((l) => l.adicionais)].reduce(
      (s, a) => s + moeda(a.preco) * a.qtd,
      0,
    );
    const preco = (precoBase + precoExtras) / 100;
    const molhos = ["Maionese", "Ketchup", "Mostarda", "Barbecue"];
    let gratis = [],
      pagos = [];
    if (!local && ["lanches", "combos", "batatas"].includes(p.categoria)) {
      const maxUnidades = quantidade * (p.categoria === "combos" ? qtdLanches : 1);
      const lista = entrada.molhosGratis || [];
      if (!Array.isArray(lista) || lista.length > maxUnidades)
        throw new ErroRecuperacao(400, "Confira os molhos grátis.");
      const vistos = new Set();
      gratis = lista.map((m) => {
        const unidade = inteiro(m.unidade, maxUnidades);
        if (vistos.has(unidade))
          throw new ErroRecuperacao(400, "Uma unidade de molho está repetida.");
        vistos.add(unidade);
        const descricao = texto(m.texto, 150);
        const partes = descricao.split(" + ");
        if (
          !/^(sem molho|nenhum)$/i.test(descricao) &&
          !partes.every((p) => molhos.includes(p) || molhos.some((n) => p === "2 " + n))
        )
          throw new ErroRecuperacao(400, "Molho grátis inválido.");
        if (
          partes.length > 4 ||
          new Set(partes).size !== partes.length ||
          (partes.some((p) => p.startsWith("2 ")) && partes.length !== 1)
        )
          throw new ErroRecuperacao(400, "Confira os molhos grátis.");
        return { unidade, texto: descricao };
      });
      const pagosEntrada = entrada.molhosPagos || [];
      if (!Array.isArray(pagosEntrada) || pagosEntrada.length > 4)
        throw new ErroRecuperacao(400, "Confira os molhos pagos.");
      const pagosVistos = new Set();
      pagos = pagosEntrada.map((m) => {
        if (!molhos.includes(m.nome) || pagosVistos.has(m.nome))
          throw new ErroRecuperacao(400, "Molho pago inválido.");
        pagosVistos.add(m.nome);
        return { nome: m.nome, qtd: inteiro(m.qtd ?? m.quantidade, 30), preco: 2 };
      });
    }
    return {
      produtoId: p.id,
      nome: p.nome + (escolhido && tipos.length > 1 ? " (" + escolhido[2] + ")" : ""),
      categoria: p.categoria,
      tipo: escolhido?.[0] || "",
      tipoCarne: escolhido?.[0] || "",
      quantidade,
      precoBase: precoBase / 100,
      precoUnitario: preco,
      preco,
      subtotal: (Math.round(preco * 100) * quantidade) / 100,
      adicionais: itemExtras,
      observacao: texto(entrada.observacao ?? entrada.obs),
      descricao: String(p.descricao || p.desc || ""),
      comboComponentes: componentes,
      comboQtdLanches: qtdLanches,
      lanchesCombo,
      comboPersonalizado: lanchesCombo.some((l) => l.adicionais.length || l.observacao),
      modoPersonalizacaoCombo:
        lanchesCombo.length === qtdLanches &&
        qtdLanches > 0 &&
        lanchesCombo.every(
          (l) =>
            JSON.stringify([l.adicionais, l.observacao]) ===
            JSON.stringify([lanchesCombo[0].adicionais, lanchesCombo[0].observacao]),
        )
          ? "todos"
          : lanchesCombo.length
            ? "individual"
            : "padrao",
      bebida: p.bebida || p.bebidaCombo || "",
      bebidas: p.bebidas || [],
      molhosGratis: gratis,
      molhosPagos: pagos,
      totalMolhosPagos: pagos.reduce((s, m) => s + m.qtd * 2, 0),
    };
  });
}
module.exports = { reconstruirItensPedido, moeda, inteiro, texto, normalizar };
