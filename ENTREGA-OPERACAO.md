# Pedrão Lanches — alterações desta rodada

O projeto principal continua sendo a base. A lógica de negócio do projeto Claude não substituiu seus arquivos; a camada visual foi trazida em `css/tema.css`.

## Como usar

- **Pagamento separado:** abra a comanda, escolha Separado e selecione **Por itens** ou **Por valor**. Um lanche de R$ 30 pode receber duas partes de R$ 15. Na identificação aparecem continuar como o cliente vinculado, usar outro cliente e continuar sem conta. Cupom vem antes da fidelidade. Por valor não aceita cupons de produtos, pois não identifica uma fração de item.
- **Confirmar pedidos:** entrega/retirada aguardam conferência em **Pedidos, cozinha e impressão**, no admin ou atendente. O primeiro pedido do autoatendimento e os itens novos adicionados à comanda pelo atendente entram diretamente na cozinha. Itens já enviados não são enviados outra vez; quantidades adicionais geram uma nova entrada. Alterações em personalizações após envio precisam ser conferidas com o chapeiro.
- **Chapeiro:** abra `cozinha.html` no celular e `cozinha.html?modo=monitor` no computador. Entre com um código de funcionário ativo cadastrado no admin. A fila mostra os antigos primeiro, sem valores. No celular, OK conclui. Em Pedidos concluídos, Voltar devolve à posição original.
- **Impressões:** Chapeiro, Motoboy e Geral ficam na central dos dois painéis. Informe o número da mesa para imprimir todas as comandas abertas juntas. Somente itens com a mesma personalização são agrupados. A janela permite imprimir ou salvar PDF.
- **Motoboy:** bebidas avulsas e dos combos ficam separadas. Endereço, condomínio, CNH e localização são guardados no pedido. Preparar WhatsApp abre uma mensagem para conferência; o operador escolhe o destinatário e envia.
- **Recebimentos de entrega/retirada:** confirme manualmente o dinheiro recebido na central. Enviar à cozinha não confirma pagamento. Pix continua sendo conferido pelo operador; não há gateway online nesta entrega.
- **Campanhas:** na administração avançada, selecione todos, nível ou conta, confira a prévia e publique. Os avisos aparecem na aba de mensagens da conta. Os cupons criados pela campanha são restritos aos destinatários. Não são enviados pelo WhatsApp automaticamente e não têm limite de uso único nesta rodada.
- **Histórico no admin:** inclui pagamentos locais atribuídos a quem realmente pagou. A parte sem conta não aumenta o gasto do titular original.
- **Financeiro:** fica em `financeiro.html`, separado do admin. Até definir uma senha própria, usa a senha financeira existente ou a senha mestre cadastrada. Trocar senha atualiza apenas a senha financeira. A conferência considera o dia operacional de 02h a 02h em Cuiabá. Pedidos não confirmados aparecem como valores a conferir.
- **Fiscal:** o admin pode guardar nome/razão social e CPF/CNPJ solicitados pelo cliente. O financeiro guarda uma preparação por dia, com valor conferido e valor informado separadamente. Não emite nota fiscal autorizada. A integração com emissor foi adiada a pedido do proprietário, para orientação do contador.

## Validação feita

`node tests/operacao.test.cjs` verifica pagamentos 15 + 15, histórico único, repetição idempotente, cupom e fidelidade (recebido 300 / quitado 325), rejeição de pagamentos concorrentes e acima do saldo, agrupamento de impressão, observações, bebidas de combos, concluir/voltar e identificação pela sessão do autoatendimento.

O teste em `tests/firebase-browser.html` foi executado pelo SDK real do Firebase: 15 + 15, uma parte vinculada a uma conta de teste e outra sem conta, idempotência, histórico e conclusão da fila. Todos os documentos dessa execução foram removidos. Não foram enviados avisos a clientes, alteradas senhas reais, publicados cupons ou modificadas regras.

