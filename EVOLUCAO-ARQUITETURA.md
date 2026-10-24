# Banco de dados e interface: avaliação do projeto

Esta é uma proposta baseada no código local em 24/10/2026. Nenhuma migração foi
iniciada. Não foram medidos tráfego, fatura, volume real do banco ou desempenho
em celulares reais; por isso não há promessa de economia ou velocidade.

## O que usamos hoje

Firebase é uma plataforma. Nosso banco é o Cloud Firestore, um banco NoSQL de
documentos e coleções. `js/firebase-operacao.js`, `js/script.js` e
`js/autoatendimento.js` inicializam seu SDK. O navegador consulta e grava dados
diretamente. A cozinha e outros painéis usam `onSnapshot` para acompanhar mudanças.
Há transações para pagamentos, cupons, numeração e fila: NoSQL também oferece
transações; elas não são exclusivas do SQL.

O projeto tem telas separadas em HTML e scripts clássicos, sem React. Os arquivos
de atendente, delivery, autoatendimento e operação misturam renderização, estado,
consultas e regras do negócio. Já existe um conjunto útil de testes dos fluxos.
Separar essas responsabilidades ajuda independentemente do banco escolhido.

Referências: [modelo do Firestore](https://firebase.google.com/docs/firestore/data-model),
[transações e consistência](https://firebase.google.com/docs/firestore/understand-reads-writes-scale),
[atualizações em tempo real](https://firebase.google.com/docs/firestore/query-data/listen).

## SQL compensa?

SQL é uma linguagem; PostgreSQL seria uma opção concreta de banco relacional.
Ele organiza dados em tabelas relacionadas e permite juntar informações em uma
consulta. Exemplo: pagamentos por cliente, pedido e período, ligados aos itens
vendidos e aos descontos utilizados. As relações e restrições podem ser
declaradas no próprio banco.

Para o Pedrão, isso pode facilitar relatórios financeiros, auditoria, estoque,
compras de insumos e uma eventual operação com várias lojas. Não significa que
o Firestore deixou de comportar o sistema. Crescimento por si só não obriga uma
troca; precisamos observar custo de leituras, dificuldade das consultas,
duplicações e consistência dos dados.

Minha recomendação agora é manter o Firestore enquanto organizamos o acesso aos
dados e medimos os gargalos. Se relatórios e relações virarem o principal custo
de manutenção, avaliar PostgreSQL com um piloto. Uma opção no próprio ecossistema
Firebase é o SQL Connect, baseado em PostgreSQL; isso também exige outro modelo
de dados e operações. Não converte automaticamente o nosso código Firestore.
Outra opção é uma API própria com PostgreSQL gerenciado. A escolha depende de
autenticação, recursos, operação, região e orçamento.

Referências: [relações e consultas com JOIN no PostgreSQL](https://www.postgresql.org/docs/current/tutorial-join.html),
[Firebase SQL Connect](https://firebase.google.com/docs/sql-connect).

## O que uma migração exigiria

1. Fazer um inventário das coleções e regras, levantar volumes/custos e preparar
   backup e ambiente de testes. Conferir permissões de clientes e funcionários.
2. Separar serviços como pedidos, pagamentos, clientes e produção. As telas
   passam a chamar esses serviços. As regras críticas precisam de validação e
   autorização no servidor, qualquer que seja o banco.
3. Modelar tabelas: clientes, produtos, variações, pedidos, itens, adicionais,
   comandas, pagamentos, envios à cozinha, cupons/usos e mensagens. Guardar também
   a descrição, o tipo e o preço no momento da compra: alterar o cardápio não
   pode alterar o histórico de um pedido.
4. Criar importadores repetíveis, mantendo os IDs de origem, vínculos, datas,
   centavos e estados. Preservar o dia operacional de Cuiabá com virada às 2h.
   Comparar quantidades, saldos, pagamentos, cupons usados e totais entre bancos.
5. Reproduzir transações e proteção contra duplicidade. Testar dois atendentes
   agindo juntos, pagamento parcial, retry de envio, edição do lote da cozinha,
   retirada da tela, raspadinhas e resgate único de cupons.
6. Substituir os listeners do Firestore por atualização em tempo real da nova
   solução, como eventos do servidor/WebSocket. Não basta importar os dados e
   trocar uma URL: a cozinha depende desse comportamento.
7. Ensaiar a virada. Definir uma fonte oficial para gravações, sincronização
   final ou uma pausa curta planejada, validação e procedimento de retorno.
   Evitar duas bases recebendo gravações independentes sem reconciliação.

Podemos começar com relatórios em uma cópia SQL sem trocar a operação. Isso
valida a modelagem, mas acrescenta sincronização e não elimina o Firestore.
Prazo e custo só fazem sentido depois desse inventário e de um piloto.

## React compensa?

Sim, vejo benefício para manutenção: produto, escolhas de carne, acréscimos,
combos, carrinho, pagamento e avisos podem virar componentes compartilhados.
Uma correção no componente do produto passa a atender delivery, mesa e
atendente. Isso reduz a repetição que hoje exige conferir as três versões.

React não garante carregamento mais rápido. Ele também acrescenta JavaScript;
imagens, consultas, assinaturas, divisão de código e quantidade de trabalho a
cada interação continuam importantes. Precisamos medir antes/depois em celular
e conexão limitada. As artes pequenas desta entrega, por exemplo, ajudam mesmo
sem React.

É possível adotar React aos poucos, mantendo o Firebase. Eu começaria com um
módulo de catálogo/personalização, reaproveitando as regras puras e seus testes,
e depois migraria as outras telas. Não colocaria React e PostgreSQL em produção
na mesma virada: separar as mudanças permite identificar e corrigir regressões.

Ordem sugerida: organizar regras e acesso aos dados → medir e criar o primeiro
módulo React → migrar telas gradualmente → decidir SQL com um piloto e números.

Referências: [adotar React em um projeto existente](https://react.dev/learn/add-react-to-an-existing-project),
[medir antes de otimizar renderizações](https://react.dev/reference/react/useMemo).
