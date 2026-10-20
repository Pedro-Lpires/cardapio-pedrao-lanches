/**
 * Tela financeira: acesso do proprietário, filtros, recebimentos e fechamento. Cálculos puros ficam em financeiro-calculos.js.
 *
 * Organização e caminhos: consulte GUIA-DO-CODIGO.md.
 */
let financeiroLiberado = false;
let dadosFinanceiro = [];
let graficoFinanceiro = null;
async function hashSenhaFinanceiro(senha, salt) {
  const buffer = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(salt + ":" + senha),
  );
  return Array.from(new Uint8Array(buffer))
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("");
}
async function verificarSenhaFinanceiro(senha, config) {
  if (config.senhaFinanceiroHash)
    return (
      (await hashSenhaFinanceiro(senha, config.senhaFinanceiroSalt)) === config.senhaFinanceiroHash
    );
  return !!senha && senha === String(config.senhaFinanceiro || config.senhaMestre || "");
}
async function entrarFinanceiro() {
  const status = document.getElementById("financeiro-erro");
  try {
    const doc = await db.collection("config").doc("admin").get();
    if (
      !doc.exists ||
      !(await verificarSenhaFinanceiro(
        document.getElementById("senha-financeiro").value,
        doc.data(),
      ))
    )
      return (status.textContent = "Senha incorreta.");
    financeiroLiberado = true;
    document.getElementById("senha-financeiro").value = "";
    document.getElementById("financeiro-login").hidden = true;
    document.getElementById("financeiro-conteudo").hidden = false;
    const agora = new Date(Date.now() - 2 * 60 * 60 * 1000);
    document.getElementById("dia-financeiro").value = diaCuiabaFinanceiro(agora);
    await carregarFinanceiro();
  } catch (e) {
    status.textContent = "Não foi possível abrir o financeiro: " + e.message;
  }
}
async function trocarSenhaFinanceiro() {
  if (!financeiroLiberado) return;
  const atual = await solicitarEntradaOperacao("Senha atual do financeiro:", "password");
  if (!atual) return;
  const ref = db.collection("config").doc("admin");
  try {
    const doc = await ref.get();
    if (!(await verificarSenhaFinanceiro(atual, doc.data())))
      return avisoOperacao("Senha atual incorreta.");
    const senha = await solicitarEntradaOperacao(
      "Nova senha (pelo menos 8 caracteres):",
      "password",
    );
    if (!senha) return;
    if (senha.length < 8) return avisoOperacao("Use pelo menos 8 caracteres.");
    if ((await solicitarEntradaOperacao("Repita a nova senha:", "password")) !== senha)
      return avisoOperacao("As senhas não coincidem.");
    const salt = crypto.randomUUID();
    await ref.update({
      senhaFinanceiroHash: await hashSenhaFinanceiro(senha, salt),
      senhaFinanceiroSalt: salt,
      senhaFinanceiro: firebase.firestore.FieldValue.delete(),
    });
    avisoOperacao("Senha do financeiro alterada.");
  } catch (e) {
    avisoOperacao("Não foi possível trocar a senha: " + e.message);
  }
}
function diaCuiabaFinanceiro(data) {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Cuiaba",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(data);
  const get = (t) => partes.find((p) => p.type === t).value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}
