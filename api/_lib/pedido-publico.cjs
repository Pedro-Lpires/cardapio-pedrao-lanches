const {
  horarioNoturnoEntregaUI,
  taxaEntregaRegraUI,
  validarMinimoEntregaUI,
} = require("../../js/regras-entrega.js");
const crypto = require("node:crypto");
const { ErroRecuperacao } = require("./recuperacao-acesso.cjs");
const { ORIGEM_ENTREGA } = require("./frete-rota.cjs");
const { reconstruirItensPedido, moeda, texto } = require("./pedido-catalogo.cjs");
const { competenciaRankMensalUI, nivelRankMensalUI } = require("../../js/rank-mensal.js");
const { resolverCupomRankUI, calcularCupomRankUI } = require("../../js/cupons-rank.js");
const { sincronizarRankClienteServidor } = require("./rank-cliente.cjs");
const {
  configurarBeneficiosEntregaUI,
  calcularBeneficioEntregaUI,
  alterarSaldoBeneficioEntregaUI,
} = require("../../js/beneficios-entrega.js");
const centavos = (v) => moeda(v ?? 0);
const hash = (v) => crypto.createHash("sha256").update(v).digest("hex");
function assinaturaPedido(entrada) {
  const ordenar = (v) =>
    Array.isArray(v)
      ? v.map(ordenar)
      : v && typeof v === "object"
        ? Object.fromEntries(
            Object.keys(v)
              .sort()
              .filter((k) => v[k] !== undefined)
              .map((k) => [k, ordenar(v[k])]),
          )
        : v;
  const campos = [
    "tipo",
    "nome",
    "telefone",
    "itens",
    "localizacao",
    "endereco",
    "condominio",
    "cnh",
    "observacao",
    "pagamento",
    "trocoPara",
    "cupomDescontoCodigo",
    "descontoFidelidade",
    "areaUrbanaConfirmada",
  ];
  return hash(
    JSON.stringify(
      ordenar(
        Object.fromEntries(
          campos.filter((k) => entrada[k] !== undefined).map((k) => [k, entrada[k]]),
        ),
      ),
    ),
  );
}
function pontoPedido(valor) {
  let url;
  try {
    url = new URL(valor);
  } catch {
    throw new ErroRecuperacao(400, "Confira a localização da entrega.");
  }
  const ponto = url.searchParams.get("p") || url.searchParams.get("q") || "";
  const m = ponto.match(/^(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)$/);
  if (!m || Math.abs(Number(m[1])) > 90 || Math.abs(Number(m[2])) > 180)
    throw new ErroRecuperacao(400, "Confira a localização da entrega.");
  return { latitude: Number(m[1]), longitude: Number(m[2]) };
}
function distanciaPedido(ponto) {
  const rad = (v) => (v * Math.PI) / 180;
  const a =
    Math.sin(rad(ponto.latitude - ORIGEM_ENTREGA.latitude) / 2) ** 2 +
    Math.cos(rad(ORIGEM_ENTREGA.latitude)) *
      Math.cos(rad(ponto.latitude)) *
      Math.sin(rad(ponto.longitude - ORIGEM_ENTREGA.longitude) / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
}
function taxaPedido(km, em) {
  return taxaEntregaRegraUI(km, em);
}
function pontoEntrega(entrada) {
  if (entrada?.areaUrbanaConfirmada !== true)
    throw new ErroRecuperacao(400, "Confirme se sua localidade é atendida.");
  return pontoPedido(entrada.localizacao);
}
function validarAlcanceEntrega(km) {
  if (km > 200) throw new ErroRecuperacao(400, "Localização muito distante. Confira com a loja.");
}
function taxaEntregaSegura(km, em) {
  validarAlcanceEntrega(km);
  try {
    return taxaPedido(km, em);
  } catch (e) {
    throw new ErroRecuperacao(400, e.message);
  }
}
function diaPedido(em) {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Cuiaba",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(em - 2 * 3600000));
  return ["year", "month", "day"].map((v) => partes.find((p) => p.type === v).value).join("-");
}
function criarServicoPedidoPublico({
  db,
  auth,
  siteUrl,
  consumirTentativa = async () => {},
  agora = Date.now,
  rotasEntrega,
}) {
  const site = new URL(siteUrl);
  if (
    site.protocol !== "https:" ||
    site.pathname !== "/" ||
    site.username ||
    site.password ||
    site.search ||
    site.hash
  )
    throw Error("Configure a origem HTTPS do site.");
  async function identidade(authorization) {
    if (!authorization) return null;
    try {
      if (!/^Bearer [^\s]+$/.test(authorization)) throw Error();
      const token = await auth.verifyIdToken(authorization.slice(7), true);
      if (token.acessoCliente !== true || !/^[1-9]\d9\d{8}$/.test(token.clienteId || ""))
        throw Error();
      const usuario = await auth.getUser(token.uid);
      if (usuario.disabled || usuario.phoneNumber !== "+55" + token.clienteId) throw Error();
      return {
        uid: token.uid,
        clienteId: token.clienteId,
        historicoLegadoVerificado: token.historicoLegadoVerificado === true,
      };
    } catch {
      throw new ErroRecuperacao(401, "Entre novamente na sua conta antes de enviar o pedido.");
    }
  }
  async function referenciasCatalogo(itens) {
    if (!Array.isArray(itens) || itens.length < 1 || itens.length > 50)
      throw new ErroRecuperacao(400, "Confira os itens do pedido.");
    const refs = new Map(),
      buscas = new Map();
    async function incluir(colecao, id, nome) {
      if (id != null && (typeof id !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(id)))
        throw new ErroRecuperacao(400, "Identificador de item inválido.");
      if (!id) {
        nome = texto(nome, 150).replace(/\s*\((artesanal|industrial|frango|fil[eé])\)$/i, "");
        const busca = colecao + "/" + nome;
        if (!buscas.has(busca))
          buscas.set(busca, db.collection(colecao).where("nome", "==", nome).limit(2).get());
        const encontrados = await buscas.get(busca);
        if (encontrados.docs.length !== 1)
          throw new ErroRecuperacao(409, "Um item mudou. Reabra o carrinho.");
        id = encontrados.docs[0].id;
      }
      refs.set(colecao + "/" + id, db.collection(colecao).doc(id));
      if (refs.size > 100) throw new ErroRecuperacao(400, "Pedido muito grande. Fale com a loja.");
    }
    for (const i of itens) {
      if (!i || typeof i !== "object") throw new ErroRecuperacao(400, "Item inválido.");
      await incluir("produtos", i.produtoId, i.nome);
      const lanches = i.lanchesCombo || [];
      if (!Array.isArray(lanches) || lanches.length > 20)
        throw new ErroRecuperacao(400, "Confira os lanches do combo.");
      if (lanches.some((l) => !l || typeof l !== "object"))
        throw new ErroRecuperacao(400, "Confira os lanches do combo.");
      const listas = [i.adicionais || [], ...lanches.map((l) => l.adicionais || [])];
      for (const lista of listas) {
        if (!Array.isArray(lista) || lista.length > 30)
          throw new ErroRecuperacao(400, "Confira os acréscimos.");
        for (const a of lista) {
          if (!a || typeof a !== "object") throw new ErroRecuperacao(400, "Acréscimo inválido.");
          await incluir("adicionais", a.id, a.nome);
        }
      }
    }
    return [...refs.values()];
  }
  async function numerosExistentes(dia, entrega) {
    const ref = db
      .collection("config")
      .doc((entrega ? "contadorEntregas_" : "contadorPedidos_") + dia);
    if ((await ref.get()).exists) return 0;
    // Faz a transição sem repetir números dos pedidos já criados pelo site anterior.
    const inicio = Date.parse(dia + "T06:00:00Z");
    const [marcados, porData] = await Promise.all([
      db.collection("pedidos").where("diaOperacional", "==", dia).get(),
      db
        .collection("pedidos")
        .where("dataMs", ">=", inicio)
        .where("dataMs", "<", inicio + 86400000)
        .get(),
    ]);
    const docs = [
      ...new Map([...marcados.docs, ...porData.docs].map((d) => [d.id, d.data()])).values(),
    ]
      .filter((p) => !entrega || p.tipo === "Entrega")
      .sort(
        (a, b) => Number(a.dataMs || Date.parse(a.data)) - Number(b.dataMs || Date.parse(b.data)),
      );
    return docs.reduce(
      (n, p, i) =>
        Math.max(n, Number((entrega ? p.numeroEntregaDia : (p.numeroDia ?? p.numero)) || i + 1)),
      0,
    );
  }
  async function processar({ pedido: entrada, authorization, chave, gravar = false, origemRede }) {
    if (
      !entrada ||
      typeof entrada !== "object" ||
      !["Entrega", "Retirada", "Local"].includes(entrada.tipo)
    )
      throw new ErroRecuperacao(400, "Escolha o tipo de pedido.");
    if (gravar && (typeof chave !== "string" || !/^[A-Za-z0-9_-]{32,128}$/.test(chave)))
      throw new ErroRecuperacao(400, "Reabra a confirmação do pedido.");
    const pessoa = await identidade(authorization),
      em = agora();
    await consumirTentativa({ origemRede, clienteId: pessoa?.clienteId, gravar, em });
    const assinatura = gravar ? assinaturaPedido(entrada) : null;
    const referencias = await referenciasCatalogo(entrada.itens),
      local = entrada.tipo === "Local";
    const codigo = texto(entrada.cupomDescontoCodigo, 60).toUpperCase();
    if (codigo && !/^[A-Z0-9_-]{1,60}$/.test(codigo))
      throw new ErroRecuperacao(400, "Código do cupom inválido.");
    const dia = diaPedido(em),
      id = gravar ? "web_" + hash(chave) : null;
    const iniciais = gravar
      ? await Promise.all([
          numerosExistentes(dia, false),
          entrada.tipo === "Entrega" ? numerosExistentes(dia, true) : 0,
        ])
      : [0, 0];
    const pr = id ? db.collection("pedidos").doc(id) : null;
    const cr = pessoa ? db.collection("clientes").doc(pessoa.clienteId) : null;
    return db.runTransaction(async (t) => {
      if (pr) {
        const anterior = await t.get(pr);
        if (anterior.exists) {
          const p = anterior.data();
          if ((p.clienteAuthUid || null) !== (pessoa?.uid || null))
            throw new ErroRecuperacao(403, "Envio vinculado a outra sessão.");
          if (p.assinaturaCheckout !== assinatura)
            throw new ErroRecuperacao(
              409,
              "Esta confirmação já foi usada para outro pedido. Reabra o carrinho.",
            );
          return { pedido: p, repetido: true };
        }
      }
      const [loja, dadosCatalogo] = await Promise.all([
        t.get(db.collection("config").doc("loja")),
        Promise.all(referencias.map((r) => t.get(r))),
      ]);
      if (loja.exists && loja.data().aberta === false)
        throw new ErroRecuperacao(
          409,
          "A loja fechou antes da confirmação. Seu pedido não foi enviado.",
        );
      const catalogo = (tipo) =>
        dadosCatalogo
          .filter((d) => d.exists && d.ref.path.startsWith(tipo + "/"))
          .map((d) => ({ ...d.data(), id: d.id }));
      const itens = reconstruirItensPedido(
        entrada.itens,
        catalogo("produtos"),
        catalogo("adicionais"),
        { local },
      );
      const clienteDoc = cr ? await t.get(cr) : null,
        cliente = clienteDoc?.exists ? clienteDoc.data() : null;
      if (pessoa && cliente?.authUid !== pessoa.uid)
        throw new ErroRecuperacao(403, "Não foi possível conferir a conta deste pedido.");
      const nome = texto(entrada.nome || cliente?.nome, 100) || (!gravar ? "Cliente" : "");
      if (!/^[\p{L}\p{M}\p{N} .'-]{2,100}$/u.test(nome))
        throw new ErroRecuperacao(400, "Informe seu nome.");
      const telefone = String(
        entrada.telefone || (!gravar ? pessoa?.clienteId || "11900000000" : ""),
      ).replace(/\D/g, "");
      if (!/^[1-9]\d9\d{8}$/.test(telefone))
        throw new ErroRecuperacao(400, "Informe seu celular completo com DDD.");
      const base = itens.reduce((s, i) => s + centavos(i.subtotal), 0),
        molhos = itens.reduce((s, i) => s + centavos(i.totalMolhosPagos), 0);
      let taxa = 0,
        km = 0,
        localizacao = "",
        endereco = "";
      if (entrada.tipo === "Entrega") {
        const ponto = pontoEntrega(entrada);
        km = rotasEntrega
          ? rotasEntrega.conferir(ponto, entrada.cotacaoFrete, em)
          : distanciaPedido(ponto);
        taxa = centavos(taxaEntregaSegura(km, em));
        const destino = new URL("/localizacao.html", site);
        destino.searchParams.set("p", ponto.latitude + "," + ponto.longitude);
        localizacao = destino.href;
        endereco = texto(entrada.endereco, 1500);
      }
      let descontoCupom = 0,
        descontoCupomTaxa = 0,
        cupom = null,
        cupomRef = null,
        vinculoCupom = null,
        vinculoRef = null;
      if (codigo && !local) {
        cupomRef = db.collection("cuponsDesconto").doc(codigo);
        const doc = await t.get(cupomRef);
        const c = doc.exists ? doc.data() : null;
        if (cr) {
          vinculoRef = cr.collection("cupons").doc(codigo);
          const vinculo = await t.get(vinculoRef);
          vinculoCupom = vinculo.exists ? vinculo.data() : null;
        }
        if (
          !c ||
          c.ativo !== true ||
          c.usadoEm ||
          (vinculoCupom &&
            (vinculoCupom.ativo === false || !(Number(vinculoCupom.usosRestantes) > 0))) ||
          (c.clientesPermitidos && !c.clientesPermitidos.includes(pessoa?.clienteId || ""))
        )
          throw new ErroRecuperacao(409, "Cupom indisponível para este pedido ou esta conta.");
        try {
          cupom = resolverCupomRankUI(c, cliente, (c) => nivelRankMensalUI(c, em));
          descontoCupom = centavos(
            calcularCupomRankUI(cupom, { base: base / 100, taxa: taxa / 100, km, itens }).desconto,
          );
        } catch (e) {
          throw new ErroRecuperacao(409, e.message);
        }
        descontoCupomTaxa =
          cupom.tipo === "taxa"
            ? descontoCupom
            : ["pedido", "descontoGeral"].includes(cupom.tipo) && cupom.modo === "porcentagem"
              ? Math.min(descontoCupom, Math.round((taxa * Number(cupom.valor)) / 100))
              : 0;
      }
      const descontoFidelidade = local ? 0 : centavos(entrada.descontoFidelidade);
      if (
        descontoFidelidade &&
        (!cliente?.fidelidadeAtiva ||
          descontoFidelidade !== 1000 ||
          centavos(cliente.bonusDisponivel) < descontoFidelidade ||
          base + molhos - descontoCupom + descontoCupomTaxa < descontoFidelidade)
      )
        throw new ErroRecuperacao(409, "Seu bônus mudou. Confira o pedido novamente.");
      const cfgDoc = await t.get(db.collection("config").doc("beneficios")),
        config = configurarBeneficiosEntregaUI(cfgDoc.exists ? cfgDoc.data() : {});
      if (entrada.tipo === "Entrega") {
        try {
          validarMinimoEntregaUI(
            km,
            (base + molhos - descontoCupom + descontoCupomTaxa - descontoFidelidade) / 100,
          );
        } catch (e) {
          throw new ErroRecuperacao(400, e.message);
        }
      }
      const parcial = {
        tipo: entrada.tipo,
        clienteId: pessoa?.clienteId || null,
        itens,
        taxaEntrega: taxa / 100,
        descontoCupom: descontoCupom / 100,
        descontoCupomTaxa: descontoCupomTaxa / 100,
        descontoFidelidade: descontoFidelidade / 100,
      };
      const beneficio = calcularBeneficioEntregaUI(cliente, config, parcial, em, {
        competencia: competenciaRankMensalUI,
        nivel: (c) => nivelRankMensalUI(c, em),
        centavos,
        base: (p) => p.itens.reduce((s, i) => s + i.subtotal + i.totalMolhosPagos, 0),
        moeda: (v) => Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
      });
      const total = Math.floor(
        (Math.max(
          0,
          base + molhos + taxa - descontoCupom - descontoFidelidade - beneficio.centavos,
        ) +
          70) /
          100,
      );
      const pagamento = local ? "Pendente" : texto(entrada.pagamento, 100);
      if (
        !local &&
        (!pagamento ||
          !pagamento
            .split(/\s*\+\s*/)
            .every((p) => ["Pix", "Cartão", "Dinheiro", "Débito", "Crédito"].includes(p)))
      )
        throw new ErroRecuperacao(400, "Escolha uma forma de pagamento.");
      const pedido = {
        ...parcial,
        nome,
        telefone,
        telefoneLimpo: telefone,
        clienteAuthUid: pessoa?.uid || null,
        origem: "site_delivery",
        checkoutProtegido: 1,
        valorTotal: total,
        valorAntesDesconto: (base + molhos + taxa) / 100,
        distanciaKm: km,
        adicionalNoturno: entrada.tipo === "Entrega" && horarioNoturnoEntregaUI(em),
        localizacao,
        endereco,
        condominio: entrada.tipo === "Entrega" && entrada.condominio === "Sim" ? "Sim" : "Não",
        cnh:
          entrada.tipo === "Entrega" && entrada.condominio === "Sim" && entrada.cnh === "Sim"
            ? "Sim"
            : "Não",
        areaUrbanaConfirmada: entrada.tipo === "Entrega" ? true : null,
        observacao: texto(entrada.observacao, 1500),
        pagamento,
        trocoPara:
          !local && pagamento.includes("Dinheiro") && entrada.trocoPara != null
            ? centavos(entrada.trocoPara) / 100
            : null,
        descontoCreditoEntrega: beneficio.centavos / 100,
        ...(beneficio.centavos ? { creditoEntregaMes: beneficio.mes } : {}),
        cupomDescontoCodigo: cupom ? codigo : "",
        cupomDescontoNome: cupom?.nome || "",
        fidelidadeAtivaNoPedido: cliente?.fidelidadeAtiva === true,
        codigoCliente: cliente?.codigoAtivacao || "",
        data: new Date(em).toISOString(),
        dataMs: em,
        cancelado: false,
        pagamentoConfirmado: false,
        valorPago: 0,
      };
      if (!gravar)
        return {
          pedido,
          cupom: cupom
            ? {
                codigo,
                nome: cupom.nome || "",
                tipo: cupom.tipo,
                modo: cupom.modo,
                valor: cupom.valor ?? 0,
                rankAplicado: cupom.rankAplicado || null,
              }
            : null,
        };
      if (
        centavos(entrada.valorTotal) !== centavos(total) ||
        centavos(entrada.taxaEntrega) !== taxa ||
        centavos(entrada.descontoCupom) !== descontoCupom ||
        centavos(entrada.descontoCreditoEntrega) !== beneficio.centavos
      )
        throw new ErroRecuperacao(
          409,
          "Os valores do pedido mudaram. Volte à revisão antes de confirmar.",
        );
      const contadorRef = db.collection("config").doc("contadorPedidos_" + dia),
        entregaRef = db.collection("config").doc("contadorEntregas_" + dia);
      const contador = await t.get(contadorRef),
        contadorEntrega = entrada.tipo === "Entrega" ? await t.get(entregaRef) : null;
      const anteriorNumero = contador.exists ? contador.data().ultimoNumero : iniciais[0];
      const anteriorEntrega = contadorEntrega?.exists
        ? contadorEntrega.data().ultimoNumero
        : iniciais[1];
      if (
        ![anteriorNumero, anteriorEntrega].every(
          (n) => Number.isSafeInteger(n) && n >= 0 && n < 1000000,
        )
      )
        throw new ErroRecuperacao(409, "A numeração precisa ser conferida pela loja.");
      const numero = anteriorNumero + 1;
      Object.assign(pedido, {
        id,
        assinaturaCheckout: assinatura,
        numero,
        numeroDia: numero,
        diaOperacional: dia,
        beneficiosPerfil: {
          regra: 3,
          baseFidelidade: 0,
          bonusUsado: 0,
          bonusGerado: 0,
          pedidoContado: false,
          gastoTotal: 0,
        },
      });
      if (descontoFidelidade)
        pedido.fidelidadeReserva = {
          centavos: descontoFidelidade,
          status: "reservado",
          reservadoEm: em,
        };
      const patchCliente = {};
      if (descontoFidelidade)
        patchCliente.bonusDisponivel =
          (centavos(cliente.bonusDisponivel) - descontoFidelidade) / 100;
      if (beneficio.centavos) {
        patchCliente.beneficiosEntrega = alterarSaldoBeneficioEntregaUI(
          cliente,
          beneficio.mes,
          beneficio.centavos,
          0,
          beneficio.limite,
        );
        pedido.creditoEntrega = {
          mes: beneficio.mes,
          centavos: beneficio.centavos,
          status: "reservado",
          reservadoEm: em,
        };
      }
      if (entrada.tipo === "Entrega") {
        pedido.numeroEntregaDia = anteriorEntrega + 1;
        t.set(entregaRef, { ultimoNumero: pedido.numeroEntregaDia });
      }
      t.set(contadorRef, { ultimoNumero: numero });
      if (Object.keys(patchCliente).length) t.update(cr, patchCliente);
      if (cupom?.uso === "unico")
        t.update(cupomRef, {
          ativo: false,
          usadoEm: em,
          usadoPor: pessoa?.clienteId || "",
          origemUso: pr.path,
        });
      if (vinculoCupom)
        t.update(vinculoRef, {
          usosRestantes: Number(vinculoCupom.usosRestantes) - 1,
          ultimoUsoEm: em,
        });
      t.set(pr, pedido);
      return { pedido, repetido: false };
    });
  }
  async function titular(dados) {
    const pessoa = await identidade(dados.authorization);
    if (!pessoa) throw new ErroRecuperacao(401, "Entre na sua conta para continuar.");
    await consumirTentativa({
      origemRede: dados.origemRede,
      clienteId: pessoa.clienteId,
      em: agora(),
    });
    const doc = await db.collection("clientes").doc(pessoa.clienteId).get();
    if (!doc.exists || doc.data().authUid !== pessoa.uid)
      throw new ErroRecuperacao(403, "Confira o vínculo da sua conta antes de continuar.");
    return pessoa;
  }
  async function perfil(dados) {
    const pessoa = await titular(dados);
    const cliente = await sincronizarRankClienteServidor({ db, pessoa, em: agora() });
    return { cliente: { ...cliente, historicoLegadoVerificado: pessoa.historicoLegadoVerificado } };
  }
  async function recuperar(dados) {
    if (typeof dados.chave !== "string" || !/^[A-Za-z0-9_-]{32,128}$/.test(dados.chave))
      throw new ErroRecuperacao(400, "Confirmação inválida.");
    const pessoa = await identidade(dados.authorization);
    await consumirTentativa({
      origemRede: dados.origemRede,
      clienteId: pessoa?.clienteId,
      em: agora(),
    });
    const doc = await db
      .collection("pedidos")
      .doc("web_" + hash(dados.chave))
      .get();
    if (!doc.exists) return { pedido: null };
    if ((doc.data().clienteAuthUid || null) !== (pessoa?.uid || null))
      throw new ErroRecuperacao(403, "Confirmação vinculada a outra conta.");
    return { pedido: doc.data(), repetido: true };
  }
  async function cupons(dados) {
    const pessoa = await titular(dados),
      cliente = await sincronizarRankClienteServidor({ db, pessoa, em: agora() });
    const ref = db.collection("clientes").doc(pessoa.clienteId);
    const [vinculos, mensagens] = await Promise.all([
      ref.collection("cupons").get(),
      ref.collection("mensagens").where("remetente", "==", "admin").get(),
    ]);
    const codigos = new Map();
    for (const m of mensagens.docs)
      if (typeof m.data().cupomCodigo === "string") codigos.set(m.data().cupomCodigo, null);
    for (const v of vinculos.docs) codigos.set(v.data().codigo || v.id, v.data());
    const disponiveis = [];
    for (const [codigo, vinculo] of codigos) {
      if (
        !/^[A-Z0-9_-]{1,60}$/.test(codigo) ||
        (vinculo && (vinculo.ativo === false || !(Number(vinculo.usosRestantes) > 0)))
      )
        continue;
      const doc = await db.collection("cuponsDesconto").doc(codigo).get();
      const c = doc.exists ? doc.data() : null;
      if (
        !c ||
        !c.ativo ||
        c.usadoEm ||
        (c.clientesPermitidos && !c.clientesPermitidos.includes(pessoa.clienteId))
      )
        continue;
      try {
        const efetivo = resolverCupomRankUI(c, cliente, (c) => nivelRankMensalUI(c, agora()));
        const campos = [
          "nome",
          "tipo",
          "modo",
          "valor",
          "itemNome",
          "itemGeral",
          "itemGeralTipo",
          "itemGeralModo",
          "itemGeralValor",
          "itemPrecoPromocional",
          "kmGratis",
          "temPedidoMinimo",
          "pedidoMinimo",
          "uso",
          "rankAplicado",
          "percentualRankAplicado",
        ];
        disponiveis.push({
          ...Object.fromEntries(
            campos.filter((k) => efetivo[k] !== undefined).map((k) => [k, efetivo[k]]),
          ),
          codigo,
          usosRestantes: vinculo ? Number(vinculo.usosRestantes) : c.uso === "unico" ? 1 : null,
        });
      } catch {
        /* Cupom de outro rank não aparece como disponível. */
      }
    }
    return { cupons: disponiveis };
  }
  async function ativar(dados) {
    const pessoa = await titular(dados);
    if (typeof dados.codigo !== "string" || !/^\d{4}$/.test(dados.codigo))
      throw new ErroRecuperacao(400, "Informe os quatro números do seu CDA.");
    return db.runTransaction(async (t) => {
      const ref = db.collection("clientes").doc(pessoa.clienteId),
        doc = await t.get(ref),
        c = doc.exists ? doc.data() : null;
      if (!c || c.authUid !== pessoa.uid)
        throw new ErroRecuperacao(403, "Confira sua conta antes de ativar.");
      if (c.codigoAtivacao !== dados.codigo)
        throw new ErroRecuperacao(409, "Código não existe ou você digitou errado!");
      if (c.fidelidadeAtiva === true) return { ativado: false };
      t.update(ref, {
        fidelidadeAtiva: true,
        nivelCliente: nivelRankMensalUI({ ...c, fidelidadeAtiva: true }, agora()),
        ativadoEm: new Date(agora()).toISOString(),
      });
      return { ativado: true };
    });
  }
  function idSuporte(v) {
    if (typeof v !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(v))
      throw new ErroRecuperacao(400, "Suporte inválido.");
    return v;
  }
  async function suporte(dados) {
    const pessoa = await titular(dados),
      em = agora(),
      mensagem = texto(dados.texto, 4000);
    if (!mensagem || !["reclamacao", "feedback", "outros"].includes(dados.categoria))
      throw new ErroRecuperacao(400, "Escolha o tipo e escreva sua mensagem.");
    if (!/^[A-Za-z0-9_-]{32,128}$/.test(dados.chave || ""))
      throw new ErroRecuperacao(400, "Reabra o formulário de suporte.");
    const caminho = dados.referenciaPedido || "";
    if (caminho && !/^(pedidos|historicoPagamentosClientes)\/[A-Za-z0-9_-]{1,128}$/.test(caminho))
      throw new ErroRecuperacao(400, "Selecione um pedido do seu histórico.");
    const cr = db.collection("clientes").doc(pessoa.clienteId),
      id = "s_" + hash(pessoa.uid + dados.chave);
    const ref = cr.collection("chamados").doc(id),
      assinatura = hash(JSON.stringify([mensagem, dados.categoria, caminho]));
    return db.runTransaction(async (t) => {
      const [cd, anterior] = await Promise.all([t.get(cr), t.get(ref)]);
      if (!cd.exists || cd.data().authUid !== pessoa.uid)
        throw new ErroRecuperacao(403, "Entre novamente na sua conta.");
      if (anterior.exists) {
        if (anterior.data().assinaturaCriacao !== assinatura)
          throw new ErroRecuperacao(409, "Esta confirmação já criou outro suporte.");
        return { id, repetido: true };
      }
      if (caminho) {
        const [colecao, pedidoId] = caminho.split("/"),
          doc = await t.get(db.collection(colecao).doc(pedidoId));
        if (
          !doc.exists ||
          !(
            doc.data().clienteAuthUid === pessoa.uid ||
            (pessoa.historicoLegadoVerificado && doc.data().clienteId === pessoa.clienteId)
          )
        )
          throw new ErroRecuperacao(403, "Pedido não encontrado nesta conta.");
      }
      const c = cd.data(),
        data = new Date(em).toISOString();
      t.set(ref, {
        categoria: dados.categoria,
        status: "aberto",
        possuiPedidoRelacionado: !!caminho,
        pedidoRelacionadoId: caminho.split("/")[1] || "",
        pedidoRelacionadoColecao: caminho.split("/")[0] || "",
        clienteNome: c.nome,
        clienteTelefone: pessoa.clienteId,
        clienteAvatar: c.avatar || "images/avatares/sem-rank/maionese.webp",
        criadoEm: data,
        atualizadoEm: data,
        assinaturaCriacao: assinatura,
      });
      t.set(ref.collection("mensagens").doc("inicial"), {
        texto: mensagem,
        remetente: "cliente",
        data,
        lida: false,
      });
      return { id, repetido: false };
    });
  }
  async function responderSuporte(dados) {
    const pessoa = await titular(dados),
      mensagem = texto(dados.texto, 4000);
    if (!mensagem || !/^[A-Za-z0-9_-]{32,128}$/.test(dados.chave || ""))
      throw new ErroRecuperacao(400, "Confira sua mensagem.");
    const ref = db
      .collection("clientes")
      .doc(pessoa.clienteId)
      .collection("chamados")
      .doc(idSuporte(dados.chamadoId));
    const mr = ref.collection("mensagens").doc("m_" + hash(dados.chave));
    return db.runTransaction(async (t) => {
      const [d, m] = await Promise.all([t.get(ref), t.get(mr)]);
      if (!d.exists || d.data().status === "finalizado")
        throw new ErroRecuperacao(409, "Este suporte já foi finalizado.");
      if (m.exists) {
        if (m.data().texto !== mensagem)
          throw new ErroRecuperacao(409, "Esta confirmação já enviou outra mensagem.");
        return { repetido: true };
      }
      const data = new Date(agora()).toISOString();
      t.set(mr, { texto: mensagem, remetente: "cliente", data, lida: false });
      t.update(ref, { atualizadoEm: data });
      return { repetido: false };
    });
  }
  async function encerrarSuporte(dados) {
    const pessoa = await titular(dados),
      ref = db
        .collection("clientes")
        .doc(pessoa.clienteId)
        .collection("chamados")
        .doc(idSuporte(dados.chamadoId));
    return db.runTransaction(async (t) => {
      const d = await t.get(ref);
      if (!d.exists) throw new ErroRecuperacao(404, "Suporte não encontrado.");
      if (d.data().status === "finalizado") return { encerrado: true };
      const data = new Date(agora()).toISOString();
      t.update(ref, {
        status: "finalizado",
        finalizadoPor: "cliente",
        finalizadoEm: data,
        atualizadoEm: data,
      });
      return { encerrado: true };
    });
  }
  return {
    origem: site.origin,
    perfil,
    recuperar,
    cupons,
    ativar,
    suporte,
    responderSuporte,
    encerrarSuporte,
    numeracaoInicial: (dia) => numerosExistentes(dia, false),
    async prepararItens(entradas) {
      const refs = await referenciasCatalogo(entradas);
      return async (t) => {
        const docs = await Promise.all(refs.map((r) => t.get(r)));
        const catalogo = (colecao) =>
          docs
            .filter((d) => d.exists && d.ref.path.startsWith(colecao + "/"))
            .map((d) => ({ ...d.data(), id: d.id }));
        return reconstruirItensPedido(entradas, catalogo("produtos"), catalogo("adicionais"), {
          local: true,
        });
      };
    },
    conferir: (dados) => processar({ ...dados, gravar: false }),
    salvar: (dados) => processar({ ...dados, gravar: true }),
    async frete({ pedido, origemRede }) {
      if (!rotasEntrega) throw new ErroRecuperacao(503, "O cálculo por rota está indisponível.");
      const ponto = pontoEntrega(pedido);
      validarAlcanceEntrega(distanciaPedido(ponto));
      const em = agora();
      await consumirTentativa({ origemRede, em });
      const cotacao = await rotasEntrega.cotar(ponto, em);
      return { frete: { ...cotacao, taxaEntrega: taxaEntregaSegura(cotacao.distanciaKm, em) } };
    },
  };
}
module.exports = { criarServicoPedidoPublico, pontoPedido, distanciaPedido, taxaPedido, diaPedido };
