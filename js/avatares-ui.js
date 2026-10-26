/* A identidade fica no nome do arquivo. O rank escolhe apenas o traje e a moldura. */
const personagensAvatarPedraoUI = [
  ["maionese", "Guardião da Maionese"],
  ["ketchup", "Dama do Ketchup"],
  ["barbecue", "Bárbaro do Barbecue"],
  ["caseiro", "Artesã do Hambúrguer"],
  ["mignon", "Guerreiro do Mignon"],
  ["salada", "Guardiã da Horta"],
  ["coquinha", "Cavaleiro da Coquinha"],
  ["conversa", "Pescadora da Resenha"],
  ["adicionais", "Caçador de Adicionais"],
  ["desconto", "Guerreira da Barganha"],
];

function rankAvatarClienteUI(cliente = {}) {
  if (!cliente.fidelidadeAtiva) return "sem-rank";
  const nivel = String(cliente.nivelCliente || "Bronze").toLowerCase();
  if (nivel === "lenda") return "imortal";
  return ["bronze", "prata", "ouro", "diamante", "imortal"].includes(nivel) ? nivel : "bronze";
}

function identidadeAvatarClienteUI(caminho = "") {
  const valor = String(
    typeof resolverImagemWebpUI === "function" ? resolverImagemWebpUI(caminho) : caminho,
  );
  const personagem = personagensAvatarPedraoUI.find(
    ([id]) => valor === id || new RegExp("/" + id + "\\.(?:png|webp)(?:\\?.*)?$").test(valor),
  );
  if (personagem) return personagem[0];
  const antigo = valor.match(/(?:^|\/)avatar([1-5])\.(?:png|webp)$/);
  return personagensAvatarPedraoUI[antigo ? Number(antigo[1]) - 1 : 0][0];
}

function dadosAvatarClienteUI(cliente = {}, caminho = cliente.avatar) {
  const id = identidadeAvatarClienteUI(caminho);
  const rank = rankAvatarClienteUI(cliente);
  return {
    id,
    rank,
    nome: personagensAvatarPedraoUI.find(([chave]) => chave === id)[1],
    src: `images/avatares/${rank}/${id}.webp`,
  };
}

function aplicarAvatarClienteUI(imagem, cliente, caminho) {
  if (!imagem) return;
  const avatar = dadosAvatarClienteUI(cliente, caminho);
  imagem.src = avatar.src;
  imagem.classList.add("avatar-rank-ui");
  imagem.dataset.avatarRank = avatar.rank;
  imagem.dataset.avatarPersonagem = avatar.id;
  imagem.alt = avatar.nome;
}

function htmlAvatarClienteUI(cliente, classe = "", caminho, lazy = false) {
  const avatar = dadosAvatarClienteUI(cliente, caminho);
  return `<img src="${avatar.src}" alt="${avatar.nome}" decoding="async" loading="${lazy ? "lazy" : "eager"}" class="${classe} avatar-rank-ui" data-avatar-rank="${avatar.rank}" data-avatar-personagem="${avatar.id}">`;
}

function htmlOpcoesAvataresUI(cliente, caminho, modo = "perfil") {
  const selecionado = identidadeAvatarClienteUI(caminho);
  const funcao = modo === "auto" ? "selecionarAvatarAutoUI" : "selecionarAvatar";
  return personagensAvatarPedraoUI
    .map(
      ([id, nome]) =>
        `<button type="button" class="avatar-opcao-ui" aria-label="Escolher ${nome}" aria-pressed="${id === selecionado}" onclick="${funcao}('${id}')">${htmlAvatarClienteUI(cliente, "", id, true)}<span>${nome}</span></button>`,
    )
    .join("");
}
