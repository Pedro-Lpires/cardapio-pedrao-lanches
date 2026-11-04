/* Executar SOMENTE com o Firestore Emulator em localhost e projeto demo. */
const assert = require("node:assert/strict");
const fs = require("node:fs"),
  path = require("node:path"),
  { createRequire } = require("node:module");
const host = process.env.FIRESTORE_EMULATOR_HOST;
if (host !== "127.0.0.1:8188")
  throw Error(
    "O teste de regras exige o emulador local em 127.0.0.1:8188. Não executa contra um banco real.",
  );
const pastaFerramentas = process.env.PEDRAO_FIREBASE_TEST_TOOLS;
if (!pastaFerramentas)
  throw Error("Informe PEDRAO_FIREBASE_TEST_TOOLS com a pasta das ferramentas de teste.");
const deps = createRequire(path.join(path.resolve(pastaFerramentas), "package.json"));
const { initializeTestEnvironment, assertSucceeds, assertFails } = deps(
  "@firebase/rules-unit-testing",
);
const {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  getDocs,
  query,
  where,
  setLogLevel,
} = deps("firebase/firestore");
setLogLevel("silent"); // Recusas são esperadas e verificadas por assertFails.
const projeto = "demo-pedrao-seguranca";
const clienteA = "65999999999",
  clienteB = "65988888888";
let ambiente,
  total = 0;
