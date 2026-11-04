/* Senhas ficam no Firebase Authentication; clientePedrao não comprova identidade. */
function criarAcessoClienteUI({ auth, fetchHttp = fetch, limparLegado = () => {} }) {
  let disponibilidade;
  let versaoSessao = 0;
  async function ativo() {
    if (!disponibilidade)
      disponibilidade = fetchHttp("/api/acesso-cliente", { cache: "no-store" })
        .then(async (r) => {
          // Preview estático (ex.: Live Server) não tem funções da Vercel.
          // Nesse ambiente preservamos o fluxo legado de testes; regras do banco
          // continuam sendo a autoridade quando a migração for publicada.
          if (r.status === 404) return false;
          if (!r.ok) throw Error();
          return (await r.json()).disponivel === true;
        })
        .catch(() => {
          disponibilidade = null;
          throw Error("Não foi possível conferir o acesso. Verifique a conexão e tente novamente.");
        });
    return disponibilidade;
  }
  async function enviar(dados, usuario) {
    const res = await fetchHttp("/api/acesso-cliente", {
      method: "POST",
      cache: "no-store",
      credentials: "omit",
      referrerPolicy: "no-referrer",
      headers: {
        "Content-Type": "application/json",
        ...(usuario ? { Authorization: "Bearer " + (await usuario.getIdToken(true)) } : {}),
      },
      body: JSON.stringify(dados),
    });
    const resultado = await res.json();
    if (!res.ok) throw Error(resultado.erro || "Não foi possível concluir o acesso.");
    return resultado;
  }
  async function usuarioAtual() {
    if (auth.currentUser) return auth.currentUser;
    return new Promise((resolve, reject) => {
      let parar;
      parar = auth.onAuthStateChanged((u) => {
        parar?.();
        resolve(u);
      }, reject);
    });
  }
  async function perfil() {
    const versao = versaoSessao;
    const usuario = await usuarioAtual();
    if (!usuario) {
      limparLegado();
      return null;
    }
    const { cliente } = await enviar({ acao: "perfil" }, usuario);
    if (
      !cliente ||
      cliente.authUid !== usuario.uid ||
      versao !== versaoSessao ||
      auth.currentUser?.uid !== usuario.uid
    )
      throw Error("Não foi possível conferir sua conta.");
    limparLegado();
    return cliente;
  }
  async function persistencia(lembrar) {
    await auth.setPersistence(lembrar ? "local" : "session");
  }
  return {
    ativo,
    async restaurar() {
      if (!(await ativo())) return null;
      return perfil();
    },
    async entrar({ nome, telefone, codigo, senha, lembrar }) {
      const versao = versaoSessao;
      if (!(await ativo())) throw Error("O acesso com senha ainda está em configuração.");
      if (!senha && nome && telefone) {
        await auth.signOut();
        const resposta = await enviar({ acao: "entrarTeste", nome, telefone });
        if (versao !== versaoSessao) throw Error("O acesso foi cancelado ao sair da conta.");
        return resposta.cliente;
      }
      if (typeof senha !== "string" || !senha || senha.length > 128)
        throw Error("Informe sua senha.");
      await persistencia(lembrar);
      try {
        if (!telefone && codigo) {
          const resposta = await enviar({ acao: "entrarCodigo", codigo, senha });
          await auth.signInWithCustomToken(resposta.token);
        } else {
          if (!/^[1-9]\d9\d{8}$/.test(telefone || "")) throw Error();
          await auth.signInWithEmailAndPassword(
            telefone + "@clientes.pedrao-lanches.invalid",
            senha,
          );
        }
        if (versao !== versaoSessao) throw Error("Acesso cancelado.");
        return await perfil();
      } catch {
        await auth.signOut().catch(() => {});
        throw Error(
          "Celular ou código e senha não conferem. Se esqueceu a senha, peça ajuda à loja.",
        );
      }
    },
    async criarSenha({ nome, telefone, senha, confirmacao, avatar, lembrar }) {
      const versao = versaoSessao;
      if (
        typeof senha !== "string" ||
        senha.length < 8 ||
        senha.length > 128 ||
        senha !== confirmacao
      )
        throw Error("Escolha uma senha de pelo menos 8 caracteres e repita nos dois campos.");
      if (!(await ativo()))
        throw Error(
          "A criação de senha ainda aguarda a conclusão da configuração. Nenhuma senha foi salva.",
        );
      const resposta = await enviar({
        acao: "criarSenha",
        nome,
        telefone,
        senha,
        confirmacao,
        avatar,
      });
      if (versao !== versaoSessao)
        throw Error(
          "A senha foi criada, mas você saiu da conta. Entre com celular e a nova senha.",
        );
      try {
        await persistencia(lembrar);
        await auth.signInWithCustomToken(resposta.token);
        if (versao !== versaoSessao) throw Error("Acesso cancelado.");
        return await perfil();
      } catch {
        await auth.signOut().catch(() => {});
        throw Error(
          "A senha foi criada, mas não conseguimos abrir sua conta. Entre com celular e a nova senha.",
        );
      }
    },
    async sair() {
      versaoSessao++;
      if (typeof auth.signOut === "function") await auth.signOut();
      limparLegado();
    },
  };
}

