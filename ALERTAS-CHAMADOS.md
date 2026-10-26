# Som dos chamados do atendente

O som é produzido no próprio navegador, sem contratar serviço de notificações
ou publicar funções no servidor. A proposta de push foi cancelada; não houve
mudança de plano ou publicação no Firebase.

O sino ao lado de **Painel do Atendente** é o único controle que ativa e
silencia os avisos. Ao tocar no sino desligado, uma janela pergunta se deseja
ativar o som neste painel. **Sim, ativar** libera o áudio
naquele momento e toca um teste; **Não, agora não**, X ou Voltar mantêm desligado.
Isso não concede permissão especial de execução em segundo plano nem altera
configurações do aparelho. A janela orienta manter a tela ligada no celular,
pois o sistema pode suspender o navegador. Falhas na ativação aparecem na própria
janela, com orientação para conferir volume e autorização de som do site.
Ele começa desligado sempre que a página é aberta ou
recarregada. Outros cliques no painel não ativam o som. O sino dourado indica
que os alertas estão ligados; o sino cinza riscado indica que estão desligados.

Dentro de **Chamados**, o botão **Escolher toque** abre uma janela com três opções: **Campainha**, **Gotas** e **Cristal**.
Selecione o toque pelo círculo. Cada botão **Ouvir** toca uma prévia, inclusive
com os avisos desligados, sem ativá-los. A escolha fica salva neste aparelho,
mas a ativação continua dependendo de clicar no sino. Campainha é o padrão.
As melodias usam síntese leve de áudio; o pedido de conta tem uma nota extra.

O último chamado aparece no painel e o título da aba mostra a quantidade
pendente. A configuração é preservada ao atualizar a fila. Chamados antigos
não tocam ao abrir o painel, e reconexões não repetem os mesmos avisos.

O áudio usa o mesmo `onSnapshot` de `chamadosMesa`, com a jornada operacional
existente. Não há outra assinatura ou consultas periódicas. A reprodução não
depende de `document.hidden` ou de temporizadores em segundo plano.

O primeiro clique libera o áudio conforme a
[política do Chrome](https://developer.chrome.com/blog/autoplay). Confira o
volume do aparelho e se a aba não está silenciada no navegador. No computador,
a aba pode ficar minimizada, mas precisa continuar aberta. No celular,
mantenha o painel aberto e a tela ligada. Com a página fechada, outro aplicativo
em uso ou a tela apagada, não há garantia de reprodução.

Validação: ativação somente pelo sino, prévia independente, três perfis de som
diferentes, preferência do toque salva, alertas com documento oculto,
deduplicação, mudança de jornada, falha recuperável e listener único. A interface
foi conferida no navegador com dados fictícios no celular e no computador.
