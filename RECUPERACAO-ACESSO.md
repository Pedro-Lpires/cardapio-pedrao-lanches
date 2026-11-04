# Recuperação de acesso — link de 30 minutos

## Entrega local e limite atual

O fluxo de recuperação foi implementado e testado com dados fictícios. Está
**desativado por padrão**. Não foram criadas contas reais, emitidos links reais,
enviadas mensagens ou alteradas regras do Firestore.

Os fluxos de criar senha, entrar e restaurar sessão foram preparados no index e
no autoatendimento, com o Firebase Authentication compartilhado entre os dois
canais. **Permanecem desativados para produção**, junto com a recuperação, até a
conclusão das permissões do banco e das operações financeiras. A regra pública
atual continua sendo um problema. Com o backend explicitamente desativado, o
fluxo legado continua disponível para os testes existentes.

### Primeira senha dentro da conta, conforme solicitado

O proprietário esclareceu que os cadastros existentes são somente testes. Para
esses cadastros, foi preparado um aviso visual de administração, **Crie sua
senha**, dentro da conta nos dois canais. Ele abre uma janela com nova senha,
confirmação e opção de lembrar no dispositivo. O aviso some após a criação.
Não é uma mensagem enviada a um cliente real, nem grava a senha no Firestore.

No acesso administrativo protegido existe **Preparar contas de teste para criar
senha**. Após confirmação explícita do proprietário, o servidor aprova apenas o
snapshot dos cadastros atuais, na coleção privada `authClientesTeste`. Cadastros
futuros não entram nessa exceção automaticamente. **Nunca executar essa aprovação
em massa em uma base com clientes reais.** Nenhuma aprovação real foi executada.

Durante essa transição de testes, nome e telefone podem abrir somente um cadastro
que conste nessa aprovação e ainda não tenha identidade/senha no Authentication.
Essa exceção não emite uma sessão Auth. Ao criar a senha, o Firebase assegura a
unicidade do celular/e-mail, impedindo duas criações concorrentes ou a troca de
uma senha existente por nome/telefone. A aprovação deixa de permitir esse acesso
assim que a conta ganha senha. Não generalizar essa exceção para cadastros reais.

Contas novas escolhem senha e confirmação no cadastro, sem WhatsApp para a primeira
senha. Recebem UID e vínculo no servidor. O e-mail interno derivado do celular não
exige que o cliente informe e-mail. O celular cadastrado não é verificado por SMS;
isso não deve ser apresentado como verificação de posse do telefone. Para uma conta
nova, o histórico usa `clienteAuthUid`, sem assumir pedidos de visitantes só porque
eles informaram o mesmo telefone. Os testes antigos aprovados conservam o histórico.

No modo protegido, delivery entra por celular e senha; autoatendimento também
aceita CDA e senha, com resolução/conferência no servidor. O código sozinho não
substitui senha. A sessão de cliente usa o app Firebase padrão em ambos os canais;
o acesso de recuperação do proprietário continua em app separado. Local/Session
persistence determina lembrar ou não no dispositivo; sair encerra a sessão
compartilhada. Nome e telefone no `clientePedrao` antigo não restauram uma sessão
protegida. A sessão da conta continua distinta da visita/comanda de cada mesa.

Senhas são entregues ao Authentication, sem campo de senha no cadastro público,
mensagens ou logs. Cadastro e primeira senha têm limites transacionais por
identificador (5/15 minutos) e global (100/15 minutos), na coleção privada
`authTentativasCliente`. A exceção dos testes, os vínculos e esses limites exigem
as novas regras; **as flags continuam false enquanto essa proteção não existir**.

### Progresso da configuração com o proprietário

- O proprietário ativou E-mail/senha no Authentication e informou o UID da sua
  conta administrativa. O UID foi preparado em `.env.local`, ignorado pelo Git.
- O proprietário confirmou que salvou na Vercel, no ambiente Production,
  `ADMIN_AUTH_UIDS`, `FIREBASE_SERVICE_ACCOUNT_JSON`, `SITE_PUBLICO_URL`,
  `FIREBASE_PROJECT_ID`, `FIREBASE_WEB_API_KEY` e `RECUPERACAO_CHAVE`.