function criarAvisoSenhaClienteUI(cliente, abrir) {
  if (cliente?.authUid || !cliente?.telefone) return null;
  const aviso = document.createElement("section");
  aviso.className = "cliente-aviso-senha-ui";
  aviso.setAttribute("aria-label", "Mensagem da administração sobre sua senha");
  const cabecalho = document.createElement("div");
  cabecalho.className = "cliente-aviso-remetente-ui";
  const imagem = document.createElement("img");
  imagem.src = "images/personagens-pedrao/ui/mago-tranquilo.webp";
  imagem.alt = "";
  imagem.width = 36;
  imagem.height = 36;
  const nome = document.createElement("strong");
  nome.textContent = "Pedrão Lanches · Administração";
  cabecalho.append(imagem, nome);
  const titulo = document.createElement("h3");
  titulo.textContent = "Crie sua senha";
  const texto = document.createElement("p");
  texto.textContent =
    "Sua conta agora terá acesso com celular e senha. Crie a sua aqui para continuar usando a mesma conta.";
  const botao = document.createElement("button");
  botao.type = "button";
  botao.textContent = "Criar minha senha";
  botao.onclick = abrir;
  aviso.append(cabecalho, titulo, texto, botao);
  return aviso;
}

async function abrirCriacaoSenhaClienteUI(cliente) {
  const aberta = document.querySelector("dialog.cliente-criar-senha-ui");
  if (aberta?.open) return aberta.focus();
  const d = document.createElement("dialog");
  d.className = "cliente-criar-senha-ui";
  d.setAttribute("aria-labelledby", "cliente-criar-senha-titulo");
  // O conteúdo é fixo. Nome, telefone e senha não são interpolados em HTML.
  d.innerHTML = `<header><button type="button" data-voltar>← Voltar</button><h2 id="cliente-criar-senha-titulo">Criar senha</h2><button type="button" data-fechar aria-label="Fechar">×</button></header><form><p>Você continuará na mesma conta, com seus pedidos e benefícios.</p><label for="cliente-nova-senha">Nova senha</label><input id="cliente-nova-senha" name="senha" type="password" minlength="8" maxlength="128" autocomplete="new-password" required><small>Use pelo menos 8 caracteres.</small><label for="cliente-repetir-senha">Repita a senha</label><input id="cliente-repetir-senha" name="confirmacao" type="password" minlength="8" maxlength="128" autocomplete="new-password" required><label class="cliente-lembrar-senha-ui"><input type="checkbox" name="lembrar"> Lembrar neste dispositivo</label><p role="status" aria-live="polite"></p><button type="submit">Salvar minha senha</button></form>`;
  const f = d.querySelector("form"),
    status = d.querySelector("[role=status]");
  for (const b of d.querySelectorAll("[data-voltar],[data-fechar]")) b.onclick = () => d.close();
  d.addEventListener(
    "close",
    () => {
      f.reset();
      d.remove();
    },
    { once: true },
  );
  let enviando = false;
  f.onsubmit = async (e) => {
    e.preventDefault();
    if (enviando) return;
    enviando = true;
    const botao = f.querySelector("button[type=submit]");
    botao.disabled = true;
    status.textContent = "Salvando sua senha…";
    try {
      const atualizado = await window.acessoClienteSenhaUI.criarSenha({
        nome: cliente.nome,
        telefone: cliente.telefone,
        avatar: cliente.avatar,
        senha: f.elements.senha.value,
        confirmacao: f.elements.confirmacao.value,
        lembrar: f.elements.lembrar.checked,
      });
      await aplicarClienteSenhaUI(atualizado);
      if (!d.open) return;
      d.close();
      if (typeof alert === "function")
        alert("Senha criada! Nos próximos acessos, use seu celular e sua senha.");
    } catch (erro) {
      if (d.open) status.textContent = erro.message;
    } finally {
      f.elements.senha.value = "";
      f.elements.confirmacao.value = "";
      enviando = false;
      botao.disabled = false;
    }
  };
  document.body.append(d);
  d.showModal();
}

