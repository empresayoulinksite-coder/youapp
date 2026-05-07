## O que muda

1. **`src/routes/admin.loja.$storeId.tsx`** — Adicionar suporte ao search param `?tab=` para que a aba correta seja selecionada ao abrir a página. O `<Tabs defaultValue="info">` passará a usar o valor do param `tab` (se presente) como valor inicial.

2. **`src/routes/pedidos-loja.$storeId.tsx`** — Alterar o link do botão "Gestor de cardápio" de `/admin/loja/${storeId}` para `/admin/loja/${storeId}?tab=catalog`, para que abra direto na aba do cardápio.

Nenhuma mudança de backend necessária.