const fs = require("node:fs"),
  vm = require("node:vm"),
  assert = require("node:assert/strict");
const comum = fs.readFileSync("js/ui-comum.js", "utf8");
const janelas = fs.readFileSync("js/janelas-fluxos.js", "utf8");
function janela() {
  const voltar = {},
    x = {},
    eventos = {};
  return {
    open: true,
    voltar,
    x,
    querySelector: (s) => (s === ".ui-voltar" ? voltar : x),
    addEventListener: (nome, fn) => (eventos[nome] ||= []).push(fn),
    close() {
      this.open = false;
      (eventos.close || []).forEach((fn) => fn());
    },
    escape() {
      (eventos.cancel || []).forEach((fn) => fn({ preventDefault() {} }));
    },
  };
}
const carregar = (ctx) =>
  vm.runInContext(
    comum.slice(
      comum.indexOf("function configurarAcrescimosImediatosUI("),
      comum.indexOf("function lerComPrazoUI("),
    ),
    ctx,
  );
for (const id of ["lista-adicionais", "lista-adicionais-auto", "area-acrescimos-produto"]) {
  for (const fechar of ["x", "voltar", "escape"]) {
    let atual;
    const campo = { textContent: "0" };
    const conteudo = { style: {}, querySelectorAll: () => [campo], querySelector: () => true };
    const ctx = vm.createContext({
      document: { getElementById: (chave) => (chave === id ? conteudo : null) },
      adicionaisSelecionados: { bacon: { qtd: 0 } },
      adicionaisAutoSelecionados: { bacon: { qtd: 0 } },
      abrirJanelaElementoUI: () => (atual = janela()),
      limitarQuantidadeProdutoComAdicionais() {},
      atualizarPrecoProduto() {},
      atualizarResumoAdicionaisProdutoUI() {},
    });
    carregar(ctx);
    vm.runInContext(
      janelas.slice(
        janelas.indexOf("function abrirAcrescimosJanelaUI("),
        janelas.indexOf("function resumoAcrescimosHtmlUI("),
      ),
      ctx,
    );
    const encerrar = () => (fechar === "escape" ? atual.escape() : atual[fechar].onclick());
    ctx.abrirAcrescimosJanelaUI(id);
    campo.textContent = "2";
    ctx.adicionaisSelecionados.bacon.qtd = ctx.adicionaisAutoSelecionados.bacon.qtd = 2;
    encerrar();
    assert.equal(campo.textContent, "2", `${id} mantém acréscimos pelo ${fechar}`);
    assert.equal(ctx.adicionaisSelecionados.bacon.qtd, 2);
    ctx.abrirAcrescimosJanelaUI(id);
    campo.textContent = "0";
    ctx.adicionaisSelecionados.bacon.qtd = ctx.adicionaisAutoSelecionados.bacon.qtd = 0;
    encerrar();
    assert.equal(campo.textContent, "0", "Fechar conserva também a remoção manual");
  }
}
// O callback pode fechar o próprio editor; deve salvar uma vez, antes da limpeza.
for (const acao of ["x", "voltar", "escape"]) {
  const ctx = vm.createContext({});
  carregar(ctx);
  const j = janela();
  let campo = "2",
    salvo = "",
    vezes = 0;
  ctx.configurarAcrescimosImediatosUI(j, () => {
    vezes++;
    salvo = campo;
    j.close();
  });
  j.addEventListener("close", () => {
    campo = "";
  });
  acao === "escape" ? j.escape() : j[acao].onclick();
  assert.equal(salvo, "2");
  assert.equal(vezes, 1);
}
console.log(
  "PASS: X, Voltar e Escape mantêm escolhas e remoções nos três fluxos; salvar ocorre uma vez antes da limpeza do editor.",
);
