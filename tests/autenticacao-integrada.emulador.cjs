/* Autenticação nativa + REST + regras, exclusivamente nos emuladores oficiais. */
const assert = require("node:assert/strict"),
  crypto = require("node:crypto"),
  path = require("node:path"),
  { createRequire } = require("node:module");
if (
  process.env.FIRESTORE_EMULATOR_HOST !== "127.0.0.1:8188" ||
  process.env.FIREBASE_AUTH_EMULATOR_HOST !== "127.0.0.1:9099"
)
  throw Error("Emuladores locais obrigatórios; execução contra serviços reais é proibida.");
const deps = createRequire(path.resolve(process.env.PEDRAO_FIREBASE_TEST_TOOLS, "package.json"));
const { initializeApp, deleteApp } = deps("firebase/app");
const {
  getAuth,
  connectAuthEmulator,
  signInWithCustomToken,
  signInWithEmailAndPassword,
  getIdToken,
  signOut,
  confirmPasswordReset,
} = deps("firebase/auth");
const {
  getFirestore,
  connectFirestoreEmulator,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  terminate,
  setLogLevel,
} = deps("firebase/firestore");
const {
  initializeApp: initializeAdmin,
  cert,
  deleteApp: deleteAdmin,
} = require("firebase-admin/app");
const { getAuth: getAdminAuth } = require("firebase-admin/auth");
const { criarServicoAcessoCliente, emailCliente } = require("../api/_lib/acesso-cliente.cjs");
const { criarArmazenamentoAcessoCliente } = require("../api/_lib/acesso-cliente-rest.cjs");
const { criarServicoAcessoEquipe } = require("../api/_lib/acesso-equipe.cjs");
const { criarArmazenamentoAcessoEquipe } = require("../api/_lib/acesso-equipe-rest.cjs");
const {
  criarServicoRecuperacao,
  criarArmazenamentoRecuperacao,
} = require("../api/_lib/recuperacao-acesso.cjs");
const { criarDbRecuperacaoRest } = require("../api/_lib/recuperacao-firestore-rest.cjs");
const { criarDbOperacaoRest } = require("../api/_lib/operacao-firestore-rest.cjs");
const { criarServicoPedidoPublico } = require("../api/_lib/pedido-publico.cjs");
const { criarLimitadorPedido } = require("../api/_lib/pedido-publico-runtime.cjs");
const { criarServicoMesaPublica } = require("../api/_lib/mesa-publica.cjs");
const projeto = "demo-pedrao-seguranca",
  telefone = "65977777777",
  outro = "65966666666",
  senha = "Senha ficticia 123";
const apps = [],
  bancos = [];
