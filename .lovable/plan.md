## Objetivo

Permitir que categorias do tipo **Produtos** tenham **tamanhos compartilhados** (ex: Inteira / Meia, Pequena / Média / Grande), cada um com seu próprio preço por item — exatamente como já funciona em Pizzas. Assim a IA do bulk edit consegue alterar preços por tamanho com precisão.

## Plano

### 1. Reusar a estrutura de tamanhos da pizza
Não criar tabela nova. As tabelas `pizza_sizes` e `menu_item_size_prices` já são ligadas por `category_id` / `menu_item_id` e funcionam para qualquer categoria. Vamos só liberar o uso delas em categorias com `is_pizza = false`.

(Apenas reuso conceitual — o nome físico continua `pizza_sizes` para não quebrar tipos.)

### 2. UI da categoria de Produtos (`admin.produtos.tsx`)
- No diálogo de edição de uma categoria de **Produto** (food), adicionar um botão **"Configurar tamanhos da categoria"** abrindo um editor enxuto: lista de tamanhos (nome + posição), com adicionar/remover/ordenar. Sem bordas, sem sabores, sem fatias.
- Quando uma categoria de Produto tem tamanhos cadastrados, no editor de cada item dessa categoria a seção atual de "Tamanhos / Variações" é substituída por uma grade **"Preço por tamanho"** (igual à de pizza): uma linha por tamanho da categoria, com input de preço.
- Quando a categoria não tem tamanhos cadastrados, o comportamento atual (preço base + variações livres) permanece.

### 3. Vitrine / Sacola
- Em `produto.$id.tsx`, `loja.$slug.tsx` e `PizzaBuilderDialog`, ao montar o item, se a categoria não-pizza tiver `pizza_sizes`, mostrar um seletor de tamanho parecido com o de pizza, mas sem etapa de bordas/sabores. O preço exibido vem de `menu_item_size_prices`.
- No `cart_items` reusamos `pizza_size_id` / `pizza_size_name` / `unit_price_override` que já existem.

### 4. Bulk edit IA (`bulk-edit.functions.ts`)
- A lógica de `size_prices` por `category_id` já existe e não checa `is_pizza`. Confirmar que continua valendo para Produtos.
- Atualizar o prompt do sistema para deixar claro que tamanhos compartilhados existem em qualquer categoria. Exemplo novo: "todas as porções: inteira 45 e meia 25" passa a funcionar para a categoria Porções (Produto).

### 5. Importação de cardápio (`admin.importar-cardapio.tsx`)
- Quando a IA detectar produtos com variações de tamanho explícitas em uma categoria de Produto (ex: "Porção de Calabresa — Inteira R$ 45 / Meia R$ 25"), criar automaticamente os `pizza_sizes` da categoria e gravar os `menu_item_size_prices` correspondentes.
- Já temos a escolha Pizzas / Produtos no import — não muda.

### 6. Verificação manual
- Criar categoria "Porções" (Produto), adicionar tamanhos Inteira/Meia, criar 2 itens, preencher preços por tamanho.
- Abrir o app: o item mostra seletor Inteira/Meia com preços diferentes; carrinho registra o tamanho.
- Rodar bulk edit IA: "todas as porções: inteira 50, meia 28" → preview mostra mudanças por tamanho corretas.

## Detalhes técnicos
- Reusar `pizza_sizes` (sem migração). Ignorar `slices` e `max_flavors` para tamanhos de Produtos (default fica 8/1 mas não é usado fora do builder de pizza).
- Extrair a aba "Tamanhos" do `PizzaCategoryWizard.tsx` num subcomponente `CategorySizesEditor` reutilizado pelo wizard de pizza e pelo botão novo na categoria de Produto.
- Em `admin.produtos.tsx`, condicional para "Preço por tamanho" passa de `cat.is_pizza` para `pizzaSizes.length > 0` (vários trechos já estão assim).
- Sem alterações de RLS necessárias — políticas atuais de `pizza_sizes` e `menu_item_size_prices` já cobrem os donos da loja.