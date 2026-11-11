function janelaBeneficiosAdminUI(id, titulo) {
  if (!adminAvancadoLiberado) return null;
  document.getElementById(id)?.closest("dialog")?.close();
  const box = telaSuporteAdmin(id, titulo);
  box.classList.add("beneficios-ui");
  return box;
}
function validarBeneficiosAdminUI(config) {
  for (const v of [...Object.values(config.valores), config.limitePorPedido, config.pedidoMinimo])
    if (
      !Number.isFinite(v) ||
      v < 0 ||
      v > 99999 ||
      Math.abs(v * 100 - Math.round(v * 100)) > 0.000001
    )
      throw Error("Informe valores de R$ 0 a R$ 99.999, com até duas casas decimais.");
  return config;
}
async function salvarConfigBeneficiosAdminUI(config, original) {
  if (!adminAvancadoLiberado) throw Error("Entre no ADM avançado novamente.");
  validarBeneficiosAdminUI(config);
  const ref = db.collection("config").doc("beneficios");
  return db.runTransaction(async (t) => {
    const atual = await t.get(ref);
    if (serializarOperacao(atual.exists ? atual.data() : {}) !== serializarOperacao(original))
      throw Error("A configuração mudou em outra tela. Feche e abra novamente.");
    const dados = { ...original, creditoEntrega: config, editadoEm: Date.now() };
    t.set(ref, dados);
    return dados;
  });
}
async function abrirBeneficiosAdminUI() {
  const box = janelaBeneficiosAdminUI("beneficios-config-ui", "Benefícios");
  if (!box) return;
  box.textContent = "Buscando configurações…";
  try {
    const doc = await db.collection("config").doc("beneficios").get();
    const original = doc.exists ? doc.data() : {};
    if (!box.isConnected) return;
    const c = configurarBeneficiosEntregaUI(original);
    box.innerHTML =
      '<section class="beneficios-status-ui" aria-label="Controle dos benefícios"><div><strong>Crédito de entrega</strong><span data-situacao></span></div><button type="button" data-alternar></button><p data-pausa></p><p role="status" data-status-pausa></p></section>' +
      '<details class="beneficios-ajuda-ui"><summary>Como funciona?</summary><p>A regra vale automaticamente para todas as contas ativadas, inclusive as que entrarem depois. Cada conta recebe o limite configurado para seu rank.</p><p>O crédito abate a taxa de entrega. A loja paga essa parte; o motoboy recebe a taxa integral.</p><p>Pausar bloqueia novos usos de todas as contas. Pedidos já enviados mantêm o desconto registrado.</p><p>Renova a cada mês, sem acumular sobras. Subir de rank aumenta o limite sem repor o que já foi gasto.</p></details>' +
      '<form><fieldset><legend>Valor mensal por rank (R$)</legend><div class="beneficios-ranks-ui">' +
      Object.entries(c.valores)
        .map(
          ([n, v]) =>
            '<label class="beneficios-rank-linha-ui"><span>' +
            n +
            '</span><input aria-label="Crédito mensal ' +
            n +
            ' (R$)" name="' +
            n +
            '" type="number" min="0" max="99999" step="0.01" value="' +
            v +
            '" inputmode="decimal" required></label>',
        )
        .join("") +
      "</div></fieldset>" +
      '<fieldset class="beneficios-regras-ui"><legend>Regras de uso</legend><label>Limite por entrega (R$)<input name="limitePorPedido" type="number" min="0" step="0.01" value="' +
      c.limitePorPedido +
      '" required><small>Zero: usa até o saldo disponível, sem ultrapassar o frete.</small></label><label>Compra mínima em produtos (R$)<input name="pedidoMinimo" type="number" min="0" step="0.01" value="' +
      c.pedidoMinimo +
      '" required><small>Valor após descontos, sem frete. Zero: sem mínimo.</small></label><label class="beneficios-check-ui"><input name="acumularCupom" type="checkbox" ' +
      (c.acumularCupom ? "checked" : "") +
      '><span>Permitir junto com cupom</span></label><label class="beneficios-check-ui"><input name="acumularFidelidade" type="checkbox" ' +
      (c.acumularFidelidade ? "checked" : "") +
      '><span>Permitir junto com fidelidade</span></label></fieldset><p role="status"></p><button type="submit">Salvar valores e regras</button></form>';
    const alternar = box.querySelector("[data-alternar]");
    const form = box.querySelector("form");
    const atualizarStatus = () => {
      const config = configurarBeneficiosEntregaUI(original);
      box.querySelector("[data-situacao]").textContent = config.ativo
        ? "Ativo para todas as contas elegíveis"
        : "Novos usos pausados";
      alternar.textContent = config.ativo
        ? "Pausar benefícios"
        : original.creditoEntrega
          ? "Retomar benefícios"
          : "Ativar benefícios";
      alternar.setAttribute("aria-pressed", String(config.ativo));
      box.querySelector("[data-pausa]").textContent = config.ativo
        ? "Pausar bloqueia novos usos em todas as contas. Os valores configurados ficam guardados."
        : "Retomar mantém os valores e desconta o que já foi utilizado neste mês.";
    };
    const bloquear = (valor) => {
      alternar.disabled = valor;
      form.querySelectorAll("input, button").forEach((campo) => (campo.disabled = valor));
    };
    const botaoSalvar = form.querySelector('button[type="submit"]');
    const statusSalvar = form.querySelector('[role="status"]');
    statusSalvar.setAttribute("aria-live", "polite");
    form.addEventListener("input", () => {
      botaoSalvar.textContent = "Salvar valores e regras";
      botaoSalvar.classList.remove("beneficios-salvo-ui");
      statusSalvar.textContent = "Alterações ainda não salvas.";
      statusSalvar.dataset.estado = "pendente";
    });
    atualizarStatus();
    alternar.onclick = async () => {
      const status = box.querySelector("[data-status-pausa]");
      bloquear(true);
      try {
        const config = configurarBeneficiosEntregaUI(original);
        config.ativo = !config.ativo;
        if (config.ativo && !Object.values(config.valores).some((v) => v > 0))
          throw Error("Defina e salve um valor mensal antes de ativar.");
        const salvo = await salvarConfigBeneficiosAdminUI(config, original);
        Object.assign(original, salvo);
        atualizarStatus();
        status.textContent = config.ativo
          ? "Benefícios retomados."
          : "Pausa salva para todas as contas.";
      } catch (e) {
        status.textContent = e.message;
      } finally {
        bloquear(false);
      }
    };
    form.onsubmit = async (e) => {
      e.preventDefault();
      const f = e.currentTarget,
        status = f.querySelector("[role=status]");
      bloquear(true);
      botaoSalvar.textContent = "Salvando…";
      botaoSalvar.classList.remove("beneficios-salvo-ui");
      status.dataset.estado = "salvando";
      status.textContent = "Salvando…";
      try {
        const config = validarBeneficiosAdminUI({
          ativo: configurarBeneficiosEntregaUI(original).ativo,
          valores: Object.fromEntries(
            Object.keys(c.valores).map((n) => [n, Number(f.elements[n].value)]),
          ),
          limitePorPedido: Number(f.elements.limitePorPedido.value),
          pedidoMinimo: Number(f.elements.pedidoMinimo.value),
          acumularCupom: f.elements.acumularCupom.checked,
          acumularFidelidade: f.elements.acumularFidelidade.checked,
        });
        const salvo = await salvarConfigBeneficiosAdminUI(config, original);
        Object.assign(original, salvo);
        atualizarStatus();
        status.textContent = config.ativo
          ? "Valores e regras salvos. Benefícios ativos."
          : "Valores e regras salvos. Os usos continuam pausados.";
        status.dataset.estado = "sucesso";
        botaoSalvar.textContent = "✓ Valores salvos";
        botaoSalvar.classList.add("beneficios-salvo-ui");
      } catch (e) {
        status.textContent = e.message;
        status.dataset.estado = "erro";
        botaoSalvar.textContent = "Tentar salvar novamente";
      } finally {
        bloquear(false);
        botaoSalvar.scrollIntoView({ block: "nearest" });
      }
    };
  } catch (e) {
    box.textContent = "Não foi possível abrir os benefícios: " + e.message;
  }
}
async function abrirSaldoBeneficiosAdminUI() {
  const box = janelaBeneficiosAdminUI("beneficios-cliente-ui", "Benefícios do cliente");
  if (!box) return;
  box.innerHTML =
    '<form data-busca><label>Celular com DDD<input name="telefone" inputmode="numeric" maxlength="11" pattern="[0-9]{11}" required placeholder="11 números"></label><button>Consultar saldo</button><p role="status"></p></form><div data-conta></div>';
  box.querySelector("[data-busca]").onsubmit = async (e) => {
    e.preventDefault();
    const f = e.currentTarget,
      b = f.querySelector("button"),
      id = f.elements.telefone.value.replace(/\D/g, "");
    b.disabled = true;
    const status = f.querySelector("[role=status]");
    try {
      if (id.length !== 11) throw Error("Informe os 11 números do celular com DDD.");
      const c = await sincronizarRankMensalClienteUI(id);
      if (!c) throw Error("Conta não encontrada.");
      const cfg = await lerBeneficiosEntregaUI();
      await renderizarSaldoBeneficiosAdminUI(box, id, c, cfg);
      status.textContent = "";
    } catch (erro) {
      status.textContent = erro.message;
    } finally {
      b.disabled = false;
    }
  };
}
async function renderizarSaldoBeneficiosAdminUI(box, id, cliente, cfg) {
  if (!box.isConnected) return;
  const saldo = saldoBeneficiosEntregaUI(cliente, cfg),
    area = box.querySelector("[data-conta]");
  const versao = String(Number(area.dataset.versao || 0) + 1);
  area.dataset.versao = versao;
  area.innerHTML = `<article class="beneficios-conta-resumo-ui"><strong>${escaparOperacao(cliente.nome || id)} · ${saldo.nivel}</strong><dl><div><dt>Limite mensal</dt><dd>${moedaOperacao(saldo.limite / 100)}</dd></div><div><dt>Utilizado</dt><dd>${moedaOperacao(saldo.utilizado / 100)}</dd></div><div><dt>Reservado</dt><dd>${moedaOperacao(saldo.reservado / 100)}</dd></div><div class="beneficios-disponivel-ui"><dt>Disponível</dt><dd>${moedaOperacao(saldo.disponivel / 100)}</dd></div></dl>${!cfg.ativo ? "<p>Crédito de entrega desligado nas configurações.</p>" : ""}</article><form data-ajuste><h4>Ajuste deste mês</h4><label>Valor do ajuste (R$)<input name="ajuste" type="number" inputmode="decimal" step="0.01" value="0"><small>Valor positivo acrescenta saldo; negativo reduz somente o disponível.</small></label><label class="beneficios-check-ui"><input name="bloqueado" type="checkbox" ${saldo.bloqueado ? "checked" : ""}><span>Pausar crédito desta conta</span></label><label>Motivo<textarea name="motivo" required minlength="3" maxlength="300" rows="3"></textarea></label><p role="status"></p><button>Salvar ajuste</button></form><details class="beneficios-historico-ui"><summary>Ajustes deste mês</summary><div data-historico>Buscando histórico…</div></details>`;
  area.querySelector("form").onsubmit = async (e) => {
    e.preventDefault();
    const f = e.currentTarget,
      b = f.querySelector("button"),
      status = f.querySelector("[role=status]");
    b.disabled = true;
    try {
      const valor = Number(f.elements.ajuste.value),
        delta = centavosOperacao(valor),
        motivo = f.elements.motivo.value.trim();
      if (
        !Number.isFinite(valor) ||
        Math.abs(valor) > 99999 ||
        Math.abs(valor * 100 - delta) > 0.000001 ||
        motivo.length < 3
      )
        throw Error("Confira o valor e informe o motivo.");
      const ref = db.collection("clientes").doc(id),
        registro = db.collection("beneficiosAjustes").doc();
      await db.runTransaction(async (t) => {
        if (!adminAvancadoLiberado) throw Error("Entre no ADM avançado novamente.");
        const doc = await t.get(ref),
          configDoc = await t.get(db.collection("config").doc("beneficios"));
        if (!doc.exists) throw Error("Conta não encontrada.");
        const c = doc.data(),
          config = configurarBeneficiosEntregaUI(configDoc.exists ? configDoc.data() : {}),
          s = saldoBeneficiosEntregaUI(c, config);
        if (delta < 0 && -delta > s.disponivel)
          throw Error("A redução ultrapassa o saldo disponível.");
        const carteira = c.beneficiosEntrega || {},
          mes = carteira.meses?.[s.mes] || {};
        t.update(ref, {
          beneficiosEntrega: {
            ...carteira,
            bloqueado: f.elements.bloqueado.checked,
            meses: {
              ...carteira.meses,
              [s.mes]: { ...mes, ajuste: Number(mes.ajuste || 0) + delta },
            },
          },
        });
        t.set(registro, {
          clienteId: id,
          mes: s.mes,
          ajusteCentavos: delta,
          bloqueado: f.elements.bloqueado.checked,
          motivo,
          criadoEm: Date.now(),
        });
      });
      await renderizarSaldoBeneficiosAdminUI(
        box,
        id,
        (await db.collection("clientes").doc(id).get()).data(),
        await lerBeneficiosEntregaUI(),
      );
      area.querySelector("[role=status]").textContent = "Ajuste salvo no histórico.";
    } catch (erro) {
      status.textContent = erro.message;
    } finally {
      b.disabled = false;
    }
  };
  try {
    const snap = await db.collection("beneficiosAjustes").where("clienteId", "==", id).get();
    if (!area.isConnected || area.dataset.versao !== versao) return;
    area.querySelector("[data-historico]").innerHTML =
      snap.docs
        .map((d) => d.data())
        .filter((a) => a.mes === saldo.mes)
        .sort((a, b) => Number(b.criadoEm) - Number(a.criadoEm))
        .slice(0, 20)
        .map(
          (a) =>
            `<article><strong>${moedaOperacao(Number(a.ajusteCentavos || 0) / 100)}</strong><p>${escaparOperacao(a.motivo)}</p><small>${a.bloqueado ? "Conta pausada" : "Conta liberada"} · ${new Date(a.criadoEm).toLocaleString("pt-BR")}</small></article>`,
        )
        .join("") || "<p>Nenhum ajuste neste mês.</p>";
  } catch {
    if (area.dataset.versao === versao)
      area.querySelector("[data-historico]").textContent =
        "Não foi possível consultar o histórico.";
  }
}
async function abrirUsoBeneficiosAdminUI() {
  const box = janelaBeneficiosAdminUI("beneficios-uso-ui", "Uso dos benefícios");
  if (!box) return;
  box.innerHTML = `<form><label>Mês<input name="mes" type="month" value="${competenciaRankMensalUI()}" required></label><button>Consultar uso</button></form><div data-resultado></div>`;
  const consultar = async () => {
    const area = box.querySelector("[data-resultado]"),
      mes = box.querySelector('[name="mes"]').value;
    area.textContent = "Buscando…";
    try {
      const snap = await db.collection("pedidos").where("creditoEntregaMes", "==", mes).get();
      if (!box.isConnected) return;
      const linhas = snap.docs
        .map((d) => ({ ...d.data(), id: d.id }))
        .filter((p) => p.creditoEntrega);
      const total = (status) =>
        linhas
          .filter((p) => p.creditoEntrega.status === status)
          .reduce((n, p) => n + Number(p.creditoEntrega.centavos || 0), 0) / 100;
      area.innerHTML =
        `<p>Utilizado pela loja: <strong>${moedaOperacao(total("utilizado"))}</strong></p><p>Reservado: ${moedaOperacao(total("reservado"))}</p>` +
        (linhas
          .map(
            (p) =>
              `<article><strong>${escaparOperacao(p.nome || p.clienteId || "Cliente")}</strong><p>${escaparOperacao({ reservado: "Reservado", utilizado: "Utilizado", devolvido: "Devolvido" }[p.creditoEntrega.status] || p.creditoEntrega.status)} · ${moedaOperacao(Number(p.creditoEntrega.centavos || 0) / 100)}</p>${p.creditoEntrega.devolvidoTotal ? `<p>Devolvido ao saldo: ${moedaOperacao(p.creditoEntrega.devolvidoTotal / 100)}</p>` : ""}<button data-pedido="${escaparOperacao(p.id)}">Ver pedido</button></article>`,
          )
          .join("") || "<p>Nenhum uso neste mês.</p>");
      area.querySelectorAll("[data-pedido]").forEach(
        (b) =>
          (b.onclick = () => {
            box.closest("dialog").close();
            abrirCentralOperacao("Entrega", b.dataset.pedido);
          }),
      );
    } catch (e) {
      area.textContent = "Não foi possível consultar: " + e.message;
    }
  };
  box.querySelector("form").onsubmit = (e) => {
    e.preventDefault();
    consultar();
  };
  await consultar();
}