let adminApp;
setLogLevel("silent");
// O domínio/projeto e o destino HTTP são conferidos antes de qualquer chamada REST.
async function fetchSomenteEmulador(url, opcoes) {
  const origem = new URL(url);
  assert.equal(origem.origin, "https://firestore.googleapis.com");
  assert(origem.pathname.startsWith("/v1/projects/" + projeto + "/databases/(default)/documents"));
  return fetch("http://127.0.0.1:8188" + origem.pathname + origem.search, opcoes);
}
const servidorDb = {
  projectId: projeto,
  obterToken: async () => ({ access_token: "owner" }),
  fetchHttp: fetchSomenteEmulador,
};
async function gravar(caminho, dados) {
  const fields = Object.fromEntries(
    Object.entries(dados).map(([k, v]) => [
      k,
      typeof v === "boolean"
        ? { booleanValue: v }
        : typeof v === "number"
          ? { integerValue: String(v) }
          : { stringValue: v },
    ]),
  );
  const res = await fetch(
    "http://127.0.0.1:8188/v1/projects/" + projeto + "/databases/(default)/documents/" + caminho,
    {
      method: "PATCH",
      headers: { Authorization: "Bearer owner", "Content-Type": "application/json" },
      body: JSON.stringify({ fields }),
    },
  );
  assert.equal(res.ok, true);
}
function clienteApp(nome) {
  const app = initializeApp(
    {
      projectId: projeto,
      apiKey: "chave-publica-ficticia",
      authDomain: projeto + ".firebaseapp.com",
    },
    nome,
  );
  apps.push(app);
  const auth = getAuth(app);
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  const db = getFirestore(app);
  connectFirestoreEmulator(db, "127.0.0.1", 8188);
  bancos.push(db);
  return { auth, db };
}
(async () => {
  const { privateKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
  adminApp = initializeAdmin(
    {
      projectId: projeto,
      credential: cert({
        projectId: projeto,
        clientEmail: "firebase-adminsdk@" + projeto + ".iam.gserviceaccount.com",
        privateKey: privateKey.export({ type: "pkcs8", format: "pem" }),
      }),
    },
    "integracao-demo",
  );
  const auth = getAdminAuth(adminApp);
  const contaCliente = criarServicoAcessoCliente({
    auth,
    armazenamento: criarArmazenamentoAcessoCliente(servidorDb),
    siteUrl: "https://pedrao.exemplo/",
    adminUids: ["dono-integracao"],
    conferirSenha: async () => {
      throw Error("Fluxo não usado aqui");
    },
  });
  const equipe = criarServicoAcessoEquipe({
    auth,
    armazenamento: criarArmazenamentoAcessoEquipe(servidorDb),
    siteUrl: "https://pedrao.exemplo/",
    adminUids: ["dono-integracao"],
  });
  const pessoa = clienteApp("cliente-integracao"),
    terceira = clienteApp("terceira-integracao"),
    chapa = clienteApp("chapa-integracao"),
    dono = clienteApp("dono-integracao");
  await gravar("clientes/" + outro, {
    nome: "Outra Pessoa Teste",
    telefone: outro,
    authUid: "outra-pessoa",
    bonusDisponivel: 99,
  });
  const cadastro = await contaCliente.criarSenha({
    telefone,
    nome: "Pessoa Integracao",
    senha,
    confirmacao: senha,
  });
  await signInWithCustomToken(pessoa.auth, cadastro.token);
  let token = await getIdToken(pessoa.auth.currentUser, true);
  assert.equal((await contaCliente.perfil("Bearer " + token)).cliente.nome, "Pessoa Integracao");
  assert.equal((await getDoc(doc(pessoa.db, "clientes/" + telefone))).data().telefone, telefone);
  await assert.rejects(
    getDoc(doc(pessoa.db, "clientes/" + outro)),
    (e) => e.code === "permission-denied",
  );
  await assert.rejects(
    updateDoc(doc(pessoa.db, "clientes/" + telefone), { bonusDisponivel: 1000 }),
    (e) => e.code === "permission-denied",
  );
  await updateDoc(doc(pessoa.db, "clientes/" + telefone), { nome: "Pessoa Integracao Editada" });
  await signOut(pessoa.auth);
  await signInWithEmailAndPassword(pessoa.auth, emailCliente(telefone), senha);
  const dbPedidos = criarDbOperacaoRest({
    ...servidorDb,
    colecoes: [
      "produtos",
      "adicionais",
      "config",
      "clientes",
      "pedidos",
      "cuponsDesconto",
      "authTentativasPedido",
      "comandas",
      "historicoPagamentosClientes",
      "rankMovimentos",
      "mesas",
      "sessoesMesa",
      "authVisitasMesa",
      "filaCozinha",
      "chamadosMesa",
      "authTentativasMesa",
    ],
  });
  await dbPedidos.runTransaction(async (t) => {
    t.set(dbPedidos.collection("produtos").doc("lanche-integracao"), {
      nome: "Lanche Integracao",
      categoria: "lanches",
      ativo: true,
      preco: 25,
    });
    t.set(dbPedidos.collection("adicionais").doc("bacon-integracao"), {
      nome: "Bacon Integracao",
      ativo: true,
      preco: 6,
    });
    t.set(dbPedidos.collection("config").doc("loja"), { aberta: true });
    t.set(dbPedidos.collection("cuponsDesconto").doc("INTEGRACAO"), {
      ativo: true,
      uso: "unico",
      tipo: "pedido",
      modo: "valor",
      valor: 5,
    });
    t.update(dbPedidos.collection("clientes").doc(telefone), {
      fidelidadeAtiva: true,
      bonusDisponivel: 10,
      totalFidelidade: 290,
    });
  });
  const pedidos = criarServicoPedidoPublico({
    db: dbPedidos,
    auth,
    siteUrl: "https://pedrao.exemplo/",
    consumirTentativa: criarLimitadorPedido(dbPedidos),
  });
  const compra = {
    tipo: "Retirada",
    nome: "Pessoa Integracao Editada",
    telefone,
    pagamento: "Pix",
    itens: [
      {
        produtoId: "lanche-integracao",
        quantidade: 1,
        preco: 0.01,
        adicionais: [{ nome: "Bacon Integracao", quantidade: 1, preco: 0 }],
      },
    ],
    cupomDescontoCodigo: "INTEGRACAO",
    descontoFidelidade: 10,
    descontoCreditoEntrega: 0,
    taxaEntrega: 0,
  };
  const authorization = "Bearer " + (await getIdToken(pessoa.auth.currentUser, true));
  assert.equal((await pedidos.perfil({ authorization })).cliente.rankMensal.competencia.length, 7);
  const cotacao = await pedidos.conferir({
    pedido: compra,
    authorization,
    origemRede: "rede-integracao",
  });
  assert.equal(cotacao.pedido.valorTotal, 16);
  assert.equal(cotacao.pedido.itens[0].adicionais[0].preco, 6);
  const dadosCompra = {
    ...compra,
    descontoCupom: cotacao.pedido.descontoCupom,
    valorTotal: cotacao.pedido.valorTotal,
  };
  const argumentosCompra = {
    pedido: dadosCompra,
    authorization,
    origemRede: "rede-integracao",
    chave: "checkout-integracao-" + crypto.randomBytes(24).toString("hex"),
  };
  const salvo = await pedidos.salvar(argumentosCompra);
  const repetido = await pedidos.salvar(argumentosCompra);
  assert.equal(repetido.repetido, true);
  assert.equal(salvo.pedido.id, repetido.pedido.id);
  assert.equal(
    (await getDoc(doc(pessoa.db, "pedidos/" + salvo.pedido.id))).data().clienteAuthUid,
    pessoa.auth.currentUser.uid,
  );
  assert.equal((await getDoc(doc(pessoa.db, "clientes/" + telefone))).data().bonusDisponivel, 0);
  assert.equal((await getDoc(doc(pessoa.db, "clientes/" + telefone))).data().totalFidelidade, 290);
  await assert.rejects(
    getDoc(doc(terceira.db, "pedidos/" + salvo.pedido.id)),
    (e) => e.code === "permission-denied",
  );
  await assert.rejects(
    pedidos.salvar({
      ...argumentosCompra,
      chave: "outro-checkout-" + crypto.randomBytes(24).toString("hex"),
    }),
    (e) => e.status === 409,
  );
  await assert.rejects(
    updateDoc(doc(pessoa.db, "pedidos/" + salvo.pedido.id), {
      valorTotal: 0,
      pagamentoConfirmado: true,
    }),
    (e) => e.code === "permission-denied",
  );
  const mesas = criarServicoMesaPublica({
    db: dbPedidos,
    auth,
    pedidos,
    consumirTentativa: criarLimitadorPedido(dbPedidos, {
      colecao: "authTentativasMesa",
      limites: [600, 300, 100],
    }),
  });
  const dadosVisita = {
    mesa: 19,
    segredo: crypto.randomBytes(32).toString("hex"),
    nome: "Visitante Integracao",
  };
  const inicioMesa = await mesas.iniciar(dadosVisita);
  assert.equal(inicioMesa.sessao.pedidoEnviado, false);
  const envioMesa = await mesas.enviar({
    ...dadosVisita,
    itens: [{ produtoId: "lanche-integracao", quantidade: 1 }],
    valorTotalEsperado: 25,
  });
  const visita = clienteApp("visita-integracao");
  await signInWithCustomToken(visita.auth, envioMesa.token);
  assert.equal(
    (await getDoc(doc(visita.db, "comandas/" + envioMesa.sessao.comandaId))).data().valorTotal,
    25,
  );
  assert.equal((await mesas.retomar(dadosVisita)).sessao.id, envioMesa.sessao.id);
  await assert.rejects(
    getDoc(doc(visita.db, "clientes/" + telefone)),
    (e) => e.code === "permission-denied",
  );
  await assert.rejects(
    getDoc(doc(visita.db, "authVisitasMesa/" + envioMesa.sessao.id)),
    (e) => e.code === "permission-denied",
  );
  assert.equal((await mesas.chamar({ ...dadosVisita, tipo: "conta" })).repetido, false);
  await dbPedidos.runTransaction(async (t) => {
    t.update(dbPedidos.collection("comandas").doc(envioMesa.sessao.comandaId), {
      status: "Fechada",
    });
  });
  await assert.rejects(
    getDoc(doc(visita.db, "comandas/" + envioMesa.sessao.comandaId)),
    (e) => e.code === "permission-denied",
  );
  assert.equal((await mesas.retomar(dadosVisita)).sessaoEncerrada, true);
  assert.throws(() => dbPedidos.collection("atendentes").doc("proibido"));
  assert.equal(
    (await getDoc(doc(pessoa.db, "clientes/" + telefone))).data().nome,
    "Pessoa Integracao Editada",
  );
  await assert.rejects(
    signInWithEmailAndPassword(terceira.auth, emailCliente(telefone), "Senha errada 123"),
  );
  await assert.rejects(
    contaCliente.criarSenha({
      telefone,
      nome: "Pessoa Integracao Editada",
      senha: "Outra senha 123",
      confirmacao: "Outra senha 123",
    }),
    (e) => e.status === 409,
  );
  await gravar("atendentes/chapa-integracao", {
    nome: "Chapa Integracao",
    perfil: "chapa",
    ativo: true,
    codigo: "654321",
  });
  const acesso = await equipe.entrar({ codigo: "654321", origemRede: "rede-integracao" });
  await signInWithCustomToken(chapa.auth, acesso.token);
  assert.equal(
    (await equipe.perfil("Bearer " + (await getIdToken(chapa.auth.currentUser)))).funcionario
      .perfil,
    "chapa",
  );
  await gravar("filaCozinha/integracao", { status: "aguardando", criadoEmMs: Date.now() });
  await getDoc(doc(chapa.db, "filaCozinha/integracao"));
  await updateDoc(doc(chapa.db, "filaCozinha/integracao"), {
    status: "pronto",
    concluidoEm: Date.now(),
  });
  await assert.rejects(
    getDoc(doc(chapa.db, "clientes/" + telefone)),
    (e) => e.code === "permission-denied",
  );
  await assert.rejects(
    getDoc(doc(chapa.db, "config/admin")),
    (e) => e.code === "permission-denied",
  );
  await auth.createUser({ uid: "dono-integracao", email: "dono@teste.invalid", password: senha });
  await signInWithEmailAndPassword(dono.auth, "dono@teste.invalid", senha);
  await assert.rejects(
    getDoc(doc(dono.db, "clientes/" + telefone)),
    (e) => e.code === "permission-denied",
  );
  await equipe.proprietario("Bearer " + (await getIdToken(dono.auth.currentUser)));
  await getIdToken(dono.auth.currentUser, true);
  await getDoc(doc(dono.db, "clientes/" + telefone));
  await updateDoc(doc(dono.db, "atendentes/chapa-integracao"), { ativo: false });
  await assert.rejects(
    getDoc(doc(chapa.db, "filaCozinha/integracao")),
    (e) => e.code === "permission-denied",
  );
  await assert.rejects(
    equipe.perfil("Bearer " + (await getIdToken(chapa.auth.currentUser))),
    (e) => e.status === 401,
  );
  await assert.rejects(
    equipe.proprietario("Bearer " + (await getIdToken(pessoa.auth.currentUser))),
    (e) => e.status === 403,
  );
  await assert.rejects(
    setDoc(doc(dono.db, "authRecuperacoes/tentativa"), { falso: true }),
    (e) => e.code === "permission-denied",
  );
  const telefoneTeste = "65955555555";
  await gravar("clientes/" + telefoneTeste, {
    nome: "Conta Teste Antiga",
    telefone: telefoneTeste,
    bonusDisponivel: 17,
    nivelCliente: "Prata",
    avatar: "images/avatares/prata/maionese.webp",
  });
  await contaCliente.prepararTestes("Bearer " + (await getIdToken(dono.auth.currentUser)));
  assert.equal(
    (await contaCliente.entrarTeste({ telefone: telefoneTeste, nome: "Conta Teste Antiga" }))
      .cliente.precisaCriarSenha,
    true,
  );
  const migracao = await contaCliente.criarSenha({
    telefone: telefoneTeste,
    nome: "Conta Teste Antiga",
    senha,
    confirmacao: senha,
  });
  await signInWithCustomToken(terceira.auth, migracao.token);
  const perfilMigrado = (
    await contaCliente.perfil("Bearer " + (await getIdToken(terceira.auth.currentUser)))
  ).cliente;
  assert.equal(perfilMigrado.bonusDisponivel, 17);
  assert.equal(perfilMigrado.nivelCliente, "Prata");
  assert.equal(perfilMigrado.historicoLegadoVerificado, true);
  await assert.rejects(
    contaCliente.entrarTeste({ telefone: telefoneTeste, nome: "Conta Teste Antiga" }),
    (e) => e.status === 401,
  );
  let agora = Date.now();
  const recuperacao = criarServicoRecuperacao({
    auth,
    armazenamento: criarArmazenamentoRecuperacao(criarDbRecuperacaoRest(servidorDb)),
    chave: crypto.randomBytes(32),
    siteUrl: "https://pedrao.exemplo/",
    adminUids: ["dono-integracao"],
    agora: () => agora,
    aplicarSenha: (codigo, novaSenha) => confirmPasswordReset(pessoa.auth, codigo, novaSenha),
  });
  const emitido = await recuperacao.emitir({
    authorization: "Bearer " + (await getIdToken(dono.auth.currentUser)),
    telefone,
  });
  const tokenRecuperacao = new URLSearchParams(new URL(emitido.link).hash.slice(1)).get("token");
  assert.equal(emitido.expiraEm - agora, 30 * 60 * 1000);
  await recuperacao.conferir(tokenRecuperacao);
  const novaSenha = "Nova senha ficticia 456";
  await recuperacao.redefinir({
    token: tokenRecuperacao,
    senha: novaSenha,
    confirmacao: novaSenha,
  });
  await assert.rejects(
    getDoc(doc(pessoa.db, "clientes/" + telefone)),
    (e) => e.code === "permission-denied",
  );
  await assert.rejects(
    recuperacao.redefinir({ token: tokenRecuperacao, senha, confirmacao: senha }),
    (e) => e.status === 410,
  );
  await signOut(pessoa.auth);
  await assert.rejects(signInWithEmailAndPassword(pessoa.auth, emailCliente(telefone), senha));
  await new Promise((resolve) => setTimeout(resolve, 1100));
  await signInWithEmailAndPassword(pessoa.auth, emailCliente(telefone), novaSenha);
  assert.equal(
    (await getDoc(doc(pessoa.db, "clientes/" + telefone))).data().nome,
    "Pessoa Integracao Editada",
  );
  agora += 60001;
  const expira = await recuperacao.emitir({
    authorization: "Bearer " + (await getIdToken(dono.auth.currentUser)),
    telefone,
  });
  agora += 30 * 60 * 1000;
  const tokenExpirado = new URLSearchParams(new URL(expira.link).hash.slice(1)).get("token");
  await assert.rejects(recuperacao.conferir(tokenExpirado), (e) => e.status === 410);
  console.log(
    "PASS: Auth + Firestore integrados: senha/login, primeira senha de teste, recuperação nativa de uso único e 30 minutos, checkout com preço e acréscimo reconstruídos, cupom único, reserva sem antecipar fidelidade, reenvio idempotente, histórico isolado, token da chapa, proprietário e desativação sem renovar token.",
  );
})()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await Promise.all(bancos.map((db) => terminate(db)));
    await Promise.all(apps.map((app) => deleteApp(app)));
    if (adminApp) await deleteAdmin(adminApp);
  });
