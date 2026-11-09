const assert = require("node:assert/strict");
const { criarFreteRota, criarLimitadorFreteRota } = require("../api/_lib/frete-rota.cjs");
const {
  criarServicoPedidoPublico,
  taxaPedido,
  diaPedido,
  pontoPedido,
} = require("../api/_lib/pedido-publico.cjs");
const copia = (v) => (v === undefined ? undefined : structuredClone(v));
function fixture({ agora = () => Date.parse("2026-11-03T18:00:00Z"), rotasEntrega } = {}) {
  const registros = new Map([
    ["config/loja", { aberta: true }],
    [
      "produtos/bagunca",
      {
        nome: "Baguncinha",
        categoria: "lanches",
        ativo: true,
        preco: 25,
        precoIndustrial: 18,
        tipoBase: "hamburguer",
      },
    ],
    ["produtos/lata", { nome: "Coca (Lata)", categoria: "bebidas", ativo: true, preco: 8 }],
    ["adicionais/bacon", { nome: "Bacon", preco: 6, ativo: true }],
    [
      "clientes/65999999999",
      {
        nome: "Cliente Teste",
        authUid: "cliente",
        fidelidadeAtiva: true,
        bonusDisponivel: 10,
        totalFidelidade: 290,
        rankMensal: { importadoEm: 1, meses: { "2026-11": 40000 } },
      },
    ],
    [
      "config/beneficios",
      { creditoEntrega: { ativo: true, valores: { Prata: 5 }, acumularCupom: true } },
    ],
  ]);
  const snap = (ref, valores = registros) => ({
    id: ref.id,
    ref,
    exists: valores.has(ref.path),
    data: () => copia(valores.get(ref.path)),
  });
  const referencia = (path) => ({
    path,
    id: path.split("/").at(-1),
    get: async () => snap(referencia(path)),
    collection: (nome) => db.collection(path + "/" + nome),
  });
  let fila = Promise.resolve(),
    queries = 0,
    limitado = false;
  const db = {
    collection(raiz) {
      function consulta(filtros = [], limite = 500) {
        return {
          doc: (id = "novo-" + queries++) => referencia(raiz + "/" + id),
          where: (campo, op, valor) => consulta([...filtros, [campo, valor, op]], limite),
          limit: (v) => consulta(filtros, v),
          async get() {
            queries++;
            const docs = [...registros.keys()]
              .filter(
                (p) =>
                  p.startsWith(raiz + "/") &&
                  p.split("/").length === raiz.split("/").length + 1 &&
                  filtros.every(([k, v, op]) =>
                    op === ">="
                      ? registros.get(p)[k] >= v
                      : op === "<"
                        ? registros.get(p)[k] < v
                        : registros.get(p)[k] === v,
                  ),
              )
              .slice(0, limite)
              .map((p) => snap(referencia(p)));
            return { docs, empty: !docs.length };
          },
        };
      }
      return consulta();
    },
    runTransaction(fn) {
      const executar = async () => {
        const antes = new Map([...registros].map(([k, v]) => [k, copia(v)])),
          escritas = [];
        const resultado = await fn({
          get: async (ref) => {
            assert.equal(escritas.length, 0, "Todas as leituras precedem as escritas");
            return snap(ref, antes);
          },
          set: (ref, dados) => escritas.push([ref.path, copia(dados)]),
          update: (ref, dados) => {
            assert(antes.has(ref.path));
            escritas.push([ref.path, { ...antes.get(ref.path), ...copia(dados) }]);
          },
        });
        for (const [p, v] of escritas) registros.set(p, v);
        return resultado;
      };
      const resultado = fila.then(executar);
      fila = resultado.catch(() => {});
      return resultado;
    },
  };
  const usuarios = new Map([["cliente", { phoneNumber: "+5565999999999" }]]);
  const auth = {
    async verifyIdToken(token, revogar) {
      assert.equal(revogar, true);
      if (!usuarios.has(token)) throw Error();
      return { uid: token, acessoCliente: true, clienteId: "65999999999" };
    },
    async getUser(uid) {
      return usuarios.get(uid);
    },
  };
  const servico = criarServicoPedidoPublico({
    db,
    auth,
    siteUrl: "https://pedrao.exemplo/",
    agora,
    rotasEntrega,
    consumirTentativa: async () => {
      if (limitado) throw Object.assign(Error("Limite"), { status: 429 });
    },
  });
  return {
    servico,
    db,
    registros,
    usuarios,
    queries: () => queries,
    limitar: () => (limitado = true),
  };
}
const pedido = () => ({
  tipo: "Retirada",
  nome: "Cliente Teste",
  telefone: "65999999999",
  itens: [
    {
      produtoId: "bagunca",
      quantidade: 1,
      tipo: "artesanal",
      preco: 0.01,
      nome: "X-tudo",
      adicionais: [{ id: "bacon", quantidade: 1, preco: 0.01, nome: "Mignon" }],
      molhosPagos: [{ nome: "Ketchup", qtd: 1, preco: 0 }],
    },
  ],
  pagamento: "Pix",
  taxaEntrega: 0,
  descontoCupom: 0,
  descontoCreditoEntrega: 0,
  descontoFidelidade: 0,
});
const chave = "a".repeat(43);
async function salvar(f, entrada, extra = {}) {
  const quote = await f.servico.conferir({ pedido: entrada, ...extra });
  return f.servico.salvar({
    pedido: {
      ...entrada,
      valorTotal: quote.pedido.valorTotal,
      taxaEntrega: quote.pedido.taxaEntrega,
      descontoCupom: quote.pedido.descontoCupom,
      descontoCreditoEntrega: quote.pedido.descontoCreditoEntrega,
    },
    chave,
    ...extra,
  });
}
module.exports = { fixture };
if (require.main === module)
  (async () => {
    let f = fixture(),
      entrada = pedido();
    const q = await f.servico.conferir({
      pedido: {
        ...entrada,
        clienteId: "65999999999",
        clienteAuthUid: "cliente",
        pagamentoConfirmado: true,
      },
    });
    assert.equal(q.pedido.valorTotal, 33);
    assert.equal(q.pedido.itens[0].nome, "Baguncinha (Artesanal)");
    assert.equal(q.pedido.itens[0].adicionais[0].nome, "Bacon");
    assert.equal(q.pedido.clienteId, null, "Telefone não autentica nem associa o histórico");
    assert.equal(q.pedido.pagamentoConfirmado, false);
    await assert.rejects(
      f.servico.conferir({ pedido: entrada, authorization: "Bearer falso" }),
      (e) => e.status === 401,
    );
    await assert.rejects(
      f.servico.conferir({ pedido: { ...entrada, descontoFidelidade: 10 } }),
      (e) => e.status === 409,
    );
    await assert.rejects(
      f.servico.salvar({ pedido: { ...entrada, valorTotal: 1 }, chave }),
      (e) => e.status === 409,
    );
    assert.equal([...f.registros.keys()].filter((k) => k.startsWith("pedidos/")).length, 0);
    const original = await salvar(f, entrada);
    const outra = await salvar(f, entrada);
    assert.equal(original.pedido.id, outra.pedido.id);
    assert.equal(outra.repetido, true);
    assert.equal(f.registros.get("config/contadorPedidos_2026-11-03").ultimoNumero, 1);
    await assert.rejects(
      salvar(f, { ...entrada, observacao: "Outra solicitação" }),
      (e) => e.status === 409,
    );
    f = fixture();
    entrada = { ...pedido(), descontoFidelidade: 10 };
    const auth = { authorization: "Bearer cliente" };
    const [primeiro, segundo] = await Promise.all([
      salvar(f, entrada, auth),
      salvar(f, entrada, auth),
    ]);
    assert.equal(primeiro.pedido.id, segundo.pedido.id);
    assert.equal(f.registros.get("clientes/65999999999").bonusDisponivel, 0);
    assert.equal(
      f.registros.get("clientes/65999999999").totalFidelidade,
      290,
      "Pedido não pago ainda não gera bônus",
    );
    assert.equal(primeiro.pedido.fidelidadeReserva.status, "reservado");
    f = fixture();
    f.usuarios.get("cliente").disabled = true;
    await assert.rejects(salvar(f, pedido(), auth), (e) => e.status === 401);
    f = fixture();
    f.registros.get("clientes/65999999999").authUid = "outro";
    await assert.rejects(salvar(f, pedido(), auth), (e) => e.status === 403);
    f = fixture();
    f.registros.get("config/loja").aberta = false;
    await assert.rejects(salvar(f, pedido()), (e) => e.status === 409);
    f = fixture();
    f.limitar();
    await assert.rejects(salvar(f, pedido()), (e) => e.status === 429);
    f = fixture();
    const semEnderecoEscrito = {
      ...pedido(),
      tipo: "Entrega",
      areaUrbanaConfirmada: true,
      localizacao: "https://www.google.com/maps?q=-15.560671,-56.0802923",
    };
    const apenasGps = await salvar(f, semEnderecoEscrito);
    assert.equal(apenasGps.pedido.endereco, "", "Endereço escrito é opcional também na gravação");
    assert.equal(
      new URL(apenasGps.pedido.localizacao).searchParams.get("p"),
      "-15.560671,-56.0802923",
    );
    assert(apenasGps.pedido.id, "Entrega com GPS e sem endereço escrito é salva");
    await assert.rejects(
      fixture().servico.conferir({ pedido: { ...semEnderecoEscrito, localizacao: "" } }),
      /localização/,
      "O GPS válido continua obrigatório",
    );
    {
      let em = Date.parse("2026-11-03T18:00:00Z");
      let consultas = 0;
      let distancia = 3700;
      const chamadas = [];
      const rotasEntrega = criarFreteRota({
        apiKey: "chave-ficticia",
        chave: Buffer.alloc(32, 42),
        consumirConsulta: async () => {
          consultas++;
        },
        fetchHttp: async (url) => {
          chamadas.push(url);
          return {
            ok: distancia !== null,
            json: async () => ({ features: [{ properties: { distance: distancia } }] }),
          };
        },
      });
      const teste = fixture({ rotasEntrega, agora: () => em });
      const localizacao = "https://www.google.com/maps?q=-15.5776,-56.056";
      const entregaRota = { ...semEnderecoEscrito, localizacao };
      await assert.rejects(
        teste.servico.frete({ pedido: { localizacao } }),
        (e) => e.status === 400,
      );
      const { frete } = await teste.servico.frete({ pedido: entregaRota });
      assert.equal(chamadas[0].origin, "https://api.geoapify.com");
      assert.equal(chamadas[0].searchParams.get("mode"), "motorcycle");
      assert.equal(chamadas[0].searchParams.get("units"), "metric");
      assert.deepEqual(
        [...chamadas[0].searchParams.keys()],
        ["waypoints", "mode", "format", "units", "apiKey"],
      );
      assert.equal(frete.distanciaKm, 3.7);
      assert.equal(frete.taxaEntrega, 8);
      const entradaComRota = { ...entregaRota, cotacaoFrete: frete.comprovante, distanciaKm: 2.73 };
      for (const entrada of [
        entregaRota,
        { ...entradaComRota, localizacao: "https://www.google.com/maps?q=-15.58,-56.056" },
        { ...entradaComRota, cotacaoFrete: frete.comprovante.replace(":3700:", ":2700:") },
      ])
        await assert.rejects(teste.servico.conferir({ pedido: entrada }), (e) => e.status === 409);
      const resultado = await salvar(teste, entradaComRota);
      assert.equal(resultado.pedido.distanciaKm, 3.7);
      assert.equal(resultado.pedido.taxaEntrega, 8);
      assert.equal(resultado.pedido.cotacaoFrete, undefined);
      assert.equal(consultas, 1, "Conferir e salvar reutilizam a rota validada");
      em += 15 * 60_000;
      await assert.rejects(
        teste.servico.conferir({ pedido: entradaComRota }),
        (e) => e.status === 409,
      );
      for (const [data, adicional] of [
        ["2026-11-09", 0], // Segunda-feira
        ["2026-11-14", 1], // Sábado
        ["2026-11-15", 1], // Domingo e feriado
        ["2026-11-20", 1], // Feriado na sexta-feira
        ["2026-11-22", 1], // Domingo
      ]) {
        em = Date.parse(`${data}T19:00:00-04:00`);
        for (const [metros, taxaBase] of [
          [2000, 6],
          [2010, 7],
          [3000, 7],
          [3010, 8],
          [10000, 16],
          [10010, 20.02],
          [11000, 22],
          [11010, 22.02],
        ]) {
          distancia = metros;
          const { frete: cotacao } = await teste.servico.frete({ pedido: entregaRota });
          const taxaEsperada = taxaBase + adicional;
          assert.equal(cotacao.distanciaKm, metros / 1000);
          assert.equal(cotacao.taxaEntrega, taxaEsperada, `${data}, ${metros} m`);
          const pedidoCotado = { ...entregaRota, cotacaoFrete: cotacao.comprovante };
          if (metros > 11000) {
            await assert.rejects(teste.servico.conferir({ pedido: pedidoCotado }), /50,00/);
            pedidoCotado.itens = [{ produtoId: "bagunca", quantidade: 2, tipo: "artesanal" }];
          }
          const { pedido: conferido } = await teste.servico.conferir({ pedido: pedidoCotado });
          assert.equal(conferido.taxaEntrega, taxaEsperada);
        }
        em = Date.parse(`${data}T23:00:00-04:00`);
        for (const [metros, taxaNoturna] of [
          [2000, 10],
          [3000, 12],
          [4000, 15],
        ]) {
          distancia = metros;
          const { frete: cotacao } = await teste.servico.frete({ pedido: entregaRota });
          assert.equal(cotacao.taxaEntrega, taxaNoturna, `${data} à noite, ${metros} m`);
        }
        distancia = 11000;
        await assert.rejects(teste.servico.frete({ pedido: entregaRota }), /Devido ao horário/);
      }
      em = Date.parse("2026-11-04T03:10:00Z");
      distancia = 3700;
      const noturno = await teste.servico.frete({ pedido: entregaRota });
      assert.equal(chamadas.at(-1).searchParams.get("mode"), "drive");
      assert.equal(noturno.frete.taxaEntrega, 15);
      distancia = 4100;
      await assert.rejects(teste.servico.frete({ pedido: entregaRota }), /Devido ao horário/);
      distancia = null;
      await assert.rejects(teste.servico.frete({ pedido: entregaRota }), (e) => e.status === 503);
      const limitar = criarLimitadorFreteRota(teste.db);
      teste.registros.set("config/usoFreteRotas", { dia: "2026-11-04", quantidade: 2499 });
      const tentativas = await Promise.allSettled([limitar(em), limitar(em)]);
      assert.equal(tentativas[0].status, "fulfilled");
      assert.equal(tentativas[1].reason.status, 429);
      await limitar(em + 86_400_000);
      assert.equal(teste.registros.get("config/usoFreteRotas").quantidade, 1);
    }
    f = fixture();
    entrada = {
      ...pedido(),
      tipo: "Entrega",
      areaUrbanaConfirmada: true,
      localizacao: "https://google.com/maps?q=-15.7508,-56.1035",
      endereco: "Rua I, 3",
      condominio: "Sim",
      cnh: "Sim",
      taxaEntrega: 0.01,
    };
    entrada.itens.push({ produtoId: "lata", quantidade: 3 });
    const entrega = await salvar(f, entrada, auth);
    assert(entrega.pedido.distanciaKm > 15);
    assert(entrega.pedido.taxaEntrega > 40);
    assert.equal(entrega.pedido.descontoCreditoEntrega, 5);
    assert.equal(entrega.pedido.condominio, "Sim");
    assert.equal(entrega.pedido.cnh, "Sim");
    assert.equal(new URL(entrega.pedido.localizacao).origin, "https://pedrao.exemplo");
    assert.equal(
      f.registros.get("clientes/65999999999").beneficiosEntrega.meses["2026-11"].reservado,
      500,
    );
    await assert.rejects(
      salvar(f, { ...entrada, areaUrbanaConfirmada: false }, auth),
      (e) => e.status === 400,
    );
    f = fixture();
    f.registros.set("cuponsDesconto/TESTE", {
      ativo: true,
      uso: "unico",
      tipo: "pedido",
      modo: "valor",
      valor: 5,
    });
    const comCupom = { ...pedido(), cupomDescontoCodigo: "TESTE" };
    const cotacao = await f.servico.conferir({ pedido: comCupom });
    const dados = {
      ...comCupom,
      valorTotal: cotacao.pedido.valorTotal,
      descontoCupom: cotacao.pedido.descontoCupom,
    };
    const usos = await Promise.allSettled([
      f.servico.salvar({ pedido: dados, chave }),
      f.servico.salvar({ pedido: dados, chave: "b".repeat(43) }),
    ]);
    assert.equal(
      usos.filter((r) => r.status === "fulfilled").length,
      1,
      "Um cupom único só conclui um pedido concorrente",
    );
    assert.equal(f.registros.get("cuponsDesconto/TESTE").ativo, false);
    f = fixture();
    f.registros.set("pedidos/legado", {
      tipo: "Retirada",
      numeroDia: 15,
      diaOperacional: "2026-11-03",
    });
    assert.equal(
      (await salvar(f, pedido())).pedido.numero,
      16,
      "Preserva a numeração anterior ao ativar o checkout protegido",
    );
    f = fixture();
    entrada = {
      ...pedido(),
      tipo: "Local",
      descontoFidelidade: 10,
      cupomDescontoCodigo: "TESTE",
      taxaEntrega: 999,
      descontoCreditoEntrega: 999,
    };
    const local = await f.servico.conferir({ pedido: entrada });
    assert.equal(local.pedido.valorTotal, 31);
    assert.equal(local.pedido.pagamento, "Pendente");
    assert.equal(local.pedido.itens[0].molhosPagos.length, 0);
    assert.equal(local.pedido.descontoFidelidade, 0);
    assert.equal(taxaPedido(10, Date.parse("2026-11-03T18:00:00Z")), 16);
    assert.equal(taxaPedido(12, Date.parse("2026-11-03T18:00:00Z")), 24);
    assert.equal(taxaPedido(12, Date.parse("2026-11-07T18:00:00Z")), 25);
    assert.equal(diaPedido(Date.parse("2026-11-04T05:59:59Z")), "2026-11-03");
    assert.throws(() => pontoPedido("https://maps.test/?q=100,999"));
    console.log(
      "Checkout: catálogo, identidade, preços, frete, reserva de benefícios, cupom e reenvio atômico conferidos.",
    );
  })().catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
