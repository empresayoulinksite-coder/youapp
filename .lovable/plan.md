## Problema

Na categoria **Porções** (que está marcada como categoria de pizza, com tamanhos **Inteira** e **Meia**), quando você pede para a IA mudar o preço, ela só atualiza o **preço base** do produto. Os campos **Inteira (R$)** e **Meia (R$)** continuam em **0,00**, e por isso o produto aparece sem preço por tamanho no editor.

A IA precisa entender comandos como:
- "mude o Frango à parmegiana para Inteira R$ 44,90 e Meia R$ 24,90"
- "porção inteira R$ 50, meia R$ 28"
- "todas as porções: inteira 45, meia 25"

…e gravar esses valores em `menu_item_size_prices` para cada tamanho da categoria, em vez de só gravar `menu_items.price`.

## Plano

### 1. Ensinar a IA a ler preços por tamanho

No arquivo `src/server/bulk-edit.functions.ts`, ampliar o schema do que a IA pode retornar para cada item. Hoje ela retorna basicamente `{ id, price, ... }`. Vou adicionar um campo opcional:

```text
size_prices: [
  { size_name: "Inteira", price: 44.90 },
  { size_name: "Meia",    price: 24.90 }
]
```

E atualizar o prompt do sistema para deixar claro:

- Se a categoria do item tiver tamanhos (ex.: Inteira/Meia), e o usuário mencionar valores por tamanho, preencher `size_prices` com **um item por tamanho citado**, usando o nome exato do tamanho.
- Se o usuário só disser "mude para R$ X" sem citar tamanhos, e a categoria tiver tamanhos, **aplicar o mesmo valor X em todos os tamanhos disponíveis** (Inteira e Meia recebem X).
- Se o item realmente não for de pizza/tamanhos, continuar usando apenas `price` (preço base), como hoje.

Adicionar exemplos no prompt:
- "porção inteira R$ 50 e meia R$ 28" → `size_prices: [{Inteira:50},{Meia:28}]`
- "mude todas as porções para R$ 40" → para cada item: `size_prices: [{Inteira:40},{Meia:40}]`

### 2. Aplicar os preços por tamanho no banco

Ainda em `bulk-edit.functions.ts`, quando o item:

- estiver numa categoria com `is_pizza = true` **e**
- a IA retornar `size_prices`,

o handler vai:

1. Buscar os `pizza_sizes` ativos da categoria desse item (id + nome).
2. Para cada `{ size_name, price }` retornado pela IA, casar com o `pizza_size_id` correspondente (comparação case-insensitive, com a mesma função `similarity` já usada no arquivo, para tolerar "inteira" vs "Inteira").
3. Fazer **upsert** em `menu_item_size_prices` (`menu_item_id` + `pizza_size_id` → `price`, `is_available = true`).
4. Continuar atualizando `menu_items.price` com o **maior** valor dentre os tamanhos preenchidos (mantém a regra atual de exibição/preço base coerente).

Quando a IA não retornar `size_prices` mas o item for de categoria pizza com tamanhos, manter o comportamento atual (atualiza só o preço base) — isso evita zerar tamanhos sem necessidade.

### 3. Não mexer no fluxo de produtos sem tamanhos

Para itens que não são de categoria pizza, ou cuja categoria pizza não tem tamanhos, nada muda: continua atualizando `menu_items.price` normalmente. Os ajustes feitos no editor (preço base editável quando não há tamanhos) e na exibição da lista permanecem como estão.

### 4. Verificação manual depois de implementar

- Pedir na IA: "mude o Frango à parmegiana para Inteira 44,90 e Meia 24,90" → conferir no editor que ambos os campos aparecem preenchidos.
- Pedir: "mude todas as porções para R$ 40" → conferir que cada item da categoria Porções tem Inteira=40 e Meia=40.
- Pedir uma alteração num produto que **não é** de categoria pizza → conferir que continua atualizando só o preço base, sem efeitos colaterais.

## Observação

Não vou desmarcar o switch "Categoria de pizza" da categoria Porções — você confirmou que quer manter os tamanhos Inteira/Meia ativos. A correção é fazer a IA entender e gravar os preços por tamanho conforme o que você pedir no comando.
