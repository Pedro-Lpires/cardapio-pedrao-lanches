// Não registra mensagens/stack: erros de JSON e credenciais podem conter segredos.
function registrarFalha(erro, etapa) {
  const codigo = String(erro?.code || erro?.name || "erro");
  console.error(
    JSON.stringify({
      evento: "falha_acesso_protegido",
      node: process.version,
      etapa,
      codigo: /^[a-zA-Z0-9/_-]{1,100}$/.test(codigo) ? codigo : "erro",
      status: Number(erro?.response?.status) || undefined,
    }),
  );
}
function etapaConfiguracao(nome, executar) {
  try {
    return executar();
  } catch (erro) {
    registrarFalha(erro, nome);
    throw erro;
  }
}
module.exports = { registrarFalha, etapaConfiguracao };
