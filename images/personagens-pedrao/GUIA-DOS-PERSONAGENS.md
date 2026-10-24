# Magos do Pedrão

As artes originais foram renomeadas, sem mudar o desenho. O arquivo
`nomes-das-artes.json` relaciona os nomes antigos e novos. A pasta `ui/` contém
cópias menores para carregar nos celulares; os originais continuam nesta pasta.

Os personagens aparecem aproximados, com foco no rosto e nos gestos, e a fala fica
em um balão de quadrinhos com uma ponta voltada para eles. Os avisos continuam
com o botão de fechar e a explicação do que fazer. O movimento de entrada é breve
e respeita a preferência de movimento reduzido.

| Onde conferir | Arte usada | Fala do mago |
| --- | --- | --- |
| Index e autoatendimento: aumentar quantidade com acréscimos, inclusive combos e batatas | `mago-aviso.png` | Opa, um de cada vez! |
| Index: conta já aberta, tentativa de ativar um CDA inexistente ou incorreto | `mago-sobrancelha.png` | Aí não, sacana! |
| Index e autoatendimento: nome e telefone corretos, CDA opcional errado | `mago-pensando.png` | Só um detalhe... Entramos na sua conta, mas o CDA informado está errado. |
| Autoatendimento: entrar apenas com código inexistente | `mago-pensando.png` | Vamos conferir o CDA? |
| Index e autoatendimento: boas-vindas depois de entrar ou criar conta | `mago-acenando.png` | Chega mais! |
| Index: ajuda “Sobre o código CDA” | `mago-piscando.png` | Bora liberar seu CDA? |
| Index: Bônus com CDA inativo | `mago-comemorando.png` | Bora ativar seus benefícios? |
| Index e autoatendimento: CDA realmente ativado, inclusive no login | `mago-comemorando.png` | Aí sim, CDA ativado! Parabéns! Agora você possui os benefícios do sistema! |
| Logo após fechar a comemoração da ativação | `mago-desculpas.png` | O acordo precisa ser cumprido. Do mesmo modo que te dei os benefícios, também posso retirá-los. Mãos inteiras com chamas vermelhas. |
| Index e autoatendimento: subida de Bronze para Prata, Ouro, Diamante ou Lenda | `mago-novo-nivel.png` | Você subiu de rank! A fala informa o novo nível. |
| Index: perfil atualizado ou endereço salvo | `mago-joinha.png` | Tudo certo! |
| Index e autoatendimento: pedido vazio ou campos obrigatórios faltando | `mago-pensando.png` | Bora escolher seu lanche? / Falta só um detalhe. |
| Index e autoatendimento: falha de envio, conexão ou indisponibilidade | `mago-desculpas.png` | Opa, deu uma falha. |
| Index: explicação antes de autorizar a localização | `mago-pensando.png` | Vamos calcular sua entrega? |
| Autoatendimento: atendente chamado ou conta solicitada | `mago-joinha.png` | Chamado enviado! |
| Autoatendimento: repetir o mesmo chamado ainda aberto | `mago-intrigado.png` | Tá com pressa? O atendente já foi chamado. Aguarde um momento. |
| Autoatendimento: fazer outra solicitação quando já existe uma aberta | `mago-brincalhao.png` | Um chamado de cada vez! |
| Autoatendimento: tela depois que o pedido foi salvo e enviado | `mago-pedido-confirmado.png` | Arte acima de “Pedido enviado!” |
| Index: remetente das mensagens Geral e ADM; avatar nas respostas do suporte | `mago-tranquilo.png` | Identifica Pedrão Lanches; não substitui o avatar do cliente. |
| Index: mensagem recebida com cupom; autoatendimento: cupons disponíveis na conta | `mago-surpreso.png` | Tem cupom pra você! |
| Index: mensagem recebida de raspadinha | `mago-pedido-confirmado.png` | Chegou coisa boa pra você, [nome do cliente]! |
| Index: raspadinha antes de revelar | Sem personagem | Somente a raspadinha e os dados do prêmio. |
| Index: prêmio revelado na própria janela da raspadinha | `mago-comemorando.png` | Olha o seu prêmio! Código e condições continuam visíveis. |

A comemoração da ativação usa um movimento breve com brilhos e respeita movimento
reduzido. O segundo aviso é somente um lembrete: não automatiza exigências,
mensagens no WhatsApp, avaliações ou revogação de benefícios.

O acompanhamento de nível observa o documento do cliente. Contas com fidelidade
ativa que ficaram sem nível são corrigidas para Bronze pelo serviço de fidelidade,
sem sobrescrever níveis superiores. Não calcula pontos ou novos benefícios.
Guarda o maior nível já visto por conta neste
aparelho para evitar repetições e acompanha alterações enquanto a conta está
aberta. No primeiro acesso de um aparelho sem histórico, o nível atual é a base;
não inventa uma subida. Limpar os dados do navegador apaga essa memória local.

Os chamados do atendente ganharam margens laterais de 12 px, espaçamento interno e
ação compacta. A fila operacional continua sem personagem.

A seleção dos personagens fica em `js/personagens-ui.js`, carregado somente por
`index.html` e `autoatendimento.html`. Atendente e administrador mantêm seus avisos
operacionais sem personagens. Um cupom inválido não é tratado como CDA inválido.

As demais poses ficam organizadas para próximas interações: `mago-saboreando`,
`mago-apontando-lado`, `mago-apontando-baixo`, `mago-sorrindo`,
`mago-boas-vindas`, `mago-desapontado` e `mago-trono-novidades`.

Para revisar sem banco real: `tests/revisao-browser.html`, cenário “Magos,
benefícios e chamados”. O botão “Simular próximo rank” altera apenas o cliente
fictício em memória. O cenário “Conta com CDA ainda não ativado” permite conferir
a sequência da ativação usando `PRATA-TESTE`.

Os cupons recebidos começam recolhidos em “Ver cupom”; o código pode ser copiado
por toque. A imagem das mensagens mede 72 px. Na revelação da raspadinha, o mago
se aproxima em 650 ms e a fala entra em seguida. Prêmios já revelados não repetem
a entrada. `RASPADINHAS-COMO-USAR.md` explica as ações e os campos do painel.
