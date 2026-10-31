/* Uma validação do código permite escolher atendimento ou chapa nesta sessão. */
let funcionarioValidadoUI = null;
let validandoFuncionarioUI = false;
async function loginAtendente() {
  if (validandoFuncionarioUI) return;
  const campo = document.getElementById("codigo-atendente");
  const codigo = campo.value.trim();
  const status = document.getElementById("login-funcionario-status");
  if (!codigo) {
    status.textContent = "Digite seu código de funcionário.";
    return;
  }
  funcionarioValidadoUI = null;
  validandoFuncionarioUI = true;
  const botao = document.getElementById("entrar-funcionario");
  botao.disabled = true;
  campo.disabled = true;
  status.textContent = "Conferindo código…";
  try {
    const snap = await db
      .collection("atendentes")
      .where("codigo", "==", codigo)
      .where("ativo", "==", true)
      .limit(2)
      .get();
    if (snap.docs.length !== 1) {
      status.textContent = snap.empty
        ? "Código inválido ou funcionário inativo."
        : "Este código está duplicado. Peça ao administrador para corrigir.";
      return;
    }
    const doc = snap.docs[0];
    funcionarioValidadoUI = { ...doc.data(), id: doc.id, nome: doc.data().nome || "Funcionário" };
    campo.value = "";
    status.textContent = "";
    document.getElementById("login-funcionario").hidden = true;
    const ambos = perfilFuncionarioUI(funcionarioValidadoUI) === "ambos";
    document.getElementById("boas-vindas-funcionario").textContent = ambos
      ? `Olá, ${funcionarioValidadoUI.nome}. Onde você vai trabalhar?`
      : `Vamos começar, ${funcionarioValidadoUI.nome}?`;
    document.getElementById("destino-chapa").hidden = !permiteFuncionarioUI(
      funcionarioValidadoUI,
      "chapa",
    );
    document.getElementById("destino-atendimento").hidden = !permiteFuncionarioUI(
      funcionarioValidadoUI,
      "atendimento",
    );
    document.getElementById("destinos-funcionario").hidden = false;
    document.querySelector(".funcionario-destinos-ui button:not([hidden])")?.focus();
  } catch (erro) {
    status.textContent = "Não foi possível conferir o código. Tente novamente.";
  } finally {
    validandoFuncionarioUI = false;
    botao.disabled = false;
    campo.disabled = false;
  }
}
function abrirDestinoFuncionarioUI(destino) {
  if (destino === "funcionario") destino = "atendimento";
  if (
    !funcionarioValidadoUI ||
    !["chapa", "atendimento"].includes(destino) ||
    !permiteFuncionarioUI(funcionarioValidadoUI, destino)
  )
    return;
  registrarAcessoFuncionarioUI(funcionarioValidadoUI.id, funcionarioValidadoUI);
  location.href = destino === "chapa" ? "cozinha.html" : "painel-atendente.html";
}
function trocarCodigoFuncionarioUI() {
  funcionarioValidadoUI = null;
  localStorage.removeItem("atendenteId");
  localStorage.removeItem("atendenteNome");
  sessionStorage.removeItem("cozinhaAcessoPedrao");
  localStorage.removeItem("cozinhaAcessoPedrao");
  localStorage.removeItem("funcionarioPerfilPedrao");
  document.getElementById("destinos-funcionario").hidden = true;
  document.getElementById("login-funcionario").hidden = false;
  document.getElementById("login-funcionario-status").textContent = "";
  document.getElementById("codigo-atendente").focus();
}