function diaOperacionalFinanceiro(ms) {
  return diaCuiabaFinanceiro(new Date(Number(ms) - 2 * 60 * 60 * 1000));
}
async function carregarFinanceiro() {
  if (!financeiroLiberado) return;
  const dia = document.getElementById("dia-financeiro").value;
  if (!dia) return;
  const tipo = document.getElementById("periodo-financeiro").value;
  const periodo = limitesPeriodoFinanceiro(dia, tipo);
  const status = document.getElementById("financeiro-status");
  status.textContent = "Carregando…";
  try {
    const [pedidos, comandas, produtos, fechamento] = await Promise.all([
      db.collection("pedidos").get(),
      db.collection("comandas").get(),
      db.collection("produtos").get(),
      db.collection("fechamentosFinanceiros").doc(chaveFechamentoFinanceiro(tipo, dia)).get(),
    ]);
    dadosFinanceiro = [];
    const dentro = (ms) => Number(ms) >= periodo.inicio && Number(ms) < periodo.fim;
    const locais = new Set(comandas.docs.map((d) => d.data().pedidoOrigemId).filter(Boolean));
    comandas.docs.forEach((doc) => {
      const c = doc.data();
      const legado = (c.pagamentos || []).some((p) => p.forma);
      const partes = legado
        ? [
            {
              valorPago: c.valorPago ?? c.valorFinal ?? 0,
              pagoEm: c.fechadoEm,
              formas: c.pagamentos,
              itens: c.itens,
              descontoCupom: c.descontoCupom,
              descontoFidelidade: c.descontoFidelidade,
            },
          ]
        : c.pagamentos || [];
      partes.forEach((p) => {
        const ms = p.pagoEm || p.criadoEmMs || c.fechadoEm;
        if (!dentro(ms)) return;
        const itens = legado
          ? c.itens
          : (p.itens || [])
              .map((i) => {
                const item = c.itens?.[i.itemIndex];
                if (!item) return null;
                const qtd = Number(i.quantidade || 1),
                  original = Number(item.quantidade || item.qtd || 1);
                return {
                  ...item,
                  quantidade: qtd,
                  subtotal:
                    (Number(item.subtotal ?? Number(item.preco || 0) * original) * qtd) / original,
                  totalMolhosPagos: (Number(item.totalMolhosPagos || 0) * qtd) / original,
                };
              })
              .filter(Boolean);
        dadosFinanceiro.push({ ...p, valor: Number(p.valorPago ?? p.valor ?? 0), itens });
      });
    });
    pedidos.docs.forEach((doc) => {
      const p = doc.data();
      if (
        p.cancelado ||
        locais.has(doc.id) ||
        /local/i.test(p.tipo || "") ||
        !(p.pagamentoConfirmado === true || /^pago$/i.test(p.status || ""))
      )
        return;
      const ms = p.pagamentoConfirmadoEm || p.pagoEm || p.dataMs || new Date(p.data || 0).getTime();
      if (!dentro(ms)) return;
      const valor = Number(p.valorPago ?? p.valorTotal ?? 0);
      dadosFinanceiro.push({
        ...p,
        valor,
        taxaEntrega: /entrega/i.test(p.tipo || "") ? Number(p.taxaEntrega || 0) : 0,
        formas: p.formas || [{ forma: p.pagamento || p.formaPagamento || "Não informado", valor }],
      });
    });
    const resumo = resumoEntradasFinanceiro(
      dadosFinanceiro,
      produtos.docs.map((d) => ({ id: d.id, ...d.data() })),
    );
    const caixas = [
      ["Total líquido da loja", resumo.total],
      ["Recebimentos confirmados", resumo.recebido],
      ...Object.entries(resumo.categorias),
      ["Taxa de entrega / motoboy", resumo.entrega],
      ["Cupons utilizados", resumo.cupom],
      ["Fidelidade utilizada", resumo.fidelidade],
    ];
    document.getElementById("financeiro-resumo").innerHTML = caixas
      .map(
        ([titulo, valor]) =>
          "<div>" + escaparOperacao(titulo) + "<strong>" + moedaOperacao(valor) + "</strong></div>",
      )
      .join("");
    document.getElementById("financeiro-lancamentos").innerHTML =
      "<p>" +
      dadosFinanceiro.length +
      " recebimento(s) confirmado(s). O total líquido já considera os descontos e exclui a entrega.</p>";
    if (graficoFinanceiro) graficoFinanceiro.destroy();
    if (typeof Chart !== "undefined")
      graficoFinanceiro = new Chart(document.getElementById("grafico-financeiro"), {
        type: "bar",
        data: {
          labels: Object.keys(resumo.formas),
          datasets: [
            {
              label: "Recebido (R$)",
              data: Object.values(resumo.formas),
              backgroundColor: "#e32932",
            },
          ],
        },
        options: {
          responsive: true,
          plugins: { legend: { labels: { color: "#fff" } } },
          scales: {
            x: { ticks: { color: "#fff" } },
            y: { beginAtZero: true, ticks: { color: "#fff" } },
          },
        },
      });
    const f = fechamento.data() || {};
    document.getElementById("fiscal-nome").value = f.nome || "";
    document.getElementById("fiscal-documento").value = f.documento || "";
    document.getElementById("fiscal-valor").value = Number(f.valorInformado ?? resumo.total)
      .toFixed(2)
      .replace(".", ",");
    document.getElementById("fiscal-observacoes").value = f.observacoes || "";
    document.getElementById("fiscal-pessoa").value = f.pessoa || "juridica";
    document.getElementById("solicitacoes-financeiro").innerHTML =
      [...pedidos.docs, ...comandas.docs]
        .filter((d) => d.data().solicitacaoFiscal)
        .map((d) => {
          const f = d.data().solicitacaoFiscal;
          return (
            "<p>" +
            escaparOperacao(f.nome) +
            " · " +
            escaparOperacao(f.documento) +
            " · " +
            escaparOperacao(f.status) +
            "</p>"
          );
        })
        .join("") || "<p>Nenhuma solicitação.</p>";
    status.textContent = "Período: " + periodo.rotulo + ".";
  } catch (e) {
    status.textContent = "Falha ao carregar: " + e.message;
  }
}
async function salvarFechamentoFinanceiro() {
  if (!financeiroLiberado) return;
  const dia = document.getElementById("dia-financeiro").value;
  const pessoa = document.getElementById("fiscal-pessoa").value;
  const documento = document.getElementById("fiscal-documento").value.replace(/\D/g, "");
  const valor = lerValorOperacao(document.getElementById("fiscal-valor").value);
  if (documento.length !== (pessoa === "fisica" ? 11 : 14) || !Number.isFinite(valor) || valor < 0)
    return avisoOperacao("Confira o documento e o valor informado.");
  try {
    await db
      .collection("fechamentosFinanceiros")
      .doc(chaveFechamentoFinanceiro(document.getElementById("periodo-financeiro").value, dia))
      .set(
        {
          dia,
          periodo: document.getElementById("periodo-financeiro").value,
          pessoa,
          documento,
          nome: document.getElementById("fiscal-nome").value.trim(),
          valorInformado: valor,
          valorConferido: dadosFinanceiro.reduce((n, p) => n + p.valor, 0),
          observacoes: document.getElementById("fiscal-observacoes").value.trim(),
          status: "preparado_para_emissao",
          atualizadoEm: Date.now(),
        },
        { merge: true },
      );
    document.getElementById("fiscal-status").textContent =
      "Preparação salva. A nota fiscal ainda precisa ser emitida no emissor integrado.";
  } catch (e) {
    document.getElementById("fiscal-status").textContent = "Não foi possível salvar: " + e.message;
  }
}
function imprimirFechamentoFinanceiro() {
  if (!financeiroLiberado) return;
  abrirImpressaoOperacao(
    `<h1>Pedrão — conferência de recebimentos</h1><p>Período: ${escaparOperacao(limitesPeriodoFinanceiro(document.getElementById("dia-financeiro").value, document.getElementById("periodo-financeiro").value).rotulo)}</p><p>Recebido: ${moedaOperacao(dadosFinanceiro.reduce((n, p) => n + p.valor, 0))}</p><p>Valor informado: ${moedaOperacao(lerValorOperacao(document.getElementById("fiscal-valor").value))}</p><p>${escaparOperacao(document.getElementById("fiscal-nome").value)}</p><p>${escaparOperacao(document.getElementById("fiscal-documento").value)}</p><p>${escaparOperacao(document.getElementById("fiscal-observacoes").value)}</p><p>Relatório de conferência. Não é nota fiscal.</p>`,
  );
}
