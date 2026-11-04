/* Os códigos são conferidos no servidor; somente ele emite identidades da equipe. */
const crypto = require("node:crypto");
const { ErroRecuperacao } = require("./recuperacao-acesso.cjs");
const uidFuncionario = (id) => "equipe-" + crypto.createHash("sha256").update(id).digest("hex");
function perfilFuncionario(dados) {
  const perfil = dados?.perfil == null ? "ambos" : dados.perfil;
  return dados?.ativo === true && ["atendimento", "chapa", "ambos"].includes(perfil)
    ? perfil
    : null;
}
function criarServicoAcessoEquipe({
  auth,
  armazenamento,
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
  const origem = site.origin;
  const negado = () => new ErroRecuperacao(401, "Código inválido ou acesso inativo.");
  async function identidade(authorization) {
    if (typeof authorization !== "string" || !/^Bearer [^\s]+$/.test(authorization))
      throw new ErroRecuperacao(401, "Entre novamente para continuar.");
    try {
      const token = await auth.verifyIdToken(authorization.slice(7), true);
      const usuario = await auth.getUser(token.uid);
      if (usuario.disabled) throw Error();
      return { token, usuario };
    } catch {
      throw new ErroRecuperacao(401, "Entre novamente para continuar.");
    }
  }
  const publico = (id, dados) => ({
    id,
    nome: String(dados.nome || "Funcionário").slice(0, 100),
    perfil: perfilFuncionario(dados),
    admin: false,
  });
  return {
    origem,
    async entrar({ codigo, origemRede }) {
      if (typeof codigo !== "string" || !/^[A-Za-z0-9_-]{4,64}$/.test(codigo)) throw negado();
      await armazenamento.consumirTentativa(codigo, origemRede, agora());
      const encontrado = await armazenamento.buscarCodigo(codigo);
      if (!encontrado || !perfilFuncionario(encontrado.dados)) throw negado();
      const { id, dados } = encontrado;
      if (typeof id !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(id)) throw negado();
      const uid = uidFuncionario(id);
      let usuario;
      try {
        usuario = await auth.getUser(uid);
      } catch (erro) {
        if (erro.code !== "auth/user-not-found") throw erro;
        let criada = false;
        try {
          usuario = await auth.createUser({
            uid,
            displayName: String(dados.nome || "Funcionário").slice(0, 100),
          });
          criada = true;
        } catch (e) {
          if (e.code !== "auth/uid-already-exists") throw e;
          usuario = await auth.getUser(uid);
        }
        // Nunca promove uma conta preexistente, nem em uma corrida de criação.
        if (criada) {
          try {
            await auth.setCustomUserClaims(uid, { funcionarioId: id });
            usuario = { ...usuario, customClaims: { funcionarioId: id } };
          } catch (erro) {
            try {
              await auth.deleteUser(uid);
            } catch {}
            throw erro;
          }
        }
      }
      if (
        usuario.disabled ||
        usuario.customClaims?.funcionarioId !== id ||
        usuario.customClaims?.admin ||
        usuario.customClaims?.acessoCliente
      )
        throw negado();
      // Reconfere uma desativação ocorrida durante a emissão. As regras também leem o cadastro ativo.
      const atual = await armazenamento.lerFuncionario(id);
      if (!perfilFuncionario(atual) || atual.codigo !== codigo) throw negado();
      return {
        funcionario: publico(id, atual),
        token: await auth.createCustomToken(uid, { funcionarioId: id }),
      };
    },
    async perfil(authorization) {
      const { token, usuario } = await identidade(authorization);
      if (adminUids.includes(token.uid) && token.admin === true)
        return {
          funcionario: {
            id: token.uid,
            nome: usuario.displayName || "Proprietário",
            perfil: "ambos",
            admin: true,
          },
        };
      const id = token.funcionarioId;
      if (
        typeof id !== "string" ||
        !/^[A-Za-z0-9_-]{1,128}$/.test(id) ||
        token.uid !== uidFuncionario(id) ||
        usuario.customClaims?.funcionarioId !== id
      )
        throw negado();
      const dados = await armazenamento.lerFuncionario(id);
      if (!perfilFuncionario(dados)) throw negado();
      return { funcionario: publico(id, dados) };
    },
    async proprietario(authorization) {
      const { token, usuario } = await identidade(authorization);
      // O UID autorizado vem exclusivamente da configuração privada do servidor.
      if (!adminUids.includes(token.uid) || usuario.customClaims?.funcionarioId)
        throw new ErroRecuperacao(403, "Esta conta não tem acesso de proprietário.");
      if (usuario.customClaims?.admin !== true)
        await auth.setCustomUserClaims(token.uid, { ...usuario.customClaims, admin: true });
      return {
        atualizarToken: true,
        funcionario: {
          id: token.uid,
          nome: usuario.displayName || "Proprietário",
          perfil: "ambos",
          admin: true,
        },
      };
    },
  };
}
module.exports = { criarServicoAcessoEquipe, perfilFuncionario, uidFuncionario };
