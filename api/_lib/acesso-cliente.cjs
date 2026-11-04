const { ErroRecuperacao } = require("./recuperacao-acesso.cjs");

function celularCliente(valor) {
  const telefone = String(valor || "").replace(/\D/g, "");
  if (!/^[1-9]\d9\d{8}$/.test(telefone))
    throw new ErroRecuperacao(400, "Informe o celular completo com DDD e 11 dígitos.");
  return telefone;
}
function emailCliente(telefone) {
  return celularCliente(telefone) + "@clientes.pedrao-lanches.invalid";
}
function validarSenhaCliente(senha, confirmacao) {
  if (typeof senha !== "string" || senha.length < 8 || senha.length > 128 || senha !== confirmacao)
    throw new ErroRecuperacao(
      400,
      "Escolha uma senha de 8 a 128 caracteres e repita nos dois campos.",
    );
}
function criarServicoAcessoCliente({
  auth,
  armazenamento,
  conferirSenha,
  siteUrl,
  adminUids = [],
  agora = Date.now,
}) {
  const site = new URL(siteUrl);
  if (
    site.protocol !== "https:" ||
    site.pathname !== "/" ||
    site.username ||
    site.password ||
    site.search ||
    site.hash
  )
    throw Error("Configure a origem HTTPS do site.");
  async function administrador(authorization) {
    const identidade = await autenticar(authorization);
    if (!adminUids.includes(identidade.uid) && identidade.admin !== true)
      throw new ErroRecuperacao(403, "Somente o proprietário pode preparar as contas de teste.");
    return identidade.uid;
  }
  async function autenticar(authorization) {
    if (typeof authorization !== "string" || !authorization.startsWith("Bearer "))
      throw new ErroRecuperacao(401, "Entre novamente na sua conta.");
    try {
      const identidade = await auth.verifyIdToken(authorization.slice(7), true);
      if (!identidade.uid) throw Error();
      return identidade;
    } catch {
      throw new ErroRecuperacao(401, "Entre novamente na sua conta.");
    }
  }
  return {
    origem: site.origin,
    async entrarTeste({ telefone: entrada, nome }) {
      const negar = () =>
        new ErroRecuperacao(
          401,
          "Entre com celular e senha. Se ainda não criou sua senha, fale com a loja.",
        );
      const telefone = celularCliente(entrada);
      await armazenamento.consumirTentativa(telefone, agora());
      const aprovacao = await armazenamento.lerAprovacaoTeste(telefone);
      if (!aprovacao?.adminUid) throw negar();
      const cliente = await armazenamento.lerCliente(telefone);
      if (
        !cliente ||
        cliente.authUid ||
        String(cliente.nome || "")
          .trim()
          .toLocaleLowerCase("pt-BR") !==
          String(nome || "")
            .trim()
            .toLocaleLowerCase("pt-BR")
      )
        throw negar();
      try {
        await auth.getUserByPhoneNumber("+55" + telefone);
        throw negar();
      } catch (erro) {
        if (erro.code !== "auth/user-not-found") throw negar();
      }
      // Exceção temporária e explícita para dados de teste já aprovados pelo dono.
      // Não emite sessão Auth e deixa de existir assim que a primeira senha é criada.
      return { cliente: { ...cliente, telefone, precisaCriarSenha: true } };
    },
    async entrarCodigo({ codigo, senha }) {
      const negar = () => new ErroRecuperacao(401, "Código e senha não conferem.");
      if (
        !/^\d{4}$/.test(codigo || "") ||
        typeof senha !== "string" ||
        !senha ||
        senha.length > 128
      )
        throw negar();
      await armazenamento.consumirTentativa("codigo:" + codigo, agora());
      const cliente = await armazenamento.buscarClienteCodigo(codigo);
      if (!cliente?.authUid) throw negar();
      try {
        const telefone = celularCliente(cliente.telefone);
        const usuario = await auth.getUser(cliente.authUid);
        if (
          usuario.disabled ||
          usuario.phoneNumber !== "+55" + telefone ||
          usuario.customClaims?.clienteId !== telefone ||
          usuario.customClaims?.acessoCliente !== true
        )
          throw negar();
        const identidade = await conferirSenha(usuario.email, senha);
        if (identidade.uid !== usuario.uid) throw negar();
        return { token: await auth.createCustomToken(usuario.uid) };
      } catch {
        throw negar();
      }
    },
    async prepararTestes(authorization) {
      const adminUid = await administrador(authorization);
      // Somente o snapshot aprovado pelo proprietário. Cadastros futuros não entram.
      const clientes = await armazenamento.listarClientesTeste();
      if (clientes.length > 100)
        throw new ErroRecuperacao(
          409,
          "Revise as contas antes de preparar mais de 100 cadastros de teste.",
        );
      const aprovados = [];
      for (const cliente of clientes) {
        let telefone;
        try {
          telefone = celularCliente(cliente.telefone);
        } catch {
          continue;
        }
        if (cliente.authUid || !String(cliente.nome || "").trim()) continue;
        aprovados.push({ telefone, adminUid, preparadoEm: agora() });
      }
      await armazenamento.aprovarTestes(aprovados);
      return { preparados: aprovados.length };
    },
    async criarSenha({ telefone: entrada, nome: nomeEntrada, senha, confirmacao, avatar }) {
      const telefone = celularCliente(entrada);
      validarSenhaCliente(senha, confirmacao);
      const nome = String(nomeEntrada || "").trim();
      if (!/^[\p{L}\p{M}\p{N} .'-]{2,100}$/u.test(nome))
        throw new ErroRecuperacao(400, "Informe seu nome, com até 100 caracteres.");
      await armazenamento.consumirTentativa(telefone, agora());
      const antigo = await armazenamento.lerCliente(telefone);
      if (antigo) {
        const teste = await armazenamento.lerAprovacaoTeste(telefone);
        if (
          antigo.authUid ||
          !teste?.adminUid ||
          antigo.nome?.trim().toLocaleLowerCase("pt-BR") !== nome.toLocaleLowerCase("pt-BR")
        )
          throw new ErroRecuperacao(
            409,
            "Esta conta já existe. Entre com sua senha ou peça ajuda à loja.",
          );
      }
      let usuario;
      try {
        // A unicidade de celular/e-mail no Auth resolve duas criações simultâneas.
        // Nunca usar updateUser para substituir uma senha pelo nome/telefone.
        usuario = await auth.createUser({
          email: emailCliente(telefone),
          phoneNumber: "+55" + telefone,
          password: senha,
          displayName: antigo?.nome || nome,
        });
      } catch (erro) {
        if (["auth/email-already-exists", "auth/phone-number-already-exists"].includes(erro.code))
          throw new ErroRecuperacao(
            409,
            "Esta conta já tem acesso. Entre com sua senha ou peça a recuperação à loja.",
          );
        throw new ErroRecuperacao(503, "Não foi possível criar sua senha. Tente novamente.");
      }
      const avatarSeguro = /^images\/avatares\/sem-rank\/[a-z0-9-]+\.webp$/.test(avatar || "")
        ? avatar
        : "images/avatares/sem-rank/maionese.webp";
      const dados = antigo || {
        nome,
        telefone,
        avatar: avatarSeguro,
        codigoAtivacao: "",
        fidelidadeAtiva: false,
        nivelCliente: "Sem nível",
        bonusDisponivel: 0,
        totalGasto: 0,
        totalFidelidade: 0,
        bonusGeradoTotal: 0,
        criadoEm: new Date(agora()).toISOString(),
      };
      try {
        await auth.setCustomUserClaims(usuario.uid, {
          acessoCliente: true,
          clienteId: telefone,
          historicoLegadoVerificado: Boolean(antigo),
        });
        await armazenamento.vincularCliente(telefone, usuario.uid, dados, Boolean(antigo), agora());
      } catch {
        // Uma criação incompleta não deixa uma senha ativa sem vínculo ao cadastro.
        try {
          await auth.deleteUser(usuario.uid);
        } catch {
          // Não tentar editar/reutilizar a identidade em um resultado incerto.
        }
        throw new ErroRecuperacao(
          503,
          "O cadastro não foi concluído. Peça ajuda à loja antes de tentar novamente.",
        );
      }
      return { token: await auth.createCustomToken(usuario.uid), sucesso: true };
    },
    async perfil(authorization) {
      const identidade = await autenticar(authorization);
      if (identidade.acessoCliente !== true || !/^[1-9]\d9\d{8}$/.test(identidade.clienteId || ""))
        throw new ErroRecuperacao(403, "Esta sessão não está vinculada a uma conta de cliente.");
      const usuario = await auth.getUser(identidade.uid);
      if (usuario.disabled || usuario.phoneNumber !== "+55" + identidade.clienteId)
        throw new ErroRecuperacao(401, "Entre novamente na sua conta.");
      const cliente = await armazenamento.lerCliente(identidade.clienteId);
      if (!cliente || cliente.authUid !== identidade.uid)
        throw new ErroRecuperacao(403, "Não foi possível conferir o vínculo desta conta.");
      return {
        cliente: {
          ...cliente,
          telefone: identidade.clienteId,
          historicoLegadoVerificado: identidade.historicoLegadoVerificado === true,
        },
      };
    },
  };
}
module.exports = { criarServicoAcessoCliente, celularCliente, emailCliente, validarSenhaCliente };
