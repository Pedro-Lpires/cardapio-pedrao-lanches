/* Uma validação do código permite escolher atendimento ou chapa nesta sessão. */
let funcionarioValidadoUI = null;
let validandoFuncionarioUI = false;
let versaoEntradaFuncionarioUI = 0;
async function loginAtendente() {
  if (validandoFuncionarioUI) return;
  const campo = document.getElementById("codigo-atendente");
  const codigo = campo.value.trim();
  const status = document.getElementById("login-funcionario-status");
  if (!codigo) {
    status.textContent = "Digite seu código de funcionário.";
    return;
  }
  versaoEntradaFuncionarioUI++;
  funcionarioValidadoUI = null;
  validandoFuncionarioUI = true;
  const botao = document.getElementById("entrar-funcionario");
  botao.disabled = true;
  campo.disabled = true;
  status.textContent = "Conferindo código…";
  const concluirCarregamento = iniciarCarregamentoUI("Conferindo seu acesso…");
  try {
    if (typeof acessoEquipeDisponivelUI === "function" && (await acessoEquipeDisponivelUI())) {
      const lembrar = document.getElementById("lembrar-funcionario")?.checked === true;
      funcionarioValidadoUI = await entrarEquipeProtegidaUI(codigo, lembrar);
      if (lembrar) localStorage.setItem("funcionarioSalvoPedrao", funcionarioValidadoUI.id);
      else localStorage.removeItem("funcionarioSalvoPedrao");
      campo.value = "";
      status.textContent = "";
      mostrarDestinosFuncionarioUI();
      return;
    }
    if (typeof ambienteLocalSemServidorUI === "function" && ambienteLocalSemServidorUI()) {
      status.textContent = "";
      abrirAmbienteLocalEquipeUI("atendente.html");
      return;
    }
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
    if (document.getElementById("lembrar-funcionario")?.checked)
      localStorage.setItem("funcionarioSalvoPedrao", doc.id);
    else localStorage.removeItem("funcionarioSalvoPedrao");
    mostrarDestinosFuncionarioUI();
  } catch (erro) {
    if (
      typeof ambienteLocalSemServidorUI === "function" &&
      ambienteLocalSemServidorUI() &&
      !(typeof equipeProtegidaAtivaUI === "function" && equipeProtegidaAtivaUI())
    ) {
      status.textContent = "";
      abrirAmbienteLocalEquipeUI("atendente.html");
      return;
    }
    status.textContent =
      typeof equipeProtegidaAtivaUI === "function" && equipeProtegidaAtivaUI()
        ? erro.message
        : "Não foi possível conferir o código. Tente novamente.";
  } finally {
    concluirCarregamento();
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
async function trocarCodigoFuncionarioUI() {
  versaoEntradaFuncionarioUI++;
  funcionarioValidadoUI = null;
  localStorage.removeItem("funcionarioSalvoPedrao");
  localStorage.removeItem("atendenteId");
  localStorage.removeItem("atendenteNome");
  sessionStorage.removeItem("cozinhaAcessoPedrao");
  localStorage.removeItem("cozinhaAcessoPedrao");
  localStorage.removeItem("funcionarioPerfilPedrao");
  document.getElementById("destinos-funcionario").hidden = true;
  document.getElementById("login-funcionario").hidden = false;
  document.getElementById("login-funcionario-status").textContent = "";
  document.getElementById("codigo-atendente").focus();
  if (typeof sairEquipeProtegidaUI === "function") await sairEquipeProtegidaUI();
}

function mostrarDestinosFuncionarioUI() {
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
}
async function restaurarFuncionarioSalvoUI() {
  if (validandoFuncionarioUI) return;
  const versao = versaoEntradaFuncionarioUI;
  const entradaAtual = () => versao === versaoEntradaFuncionarioUI;
  const id = localStorage.getItem("funcionarioSalvoPedrao");
  const status = document.getElementById("login-funcionario-status");
  try {
    if (typeof usuarioEquipeProtegidaUI === "function") {
      const usuario = await usuarioEquipeProtegidaUI();
      if (!entradaAtual() || (!usuario && !id)) return;
    }
    if (typeof acessoEquipeDisponivelUI === "function" && (await acessoEquipeDisponivelUI())) {
      if (!entradaAtual()) return;
      const funcionario = await restaurarEquipeProtegidaUI();
      if (!entradaAtual() || !funcionario) return;
      funcionarioValidadoUI = funcionario;
      status.textContent = "";
      mostrarDestinosFuncionarioUI();
      return;
    }
    if (!entradaAtual() || !id) return;
    const doc = await db.collection("atendentes").doc(id).get();
    if (!entradaAtual()) return;
    if (!doc.exists || doc.data().ativo !== true || perfilFuncionarioUI(doc.data()) === "nenhum") {
      localStorage.removeItem("funcionarioSalvoPedrao");
      status.textContent = "";
      return;
    }
    funcionarioValidadoUI = { ...doc.data(), id: doc.id, nome: doc.data().nome || "Funcionário" };
    status.textContent = "";
    mostrarDestinosFuncionarioUI();
  } catch {
    // Restaurar é automático; a falha deixa a entrada disponível, sem acusar erro antes do uso.
    if (entradaAtual()) status.textContent = "";
  }
}
document.addEventListener?.("DOMContentLoaded", restaurarFuncionarioSalvoUI);
