# Estado da publicação — 04/11/2026

Virada autorizada pelo proprietário fora do atendimento. Este registro prevalece
sobre as descrições anteriores de implementação apenas local.

- Código enviado para `main`: implementação `289d508`, diagnóstico seguro
  `55e4b4c`, Node 24 `a7a8aa0` e configuração de módulos `9f910f2`.
- Regras completas de `firestore.proposta.rules` publicadas no projeto
  `pedrao-lanches`. Conferência sem login: produtos HTTP 200; clientes,
  funcionários e recuperação HTTP 403.
- Na Vercel Production, os dois indicadores de ativação estão `true` e foi
  salvo `NODE_OPTIONS=--experimental-require-module`. O último deployment
  conferido ficou Ready no domínio `cardapio-pedrao-lanches.vercel.app`.
- Cópia local anterior à virada: 731 documentos de 71 coleções/subcoleções
  conhecidas pelo site e as regras anteriores, fora do repositório em
  `E:\hd\faculdade.estacio\claude\pedrao-backups`. Não é uma exportação gerenciada
  completa do Firebase e não contém usuários/senhas do Authentication.
- O diagnóstico seguro identificou e permitiu corrigir a incompatibilidade de
  módulos e, depois, um JSON inválido em `FIREBASE_SERVICE_ACCOUNT_JSON`. O
  proprietário colou novamente o conteúdo diretamente na Vercel. Nenhum valor
  privado foi lido ou exibido para essa identificação.
- A configuração corrigida foi publicada pelo fluxo integrado do GitHub em
  `ed70f0e`, deployment `6Fiy39nTvVmyeeUMf6oiashw31Cm`, confirmado Ready.
- Conferência em produção: perfil sem login HTTP 401; recuperação sem acesso
  administrativo HTTP 401; consulta da mesa HTTP 200; cotação de uma retirada
  com Pix HTTP 200, Baguncinha artesanal R$ 25,00. A cotação não salva pedido.
- Login pelos códigos já cadastrados de Atendimento e Ambos funcionou com
  Authentication nativo; leitura operacional de pedidos HTTP 200 e recusa de
  leitura da coleção privada de recuperação HTTP 403. As identidades nativas
  da equipe são criadas pelo serviço no primeiro acesso.
- O proprietário entrou no ADM publicado com sua conta do Authentication. O painel
  e o controle de recuperação reconheceram a sessão administrativa autorizada.
- Após confirmação explícita de que os cadastros antigos continuam sendo somente
  testes, o proprietário autorizou a preparação: a API confirmou 3 contas de teste
  preparadas. Contas que já têm senha não são liberadas por essa operação.
- Uma dessas contas foi conferida no delivery publicado: entrada de teste com
  nome/celular, aviso da administração “Crie sua senha” e formulário com senha,
  confirmação e opção de lembrar no dispositivo. Nenhuma senha foi preenchida ou
  salva nessa conferência. O formulário foi deixado aberto para o proprietário.

A virada de autenticação e regras foi concluída. Os testes de produção acima são
verificações específicas; não substituem uma homologação completa de todos os
fluxos do atendimento. A criação e a recuperação de senha com expiração de 30
minutos passaram nos emuladores; nenhuma senha de cliente foi alterada em produção.
Nenhum pedido foi gravado e nenhum WhatsApp foi enviado pelos testes desta virada.
Não reabrir as regras públicas para contornar erro.
