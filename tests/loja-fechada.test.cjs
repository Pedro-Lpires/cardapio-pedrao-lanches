const fs = require("node:fs"),
  vm = require("node:vm"),
  assert = require("node:assert/strict");
const eventos = {},
  janela = {},
  registros = new Map(),
  versoes = new Map();
const avisos = [];
let snapshotLoja,
  erroSnapshot,
  inscricoes = 0,
  encerradas = 0,
  mostrarPopup = false;
let fecharAntesDoCommit = false,
  gravacoes = 0;
const put = (path, dados) => {
  registros.set(path, structuredClone(dados));
  versoes.set(path, (versoes.get(path) || 0) + 1);
};
const snap = (path) => ({
  exists: registros.has(path),
  data: () => structuredClone(registros.get(path)),
});
const ref = (path) => ({
  path,
  doc: (id) => ref(path + "/" + id),
  onSnapshot: (sucesso, falha) => {
    inscricoes++;
    snapshotLoja = sucesso;
    erroSnapshot = falha;
    return () => encerradas++;
  },
});
const faixa = { setAttribute() {} };
const ctx = vm.createContext({
  console,
  lojaAberta: null,
  mostrarAvisoUI: (texto, personagem) => {
    avisos.push({ texto, personagem });
    mostrarPopup = true;
  },
  document: {
    body: { classList: { toggle: (classe, apagada) => (faixa.apagada = apagada) } },
    getElementById: (id) => (id === "tela-inicio" || id === "aviso-loja-fechada-ui" ? faixa : null),
    createElement: () => faixa,
    querySelector: (seletor) => (seletor === ".abas-navegacao" ? { before() {} } : mostrarPopup),
    addEventListener: (tipo, fn) => (eventos[tipo] = fn),
  },
  window: { addEventListener: (tipo, fn) => (janela[tipo] = fn) },
  db: {
    collection: ref,
    runTransaction: async (fn) => {
      for (let n = 0; n < 5; n++) {
        const lidas = new Map(),
          escritas = [];
        let escrevendo = false;
        const result = await fn({
          get: async (r) => {
            assert.equal(escrevendo, false, "leituras antecedem gravações");
            lidas.set(r.path, versoes.get(r.path) || 0);
            return snap(r.path);
          },
          set: (r, d) => {
            escrevendo = true;
            escritas.push([r.path, d]);
          },
          update: (r, d) => {
            escrevendo = true;
            escritas.push([r.path, { ...registros.get(r.path), ...d }]);
          },
        });
        if (fecharAntesDoCommit) {
          fecharAntesDoCommit = false;
          put("config/loja", { aberta: false });
        }
        if ([...lidas].some(([p, v]) => (versoes.get(p) || 0) !== v)) continue;
        for (const [p, d] of escritas) {
          put(p, d);
          gravacoes++;
        }
        return result;
      }
      throw Error("conflito");
    },
  },
});
vm.runInContext(fs.readFileSync("js/loja-publica-ui.js", "utf8"), ctx);
const operacao = fs.readFileSync("js/operacao.js", "utf8");
vm.runInContext(
  operacao.slice(
    operacao.indexOf("function cupomUsoUnicoOperacao("),
    operacao.indexOf("async function salvarPedidoComCupomOperacao("),
  ),
  ctx,
);
const fonte = fs.readFileSync("js/script.js", "utf8");
for (const nome of [
  "abrirProduto",
  "adicionarProdutoFinal",
  "adicionarDiretoCarrinho",
  "abrirCarrinho",
  "irParaFinalizar",
  "finalizarPedido",
  "exibirRevisao",
  "confirmarEEnviar",
  "salvarPedidoFirebase",
  "aplicarCupomDesconto",
]) {
  const inicio = fonte.search(new RegExp(`(?:async )?function ${nome}\\(`));
  vm.runInContext(fonte.slice(inicio, fonte.indexOf("\n}", inicio) + 2), ctx);
}
const clique = (compra, key) => {
  const e = {
    key,
    target: { closest: (seletor) => (seletor.startsWith(".ui-x") ? null : compra ? {} : null) },
    preventDefault() {
      this.cancelado = true;
    },
    stopImmediatePropagation() {
      this.parou = true;
    },
  };
  (key ? eventos.keydown : eventos.click)(e);
  return e;
};
(async () => {
  eventos.DOMContentLoaded();
  assert.equal(ctx.permitirPedidoLojaUI(), false, "não libera antes da primeira leitura");
  mostrarPopup = false;
  snapshotLoja({ exists: true, data: () => ({ aberta: false }) });
  assert.equal(ctx.lojaAberta, false);
  assert.equal(faixa.apagada, true);
  assert.equal(clique(true).cancelado, true);
  assert.equal(avisos.at(-1).personagem, "lojaFechada");
  const quantidade = avisos.length;
  clique(true);
  assert.equal(avisos.length, quantidade, "não empilha avisos repetidos");
  assert.equal(clique(false).cancelado, undefined, "perfil e seus controles seguem acessíveis");
  assert.equal(clique(true, "Enter").parou, true);
  assert.equal(clique(true, "Escape").parou, undefined);
  assert.equal(clique(true, "Tab").parou, undefined, "teclado pode chegar à conta");
  const fechar = {
    target: { closest: (seletor) => (seletor.startsWith(".ui-x") ? {} : null) },
    preventDefault() {
      throw Error("Não pode bloquear o X da janela");
    },
  };
  eventos.click(fechar);
  for (const nome of [
    "abrirProduto",
    "adicionarProdutoFinal",
    "adicionarDiretoCarrinho",
    "abrirCarrinho",
    "irParaFinalizar",
    "finalizarPedido",
    "exibirRevisao",
    "confirmarEEnviar",
    "aplicarCupomDesconto",
  ])
    await ctx[nome](); // nenhuma função pode sequer acessar os campos de montagem ou o banco
  assert.equal(await ctx.salvarPedidoFirebase({}), null);
  assert.equal(gravacoes, 0);
  snapshotLoja({ exists: true, data: () => ({ aberta: true }) });
  assert.equal(ctx.permitirPedidoLojaUI(), true);
  assert.equal(clique(true).cancelado, undefined);
  assert.equal(faixa.apagada, false);
  ctx.acompanharLojaPublicaUI();
  assert.equal(inscricoes, 1);
  put("config/loja", { aberta: true });
  put("cuponsDesconto/UNICO", { ativo: true, uso: "unico" });
  const pedido = { cupomDescontoCodigo: "UNICO", clienteId: "teste" };
  fecharAntesDoCommit = true;
  await assert.rejects(ctx.salvarPedidoLojaAbertaUI(ref("pedidos/bloqueado"), pedido), {
    code: "LOJA_FECHADA",
  });
  assert.equal(
    registros.has("pedidos/bloqueado"),
    false,
    "fechamento durante a gravação impede o pedido",
  );
  assert.equal(
    registros.get("cuponsDesconto/UNICO").ativo,
    true,
    "não consome cupom do pedido recusado",
  );
  assert.equal(gravacoes, 0);
  put("config/loja", { aberta: true });
  await ctx.salvarPedidoLojaAbertaUI(ref("pedidos/aceito"), pedido);
  assert.equal(registros.has("pedidos/aceito"), true);
  assert.equal(registros.get("cuponsDesconto/UNICO").ativo, false);
  erroSnapshot(Error("sem rede"));
  assert.equal(ctx.permitirPedidoLojaUI(), false);
  janela.pagehide();
  janela.pageshow({ persisted: true });
  assert.equal(encerradas, 1);
  assert.equal(inscricoes, 2);
  assert.equal(ctx.permitirPedidoLojaUI(), false, "retorno aguarda nova confirmação da loja");
  console.log(
    "PASS: fechamento bloqueia montagem, teclado e envio, preserva perfil, reabre sem recarregar e impede pedido/cupom em fechamento concorrente.",
  );
})().catch((erro) => {
  console.error(erro);
  process.exitCode = 1;
});
