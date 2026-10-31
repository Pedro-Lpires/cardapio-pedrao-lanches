function montarCamposRankCupomAdminUI(dados) {
  const form = document.querySelector("#cupons-editor-corpo .cupons-config-ui");
  if (!form) return;
  const box = document.createElement("fieldset");
  box.className = "cupom-rank-config-ui";
  box.innerHTML = `<legend>Rank do cliente</legend>
    <label class="cupom-rank-check-ui"><input id="cupom-rank-ativo" type="checkbox"> Exigir rank ativo</label>
    <div id="cupom-rank-opcoes" hidden>
      <p>Somente contas com fidelidade ativa podem usar. Sem conta ou sem rank, o código não libera desconto.</p>
      <label for="cupom-rank-acesso">Quem pode usar?</label>
      <select id="cupom-rank-acesso"><option value="todos">Todos os ranks</option><option value="exclusivo">Somente um rank</option><option value="crescente">Deste rank para cima</option></select>
      <label id="cupom-rank-nivel-label" for="cupom-rank-nivel">Rank</label>
      <select id="cupom-rank-nivel">${niveisCupomRankUI.map((n) => `<option>${n}</option>`).join("")}</select>
      <label class="cupom-rank-check-ui"><input id="cupom-rank-percentual" type="checkbox"> Percentual diferente por rank</label>
      <p id="cupom-rank-descricao">Se desmarcado, vale o desconto configurado acima.</p>
      <div id="cupom-rank-tabela" hidden>${niveisCupomRankUI.map((n) => `<label class="cupom-rank-linha-ui" data-rank="${n}" for="cupom-rank-${n}"><span>${n}</span><span><input id="cupom-rank-${n}" type="number" min="0.01" max="100" step="0.01" inputmode="decimal" placeholder="%" aria-label="Desconto ${n}"> %</span></label>`).join("")}</div>
      <p id="cupom-rank-resumo" role="status"></p>
    </div>`;
  form.append(box);
  const r = dados?.rankRegra;
  document.getElementById("cupom-rank-ativo").checked = !!r;
  document.getElementById("cupom-rank-acesso").value = r?.acesso || "todos";
  document.getElementById("cupom-rank-nivel").value = r?.nivel || "Bronze";
  document.getElementById("cupom-rank-percentual").checked = !!r?.descontoPorRank;
  for (const n of niveisCupomRankUI)
    document.getElementById("cupom-rank-" + n).value = r?.percentuais?.[n] ?? "";
  box.addEventListener("change", atualizarCamposCupomAdmin);
  atualizarCamposRankCupomAdminUI();
}

function lerRegraCupomRankAdminUI(validar = true) {
  if (!document.getElementById("cupom-rank-ativo")?.checked) return null;
  const r = {
    acesso: document.getElementById("cupom-rank-acesso").value,
    nivel: document.getElementById("cupom-rank-nivel").value,
    descontoPorRank: document.getElementById("cupom-rank-percentual").checked,
    percentuais: Object.fromEntries(
      niveisCupomRankUI.map((n) => [n, Number(document.getElementById("cupom-rank-" + n).value)]),
    ),
  };
  return validar ? validarRegraCupomRankUI(r) : r;
}

function atualizarCamposRankCupomAdminUI() {
  const box = document.getElementById("cupom-rank-opcoes");
  if (!box) return;
  const r = lerRegraCupomRankAdminUI(false);
  box.hidden = !r;
  const percentual = !!r?.descontoPorRank;
  const seletorNivel = document.getElementById("cupom-rank-nivel");
  seletorNivel.hidden = !r || r.acesso === "todos";
  document.getElementById("cupom-rank-nivel-label").hidden = seletorNivel.hidden;
  document.getElementById("cupom-rank-tabela").hidden = !percentual;
  document.getElementById("cupom-rank-descricao").textContent = percentual
    ? "Informe o percentual de cada rank liberado. Em cupons de item, o desconto vale sobre o preço dos produtos selecionados; a taxa de entrega fica fora."
    : "Vale o desconto configurado acima, somente para os ranks liberados.";
  const permitidos = r ? niveisPermitidosCupomRankUI(r) : [];
  document.querySelectorAll(".cupom-rank-linha-ui").forEach((linha) => {
    linha.hidden = !permitidos.includes(linha.dataset.rank);
    linha.querySelector("input").disabled = linha.hidden || !percentual;
  });
  document.getElementById("cupom-rank-resumo").textContent = !r
    ? ""
    : r.acesso === "exclusivo"
      ? `Somente ${r.nivel}. Ranks acima também ficam de fora.`
      : r.acesso === "crescente"
        ? `Liberado para ${permitidos.join(", ")}.`
        : "Liberado do Bronze ao Imortal.";
  const tipo = document.getElementById("cupom-tipo").value;
  const grupo = document.getElementById("cupom-item-geral").checked;
  // A tabela substitui os valores fixos; não há dois descontos para o mesmo cupom.
  const ocultar = (id) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (percentual) el.style.display = "none";
    document
      .querySelectorAll(`label[for="${id}"]`)
      .forEach((l) => (l.hidden = el.style.display === "none"));
  };
  for (const id of [
    "cupom-valor",
    "cupom-item-preco-promocional",
    "cupom-item-geral-modo",
    "cupom-item-geral-valor",
  ])
    ocultar(id);
  if (percentual) {
    document.getElementById("box-modo-cupom").style.display = "none";
    document.getElementById("campo-km-gratis").style.display = "none";
  }
  if (tipo === "item" && grupo)
    document.getElementById("campo-item-geral-tipo").style.display = "block";
}
