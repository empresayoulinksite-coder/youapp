## Problema

Ao concluir um agendamento pago em dinheiro com troco, o caixa fica **R$ 10 a menos** do que deveria (no exemplo: mostra R$ 80 em vez de R$ 90).

## Causa

Em `src/components/painel/BookingsTab.tsx` (linhas 247-268), após registrar a venda pelo `total_price` (que já é o valor líquido do serviço), o código **também** insere uma `cash_transactions` do tipo `withdrawal` com o valor do troco. Resultado: o troco é descontado duas vezes do caixa.

```text
Fundo:           +R$ 50
Venda (líquida): +R$ 40   ← já é o valor do serviço, não o recebido
Sangria troco:   -R$ 10   ← erro: subtrai de novo
Total:            R$ 80   ← deveria ser R$ 90
```

O troco não é uma sangria/retirada de caixa — é parte natural da operação de venda. O que entra fisicamente na gaveta já equivale ao `total_price`.

## Correção

Remover o bloco que insere a `cash_transactions` de `withdrawal` para troco no `onSuccess` da mutation de atualização de status do agendamento (linhas 247-268 de `src/components/painel/BookingsTab.tsx`).

O campo `change_amount` continua sendo salvo na `bookings` (útil para histórico/recibo), só não é mais lançado como sangria.

## Verificação

- Refazer o cenário: abrir caixa R$ 50 → concluir agendamento R$ 40 em dinheiro com troco R$ 10 → resumo deve mostrar R$ 90.
- Sangrias manuais reais (botão "Retirada") continuam funcionando normalmente.
- Agendamentos sem troco continuam corretos (já estavam).
