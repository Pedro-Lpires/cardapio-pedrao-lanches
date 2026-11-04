# Publicação do acesso protegido

Preparado e testado localmente em 04/11/2026. Nenhuma etapa abaixo foi executada
em produção por esta implementação. Não compartilhar chaves, senhas ou tokens.

## Antes do corte

1. Reservar um período fora do atendimento e guardar uma cópia dos dados e das
   regras atuais. As páginas antigas abertas precisarão ser recarregadas.
2. Publicar os arquivos deste código na Vercel com os dois indicadores ainda
   `false`. Conferir que o deployment terminou e que as rotas `/api/acesso-cliente`,
   `/api/acesso-equipe`, `/api/pedido-publico`, `/api/mesa-publica` e
   `/api/recuperacao-acesso` respondem JSON com `disponivel: false`.
3. No Authentication, conferir E-mail/senha ativado, conta do proprietário e
   domínio `cardapio-pedrao-lanches.vercel.app` autorizado. Conferir as variáveis
   Production pelos nomes em `.env.example`, sem exibir os valores privados.

## Corte e conferência

1. No Firestore, substituir **o conjunto inteiro** das regras pelo conteúdo de
   `security/firestore.proposta.rules` e publicar. Não manter a regra global
   pública ao lado: ela anularia as restrições. O modo antigo deixa de funcionar
   nesse intervalo; por isso o corte deve ocorrer fora do atendimento.
2. Na Vercel, alterar `RECUPERACAO_ACESSO_ATIVA=true` e
   `REGRAS_FIRESTORE_PROTEGIDAS=true` em Production e fazer Redeploy. Os indicadores
   ativam o conjunto de acesso, não apenas a recuperação. Não ativar enquanto
   as regras forem públicas.
3. Recarregar o ADM e entrar com o e-mail/senha do proprietário. O servidor
   confere seu UID privado e libera a identidade administrativa; o código da
   equipe não concede esse papel. Se a credencial/permissão do servidor falhar,
   corrigir a configuração antes de prosseguir.
4. Somente enquanto a base continuar contendo **apenas contas de teste**, usar
   **Preparar contas de teste para criar senha** no acesso administrativo. A
   operação aprova o snapshot atual, não cadastros futuros. Não usar em massa
   quando houver clientes reais. Depois, entrar na conta de teste e criar a senha
   pelo aviso interno. Contas novas escolhem a senha no cadastro.
5. Conferir uma compra de teste em delivery: catálogo, total, cupom, benefício,
   recebimento, cancelamento e histórico. Confirmar que repetir o envio não duplica.
6. Conferir QR: conta lembrada, envio, recarregar com pedido enviado, chamar
   atendente/conta, fechar comanda e recusar a visita antiga. O QR estático não
   comprova presença física.
7. Conferir funcionários Atendimento/Chapa/Ambos, fila da cozinha e desativação;
   conta de cliente não deve abrir os painéis. Conferir suporte e raspadinha.
8. Gerar um link para uma conta de teste, trocar a senha e conferir: link usado
   recusado, sessão antiga recusada, senha nova aceita e histórico preservado.
   O envio pelo WhatsApp continua manual, confirmado pelo proprietário.

## Se houver falha

Interromper novos pedidos e corrigir a configuração ou o código. Não restaurar
`allow read, write: if true` para contornar um erro de permissão. Não ativar a
recuperação com o banco público. As validações locais não comprovam a permissão
da conta de serviço nem a configuração real de domínio/deployment.
