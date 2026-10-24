const fs = require("node:fs");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const ctx = vm.createContext({});
vm.runInContext(fs.readFileSync("js/avatares-ui.js", "utf8"), ctx);

for (const [id] of vm.runInContext("personagensAvatarPedraoUI", ctx)) {
  let avatar = id;
  for (const nivelCliente of ["Sem nível", "Bronze", "Prata", "Ouro", "Diamante", "Imortal"]) {
    const cliente = { avatar, nivelCliente, fidelidadeAtiva: nivelCliente !== "Sem nível" };
    const dados = ctx.dadosAvatarClienteUI(cliente);
    assert.equal(dados.id, id, "A evolução mantém o personagem escolhido");
    assert.match(dados.src, new RegExp("/" + id + "\\.png$"));
    const opcoes = ctx.htmlOpcoesAvataresUI(cliente, avatar);
    assert.equal((opcoes.match(/<button /g) || []).length, 10);
    assert.equal((opcoes.match(/aria-pressed="true"/g) || []).length, 1);
    assert.equal(
      new Set([...opcoes.matchAll(/data-avatar-rank="([^"]+)"/g)].map((m) => m[1])).size,
      1,
    );
    avatar = dados.src;
  }
  assert.equal(
    ctx.dadosAvatarClienteUI({ avatar, nivelCliente: "Bronze", fidelidadeAtiva: true }).id,
    id,
  );
  assert.equal(
    ctx.dadosAvatarClienteUI({ avatar, nivelCliente: "Imortal", fidelidadeAtiva: false }).rank,
    "sem-rank",
  );
}
assert.equal(ctx.identidadeAvatarClienteUI("images/avatar2.png"), "ketchup");
assert.equal(
  ctx.dadosAvatarClienteUI({ fidelidadeAtiva: true, nivelCliente: "Lenda" }).rank,
  "imortal",
);
assert.equal(
  ctx.dadosAvatarClienteUI({ fidelidadeAtiva: true, nivelCliente: "Sem nível" }).rank,
  "bronze",
);
assert.equal(ctx.identidadeAvatarClienteUI("' onerror='alert(1)"), "maionese");
const raspadinhas = fs.readFileSync("js/raspadinhas.js", "utf8");
vm.runInContext(
  raspadinhas.slice(
    raspadinhas.indexOf("function elegibilidadeRaspadinha("),
    raspadinhas.indexOf("function comprasRaspadinha("),
  ),
  ctx,
);
for (const clienteNivel of ["Lenda", "Imortal"]) {
  for (const regraNivel of ["Lenda", "Imortal"]) {
    assert.equal(
      ctx.elegibilidadeRaspadinha(
        { ativa: true, modo: "automatico", publico: "nivel", nivel: regraNivel },
        { nivelCliente: clienteNivel },
        { pagoEm: 10, valorPago: 20 },
        20,
      ),
      true,
      "As campanhas antigas mantêm o público ao renomear Lenda",
    );
  }
}
console.log("PASS: identidade preservada nos seis ranks, dez escolhas e compatibilidade legada.");
