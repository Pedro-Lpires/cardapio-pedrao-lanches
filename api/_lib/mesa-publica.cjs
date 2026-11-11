const crypto = require("node:crypto");
const { ErroRecuperacao } = require("./recuperacao-acesso.cjs");
const { diaPedido } = require("./pedido-publico.cjs");
const hash = (v) => crypto.createHash("sha256").update(v).digest("hex");
function criarServicoMesaPublica({ db, auth, pedidos, consumirTentativa, agora = Date.now }) {
  const numero = (v) => {
    if (!Number.isInteger(v) || v < 1 || v > 20)
      throw new ErroRecuperacao(400, "Escaneie o QR Code de uma das mesas.");
    return v;
  };
  function credencial(d) {
    numero(d.mesa);
    if (typeof d.segredo !== "string" || !/^[a-f0-9]{64}$/.test(d.segredo))
      throw new ErroRecuperacao(401, "Escaneie o QR Code para iniciar seu atendimento.");
    return { id: "v_" + hash(d.mesa + "|" + d.segredo).slice(0, 40), hash: hash(d.segredo) };
  }
  async function limitar(d) {
    await consumirTentativa({ origemRede: d.origemRede, em: agora() });
  }
  async function mesaRef(n) {
    const encontrados = await db
      .collection("mesas")
      .where("numero", "==", numero(n))
      .limit(2)
      .get();
    if (encontrados.docs.length > 1)
      throw new ErroRecuperacao(409, "A mesa precisa ser conferida pelo atendente.");
    return encontrados.docs[0]?.ref || db.collection("mesas").doc("mesa-" + n);
  }
  async function lerVisita(t, d) {
    const c = credencial(d),
      sr = db.collection("sessoesMesa").doc(c.id),
      ar = db.collection("authVisitasMesa").doc(c.id);
    const [s, a] = await Promise.all([t.get(sr), t.get(ar)]);
    if (!s.exists || !a.exists) return null;
    if (a.data().segredoHash !== c.hash || s.data().mesaNumero !== d.mesa)
      throw new ErroRecuperacao(403, "Esta visita pertence a outra mesa.");
    const sessao = { ...s.data(), id: c.id },
      mr = db.collection("mesas").doc(sessao.mesaId);
    const m = await t.get(mr),
      cr = sessao.comandaId ? db.collection("comandas").doc(sessao.comandaId) : null;
    const comanda = cr ? await t.get(cr) : null;
    const rascunhoExpirado =
      !sessao.pedidoEnviado && diaPedido(sessao.criadoEmMs) !== diaPedido(agora());
    const encerrada =
      sessao.status !== "ativa" ||
      !m.exists ||
      (sessao.pedidoEnviado
        ? !comanda?.exists ||
          comanda.data().status !== "Aberta" ||
          comanda.data().sessaoAutoatendimentoId !== c.id ||
          m.data().ocupada !== true
        : rascunhoExpirado ||
          (sessao.rodadaAutoatendimento ?? 0) !== (m.data().rodadaAutoatendimento ?? 0));
    return {
      sessao,
      sr,
      mr,
      cr,
      mesa: m.data(),
      comanda: comanda?.data(),
      encerrada,
      rascunhoExpirado,
    };
  }
  async function resposta(v) {
    if (!v) return { sessao: null };
    if (v.encerrada)
      return { sessaoEncerrada: true, ...(v.rascunhoExpirado ? { rascunhoExpirado: true } : {}) };
    const uid = v.sessao.visitaAuthUid;
    return {
      sessao: v.sessao,
      ...(v.sessao.pedidoEnviado
        ? {
            visitaUid: uid,
            token: await auth.createCustomToken(uid, {
              visitaMesa: true,
              sessaoMesaId: v.sessao.id,
              mesaId: v.sessao.mesaId,
            }),
          }
        : {}),
    };
  }
  async function estado(d) {
    await limitar(d);
    const ref = await mesaRef(d.mesa),
      doc = await ref.get();
    return {
      mesa: { id: ref.id, numero: d.mesa, ocupada: doc.exists && doc.data().ocupada === true },
    };
  }
  async function retomar(d) {
    await limitar(d);
    const v = await db.runTransaction(async (t) => {
      const v = await lerVisita(t, d);
      if (v?.encerrada && v.sessao.status === "ativa")
        t.update(v.sr, { status: "encerrada", encerradaEmMs: agora() });
      return v;
    });
    return resposta(v);
  }
  async function iniciar(d) {
    await limitar(d);
    const c = credencial(d),
      ref = await mesaRef(d.mesa);
    const cliente = d.authorization ? (await pedidos.perfil(d)).cliente : null;
    const nome = String(cliente?.nome || d.nome || "").trim();
    if (!/^[\p{L}\p{M}\p{N} .'-]{2,100}$/u.test(nome))
      throw new ErroRecuperacao(400, "Informe como podemos te chamar.");
    const v = await db.runTransaction(async (t) => {
      const anterior = await lerVisita(t, d);
      if (anterior) return anterior;
      const [m, loja] = await Promise.all([t.get(ref), t.get(db.collection("config").doc("loja"))]);
      if (loja.exists && loja.data().aberta === false)
        throw new ErroRecuperacao(409, "Estamos fechados para novos pedidos.");
      if (m.exists && m.data().ocupada === true)
        throw new ErroRecuperacao(409, "Esta mesa já está em atendimento. Chame o atendente.");
      const em = agora(),
        sessao = {
          mesaId: ref.id,
          mesaNumero: d.mesa,
          nome,
          nomeTemporario: nome,
          status: "ativa",
          pedidoEnviado: false,
          rodadaAutoatendimento: m.data()?.rodadaAutoatendimento ?? 0,
          comandaId: null,
          clienteId: cliente?.telefone || null,
          clienteAuthUid: cliente?.authUid || null,
          clienteLogado: !!cliente,
          clienteNome: cliente?.nome || null,
          clienteAvatar: cliente?.avatar || null,
          criadoEmMs: em,
          criadoEm: new Date(em).toISOString(),
          visitaAuthUid: "visita_" + hash(c.id + c.hash).slice(0, 40),
          sessaoProtegida: 1,
        };
      if (!m.exists) t.set(ref, { numero: d.mesa, ocupada: false });
      t.set(db.collection("sessoesMesa").doc(c.id), sessao);
      t.set(db.collection("authVisitasMesa").doc(c.id), {
        segredoHash: c.hash,
        mesaId: ref.id,
        criadoEmMs: em,
      });
      return { sessao: { ...sessao, id: c.id } };
    });
    return resposta(v);
  }
  async function enviar(d) {
    await limitar(d);
    credencial(d);
    const cliente = d.authorization ? (await pedidos.perfil(d)).cliente : null;
    const preparar = await pedidos.prepararItens(d.itens),
      dia = diaPedido(agora()),
      inicial = await pedidos.numeracaoInicial(dia);
    const v = await db.runTransaction(async (t) => {
      const v = await lerVisita(t, d);
      if (!v || v.encerrada)
        throw new ErroRecuperacao(
          410,
          "Este atendimento foi encerrado. Escaneie o QR Code novamente.",
        );
      if (v.sessao.pedidoEnviado) return v;
      if (v.sessao.clienteAuthUid && v.sessao.clienteAuthUid !== cliente?.authUid)
        throw new ErroRecuperacao(401, "Entre novamente na sua conta antes de enviar o pedido.");
      const loja = await t.get(db.collection("config").doc("loja"));
      if (loja.exists && loja.data().aberta === false)
        throw new ErroRecuperacao(409, "Estamos fechados para novos pedidos.");
      // Visitas abertas antes da atualização não registraram a rodada da mesa.
      if (v.mesa.ocupada === true && v.sessao.rodadaAutoatendimento == null)
        throw new ErroRecuperacao(
          409,
          "A mesa entrou em atendimento. Chame o atendente antes de enviar.",
        );
      const itens = await preparar(t);
      const contador = db.collection("config").doc("contadorPedidos_" + dia),
        cd = await t.get(contador);
      const ultimo = cd.exists ? cd.data().ultimoNumero : inicial;
      if (!Number.isSafeInteger(ultimo) || ultimo < 0) throw Error("Confira a numeração.");
      const numero = ultimo + 1,
        em = agora(),
        data = new Date(em).toISOString();
      const valorTotal = itens.reduce((s, i) => s + Math.round(i.subtotal * 100), 0) / 100;
      if (
        !Number.isFinite(d.valorTotalEsperado) ||
        Math.round(d.valorTotalEsperado * 100) !== Math.round(valorTotal * 100)
      )
        throw new ErroRecuperacao(
          409,
          "Um preço mudou. Reabra os itens do carrinho antes de enviar.",
        );
      const comandaId = "auto_" + v.sessao.id,
        pedidoId = comandaId;
      const vinculo = {
        clienteId: v.sessao.clienteId,
        clienteAuthUid: v.sessao.clienteAuthUid,
        clienteLogado: v.sessao.clienteLogado,
      };
      t.set(db.collection("comandas").doc(comandaId), {
        ...vinculo,
        cliente: v.sessao.nome,
        mesa: d.mesa,
        mesaId: v.sessao.mesaId,
        status: "Aberta",
        origem: "autoatendimento",
        sessaoAutoatendimentoId: v.sessao.id,
        pedidoOrigemId: pedidoId,
        atendenteId: null,
        atendenteNome: "Autoatendimento",
        itens,
        itensEnviadosCozinha: itens,
        valorTotal,
        valorPago: 0,
        criadoEm: em,
        criadoEmIso: data,
      });
      t.set(db.collection("pedidos").doc(pedidoId), {
        ...vinculo,
        id: pedidoId,
        numero,
        numeroDia: numero,
        diaOperacional: dia,
        nome: v.sessao.nome,
        telefone: "",
        telefoneLimpo: "",
        tipo: "Local",
        mesa: d.mesa,
        mesaId: v.sessao.mesaId,
        comandaId,
        sessaoAutoatendimentoId: v.sessao.id,
        origem: "autoatendimento",
        itens,
        valorTotal,
        valorAntesDesconto: valorTotal,
        taxaEntrega: 0,
        descontoFidelidade: 0,
        descontoCupom: 0,
        cupomDescontoCodigo: "",
        pagamento: "Pendente",
        cancelado: false,
        data,
        dataMs: em,
        statusCozinha: "novo",
        enviadoCozinhaEm: data,
        enviadoCozinhaEmMs: em,
      });
      t.set(db.collection("filaCozinha").doc(comandaId), {
        origemColecao: "comandas",
        origemId: comandaId,
        numero,
        numeroDia: numero,
        diaOperacional: dia,
        mesa: d.mesa,
        cliente: v.sessao.nome,
        itens,
        status: "aguardando",
        criadoEmMs: em,
        confirmadoPor: "Autoatendimento",
      });
      t.set(contador, { ultimoNumero: numero });
      t.update(v.mr, { ocupada: true, ultimaComandaAbertaId: comandaId });
      const patch = {
        pedidoEnviado: true,
        comandaId,
        pedidoId,
        atualizadoEm: data,
        atualizadoEmMs: em,
      };
      t.update(v.sr, patch);
      return { ...v, sessao: { ...v.sessao, ...patch } };
    });
    return resposta(v);
  }
  async function vincular(d) {
    await limitar(d);
    const cliente = d.sair === true ? null : (await pedidos.perfil(d)).cliente;
    const v = await db.runTransaction(async (t) => {
      const v = await lerVisita(t, d);
      if (!v || v.encerrada) throw new ErroRecuperacao(410, "Atendimento encerrado.");
      if (d.sair && v.sessao.pedidoEnviado) return v;
      const pr = v.sessao.pedidoId ? db.collection("pedidos").doc(v.sessao.pedidoId) : null;
      if (pr) await t.get(pr);
      const patch = {
        nome: cliente?.nome || v.sessao.nomeTemporario,
        clienteId: cliente?.telefone || null,
        clienteAuthUid: cliente?.authUid || null,
        clienteLogado: !!cliente,
        clienteNome: cliente?.nome || null,
        clienteAvatar: cliente?.avatar || null,
        atualizadoEmMs: agora(),
      };
      t.update(v.sr, patch);
      if (v.cr)
        t.update(v.cr, {
          cliente: patch.nome,
          clienteId: patch.clienteId,
          clienteAuthUid: patch.clienteAuthUid,
          clienteLogado: patch.clienteLogado,
          clienteNomeCadastro: patch.clienteNome,
        });
      if (pr)
        t.update(pr, {
          nome: patch.nome,
          clienteId: patch.clienteId,
          clienteAuthUid: patch.clienteAuthUid,
          clienteLogado: patch.clienteLogado,
        });
      return { ...v, sessao: { ...v.sessao, ...patch } };
    });
    return resposta(v);
  }
  async function chamar(d) {
    await limitar(d);
    if (!["atendente", "conta"].includes(d.tipo))
      throw new ErroRecuperacao(400, "Escolha o tipo de chamado.");
    const ref = await mesaRef(d.mesa),
      novo = db.collection("chamadosMesa").doc();
    return db.runTransaction(async (t) => {
      const v = d.segredo ? await lerVisita(t, d) : null;
      if ((d.segredo && (!v || v.encerrada)) || (d.tipo === "conta" && !v?.sessao.pedidoEnviado))
        throw new ErroRecuperacao(410, "Confira o atendimento desta mesa.");
      const mesa = await t.get(ref);
      if (!mesa.exists || mesa.data().ocupada !== true)
        throw new ErroRecuperacao(409, "Esta mesa não está em atendimento.");
      const atualRef = mesa.data().chamadoAutoId
        ? db.collection("chamadosMesa").doc(mesa.data().chamadoAutoId)
        : null;
      const atual = atualRef ? await t.get(atualRef) : null;
      if (
        atual?.exists &&
        atual.data().status === "aberto" &&
        diaPedido(atual.data().criadoEmMs) === diaPedido(agora())
      )
        return { repetido: true, tipo: atual.data().tipo };
      const em = agora();
      t.set(novo, {
        mesaId: ref.id,
        mesaNumero: d.mesa,
        sessaoAutoatendimentoId: v?.sessao.id || null,
        comandaId: v?.sessao.comandaId || null,
        cliente: v?.sessao.nome || "Cliente da mesa",
        tipo: d.tipo,
        origem: "autoatendimento",
        status: "aberto",
        criadoEm: new Date(em).toISOString(),
        criadoEmMs: em,
      });
      t.update(ref, { chamadoAutoId: novo.id });
      return { repetido: false, tipo: d.tipo };
    });
  }
  return { origem: pedidos.origem, estado, iniciar, retomar, enviar, vincular, chamar };
}
module.exports = { criarServicoMesaPublica };