- A origem confirmada no painel da Vercel é
  `https://cardapio-pedrao-lanches.vercel.app/`. A configuração local e o exemplo
  foram ajustados para esse endereço.
- Os valores privados da Vercel não foram lidos ou validados em uma chamada real.
  Não solicitar que sejam colados no chat. A chave de proteção local foi gerada
  com 32 bytes aleatórios e seu comprimento foi conferido sem imprimir o valor.
- Nenhum redeploy ou regra foi publicado nesta etapa. Os dois indicadores de
  ativação devem permanecer `false`; salvar credenciais não conclui a migração.
- O proprietário confirmou também as duas variáveis de controle na Vercel, ambas
  com valor `false`.

Antes do corte, homologar os novos fluxos com Auth e regras reais em ambiente
isolado. Os caminhos legados só foram mantidos para a fase desativada/preview
estático. As permissões da equipe/proprietário, checkout, pagamento, fidelidade,
rank, benefícios e visita à mesa foram integrados e testados localmente. Falta
publicar o conjunto e validar a configuração real. Não ativar as flags apenas para ver
o formulário funcionar. A fixture local permite revisar o visual sem esse risco.

## Funcionamento

1. No ADM, **Acesso de recuperação** conecta uma identidade administrativa do
   Firebase. Essa sessão é separada da conta usada para comprar no delivery.
2. Em **Fidelidade → buscar cliente**, ou em **Cliente e benefícios** de um pedido,
   **Redefinir acesso** abre a janela do cliente. O servidor exige um ID token
   válido, não revogado, com a permissão de administrador.
3. **Gerar link de 30 minutos** consulta o celular vinculado no Authentication.
   Não aceita como prova de vínculo um campo `authUid` do Firestore público.
4. O link expira exatamente 30 minutos após sua emissão no relógio do servidor.
   Abrir a página não renova esse prazo. Depois de um minuto, o ADM pode gerar
   outro link, que substitui o anterior.
5. **Enviar pelo WhatsApp** apenas abre a conversa com a mensagem pronta no número
   cadastrado. O administrador confirma o envio. Nenhuma API de WhatsApp/SMS foi
   contratada ou habilitada.
6. O cliente escolhe e repete a nova senha. O uso é reservado em uma transação do
   Firestore antes da troca; duas requisições simultâneas não trocam duas senhas.
   Se o provedor falhar depois dessa reserva, o link não volta a valer: deve ser
   emitido outro. Isso impede reuso em um resultado incerto.
7. A redefinição usa o código nativo do Firebase e preserva cadastro, pedidos,
   histórico, ranks e benefícios. Não concede login automático após a troca.

## Proteções implementadas

- A validade de 30 minutos não vem do navegador. O token é cifrado e autenticado
  com AES-256-GCM; inclui prazo, identidade, código nativo e nonce aleatório.
  Alterar o conteúdo, domínio ou prazo invalida o token.
- O código nativo não aparece legível no link. Assim, não pode ser extraído para
  ignorar a validade mais curta imposta pelo Pedrão.
- O token fica no fragmento `#token=...`, que não é enviado ao pedir a página, e
  é removido do endereço visível antes do formulário. A página usa `no-referrer`.
- Senha, token e código não são guardados no navegador nem registrados nos logs.
  No Firestore, ficam somente hash do nonce, UID, responsável, estado e horários
  na coleção privada `authRecuperacoes`.
- O servidor rejeita emissão sem autorização, conta desativada, vínculo de
  telefone alterado, solicitação excessiva, origem diferente e corpo muito grande.
- O fluxo não confia em `adminAvancadoLiberado`, cargo no `localStorage` ou ID
  informado pelo cliente. O backend verifica o token do Firebase com revogação.
- A troca nativa de senha revoga refresh tokens anteriores. O corte privado
  `authRecuperacoes/{uid}.revogadoAntesEm` também recusa JWTs anteriores nas APIs
  e nas regras do Firestore, inclusive quando renovados sem um novo login.
  Gerar outro link conserva esse corte. Como `auth_time` tem precisão de segundos,
  uma tentativa de login no mesmo segundo da troca pode precisar ser repetida.

