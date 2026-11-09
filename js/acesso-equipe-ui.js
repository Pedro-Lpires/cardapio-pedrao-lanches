/* A identidade operacional fica separada do login de cliente, mesmo neste aparelho. */
"use strict";
let configuracaoEquipeProtegidaUI = null;
let inicializacaoEquipeProtegidaUI = null;
let perfilEquipeProtegidaUI = null;
let versaoSessaoEquipeUI = 0;
function appEquipeProtegidaUI() {
  if (typeof firebase?.auth !== "function")
    throw Error("A autenticação da equipe não carregou. Reabra a página.");
  const pagina = location.pathname.split("/").at(-1);
  const nome = ["admin.html", "financeiro.html"].includes(pagina)
    ? "administracao-protegida"
    : "operacao-pedrao";
  return (
    firebase.apps.find((app) => app.name === nome) ||
    firebase.initializeApp(firebase.app().options, nome)
  );
}
function dbEquipeProtegidaUI() {
  return typeof firebase.auth === "function"
    ? appEquipeProtegidaUI().firestore()
    : firebase.firestore();
}
function equipeProtegidaAtivaUI() {
  return configuracaoEquipeProtegidaUI === true;
}
async function acessoEquipeDisponivelUI() {
  if (!configuracaoEquipeProtegidaUI || configuracaoEquipeProtegidaUI === true) {
    if (configuracaoEquipeProtegidaUI != null) return configuracaoEquipeProtegidaUI;
    configuracaoEquipeProtegidaUI = fetch("/api/acesso-equipe", {
      cache: "no-store",
      credentials: "omit",
    }).then(async (res) => {
      if (res.status === 404) return false; // Preview estático não tem API.
      if (!res.ok) throw Error("Não foi possível conferir o acesso. Tente novamente.");
      const dados = await res.json();
      if (typeof dados.disponivel !== "boolean") throw Error("Resposta de acesso inválida.");
      return dados.disponivel;
    });
  }
  try {
    configuracaoEquipeProtegidaUI = await configuracaoEquipeProtegidaUI;
    return configuracaoEquipeProtegidaUI;
  } catch (erro) {
    configuracaoEquipeProtegidaUI = null;
    throw erro;
  }
}
async function usuarioEquipeProtegidaUI() {
  const auth = appEquipeProtegidaUI().auth();
  if (auth.currentUser) return auth.currentUser;
  return new Promise((resolve, reject) => {
    const parar = auth.onAuthStateChanged((usuario) => {
      parar();
      resolve(usuario);
    }, reject);
  });
}
async function chamarAcessoEquipeUI(acao, dados = {}, usuario = null) {
  const resposta = await fetch("/api/acesso-equipe", {
    method: "POST",
    credentials: "omit",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...(usuario ? { Authorization: "Bearer " + (await usuario.getIdToken()) } : {}),
    },
    body: JSON.stringify({ ...dados, acao }),
  });
  const retorno = await resposta.json();
  if (!resposta.ok) throw Error(retorno.erro || "Não foi possível conferir o acesso.");
  return retorno;
}
function validarPerfilEquipeUI(dados) {
  if (
    !dados?.funcionario ||
    typeof dados.funcionario.id !== "string" ||
    !["atendimento", "chapa", "ambos"].includes(dados.funcionario.perfil)
  )
    throw Error("Acesso da equipe inválido.");
  return dados.funcionario;
}
async function entrarEquipeProtegidaUI(codigo, lembrar = false) {
  const versao = ++versaoSessaoEquipeUI;
  const retorno = await chamarAcessoEquipeUI("entrar", { codigo });
  if (versao !== versaoSessaoEquipeUI)
    throw Error("A entrada foi encerrada. Informe seu código novamente.");
  const auth = appEquipeProtegidaUI().auth();
  await auth.setPersistence(
    lembrar ? firebase.auth.Auth.Persistence.LOCAL : firebase.auth.Auth.Persistence.SESSION,
  );
  await auth.signInWithCustomToken(retorno.token);
  try {
    const perfil = validarPerfilEquipeUI(
      await chamarAcessoEquipeUI("perfil", {}, auth.currentUser),
    );
    if (versao !== versaoSessaoEquipeUI)
      throw Error("A entrada foi encerrada. Informe seu código novamente.");
    perfilEquipeProtegidaUI = perfil;
    return perfil;
  } catch (erro) {
    await auth.signOut();
    throw erro;
  }
}
async function restaurarEquipeProtegidaUI() {
  const versao = versaoSessaoEquipeUI;
  const usuario = await usuarioEquipeProtegidaUI();
  if (!usuario) return null;
  const perfil = validarPerfilEquipeUI(await chamarAcessoEquipeUI("perfil", {}, usuario));
  if (versao !== versaoSessaoEquipeUI) return null;
  perfilEquipeProtegidaUI = perfil;
  return perfil;
}
async function sairEquipeProtegidaUI() {
  versaoSessaoEquipeUI++;
  perfilEquipeProtegidaUI = null;
  await appEquipeProtegidaUI().auth().signOut();
}
async function sairOperacaoProtegidaUI() {
  await sairEquipeProtegidaUI();
  location.reload();
}
function atualizarIdentidadeEquipeUI(perfil) {
  if (!perfil.admin && typeof registrarAcessoFuncionarioUI === "function")
    registrarAcessoFuncionarioUI(perfil.id, perfil);
  const nome = document.getElementById("nome-atendente");
  if (nome) nome.textContent = `Bem-vindo, ${perfil.nome}`;
}
function janelaEntradaEquipeUI(proprietario, texto = "") {
  document.getElementById("acesso-equipe-protegida")?.remove();
  const janela = document.createElement("dialog");
  janela.id = "acesso-equipe-protegida";
  janela.className = "acesso-equipe-janela-ui";
  janela.innerHTML = `<h1>Pedrão Lanches</h1><h2>${proprietario ? "Acesso do proprietário" : "Acesso da equipe"}</h2>${proprietario ? '<form><label>E-mail<input type="email" name="email" autocomplete="username" required></label><label>Senha<input type="password" name="senha" autocomplete="current-password" required></label><label class="acesso-equipe-lembrar"><input type="checkbox" name="lembrar">Salvar acesso neste aparelho</label><button type="submit">Entrar</button></form>' : '<p>Entre com o código do funcionário para continuar.</p><a href="atendente.html">Entrar com meu código</a>'}<p role="status" aria-live="polite"></p><a href="index.html" class="acesso-equipe-voltar">Voltar ao cardápio</a>`;
  janela.querySelector("[role=status]").textContent = texto;
  janela.addEventListener("cancel", (e) => e.preventDefault());
  document.body.append(janela);
  for (const filho of document.body.children)
    if (filho !== janela && filho.tagName !== "SCRIPT") filho.inert = true;
  document.documentElement.classList.add("acesso-equipe-bloqueado");
  janela.showModal();
  const form = janela.querySelector("form");
  if (form)
    form.onsubmit = async (evento) => {
      evento.preventDefault();
      const botao = form.querySelector("button"),
        status = janela.querySelector("[role=status]");
      botao.disabled = true;
      status.textContent = "Conferindo acesso…";
      const concluirCarregamento = iniciarCarregamentoUI("Conferindo seu acesso…");
      let auth;
      try {
        auth = appEquipeProtegidaUI().auth();
        await auth.setPersistence(
          form.elements.lembrar.checked
            ? firebase.auth.Auth.Persistence.LOCAL
            : firebase.auth.Auth.Persistence.SESSION,
        );
        await auth.signInWithEmailAndPassword(
          form.elements.email.value.trim(),
          form.elements.senha.value,
        );
        await chamarAcessoEquipeUI("proprietario", {}, auth.currentUser);
        await auth.currentUser.getIdToken(true);
        location.reload(); // Reinicia os listeners com a identidade já autenticada.
      } catch {
        if (auth) await auth.signOut();
        status.textContent = "Não foi possível entrar. Confira seu acesso de proprietário.";
      } finally {
        concluirCarregamento();
        form.elements.senha.value = "";
        botao.disabled = false;
      }
    };
  return janela;
}
async function iniciarAcessoPaginaEquipeUI(pagina = location.pathname.split("/").at(-1)) {
  if (!["admin.html", "financeiro.html", "painel-atendente.html", "cozinha.html"].includes(pagina))
    return;
  const proprietario = ["admin.html", "financeiro.html"].includes(pagina);
  try {
    if (!(await acessoEquipeDisponivelUI())) {
      if (typeof ambienteLocalSemServidorUI === "function" && ambienteLocalSemServidorUI())
        abrirAmbienteLocalEquipeUI();
      return;
    }
    const perfil = await restaurarEquipeProtegidaUI();
    const destino = pagina === "cozinha.html" ? "chapa" : "atendimento";
    if (
      !perfil ||
      (proprietario ? perfil.admin !== true : ![destino, "ambos"].includes(perfil.perfil))
    ) {
      janelaEntradaEquipeUI(proprietario);
      return;
    }
    atualizarIdentidadeEquipeUI(perfil);
    if (perfil.admin && typeof adminAvancadoLiberado !== "undefined") adminAvancadoLiberado = true;
    if (perfil.admin) {
      const sair = document.createElement("button");
      sair.type = "button";
      sair.className = "acesso-equipe-sair-ui";
      sair.textContent = "Sair do acesso protegido";
      sair.onclick = sairOperacaoProtegidaUI;
      (document.querySelector(".admin-header-acoes") || document.querySelector("main")).append(
        sair,
      );
    }
    if (pagina === "cozinha.html" && !localStorage.getItem("funcionarioSalvoPedrao")) {
      const monitor = document.querySelector('a[href="cozinha.html?modo=monitor"]');
      if (monitor) monitor.removeAttribute("target"); // Sessão desta aba continua no monitor, sem pedir o código novamente.
    }
    if (pagina === "cozinha.html") {
      sessionStorage.setItem("cozinhaAcessoPedrao", perfil.id);
      document.getElementById("cozinha-acesso").hidden = true;
      if (typeof pararCozinhaOperacao === "function") pararCozinhaOperacao();
      iniciarCozinhaOperacao();
    }
    if (pagina === "financeiro.html" && typeof liberarFinanceiroProtegidoUI === "function")
      liberarFinanceiroProtegidoUI();
    document.getElementById("acesso-equipe-protegida")?.remove();
    document.documentElement.classList.remove("acesso-equipe-bloqueado");
    // A desativação do funcionário é observada pelas regras a cada operação.
    if (!perfil.admin) {
      const pararCadastro = appEquipeProtegidaUI()
        .firestore()
        .collection("atendentes")
        .doc(perfil.id)
        .onSnapshot(
          (doc) => {
            if (
              !doc.exists ||
              !permiteFuncionarioUI(doc.data(), destino) ||
              doc.data().ativo !== true
            )
              janelaEntradaEquipeUI(
                false,
                "Seu acesso foi alterado. Entre novamente com seu código.",
              );
          },
          () =>
            janelaEntradaEquipeUI(false, "Não foi possível confirmar seu acesso. Entre novamente."),
        );
      window.addEventListener("pagehide", pararCadastro, { once: true });
    }
    const pararSessao = appEquipeProtegidaUI()
      .auth()
      .onAuthStateChanged((usuario) => {
        if (!usuario)
          janelaEntradaEquipeUI(proprietario, "Seu acesso foi encerrado. Entre novamente.");
      });
    window.addEventListener("pagehide", pararSessao, { once: true });
  } catch (erro) {
    janelaEntradaEquipeUI(proprietario, erro.message);
  } finally {
    document.documentElement.classList.remove("acesso-equipe-verificando");
  }
}
if (
  ["admin.html", "financeiro.html", "painel-atendente.html", "cozinha.html"].includes(
    location.pathname.split("/").at(-1),
  )
)
  document.documentElement.classList.add("acesso-equipe-verificando");
document.addEventListener("DOMContentLoaded", () => {
  inicializacaoEquipeProtegidaUI = iniciarAcessoPaginaEquipeUI();
});
