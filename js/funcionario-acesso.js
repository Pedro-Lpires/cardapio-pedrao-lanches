/* O cadastro define quais opções o código libera. Cadastros antigos mantêm ambos. */
function perfilFuncionarioUI(dados = {}) {
  if (dados.perfil === "atendimento" || dados.perfil === "chapa" || dados.perfil === "ambos")
    return dados.perfil;
  return dados.perfil == null ? "ambos" : "nenhum";
}
function permiteFuncionarioUI(dados, destino) {
  const perfil = perfilFuncionarioUI(dados);
  return perfil === "ambos" || perfil === destino;
}
function registrarAcessoFuncionarioUI(id, dados) {
  localStorage.setItem("atendenteId", id);
  localStorage.setItem("atendenteNome", dados.nome || "Funcionário");
  localStorage.setItem("funcionarioPerfilPedrao", perfilFuncionarioUI(dados));
  if (permiteFuncionarioUI(dados, "chapa")) {
    sessionStorage.setItem("cozinhaAcessoPedrao", id);
    localStorage.setItem("cozinhaAcessoPedrao", id);
  } else {
    sessionStorage.removeItem("cozinhaAcessoPedrao");
    localStorage.removeItem("cozinhaAcessoPedrao");
  }
}
