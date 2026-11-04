# Revisão local — 04/11/2026

**Publicação autorizada pelo proprietário em 04/11/2026**, após a revisão local
e os testes descritos abaixo. As alterações ficaram locais até essa solicitação.
Base anterior à revisão: `6fc47bd`. A publicação usa o fluxo existente da Vercel,
sem alterar regras do Firebase, credenciais ou a configuração do GitHub Pages.

## Correções

- Retirado o aviso de entrar em conta para usar benefícios durante a revisão de
  pedido de visitante. Pedir sem conta continua disponível.
- Editar perfil recebeu Alterar senha, com senha atual, nova senha e confirmação.
  O Firebase reautentica a mesma pessoa antes da alteração. Senhas não passam
  pelo endpoint de perfil e não são armazenadas no navegador pelo código.
- Busca do ADM renomeada para Buscar cliente. O campo aceita letras; a busca
  compara nome de uso e nome real sem diferenciar maiúsculas ou acentos. Havendo
  mais de um resultado, mostra a escolha. Celular e CDA continuam disponíveis.
  A busca textual consulta no máximo 200 cadastros; para bases maiores, é preciso
  indexação/paginação de busca antes de ampliar esse limite.
- Cartão de cliente: rótulos acima dos valores, telefone com espaço para caber,
  valores em reais e texto do rank sem o grid indevido que separava cada trecho.
- Proprietário autenticado também libera os controles antigos dos editores de
  benefícios, cupons, campanhas e raspadinhas. A autorização continua sendo
  conferida nas APIs/regras; a variável da interface não concede acesso ao banco.
- Rank pode ser escolhido no ADM, inclusive a partir do editor ligado a pedido.
  A escolha manual vale na competência atual e pode ser removida escolhendo
  Avaliação automática. A virada mensal volta a avaliar as compras pagas.
- Botão de preparar contas de teste removido do acesso de recuperação. Os três
  cadastros antigos já foram preparados; cadastros novos exigem senha.

## Política de entrega no checkout público e na API

- Distância **maior que 11 km**: pelo menos R$ 50 em produtos, acréscimos e molhos
  pagos, depois dos descontos em produtos/fidelidade e sem frete.
- A partir de **23h no horário de Cuiabá**, durante a madrugada (até 05h59):
  até 2 km = R$ 10; acima de 2 até 3 km = R$ 12; acima de 3 até 4 km = R$ 15.
- Mais de 4 km nesse horário: entrega bloqueada, oferecendo retirada ou consumo
  no local. As taxas noturnas são finais; não recebem o R$ 1 adicional diurno.
- O servidor usa seu próprio horário e reconstrói a distância pelo ponto GPS.
  A cotação e a gravação validam novamente as regras, inclusive na virada das 23h.
- Retirada e consumo no local não têm essa restrição de distância/frete.
- Escolha confirmada pelo proprietário: nos pedidos manuais, o atendente confere
  a distância, a disponibilidade da entrega e define a taxa. Não há campo de km
  obrigatório nem aplicação automática dessa tabela no atendimento. As travas
  automáticas acima ficam no checkout público do cliente e na sua API.

## Verificações

- `npm test`: **117 suítes locais aprovadas**.
- `npm run check`: sintaxe, imports e formatação aprovados.
- Referências dos eventos HTML dos 10 arquivos principais: 122 controles, nenhuma
  chamada sem definição entre os scripts carregados. Não inclui funções criadas
  em tempo de execução; essas são cobertas pelos testes de fluxo e pela prévia.
- Conferência visual em iframe de 375 px com dados fictícios: ADM autenticado,
  configurar benefícios, etapas de novo cupom, busca por nome, editar rank,
  recuperação sem botão de testes, editar perfil e abrir troca de senha,
  atendimento/lista de entregas, concluídos da chapa, mesa protegida e acréscimos.
- Nenhuma senha real foi preenchida ou alterada, nenhuma mensagem enviada e
  nenhum pedido real gravado. Os testes não substituem a conferência da loja
  nos aparelhos usados no atendimento antes da próxima publicação.

## Alertas do GitHub

- O Secret Scanning aberto em 22/04 aponta para a chave web do Firebase usada
  em `js/script.js`, não para o JSON privado administrativo. A configuração web
  identifica o projeto e pode constar no navegador, conforme a
  [documentação do Firebase](https://firebase.google.com/docs/projects/api-keys).
  As restrições dessa chave no Google Cloud não foram conferidas nesta revisão.
  O alerta não foi apagado nem marcado como resolvido.
- A execução do Pages `41877333111` teve build aprovado e deploy cancelado porque
  existia uma solicitação mais nova na fila. Não é evidência de erro no build.
- O status Vercel do commit `6fc47bd` foi consultado e estava success.
  Não foram reiniciadas execuções, desativado Pages ou alterada a publicação.

## Onde conferir

Execute `npm run preview` ou mantenha o servidor local iniciado para os cenários
com APIs de teste. Para interface sem APIs, o Live Server abre
`tests/revisao-browser.html` com dados fictícios. Exemplos:

- `?pagina=admin.html&cenario=adm-protegido`
- `?pagina=index.html&cenario=seguranca-protegida` (precisa do servidor Node)
- `?pagina=autoatendimento.html&cenario=seguranca-protegida` (servidor Node)

As funções de troca de senha seguem a
[reautenticação do Firebase](https://firebase.google.com/docs/auth/web/manage-users#re-authenticate_a_user).
