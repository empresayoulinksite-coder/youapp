Encontrei o motivo provável: existe uma categoria chamada **Porções** marcada como categoria de pizza (`is_pizza=true`), mas os produtos dela **não têm preços por tamanho**. Por isso a tela trata esses itens como pizza e exibe o preço calculado de tamanhos; como não há linhas de tamanho, aparece **R$ 0,00**. Os tamanhos **Inteira** e **Meia** são configurações de pizza e não deveriam afetar porções.

Plano:

1. **Corrigir a regra de exibição na lista de produtos**
   - Hoje a lista usa `is_pizza` da categoria para decidir se mostra preço de pizza.
   - Vou mudar para considerar “pizza” apenas quando o produto tiver preços reais em `menu_item_size_prices`.
   - Se a categoria estiver marcada como pizza mas o produto não tiver preços por tamanho, a tela vai mostrar o `menu_items.price` normal.

2. **Corrigir edição rápida de preço**
   - Em produtos de porção, permitir clicar no preço e editar o preço base normalmente.
   - Só bloquear edição rápida e abrir o formulário de tamanhos quando o produto realmente tiver preço por tamanho de pizza.

3. **Ajustar a lógica do Assistente IA para produto individual**
   - A IA já foi ajustada para ações “todos da categoria”, mas para produto individual ainda pode tratar como pizza só por causa da categoria marcada.
   - Vou mudar para tratar como pizza apenas se existir preço por tamanho para aquele produto.
   - Assim pedidos como “mude o Frango à parmegiana para R$ 44,90” vão atualizar o preço base da porção.

4. **Evitar confusão no formulário de produto**
   - No editor, a seção “Preço por tamanho de pizza” só deve aparecer quando a categoria realmente tiver tamanhos configurados e o produto estiver sendo tratado como pizza.
   - Para porções, o campo “Preço base” continuará editável.

5. **Verificação**
   - Conferir no código que porções sem linhas de tamanho usam `menu_items.price`.
   - Verificar que pizzas com tamanhos continuam usando os preços por tamanho normalmente.

Observação: não pretendo mexer nos tamanhos “Inteira” e “Meia” agora, porque eles fazem sentido para pizzas. A correção é separar corretamente porções de pizzas na regra de preço.