# Regras em homologação

`firestore.proposta.rules` foi publicada em conjunto com as APIs e as telas em 04/11/2026. Checkout, visita à mesa e operações privadas do perfil estão conectados no modo protegido. O registro da verificação em produção está em `ESTADO-PUBLICACAO.md`; este arquivo descreve os testes isolados. Não há `firebase.json` nem comando de deploy de produção neste projeto.

O teste utiliza os emuladores oficiais de Auth e Firestore, Java 21 e somente o projeto fictício `demo-pedrao-seguranca`. Não precisa de login no CLI, chave privada ou acesso ao Firebase da loja. A execução falha se os endereços não forem `127.0.0.1:8188` e `127.0.0.1:9099`.

As ferramentas ficam numa pasta separada da publicação. Instale nela `firebase-tools@15.34.2`, `@firebase/rules-unit-testing@5.0.0` e `firebase@12.19.0`. Use Node 24 e coloque o Java 21 no PATH da sessão. Depois, no repositório:

```powershell
$env:PEDRAO_FIREBASE_TEST_TOOLS = 'caminho\da\pasta\das\ferramentas'
npm run test:rules
```

O CLI baixa o emulador oficial na primeira execução e o encerra ao terminar. As dependências do emulador não entram no site nem nas funções da Vercel.

O conjunto verifica leituras e gravações de clientes diferentes; histórico com vínculo por UID; alterações proibidas de rank, saldo e identidade; atendimento, chapa, funcionário inativo e proprietário; privacidade dos códigos e dos estados de recuperação; sessão da mesa e fila de preparo. Passar nesses testes comprova as permissões propostas, **não comprova ainda que todos os fluxos do site foram migrados**.

O segundo teste integra o SDK Auth do servidor e do cliente, a API REST e as regras no emulador: cria a senha, faz login, verifica o vínculo da conta, recusa alteração de saldo, emite o token da chapa, libera o proprietário pelo UID autorizado e bloqueia a chapa desativada mesmo com o token anterior. A chave de assinatura desse teste é gerada na memória e descartada; pertence exclusivamente ao projeto fictício.

Esse teste também usa o serviço real de checkout com o transporte REST restrito:
reconstrói preço e acréscimo, aplica um cupom único, reserva R$ 10 de bônus sem
antecipar nova fidelidade, repete o envio sem duplicar e verifica que outra conta
não consegue ler ou alterar o pedido. Os limites persistentes ficam numa coleção
privada, negada inclusive ao navegador do proprietário. O serviço permanece
desligado com os mesmos indicadores da migração de acesso.

As suítes locais `pedido-catalogo`, `pedido-publico`, `pedido-publico-http`,
`operacao-firestore-rest`, `fidelidade-checkout` e `fidelidade-checkout-operacao`
complementam o emulador: cobrem os 12 combos, três carnes do burrito, cerveja
restrita, frete de 10/15 km, reservas concorrentes, erros HTTP, contadores do dia,
rollback, receber/editar/cancelar e preservação dos fluxos legados. Não acessam
o Firebase real.

As contas e identidades do teste são fictícias. Nenhum cadastro, senha, saldo ou pedido real é criado ou alterado.

Em 04/11/2026 passaram 187 verificações de regras e a integração Auth/REST/Firestore.
Os casos adicionais conferem o token real da visita, leitura apenas da própria
comanda, revogação ao fechar e recusa do JWT antigo após redefinir a senha, mesmo
quando outro link de recuperação é gerado. Um novo login recupera o acesso.

Para revisar as telas, execute `npm run preview`, abra
`http://127.0.0.1:8092/tests/revisao-browser.html` (ou a porta exibida) e escolha
**Proteção · APIs reais com dados fictícios**. A fixture usa os serviços de
negócio e handlers reais com banco/Auth em memória. Permite testar checkout e
retomada de mesa, sem credenciais de produção e sem abrir o WhatsApp. Esse modo
nunca entra na publicação da Vercel.
