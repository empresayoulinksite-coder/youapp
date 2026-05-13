## Problema

Hoje, na pizzaria, **bordas** (`pizza_crusts`) e **adicionais** (`pizza_addons`) são salvos por **loja**, sem vínculo com a categoria. Resultado:

- Uma loja com **"Pizzas Salgadas"**, **"Pizzas Doces"** e **"Porções"** (não-pizza) compartilha a mesma lista de bordas.
- Editar a categoria "Porções" parece "virar pizza" porque o produto puxa as bordas globais da loja.
- Apagar uma borda some em todas as categorias.

## Solução proposta

Tornar bordas e adicionais **escopados por categoria**, não por loja. Cada categoria de pizza tem suas próprias bordas/adicionais. Categorias não-pizza (ex.: Porções) não têm nenhuma — e o builder de pizza nem aparece para elas.

### 1. Banco de dados (migração)

- Adicionar coluna `category_id uuid references menu_categories(id) on delete cascade` em `pizza_crusts` e `pizza_addons`.
- Backfill: para cada loja, copiar as bordas/adicionais existentes para **cada categoria que tem `is_pizza = true`** daquela loja (mantém o que já está cadastrado funcionando em todas as categorias de pizza atuais).
- Depois do backfill, tornar `category_id` `NOT NULL` e remover/manter `store_id` apenas como denormalização (mantém pra simplificar RLS).
- Atualizar índices: `(category_id, position)`.
- RLS: dono da loja pode CRUD onde `store_id` = sua loja (mantém regra atual).

### 2. Tela "Pizzas" (`admin.pizzas.tsx`)

- Hoje as abas **Bordas** e **Adicionais** mostram uma lista única da loja.
- Mudar para um seletor "**Categoria:** [Pizzas Salgadas ▾]" no topo das abas Bordas e Adicionais. A lista filtra por categoria selecionada. Inserir/editar/excluir afeta só aquela categoria.
- Se a loja só tem 1 categoria de pizza, o seletor fica oculto e usa ela direto.
- Aba **Sabores** continua igual (já é por categoria via `category_id` do produto).

### 3. Builder de pizza no cliente (`PizzaBuilderDialog.tsx`)

- Hoje busca `pizza_crusts`/`pizza_addons` por `store_id`.
- Passar a buscar por `category_id` da pizza que está sendo montada.
- Como meio-a-meio só junta sabores da mesma categoria, todos os sabores compartilham a mesma lista de bordas/adicionais — sem ambiguidade.

### 4. Cardápio (`admin.produtos.tsx`)

- O dialog de **editar categoria** continua igual (nome + switch "Categoria de pizza" + disponível). Sem mudança visual.
- O builder de pizza (que aparece só quando `is_pizza = true`) já some pra "Porções" porque o switch fica desligado — esse comportamento se mantém. A mudança garante que, mesmo entre duas categorias de pizza, cada uma tem suas próprias bordas.

### 5. Pedidos antigos

- Pedidos já feitos guardam `crust { id, name, price }` no JSON do item, então não quebram com a mudança de schema.

## Pontos para você decidir antes de implementar

1. **Backfill**: copiar as bordas atuais para **todas** as categorias de pizza da loja (mantém cardápio igual ao de hoje), ou começar **vazio** em cada categoria e você re-cadastra? — recomendo copiar.
2. **Adicionais também escopados por categoria?** — recomendo sim, pelo mesmo motivo (uma pizza doce não compartilha "bacon extra" com uma salgada). Se preferir manter adicionais globais por loja, faço só as bordas.
3. **Categoria "Porções"**: confirma que ela está com o switch **"Categoria de pizza"** **desligado**? Se sim, ela já não deveria abrir o builder — vale eu verificar se tem algum bug que está tratando ela como pizza mesmo desligada.

Me confirma esses 3 pontos que eu sigo com a implementação.
