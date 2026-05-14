## Problema

Na categoria **Porções** (Produto), você cadastrou tamanhos (Inteira / Meia) com preços diferentes em cada produto, mas no app do cliente o modal abre direto com o preço base e o botão "Adicionar à sacola" — sem o seletor de tamanho. Isso acontece porque a vitrine só busca `pizza_sizes` / `menu_item_size_prices` quando a categoria tem `is_pizza = true`. O passo 3 do plano original (vitrine/sacola) não tinha sido implementado.

## O que vamos fazer

Liberar o seletor de tamanho na vitrine para qualquer categoria (não só pizza) que tenha tamanhos compartilhados cadastrados, reaproveitando exatamente as mesmas tabelas e campos do carrinho que a pizza já usa.

### 1. `src/routes/loja.$slug.tsx` — modal de produto comum
- No `openItemModal`, detectar se a categoria do item tem registros em `pizza_sizes` (mesmo com `is_pizza = false`). Se sim, carregar os tamanhos da categoria + os preços por tamanho daquele item (`menu_item_size_prices`).
- Dentro do modal "selectedItem" (o que está aparecendo na sua tela), adicionar — antes do botão "Adicionar à sacola" — um bloco **"Escolha o tamanho"** com botões para cada tamanho da categoria, mostrando o preço de cada um (fallback no preço base do item se não houver preço cadastrado para aquele tamanho).
- O preço grande exibido no modal passa a refletir o tamanho selecionado.
- Validação: se a categoria tem tamanhos, exigir seleção antes de adicionar.
- Ao adicionar ao carrinho, gravar `pizza_size_id`, `pizza_size_name` e `unit_price_override` (campos que já existem em `cart_items`), igual ao fluxo de pizza.

### 2. `src/routes/produto.$id.tsx` — página individual do produto
- Mesmo tratamento da loja: buscar tamanhos da categoria, renderizar seletor "Escolha o tamanho" e gravar `pizza_size_id` / `unit_price_override` ao adicionar.

### 3. Vitrine listando preço "a partir de"
- Nos cards da listagem (loja, busca, vitrine pública), quando a categoria tem tamanhos compartilhados, mostrar o preço como "a partir de R$ X" usando o menor `menu_item_size_prices.price` do item, em vez do `price` base. Sem alteração se não houver tamanhos cadastrados.

### 4. Sem mudanças necessárias em
- `PizzaBuilderDialog` (continua exclusivo das categorias pizza com sabores/bordas).
- Schema do banco — `cart_items.pizza_size_id` e `unit_price_override` já existem.
- RLS — políticas atuais já permitem leitura pública de `pizza_sizes` / `menu_item_size_prices`.
- Bulk edit / importação — já tratam o caso na lógica anterior.

## Verificação

1. Abrir a loja Rei do Litoral → Porções → "Frango à parmegiana": modal mostra "Escolha o tamanho" com Inteira e Meia + preços; o preço grande muda ao trocar; "Adicionar à sacola" só funciona com tamanho escolhido.
2. Carrinho mostra o tamanho escolhido junto do nome do produto.
3. Card da listagem mostra "a partir de R$ ..." (menor preço por tamanho).
4. Pizza continua funcionando exatamente como antes (modal completo com sabores/bordas).
