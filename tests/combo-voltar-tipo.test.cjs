const fs = require("node:fs"),
  vm = require("node:vm"),
  assert = require("node:assert/strict");
const fonte = fs.readFileSync("js/combos-site-ui.js", "utf8");
let abriu = 0,
  fechou = 0;
const voltar = {},
  x = { onclick: () => fechou++ };
const ctx = vm.createContext({
  abrirEscolhaAcrescimosComboUI: (tipo) => {
    assert.equal(tipo, "site");
    abriu++;
  },
});
vm.runInContext(
  fonte.slice(
    fonte.indexOf("function configurarVoltaTipoComboSiteUI("),
    fonte.indexOf("async function escolherModoComboSiteUI("),
  ),
  ctx,
);
ctx.configurarVoltaTipoComboSiteUI({ querySelector: () => voltar, close: () => fechou++ });
voltar.onclick();
assert.equal(abriu, 1);
assert.equal(fechou, 1);
x.onclick();
assert.equal(abriu, 1);
const janelas = fs.readFileSync("js/janelas-fluxos.js", "utf8");
(async () => {
  for (const contexto of ["auto", "atendente"])
    for (const modo of ["todos", "individual"]) {
      const auto = contexto === "auto";
      const area = { style: { display: "block" } };
      const eventos = [];
      let escolhas = 0;
      const botoes = {};
      const janela = {
        open: true,
        querySelector: (seletor) => (botoes[seletor] ||= {}),
        addEventListener: (_nome, fn) => eventos.push(fn),
        close() {
          this.open = false;
          eventos.splice(0).forEach((fn) => fn());
        },
      };
      janela.querySelector(".ui-x").onclick = () => janela.close();
      const contextoTeste = vm.createContext({
        document: { getElementById: () => area },
        abrirJanelaElementoUI: () => janela,
        abrirEscolhaAcrescimosComboUI: (origem) => {
          assert.equal(origem, contexto);
          assert.equal(janela.open, false);
          escolhas++;
        },
        modoPersonalizacaoComboAuto: modo,
        modoPersonalizacaoCombo: modo,
        configuracaoTodosComboAuto: null,
        configuracoesLanchesComboAuto: {},
        selecionarModoComboAuto() {},
        selecionarModoCombo() {},
      });
      contextoTeste.window = contextoTeste;
      vm.runInContext(
        janelas.slice(
          janelas.indexOf("function configurarVoltaTipoComboUI("),
          janelas.indexOf("function atualizarResumoAdicionaisProdutoUI("),
        ),
        contextoTeste,
      );
      const inicio = janelas.indexOf(
        auto
          ? '  if (typeof selecionarModoComboAuto === "function")'
          : '  if (typeof selecionarModoCombo === "function")',
      );
      const fim = janelas.indexOf(
        auto
          ? "  // O autoatendimento mantém a seleção imediata"
          : '  if (typeof selecionarModoComboAuto === "function")',
        inicio + 1,
      );
      vm.runInContext(janelas.slice(inicio, fim), contextoTeste);
      await contextoTeste[auto ? "selecionarModoComboAuto" : "selecionarModoCombo"](modo);
      janela.querySelector(".ui-voltar").onclick();
      assert.equal(escolhas, 1, `${contexto}/${modo}: Voltar abre a escolha de tipo`);
      janela.open = true;
      janela.querySelector(".ui-x").onclick();
      assert.equal(escolhas, 1, `${contexto}/${modo}: X apenas fecha`);
    }
  console.log(
    "PASS: Todos/Individual no index, autoatendimento e atendente: Voltar reabre a escolha de tipo; X apenas fecha.",
  );
})().catch((erro) => {
  console.error(erro);
  process.exitCode = 1;
});
