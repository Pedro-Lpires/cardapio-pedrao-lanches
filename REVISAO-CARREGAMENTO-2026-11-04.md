# Carregamento e conexão — revisão local de 04/11/2026

Ainda não publicado. Base de produção: `63df6d1`.

## Comportamento

- Indicador modal durante localização, entrada da equipe, envio do delivery, consumo local e envio à cozinha pelo autoatendimento ou atendente. Cliques repetidos ficam bloqueados durante o envio; falhas liberam uma nova tentativa e preservam o carrinho.
- Localização tem prazo de 15 segundos. Falta de pagamento é informada antes das consultas de rede.
- Pedidos novos e chamados das mesas começam a ser observados depois da restauração da identidade protegida. A escuta dos pedidos tem reconexão limitada, botão de nova tentativa e retomada ao voltar a conexão. Não altera permissões do Firestore.
- WhatsApp reserva a janela durante o toque, antes das esperas de rede. Depois de salvar, navega para a mensagem pronta. O aviso também oferece um link explícito com o texto completo, além de copiar e abrir a conversa sem texto. Esses links não salvam outro pedido.
- O SDK reaproveita o token válido e o renova quando necessário. Verificações de sessão, revogação e vínculo no servidor permanecem.
- Leituras independentes na mesma transação REST são agrupadas em uma requisição. Nenhum cache de preços, pedidos ou permissões é compartilhado entre transações.
- A conferência de benefícios não consulta configuração extra para visitantes sem fidelidade; o servidor continua validando o pedido antes de gravar.
- Versões dos scripts e da cadeia de CSS foram atualizadas para evitar reaproveitar arquivos antigos após uma futura publicação.

## Verificação

- 121 suítes locais passaram, incluindo envio duplicado, falha de rede, nova tentativa, popup bloqueado, espera pelo Auth e lote transacional sem preço antigo.
- Revisão visual em 375 px com rede e GPS lentos simulados: indicador visível, saída do carregamento e aviso imediato quando falta pagamento.
- Prévia isolada: `tests/revisao-browser.html?pagina=index.html&cenario=carregamento`. O mesmo cenário funciona para `atendente.html`.
- Nenhum pedido real, mensagem, senha, regra ou variável de produção foi alterado nesta revisão.

A abertura de aplicativo externo depende do navegador e de haver WhatsApp disponível no aparelho. Latência real da função, banco e rede não foi medida nesta revisão; os testes de demora usam dados fictícios. A recuperação por link permanece disponível quando o navegador impede a abertura automática.
