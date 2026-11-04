/* Gestão de uma conta a partir do pedido, sem trocar sua chave de identificação. */
function controleAbasClientePedidoAdminUI(janela) {
  let versao = 0;
  janela.addEventListener("close", () => versao++);
  return { iniciar: () => ++versao, atual: (token) => janela.open && token === versao };
}
function dataValidadeClientePedidoAdminUI(valor) {
  const data = new Date(valor);
  if (!Number.isFinite(data.getTime())) return "";
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Cuiaba",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(data);
  const parte = (tipo) => partes.find((p) => p.type === tipo).value;
  return `${parte("year")}-${parte("month")}-${parte("day")}`;
}
async function salvarCadastroClientePedidoAdminUI(id, original, entrada) {
  const dados = {
    ...entrada,
    nome: String(entrada.nome || "").trim(),
    nomeReal: String(entrada.nomeReal || "").trim(),
  };
  if (!dados.nome) throw Error("Informe o nome usado no site.");
  dados.fidelidadeAtiva = entrada.fidelidadeAtiva === true || entrada.fidelidadeAtiva === "sim";
  dados.codigoAtivacao = String(entrada.codigoAtivacao || "").trim();
  if (original.fidelidadeAtiva && !dados.fidelidadeAtiva) dados.codigoAtivacao = "";
  dados.nivelCliente = nivelFidelidadeOperacao({ ...original, ...dados });
  for (const k of ["totalGasto", "totalFidelidade", "bonusDisponivel"]) {
    dados[k] = Number(dados[k]);
    if (!Number.isFinite(dados[k]) || dados[k] < 0)
      throw Error("Os saldos devem ser valores válidos, sem números negativos.");
  }
  if (dados.codigoAtivacao && !/^\d{4}$/.test(dados.codigoAtivacao))
    throw Error("CDA deve ter 4 números.");
  if (dados.codigoAtivacao && dados.codigoAtivacao !== original.codigoAtivacao) {
    const repetidos = await db
      .collection("clientes")
      .where("codigoAtivacao", "==", dados.codigoAtivacao)
      .get();
    if (repetidos.docs.some((x) => x.id !== id))
      throw Error("Este CDA já pertence a outro cliente.");
  }
  const ref = db.collection("clientes").doc(id);
  const patch = {
    ...dados,
    bonusGeradoTotal: bonusAcumuladoFidelidadeOperacao(original, dados.totalFidelidade),
    editadoEm: new Date().toISOString(),
  };
  await db.runTransaction(async (t) => {
    const atual = await t.get(ref);
    if (!atual.exists) throw Error("Conta não encontrada.");
    for (const k of Object.keys(dados))
      if (serializarOperacao(atual.data()[k]) !== serializarOperacao(original[k]))
        throw Error("A conta mudou em outra tela. Feche e abra novamente para conferir.");
    t.update(ref, patch);
  });
  return { ...original, ...patch };
}
async function alterarRaspadinhaClientePedidoAdminUI(
  clienteId,
  ticketId,
  acao,
  expiraEm,
  original,
) {
  if (!["validade", "cancelar", "reabrir"].includes(acao)) throw Error("Ação de prêmio inválida.");
  if (acao === "validade" && !Number.isFinite(expiraEm)) throw Error("Escolha uma data válida.");
  const ref = db.collection("raspadinhas").doc(ticketId);
  const mensagem = db
    .collection("clientes")
    .doc(clienteId)
    .collection("mensagens")
    .doc("raspa-" + ticketId);
  await db.runTransaction(async (t) => {
    const [atual, msg] = await Promise.all([t.get(ref), t.get(mensagem)]);
    if (!atual.exists || atual.data().clienteId !== clienteId)
      throw Error("Prêmio não pertence a esta conta.");
    for (const k of ["status", "usadaEm", "expiraEm"])
      if (serializarOperacao(atual.data()[k]) !== serializarOperacao(original[k]))
        throw Error("O prêmio mudou em outra tela. Reabra Raspadinhas para conferir.");
    const patch = {
      ...(acao === "validade"
        ? { expiraEm }
        : { status: acao === "cancelar" ? "cancelada" : "disponivel" }),
      corrigidaEm: Date.now(),
    };
    t.update(ref, patch);
    if (msg.exists && patch.status) t.update(mensagem, { raspadinhaStatus: patch.status });
  });
}
async function abrirClientePedidoAdminUI(pedidoId, pedido) {
  if (!adminAvancadoLiberado) await liberarAreaAvancadaAdmin();
  if (!adminAvancadoLiberado) return;
  const id = String(pedido.clienteId || pedido.telefoneCliente || pedido.telefone || "").replace(
    /\D/g,
    "",
  );
  if (!/^\d{11}$/.test(id))
    return avisoOperacao("Este pedido não está associado a uma conta com celular válido.");
  const d = janelaEditorUI("Cliente e benefícios"),
    box = d.querySelector(".editor-corpo-ui");
  const controle = controleAbasClientePedidoAdminUI(d);
  box.textContent = "Buscando a conta…";
  try {
    const ref = db.collection("clientes").doc(id),
      doc = await ref.get();
    if (!d.open) return;
    if (!doc.exists) throw Error("Não existe uma conta cadastrada para o celular deste pedido.");
    let original =
      typeof sincronizarRankMensalClienteUI === "function"
        ? (await sincronizarRankMensalClienteUI(id)) || doc.data()
        : doc.data();
    box.innerHTML = `<p><strong>${escaparOperacao(original.nome || "")}</strong><br>Celular da conta: ${escaparOperacao(id)}</p><div class="editor-acoes-ui"><button type="button" data-aba="cadastro">Cadastro e fidelidade</button><button type="button" data-aba="cupons">Cupons</button><button type="button" data-aba="raspadinhas">Raspadinhas</button></div><div data-painel></div>${typeof htmlRankMensalUI === "function" ? htmlRankMensalUI(original) : ""}`;
    const painel = box.querySelector("[data-painel]");
    if (typeof abrirRecuperacaoClienteAdminUI === "function") {
      const recuperar = document.createElement("button");
      recuperar.type = "button";
      recuperar.textContent = "Redefinir acesso";
      recuperar.onclick = () =>
        abrirRecuperacaoClienteAdminUI({ nome: original.nome, telefone: id });
      box.querySelector(".editor-acoes-ui").append(recuperar);
    }
    const executar = async (b, tarefa) => {
      b.disabled = true;
      try {
        await tarefa();
      } catch (e) {
        avisoOperacao(e.message);
      } finally {
        b.disabled = false;
      }
    };
    const cadastro = () => {
      const token = controle.iniciar();
      painel.innerHTML = `<form><div class="editor-grade-ui">${campoEditorUI("Nome usado no site", original.nome, "text", 'name="nome" required')}${campoEditorUI("Nome completo", original.nomeReal || "", "text", 'name="nomeReal"')}${campoEditorUI("CDA (4 números)", original.codigoAtivacao || "", "text", 'name="codigoAtivacao" maxlength="4" pattern="[0-9]{4}" inputmode="numeric"')}<label>Fidelidade<select name="fidelidadeAtiva"><option value="nao">Inativa</option><option value="sim" ${original.fidelidadeAtiva ? "selected" : ""}>Ativa</option></select></label><label>Rank mensal (automático)<select name="nivelCliente" ${original.rankMensal ? "disabled" : ""}>${["Sem nível", "Bronze", "Prata", "Ouro", "Diamante", "Imortal"].map((n) => `<option ${n === nivelFidelidadeOperacao(original) ? "selected" : ""}>${n}</option>`).join("")}</select></label>${campoEditorUI("Total gasto (R$)", original.totalGasto || 0, "number", 'name="totalGasto" min="0" step="0.01"')}${campoEditorUI("Acumulado fidelidade (R$)", original.totalFidelidade || 0, "number", 'name="totalFidelidade" min="0" step="0.01"')}${campoEditorUI("Bônus disponível (R$)", original.bonusDisponivel || 0, "number", 'name="bonusDisponivel" min="0" step="0.01"')}</div><p>O telefone identifica esta conta. O contato usado apenas neste pedido pode ser corrigido na edição do pedido.</p><p role="status"></p><footer><button type="submit">Salvar cliente</button></footer></form>`;
      const f = painel.querySelector("form"),
        status = f.querySelector("[role=status]");
      const nota = document.createElement("p");
      nota.textContent = "Ao desativar a fidelidade, o CDA atual também será removido.";
      f.querySelector("footer").before(nota);
      f.onsubmit = (e) => {
        e.preventDefault();
        executar(f.querySelector("[type=submit]"), async () => {
          const dados = Object.fromEntries(new FormData(f));
          original = await salvarCadastroClientePedidoAdminUI(id, original, dados);
          if (controle.atual(token)) {
            f.elements.codigoAtivacao.value = original.codigoAtivacao;
            f.elements.nivelCliente.value = original.nivelCliente;
            status.textContent = "Cliente atualizado.";
          }
        });
      };
    };
    const cupons = async () => {
      const token = controle.iniciar();
      painel.textContent = "Buscando cupons…";
      const [cs, ms] = await Promise.all([
        db.collection("cuponsDesconto").where("ativo", "==", true).get(),
        ref.collection("mensagens").get(),
      ]);
      if (!controle.atual(token)) return;
      const ativos = cs.docs
        .map((x) => ({ ...x.data(), id: x.id }))
        .filter(
          (c) =>
            !c.usadoEm &&
            (!Array.isArray(c.clientesPermitidos) || c.clientesPermitidos.includes(id)),
        );
      const enviados = ms.docs.map((x) => ({ ...x.data(), id: x.id })).filter((m) => m.cupomCodigo);
      painel.innerHTML = `<h3>Enviar cupom para ${escaparOperacao(original.nome)}</h3><form><label>Código<select name="codigo" required><option value="">Escolha</option>${ativos.map((c) => `<option value="${escaparOperacao(c.id)}">${escaparOperacao(c.id + " · " + (c.nome || ""))}</option>`).join("")}</select></label><label>Mensagem<textarea name="texto" required>Chegou um cupom para você!</textarea></label><button type="submit">Enviar para esta conta</button><p role="status"></p></form><h3>Cupons enviados</h3>${enviados.map((m) => `<article class="pedido-caixa-ui"><strong>${escaparOperacao(m.cupomCodigo)}</strong><p>${escaparOperacao(m.texto || "")}</p><small>As regras e a validade são as do código cadastrado.</small></article>`).join("") || "<p>Nenhum cupom enviado para esta conta.</p>"}`;
      const f = painel.querySelector("form");
      f.onsubmit = (e) => {
        e.preventDefault();
        executar(f.querySelector("[type=submit]"), async () => {
          const codigo = f.elements.codigo.value,
            texto = f.elements.texto.value.trim();
          const cupom = await validarCupomCampanha(codigo, [id]);
          if (cupom.usadoEm) throw Error("Este cupom já foi usado.");
          if (!(await confirmarOperacao(`Enviar o cupom ${codigo} para ${original.nome} (${id})?`)))
            return;
          await ref
            .collection("mensagens")
            .doc("cupom-direto-" + codigo)
            .set({
              tipo: "admin",
              remetente: "admin",
              texto,
              cupomCodigo: codigo,
              finalidade: "cupom",
              data: new Date().toISOString(),
              lida: false,
            });
          if (controle.atual(token)) await cupons();
        });
      };
    };
    const raspadinhas = async () => {
      const token = controle.iniciar();
      painel.textContent = "Buscando prêmios…";
      const [rs, cs] = await Promise.all([
        db.collection("raspadinhas").where("clienteId", "==", id).get(),
        db.collection("campanhasRaspadinhas").where("ativa", "==", true).get(),
      ]);
      if (!controle.atual(token)) return;
      painel.innerHTML = `<h3>Raspadinhas desta conta</h3><form data-emitir><label>Campanha<select required name="campanha"><option value="">Escolha</option>${cs.docs.map((x) => `<option value="${escaparOperacao(x.id)}">${escaparOperacao(x.data().nome + " · " + x.data().premio)}</option>`).join("")}</select></label><button type="submit">Emitir para este cliente</button></form><div class="editor-itens-ui">${
        rs.docs
          .map((x) => {
            const r = x.data();
            return `<article data-ticket="${escaparOperacao(x.id)}"><strong>${escaparOperacao(r.premio)} · ${escaparOperacao(r.codigo)}</strong><p>${escaparOperacao(r.status)} · validade ${new Date(r.expiraEm).toLocaleDateString("pt-BR")}</p><div class="editor-acoes-ui"><button data-acao="cancelar">Cancelar prêmio</button><button data-acao="reabrir">Reabrir prêmio</button></div>${campoEditorUI("Nova validade", dataValidadeClientePedidoAdminUI(r.expiraEm), "date", "data-validade")}<button data-acao="validade">Salvar validade</button></article>`;
          })
          .join("") || "<p>Nenhuma raspadinha nesta conta.</p>"
      }</div>`;
      const f = painel.querySelector("form");
      f.onsubmit = (e) => {
        e.preventDefault();
        executar(f.querySelector("button"), async () => {
          if (
            !(await confirmarOperacao(`Emitir a campanha escolhida para ${original.nome} (${id})?`))
          )
            return;
          await concederRaspadinha(f.elements.campanha.value, id);
          if (controle.atual(token)) await raspadinhas();
        });
      };
      painel.querySelectorAll("[data-acao]").forEach(
        (b) =>
          (b.onclick = () =>
            executar(b, async () => {
              const card = b.closest("[data-ticket]"),
                acao = b.dataset.acao;
              const expiraEm = new Date(
                card.querySelector("[data-validade]").value + "T23:59:59-04:00",
              ).getTime();
              if (acao === "validade" && !Number.isFinite(expiraEm))
                throw Error("Escolha uma data válida.");
              if (
                !(await confirmarOperacao(
                  acao === "reabrir"
                    ? "Reabrir este prêmio? O cliente poderá usá-lo novamente."
                    : acao === "cancelar"
                      ? "Cancelar este prêmio do cliente?"
                      : "Alterar a validade deste prêmio?",
                ))
              )
                return;
              const originalTicket = rs.docs.find((x) => x.id === card.dataset.ticket)?.data();
              await alterarRaspadinhaClientePedidoAdminUI(
                id,
                card.dataset.ticket,
                acao,
                expiraEm,
                originalTicket,
              );
              if (controle.atual(token)) await raspadinhas();
            })),
      );
    };
    box
      .querySelectorAll("[data-aba]")
      .forEach(
        (b) =>
          (b.onclick = () =>
            executar(b, () => ({ cadastro, cupons, raspadinhas })[b.dataset.aba]())),
      );
    cadastro();
  } catch (err) {
    box.textContent = err.message;
  }
}
