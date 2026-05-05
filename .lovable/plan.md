## Vincular Troco ao Caixa

Quando um agendamento for concluído com troco > 0 e o caixa estiver aberto, o sistema registrará automaticamente uma transação de saída (withdrawal) no caixa.

### O que muda para o usuário

- Ao concluir um agendamento com troco em dinheiro, o valor do troco será descontado automaticamente do saldo do caixa
- Aparecerá como "Troco - Agendamento" nas transações do caixa
- Se o caixa estiver fechado, o troco é salvo normalmente no agendamento mas sem criar transação

### Alterações técnicas

**`src/components/painel/BookingsTab.tsx`**:
- Adicionar `useAuth()` no nível do `BookingsTab` para obter o `user.id`
- No `onSuccess` da mutation `updateStatus`, quando `status === "completed"` e `change_amount > 0` e `cashRegister` estiver aberto:
  - Inserir uma linha em `cash_transactions` com `type: "withdrawal"`, `amount: change_amount`, `reason: "Troco - Agendamento"`, `cash_register_id`, e `user_id`
  - Invalidar queries do caixa para atualizar o saldo em tempo real