async function permitir(promessa) {
  await assertSucceeds(promessa);
  total++;
}
async function negar(promessa) {
  await assertFails(promessa);
  total++;
}
const perfil = (uid, telefone, nome = "Pessoa Teste") => ({
  nome,
  telefone,
  authUid: uid,
  acessoSenhaCriadoEm: 1000,
  avatar: "images/avatares/bronze/maionese.webp",
  nivelCliente: "Bronze",
  fidelidadeAtiva: true,
  bonusDisponivel: 20,
});
const contexto = (uid, claims) => ambiente.authenticatedContext(uid, claims).firestore();
(async () => {
  ambiente = await initializeTestEnvironment({
    projectId: projeto,
    firestore: {
      host: "127.0.0.1",
      port: 8188,
      rules: fs.readFileSync("security/firestore.proposta.rules", "utf8"),
    },
  });
  await ambiente.withSecurityRulesDisabled(async (c) => {
    const db = c.firestore();
    const dados = {
      "produtos/lanche": { nome: "Baguncinha", preco: 25, ativo: true },
      "adicionais/bacon": { nome: "Bacon", preco: 6, ativo: true },
      "config/loja": { aberta: true },
      "config/beneficios": { creditoEntrega: { ativo: false } },
      "config/admin": { senhaMestre: "somente-fixture", senhaFinanceiro: "somente-fixture" },
      "config/producaoTela": { limpaAntes: 1000, limpoPor: "Teste" },
      "atendentes/atendimento": {
        nome: "Atendente Teste",
        ativo: true,
        perfil: "atendimento",
        codigo: "123456",
      },
      "atendentes/chapa": { nome: "Chapa Teste", ativo: true, perfil: "chapa", codigo: "789012" },
      "atendentes/ambos": { nome: "Ambos Teste", ativo: true, perfil: "ambos", codigo: "345678" },
      "atendentes/inativo": { nome: "Inativo", ativo: false, perfil: "ambos", codigo: "901234" },
      "atendentes/legado": { nome: "Legado", ativo: true },
      "atendentes/perfil-nulo": { nome: "Perfil Nulo", ativo: true, perfil: null },
      ["clientes/" + clienteA]: perfil("uid-a", clienteA),
      ["clientes/" + clienteB]: perfil("uid-b", clienteB),
      "pedidos/a": {
        clienteId: clienteA,
        clienteAuthUid: "uid-a",
        valorTotal: 25,
        tipo: "Entrega",
      },
      "pedidos/b": {
        clienteId: clienteB,
        clienteAuthUid: "uid-b",
        valorTotal: 35,
        tipo: "Retirada",
      },
      "pedidos/legado-a": { clienteId: clienteA, valorTotal: 50, tipo: "Entrega" },
      "comandas/mesa-a": {
        sessaoAutoatendimentoId: "sessao-a",
        mesa: 1,
        status: "Aberta",
        valorTotal: 25,
      },
      "comandas/mesa-b": {
        sessaoAutoatendimentoId: "sessao-b",
        mesa: 2,
        status: "Aberta",
        valorTotal: 30,
      },
      "sessoesMesa/sessao-a": {
        mesaId: "mesa-1",
        status: "ativa",
        nome: "Visitante A",
        visitaAuthUid: "visita-a",
        pedidoEnviado: true,
        comandaId: "mesa-a",
      },
      "sessoesMesa/sessao-b": { mesaId: "mesa-2", status: "ativa", nome: "Visitante B" },
      "mesas/mesa-1": { numero: 1, ocupada: true },
      "mesas/mesa-2": { numero: 2, ocupada: true },
      "historicoPagamentosClientes/a": {
        clienteId: clienteA,
        clienteAuthUid: "uid-a",
        valorPago: 25,
      },
      "historicoPagamentosClientes/b": {
        clienteId: clienteB,
        clienteAuthUid: "uid-b",
        valorPago: 35,
      },
      "filaCozinha/lanche-a": {
        status: "aguardando",
        origemId: "a",
        origemColecao: "pedidos",
        itens: [{ nome: "Baguncinha", quantidade: 1 }],
        criadoEmMs: 1000,
      },
      "filaCozinha/lanche-b": {
        status: "aguardando",
        origemId: "b",
        origemColecao: "pedidos",
        itens: [{ nome: "X-Bacon", quantidade: 1 }],
        criadoEmMs: 1000,
      },
      "raspadinhas/premio-a": {
        clienteId: clienteA,
        status: "disponivel",
        premioNome: "Coca lata",
        expiraEm: 9999999999999,
      },
      "raspadinhas/premio-b": {
        clienteId: clienteB,
        status: "disponivel",
        premioNome: "Batata",
        expiraEm: 9999999999999,
      },
      ["clientes/" + clienteA + "/mensagens/aviso"]: {
        remetente: "admin",
        texto: "Mensagem ficticia",
        tipo: "admin",
        data: "2026-11-03T12:00:00.000Z",
        lida: false,
      },
      ["clientes/" + clienteB + "/mensagens/aviso"]: {
        remetente: "admin",
        texto: "Outra conta",
        tipo: "admin",
        lida: false,
      },
      ["clientes/" + clienteA + "/chamados/chat"]: { status: "aberto", categoria: "outros" },
      ["clientes/" + clienteA + "/cupons/cupom"]: { codigo: "TESTE", usosRestantes: 1 },
      "cuponsDesconto/TESTE": { codigo: "TESTE", clientesPermitidos: [clienteA], ativo: true },
      "rankMovimentos/a": { clienteId: clienteA, clienteAuthUid: "uid-a", centavos: 2500 },
      "fechamentosFinanceiros/hoje": { recebido: 1000, observacao: "Ficticio" },
      "authRecuperacoes/u": { hash: "fixture", status: "emitido" },
      ["authClientesTeste/" + clienteA]: { adminUid: "dono", preparadoEm: 1000 },
      "authTentativasCliente/global": { quantidade: 1, inicio: 1000 },
      "authTentativasEquipe/global": { quantidade: 1, inicio: 1000 },
      "authTentativasPedido/global": { quantidade: 1, inicio: 1000 },
      "authTentativasMesa/global": { quantidade: 1, inicio: 1000 },
      "authVisitasMesa/teste": { segredoHash: "hash-ficticio" },
    };
    for (const [caminho, valores] of Object.entries(dados)) await setDoc(doc(db, caminho), valores);
  });
  const anonimo = ambiente.unauthenticatedContext().firestore();
  const a = contexto("uid-a", {
    acessoCliente: true,
    clienteId: clienteA,
    historicoLegadoVerificado: false,
  });
  const b = contexto("uid-b", {
    acessoCliente: true,
    clienteId: clienteB,
    historicoLegadoVerificado: false,
  });
  const legado = contexto("uid-a", {
    acessoCliente: true,
    clienteId: clienteA,
    historicoLegadoVerificado: true,
  });
  const falso = contexto("invasor", { acessoCliente: true, clienteId: clienteA });
  const semCargo = contexto("sem-cargo", {});
  const atendente = contexto("func-atendimento", { funcionarioId: "atendimento" });
  const chapeiro = contexto("func-chapa", { funcionarioId: "chapa" });
  const ambos = contexto("func-ambos", { funcionarioId: "ambos" });
  const inativo = contexto("func-inativo", { funcionarioId: "inativo" });
  const funcionarioLegado = contexto("func-legado", { funcionarioId: "legado" });
  const funcionarioNulo = contexto("func-nulo", { funcionarioId: "perfil-nulo" });
  const dono = contexto("dono-ficticio", { admin: true });
  const visitante = contexto("visita-a", {
    visitaMesa: true,
    sessaoMesaId: "sessao-a",
    mesaId: "mesa-1",
  });

  await permitir(getDoc(doc(anonimo, "produtos/lanche")));
  await permitir(getDocs(collection(anonimo, "produtos")));
  await permitir(getDoc(doc(anonimo, "config/loja")));
  await permitir(getDoc(doc(anonimo, "adicionais/bacon")));
  for (const db of [anonimo, semCargo, falso]) {
    await negar(getDoc(doc(db, "clientes/" + clienteA)));
    await negar(getDocs(collection(db, "clientes")));
    await negar(getDoc(doc(db, "config/admin")));
    await negar(getDocs(query(collection(db, "atendentes"), where("codigo", "==", "123456"))));
    await negar(getDoc(doc(db, "fechamentosFinanceiros/hoje")));
    await negar(
      setDoc(doc(db, "pedidos/forjado"), {
        clienteId: clienteA,
        valorTotal: 0,
        pagamentoConfirmado: true,
      }),
    );
  }
  await permitir(getDoc(doc(a, "clientes/" + clienteA)));
  await negar(getDoc(doc(a, "clientes/" + clienteB)));
  await negar(getDoc(doc(b, "clientes/" + clienteA)));
  await permitir(updateDoc(doc(a, "clientes/" + clienteA), { nome: "Pessoa D'Avila Teste" }));
  await permitir(
    updateDoc(doc(a, "clientes/" + clienteA), { avatar: "images/avatares/bronze/maionese.webp" }),
  );
  for (const patch of [
    { bonusDisponivel: 999 },
    { nivelCliente: "Imortal" },
    { fidelidadeAtiva: false },
    { codigoAtivacao: "1111" },
    { authUid: "outra" },
    { telefone: clienteB },
    { beneficiosEntrega: { bloqueado: false } },
    { totalGasto: 9000 },
    { rankMensal: { nivel: "Imortal" } },
    { nome: "<img src=x onerror=alert(1)>" },
  ])
    await negar(updateDoc(doc(a, "clientes/" + clienteA), patch));
  await negar(setDoc(doc(a, "clientes/65977777777"), perfil("uid-a", "65977777777")));
  await permitir(getDoc(doc(a, "pedidos/a")));
  await negar(getDoc(doc(a, "pedidos/b")));
  await negar(getDoc(doc(a, "pedidos/legado-a")));
  await permitir(getDoc(doc(legado, "pedidos/legado-a")));
  await permitir(getDocs(query(collection(a, "pedidos"), where("clienteAuthUid", "==", "uid-a"))));
  await negar(getDocs(query(collection(a, "pedidos"), where("clienteId", "==", clienteA))));
  await permitir(getDocs(query(collection(legado, "pedidos"), where("clienteId", "==", clienteA))));
  await negar(updateDoc(doc(a, "pedidos/a"), { pagamentoConfirmado: true, valorTotal: 0 }));
  await permitir(getDoc(doc(a, "historicoPagamentosClientes/a")));
  await negar(getDoc(doc(a, "historicoPagamentosClientes/b")));
  await permitir(getDoc(doc(a, "clientes/" + clienteA + "/cupons/cupom")));
  await negar(updateDoc(doc(a, "clientes/" + clienteA + "/cupons/cupom"), { usosRestantes: 99 }));
  await negar(getDoc(doc(a, "cuponsDesconto/TESTE")));
  await permitir(getDoc(doc(a, "clientes/" + clienteA + "/mensagens/aviso")));
  await negar(getDoc(doc(a, "clientes/" + clienteB + "/mensagens/aviso")));
  await permitir(updateDoc(doc(a, "clientes/" + clienteA + "/mensagens/aviso"), { lida: true }));
  await negar(
    updateDoc(doc(a, "clientes/" + clienteA + "/mensagens/aviso"), { texto: "Cupom falso" }),
  );
  await permitir(
    setDoc(doc(a, "clientes/" + clienteA + "/mensagens/suporte"), {
      tipo: "suporte",
      texto: "Preciso de ajuda",
      remetente: "cliente",
      data: "2026-11-03T12:00:00.000Z",
      lida: false,
    }),
  );
  await negar(
    setDoc(doc(a, "clientes/" + clienteA + "/mensagens/admin-falso"), {
      tipo: "admin",
      texto: "Cupom",
      remetente: "admin",
      data: "2026-11-03T12:00:00.000Z",
      lida: false,
    }),
  );
  await negar(
    setDoc(doc(a, "clientes/" + clienteA + "/chamados/forjado"), {
      status: "aberto",
      pedidoId: "b",
    }),
  );
  await permitir(
    setDoc(doc(a, "clientes/" + clienteA + "/chamados/chat/mensagens/m1"), {
      texto: "Mensagem ficticia",
      remetente: "cliente",
      data: "2026-11-03T12:00:00.000Z",
      lida: false,
    }),
  );
  await negar(
    setDoc(doc(b, "clientes/" + clienteA + "/chamados/chat/mensagens/m2"), {
      texto: "Outra conta",
      remetente: "cliente",
      data: "2026-11-03T12:00:00.000Z",
      lida: false,
    }),
  );
  await permitir(getDoc(doc(a, "raspadinhas/premio-a")));
  await negar(getDoc(doc(a, "raspadinhas/premio-b")));
  await permitir(updateDoc(doc(a, "raspadinhas/premio-a"), { reveladaEm: 123456 }));
  await negar(updateDoc(doc(a, "raspadinhas/premio-a"), { reveladaEm: 123457 }));
  await negar(
    updateDoc(doc(a, "raspadinhas/premio-a"), { status: "usada", premioNome: "Combo gratis" }),
  );

  await permitir(getDoc(doc(atendente, "clientes/" + clienteA)));
  await permitir(getDocs(collection(atendente, "pedidos")));
  await permitir(updateDoc(doc(atendente, "pedidos/a"), { pagamentoConfirmado: true }));
  await permitir(updateDoc(doc(atendente, "clientes/" + clienteA), { bonusDisponivel: 10 }));
  await negar(updateDoc(doc(atendente, "clientes/" + clienteA), { authUid: "func-atendimento" }));
  await negar(updateDoc(doc(dono, "clientes/" + clienteA), { authUid: "dono-ficticio" }));
  await permitir(setDoc(doc(atendente, "config/contadorPedidos_2026-11-03"), { ultimoNumero: 1 }));
  await negar(getDoc(doc(atendente, "config/admin")));
  await negar(getDoc(doc(atendente, "fechamentosFinanceiros/hoje")));
  await negar(setDoc(doc(atendente, "atendentes/novo-admin"), { ativo: true, perfil: "ambos" }));
  await permitir(getDoc(doc(atendente, "atendentes/atendimento")));
  await negar(getDoc(doc(atendente, "atendentes/chapa")));
  await permitir(getDoc(doc(chapeiro, "filaCozinha/lanche-a")));
  await permitir(
    updateDoc(doc(chapeiro, "filaCozinha/lanche-a"), { status: "pronto", concluidoEm: 12345 }),
  );
  await permitir(
    updateDoc(doc(chapeiro, "filaCozinha/lanche-a"), { status: "aguardando", concluidoEm: null }),
  );
  await negar(updateDoc(doc(chapeiro, "filaCozinha/lanche-a"), { itens: [] }));
  await negar(deleteDoc(doc(chapeiro, "filaCozinha/lanche-a")));
  await negar(setDoc(doc(chapeiro, "filaCozinha/forjado"), { status: "aguardando", itens: [] }));
  await permitir(
    updateDoc(doc(chapeiro, "config/producaoTela"), { limpaAntes: 23456, limpoPor: "Chapa Teste" }),
  );
  for (const caminho of [
    "clientes/" + clienteA,
    "pedidos/a",
    "comandas/mesa-a",
    "config/admin",
    "fechamentosFinanceiros/hoje",
  ])
    await negar(getDoc(doc(chapeiro, caminho)));
  await permitir(getDoc(doc(ambos, "filaCozinha/lanche-a")));
  await permitir(getDoc(doc(ambos, "comandas/mesa-a")));
  for (const db of [funcionarioLegado, funcionarioNulo]) {
    await permitir(getDoc(doc(db, "filaCozinha/lanche-a")));
    await permitir(getDoc(doc(db, "comandas/mesa-a")));
    await negar(getDoc(doc(db, "config/admin")));
  }
  await negar(getDoc(doc(inativo, "filaCozinha/lanche-a")));
  await negar(getDoc(doc(inativo, "pedidos/a")));
  await permitir(updateDoc(doc(dono, "atendentes/atendimento"), { ativo: false }));
  await negar(getDoc(doc(atendente, "pedidos/a")));
  await negar(updateDoc(doc(atendente, "pedidos/a"), { pagamentoConfirmado: false }));

  await permitir(getDoc(doc(visitante, "sessoesMesa/sessao-a")));
  await negar(getDoc(doc(visitante, "sessoesMesa/sessao-b")));
  await permitir(getDoc(doc(visitante, "mesas/mesa-1")));
  await negar(getDoc(doc(visitante, "mesas/mesa-2")));
  await negar(getDocs(collection(visitante, "mesas")));
  await permitir(getDoc(doc(visitante, "comandas/mesa-a")));
  await negar(getDoc(doc(visitante, "comandas/mesa-b")));
  await negar(updateDoc(doc(visitante, "comandas/mesa-a"), { valorTotal: 0, status: "Fechada" }));
  await negar(getDoc(doc(visitante, "clientes/" + clienteA)));
  await permitir(getDoc(doc(dono, "config/admin")));
  await permitir(getDoc(doc(dono, "fechamentosFinanceiros/hoje")));
  for (const db of [anonimo, a, chapeiro, ambos, dono])
    for (const caminho of [
      "authRecuperacoes/u",
      "authClientesTeste/" + clienteA,
      "authTentativasCliente/global",
      "authTentativasEquipe/global",
      "authTentativasPedido/global",
      "authTentativasMesa/global",
      "authVisitasMesa/teste",
    ]) {
      await negar(getDoc(doc(db, caminho)));
      await negar(setDoc(doc(db, caminho), { forjado: true }));
    }
  await ambiente.withSecurityRulesDisabled(async (c) => {
    await setDoc(doc(c.firestore(), "authRecuperacoes/uid-a"), {
      status: "emitido",
      revogadoAntesEm: 100500,
    });
  });
  const senhaAntiga = contexto("uid-a", {
    acessoCliente: true,
    clienteId: clienteA,
    auth_time: 100,
    iat: 500,
  });
  const senhaNova = contexto("uid-a", { acessoCliente: true, clienteId: clienteA, auth_time: 101 });
  await negar(getDoc(doc(senhaAntiga, "clientes/" + clienteA)));
  await negar(getDoc(doc(senhaAntiga, "pedidos/a")));
  await permitir(getDoc(doc(senhaNova, "clientes/" + clienteA)));
  await negar(getDoc(doc(senhaNova, "authRecuperacoes/uid-a")));
  assert(total > 100);
  console.log(
    `PASS: ${total} verificacoes de acesso no Firestore Emulator: contas isoladas, cadastro por UID, perfis da equipe, caixa, privacidade de codigos/recuperacao, visita e fila de preparo.`,
  );
})()
  .catch((erro) => {
    console.error(erro);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (ambiente) await ambiente.cleanup();
  });
