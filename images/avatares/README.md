# Coleção de avatares

Importação pendente: os 60 PNGs estão no ambiente remoto desconectado do chat
“Criar mascote hambúrguer” (`/workspace/scratch/a601360463a3/generated_images/`).
Em 24/10/2026, o pedido autorizado de ZIP retornou que o ambiente precisa ser
reconectado. Nenhum arquivo de imagem foi copiado ainda.

São dez identidades em cada pasta:

- `sem-rank`
- `bronze`
- `prata`
- `ouro`
- `diamante`
- `imortal`

Cada pasta deve conter os mesmos nomes de arquivo PNG: `maionese`, `ketchup`,
`barbecue`, `caseiro`, `mignon`, `salada`, `coquinha`, `conversa`, `adicionais` e
`desconto`. Conferir visualmente as correspondências antes de renomear; a ordem
de geração das imagens não basta para identificar os personagens.

A lógica preparada está em `js/avatares-ui.js`; as molduras e a grade estão em
`css/componentes/avatares.css`. Esses dois arquivos **ainda não estão importados**
pelas páginas, para preservar os avatares atuais enquanto faltam as artes.
Após importar e conferir as 60 imagens, carregar o JS antes de `script.js`,
`autoatendimento.js` e `admin.js`, e importar o CSS depois dos componentes.
Conferir no navegador cadastro, edição, conta do autoatendimento, cards do ADM,
troca de personagem, promoção/rebaixamento e revogação da fidelidade.

O arquivo salvo em `cliente.avatar` mantém a identidade pelo nome. A exibição
resolve o traje a partir do rank atual, sem regravar o avatar a cada promoção.
Lenda passa a ser chamado Imortal; valores antigos continuam reconhecidos em
fidelidade, campanhas, raspadinhas e avisos de promoção.
