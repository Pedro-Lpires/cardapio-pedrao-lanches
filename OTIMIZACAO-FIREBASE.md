# Leituras do Firebase

## Consultas automáticas

- Cozinha: fila aguardando e documentos de origem desses registros. Concluídos são limitados e consultados quando a seção está aberta.
- ADM: pedidos desde o início do período solicitado. A assinatura anterior é encerrada ao mudar o período. O dia operacional vira às 02h de Cuiabá.
- Central do atendente: pedidos do dia e comandas abertas. Um detalhe consulta seus documentos diretamente.
- Histórico do cliente: pedidos filtrados por `clienteId`, sem baixar os pedidos de outros clientes.
- Usuários online: somente atividade nos últimos dois minutos; intervalo de 30 segundos, sem consulta com a aba ou área escondida.
- Raspadinhas: pagamentos recentes de pedidos, fechamentos de comandas e histórico de pagamentos do dia. Eventos repetidos da mesma compra são deduplicados na sessão, além da proteção transacional contra prêmios duplicados.

As consultas de período usam os campos existentes `dataMs`, `pagamentoConfirmadoEm`, `fechadoEm` e `criadoEmMs`. Novos fluxos de gravação precisam continuar preenchendo esses campos. Documentos legados sem esses campos não entram nessas consultas de período; consultar um pedido pelo cliente ou pelo ID continua disponível.

## Histórico por solicitação

A conferência retroativa roda automaticamente com ADM ou atendente conectado, e também pelo botão **Conferir** no bloco **Conferir emissões automáticas**. Não baixa mais as coleções inteiras: cada rodada lê até 10 registros por fonte, ordenados por data e ID, a partir do cursor salvo. A primeira conferência começa na criação da campanha automática ativa mais antiga.

O documento `config/recuperacaoRaspadinhas` guarda os cursores e uma trava de dois minutos entre painéis. Só avança um cursor depois de conferir o lote inteiro. Em uma falha, o lote é repetido usando a proteção transacional de concessão; não gera outro prêmio da mesma campanha/compra/cliente. Rodadas com pendências são espaçadas em 30 segundos; em dia, em dois minutos; após falhas ou sem campanhas, em cinco minutos. Esses intervalos limitam o ritmo, mas não constituem uma garantia de consumo máximo diário.

Campanhas desativadas não emitem. Para campanhas ativas cujo prazo já acabou, a recuperação confere se o pagamento ocorreu dentro do período permitido. A validade do prêmio começa na emissão efetiva. A elegibilidade de nível usa o cadastro disponível na conferência; a aplicação não mantém um histórico de mudanças de nível por compra.

As regras do Firestore precisam permitir aos painéis autorizados ler e atualizar esse documento de controle, como já fazem com os pagamentos e concessões. Nenhuma regra foi alterada. Documentos antigos sem os campos de data de pagamento listados acima não entram automaticamente no cursor; precisam de revisão dos dados.

Buscar o histórico de um cliente continua trazendo seus pedidos antigos.

## Validação e publicação

Execute `npm test`. A suíte `leituras-paineis.test.cjs` verifica filtros, encerramento e deduplicação, sem acessar o Firebase real. `cozinha-leituras.test.cjs` verifica os fluxos da cozinha sem consultas gerais.

Mudanças locais não alteram uma versão hospedada anteriormente. Publique também `js/raspadinhas-recuperacao.js` e `css/componentes/raspadinhas.css`, além dos arquivos modificados, e recarregue os painéis que permaneceram abertos. As referências de raspadinhas foram atualizadas para `20261020-3`.

A otimização reduz desperdícios; não impõe um limite de gasto nem garante permanência dentro da cota gratuita. Compare leituras em períodos com movimento semelhante. O período da cota do Firebase e o dia operacional do trailer têm horários de virada diferentes.

## Campanhas de mensagens

ADM envia para uma conta ou nível; Geral envia para todos ou nível. Avisos enviam texto; campanhas de cupom vinculam um cupom ativo existente sem alterar suas regras. A revisão mostra os destinatários antes de enviar.

O histórico é consultado por ação do administrador, em páginas de 20 campanhas, com filtros sobre os registros carregados. Não mantém assinatura em tempo real. O envio usa lotes de até 400 destinatários e grava o avanço no mesmo lote das mensagens. O histórico permite retomar envios incompletos do novo formato; os IDs das mensagens são os da campanha para evitar duplicação. Mensagens gerais são marcadas como lidas ao abrir Geral, assim como ADM.

## Cupons de uso único global

A opção 1x é por código, não por conta. O primeiro pedido confirmado no checkout ou pagamento de comanda que usar o código grava `usadoEm`, `usadoPor`, `origemUso` e `ativo: false` no cupom, na mesma transação da compra. Tentativas simultâneas disputam o mesmo documento: a segunda transação revalida e não grava a compra com o cupom usado. Pagamentos separados preservam a idempotência por ID de pagamento. Cupons diversos continuam reutilizáveis. A interface não permite reativar ou excluir um cupom já utilizado, mantendo o registro histórico. Não há consulta periódica de cupons; a lista é buscada ao selecionar o tipo.
