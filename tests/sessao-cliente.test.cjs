const assert = require("node:assert/strict");
const { protegerSessoesCliente } = require("../api/_lib/sessao-cliente.cjs");
(async () => {
  let corte = 0;
  const auth = {
    marcador: "original",
    async verifyIdToken(valor, revogados) {
      assert.equal(this.marcador, "original");
      assert.equal(revogados, true);
      return valor;
    },
    getUser() {
      return this.marcador;
    },
  };
  const protegido = protegerSessoesCliente(auth, { ler: async () => ({ revogadoAntesEm: corte }) });
  const antigo = { uid: "cliente", acessoCliente: true, auth_time: 100, iat: 999 };
  assert.equal(await protegido.verifyIdToken(antigo, true), antigo);
  corte = 100500;
  await assert.rejects(
    protegido.verifyIdToken(antigo, true),
    (e) => e.code === "auth/id-token-revoked",
  );
  await assert.rejects(protegido.verifyIdToken({ ...antigo, iat: 1000 }, true));
  assert.equal((await protegido.verifyIdToken({ ...antigo, auth_time: 101 }, true)).auth_time, 101);
  assert.equal((await protegido.verifyIdToken({ uid: "equipe" }, true)) instanceof Object, true);
  assert.equal(protegido.getUser(), "original");
  console.log(
    "PASS: troca de senha bloqueia JWT antigo e renovado sem novo login; preserva métodos Auth e acesso da equipe.",
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