function atualizarAvisoSenhaClienteUI(cliente, destino) {
  const area =
    destino ||
    document.getElementById("perfil-logado") ||
    document.getElementById("conteudo-conta-auto");
  if (!area) return;
  area.querySelector(".cliente-aviso-senha-ui")?.remove();
  const aviso = criarAvisoSenhaClienteUI(cliente, () => abrirCriacaoSenhaClienteUI(cliente));
  if (aviso) area.insertBefore(aviso, area.querySelector(".botoes-perfil,.auto-sair-conta-ui"));
}
function consultaHistoricoClienteSenhaUI(colecao, cliente) {
  // Cadastros novos não assumem compras antigas feitas por um visitante com o mesmo telefone.
  if (cliente.authUid && cliente.historicoLegadoVerificado === false)
    return db.collection(colecao).where("clienteAuthUid", "==", cliente.authUid);
  return db.collection(colecao).where("clienteId", "==", String(cliente.telefone));
}

async function aplicarClienteSenhaUI(cliente) {
  if (typeof clienteLogado !== "undefined") {
    clienteLogado = cliente;
    avatarClienteAtual = cliente.avatar || "images/avatares/sem-rank/maionese.webp";
    for (const [id, valor] of [
      ["perfil-nome", cliente.nome],
      ["nome-cliente", cliente.nome],
      ["perfil-telefone", cliente.telefone],
      ["telefone-cliente", cliente.telefone],
    ]) {
      const campo = document.getElementById(id);
      if (campo) campo.value = valor || "";
    }
    selecionarAvatar(avatarClienteAtual);
    atualizarTelaClienteLogado();
    limparTelaMensagensCliente();
  } else if (typeof sessaoAutoatendimentoAtual !== "undefined" && sessaoAutoatendimentoAtual) {
    if (cliente.precisaCriarSenha === true) {
      const area = document.getElementById("conteudo-conta-auto");
      area.replaceChildren();
      atualizarAvisoSenhaClienteUI(cliente, area);
      document.getElementById("modal-login-auto").style.display = "none";
      document.getElementById("modal-conta-auto").style.display = "flex";
      return;
    }
    document.getElementById("login-auto-nome").value = cliente.nome;
    document.getElementById("login-auto-telefone").value = cliente.telefone;
    await entrarClienteAutoatendimento(cliente);
  }
}

async function entrarClienteSenhaDeliveryUI() {
  const campo = document.getElementById("perfil-senha-protegida");
  try {
    const cliente = await window.acessoClienteSenhaUI.entrar({
      nome: document.getElementById("perfil-nome").value.trim(),
      telefone: limparTelefonePerfil(),
      senha: campo?.value || "",
      lembrar: document.getElementById("check-salvar-login")?.checked === true,
    });
    await aplicarClienteSenhaUI(cliente);
  } catch (erro) {
    alert(erro.message);
  } finally {
    if (campo) campo.value = "";
  }
}

