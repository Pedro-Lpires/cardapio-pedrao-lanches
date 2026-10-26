/* Fixture exclusivamente local: nunca carregar em uma página de produção. */
(() => {
  const modoMonitorFixture = document.currentScript.src.includes("modo=monitor");
  const parametrosFixture = new URL(document.currentScript.src).searchParams;
  const mesaFixture = parametrosFixture.get("mesa") || "2";
  const cenarioFixture = parametrosFixture.get("cenario");
  const DataReal = Date;
  const horarioTeste = new DataReal();
  horarioTeste.setHours(20, 0, 0, 0);
  window.Date = class extends DataReal {
    constructor(...args) {
      super(...(args.length ? args : [horarioTeste.getTime()]));
    }
    static now() {
      return DataReal.now();
    }
  };
  const clone = (x) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));
  const agora = Date.now(),
    cliente = "65999999999";
  const docs = new Map(
    Object.entries({
      "config/admin": { senhaMestre: "teste1234", senhaFinanceiro: "teste1234" },
      "config/loja": { aberta: true },
      "cuponsDesconto/COCA200": {
        codigo: "COCA200",
        nome: "Coca 2L acima de R$ 200",
        ativo: true,
        tipo: "item",
        pedidoMinimo: 200,
      },
      "mesas/mesa1": { numero: 1, status: "Ocupada", ativa: true },
      "mesas/mesa2": { numero: 2, status: "Livre", ativa: true },
      ["clientes/" + cliente]: {
        nome: "Rafa Teste",
        telefone: cliente,
        nivelCliente: "Prata",
        codigoAtivacao: "PRATA-TESTE",
        fidelidadeAtiva: true,
        bonusDisponivel: 20,
        totalGasto: 100,
        avatar: "images/avatar1.webp",
        enderecos: [
          {
            nome: "Casa",
            rua: "Rua das Orquídeas",
            numero: "6",
            bairro: "Centro",
            complemento: "Portão marrom",
            enderecoCompleto: "Rua das Orquídeas, nº 6 - Centro",
          },
        ],
      },
      ["clientes/" + cliente + "/chamados/suporte1"]: {
        categoria: "reclamacao",
        status: "aberto",
        clienteNome: "Rafa Teste",
        clienteTelefone: cliente,
        clienteAvatar: "images/avatar1.webp",
        criadoEm: new Date(agora).toISOString(),
        possuiPedidoRelacionado: true,
        pedidoRelacionadoId: "entrega1",
        pedidoRelacionadoColecao: "pedidos",
      },
      ["clientes/" + cliente + "/chamados/suporte1/mensagens/m1"]: {
        remetente: "cliente",
        texto: "Quero conferir os itens do meu pedido.",
        data: new Date(agora).toISOString(),
        lida: false,
      },
      "comandas/comanda1": {
        mesa: 1,
        cliente: "Rafa Teste",
        clienteId: cliente,
        status: "Aberta",
        valorTotal: 55,
        valorPago: 15,
        itens: [
          {
            produtoId: "lanche1",
            nome: "Lanche teste 1",
            categoria: "lanches",
            quantidade: 2,
            preco: 25,
            subtotal: 50,
          },
          {
            produtoId: "bebida1",
            nome: "Bebida teste 1",
            categoria: "bebidas",
            quantidade: 1,
            preco: 5,
            subtotal: 5,
          },
        ],
        pagamentos: [
          {
            id: "parcial1",
            modo: "valor",
            valorPago: 15,
            valorQuitado: 15,
            valor: 15,
            pagoEm: agora,
            formas: [{ forma: "Pix", valor: 15 }],
          },
        ],
      },
      "pedidos/entrega1": {
        numero: 1,
        nome: "Cliente de entrega",
        clienteId: cliente,
        tipo: "Entrega",
        dataMs: agora,
        data: new Date().toISOString(),
        valorTotal: 35,
        taxaEntrega: 10,
        itens: [
          {
            produtoId: "lanche1",
            nome: "Lanche teste 1",
            categoria: "lanches",
            quantidade: 1,
            preco: 25,
            subtotal: 25,
          },
        ],
        pagamentoConfirmado: true,
        pagamentoConfirmadoEm: agora,
        pagamento: "Pix",
      },
      "pedidos/retirada1": {
        numero: 2,
        nome: "Cliente de retirada",
        tipo: "Retirada",
        dataMs: agora,
        data: new Date().toISOString(),
        valorTotal: 25,
        itens: [
          { nome: "Lanche teste 2", categoria: "lanches", quantidade: 1, preco: 25, subtotal: 25 },
        ],
      },
    }),
  );
  if (cenarioFixture === "cda-inativo") {
    docs.get("clientes/" + cliente).fidelidadeAtiva = false;
    docs.get("clientes/" + cliente).nivelCliente = "Sem nível";
  }
  if (cenarioFixture === "loja-fechada") docs.get("config/loja").aberta = false;
  if (cenarioFixture === "beneficios") {
    docs.set("clientes/65888888888", {
      nome: "Cliente Sem Prêmios",
      telefone: "65888888888",
      codigoAtivacao: "4321",
      fidelidadeAtiva: false,
      nivelCliente: "Sem nível",
    });
    docs.set("campanhasRaspadinhas/demo", {
      nome: "Presente do Pedrão",
      modo: "manual",
      publico: "todos",
      ativa: true,
      premio: "uma batata frita média",
      termos: "Use na próxima compra de pelo menos R$ 20.",
      minimoCompra: 100,
      minimoResgate: 20,
      validadeDias: 7,
      criadoEm: agora,
    });
    docs.get("clientes/" + cliente).nivelCliente = "Bronze";
    docs.set("chamadosMesa/teste-chamado", {
      mesaId: "mesa6",
      mesaNumero: 6,
      cliente: "Rafa Teste",
      tipo: "conta",
      status: "aberto",
      criadoEmMs: agora - 60000,
    });
    docs.set("clientes/" + cliente + "/mensagens/comunicado-teste", {
      tipo: "geral",
      remetente: "admin",
      texto: "Hoje tem novidade no Pedrão. Boa noite, Rafa!",
      data: new Date(agora).toISOString(),
      lida: false,
    });
    // Campanhas reais enviam /mensagens, sem criar um vínculo em /cupons.
    docs.set("clientes/" + cliente + "/chamados/suporte1/mensagens/m2", {
      remetente: "admin",
      texto: "Olá, Rafa! Vamos conferir seu pedido juntos.",
      data: new Date(agora + 1000).toISOString(),
      lida: false,
    });
  }
  for (const [cat, prefixo, preco, img] of [
    ["lanches", "lanche", 25, "lanche.png"],
    ["bebidas", "bebida", 5, "coca-lata.webp"],
    ["batatas", "batata", 15, "batata-frita-media-cortada.webp"],
    ["combos", "combo", 40, "3baguncinha.webp"],
  ])
    for (let i = 1; i <= 8; i++)
      docs.set("produtos/" + prefixo + i, {
        nome: prefixo[0].toUpperCase() + prefixo.slice(1) + " teste " + i,
        categoria: cat,
        preco,
        ativo: true,
        esgotado: false,
        ordem: i,
        imagem: img,
        descricao: "Descrição do produto para conferir a tela.",
        opcoes: { artesanal: true, industrial: true, frango: true },
        permiteAdicionais: true,
      });
  for (let i = 1; i <= 8; i++) docs.get("produtos/combo" + i).comboQtdLanches = 3;
  docs.get("produtos/lanche1").precoIndustrial = 18;
  docs.get("produtos/lanche8").esgotado = true;
  docs.set("adicionais/cheddar", { nome: "Cheddar", preco: 3, ativo: true, ordem: 3 });
  docs.set("adicionais/alface", { nome: "Alface", preco: 2, ativo: true, ordem: 1 });
  docs.set("adicionais/calabresa", { nome: "Calabresa", preco: 5, ativo: true, ordem: 2 });
  docs.set("adicionais/bacon", { nome: "Bacon", preco: 5, ativo: true, ordem: 4 });
  docs.set("adicionais/tomate", { nome: "Tomate", preco: 2, ativo: true, ordem: 5 });
  docs.set("adicionais/hamburguer", {
    nome: "Hambúrguer Caseiro",
    preco: 8,
    ativo: true,
    ordem: 6,
  });
  Object.assign(docs.get("pedidos/retirada1").itens[0], {
    molhosGratis: [{ unidade: 1, tipo: "doisiguais", texto: "2 Maionese" }],
    molhosPagos: [{ nome: "Barbecue", qtd: 2, preco: 2 }],
    totalMolhosPagos: 4,
  });
  docs.set("pedidos/entrega-antiga", {
    tipo: "Entrega",
    nome: "Pedido antigo · não deve aparecer",
    dataMs: agora - 60 * 86400000,
    valorTotal: 20,
    itens: [],
  });
  docs.set("raspadinhas/TESTERASPA", {
    codigo: "TESTERASPA",
    clienteId: cliente,
    clienteNome: "Rafa Teste",
    premio: "uma batata frita média",
    minimoResgate: 20,
    termos:
      "Na próxima compra de pelo menos R$ 20, apresente o código ao atendente.\nValidade: 7 dias.\nPrêmio de uso único.",
    status: "disponivel",
    criadoEm: agora,
    expiraEm: agora + 7 * 86400000,
  });
  docs.set("clientes/" + cliente + "/mensagens/raspa-teste", {
    tipo: "admin",
    remetente: "admin",
    texto: "Parabéns! Você ganhou uma raspadinha. Abra para descobrir seu prêmio.",
    raspadinhaId: "TESTERASPA",
    data: new Date(agora).toISOString(),
    lida: false,
  });
  docs.set("clientes/" + cliente + "/mensagens/cupom-teste", {
    tipo: "admin",
    remetente: "admin",
    texto:
      "Um presente para você.\nUse na sua próxima compra.\nCupom: COCA200. Confira as condições de uso do cupom.",
    cupomCodigo: "COCA200",
    campanhaId: "teste",
    finalidade: "cupom",
    data: new Date(agora).toISOString(),
    lida: false,
  });
  for (const [id, origemColecao, origemId, tipo, clienteNome, delta] of [
    ["entrega-fila", "pedidos", "entrega1", "Entrega", "Cliente de entrega", -2000],
    ["retirada-fila", "pedidos", "retirada1", "Retirada", "Cliente de retirada", -1000],
  ])
    docs.set("filaCozinha/" + id, {
      origemColecao,
      origemId,
      tipo,
      cliente: clienteNome,
      status: "aguardando",
      criadoEmMs: agora + delta,
      itens: clone(docs.get(origemColecao + "/" + origemId).itens),
    });
  docs.get("filaCozinha/entrega-fila").itens = [
    {
      nome: "Combo 3 X-Bagunça",
      categoria: "combos",
      quantidade: 1,
      descricao: "3 X-Bagunça + Refrigerante 1,5L + 1 Batata Grande",
      tipo: "industrial",
      modoPersonalizacaoCombo: "todos",
      lanchesCombo: [1, 2, 3].map((numero) => ({
        numero,
        adicionais: [
          { nome: "Hambúrguer Caseiro", qtd: 1 },
          { nome: "Cheddar", qtd: 1 },
        ],
      })),
    },
    { nome: "Coca 2L", categoria: "bebidas", quantidade: 1 },
  ];
  if (window.combosConferidosFixture) {
    docs.set("produtos/xtudo-real", {
      nome: "X-Tudo",
      categoria: "lanches",
      descricao:
        "Pão, hambúrguer artesanal, filé mignon, filé de frango, salsicha, calabresa, bacon, ovo, presunto, mussarela, alface, tomate, batata palha e milho verde",
      imagem: "x-tudo.webp",
      preco: 45,
      precoIndustrial: 43,
      opcoes: { artesanal: true, industrial: true },
      ativo: true,
      esgotado: false,
      permiteAdicionais: true,
      ordem: -2,
    });
    docs.set("produtos/burrito-real", {
      nome: "Burrito cuiabano",
      categoria: "lanches",
      descricao: "Pão, hambúrguer triturado, molho vermelho, alface, tomate, presunto e mussarela.",
      imagem: "burrito.webp",
      preco: 20,
      precoIndustrial: 18,
      precoFrango: 20,
      opcoes: { artesanal: true, industrial: true, frango: true },
      ativo: true,
      esgotado: false,
      permiteAdicionais: true,
      ordem: -1,
    });
    for (const [id, produto] of docs)
      if (id.startsWith("produtos/") && produto.categoria === "combos") docs.delete(id);
    window.combosConferidosFixture.forEach((combo, n) =>
      docs.set("produtos/combo-real-" + n, {
        ...combo,
        categoria: "combos",
        ativo: true,
        esgotado: false,
        ordem: n,
        permiteAdicionais: true,
        modoAdicional: "todos",
      }),
    );
    const combo = window.combosConferidosFixture.find((c) => c.nome === "Combo 2 Industrial");
    const item = {
      ...clone(combo),
      categoria: "combos",
      produtoId: "combo-real-11",
      quantidade: 1,
      precoBase: combo.preco,
      precoUnitario: combo.preco,
      subtotal: combo.preco,
    };
    Object.assign(docs.get("comandas/comanda1"), {
      itens: [clone(item)],
      valorTotal: combo.preco,
      valorPago: 0,
      pagamentos: [],
      clienteId: null,
    });
    Object.assign(docs.get("pedidos/entrega1"), { itens: [clone(item)], valorTotal: combo.preco });
    docs.get("filaCozinha/entrega-fila").itens = [clone(item)];
    if (cenarioFixture === "comanda-mista") {
      const criarCombo = (nome, adicionais = {}, extra = 0) => {
        const n = window.combosConferidosFixture.findIndex((c) => c.nome === nome);
        const combo = clone(window.combosConferidosFixture[n]);
        return {
          ...combo,
          produtoId: "combo-real-" + n,
          categoria: "combos",
          quantidade: 1,
          precoBase: combo.preco,
          preco: combo.preco + extra,
          precoUnitario: combo.preco + extra,
          subtotal: combo.preco + extra,
          modoPersonalizacaoCombo: "individual",
          lanchesCombo: Array.from({ length: combo.comboQtdLanches }, (_, i) => ({
            numero: i + 1,
            adicionais: adicionais[i + 1] || [],
          })),
        };
      };
      const itens = [
        criarCombo("Combo 3 X-Bagunça"),
        {
          nome: "Baguncinha",
          produtoId: "lanche1",
          categoria: "lanches",
          quantidade: 1,
          tipo: "artesanal",
          preco: 33,
          subtotal: 33,
          adicionais: [{ nome: "Hambúrguer Caseiro", qtd: 1 }],
        },
        {
          nome: "Baguncinha",
          produtoId: "lanche1",
          categoria: "lanches",
          quantidade: 1,
          tipo: "artesanal",
          preco: 27,
          subtotal: 27,
          adicionais: [{ nome: "Tomate", qtd: 1 }],
        },
        criarCombo("Combo 2 Artesanal", { 1: [{ nome: "Bacon", qtd: 1 }] }, 5),
        criarCombo("Combo 4 Industrial", { 2: [{ nome: "Bacon", qtd: 2 }] }, 10),
        {
          nome: "Batata Média",
          produtoId: "batata1",
          categoria: "batatas",
          quantidade: 1,
          preco: 23,
          subtotal: 23,
          adicionais: [{ nome: "Cheddar", qtd: 1 }],
        },
        {
          nome: "Coca 2L",
          produtoId: "bebida1",
          categoria: "bebidas",
          quantidade: 1,
          preco: 20,
          subtotal: 20,
        },
      ];
      const total = itens.reduce((s, i) => s + i.subtotal, 0);
      const completarAdicional = (ad) => {
        const ref = [...docs].find(
          ([id, dado]) => id.startsWith("adicionais/") && dado.nome === ad.nome,
        );
        return ref ? { ...ad, id: ref[0].split("/")[1], preco: ref[1].preco } : ad;
      };
      for (const item of itens) {
        item.adicionais = (item.adicionais || []).map(completarAdicional);
        for (const lanche of item.lanchesCombo || [])
          lanche.adicionais = (lanche.adicionais || []).map(completarAdicional);
      }
      Object.assign(docs.get("comandas/comanda1"), { itens: clone(itens), valorTotal: total });
      Object.assign(docs.get("filaCozinha/entrega-fila"), {
        origemColecao: "comandas",
        origemId: "comanda1",
        itens: clone(itens),
        tipo: "Consumo no local",
        mesa: 1,
        cliente: "Rafa Teste",
      });
    }
  }
  if (cenarioFixture === "chapeiro-agrupado") {
    const lanche = { nome: "Baguncinha", categoria: "lanches", tipo: "artesanal", quantidade: 1 };
    const combo = (qtd, lanchesCombo = []) => ({
      nome: `Combo ${qtd} Caseiro`,
      categoria: "combos",
      quantidade: 1,
      comboComponentes: [
        { nome: "Baguncinha", categoria: "lanches", tipoCarne: "Artesanal", quantidade: qtd },
        { nome: "Refrigerante 1,5L", categoria: "bebidas", quantidade: 1 },
      ],
      modoPersonalizacaoCombo: "individual",
      lanchesCombo,
    });
    const itens = [
      { ...lanche, quantidade: 3 },
      combo(2),
      combo(3, [
        { numero: 1, adicionais: [{ nome: "Bacon", qtd: 2 }] },
        { numero: 2, adicionais: [{ nome: "Tomate", qtd: 1 }] },
      ]),
      { ...lanche, observacao: "Sem salada" },
      {
        ...lanche,
        adicionais: [{ nome: "Hambúrguer caseiro", qtd: 1 }],
        observacao: "Sem salsicha",
      },
      { ...lanche, tipo: "industrial", quantidade: 2 },
      { nome: "Batata Grande", categoria: "batatas", quantidade: 1 },
    ];
    const novos = [{ ...lanche, quantidade: 6 }];
    docs.delete("filaCozinha/entrega-fila");
    docs.delete("filaCozinha/retirada-fila");
    Object.assign(docs.get("comandas/comanda1"), { mesa: 2, itens: clone([...itens, ...novos]) });
    for (const [id, lote, horario] of [
      ["primeiro", itens, agora - 120000],
      ["segundo", novos, agora - 60000],
    ])
      docs.set("filaCozinha/" + id, {
        origemColecao: "comandas",
        origemId: "comanda1",
        tipo: "Local",
        mesa: 2,
        cliente: "Rafa Teste",
        status: "aguardando",
        criadoEmMs: horario,
        itens: clone(lote),
      });
  }
  docs.set("filaCozinha/antigo-fila", {
    origemColecao: "pedidos",
    origemId: "entrega-antiga",
    tipo: "Entrega",
    cliente: "Fila antiga não deve aparecer",
    status: "aguardando",
    criadoEmMs: agora - 86400000,
    itens: [],
  });
  docs.get("comandas/comanda1").criadoEm = agora;
  docs.get("comandas/comanda1").itens.forEach((item) => (item.precoUnitario = item.preco));
  const Params = window.URLSearchParams;
  window.URLSearchParams = class extends Params {
    constructor(valor) {
      super(valor || "mesa=" + mesaFixture + (modoMonitorFixture ? "&modo=monitor" : ""));
    }
  };
  let contador = 0;
  const ouvintes = [];
  function avisar() {
    queueMicrotask(() =>
      ouvintes.forEach((o) => o.fn(o.documento ? snapDoc(o.path) : snapshot(o.path, o.filtros))),
    );
  }
  function doc(path) {
    return {
      id: path.split("/").at(-1),
      path,
      collection: (c) => collection(path + "/" + c),
      get: async () => snapDoc(path),
      set: async (d, opt) => {
        docs.set(path, opt?.merge ? { ...docs.get(path), ...clone(d) } : clone(d));
        avisar();
      },
      update: async (d) => {
        docs.set(path, { ...docs.get(path), ...clone(d) });
        avisar();
      },
      delete: async () => {
        docs.delete(path);
        avisar();
      },
      onSnapshot: (fn) => {
        const o = { path, fn, documento: true };
        ouvintes.push(o);
        queueMicrotask(() => {
          if (ouvintes.includes(o)) fn(snapDoc(path));
        });
        return () => {
          const i = ouvintes.indexOf(o);
          if (i >= 0) ouvintes.splice(i, 1);
        };
      },
    };
  }
  function snapDoc(path) {
    return {
      id: path.split("/").at(-1),
      exists: docs.has(path),
      ref: doc(path),
      data: () => clone(docs.get(path)),
    };
  }
  function snapshot(path, filtros = []) {
    const arr = [...docs.keys()]
      .filter((p) => p.startsWith(path + "/") && p.slice(path.length + 1).indexOf("/") < 0)
      .map(snapDoc)
      .filter((d) =>
        filtros.every(([k, op, v]) =>
          op === "=="
            ? d.data()[k] === v
            : op === ">="
              ? d.data()[k] >= v
              : op === "<"
                ? d.data()[k] < v
                : true,
        ),
      );
    return {
      docs: arr,
      size: arr.length,
      empty: !arr.length,
      forEach: (fn) => arr.forEach(fn),
      docChanges: () => arr.map((d) => ({ type: "added", doc: d })),
    };
  }
  function collection(path, filtros = []) {
    return {
      doc: (id) => doc(path + "/" + (id || "mock-" + ++contador)),
      where: (k, op, v) => collection(path, [...filtros, [k, op, v]]),
      orderBy: () => collection(path, filtros),
      limit: () => collection(path, filtros),
      get: async () => {
        if (cenarioFixture === "lento") await new Promise((r) => setTimeout(r, 1200));
        if (cenarioFixture === "falha" && path.endsWith("/mensagens"))
          throw Error("Falha de conexão simulada");
        return snapshot(path, filtros);
      },
      add: async (d) => {
        const r = doc(path + "/mock-" + ++contador);
        await r.set(d);
        return r;
      },
      onSnapshot: (fn) => {
        const o = { path, filtros, fn };
        ouvintes.push(o);
        const emitir = () => fn(snapshot(path, filtros));
        const espera = cenarioFixture === "lento" ? setTimeout(emitir, 6000) : null;
        if (!espera) queueMicrotask(emitir);
        return () => {
          clearTimeout(espera);
          ouvintes.splice(ouvintes.indexOf(o), 1);
        };
      },
    };
  }
  const db = {
    collection,
    doc,
    batch: () => {
      const writes = [];
      return {
        set: (r, d) => writes.push(() => r.set(d)),
        update: (r, d) => writes.push(() => r.update(d)),
        delete: (r) => writes.push(() => r.delete()),
        commit: async () => {
          for (const w of writes) await w();
        },
      };
    },
    runTransaction: async (fn) => {
      const writes = [];
      const result = await fn({
        get: (r) => r.get(),
        set: (r, d) => writes.push(() => r.set(d)),
        update: (r, d) => writes.push(() => r.update(d)),
      });
      for (const w of writes) await w();
      return result;
    },
  };
  const firestore = () => db;
  window.addEventListener("message", (evento) => {
    if (evento.source !== window.parent || evento.origin !== new URL(document.baseURI).origin)
      return;
    if (evento.data?.tipo === "revisao-medir-layout") {
      const largura = document.documentElement.clientWidth;
      const total = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
      const alinhamentos = [
        ...document.querySelectorAll(
          ".painel-atendente-body > :is(h1, div[id^='area-'], #central-operacao)",
        ),
      ]
        .filter((e) => {
          const r = e.getBoundingClientRect();
          return r.width && r.height && getComputedStyle(e).display !== "none";
        })
        .map((e) => {
          const r = e.getBoundingClientRect();
          const esquerda = Math.round(r.left * 10) / 10;
          const direita = Math.round((largura - r.right) * 10) / 10;
          return `${e.id || e.tagName}: margem esquerda ${esquerda}px / direita ${direita}px (${Math.abs(esquerda - direita) <= 1 ? "centralizado" : "desalinhado"})`;
        });
      const excessos = [...document.querySelectorAll("body *")]
        .filter((e) => {
          const r = e.getBoundingClientRect();
          return r.width && r.height && (r.left < -1 || r.right > largura + 1);
        })
        .slice(0, 6)
        .map((e) => e.id || e.className || e.tagName);
      window.parent.postMessage(
        {
          tipo: "revisao-medidas-layout",
          texto: `Tela: ${largura}px · Conteúdo: ${total}px · ${total <= largura ? "Sem rolagem lateral" : "Excesso lateral"}${excessos.length ? " · " + excessos.join(", ") : ""}${alinhamentos.length ? " · " + alinhamentos.join(" · ") : ""}`,
        },
        evento.origin,
      );
      return;
    }
    if (evento.data?.tipo === "revisao-alternar-loja") {
      doc("config/loja").update({ aberta: !docs.get("config/loja").aberta });
      return;
    }
    if (
      evento.data?.tipo === "revisao-chamado-mesa" &&
      ["atendente", "conta"].includes(evento.data.chamadoTipo)
    ) {
      const tipo = evento.data.chamadoTipo;
      doc("chamadosMesa/chamado-sonoro-" + ++contador).set({
        mesaId: tipo === "conta" ? "mesa6" : "mesa2",
        mesaNumero: tipo === "conta" ? 6 : 2,
        cliente: "Cliente Fictício",
        tipo,
        status: "aberto",
        criadoEmMs: Date.now(),
        criadoEm: new Date().toISOString(),
      });
      return;
    }
    if (cenarioFixture !== "beneficios") return;
    if (evento.data?.tipo === "revisao-previa-ativacao") window.mostrarAtivacaoCdaPedraoUI?.();
    if (evento.data?.tipo === "revisao-subir-nivel") {
      const niveis = ["Bronze", "Prata", "Ouro", "Diamante", "Imortal"];
      const indice = niveis.indexOf(docs.get("clientes/" + cliente).nivelCliente);
      doc("clientes/" + cliente).update({ nivelCliente: niveis[Math.min(indice + 1, 4)] });
    }
    if (evento.data?.tipo === "revisao-enviar-cupom")
      doc("clientes/" + cliente + "/mensagens/cupom-chegou-" + ++contador).set({
        tipo: "admin",
        remetente: "admin",
        cupomCodigo: "COCA200",
        lida: false,
        texto: "Seu presente acabou de chegar. Use na sua próxima compra.",
        data: new Date().toISOString(),
      });
  });
  firestore.FieldValue = {
    delete: () => null,
    serverTimestamp: () => agora,
    increment: (n) => n,
    arrayUnion: (...x) => x,
  };
  firestore.Timestamp = {
    fromDate: (d) => ({ toDate: () => d, toMillis: () => d.getTime() }),
    now: () => ({ toMillis: () => agora }),
  };
  window.firebase = { initializeApp() {}, firestore };
  const memoria = new Map([
    ["atendenteId", "teste"],
    ["atendenteNome", "Atendente Teste"],
    ["clientePedrao", JSON.stringify({ telefone: cliente, nome: "Rafa Teste" })],
    ["cozinhaAcessoPedrao", "teste"],
  ]);
  const storage = {
    getItem: (k) => memoria.get(k) || null,
    setItem: (k, v) => memoria.set(k, String(v)),
    removeItem: (k) => memoria.delete(k),
  };
  Object.defineProperty(window, "localStorage", { value: storage });
  Object.defineProperty(window, "sessionStorage", { value: storage });
})();
