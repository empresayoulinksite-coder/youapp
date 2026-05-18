## Problema

No PDV os dois botões do topo do carrinho ("[ D ] Delivery e Balcão" e "[ M ] Mesas e Comandas") estão com as ações **trocadas**:

- "Delivery e Balcão" hoje grava o pedido como `pickup` (retirada).
- "Mesas e Comandas" hoje grava como `delivery`.

Por isso, ao clicar em Mesas o pedido sai como delivery, e ao clicar em Delivery sai como retirada.

## Correção

Em `src/components/painel/PDVManager.tsx`, linhas 422–437, apenas inverter os `onClick` e a classe ativa dos dois botões:

- "[ D ] Delivery e Balcão" → `setOrderType("delivery")` e destaca quando `orderType === "delivery"`.
- "[ M ] Mesas e Comandas" → `setOrderType("pickup")` e destaca quando `orderType === "pickup"`.

Sem mudança de schema, sem mudança em outras telas. O resto do componente (`delivery_address`, cálculo de frete, formulário de endereço) já reage a `orderType` corretamente.

## Observação

Hoje o sistema só tem dois tipos: `delivery` e `pickup`. O botão "Mesas e Comandas" não cria mesa/comanda real — ele apenas marca como retirada de balcão. Se você quiser que esse botão realmente abra o fluxo de mesas (como em `TablesManager`), me avise depois que isso é um trabalho separado.