## Configuração antes de habilitar

As variáveis estão listadas, sem valores privados, em `.env.example`. Valores
reais vão nas variáveis privadas do servidor/Vercel, nunca no HTML, JavaScript
público ou no chat. O endpoint exige HTTPS e utiliza Node 22 ou superior.

| Variável                        | Uso                                                                                                                                                   |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `RECUPERACAO_ACESSO_ATIVA`      | `false` até concluir a migração e validar o ambiente.                                                                                                 |
| `REGRAS_FIRESTORE_PROTEGIDAS`   | Declaração manual de que as regras foram corrigidas e testadas; não é uma auditoria automática das regras.                                            |
| `SITE_PUBLICO_URL`              | Origem HTTPS do site; o projeto atual usa `https://cardapio-pedrao-lanches.vercel.app/`.                                                              |
| `FIREBASE_PROJECT_ID`           | Projeto esperado; padrão `pedrao-lanches`.                                                                                                            |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Credencial privada de serviço com as permissões necessárias de Authentication e Firestore.                                                            |
| `FIREBASE_WEB_API_KEY`          | Identificador do mesmo projeto para a operação nativa de redefinição.                                                                                 |
| `RECUPERACAO_CHAVE`             | Chave aleatória de 32 bytes codificada em base64. Rotacionar invalida links antigos.                                                                  |
| `ADMIN_AUTH_UIDS`               | UIDs administrativos autorizados no servidor, separados por vírgula. Também é aceita uma custom claim `admin: true` emitida por autoridade confiável. |

Pré-requisitos:

- Authentication configurado e identidade do proprietário criada. Não guardar
  senha administrativa no Firestore ou enviá-la para os scripts do site.
- Contas do cliente vinculadas com verificação de posse; o usuário do
  Authentication deve ter celular E.164 e provedor `password`. O endereço usado
  internamente pelo provedor não obriga envio por e-mail; a emissão desta rotina
  não envia e-mail.
- Política de senha do cadastro e da recuperação alinhadas. A tela pede ao menos
  8 caracteres; políticas adicionais do projeto devem ser refletidas na tela.
- `authRecuperacoes` inacessível para leitura/escrita pelos navegadores. A conta de
  serviço opera pelo servidor. Um `allow false` isolado não vence a regra global
  `allow ...: if true`; a autorização do projeto precisa ser reescrita de forma
  coerente, sem manter esse acesso global.
- Revisão dos pontos que renderizam dados de clientes/pedidos em HTML antes de
  habilitar sessões administrativas. O novo modal usa escape e elementos DOM,
  mas isso não significa que todo o ADM legado passou por uma auditoria de XSS.
- Homologação dos fluxos completos antes de publicar. Há testes com mocks e
  testes integrados nos emuladores oficiais de Auth/Firestore, com senhas,
  tokens, checkout, visita à mesa e regras funcionando juntos. Eles não substituem
  a validação da configuração real durante a publicação conjunta.

Não basta trocar os dois indicadores para `true` enquanto o banco está público
e o login continua sendo apenas nome e telefone. O botão desativado informa a
pendência e não gera uma autorização fictícia.

## Arquivos

- `api/recuperacao-acesso.js`: endpoint do Vercel, status e validação HTTP.
- `api/_lib/recuperacao-acesso.cjs`: prazo, criptografia, autorização e uso único.
- `api/_lib/recuperacao-runtime.cjs`: configuração privada e integração com Auth.
- `api/_lib/recuperacao-firestore-rest.cjs`: transporte REST restrito à coleção
  privada, com transação, rollback e retry em conflito.
- `js/recuperacao-admin-ui.js`: acesso administrativo, emissão e WhatsApp manual.
- `recuperar-acesso.html` e `js/recuperar-acesso.js`: formulário recebido pelo cliente.
- `api/acesso-cliente.js` e `api/_lib/acesso-cliente*.cjs`: cadastro, primeira
  senha de testes aprovados, CDA com senha, sessão e vínculo conferidos no servidor.
- `js/acesso-cliente-ui.js` e `css/componentes/acesso-cliente.css`: aviso ADM,
  formulário interno, login e sessão compartilhados; integração nos dois canais.
