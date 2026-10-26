# Organização das imagens

Em 25/10/2026, a pasta publicada `images` passou de 336,5 MB para 7,6 MB.
Foram retirados 166 arquivos antigos, ZIPs e duplicatas, com cópia preservada
fora do projeto em `E:/hd/faculdade.estacio/claude/backup-cardapio-imagens-20261025`.
Isso reduz o tamanho dos arquivos do site; não significa que o visitante baixava
toda essa pasta ao abrir uma página.

Os dez personagens receberam os seis trajes WebP. Os avatares têm até 256 × 256
pixels, carregam sob demanda na escolha e mantêm a identidade ao trocar de rank.
As 17 artes dos avisos passaram de 3,31 MB para 0,45 MB no conjunto. Os recortes,
a transparência e a posição das mãos foram preservados. Três avisos frequentes
são preparados quando o navegador fica ocioso; a abertura do texto não espera
uma leitura do banco nem o carregamento da imagem.

`js/imagens-webp.js` resolve os caminhos PNG/JPG antigos usados nos registros
para arquivos WebP existentes. Também atualiza imagens inseridas dinamicamente.
Links externos e imagens base64 permanecem intactos. A lista de equivalências
está em `scripts/imagens-webp-aliases.json`, e os tamanhos antes/depois em
`scripts/imagens-webp-relatorio.json`. Não foi necessária uma migração do banco.

`scripts/organizar-webp.py` registra a preparação inicial feita com Pillow a
partir dos originais. Não é uma etapa de build e não precisa ser executado para
usar ou publicar o site. Os originais agora estão no backup, e o manifesto
atual aponta para os arquivos WebP organizados.

Validação: existência e formato real dos arquivos, equivalências legadas,
escolha e salvamento de avatar nos dois canais, atualização do mesmo personagem
até Imortal e ausência de rolagem lateral no celular.