async function cadastrarClienteSenhaDeliveryUI() {
  const senha = document.getElementById("perfil-senha-protegida"),
    repetir = document.getElementById("perfil-senha-confirmacao");
  try {
    const cliente = await window.acessoClienteSenhaUI.criarSenha({
      nome: document.getElementById("perfil-nome").value.trim(),
      telefone: limparTelefonePerfil(),
      senha: senha?.value || "",
      confirmacao: repetir?.value || "",
      avatar: avatarClienteAtual,
      lembrar: document.getElementById("check-salvar-login")?.checked === true,
    });
    await aplicarClienteSenhaUI(cliente);
  } catch (erro) {
    alert(erro.message);
  } finally {
    if (senha) senha.value = "";
    if (repetir) repetir.value = "";
  }
}

function montarCamposSenhaClienteUI(canal) {
  const delivery = canal === "delivery";
  const base = delivery
    ? document.getElementById("perfil-telefone")
    : document.getElementById("login-auto-telefone")?.closest("label");
  if (
    !base ||
    document.getElementById(delivery ? "perfil-senha-protegida" : "login-auto-senha-protegida")
  )
    return;
  const grupo = document.createElement("div");
  grupo.className = "cliente-campos-senha-ui";
  const prefixo = delivery ? "perfil" : "login-auto";
  grupo.innerHTML = `<label for="${prefixo}-senha-protegida">Senha</label><input id="${prefixo}-senha-protegida" type="password" maxlength="128" autocomplete="current-password"><div data-confirmar-senha hidden><label for="${prefixo}-senha-confirmacao">Repita a senha</label><input id="${prefixo}-senha-confirmacao" type="password" minlength="8" maxlength="128" autocomplete="new-password"></div><a href="https://wa.me/5565992386045?text=Ol%C3%A1%2C%20esqueci%20minha%20senha%20do%20Pedr%C3%A3o.%20Preciso%20de%20um%20link%20de%20recupera%C3%A7%C3%A3o." target="_blank" rel="noopener noreferrer">Esqueci minha senha</a>`;
  base.after(grupo);
  const ajustar = (modo) => {
    const criando = modo === "cadastro" || modo === "criar";
    grupo.hidden = !["login", "cadastro", "criar"].includes(modo);
    grupo.querySelector("[data-confirmar-senha]").hidden = !criando;
    const campo = document.getElementById(prefixo + "-senha-protegida");
    campo.autocomplete = criando ? "new-password" : "current-password";
    campo.value = "";
    document.getElementById(prefixo + "-senha-confirmacao").value = "";
  };
  if (delivery) {
    const anterior = abrirPerfilModo;
    window.abrirPerfilModo = (modo) => {
      anterior(modo);
      ajustar(modo);
    };
    ajustar(typeof perfilModoUI !== "undefined" ? perfilModoUI : "home");
  } else {
    const anterior = mostrarModoContaAutoUI;
    window.mostrarModoContaAutoUI = (modo) => {
      anterior(modo);
      ajustar(modo);
    };
    ajustar(typeof modoContaAutoUI !== "undefined" ? modoContaAutoUI : "escolha");
  }
}

if (typeof module !== "undefined" && module.exports)
  module.exports = { criarAcessoClienteUI, criarAvisoSenhaClienteUI };
else {
  window.acessoClienteSenhaUI = criarAcessoClienteUI({
    auth: typeof firebase.auth === "function" ? firebase.auth() : {},
    limparLegado: () => localStorage.removeItem("clientePedrao"),
  });
  document.addEventListener("DOMContentLoaded", async () => {
    try {
      if (await window.acessoClienteSenhaUI.ativo())
        montarCamposSenhaClienteUI(document.getElementById("perfil-form") ? "delivery" : "auto");
    } catch {
      /* O formulário avisa se a consulta falhar; uma falha não vira login legado. */
    }
  });
}
