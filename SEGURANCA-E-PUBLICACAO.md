# Revisão de acesso e publicação — 04/11/2026

> **Atualização após a virada:** autenticação, APIs e regras protegidas já foram
> publicadas e verificadas em produção. O proprietário entrou no ADM e autorizou
> a preparação das 3 contas antigas de teste. Consulte o registro atual em
> [security/ESTADO-PUBLICACAO.md](security/ESTADO-PUBLICACAO.md). As etapas abaixo
> documentam também o estado anterior e a preparação local; referências a uma
> publicação pendente descrevem esse histórico, não o estado atual.

## Situação da revisão

Revisão do código local e das regras fornecidas pelo proprietário em 03/11/2026.
Nenhuma regra foi publicada, nenhuma conta real foi modificada e nenhum pedido
foi enviado. Durante a configuração guiada, o proprietário ativou E-mail/senha
no Authentication, criou sua conta e confirmou as seis variáveis principais
da recuperação em Production na Vercel. Os novos fluxos de login/cadastro/sessão
foram preparados e testados localmente, desativados por padrão. A autenticação da
equipe, as permissões, o checkout público e a visita à mesa foram integrados e
testados localmente. Delivery, perfil e autoatendimento usam as rotas protegidas
quando os indicadores estão ativos. Não houve redeploy ou validação com
credenciais reais.

**Prioridade crítica:** a regra informada contém `allow read, write: if true`
para todos os documentos. Ela não exige identidade e autoriza leitura, alteração
e exclusão de qualquer documento pelo cliente. O aviso exibido no console está
correto. A consulta de código/senha feita na tela não restringe essa permissão.

O código local inclui uma substituição testada para essa autorização, mas ela
ainda não está publicada. Não substituir a regra por
um bloqueio global durante o expediente: os navegadores atuais não enviam uma
identidade de Firebase Authentication, e os fluxos deixariam de funcionar.

O comportamento dos botões não comprova autorização no banco. `noindex`,
`robots.txt`, páginas escondidas e cabeçalhos HTTP também não substituem essa
autorização.

## Pontos encontrados antes da migração

| Prioridade | Evidência                                                                                                                                                                   | O que precisamos proteger                                                                                                                             |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Alta       | `js/admin.js` consulta pedidos ao abrir a página; a administração avançada compara uma senha lida de `config/admin` no navegador.                                           | Administração e alteração do cardápio precisam de identidade administrativa validada pelo servidor/regras.                                            |
| Alta       | `js/funcionario-login.js` consulta funcionários pelo código e guarda identificadores no armazenamento local. Não há integração com Firebase Authentication nos HTML atuais. | Acesso a atendimento/chapa deve depender de uma sessão verificável, com o cargo conferido no banco; alterar `localStorage` não pode conceder acesso.  |
| Alta       | `js/financeiro.js` lê `config/admin` e compara senha ou hash no navegador.                                                                                                  | O segredo/verificador de senha não deve ser lido pelo navegador. O acesso financeiro precisa de autorização própria.                                  |
| Alta       | Delivery e autoatendimento recuperam clientes por nome e telefone ou CDA e consultam/gravam documentos diretamente.                                                         | O cliente só pode ler a própria conta, mensagens e pedidos. Nome/telefone e CDA identificam um cadastro, mas não comprovam a posse da conta.          |
| Alta       | Pedidos, pagamentos, benefícios, cupons e ranks são calculados/transacionados no cliente.                                                                                   | Totais, preço de catálogo, desconto, pagamento, resgate e estorno precisam ser validados por regras/serviço confiável, com proteção contra repetição. |

Essas evidências apontam os limites do cliente atual e explicam por que a regra
pública não pode ser substituída só por uma checagem de botão. Não foram
executadas tentativas contra os dados de produção.

## Matriz para a implementação de autorização

| Perfil                  | Acesso esperado                                                                                                       |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Visitante               | Cardápio e informações públicas da loja. Criar um pedido validado, sem consultar outras contas ou marcar pagamento.   |
| Cliente identificado    | Seus próprios dados, endereços, histórico, mensagens e benefícios; sem alterar rank/saldo/preços por conta própria.   |
| Autoatendimento         | Sessão da mesa e comanda vinculadas àquela visita; chamados somente enquanto o atendimento estiver ativo.             |
| Atendimento             | Mesas, comandas e pedidos operacionais; recebimentos e envio à cozinha conforme as regras do negócio.                 |
| Chapa                   | Dados necessários ao preparo e conclusão dos lotes; sem cadastros de clientes, códigos de funcionários ou financeiro. |
| Administração           | Catálogo, funcionários, campanhas e configurações; alterações registradas com identidade responsável.                 |
| Proprietário/financeiro | Relatórios e controles financeiros autorizados explicitamente.                                                        |

