# Onde editar a aparência

Cada página HTML aponta para **um arquivo de entrada** em `css/paginas/`. Esse arquivo contém os imports na ordem de carregamento. Você não precisa copiar CSS para o HTML para mudar o visual.

## Comece pelo componente

| O que você quer mudar                                                  | Arquivo                                             |
| ---------------------------------------------------------------------- | --------------------------------------------------- |
| Cores e variáveis gerais                                               | `css/variaveis.css`; complementos em `css/tema.css` |
| Cabeçalho, banner e aparência geral                                    | `css/tema.css`                                      |
| Menus de categoria, busca e X da busca                                 | `css/componentes/navegacao-e-busca.css`             |
| Modal de produto do delivery                                           | `css/componentes/delivery-produto.css`              |
| Carrinho, lista de itens e botões fixos                                | `css/componentes/delivery-carrinho.css`             |
| Revisão, subtotal, endereço, pagamento e molhos                        | `css/componentes/delivery-checkout.css`             |
| Perfil e campo de código de ativação                                   | `css/componentes/perfil.css`                        |
| Produto, tipos de carne, quantidade, combos e login do autoatendimento | `css/componentes/autoatendimento.css`               |
| Mesas, central, recebimento e molhos do atendente                      | `css/componentes/atendente.css`                     |
| Botões Voltar/X e navegação dos módulos                                | `css/navegacao.css`                                 |
| Tela e cartões da cozinha, impressões e financeiro                     | `css/operacao.css`                                  |
| Grades e estrutura do autoatendimento                                  | `css/autoatendimento.css`                           |
| Estrutura da administração                                             | `css/admin.css`                                     |
| Ajustes gerais para celular                                            | `css/mobile.css`                                    |
| Grade do cardápio por largura                                          | `css/responsividade.css`                            |

## Como os blocos estão organizados

Os comentários identificam as tags e os componentes: `html/body`, `header`, `nav`, `main/section`, formulários e modais. Dentro dos arquivos de componentes, comece pelo contêiner e siga seus filhos e estados. Por exemplo:

```text
div#modal-carrinho
  div.conteudo-carrinho
    div#lista-carrinho
      div.topo-carrinho > h3
    div.acoes-carrinho
```

No autoatendimento, o bloco de `#modal-opcoes-tipo-auto` controla Artesanal/Industrial. O bloco `.qtd-produto-modal` controla o rótulo Quantidade e os botões −/+.

## Ajustes comuns

- `gap`: distância entre os filhos de uma grade ou de um flex.
- `padding`: espaço dentro do componente.
- `margin`: espaço fora do componente.
- `min-height`: altura mínima e área de toque dos controles.
- `max-height` e `overflow-y`: limite do modal e área que rola.
- `border-radius`: arredondamento.
- `font-size` e `line-height`: tamanho e altura do texto.

Edite a regra existente no arquivo do componente. Assim você evita acrescentar correções concorrentes no fim de outro CSS.

## Telas de computador

Os ajustes comuns a partir de 900 px ficam em `css/componentes/desktop.css`: margens dos painéis, largura dos cartões e janelas e hover sem aumentar os botões. Esse componente é importado por último e só se aplica à tela, preservando a impressão. Ajustes exclusivos do celular continuam no componente correspondente.

## Ordem e prioridade

Os imports de cada página preservam a sequência anterior: base e regras próprias da página, tema quando aplicável, operação, ajustes móveis, navegação e componentes. `css/componentes.css` é apenas o índice dos estilos finais; a edição fica nos arquivos da pasta `componentes/`.

A ordem das regras antigas e dos `@media` foi preservada onde ela interfere na cascata. Reordenar tudo alfabeticamente por seletor ou por propriedade poderia mudar o visual. Os `!important` que já protegiam modais e controles fixos continuam explícitos; removê-los pode recolocar a barra inferior sobre os botões.

Alguns `style="display:none"` e estilos dinâmicos continuam no HTML/JavaScript porque controlam abertura, fechamento e valores calculados. Prefira editar a aparência nos CSS; não remova esses estados durante uma mudança visual.

## Atualização no navegador

As páginas e imports usam `?v=` para atualizar o cache. Durante uma edição local, use **Ctrl + F5**. Ao publicar uma versão nova, atualize também o `?v=` do arquivo de entrada e dos imports alterados.

## Formatar depois de editar

```sh
npm run format
npm run check
npm test
```

As dependências são apenas ferramentas de desenvolvimento. O site continua sendo HTML/CSS/JavaScript estático, sem exigir compilação para funcionar.