O cardápio, a busca, o acesso à administração avançada e o acesso financeiro foram conferidos no navegador. Cardápio, admin, painel e login do atendente, autoatendimento, cozinha e financeiro foram medidos em prévias com viewport de 320, 360, 390 e 430 pixels, sem transbordamento lateral nas telas iniciais. Também foram conferidos finalização, admin avançado, formulário de produto e mesas em 320 pixels. Impressora física, uso em aparelho real e sincronização de dois dispositivos ainda aguardam teste.

## Ajustes de interface pedidos nos comentários

- Cinco produtos por categoria, com Ver mais/Ver menos. A busca considera todos os produtos, inclusive os escondidos; limpar a busca restaura a exibição limitada.
- Tipos de pedido em três caixas; somente a selecionada tem fundo vermelho.
- Adicionais corrigidos: o CSS não corta mais a lista em altura zero ou em 600 pixels. O botão informa o estado expandido.
- Produto fecha pelo X no topo; a ação de adicionar fica no rodapé do modal. O modal suporta Escape e navegação por teclado.
- Rodapé com WhatsApp e parceiros Brownies/Pratas, aproveitando os nomes do projeto Claude. Os parceiros são apresentados por nome, pois seus links e logos não foram informados.
- Estilos comuns para celular em `css/mobile.css`, carregados depois dos estilos anteriores em todas as sete páginas.

Regressão de busca: `node tests/cardapio-ui.test.cjs`. A prévia `tests/responsividade.html` permite conferir cada página em quatro larguras sem depender do tamanho da janela principal.

## Antes de publicar

As senhas atuais continuam sendo verificadas na interface. Separar uma página ou guardar hash não cria autorização no servidor. Para garantir acesso exclusivo do proprietário, ainda é necessário configurar Firebase Authentication e regras/perfis no Firestore, junto da migração dos acessos dos funcionários e clientes. Nenhuma regra foi relaxada nesta rodada.

Coleções novas usadas: `filaCozinha`, `campanhas` e `fechamentosFinanceiros`. Coleções atuais usadas: `comandas`, `pedidos`, `clientes`, `cuponsDesconto`, `historicoPagamentosClientes`, `sessoesMesa`, `atendentes`, `produtos` e `config`.

O servidor de prévia pode ser iniciado com `node tests/servidor-local.cjs`, em `http://127.0.0.1:8090`. Esta versão ainda não foi publicada.

## Revisão mobile e raspadinhas — 12/10/2026

As telas do atendente passaram a substituir a etapa anterior: mesas, mesa escolhida, comanda, produto e pagamento usam a mesma área. Voltar recupera a etapa anterior; o X retorna ao menu do atendente. A comanda, a mesa e a lista de comandas abertas têm ações diretas de cozinha e impressão. Entregas e retiradas oferecem consulta de pedidos existentes; depois de criar um pedido, abre a sua conferência com os atalhos. O entregador fica restrito a entregas.

O ADM abre uma função por vez em uma caixa com descrição e X. As funções fiscais começam recolhidas. Pedidos recentes receberam impressões por pedido, com ações de entregador somente para entrega. A impressão geral não inclui data/hora nem taxa zero; mostra recebido e pendente, considerando a quitação com benefícios. Fechar Comanda permanece como ação de pagamento, distinta do X que fecha uma tela.

No cliente, a conta mostra banner e identidade da loja sem busca, categorias ou informações de operação. O perfil tem campos espaçados, código ativo somente para consulta e retorno correto da edição. O aviso de login para salvar endereço só aparece depois da tentativa de salvar. A revisão usa cartões para itens e valores. A observação geral foi removida; observações por item continuam. Molhos mantêm o controle e o nome juntos. A busca tem limpeza vermelha e foco vermelho. O autoatendimento também tem busca em todos os produtos e cinco itens iniciais com Ver mais.

