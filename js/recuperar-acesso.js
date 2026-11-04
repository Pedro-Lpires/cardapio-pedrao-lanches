/* O token permanece em memória; nunca armazenar senha, token ou código no navegador. */
"use strict";
document.addEventListener("DOMContentLoaded", async () => {
  const status = document.getElementById("recuperar-status");
  const form = document.getElementById("form-recuperar");
  const titulo = document.getElementById("recuperar-titulo");
  const senha = document.getElementById("recuperar-senha");
  const confirmacao = document.getElementById("recuperar-confirmacao");
  let token = new URLSearchParams(location.hash.slice(1)).get("token") || "";
  // Fragmento não é enviado na requisição da página e é removido antes do formulário.
  try {
    history.replaceState(null, "", location.pathname);
  } catch {}
  let enviando = false;
  async function chamar(acao, dados = {}) {
    let resposta, retorno;
    try {
      resposta = await fetch("/api/recuperacao-acesso", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        credentials: "omit",
        referrerPolicy: "no-referrer",
        body: JSON.stringify({ acao, token, ...dados }),
      });
      retorno = await resposta.json();
    } catch {
      throw new Error(
        "Não foi possível conectar. Abra o link novamente pelo WhatsApp ou peça ajuda à loja.",
      );
    }
    if (!resposta.ok) {
      const erro = new Error(
        retorno.erro || "Não foi possível conferir o link. Peça ajuda à loja.",
      );
      erro.status = resposta.status;
      throw erro;
    }
    return retorno;
  }
  function falha(erro) {
    status.textContent =
      erro.message || "Não foi possível conectar. Tente novamente ou peça ajuda à loja.";
    if ([410, 503].includes(erro.status)) {
      form.hidden = true;
      senha.value = "";
      confirmacao.value = "";
    }
  }
  form.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    if (enviando) return;
    if (senha.value !== confirmacao.value) {
      status.textContent = "As duas senhas precisam ser iguais.";
      confirmacao.focus();
      return;
    }
    enviando = true;
    const botao = form.querySelector("button");
    botao.disabled = true;
    status.textContent = "Salvando a nova senha…";
    try {
      await chamar("redefinir", { senha: senha.value, confirmacao: confirmacao.value });
      token = "";
      form.hidden = true;
      titulo.textContent = "Senha atualizada!";
      status.textContent =
        "Agora você pode entrar com sua nova senha. Seu histórico e seus benefícios foram preservados.";
      status.dataset.sucesso = "sim";
      document.getElementById("recuperar-voltar").hidden = false;
    } catch (erro) {
      falha(erro);
    } finally {
      senha.value = "";
      confirmacao.value = "";
      enviando = false;
      botao.disabled = false;
    }
  });
  if (!token || !/^v1\.[\w-]+\.[\w-]+\.[\w-]+$/.test(token) || token.length > 8192) {
    token = "";
    status.textContent =
      "Abra o link de recuperação enviado pela loja. Se ele expirou, peça um novo pelo WhatsApp.";
    return;
  }
  try {
    const dados = await chamar("conferir");
    if (!dados.valido) throw Error("Peça um novo link à loja.");
    status.textContent =
      "Link conferido. Depois de salvar a nova senha, este link não poderá ser usado novamente.";
    senha.minLength = Number(dados.minimoSenha) || 8;
    confirmacao.minLength = senha.minLength;
    form.hidden = false;
  } catch (erro) {
    falha(erro);
  }
});
