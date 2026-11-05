/* Fixture exclusivamente local: nunca carregar em uma página de produção. */
(() => {
  const AudioReal = window.AudioContext || window.webkitAudioContext;
  let notasTeste = 0;
  if (AudioReal)
    window.AudioContext = class extends AudioReal {
      createOscillator() {
        const no = super.createOscillator(),
          iniciar = no.start.bind(no);
        no.start = (...args) => {
          iniciar(...args);
          window.parent.postMessage(
            { tipo: "revisao-som", notas: ++notasTeste },
            new URL(document.baseURI).origin,
          );
        };
        return no;
      }
    };
  const modoMonitorFixture = document.currentScript.src.includes("modo=monitor");
  const parametrosFixture = new URL(document.currentScript.src).searchParams;
  const mesaFixture = parametrosFixture.get("mesa") || "2";
  const cenarioFixture = parametrosFixture.get("cenario");
  if (
    ["entrega-distante", "entrega-fora-area", "beneficios-entrega", "carregamento"].includes(
      cenarioFixture,
    )
  ) {
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition(sucesso) {
          // Ponto fictício, sem pedir a localização real do aparelho.
          const emitir = () =>
            sucesso({
              coords: {
                latitude:
                  -15.553076945525193 -
                  (cenarioFixture === "entrega-fora-area"
                    ? 22
                    : cenarioFixture === "beneficios-entrega"
                      ? 3
                      : cenarioFixture === "carregamento"
                        ? 3
                        : 12) /
                    111.19492664455873,
                longitude: -56.05602240360688,
              },
            });
          if (cenarioFixture === "carregamento") setTimeout(emitir, 6000);
          else emitir();
        },
      },
    });
  }
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
      "atendentes/teste": { nome: "Atendente Teste", codigo: "teste1234", ativo: true },
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
  if (cenarioFixture === "cupons-rank") {
    for (const [codigo, acesso] of [
      ["BKFP", "todos"],
      ["PRATAEX", "exclusivo"],
      ["PRATAMAIS", "crescente"],
    ]) {
      docs.set("cuponsDesconto/" + codigo, {
        codigo,
        nome: "Black Pedrão · " + codigo,
        ativo: true,
        uso: "diversos",
        tipo: "item",
        itemGeral: true,
        itemGeralTipo: "todos",
        itemGeralModo: "porcentagem",
        itemGeralValor: 0,
        rankRegra: {
          acesso,
          nivel: "Prata",
          descontoPorRank: true,
          percentuais: { Bronze: 5, Prata: 7, Ouro: 9, Diamante: 11, Imortal: 13 },
        },
      });
    }
  }
  if (cenarioFixture === "cda-inativo") {
    docs.get("clientes/" + cliente).fidelidadeAtiva = false;
    docs.get("clientes/" + cliente).nivelCliente = "Sem nível";
  }
  if (cenarioFixture === "atendimento-edicao") {
    const local = {
      ...clone(docs.get("pedidos/retirada1")),
      tipo: "Local",
      origem: "site_delivery",
      nome: "Cliente sem mesa",
      telefone: cliente,
      clienteId: cliente,
      numero: 3,
    };
    docs.set("pedidos/local-sem-mesa", local);
    docs.set("pedidos/local-mesa-antiga", {
      ...clone(local),
      nome: "Já está na mesa 1",
      mesa: 1,
      numero: 4,
    });
    docs.set("pedidos/local-comanda-antiga", {
      ...clone(local),
      nome: "Já possui comanda",
      comandaId: "comanda1",
      numero: 5,
    });
    docs.set("pedidos/local-reverso", { ...clone(local), nome: "Vínculo antigo", numero: 6 });
    docs.set("comandas/comanda-legada", {
      status: "Fechada",
      mesa: 2,
      pedidoOrigemId: "local-reverso",
      itens: [],
      valorTotal: 0,
    });
    Object.assign(docs.get("pedidos/retirada1"), {
      nome: "Rafa Teste",
      telefone: cliente,
      clienteId: cliente,
      valorTotal: 50,
      pagamento: "Pix",
      pagamentoConfirmado: true,
      pagamentoConfirmadoEm: agora - 60000,
      itens: [
        {
          nome: "Lanche teste 1",
          produtoId: "lanche1",
          categoria: "lanches",
          quantidade: 2,
          preco: 25,
          subtotal: 50,
        },
      ],
    });
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
  if (window.catalogoAtualFixture) {
    Object.assign(docs.get("pedidos/entrega1"), {
      endereco: "Rua de teste, 100\nBloco A, apartamento 03",
      condominio: "Sim",
      cnh: "Sim",
      telefone: "65999999999",
      localizacao: "https://www.google.com/maps?q=-15.7508,-56.1035",
      observacao: "Embalar bebidas separadas dos lanches.",
    });
    const dec = (v) =>
      v.mapValue
        ? Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k, x]) => [k, dec(x)]))
        : v.arrayValue
          ? (v.arrayValue.values || []).map(dec)
          : (v.stringValue ??
            v.booleanValue ??
            (v.integerValue != null ? Number(v.integerValue) : (v.doubleValue ?? null)));
    for (const k of [...docs.keys()])
      if (k.startsWith("produtos/") || k.startsWith("adicionais/")) docs.delete(k);
    for (const grupo of ["produtos", "adicionais"])
      for (const d of window.catalogoAtualFixture[grupo])
        docs.set(grupo + "/" + d.name.split("/").pop(), dec({ mapValue: { fields: d.fields } }));
  }
  Object.assign(docs.get("pedidos/retirada1").itens[0], {
    molhosGratis: [{ unidade: 1, tipo: "doisiguais", texto: "2 Maionese" }],
    molhosPagos: [{ nome: "Barbecue", qtd: 2, preco: 2 }],
    totalMolhosPagos: 4,
  });
  if (cenarioFixture === "atendimento-edicao") {
    Object.assign(docs.get("pedidos/retirada1").itens[0], {
      molhosGratis: [],
      molhosPagos: [],
      totalMolhosPagos: 0,
    });
    docs.get("clientes/" + cliente).codigoAtivacao = "1234";
  }
  docs.set("pedidos/entrega-antiga", {
    tipo: "Entrega",
    nome: "Pedido antigo · não deve aparecer",
    dataMs: agora - 60 * 86400000,
    valorTotal: 20,
    itens: [],
  });
  if (["entrega-distante", "entrega-fora-area"].includes(cenarioFixture))
    docs.get("pedidos/entrega1").distanciaKm = cenarioFixture === "entrega-fora-area" ? 22 : 12;
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
  if (cenarioFixture === "chapeiro-obs-grupo") {
    const combo = (qtd, obs = "", batata = false) => ({
      nome: `Combo ${qtd} Caseiro`,
      categoria: "combos",
      quantidade: 1,
      tipo: "Artesanal",
      obs,
      comboComponentes: [
        { nome: "Baguncinha", categoria: "lanches", quantidade: qtd },
        ...(batata ? [{ nome: "Batata Média", categoria: "batatas", quantidade: 1 }] : []),
      ],
    });
    docs.delete("filaCozinha/retirada-fila");
    Object.assign(docs.get("filaCozinha/entrega-fila"), {
      tipo: "Local",
      mesa: 6,
      cliente: "Cliente de exemplo",
      itens: [combo(2, "Sem tomate e batata sequinha", true), combo(5), combo(2)],
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
  if (["rank-mensal", "beneficios-entrega"].includes(cenarioFixture)) {
    for (const [chave] of docs)
      if (/^(pedidos|comandas|historicoPagamentosClientes)\//.test(chave)) docs.delete(chave);
    const anterior = new DataReal(
      horarioTeste.getFullYear(),
      horarioTeste.getMonth() - 1,
      15,
      20,
    ).getTime();
    for (const [id, valor, data] of [
      ["rank-anterior", 500, anterior],
      ["rank-atual", 310, agora],
    ]) {
      docs.set("pedidos/" + id, {
        clienteId: cliente,
        nome: "Rafa Teste",
        telefone: cliente,
        tipo: "Retirada",
        numero: id,
        itens: [{ nome: "Compras do mês", preco: valor, quantidade: 1 }],
        valorTotal: valor,
        taxaEntrega: 0,
        pagamento: "Pix",
        pagamentoConfirmado: true,
        pagamentoConfirmadoEm: data,
        valorPago: valor,
        dataMs: data,
      });
    }
    docs.get("clientes/" + cliente).nivelCliente = "Prata";
    docs.get("clientes/" + cliente).totalFidelidade = 58;
    docs.get("clientes/" + cliente).bonusDisponivel = 0;
  }
  if (cenarioFixture === "beneficios-entrega") {
    docs.set("config/beneficios", {
      creditoEntrega: {
        ativo: true,
        valores: { Bronze: 0, Prata: 5, Ouro: 10, Diamante: 15, Imortal: 20 },
        limitePorPedido: 4,
        pedidoMinimo: 0,
        acumularCupom: true,
        acumularFidelidade: true,
      },
    });
    const abrirOriginal = window.open.bind(window);
    window.open = (url, ...args) =>
      /whatsapp|wa\.me/.test(String(url)) ? null : abrirOriginal(url, ...args);
  }
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
        if (cenarioFixture === "carregamento") await new Promise((r) => setTimeout(r, 6000));
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
        set: (r, d, opts) => writes.push(() => r.set(d, opts)),
        update: (r, d) => writes.push(() => r.update(d)),
        delete: (r) => writes.push(() => r.delete()),
        commit: async () => {
          for (const w of writes) await w();
        },
      };
    },
    runTransaction: async (fn) => {
      if (cenarioFixture === "carregamento") await new Promise((r) => setTimeout(r, 6000));
      const writes = [];
      const result = await fn({
        get: (r) => r.get(),
        set: (r, d, opts) => writes.push(() => r.set(d, opts)),
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
    if (
      evento.data?.tipo === "revisao-encerrar-atendimento-auto" &&
      cenarioFixture === "auto-pedido-enviado"
    ) {
      doc("comandas/comanda-auto-teste").update({ status: "Fechada" });
      doc("mesas/mesa" + mesaFixture).update({ ocupada: false });
    }
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
    if (evento.data?.tipo === "revisao-nova-leva-cozinha") {
      doc("filaCozinha/nova-leva-" + ++contador).set({
        origemColecao: "pedidos",
        origemId: "retirada1",
        tipo: "Retirada",
        cliente: "Nova leva de teste",
        status: "aguardando",
        criadoEmMs: Date.now(),
        itens: [{ nome: "Lanche novo para testar som", categoria: "lanches", quantidade: 1 }],
      });
      return;
    }
    if (
      evento.data?.tipo === "revisao-pedido-site" &&
      ["Entrega", "Retirada", "Local"].includes(evento.data.pedidoTipo)
    ) {
      const tipo = evento.data.pedidoTipo;
      doc("pedidos/pedido-site-" + ++contador).set({
        origem: "site_delivery",
        tipo,
        numero: 100 + contador,
        nome: "Cliente do site · " + tipo,
        telefone: "65999999999",
        dataMs: Date.now(),
        data: new Date().toISOString(),
        valorTotal: 25,
        pagamento: "Pix",
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
      });
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
  if (["seguranca-protegida", "adm-protegido"].includes(cenarioFixture)) {
    const perfil = docs.get("clientes/" + cliente);
    Object.assign(perfil, {
      nome: "Cliente Teste",
      authUid: "cliente",
      fidelidadeAtiva: false,
      nivelCliente: "Sem nível",
      bonusDisponivel: 0,
      rankMensal: { importadoEm: 1, meses: {} },
      avatar: "images/avatares/sem-rank/maionese.webp",
      historicoLegadoVerificado: false,
    });
    docs.set("config/beneficios", {});
    const apps = [],
      auths = new Map();
    function app(nome = "[DEFAULT]") {
      if (apps.some((a) => a.name === nome)) return apps.find((a) => a.name === nome);
      const auth = {
        currentUser:
          nome !== "[DEFAULT]" && cenarioFixture === "adm-protegido"
            ? { uid: "dono-teste", getIdToken: async () => "dono-teste" }
            : nome === "[DEFAULT]"
              ? {
                  uid: "cliente",
                  email: "65999999999@clientes.pedrao-lanches.invalid",
                  getIdToken: async () => "cliente",
                }
              : null,
        setPersistence: async () => {},
        signOut: async () => {
          auth.currentUser = null;
        },
        onAuthStateChanged(fn) {
          queueMicrotask(() => fn(auth.currentUser));
          return () => {};
        },
        async signInWithCustomToken(token) {
          auth.currentUser = { uid: token.replace(/^visita:/, ""), getIdToken: async () => token };
        },
      };
      auths.set(nome, auth);
      const a = { name: nome, options: {}, auth: () => auth, firestore: () => db };
      apps.push(a);
      return a;
    }
    window.firebase = {
      initializeApp: (_, n) => app(n),
      app: () => app(),
      apps,
      auth: () => app().auth(),
      firestore,
    };
    const originalFetch = window.fetch.bind(window);
    window.fetch = async (url, opcoes) => {
      if (cenarioFixture === "adm-protegido" && String(url) === "/api/acesso-equipe")
        return new Response(
          JSON.stringify(
            opcoes?.body
              ? {
                  funcionario: {
                    id: "dono-teste",
                    nome: "Proprietário teste",
                    perfil: "ambos",
                    admin: true,
                  },
                }
              : { disponivel: true },
          ),
          { headers: { "Content-Type": "application/json" } },
        );
      if (cenarioFixture === "adm-protegido" && String(url) === "/api/recuperacao-acesso")
        return new Response(JSON.stringify({ disponivel: true, validadeMinutos: 30 }), {
          headers: { "Content-Type": "application/json" },
        });
      if (!/^\/api\/(pedido-publico|mesa-publica|acesso-cliente)$/.test(String(url)))
        return originalFetch(url, opcoes);
      const r = await originalFetch(
        "/tests/api-seguranca/" + String(url).split("/").at(-1),
        opcoes,
      );
      const d = await r.clone().json();
      if (d.cliente) {
        docs.set("clientes/" + cliente, d.cliente);
      }
      if (d.mesa) docs.set("mesas/" + d.mesa.id, d.mesa);
      if (d.sessao) {
        docs.set("sessoesMesa/" + d.sessao.id, d.sessao);
        if (d.sessao.pedidoEnviado) {
          docs.set("mesas/" + d.sessao.mesaId, { numero: d.sessao.mesaNumero, ocupada: true });
          docs.set("comandas/" + d.sessao.comandaId, {
            status: "Aberta",
            sessaoAutoatendimentoId: d.sessao.id,
          });
        }
      }
      if (d.pedido?.id) docs.set("pedidos/" + d.pedido.id, d.pedido);
      if (opcoes?.body)
        window.parent.postMessage(
          { tipo: "revisao-api-protegida", acao: JSON.parse(opcoes.body).acao, sucesso: r.ok },
          new URL(document.baseURI).origin,
        );
      avisar();
      return r;
    };
    window.open = () => null; // WhatsApp nunca sai desta prévia.
    if (cenarioFixture === "adm-protegido")
      document.addEventListener("DOMContentLoaded", () =>
        iniciarAcessoPaginaEquipeUI("admin.html"),
      );
  }
  if (cenarioFixture === "funcionario-chapa" || cenarioFixture === "funcionario-atendimento")
    docs.get("atendentes/teste").perfil =
      cenarioFixture === "funcionario-chapa" ? "chapa" : "atendimento";
  const memoria =
    cenarioFixture === "seguranca-protegida" && window.parent.storageSegurancaFixture
      ? window.parent.storageSegurancaFixture
      : new Map([
          ["atendenteId", "teste"],
          ["atendenteNome", "Atendente Teste"],
          ["clientePedrao", JSON.stringify({ telefone: cliente, nome: "Rafa Teste" })],
          ["cozinhaAcessoPedrao", "teste"],
        ]);
  if (cenarioFixture === "seguranca-protegida") window.parent.storageSegurancaFixture = memoria;
  const storage = {
    getItem: (k) => memoria.get(k) || null,
    setItem: (k, v) => memoria.set(k, String(v)),
    removeItem: (k) => memoria.delete(k),
  };
  if (cenarioFixture === "auto-pedido-enviado") {
    const idMesa = "mesa" + mesaFixture;
    docs.set("mesas/" + idMesa, { numero: Number(mesaFixture), ocupada: true });
    docs.set("sessoesMesa/sessao-auto-teste", {
      mesaId: idMesa,
      mesaNumero: Number(mesaFixture),
      nome: "Cliente Teste",
      status: "ativa",
      pedidoEnviado: true,
      comandaId: "comanda-auto-teste",
      criadoEmMs: agora,
    });
    docs.set("sessoesMesa/outra-mesa", {
      mesaId: "mesa-outra",
      status: "ativa",
      pedidoEnviado: true,
    });
    docs.set("comandas/comanda-auto-teste", {
      mesa: Number(mesaFixture),
      mesaId: idMesa,
      status: "Aberta",
      sessaoAutoatendimentoId: "sessao-auto-teste",
      cliente: "Cliente Teste",
      valorTotal: 25,
      itens: [],
    });
    memoria.set("sessaoAutoatendimentoId:" + idMesa, "sessao-auto-teste");
    memoria.set("sessaoAutoatendimentoId", "outra-mesa");
  }
  Object.defineProperty(window, "localStorage", { value: storage });
  Object.defineProperty(window, "sessionStorage", { value: storage });
})();
