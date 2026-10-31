const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  vm = require("node:vm");
const campos = new Map();
const campo = (id) => {
  if (!campos.has(id))
    campos.set(id, { value: "", hidden: false, disabled: false, textContent: "", focus() {} });
  return campos.get(id);
};
const local = new Map(),
  sessao = new Map();
const storage = (map) => ({
  setItem: (k, v) => map.set(k, v),
  getItem: (k) => map.get(k) || null,
  removeItem: (k) => map.delete(k),
});
let docs = [],
  falhar = false,
  consultas = 0,
  ligouFila = 0;
const query = {
  doc(id) {
    return {
      async get() {
        consultas++;
        const d = docs.find((d) => d.id === id);
        return { exists: !!d, data: () => d?.data() };
      },
    };
  },
  where() {
    return this;
  },
  limit() {
    return this;
  },
  async get() {
    consultas++;
    if (falhar) throw Error("offline");
    return { docs, empty: docs.length === 0 };
  },
};
const ctx = vm.createContext({
  console,
  URLSearchParams,
  document: {
    getElementById: campo,
    querySelector: () => campo("primeiro-destino"),
    body: { classList: { toggle() {} } },
  },
  db: { collection: () => query },
  localStorage: storage(local),
  sessionStorage: storage(sessao),
  location: { href: "atendente.html", search: "" },
  observarCorteProducaoOperacao() {},
  assinarFilaDiaCozinhaOperacao() {
    ligouFila++;
  },
  pararFilaCozinhaOperacao: null,
});
vm.runInContext(fs.readFileSync("js/funcionario-acesso.js", "utf8"), ctx);
vm.runInContext(fs.readFileSync("js/funcionario-login.js", "utf8"), ctx);
const fonte = fs.readFileSync("js/operacao.js", "utf8"),
  inicio = fonte.indexOf("function iniciarCozinhaOperacao()"),
  fim = fonte.indexOf("\nwindow.addEventListener", inicio);
vm.runInContext(fonte.slice(fonte.indexOf("let restaurandoAcessoMonitorCozinhaUI"), fim), ctx);
(async () => {
  ctx.abrirDestinoFuncionarioUI("chapa");
  assert.equal(ctx.location.href, "atendente.html");
  campo("codigo-atendente").value = "errado";
  await ctx.loginAtendente();
  assert.match(campo("login-funcionario-status").textContent, /inválido/);
  assert.equal(sessao.size, 0);
  docs = [{ id: "func-1", data: () => ({ nome: "Pedro" }) }];
  campo("codigo-atendente").value = "1234";
  await ctx.loginAtendente();
  assert.equal(campo("login-funcionario").hidden, true);
  assert.equal(campo("destinos-funcionario").hidden, false);
  assert.equal(campo("codigo-atendente").value, "");
  for (const perfil of ["chapa", "atendimento", "ambos"]) {
    ctx.trocarCodigoFuncionarioUI();
    docs = [{ id: "func-1", data: () => ({ nome: "Pedro", ativo: true, perfil }) }];
    campo("codigo-atendente").value = "1234";
    await ctx.loginAtendente();
    assert.equal(campo("destino-chapa").hidden, perfil === "atendimento");
    assert.equal(campo("destino-atendimento").hidden, perfil === "chapa");
    ctx.location.href = "atendente.html";
    ctx.abrirDestinoFuncionarioUI(perfil === "chapa" ? "atendimento" : "chapa");
    if (perfil !== "ambos")
      assert.equal(
        ctx.location.href,
        "atendente.html",
        "Perfil exclusivo não libera outro destino",
      );
    assert.match(
      campo("boas-vindas-funcionario").textContent,
      perfil === "ambos" ? /Onde você vai trabalhar/ : /Vamos começar/,
    );
  }
  const antes = consultas;
  ctx.abrirDestinoFuncionarioUI("chapa");
  assert.equal(ctx.location.href, "cozinha.html");
  assert.equal(sessao.get("cozinhaAcessoPedrao"), "func-1");
  campo("cozinha-acesso").hidden = true;
  ctx.iniciarCozinhaOperacao();
  assert.equal(ligouFila, 1);
  assert.equal(campo("cozinha-acesso").hidden, true);
  assert.equal(consultas, antes, "Cozinha não pede/consulta código novamente");
  sessao.delete("cozinhaAcessoPedrao");
  campo("cozinha-acesso").hidden = true;
  await ctx.restaurarAcessoMonitorCozinhaUI("func-1");
  assert.equal(sessao.get("cozinhaAcessoPedrao"), "func-1");
  assert.equal(campo("cozinha-acesso").hidden, true, "Monitor em outra aba reaproveita acesso");
  docs = [{ id: "func-1", data: () => ({ nome: "Pedro", ativo: true, perfil: "atendimento" }) }];
  sessao.delete("cozinhaAcessoPedrao");
  await ctx.restaurarAcessoMonitorCozinhaUI("func-1");
  assert.equal(campo("cozinha-acesso").hidden, false);
  assert.equal(
    sessao.get("cozinhaAcessoPedrao"),
    undefined,
    "Monitor não libera perfil de atendimento",
  );
  ctx.abrirDestinoFuncionarioUI("funcionario");
  assert.equal(ctx.location.href, "painel-atendente.html");
  assert.equal(local.get("atendenteId"), "func-1");
  assert.equal(local.get("atendenteNome"), "Pedro");
  ctx.trocarCodigoFuncionarioUI();
  assert.equal(sessao.size, 0);
  assert.equal(local.size, 0);
  assert.equal(campo("destinos-funcionario").hidden, true);
  docs = [
    { id: "a", data: () => ({}) },
    { id: "b", data: () => ({}) },
  ];
  campo("codigo-atendente").value = "duplicado";
  await ctx.loginAtendente();
  assert.match(campo("login-funcionario-status").textContent, /duplicado/);
  assert.equal(sessao.size, 0);
  falhar = true;
  await ctx.loginAtendente();
  assert.match(campo("login-funcionario-status").textContent, /Tente novamente/);
  assert.equal(campo("entrar-funcionario").disabled, false);
  console.log(
    "PASS: login único, código inválido/duplicado, erro recuperável, dois destinos e chapa sem segundo código.",
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
