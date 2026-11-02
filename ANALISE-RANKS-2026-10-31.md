# Ranks e margem — proposta para discussão

Os créditos e descontos desta proposta não foram ativados. Em 01/11/2026, a avaliação mensal dos ranks foi implementada na versão local; veja [Rank mensal](RANK-MENSAL.md). A margem informada pelo proprietário é lucro líquido de 20% a 30%, já descontados todos os custos.

## O que existe hoje

- Fidelidade: R$ 10 por R$ 300, aproximadamente 3,33% no longo prazo; o saldo de progresso continua entre compras. Itens, acréscimos e molhos contam, sem frete.
- A versão local passou a usar valores pagos por mês para o rank, com metas de R$ 400/700/1.200/1.600. A regra antiga por quantidade de compras ou gasto acumulado foi substituída.
- Os descontos automáticos de 50% no frete e 10% nos itens descritos na conversa com a outra IA não fazem parte da progressão automática atual.

## Correções na análise recebida

1. A borda é do avatar, não é borda de comida: pode ser mantida como benefício visual, sem custo de ingredientes por pedido.
2. R$ 12/15/18/20 por rank são uma proposta diferente dos atuais R$ 10 a cada R$ 300. É preciso escolher se substituem a regra atual; somar as duas aumenta a despesa.
3. Limitar 10% de desconto a R$ 30 por pedido só começa a limitar compras acima de R$ 300. Em pedidos menores, os 10% continuam inteiros e sem teto mensal.
4. Prioridade na cozinha compromete a capacidade e o prazo dos demais clientes. Não é um benefício operacionalmente gratuito.
5. Raspadinhas e sorteios têm custo esperado: probabilidade de ganhar × custo real do prêmio × quantidade de emissões/resgates. Esse custo precisa entrar no mesmo orçamento dos descontos.
6. Se o cliente faz retirada e entrega, os descontos devem ser calculados sobre suas compras de cada modalidade. Não se pode supor que todo o gasto teve desconto de retirada e simultaneamente todo o gasto teve frete.

## Simulação de uso integral dos benefícios

Hipótese: R$ 1.600 em itens antes dos benefícios, em um mês em que o cliente já tem Imortal, dos quais R$ 800 em retirada e R$ 800 em entrega. Custos mantidos para isolar o impacto dos benefícios; não é uma previsão contábil exata. Todos os créditos considerados são usados.

| Parcela                                                                                       | Custo do benefício |
| --------------------------------------------------------------------------------------------- | -----------------: |
| 10% nas retiradas de R$ 800                                                                   |              R$ 80 |
| Crédito de frete proposto                                                                     |              R$ 40 |
| Fidelidade mensal proposta para Imortal                                                       |              R$ 20 |
| Total, substituindo a fidelidade atual                                                        |             R$ 140 |
| Se acumular também os R$ 10/300 atuais: 5 metas em R$ 1.600, com R$ 100 de progresso restante |            + R$ 50 |
| Total com as duas fidelidades                                                                 |             R$ 190 |

| Lucro líquido antes dos benefícios adicionais | Após custo de R$ 140 | Após custo de R$ 190 |
| --------------------------------------------- | -------------------: | -------------------: |
| 20% de R$ 1.600 = R$ 320                      |               R$ 180 |               R$ 130 |
| 25% de R$ 1.600 = R$ 400                      |               R$ 260 |               R$ 210 |
| 30% de R$ 1.600 = R$ 480                      |               R$ 340 |               R$ 290 |

Esses valores não incluem outros cupons, molhos extras, raspadinhas ou sorteios. Um cupom de R$ 10 em pedido mínimo de R$ 70 já representa 14,29% daquele pedido, antes de qualquer outro benefício.

## Minha recomendação inicial

Manter apenas uma regra de fidelidade monetária — os R$ 10/300 já definidos — e começar com créditos pequenos de frete, além das vantagens visuais. Sem desconto percentual permanente nos itens.

Metas mensais da proposta recebida podem ser avaliadas assim, ainda sem ativação:

| Rank     | Meta mensal em itens pagos | Teto mensal inicial de subsídio ao frete |
| -------- | -------------------------: | ---------------------------------------: |
| Prata    |                     R$ 400 |                                     R$ 5 |
| Ouro     |                     R$ 700 |                                    R$ 10 |
| Diamante |                   R$ 1.200 |                                    R$ 15 |
| Imortal  |                   R$ 1.600 |                                    R$ 20 |

No longo prazo, fidelidade mais esses tetos ficariam perto de 4,6% a 4,8% das compras, se o cliente atingir a meta e utilizar todos os créditos de frete. Isso ainda consome cerca de um quarto do lucro quando a margem é de 20%; é um orçamento inicial a medir, não garantia de aumento de lucro. Cupons/prêmios adicionais precisariam caber nesse orçamento ou substituir outro benefício.

## Regras que devem acompanhar o desenho

- Rank por valor de itens efetivamente pago no mês, incluindo acréscimos/molhos pagos, após descontos e excluindo frete, cancelamentos e devoluções.
- Pedido enviado pelo WhatsApp fica pendente; pagamento confirmado é que qualifica para a nova progressão. Cancelamento/estorno desfaz a qualificação.
- Créditos de entrega nunca excedem o frete daquela compra. O motoboy recebe o valor integral; o desconto é subsídio da loja.
- Crédito mensal expira e não acumula automaticamente. Bônus já conquistados na fidelidade têm regra própria e não devem desaparecer por queda de rank.
- Definir quais benefícios acumulam e quais se substituem; não somar vantagens de todos os ranks por padrão.
- Avaliação do mês anterior no dia 1, pelo horário de Cuiabá. A queda de um nível pode preservar a experiência visual; conta sem compras não deve receber créditos novos indefinidamente.
- Aviso três dias antes pode aparecer dentro do site quando o cliente abrir a conta, com o valor que falta. Envio externo automático é outro recurso, não está implícito nesta proposta.

Referência para análise de custos e precificação: [Sebrae — precificação inteligente](https://meuatendimento.sebrae.com.br/sites/PortalSebrae/ufs/pe/artigos/5-dicas-para-fazer-uma-precificacao-de-produtos-inteligente%2Ce231536044395710VgnVCM1000004c00210aRCRD).
