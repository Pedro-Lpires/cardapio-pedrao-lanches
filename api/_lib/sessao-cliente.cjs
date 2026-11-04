// Complementa a revogação nativa: renovar o JWT não renova auth_time.
function protegerSessoesCliente(auth, armazenamento) {
  return new Proxy(auth, {
    get(alvo, propriedade) {
      if (propriedade === "verifyIdToken")
        return async (valor, revogados = true) => {
          const token = await alvo.verifyIdToken(valor, revogados);
          if (token.acessoCliente === true) {
            const estado = await armazenamento.ler(token.uid);
            const corte = Number(estado?.revogadoAntesEm) || 0;
            if (corte > 0 && !(Number(token.auth_time) * 1000 > corte))
              throw Object.assign(new Error("Entre novamente após a troca de senha."), {
                code: "auth/id-token-revoked",
              });
          }
          return token;
        };
      const valor = Reflect.get(alvo, propriedade, alvo);
      return typeof valor === "function" ? valor.bind(alvo) : valor;
    },
  });
}
module.exports = { protegerSessoesCliente };
