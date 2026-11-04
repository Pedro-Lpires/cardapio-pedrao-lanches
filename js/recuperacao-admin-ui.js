/* O servidor confere o token administrativo; flags e IDs locais não autorizam recuperação. */
"use strict";
function authAdministradorProtegidoUI() {
  if (typeof equipeProtegidaAtivaUI === "function" && equipeProtegidaAtivaUI())
    return appEquipeProtegidaUI().auth();
  if (typeof firebase === "undefined" || typeof firebase.auth !== "function")
    throw Error("A autenticação protegida ainda não foi configurada.");
  const nome = "administracao-protegida";
  const app =
    firebase.apps.find((a) => a.name === nome) ||
    firebase.initializeApp(firebase.app().options, nome);
  return app.auth();
}
async function usuarioAdministradorProtegidoUI(auth) {
  if (auth.currentUser) return auth.currentUser;
  return new Promise((resolve, reject) => {
    const parar = auth.onAuthStateChanged((usuario) => {
      parar();
      resolve(usuario);
    }, reject);
  });
}
async function abrirAcessoAdministrativoProtegidoUI() {
  const janela = janelaEditorUI("Acesso para recuperação");
  janela.classList.add("recuperacao-admin-ui");
  const corpo = janela.querySelector(".editor-corpo-ui");
  corpo.innerHTML = `<p>Use o acesso do proprietário configurado no Firebase Authentication. O código da equipe não autoriza redefinir senhas.</p><form><label>E-mail do administrador<input name="email" type="email" autocomplete="username" required></label><label>Senha do administrador<input name="senha" type="password" autocomplete="current-password" required></label><button type="submit">Conectar administrador</button></form><p role="status" aria-live="polite"></p>`;
  const form = corpo.querySelector("form"),
    status = corpo.querySelector("[role=status]");
  form.hidden = true;
  try {
    const resposta = await fetch("/api/recuperacao-acesso", { cache: "no-store" });
    if (!resposta.ok || !(await resposta.json()).disponivel) throw Error();
  } catch {
    status.textContent =
      "O acesso de recuperação ainda aguarda a configuração da autenticação e das regras protegidas.";
    return;
  }
  if (!janela.open) return;
  let auth;
  try {
    auth = authAdministradorProtegidoUI();
  } catch (e) {
    status.textContent = e.message;
    form.hidden = true;
    return;
  }
  const conectado = await usuarioAdministradorProtegidoUI(auth);
  if (!janela.open) return;
  form.hidden = Boolean(conectado);
  if (conectado) {
    form.hidden = true;
    status.textContent =
      "Existe um acesso administrativo conectado neste navegador. As permissões são conferidas pelo servidor ao gerar o link.";
    const sair = document.createElement("button");
    sair.type = "button";
    sair.textContent = "Desconectar acesso protegido";
    sair.onclick = async () => {
      await auth.signOut();
      sair.remove();
      form.hidden = false;
      status.textContent = "Acesso protegido desconectado.";
    };
    corpo.append(sair);
    adicionarPreparacaoContasTesteUI(corpo, auth);
  }
  form.onsubmit = async (e) => {
    e.preventDefault();
    const botao = form.querySelector("button");
    botao.disabled = true;
    try {
      await auth.setPersistence(firebase.auth.Auth.Persistence.SESSION);
      await auth.signInWithEmailAndPassword(
        form.elements.email.value.trim(),
        form.elements.senha.value,
      );
      if (!janela.open) return;
      form.hidden = true;
      status.textContent =
        "Acesso conectado. O servidor vai conferir sua autorização ao gerar uma recuperação.";
      adicionarPreparacaoContasTesteUI(corpo, auth);
    } catch {
      status.textContent =
        "Não foi possível conectar. Confira o acesso e a configuração do Authentication.";
    } finally {
      form.elements.senha.value = "";
      botao.disabled = false;
    }
  };
  janela.addEventListener(
    "close",
    () => {
      form.elements.senha.value = "";
    },
    { once: true },
  );
}
function adicionarPreparacaoContasTesteUI(corpo, auth) {
  if (corpo.querySelector("[data-preparar-testes]")) return;
  const botao = document.createElement("button");
  botao.type = "button";
  botao.dataset.prepararTestes = "";
  botao.textContent = "Preparar contas de teste para criar senha";
  botao.onclick = async () => {
    if (
      !(await dialogoOperacao(
        "Os cadastros atuais são somente contas de teste? Esta ação permite que esses cadastros criem a primeira senha dentro da conta. Contas já protegidas mantêm sua senha.",
        null,
        true,
        { botao: "Preparar contas de teste" },
      ))
    )
      return;
    botao.disabled = true;
    const status = corpo.querySelector("[role=status]");
    try {
      const usuario = await usuarioAdministradorProtegidoUI(auth);
      if (!usuario) throw Error("Conecte o proprietário novamente.");
      const resposta = await fetch("/api/acesso-cliente", {
        method: "POST",
        cache: "no-store",
        credentials: "omit",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + (await usuario.getIdToken()),
        },
        body: JSON.stringify({ acao: "prepararTestes" }),
      });
      const dados = await resposta.json();
      if (!resposta.ok) throw Error(dados.erro || "Não foi possível preparar os testes.");
      status.textContent = `${dados.preparados} conta(s) de teste preparada(s). Cada uma poderá criar a primeira senha no aviso dentro da própria conta.`;
    } catch (erro) {
      status.textContent = erro.message;
    } finally {
      botao.disabled = false;
    }
  };
  corpo.append(botao);
}
async function abrirRecuperacaoClienteAdminUI(cliente) {
  const telefone = String(cliente.telefone || "").replace(/\D/g, "");
  if (!/^\d{11}$/.test(telefone))
    return avisoOperacao("Esta conta não tem celular válido para recuperação.");
  const janela = janelaEditorUI("Redefinir acesso do cliente");
  janela.classList.add("recuperacao-admin-ui");
  const corpo = janela.querySelector(".editor-corpo-ui");
  corpo.innerHTML = `<div class="recuperacao-conta"><strong>${escaparOperacao(cliente.nome || "Cliente")}</strong><p>WhatsApp cadastrado: ${escaparOperacao(telefone)}</p></div><p>O cliente escolherá a nova senha. O link vale por <strong>30 minutos</strong>, serve uma única vez e substitui o anterior.</p><button type="button" data-gerar>Gerar link de 30 minutos</button><p role="status" aria-live="polite"></p><div data-resultado></div>`;
  const gerar = corpo.querySelector("[data-gerar]"),
    status = corpo.querySelector("[role=status]");
  try {
    const res = await fetch("/api/recuperacao-acesso", { cache: "no-store" });
    if (!res.ok || !(await res.json()).disponivel) throw Error();
  } catch {
    gerar.disabled = true;
    status.textContent =
      "A recuperação aguarda a configuração do Authentication, do servidor e das regras protegidas. Nenhum link foi gerado.";
    return;
  }
  gerar.onclick = async () => {
    gerar.disabled = true;
    status.textContent = "Conferindo a autorização e preparando o link…";
    try {
      const usuario = await usuarioAdministradorProtegidoUI(authAdministradorProtegidoUI());
      if (!usuario) throw Error("Entre primeiro em Acesso de recuperação no topo do ADM.");
      const resposta = await fetch("/api/recuperacao-acesso", {
        method: "POST",
        cache: "no-store",
        credentials: "omit",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + (await usuario.getIdToken()),
        },
        body: JSON.stringify({ acao: "emitir", telefone }),
      });
      const dados = await resposta.json();
      if (!resposta.ok) throw Error(dados.erro || "Não foi possível gerar o link.");
      if (!janela.open) return;
      const link = new URL(dados.link),
        whatsapp = new URL(dados.whatsapp);
      if (
        link.origin !== location.origin ||
        link.pathname !== "/recuperar-acesso.html" ||
        whatsapp.protocol !== "https:" ||
        whatsapp.hostname !== "wa.me"
      )
        throw Error("A origem do link precisa ser conferida na configuração do servidor.");
      status.textContent =
        "Link gerado. Válido até " +
        new Intl.DateTimeFormat("pt-BR", {
          timeZone: "America/Cuiaba",
          hour: "2-digit",
          minute: "2-digit",
        }).format(new Date(dados.expiraEm)) +
        ". O envio pelo WhatsApp precisa ser confirmado por você.";
      const resultado = corpo.querySelector("[data-resultado]");
      resultado.replaceChildren();
      const campo = document.createElement("input");
      campo.type = "text";
      campo.readOnly = true;
      campo.value = link.href;
      campo.className = "recuperacao-link";
      campo.setAttribute("aria-label", "Link de recuperação do cliente");
      const acoes = document.createElement("div");
      acoes.className = "recuperacao-acoes";
      const enviar = document.createElement("a");
      enviar.href = whatsapp.href;
      enviar.target = "_blank";
      enviar.rel = "noopener noreferrer";
      enviar.textContent = "Enviar pelo WhatsApp";
      const copiar = document.createElement("button");
      copiar.type = "button";
      copiar.textContent = "Copiar link";
      copiar.onclick = async () => {
        try {
          await navigator.clipboard.writeText(link.href);
          status.textContent =
            "Link copiado. Envie somente ao WhatsApp cadastrado do cliente. Validade: 30 minutos desde a emissão.";
        } catch {
          campo.focus();
          campo.select();
          status.textContent = "Selecione e copie o link acima.";
        }
      };
      acoes.append(enviar, copiar);
      resultado.append(campo, acoes);
    } catch (e) {
      if (janela.open) status.textContent = e.message;
    } finally {
      gerar.disabled = false;
    }
  };
}
