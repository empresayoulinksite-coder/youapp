## Remover forma de pagamento para pedidos na mesa

Quando o pedido é feito na mesa (`deliveryMode === "mesa"`), o cliente paga direto no caixa. A seção de forma de pagamento será escondida e o campo não será obrigatório.

### Alterações

**`src/components/CheckoutReviewDialog.tsx`**
- Esconder toda a seção "FORMA DE PAGAMENTO" quando `isMesa` for true
- Ajustar `canConfirm`: não exigir `paymentMethod` quando `isMesa`
- Se mesa, enviar `paymentMethod` como `"Pagamento no caixa"` no `onConfirm`

**`src/routes/sacola.tsx`**
- Na montagem da mensagem WhatsApp: quando mesa, mostrar "💳 Pagamento no caixa" ao invés do método selecionado
- No insert do pedido: salvar `payment_method: "Pagamento no caixa"` para pedidos de mesa

O botão do checkout mudará de "Escolha o pagamento" para "Enviar pedido" quando for mesa.
