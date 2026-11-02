# Rank mensal

Implementado na versão local de 01/11/2026. Publicação do site é uma etapa separada.

| Compras pagas no mês | Nível garantido |
| -------------------- | --------------- |
| Menos de R$ 400      | Bronze          |
| A partir de R$ 400   | Prata           |
| A partir de R$ 700   | Ouro            |
| A partir de R$ 1.200 | Diamante        |
| A partir de R$ 1.600 | Imortal         |

Exige fidelidade ativa. Sem ativação, continua sem rank.

O mês civil segue America/Cuiaba e muda à meia-noite do dia 1. O valor pago no mês anterior sustenta o rank durante o mês atual. As compras atuais permitem subir imediatamente e determinam o rank garantido na próxima virada. A queda vai ao nível correspondente ao gasto; não é limitada a um degrau.

Exemplo: R$ 500 em outubro garante Prata em novembro. Se terminar novembro com R$ 310, começa dezembro no Bronze. Se chegar a R$ 700 durante novembro, sobe para Ouro e mantém Ouro em dezembro.

## O que entra

- Recebimentos confirmados de entrega e retirada, incluindo itens, acréscimos e molhos pagos, após descontos.
- Pagamentos de comandas: cada conta acumula somente a parte que efetivamente pagou.
- A competência é a data do pagamento. Pedido enviado pelo WhatsApp, confirmação de preparo e quantidade de pedidos não promovem.
- Frete fica fora, inclusive quando há desconto específico no frete.
- Cancelamento retira o lançamento do mês original. Edição de pedido pago corrige o valor elegível sem duplicar o recebimento.
- Bônus e progresso da fidelidade R$ 10/300 são independentes da manutenção do rank.

## Operação

`js/rank-mensal.js` mantém lançamentos idempotentes em `rankMovimentos`, identificados por conta e origem. Os totais mensais ficam em `clientes.rankMensal.meses`, em centavos. Pagamento/cancelamento e rank participam da mesma transação.

Na primeira consulta, são recuperados pagamentos documentados do mês atual e anterior, usando pedidos, comandas e referências do histórico de pagamentos separados. Não se converte gasto vitalício em gasto mensal. Depois da importação, a consulta usa os totais da conta, sem varrer o histórico novamente.

Não há serviço agendado ou push contratado: a regra do nível é calculada pela competência atual, inclusive na validação do cupom. A conta é sincronizada ao abrir/retomar o perfil ou consultar pelo ADM. Com o perfil aberto, um relógio acompanha a próxima virada. Portanto, contas sem acesso podem manter o campo de cache antigo no banco até a próxima consulta; o nível efetivo já considera o novo mês.

No perfil do delivery e do autoatendimento, clicar no nível abre uma janela com o valor que falta para o próximo rank e a explicação mensal, sem listar todas as metas. O rank passa a ser calculado pelas compras, e sua seleção manual fica desabilitada no cadastro. Os avatares e a elegibilidade dos cupons acompanham o nível efetivo.

O crédito mensal de entrega é configurado separadamente em **ADM avançado → Benefícios**. Começa desligado e com valores zerados. Consulte [BENEFICIOS.md](BENEFICIOS.md) para regras de saldo, uso e cancelamento.

Validação: `tests/rank-mensal.test.cjs`, além das suítes existentes de pagamentos, fidelidade, cancelamentos e cupons.