## Próximos passos da segurança

1. Guardar a cópia das regras fornecidas e definir o método de login antes de
   configurar **Authentication**. Regras não são credenciais; não enviar senha,
   chave privada de conta de serviço ou tokens.
2. Definir a identidade verificável da equipe e dos clientes. O fluxo por código
   pode continuar existindo na interface, mas a conferência do código deve ocorrer
   em um serviço confiável, que emite a sessão. O navegador não pode emitir cargos.
3. Separar informações públicas de configurações privadas. Em especial, o documento
   com senhas e códigos não pode ser necessário para carregar o cardápio público.
4. Preparar regras e operações por perfil em um ambiente isolado. Não publicar
   `allow ...: if true`, nem uma mudança global para `request.auth != null`: a
   primeira expõe dados e a segunda bloquearia os fluxos atuais sem autenticação.
5. Testar acesso permitido e negado: uma conta não lê outra, chapa não recebe
   financeiro, cliente não muda preços/saldos, funcionário desativado perde acesso.
   Testar também pedidos, pagamento parcial, cancelamento e repetição de resgate.
6. Preparar backup e retorno às regras anteriores; publicar a mudança de login e
   autorização em conjunto, somente depois da validação.

### Contas e códigos existentes

A migração deve preservar histórico, avatares, ranks, cupons e saldos. Uma conta
nova de Authentication não pode assumir um cadastro antigo apenas digitando o
telefone dele. A ligação precisa de verificação de posse ou aprovação
administrativa. Pedidos sem conta devem continuar disponíveis sem expor dados de
outras pessoas. O login por código da equipe pode ser mantido, com conferência no
servidor, limite de tentativas e cargos emitidos por uma autoridade confiável.

### Login e recuperação discutidos com o proprietário

O fluxo escolhido para preparar é celular e senha, com a sessão compartilhada
entre delivery e autoatendimento no mesmo navegador/domínio. O proprietário
precisa continuar gerenciando cadastros e benefícios pelo seu próprio acesso
administrativo, sem conhecer a senha do cliente. O módulo de recuperação de
30 minutos foi preparado localmente e permanece desativado. O login com senha e
o aviso para primeira senha nas contas de teste foram integrados localmente;
a publicação conjunta com as permissões do banco ainda está pendente. Detalhes e pré-requisitos
estão em [RECUPERACAO-ACESSO.md](RECUPERACAO-ACESSO.md).

A recuperação proposta é gerar pelo ADM um link individual para o cliente
definir uma nova senha. O envio inicial será manual: abrir o WhatsApp no número
previamente cadastrado e o administrador confirmar a mensagem. Não enviar a
senha atual ou armazenar senhas legíveis. O link deve expirar, servir uma única
vez e ser invalidado ao gerar outro. Redefinir a senha não muda os pedidos,
histórico, cupons ou saldos do cliente.

A emissão exige uma identidade administrativa validada no servidor e deve
registrar responsável, conta e horário, sem registrar senha ou o link completo
nos logs. Tokens de recuperação não podem ficar legíveis no Firestore público;
as regras atuais precisam ser substituídas antes de habilitar esse fluxo. A
interface administrativa sozinha não pode gerar a autorização para trocar uma
senha. SMS ou envio automático pelo WhatsApp exigem serviço e análise de custo
separados; não foram contratados ou habilitados.

## Preparado neste primeiro bloco

- Página `404.html`, com mago pensativo, retorno ao cardápio e contato. URLs ausentes
  retornam HTTP 404 no preview; recursos ausentes de JavaScript não recebem HTML.
- Título, descrição, URL canônica e informações de compartilhamento no delivery.
  A arte `images/compartilhamento-pedrao.jpg` tem 1200 × 630 pixels. A fonte visual
  está em `scripts/previa-compartilhamento.html`, sem Firebase.
- `sitemap.xml` lista somente o cardápio. `robots.txt` indica o sitemap e deixa os
  painéis acessíveis ao rastreador para que ele leia `noindex`.
- `noindex` nos painéis, no autoatendimento e na localização. No Vercel, os
  cabeçalhos também impedem indexação e armazenamento dessas páginas.
- Cabeçalhos básicos em `vercel.json`: tipo de conteúdo, política de referência,
  restrição de incorporação por outros sites e de objetos embutidos. Não há
  restrição ao GPS usado no checkout.
- `.vercelignore` exclui testes, ferramentas, dependências de desenvolvimento e
  documentação do deploy estático. A licença da fonte permanece distribuída.

