## Objetivo

Esconder as abas **Stories** e **Cupons** na tela `/admin/loja/$storeId` para donos de loja. Apenas usuários **Admin** continuarão vendo essas duas abas.

## Mudanças

**`src/routes/admin.loja.$storeId.tsx`**

1. Importar o hook `useAdminAccess` de `@/hooks/use-admin` e ler `isAdmin` dentro do componente `AdminStoreManagePage`.
2. Envolver os `<TabsTrigger value="stories">` e `<TabsTrigger value="coupons">` (linhas 211–218) em `{isAdmin && ( ... )}`.
3. Envolver os `<TabsContent value="stories">` e `<TabsContent value="coupons">` (linhas 362–380) no mesmo `{isAdmin && ( ... )}` para que donos não consigam acessar nem via URL `?tab=stories`.

Nenhuma outra tela é afetada. O acesso geral à página continua liberado para donos (eles só perdem essas duas abas).
