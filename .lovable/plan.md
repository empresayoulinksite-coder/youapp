## Problema

O botão "Gestor de cardápio" no menu lateral da página de pedidos não abre na aba Cardápio. O conteúdo fica vazio porque o `?tab=catalog` está sendo passado como parte do `to` do `<Link>`, mas o TanStack Router não interpreta query strings dentro do `to` — ele precisa receber os search params via prop `search`.

## O que muda

1. **`src/routes/pedidos-loja.$storeId.tsx`** — Separar o `to` e o `search` no item de navegação "Gestor de cardápio":
   - `to` → `/admin/loja/$storeId` (com `params`)
   - `search` → `{ tab: "catalog" }`
   
2. Ajustar o render do `<Link>` para passar `params` e `search` corretamente, em vez de interpolar tudo numa string.

Nenhuma mudança de backend necessária.
