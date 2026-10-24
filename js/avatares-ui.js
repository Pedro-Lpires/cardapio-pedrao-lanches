/* A identidade fica no nome do arquivo. O rank escolhe apenas o traje e a moldura. */
const personagensAvatarPedraoUI = [
  ["maionese", "Guardião da Maionese"],
  ["ketchup", "Rainha do Ketchup"],
  ["barbecue", "Mestre do Barbecue"],
  ["caseiro", "Fã do Caseiro"],
  ["mignon", "Lorde do Mignon"],
  ["salada", "Guardiã da Salada"],
  ["coquinha", "Parceiro da Coquinha"],
  ["conversa", "Voz do Balcão"],
  ["adicionais", "Mestre dos Adicionais"],
  ["desconto", "Mestre da Barganha"],
];

function rankAvatarClienteUI(cliente = {}) {
  if (!cliente.fidelidadeAtiva) return "sem-rank";
  const nivel = String(cliente.nivelCliente || "Bronze").toLowerCase();
  if (nivel === "lenda") return "imortal";
  return ["bronze", "prata", "ouro", "diamante", "imortal"].includes(nivel) ? nivel : "bronze";
}

function identidadeAvatarClienteUI(caminho = "") {
  const valor = String(caminho);
  const personagem = personagensAvatarPedraoUI.find(
    ([id]) => valor === id || new RegExp("/" + id + "\\.(?:png|webp)(?:\\?.*)?$").test(valor),
  );
  if (personagem) return personagem[0];
  const antigo = valor.match(/(?:^|\/)avatar([1-5])\.png$/);
  return personagensAvatarPedraoUI[antigo ? Number(antigo[1]) - 1 : 0][0];
}

function dadosAvatarClienteUI(cliente = {}, caminho = cliente.avatar) {
  const id = identidadeAvatarClienteUI(caminho);
  const rank = rankAvatarClienteUI(cliente);
  return {
    id,
    rank,
    nome: personagensAvatarPedraoUI.find(([chave]) => chave === id)[1],
    src: `images/avatares/${rank}/${id}.png`,
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

function htmlAvatarClienteUI(cliente, classe = "", caminho) {
  const avatar = dadosAvatarClienteUI(cliente, caminho);
  return `<img src="${avatar.src}" alt="${avatar.nome}" class="${classe} avatar-rank-ui" data-avatar-rank="${avatar.rank}" data-avatar-personagem="${avatar.id}">`;
}

function htmlOpcoesAvataresUI(cliente, caminho, modo = "perfil") {
  const selecionado = identidadeAvatarClienteUI(caminho);
  const funcao = modo === "auto" ? "selecionarAvatarAutoUI" : "selecionarAvatar";
  return personagensAvatarPedraoUI
    .map(
      ([id, nome]) =>
        `<button type="button" class="avatar-opcao-ui" aria-label="Escolher ${nome}" aria-pressed="${id === selecionado}" onclick="${funcao}('${id}')">${htmlAvatarClienteUI(cliente, "", id)}<span>${nome}</span></button>`,
    )
    .join("");
}