O domínio do projeto confirmado pelo proprietário é
`https://cardapio-pedrao-lanches.vercel.app/`. Canonical, Open Graph, Twitter,
robots e sitemap precisam apontar juntos para esse endereço. As verificações
deste bloco ocorreram localmente.

Os cabeçalhos de `vercel.json` dependem da hospedagem no Vercel. No GitHub Pages,
essa configuração não é aplicada. A prévia de compartilhamento só passa a usar a
nova arte depois da publicação e da atualização do cache da plataforma.

Este bloco não conclui a migração da autenticação/permissões, publicação de regras,
política de privacidade/termos, rastreadores, analytics ou uma auditoria completa
de desempenho. A restrição real ao banco continua pendente da próxima etapa.

## Autenticação e proposta de regras: avanço local

O acesso da equipe foi integrado ao servidor e ao Auth em uma instância separada
do login do cliente. O código libera Chapa, Atendimento ou ambos conforme o
cadastro; somente o proprietário autorizado no servidor recebe o papel de ADM.
A chapa, no modo protegido, usa os dados da fila de preparo e não consulta
os documentos financeiros de pedidos/comandas para montar a tela.

A proposta `security/firestore.proposta.rules` passou em 187 verificações locais.
Também passou a integração dos emuladores oficiais: criação de senha, login,
identidade da equipe, bloqueio entre contas, proteção de saldo, proprietário e
desativação do funcionário. As instruções e os limites dessa validação estão em
`security/COMO-TESTAR.md`.

O serviço `api/pedido-publico.js` já reconstrói preços, carnes, acréscimos, os
12 combos e molhos a partir do catálogo confiável. Confere a identidade pelo
Auth, recalcula a distância/frete e cupons, reserva o bônus/crédito de entrega
e salva pedido, contador e reservas em uma transação. Usa chave de reenvio para
não duplicar a compra e limites persistentes de solicitações. A integração
Auth/REST/Firestore desse serviço passou no emulador, inclusive com preço
adulterado, cupom único e tentativa de outro cliente ler o histórico.

Os pedidos desse novo serviço usam `checkoutProtegido: 1` e uma reserva de
fidelidade. Os caminhos de receber, editar e cancelar na operação foram adaptados
para essa reserva: não antecipam bônus de compra não paga, devolvem o saldo
reservado no cancelamento e não debitam novamente no recebimento. Frete fica
fora da base. Pedidos legados preservam seu tratamento anterior.

O checkout agora está conectado às telas. Perfil, rank mensal, cupons, ativação
de CDA e criação/resposta/encerramento de suporte usam a identidade conferida no
servidor. O reenvio após falha de rede recupera o pedido salvo pela chave privada
do envio, sem criar uma segunda compra. Os cálculos monetários usam centavos.

A visita à mesa tem uma credencial aleatória por navegador/mesa e uma sessão Auth
separada da conta. Recarregar retoma o pedido enviado; encerrar a comanda revoga
o acesso daquela visita. A conta lembrada pode ser usada em outra mesa. O QR
estático não comprova presença física nem distingue uma leitura da câmera de um
link copiado; não se promete essa capacidade.

A recuperação conserva a validade de 30 minutos e o uso único. Um corte privado
de sessão bloqueia também os JWTs anteriores nas regras do Firestore; atualizar
o token sem fazer um novo login não contorna o bloqueio. Gerar outro link não
apaga esse corte. Cadastro, histórico e saldos permanecem preservados.

Além dos testes automatizados, o navegador local completou um pedido de retirada
pela API e um pedido de mesa, incluindo retomada do estado após reabrir a página.
Foram usados dados fictícios, sem Firebase da loja ou envio de WhatsApp.
Campos de clientes/pedidos no ADM, endereços no perfil e textos do carrinho/revisão
foram escapados; isso não é uma auditoria completa de XSS do código legado.

Falta publicar e conferir a configuração real: conta de serviço, domínios
autorizados, regras, APIs e os canais de atendimento. Os dois indicadores
continuam desativados. A última configuração confirmada pelo proprietário é
`false` para ambos; não houve nova leitura da Vercel. A última regra informada
para o banco em uso ainda é a pública descrita no começo deste documento.
O roteiro está em [security/PUBLICACAO.md](security/PUBLICACAO.md).

## Referências oficiais

- [Autorização no Firestore](https://firebase.google.com/docs/firestore/security/get-started)
- [Evitar regras inseguras](https://firebase.google.com/docs/rules/insecure-rules)
- [Impedir indexação com noindex](https://developers.google.com/search/docs/crawling-indexing/block-indexing)
- [Cabeçalhos no Vercel](https://vercel.com/docs/project-configuration/vercel-json#headers)
- [Página 404 no Vercel](https://vercel.com/kb/guide/custom-404-page)
