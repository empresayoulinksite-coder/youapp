## O que será feito

Remover três itens do menu lateral da página do painel do lojista (`pedidos-loja.$storeId.tsx`):

1. **Pedidos agendados** — remover do array `NAV_ITEMS` (linha 193)
2. **Gestão Avançada** — remover do array `NAV_ITEMS` (linha 195)
3. **Nota fiscal descomplicada** — remover o bloco de banner/CTA (linhas 412-420)

## Detalhes técnicos

- Arquivo: `src/routes/pedidos-loja.$storeId.tsx`
- Remover 2 entradas do array `NAV_ITEMS`
- Remover o div do banner "Nota fiscal descomplicada"
- Nenhuma outra funcionalidade será afetada
