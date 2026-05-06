
## O que muda

A opção **"Retirar no local"** no painel do lojista será ocultada para lojas com `store_type === "service"`, já que não faz sentido para serviços.

## Detalhes técnicos

### `src/routes/painel.tsx`
- Adicionar a condição `currentStore.store_type !== "service"` ao bloco de "Retirar no local" (linhas 389-408), para que ele só apareça em lojas do tipo `food` ou `ecommerce`.
