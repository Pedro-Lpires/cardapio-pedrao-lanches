# Onde usar e onde testar

## Operação real

- ADM: <https://cardapio-pedrao-lanches.vercel.app/admin.html>
- Equipe: <https://cardapio-pedrao-lanches.vercel.app/atendente.html>
- Mesa 5: <https://cardapio-pedrao-lanches.vercel.app/autoatendimento.html?mesa=5>

O proprietário entra no ADM com o e-mail e a senha do Firebase Authentication.
Funcionários continuam entrando pelo código no acesso da equipe. Produtos,
preços, funcionários, benefícios e pedidos reais são gerenciados nesse ADM.

O login de cliente agora usa celular e senha. As três contas antigas de teste
foram preparadas para criar a primeira senha pelo aviso dentro do perfil.

## Alterações nos arquivos pelo VS Code

O Live Server serve HTML, CSS e JavaScript, mas não executa as APIs de `api/`.
Depois da publicação das regras protegidas, as páginas locais não podem acessar
dados privados pelo antigo fluxo direto do navegador.

Para testar a interface com dados fictícios, abra pelo Live Server:

```text
http://127.0.0.1:5501/tests/revisao-browser.html?pagina=admin.html
http://127.0.0.1:5501/tests/revisao-browser.html?pagina=autoatendimento.html
```

Use a porta que seu Live Server mostrar. A página permite escolher a tela e a
largura: 320, 375, 430 pixels ou computador. A senha fictícia indicada na prévia
é `teste1234`. Os dados dessa prévia ficam em memória; não são o banco real.

Alternativa pelo terminal da pasta do projeto:

```sh
npm run preview
```

Depois abra `http://127.0.0.1:8090/tests/revisao-browser.html`. Para o cenário
“Proteção · APIs reais com dados fictícios”, use esse servidor Node; esse cenário
precisa das rotas de teste que o Live Server não executa.

A prévia isolada é excluída da publicação pela `.vercelignore`. Ela não autoriza
acesso ao banco. Não copie credenciais privadas da Vercel para o código da página.

## Botões do acesso de recuperação

- **Desconectar acesso protegido:** encerra a sessão do proprietário.
- **Preparar contas de teste para criar senha:** libera a primeira senha dos
  cadastros antigos de teste aprovados. Já foi utilizado na virada de 04/11/2026;
  não é um comando de rotina e não deve ser usado com contas de clientes reais.
- **Redefinir acesso**, dentro da consulta de um cliente: gera a recuperação
  individual, com validade de 30 minutos. O administrador envia o link ao
  WhatsApp cadastrado; o cliente escolhe uma nova senha. O ADM não vê a senha.

Para publicar mudanças nos arquivos, o fluxo existente é enviar os commits para
`main`, que aciona a Vercel. Salvar no Live Server só muda os arquivos locais.
