# Mapa do projeto

## Páginas

| Página                  | Função                                |
| ----------------------- | ------------------------------------- |
| `index.html`            | Delivery, perfil, carrinho e checkout |
| `autoatendimento.html`  | Pedidos da mesa pelo cliente          |
| `painel-atendente.html` | Mesas, comandas, entregas e retiradas |
| `atendente.html`        | Entrada e fluxo anterior do atendente |
| `admin.html`            | Administração, clientes e cardápio    |
| `cozinha.html`          | Fila do chapeiro e pedidos concluídos |
| `financeiro.html`       | Recebimentos, períodos e fechamento   |

Para mudar cores, tamanhos e espaçamentos, consulte **GUIA-ESTILOS.md**. Cada HTML possui somente um link de entrada para os estilos da página.

## JavaScript

| Arquivo                         | Responsabilidade                                                 |
| ------------------------------- | ---------------------------------------------------------------- |
| `js/script.js`                  | Delivery, carrinho, envio, perfil e histórico                    |
| `js/autoatendimento.js`         | Sessão da mesa, produtos e envio do autoatendimento              |
| `js/atendente.js`               | Comandas, mesas, entregas, retiradas e fechamento                |
| `js/produto-comanda.js`         | Personalização e edição dos produtos/combos do atendente         |
| `js/admin.js`                   | Cadastros, produtos, pedidos e clientes do ADM                   |
| `js/operacao.js`                | Transações, pagamentos, numeração, cozinha e impressão           |
| `js/app-ui.js`                  | Histórico de navegação, Voltar/X e módulos                       |
| `js/fluxos-interface.js`        | Etapas do checkout, consumo local, login e filtros de período    |
| `js/ui-comum.js`                | Imagens e tratamento compartilhado de botões                     |
| `js/cardapio-ui.js`             | Busca, Ver mais e Ver menos                                      |
| `js/financeiro.js`              | Interface e acesso financeiro                                    |
| `js/financeiro-calculos.js`     | Cálculos puros do financeiro                                     |
| `js/campanhas.js`               | Campanhas e mensagens                                            |
| `js/raspadinhas.js`             | Campanhas, concessão, revelação e uso de raspadinhas             |
| `js/raspadinhas-recuperacao.js` | Recuperação em lotes, cursores persistidos e trava entre painéis |
| `js/firebase-operacao.js`       | Inicialização compartilhada do Firebase                          |
| `js/produtos.js`                | Dados auxiliares do cardápio                                     |

## Regras para manutenção

- Os nomes das funções usadas em `onclick` e os IDs usados por `getElementById` são ligações entre HTML e JavaScript. Ao renomear, altere todos os usos.
- Os scripts são clássicos, sem `type="module"`. A ordem no fim do HTML é intencional; não ordene as tags `script` alfabeticamente.
- A interface complementar registra funções após o carregamento da página. Confira `DOMContentLoaded` antes de mover inicializações.
- Regras de pagamento, fila e numeração usam transações. Uma limpeza de aparência não deve substituir essas gravações por atualizações isoladas.
- Não copie funções para o final do arquivo para sobrescrever a versão anterior: edite a função existente.
- Os nomes `css/claude-visual.css`, `css/style.css`, `css/app-ui.css` e `js/revisao-outubro.js` foram substituídos por `css/tema.css`, `css/base.css`, `css/navegacao.css` e `js/fluxos-interface.js`.

## Ferramentas

```sh
npm install
npm run format       # Aplica o padrão de indentação e quebras de linha.
npm run format:check # Confere a formatação sem editar.
npm run check        # Confere JavaScript, CSS, HTML, imports e formatação.
npm test             # Executa as suítes locais de comportamento.
npm run preview      # Abre o servidor em http://127.0.0.1:8090.
```

Prettier e PostCSS são dependências de desenvolvimento; não entram no navegador.

## Conferência sem produção

Abra `http://127.0.0.1:8090/tests/revisao-browser.html` com o servidor local ligado. Essa página usa dados fictícios em memória, remove os scripts do Firebase e permite escolher a página/largura. Não use os HTML de produção para testes que criam pedidos ou pagamentos reais.

Os arquivos `tests/*.test.cjs` verificam pagamentos, cozinha, períodos, busca, consumo local e login. `ENTREGA-OPERACAO.md` registra o comportamento dos fluxos e as alterações anteriores.

### Editor de cupons

`js/cupons-admin-ui.js` organiza criação, edição e consulta em pop-ups por uso e tipo. Usa os campos e a validação de `js/admin.js`. Cupons sem `uso` permanecem diversos; `uso: "unico"` significa uma utilização total do código.

### Catálogo administrativo

`js/catalogo-admin-ui.js` organiza os menus de adicionais, as janelas de criação/edição e os campos por categoria. `normalizarProdutoCatalogoUI` valida preços e remove configurações de carne em bebidas/batatas. `tiposCarneProdutoOperacao`, em `js/operacao.js`, oferece as mesmas variações de carne no cardápio, atendente e autoatendimento, com a carne principal primeiro. A lista administrativa mantém os produtos carregados em memória durante busca/filtro e invalida esse cache após alterações. O filtro Ocultos consulta `ativo: false`; Mostrar reativa sem recriar o produto.