- `api/acesso-equipe.js` e `api/_lib/acesso-equipe*.cjs`: código privado,
  funcionário ativo, limites de tentativas, perfil e autorização do proprietário.
- `js/acesso-equipe-ui.js` e `css/componentes/acesso-equipe.css`: Auth operacional
  separado do cliente, acesso salvo conforme escolha e bloqueio dos painéis.
- `security/firestore.proposta.rules`: proposta com permissões separadas,
  posteriormente publicada em 04/11/2026. Estado atual em
  `security/ESTADO-PUBLICACAO.md`; testes em `security/COMO-TESTAR.md`.

O SDK Admin usa somente o módulo Auth. Os módulos opcionais de Storage/Firestore
e Pipeline não são instalados; o estado de uso único usa a API REST oficial do
Firestore. `.npmrc` e `vercel.json` mantêm `--omit=optional`. O PostCSS de
desenvolvimento foi atualizado para a versão corrigida na auditoria.

## Testes

```sh
node tests/recuperacao-acesso.test.cjs
node tests/recuperacao-firestore-rest.test.cjs
node tests/recuperacao-interface.test.cjs
node tests/acesso-cliente.test.cjs
node tests/acesso-cliente-rest.test.cjs
node tests/acesso-cliente-interface.test.cjs
npm test
npm run test:rules
npm run check
npm audit
```

Os testes cobrem 29min59,999s e 30min completos, adulteração, outro domínio/chave,
repetição, concorrência, telefone alterado, permissão administrativa, substituição,
limite de emissão, falha do provedor, transporte e formulário.

Os testes de acesso cobrem aprovação administrativa limitada aos testes atuais,
recusa de conta antiga não aprovada, criação concorrente sem sobrescrita, rollback
de vínculo incompleto, dados preservados, limites transacionais, CDA com senha,
perfil desativado/revogado/de outro UID e sessão compartilhada/lembrar/sair.
`tests/acesso-cliente-browser.html` usa dados fictícios e backend/Auth em memória;
foi verificado também o aviso nas páginas reais dentro da fixture isolada.

Os testes da equipe verificam código inválido/duplicado, perfil desconhecido,
desativação, colisão de identidade, conta incompleta, tentativa de promoção a ADM,
limites por código/rede e falhas HTTP. O login salvo é uma sessão do Auth;
`atendenteId` e os demais campos locais continuam apenas como compatibilidade da
interface. Não autorizam leituras no banco protegido. Sem salvar no aparelho,
o monitor continua na mesma aba para preservar a sessão sem pedir outro código.

O proprietário entra com o acesso criado no Authentication, em uma sessão separada
da equipe e do cliente. O servidor confere
o UID na lista privada antes de emitir a permissão administrativa. A recuperação
e o painel usam a mesma identidade operacional. O antigo comparador de senha
administrativa permanece somente no modo legado, com a migração desligada.

Os códigos de funcionários precisam ter de 4 a 64 letras/números, hífen ou
sublinhado e ser únicos. Antes de ativar, revisar cadastros antigos fora desse
formato. O ADM cria/desativa/exclui o cadastro; as regras conferem `ativo` e o
perfil atual em cada operação, sem depender de renovar o token do funcionário.

`npm run test:rules` passou com 187 verificações de permissão, além da integração
Auth/REST/Firestore. Nada foi publicado nem foi utilizada uma conta real nesses
testes. A integração inclui a primeira senha de uma conta antiga de teste,
preservando rank e saldo, e o reset nativo da senha com uso único e expiração em
30 minutos. Esses testes foram isolados; a publicação posterior ativou os
indicadores da Vercel, conforme `security/ESTADO-PUBLICACAO.md`.

Referências: [Firebase Admin](https://firebase.google.com/docs/auth/admin/manage-users),
[códigos de recuperação](https://firebase.google.com/docs/auth/admin/email-action-links),
[transações REST](https://firebase.google.com/docs/firestore/reference/rest/v1/projects.databases.documents/beginTransaction),
[sessões](https://firebase.google.com/docs/auth/admin/manage-sessions),
[OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html).
