/**
 * Cálculos puros do financeiro: dias operacionais, períodos e categorias de recebimento. Não manipula o DOM.
 *
 * Organização e caminhos: consulte GUIA-DO-CODIGO.md.
 */
/* Períodos civis em Cuiabá; o dia operacional termina às 02h. */
function limitesPeriodoFinanceiro(dia, tipo = "dia") {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dia)) throw Error("Selecione uma data válida.");
  const [ano, mes, d] = dia.split("-").map(Number);
  let inicio = new Date(Date.UTC(ano, mes - 1, d)),
    fim;
  if (tipo === "semana") {
    inicio.setUTCDate(inicio.getUTCDate() - inicio.getUTCDay());
    fim = new Date(inicio);
    fim.setUTCDate(fim.getUTCDate() + 7);
  } else if (tipo === "mes") {
    inicio = new Date(Date.UTC(ano, mes - 1, 1));
    fim = new Date(Date.UTC(ano, mes, 1));
  } else if (tipo === "ano") {
    inicio = new Date(Date.UTC(ano, 0, 1));
    fim = new Date(Date.UTC(ano + 1, 0, 1));
  } else {
    fim = new Date(inicio);
    fim.setUTCDate(fim.getUTCDate() + 1);
  }
  // Cuiabá UTC−04; abertura do dia às 02h = 06h UTC.
  return {
    inicio: inicio.getTime() + 21600000,
    fim: fim.getTime() + 21600000,
    rotulo:
      inicio.toISOString().slice(0, 10) +
      " a " +
      new Date(fim.getTime() - 86400000).toISOString().slice(0, 10),
  };
}
function categoriaFinanceiro(item, catalogo = []) {
  const p = catalogo.find(
    (p) =>
      (item.produtoId && p.id === item.produtoId) ||
      (p.nome || "").toLowerCase() === (item.nomeBase || item.nome || "").toLowerCase(),
  );
  const c = String(item.categoria || p?.categoria || "").toLowerCase();
  if (/combo/.test(c) || item.lanchesCombo?.length || item.lanchesPersonalizados?.length)
    return "Combos";
  if (/bebida/.test(c)) return "Bebidas";
  if (/batata/.test(c)) return "Batatas";
  if (/lanche/.test(c)) return "Lanches";
  return "Itens sem categoria";
}
function chaveFechamentoFinanceiro(tipo, dia) {
  const p = limitesPeriodoFinanceiro(dia, tipo);
  const inicio = new Date(p.inicio - 21600000).toISOString().slice(0, 10);
  return tipo === "dia" ? inicio : tipo + "-" + inicio;
}
function resumoEntradasFinanceiro(entradas, catalogo = []) {
  const r = {
    categorias: {
      Lanches: 0,
      Bebidas: 0,
      Batatas: 0,
      Combos: 0,
      "Molhos pagos": 0,
      "Pagamento por valor sem categoria": 0,
      "Itens sem categoria": 0,
    },
    formas: {},
    recebido: 0,
    entrega: 0,
    cupom: 0,
    fidelidade: 0,
    total: 0,
  };
  for (const e of entradas) {
    const pago = Math.max(0, Math.round(Number(e.valor || 0) * 100));
    const taxa = Math.min(pago, Math.max(0, Math.round(Number(e.taxaEntrega || 0) * 100)));
    const liquido = pago - taxa;
    r.recebido += pago;
    r.entrega += taxa;
    r.cupom += Math.round(Number(e.descontoCupom || 0) * 100);
    r.fidelidade += Math.round(Number(e.descontoFidelidade || 0) * 100);
    r.total += liquido;
    for (const f of e.formas || [])
      r.formas[f.forma || "Não informado"] =
        (r.formas[f.forma || "Não informado"] || 0) + Math.round(Number(f.valor || 0) * 100);
    if (e.modo === "valor") {
      r.categorias["Pagamento por valor sem categoria"] += liquido;
      continue;
    }
    const pesos = {};
    for (const item of e.itens || []) {
      const qtd = Number(item.quantidade || item.qtd || 1);
      const subtotal = Number(item.subtotal ?? Number(item.preco || item.valor || 0) * qtd);
      const molho = Number(item.totalMolhosPagos || 0);
      const cat = categoriaFinanceiro(item, catalogo);
      pesos[cat] = (pesos[cat] || 0) + Math.max(0, subtotal);
      pesos["Molhos pagos"] = (pesos["Molhos pagos"] || 0) + Math.max(0, molho);
    }
    const chaves = Object.keys(pesos).filter((k) => pesos[k] > 0);
    const soma = chaves.reduce((n, k) => n + pesos[k], 0);
    let alocado = 0;
    if (!soma) {
      r.categorias["Itens sem categoria"] += liquido;
      continue;
    }
    chaves.forEach((k, i) => {
      const centavos =
        i === chaves.length - 1 ? liquido - alocado : Math.round((liquido * pesos[k]) / soma);
      alocado += centavos;
      r.categorias[k] = (r.categorias[k] || 0) + centavos;
    });
  }
  for (const k of ["recebido", "entrega", "cupom", "fidelidade", "total"]) r[k] /= 100;
  for (const o of [r.categorias, r.formas]) for (const k of Object.keys(o)) o[k] /= 100;
  return r;
}
if (typeof module !== "undefined")
  module.exports = {
    limitesPeriodoFinanceiro,
    resumoEntradasFinanceiro,
    categoriaFinanceiro,
    chaveFechamentoFinanceiro,
  };
