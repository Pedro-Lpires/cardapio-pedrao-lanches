/* Fixture exclusivamente local: nunca carregar em uma página de produção. */
(() => {
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
        avatar: "images/avatar1.png",
      },
      ["clientes/" + cliente + "/chamados/suporte1"]: {
        categoria: "reclamacao",
        status: "aberto",
        clienteNome: "Rafa Teste",
        clienteTelefone: cliente,
        clienteAvatar: "images/avatar1.png",
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
  for (const [cat, prefixo, preco, img] of [
    ["lanches", "lanche", 25, "lanche.png"],
    ["bebidas", "bebida", 5, "refri-latas.jpg"],
    ["batatas", "batata", 15, "batata-frita.media-cortada.png"],
    ["combos", "combo", 40, "combo.png"],
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
  docs.set("adicionais/alface", { nome: "Alface", preco: 2, ativo: true, ordem: 1 });
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
  const Params = window.URLSearchParams;
  window.URLSearchParams = class extends Params {
    constructor(valor) {
      super(valor || "mesa=2");
    }
  };
  let contador = 0;
  const ouvintes = [];
  function avisar() {
    queueMicrotask(() => ouvintes.forEach((o) => o.fn(snapshot(o.path, o.filtros))));
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
        queueMicrotask(() => fn(snapDoc(path)));
        return () => {};
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
      get: async () => snapshot(path, filtros),
      add: async (d) => {
        const r = doc(path + "/mock-" + ++contador);
        await r.set(d);
        return r;
      },
      onSnapshot: (fn) => {
        const o = { path, filtros, fn };
        ouvintes.push(o);
        queueMicrotask(() => fn(snapshot(path, filtros)));
        return () => ouvintes.splice(ouvintes.indexOf(o), 1);
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
