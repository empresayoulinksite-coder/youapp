## Contexto

- **Tamanhos** (`pizza_sizes`): hoje têm só `store_id`, então toda categoria de pizza compartilha "Grande / Broto / etc." — confirmado por você.
- **Disponibilidade**: já é por categoria (`menu_categories.is_available`, `available_days`, `available_start`, `available_end`). Não precisa mexer.

## Plano: escopar tamanhos por categoria

Mesmo padrão já aplicado em bordas e adicionais.

### 1. Banco (migration)
- Adicionar coluna `category_id uuid` em `pizza_sizes` referenciando `menu_categories(id)` com `ON DELETE CASCADE`.
- Backfill: para cada tamanho atual, **clonar em todas as categorias `is_pizza = true` da mesma loja** (cardápio fica idêntico ao de hoje).
- Apagar registros órfãos (sem categoria).
- Tornar `category_id` NOT NULL.
- Substituir `idx_pizza_sizes_store` por índice em `(category_id, position)`.

### 2. Admin de pizzas (`src/routes/admin.pizzas.tsx`)
- Aba "Tamanhos" ganha o mesmo seletor de categoria de pizza que já existe em "Bordas" e "Adicionais".
- Queries e mutations passam a filtrar/gravar por `category_id`.
- Ao criar uma categoria nova, exibir aviso: "Salve a categoria primeiro para cadastrar tamanhos exclusivos dela".

### 3. Wizard de categoria (`src/components/PizzaCategoryWizard.tsx`)
- Aba "Tamanho" do wizard passa a operar via `category_id` da categoria sendo editada.
- Em categoria nova (sem id), mesmo aviso de "salve primeiro".

### 4. Builder do cliente (`src/components/PizzaBuilderDialog.tsx`)
- Query de `pizza_sizes` passa a filtrar por `category_id` em vez de `store_id`.
- Adicionar `categoryId` ao array de dependências do `useEffect` que recarrega tamanhos.

### 5. Tipos
- `src/integrations/supabase/types.ts` será regenerado automaticamente após a migration.

## Resultado
Cada categoria de pizza ("Salgadas", "Doces", etc.) terá seu próprio conjunto de tamanhos, sem interferir nas outras. As "Porções" (categoria não-pizza) continuam sem tamanhos de pizza.