O financeiro contabiliza somente entradas confirmadas. Oferece dia operacional de 02h a 02h, semana de domingo a sábado, mês civil e ano civil em Cuiabá. Mostra pagamentos, categorias, molhos, entrega, cupons e fidelidade. O total da loja já está líquido dos benefícios e exclui a entrega. Pagamento separado por valor aparece como **Pagamento por valor sem categoria**, conforme solicitado. Recebimentos por itens distribuem o valor líquido pelos itens pagos, com arredondamento em centavos. Preparações do mesmo mês/semana/ano usam uma única chave de período.

### Raspadinha

- ADM → Administração Avançada → Raspadinhas: configure nome, emissão manual/automática, público por conta ou nível ou todos, compra mínima após benefícios sem entrega, prêmio fixo, mínimo da próxima compra, validade, datas e termos. Nenhuma campanha real foi criada nesta revisão.
- Uma campanha concede uma raspadinha por compra elegível e cliente; compras diferentes acumulam prêmios. Pagamentos separados do mesmo cliente na mesma comanda são somados para verificar o mínimo.
- Na emissão automática, os painéis de atendimento/ADM observam os pagamentos confirmados. Se o painel foi fechado durante uma atualização, a próxima abertura confere os registros; o botão **Conferir emissões automáticas** permite repetir a conferência. A transação usa campanha + compra + cliente para impedir duplicidade.
- O prêmio chega na aba ADM das mensagens da conta, com um cartão vermelho e a logo. Pode ser raspado por toque/ponteiro ou revelado por botão. Código, validade, mínimo e termos acompanham o prêmio.
- Resgate: o atendente informa nome e código, seleciona uma nova compra com pagamento confirmado, confere os termos e marca **Usou**. O mínimo considera o pago após descontos, sem entrega. Cada cliente resgata no máximo uma raspadinha por compra, mesmo de campanhas diferentes; a compra que gerou o prêmio não pode resgatá-lo. A mesma compra pode resgatar um prêmio anterior e gerar outro, que fica para uma compra seguinte. Prêmios guardados permanecem disponíveis até vencer, sem somar compras pequenas para atingir o mínimo. A transação rejeita reutilização, vencidos e cancelados. Em entregas, o código pode ser informado ao atendente ao fazer o pedido; não foi adicionado outro estágio ao checkout.
- O ADM edita/pausa/exclui campanhas e consulta prêmios por telefone/CDA. Pode cancelar um prêmio, mudar sua validade ou corrigir um uso. Alterar a campanha vale para próximas emissões; prêmios emitidos preservam seus termos.
- Coleções novas: `campanhasRaspadinhas`, `raspadinhas`, `concessoesRaspadinhas` e `resgatesRaspadinhas`; mensagens ficam na subcoleção da conta. A proteção de acesso no servidor continua dependente da migração de Authentication/regras já descrita acima.

Produtos aceitam foto selecionada no painel, com prévia e remoção. A imagem é reduzida a até 600 px e comprimida em WebP, limitada a 220 mil caracteres, e armazenada no cadastro do produto. URLs e nomes de arquivos anteriores continuam compatíveis. O limite evita depender de uma configuração nova do Storage.

### Verificação desta revisão

`node tests/revisao.test.cjs`, `node tests/operacao.test.cjs` e `node tests/cardapio-ui.test.cjs` verificam períodos, líquido/entrega/descontos, pagamento por valor, concessão idempotente, pausa, validade, acúmulo, uso único, impressão e regressões anteriores. Os JavaScript passaram pela verificação de sintaxe.

`tests/revisao-browser.html` usa um Firebase simulado e armazenamento em memória, sem enviar pedidos, fotos, mensagens ou prêmios ao projeto real. No navegador foram conferidos mesas → comanda → adicionar → voltar → X, entrega existente, conta/edição/CDA, financeiro a 320 px, autoatendimento com busca de item oculto e X dentro do login, revisão/molhos e mensagem → cartão → prêmio revelado. A fixture inclui somente nomes e códigos fictícios. Impressora física e uso em aparelho real continuam como verificação operacional antes da publicação.

# Revisão de 18/10/2026

## Ajuste de fluxo e numeração por contexto

