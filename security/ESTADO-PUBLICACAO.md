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
- As APIs de status respondem disponíveis, mas as operações continuam com HTTP
  503: após corrigir a incompatibilidade de módulos, o diagnóstico seguro
  identificou `SyntaxError` na leitura de `FIREBASE_SERVICE_ACCOUNT_JSON`.
  Nenhum valor privado foi lido ou exibido para essa identificação.
- O proprietário confirmou a correção do JSON e a Vercel exibiu a variável
  atualizada em Production. Está sendo publicada a configuração corrigida pelo
  fluxo integrado do GitHub. Falta conferir as APIs e os acessos autorizados.

O site ainda não deve ser considerado liberado para atendimento. Não reabrir as
regras públicas para contornar a pendência. Nenhum pedido foi gravado em produção
pelos testes desta virada, nenhum WhatsApp foi enviado e nenhuma conta/senha de
cliente foi alterada.
