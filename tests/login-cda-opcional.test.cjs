const fs = require("node:fs"),
  vm = require("node:vm"),
  assert = require("node:assert/strict");
function carregarFuncao(ctx, arquivo, nome) {
  const fonte = fs.readFileSync(arquivo, "utf8");
  const inicioAsync = fonte.indexOf("async function " + nome + "(");
  const inicio = inicioAsync >= 0 ? inicioAsync : fonte.indexOf("function " + nome + "(");
  const fim = fonte.slice(inicio + 1).search(/\n(?:async )?function /);
  vm.runInContext(fonte.slice(inicio, fim < 0 ? undefined : inicio + 1 + fim), ctx);
}
async function conferir(canal, codigo, nome = "Cliente Teste") {
  const campos = {},
    avisos = [],
    escritas = [];
  const cliente = {
    nome: "Cliente Teste",
    telefone: "65999999999",
    codigoAtivacao: "CDA-CERTO",
    fidelidadeAtiva: false,
  };
  let perfilAtualizado = false,
    boasVindas = 0;
  const campo = (id) =>
    (campos[id] ||= {
      value: "",
      checked: false,
      textContent: "",
      style: {},
      setAttribute() {},
    });
  const prefixo = canal === "index" ? "perfil" : "login-auto";
  campo(prefixo + "-nome").value = nome;
  campo(prefixo + "-telefone").value = cliente.telefone;
  campo(canal === "index" ? "codigo-ativacao" : "login-auto-codigo").value = codigo;
  const ctx = vm.createContext({
    console,
    clienteLogado: null,
    sessaoAutoatendimentoAtual: { id: "sessao", nome: "Visitante" },
    document: { getElementById: campo },
    localStorage: { removeItem() {}, setItem() {} },
    alert: (mensagem, personagem) => avisos.push({ mensagem, personagem }),
    mostrarBoasVindasUI: () => boasVindas++,
    limparTelefonePerfil: () => campo("perfil-telefone").value,
    selecionarAvatar() {},
    atualizarStatusOnline() {},
    limparTelaMensagensCliente() {},
    atualizarTelaClienteLogado: () => {
      perfilAtualizado = true;
    },
    atualizarIconeLoginAuto() {},
    atualizarAvataresContaAutoUI() {},
    fecharLoginAutoatendimento: () => {
      perfilAtualizado = true;
    },
    db: {
      collection: (colecao) => ({
        doc: (id) => ({
          get: async () => ({ exists: true, data: () => ({ ...cliente }) }),
          update: async (dados) => escritas.push({ colecao, id, dados }),
        }),
      }),
    },
  });
  const funcao = canal === "index" ? "buscarCliente" : "entrarClienteAutoatendimento";
  vm.runInContext(fs.readFileSync("js/personagens-ui.js", "utf8"), ctx);
  const op = fs.readFileSync("js/operacao.js", "utf8");
  vm.runInContext(
    op.slice(
      op.indexOf("function nivelFidelidadeOperacao("),
      op.indexOf("async function garantirNivelFidelidadeOperacao("),
    ),
    ctx,
  );
  carregarFuncao(ctx, canal === "index" ? "js/script.js" : "js/autoatendimento.js", funcao);
  if (canal === "index") {
    carregarFuncao(ctx, "js/script.js", "abrirPerfilModo");
    ctx.abrirPerfilModo("login");
    assert.equal(campo("box-codigo-login").hidden, true, "Delivery entra sem campo CDA");
    ctx.abrirPerfilModo("cadastro");
    assert.equal(campo("box-codigo-login").hidden, true, "Cadastro do delivery não pede CDA");
    campo("lista-avatares").style.display = "grid";
    ctx.abrirPerfilModo("home");
    assert.equal(campo("lista-avatares").style.display, "none", "Sair fecha o seletor de avatares");
    ctx.abrirPerfilModo("cadastro");
    assert.equal(campo("lista-avatares").style.display, "none", "Reabrir não expande os avatares");
    ctx.abrirPerfilModo("login");
    assert.equal(campo("box-codigo-login").hidden, true, "Voltar ao login mantém CDA oculto");
  }
  await ctx[funcao]();
  if (nome !== cliente.nome) {
    assert.equal(perfilAtualizado, false);
    assert.equal(escritas.length, 0);
    assert.match(avisos.at(-1).mensagem, /Nome e telefone não conferem/);
    return;
  }
  assert.equal(perfilAtualizado, true, canal + ": credenciais corretas entram na conta");
  if (canal === "index") {
    assert.equal(
      escritas.length,
      0,
      "Login do delivery não ativa CDA, mesmo com valor antigo no campo",
    );
    assert.equal(ctx.clienteLogado.fidelidadeAtiva, false);
    assert.equal(avisos.length, 0, "Login do delivery não valida nem avisa sobre CDA");
    assert.equal(boasVindas, 1);
    return;
  }
  if (codigo === "CDA-CERTO") {
    assert.deepEqual(
      avisos.map((a) => a.personagem),
      ["ativado", "acordo"],
    );
    assert.equal(
      escritas.filter((e) => e.colecao === "clientes" && e.dados.fidelidadeAtiva).length,
      1,
    );
  } else {
    assert.equal(
      escritas.filter((e) => e.colecao === "clientes").length,
      0,
      "CDA inválido não ativa benefícios",
    );
    assert.equal(
      canal === "index"
        ? ctx.clienteLogado.fidelidadeAtiva
        : ctx.sessaoAutoatendimentoAtual.clienteLogado,
      canal === "index" ? false : true,
    );
    if (codigo) {
      assert.equal(avisos.at(-1).personagem, "codigoLogin");
      assert.match(
        avisos.at(-1).mensagem,
        /Entramos na sua conta, mas o CDA informado está errado/,
      );
      assert.match(avisos.at(-1).mensagem, /Seria interessante você não esquecer ele!/);
      assert.equal(boasVindas, 0, "Só um aviso, sem boas-vindas duplicadas");
    } else assert.equal(boasVindas, 1);
  }
}
(async () => {
  for (const canal of ["index", "auto"]) {
    await conferir(canal, "CDA-ERRADO");
    await conferir(canal, "");
    await conferir(canal, "CDA-CERTO");
    await conferir(canal, "CDA-CERTO", "Nome errado");
  }
  console.log(
    "PASS: delivery entra só com nome e telefone, sem campo/validação/ativação de CDA; autoatendimento mantém CDA opcional, ativação e avisos; nome errado não entra.",
  );
})().catch((erro) => {
  console.error(erro);
  process.exitCode = 1;
});