- Consumir no local no delivery: revisão apenas dos itens e subtotal, com envio direto para WhatsApp. Sem seleção/cobrança de molhos, cupom, desconto antecipado ou escolha de pagamento; pagamento permanece a definir no local.
- Cozinha identifica Entrega, Retirada ou Mesa. Registros antigos recuperam a modalidade do pedido de origem.
- Número do motoboy considera somente entregas do dia operacional. Pedidos recentes do ADM continuam numerados pelo dia; busca por cliente e histórico do próprio cliente usam a sequência pessoal. Conferência/comanda e WhatsApp do cliente sem número.
- No detalhe da central, Voltar retorna à lista da categoria; X fecha a categoria e retorna aos botões Delivery/Retirada/Mesas.
- Verificação em 375 × 667 com fixture: revisão local limpa, Voltar para lista e X para categorias. Testes de sequência diária e consumo local passaram.

- Numeração interna por dia operacional (02h Cuiabá), contador separado por data e inicialização a partir dos pedidos daquele dia. Identificador do Firebase preservado. Site, atendente e autoatendimento usam o mesmo contador diário.
- Cliente recebe mensagem/histórico sem número; atendente, ADM e motoboy usam o número do dia. Impressão do motoboy sem link de localização; compartilhamento por WhatsApp conserva a localização disponível.
- Categorias da central abrem etapa fixa sobreposta com Voltar e um único X. X retorna à etapa imediatamente anterior.
- Teste `numero-diario.test.cjs`: pedidos simultâneos, início do novo dia às 02h, número legado e impressão sem localização.

- Carrinho acima da navegação inferior: itens com rolagem própria, Limpar e Finalizar fixos no painel.
- Validação de nome e celular antes da revisão. Voltar mantém o usuário na finalização; após preparar o WhatsApp e limpar o pedido, retorna ao cardápio. Fundo escurecido durante o checkout.
- Entrega manual do atendente usa taxa digitada; localização segue por WhatsApp fora deste formulário.
- Avulsos limpam o modo anterior de combo, liberando o controle de quantidade. Remover item não é tratado como botão de fechar.
- Cozinha mantém um preparo pendente por origem, atualiza correções, consolida filas antigas pendentes e preserva o registro dos itens concluídos. Pagamento não retira o preparo; cancelamento da comanda cancela a fila vinculada.
- Combos na cozinha mostram somente lanches com acréscimos/observações; concluídos no topo. Autoatendimento oferece acréscimos em todos ou individualmente, com fechar próprio.
- Chamados preservam Voltar mesmo após atualização da lista; central de produção separa mesas, entregas e retiradas.
- Conferência local com fixture sem Firebase real: carrinho com cinco itens, nome ausente, retorno da revisão, chamados, grupos da central, mesa e incremento de quantidade. Suítes de operação e revisão passaram.

# Revisão de 14/10/2026

- Financeiro: fechamento antes dos filtros; dia, mês, ano ou mês seguido de semana (domingo a sábado).
- Entregas na central limitadas ao dia operacional de Cuiabá, com atualização na virada às 02h. Histórico permanece no financeiro.
- Lista de pedidos resumida; Abrir pedido mostra itens e ações. Recebimento confirmado ganha indicação visível e continua separado de produção/entrega.
- Cozinha e Motoboy abrem opções próprias. Corrigido o destino do painel de personalização dos produtos da comanda.
- Barras horizontais ocultas mantendo gesto de toque. Busca e formulários do autoatendimento compactados, com escolha Login/Criar login.
- Carrinho contínuo e checkout em revisão dos valores / entrega e pagamento; CNH condicionada a condomínio Sim, taxas e molhos exibidos somente quando aplicáveis.
- Endereços dentro de editar perfil, seleção dos salvos no checkout e campo por escrito com referência para o motoboy.
- Link de localização apenas registra/compartilha a localização informada; a consulta de rota e a taxa manual continuam a cargo do atendente.
- Validação automatizada: quatro suítes locais (operações, revisão, cardápio e limites operacionais/semanas). Nenhuma publicação realizada.
