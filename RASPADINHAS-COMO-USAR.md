# Raspadinhas: como usar o painel

## O que cada botão faz

| Botão                         | Função                                                                                                                                                     |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Criar raspadinha              | Cadastra a campanha: prêmio, público, forma de emissão, valores mínimos, validade e condições. Cadastrar não envia imediatamente para todo o público.      |
| Raspadinhas cadastradas       | Lista campanhas e permite editar, pausar, reativar e excluir. Excluir a campanha não apaga os prêmios já enviados.                                         |
| Emissão manual                | Busca uma conta por celular de 11 dígitos ou CDA de 4 números. Você confere nome/celular e confirma o envio de um prêmio daquela campanha para essa conta. |
| Prêmios do cliente            | Consulta as raspadinhas que uma conta já recebeu: prêmio, código, estado e validade. Não envia nada. Se não houver prêmios, o painel avisa.                |
| Validar prêmio                | Confere nome, código e disponibilidade. Apenas consultar não marca o prêmio como usado.                                                                    |
| Entregar prêmio               | Confere o código e a nova compra paga. Ao confirmar a entrega, registra o uso e impede outro resgate do mesmo código.                                      |
| Conferir emissões automáticas | Procura pagamentos elegíveis que ficaram pendentes e retoma a emissão, mantendo controle para não duplicar o mesmo prêmio da mesma campanha/compra.        |

Os textos de ajuda ficam nos botões **?**. Nome, celular e código de uma emissão
manual aparecem em uma caixa de conferência com fonte maior.

## Automática e manual

Na **automática**, a campanha não dispara para uma lista assim que é cadastrada.
Ela fica esperando uma compra paga que cumpra público, período e valor mínimo.
O valor considerado é o pago após descontos, sem a taxa de entrega; compras
diferentes não são somadas para atingir esse mínimo.

Exemplo: campanha automática para clientes Bronze, compra mínima de R$ 100 e
prêmio de uma batata. Um cliente Bronze paga uma compra elegível de R$ 100:
o sistema emite a raspadinha para a conta dele. Os demais clientes Bronze ainda
precisam fazer suas próprias compras elegíveis.

Hoje esse processamento é executado pelos painéis do ADM/atendente abertos.
Quando um painel volta a abrir, a recuperação confere pendências. O botão de
conferência também permite iniciar essa verificação. Não é um serviço de servidor
que continua executando sozinho com todos os painéis fechados.

A recuperação considera compras dentro das regras da campanha e posteriores ao
seu cadastro; cadastrar hoje não distribui prêmios por qualquer compra antiga.

Na **manual**, você escolhe e confirma uma conta por vez. Não é um disparo para
todo um grupo. A concessão manual não exige automaticamente o valor mínimo ou
o filtro de público da emissão automática; é uma decisão de quem está emitindo.
O prêmio enviado mantém validade, compra mínima de resgate e condições.

## Ganhar é diferente de resgatar

**Compra mínima para ganhar** controla a emissão automática. **Compra mínima
para resgatar** controla uma compra posterior em que o prêmio poderá ser usado.

Exemplo: ganhar ao pagar R$ 100 e resgatar em outra compra de pelo menos R$ 20.
A raspadinha não é saldo em dinheiro. O cliente mostra o código e o atendente
confere a nova compra e as condições antes de entregar o item.

## Imagem do prêmio

O campo aceita um endereço HTTPS público e direto de imagem, inclusive fora do
código do site, desde que o servidor permita exibi-la. Um link de página de
produto, Google Drive com acesso restrito ou caminho do computador não equivale
a um endereço público de imagem.

Também aceita um arquivo que já esteja publicado no site, por exemplo
`images/bebidas/coca-lata.png`. Esse exemplo só funciona se o arquivo realmente
existir nesse caminho, com nome e extensão corretos. Preencher o campo não faz
upload de um arquivo que está apenas no computador.

O campo é opcional. A imagem aparece no prêmio, depois de revelado, e não
substitui o mago das mensagens.

## Mensagens e apresentação

“Testando fidelidade…” no fim de uma raspadinha vinha de **Condições para o
cliente**, preenchidas na campanha. Esse campo foi renomeado para **Condições
exibidas ao cliente** e ganhou ajuda. O texto já gravado nos prêmios não foi
apagado automaticamente.

O aviso “Bora ativar seus benefícios?” aparece ao clicar em **Bônus** com o CDA
inativo. Ele não é uma confirmação de ativação nem de subida de nível.

Ao ativar a fidelidade, a conta passa a Bronze se ainda estiver sem nível; níveis
superiores são preservados. O perfil mostra uma bolinha correspondente ao nível.
O anúncio de promoção usa o novo nível gravado: Prata, Ouro, Diamante ou Lenda.

Nas mensagens de cupom, toque em **Ver cupom** para expandir a descrição; toque
no próprio código para copiá-lo. A indicação de mensagens não lidas acompanha
novas mensagens em tempo real e encerra as assinaturas ao sair da conta.

Na raspadinha ainda fechada, não há personagem. Depois de raspar ou revelar,
o mago chega com uma animação de aproximação; a fala entra em seguida. Ao reabrir
um prêmio já revelado, ele aparece direto, sem repetir a animação. A preferência
do dispositivo por movimento reduzido é respeitada.
