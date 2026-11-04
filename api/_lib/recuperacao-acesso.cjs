const crypto = require("node:crypto");
const VALIDADE_RECUPERACAO_MS = 30 * 60 * 1000;
const INTERVALO_EMISSAO_MS = 60 * 1000;
const MIN_SENHA = 8;
class ErroRecuperacao extends Error {
  constructor(status, mensagem) {
    super(mensagem);
    this.status = status;
  }
}
function erroLink() {
  return new ErroRecuperacao(
    410,
    "Este link expirou, já foi utilizado ou foi substituído. Peça um novo link à loja.",
  );
}
function telefoneBR(valor) {
  const n = String(valor || "").replace(/\D/g, "");
  const local = n.length === 13 && n.startsWith("55") ? n.slice(2) : n;
  if (!/^[1-9]\d9\d{8}$/.test(local))
    throw new ErroRecuperacao(400, "Informe o celular cadastrado com DDD e 11 dígitos.");
  return "+55" + local;
}
function hashNonce(nonce) {
  return crypto.createHash("sha256").update(nonce).digest("hex");
}
function hashIgual(a, b) {
  return (
    typeof a === "string" &&
    typeof b === "string" &&
    /^[a-f0-9]{64}$/.test(a) &&
    /^[a-f0-9]{64}$/.test(b) &&
    crypto.timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"))
  );
}
function criarServicoRecuperacao({
  auth,
  armazenamento,
  aplicarSenha,
  chave,
  siteUrl,
  adminUids = [],
  agora = Date.now,
  auditar = () => {},
}) {
  if (!Buffer.isBuffer(chave) || chave.length !== 32)
    throw new Error("Chave de recuperação inválida.");
  const site = new URL(siteUrl);
  if (
    site.protocol !== "https:" ||
    site.pathname !== "/" ||
    site.username ||
    site.password ||
    site.search ||
    site.hash
  )
    throw new Error("Configure a origem HTTPS do site.");
  const aad = Buffer.from("pedrao-recuperacao-v1:" + site.origin);
  function selar(dados) {
    const iv = crypto.randomBytes(12);
    const cifra = crypto.createCipheriv("aes-256-gcm", chave, iv);
    cifra.setAAD(aad);
    const corpo = Buffer.concat([cifra.update(JSON.stringify(dados), "utf8"), cifra.final()]);
    return [
      "v1",
      iv.toString("base64url"),
      corpo.toString("base64url"),
      cifra.getAuthTag().toString("base64url"),
    ].join(".");
  }
  function abrir(token) {
    try {
      if (
        typeof token !== "string" ||
        token.length > 8192 ||
        !/^v1\.[\w-]+\.[\w-]+\.[\w-]+$/.test(token)
      )
        throw Error();
      const [, iv, corpo, tag] = token
        .split(".")
        .map((s, n) => (n ? Buffer.from(s, "base64url") : s));
      if (iv.length !== 12 || tag.length !== 16) throw Error();
      const decifra = crypto.createDecipheriv("aes-256-gcm", chave, iv);
      decifra.setAAD(aad);
      decifra.setAuthTag(tag);
      const dados = JSON.parse(
        Buffer.concat([decifra.update(corpo), decifra.final()]).toString("utf8"),
      );
      if (
        dados.v !== 1 ||
        typeof dados.uid !== "string" ||
        !dados.uid ||
        typeof dados.codigo !== "string" ||
        !dados.codigo ||
        typeof dados.nonce !== "string" ||
        !/^[a-f0-9]{64}$/.test(dados.nonce) ||
        !Number.isSafeInteger(dados.emitidoEm) ||
        !Number.isSafeInteger(dados.expiraEm) ||
        dados.expiraEm - dados.emitidoEm !== VALIDADE_RECUPERACAO_MS ||
        dados.emitidoEm > agora() ||
        dados.expiraEm <= agora()
      )
        throw Error();
      return dados;
    } catch {
      throw erroLink();
    }
  }
  async function administrador(bearer) {
    if (typeof bearer !== "string" || !bearer.startsWith("Bearer "))
      throw new ErroRecuperacao(401, "Entre no acesso administrativo protegido.");
    let identidade;
    try {
      identidade = await auth.verifyIdToken(bearer.slice(7), true);
    } catch {
      throw new ErroRecuperacao(401, "Entre novamente no acesso administrativo protegido.");
    }
    if (!identidade.uid || !(identidade.admin === true || adminUids.includes(identidade.uid)))
      throw new ErroRecuperacao(403, "Somente o administrador pode gerar este link.");
    return identidade.uid;
  }
  async function conferir(token) {
    const dados = abrir(token);
    const estado = await armazenamento.ler(dados.uid);
    if (!estado || estado.status !== "emitido" || !hashIgual(estado.hash, hashNonce(dados.nonce)))
      throw erroLink();
    let usuario;
    try {
      usuario = await auth.getUser(dados.uid);
    } catch (e) {
      if (e.code === "auth/user-not-found") throw erroLink();
      throw e;
    }
    if (usuario.disabled || usuario.phoneNumber !== dados.telefone || usuario.email !== dados.email)
      throw erroLink();
    return dados;
  }
  return {
    origem: site.origin,
    async emitir({ authorization, telefone }) {
      const adminUid = await administrador(authorization);
      const numero = telefoneBR(telefone);
      let usuario;
      try {
        usuario = await auth.getUserByPhoneNumber(numero);
      } catch (e) {
        if (e.code === "auth/user-not-found")
          throw new ErroRecuperacao(
            409,
            "Esta conta ainda precisa ser vinculada ao acesso protegido antes de redefinir a senha.",
          );
        throw e;
      }
      if (usuario.disabled) throw new ErroRecuperacao(409, "Esta conta está desativada.");
      if (
        usuario.phoneNumber !== numero ||
        !usuario.email ||
        !(usuario.providerData || []).some((p) => p.providerId === "password")
      )
        throw new ErroRecuperacao(409, "Esta conta ainda não possui acesso por senha configurado.");
      const anterior = await armazenamento.ler(usuario.uid);
      if (anterior && agora() - Number(anterior.emitidoEm) < INTERVALO_EMISSAO_MS)
        throw new ErroRecuperacao(
          429,
          "Aguarde um minuto antes de gerar outro link para este cliente.",
        );
      // O código nativo fica somente no servidor e dentro do envelope cifrado.
      const codigo = new URL(await auth.generatePasswordResetLink(usuario.email)).searchParams.get(
        "oobCode",
      );
      if (!codigo) throw Error("Código de recuperação indisponível.");
      const emitidoEm = agora(),
        expiraEm = emitidoEm + VALIDADE_RECUPERACAO_MS;
      const nonce = crypto.randomBytes(32).toString("hex");
      await armazenamento.emitir(
        usuario.uid,
        { hash: hashNonce(nonce), emitidoEm, expiraEm, status: "emitido", adminUid },
        INTERVALO_EMISSAO_MS,
      );
      const token = selar({
        v: 1,
        uid: usuario.uid,
        telefone: numero,
        email: usuario.email,
        codigo,
        nonce,
        emitidoEm,
        expiraEm,
      });
      const link = new URL("/recuperar-acesso.html", site);
      link.hash = "token=" + token;
      auditar({ evento: "recuperacao_emitida", adminUid, clienteUid: usuario.uid, em: emitidoEm });
      const texto =
        "Pedrão Lanches: use este link para escolher uma nova senha. Ele vale por 30 minutos e só pode ser usado uma vez.\n\n" +
        link.href;
      return {
        link: link.href,
        whatsapp: "https://wa.me/" + numero.slice(1) + "?text=" + encodeURIComponent(texto),
        telefone: numero,
        expiraEm,
        validadeMinutos: 30,
      };
    },
    async conferir(token) {
      const dados = await conferir(token);
      return { valido: true, expiraEm: dados.expiraEm, minimoSenha: MIN_SENHA };
    },
    async redefinir({ token, senha, confirmacao }) {
      if (
        typeof senha !== "string" ||
        senha.length < MIN_SENHA ||
        senha.length > 128 ||
        senha !== confirmacao
      )
        throw new ErroRecuperacao(
          400,
          "Use uma senha de 8 a 128 caracteres e repita a mesma senha nos dois campos.",
        );
      const dados = await conferir(token);
      // Reserva de uso em transação: duas solicitações nunca aplicam duas senhas.
      await armazenamento.consumir(dados.uid, hashNonce(dados.nonce), agora());
      await aplicarSenha(dados.codigo, senha);
      // Também bloqueia JWTs já emitidos nas leituras diretas do Firestore.
      await armazenamento.revogar(dados.uid, agora());
      auditar({ evento: "senha_redefinida", clienteUid: dados.uid, em: agora() });
      return { sucesso: true };
    },
  };
}
function criarArmazenamentoRecuperacao(db) {
  const ref = (uid) => db.collection("authRecuperacoes").doc(uid);
  return {
    async ler(uid) {
      const doc = await ref(uid).get();
      return doc.exists ? doc.data() : null;
    },
    emitir(uid, dados, intervalo) {
      return db.runTransaction(async (t) => {
        const atual = await t.get(ref(uid));
        if (atual.exists && dados.emitidoEm - Number(atual.data().emitidoEm) < intervalo)
          throw new ErroRecuperacao(
            429,
            "Aguarde um minuto antes de gerar outro link para este cliente.",
          );
        t.set(ref(uid), {
          ...dados,
          revogadoAntesEm: atual.exists ? Number(atual.data().revogadoAntesEm) || 0 : 0,
        });
      });
    },
    consumir(uid, hash, em) {
      return db.runTransaction(async (t) => {
        const doc = await t.get(ref(uid));
        const dados = doc.exists ? doc.data() : null;
        if (
          !dados ||
          dados.status !== "emitido" ||
          !hashIgual(dados.hash, hash) ||
          dados.expiraEm <= em
        )
          throw erroLink();
        t.update(ref(uid), { status: "utilizado", utilizadoEm: em, revogadoAntesEm: em });
      });
    },
    revogar(uid, em) {
      return db.runTransaction(async (t) => {
        const doc = await t.get(ref(uid));
        if (!doc.exists) throw erroLink();
        t.update(ref(uid), {
          revogadoAntesEm: Math.max(Number(doc.data().revogadoAntesEm) || 0, em),
        });
      });
    },
  };
}
module.exports = {
  criarServicoRecuperacao,
  criarArmazenamentoRecuperacao,
  ErroRecuperacao,
  VALIDADE_RECUPERACAO_MS,
};
