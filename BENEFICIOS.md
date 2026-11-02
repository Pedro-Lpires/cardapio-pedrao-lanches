# Benefícios

Implementação local de 01/11/2026. Publicação do site é uma etapa separada. Nenhuma configuração de produção foi ativada.

## Configuração no painel

Em **ADM avançado → Benefícios → Configurar benefícios**, o administrador pode ativar o crédito mensal de entrega e definir:

- Valor mensal de Bronze, Prata, Ouro, Diamante e Imortal. Todos começam em R$ 0.
- Limite por entrega. Zero permite usar até o saldo disponível, sempre limitado ao frete restante e ao total a pagar. = É o máximo de crédito que o cliente pode usar em cada entrega.

Exemplo: ele tem R$ 20 de crédito no mês, e você configura limite de R$ 4 por entrega:

- Frete de R$ 10 → usa R$ 4 de crédito e paga R$ 6 de frete.
- Sobram R$ 16 de crédito para outras entregas.
  Se deixar o limite em zero, ele pode usar todo o saldo necessário para cobrir o frete. Nesse exemplo, usaria R$ 10 e a entrega ficaria grátis para ele.
- Compra mínima em produtos após descontos, incluindo acréscimos e molhos pagos, sem frete. Zero significa sem mínimo.
- Permissão para acumular com cupom (desligada inicialmente) e fidelidade (ligada inicialmente).

O programa começa desligado. **Salvar valores e regras** não o ativa. Use **Ativar benefícios** ou **Retomar benefícios** para liberar os usos e **Pausar benefícios** para bloquear novos usos de todas as contas. A pausa preserva valores, ajustes, reservas e utilizações; retomar não repõe o que já foi gasto. Mudanças afetam novos usos, inclusive no mês atual; pedidos já enviados mantêm o desconto.

A regra inclui automaticamente contas ativadas que entrarem depois da configuração. Não há distribuição individual obrigatória: o limite é calculado pelo rank efetivo, pela configuração atual e pelo que a conta já reservou/utilizou no mês.

Em **Consultar cliente**, informe o celular cadastrado com DDD para conferir o limite, o reservado, o utilizado e o disponível. É possível acrescentar ou reduzir saldo disponível no mês e pausar os novos usos daquela conta, com motivo obrigatório e histórico dos ajustes. **Conferir uso** lista as reservas, usos e devoluções dos pedidos por mês.

## Funcionamento automático

Exige conta identificada, fidelidade ativa e rank mensal sincronizado. Vale para entregas do delivery e criadas no atendimento com o celular cadastrado.

1. O checkout calcula o desconto a partir do rank, saldo e regras configuradas.
2. Ao salvar o pedido, uma transação confere o saldo novamente e reserva o valor. Duas abas não podem gastar o mesmo saldo.
3. Confirmar o recebimento transforma a reserva em uso.
4. Cancelar o pedido devolve a reserva ou o uso ao mês de origem, uma única vez. Cancelar um pedido antigo não aumenta o crédito do mês atual.
5. Na edição, reduzir a taxa ou converter para retirada/consumo local devolve a parte excedente. A edição não concede crédito adicional; preserva, no máximo, o benefício original.

Se um pedido criado pelo atendente tiver divisão entre formas de pagamento e o benefício alterar seu total, a divisão deverá ser conferida em **Editar** antes de confirmar o recebimento.

A taxa integral do motoboy permanece registrada. O desconto é bancado pela loja e aparece separado no pedido, na conferência e na mensagem do motoboy. O crédito de entrega não reduz a base de compras em produtos do rank e da fidelidade.

## Virada do mês e rank

O mês segue America/Cuiaba. O saldo restante não acumula. Cada mês calcula o limite conforme o rank efetivo e a configuração atual. Subir de rank aumenta o limite sem apagar reservas ou usos anteriores. Pausar o programa ou a conta bloqueia novos usos, preservando reservas existentes.

Não exige serviço agendado ou push pago. A competência é calculada na consulta e validada novamente na transação do pedido.

## Dados e validação

- `config/beneficios.creditoEntrega`: ativação, valores em reais por rank, limite por pedido, compra mínima e regras de combinação.
- `clientes/{celular}.beneficiosEntrega`: pausa individual e meses com ajuste, reserva e utilização em centavos.
- `pedidos`: desconto em reais, competência e marcador transacional com status reservado, utilizado ou devolvido.
- `beneficiosAjustes`: motivo, conta, mês, valor e estado da pausa de cada ajuste administrativo.

`tests/beneficios-entrega.test.cjs` cobre concorrência, repetição de operações, pagamento, cancelamento, edição, devolução ao mês original e rollback. O cenário de revisão no navegador usa configuração e contas fictícias, sem acesso ao Firebase de produção.
