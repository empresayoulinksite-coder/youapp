## Acompanhamento de pedido na mesa (sem WhatsApp)

Para pedidos feitos na mesa, ao invés de abrir o WhatsApp, o pedido será salvo no banco e o cliente verá uma tela de acompanhamento com o status em tempo real.

### Alterações

**Novo componente `src/components/OrderTrackingDialog.tsx`**
- Modal/dialog que mostra o status do pedido recém-feito
- Timeline visual com os passos: Em análise → Em produção → Pronto
- Usa Supabase Realtime para atualizar o status automaticamente quando o lojista muda
- Mostra número do pedido, itens resumidos e mesa
- Botão para fechar

**`src/routes/sacola.tsx`**
- Quando `deliveryMode === "mesa"`:
  - Não exige `storeWhatsapp` (remove a validação de WhatsApp obrigatório)
  - Após salvar o pedido no banco, NÃO chama `openWhatsapp()`
  - Ao invés disso, abre o `OrderTrackingDialog` com o ID do pedido criado
  - Limpa o carrinho e a mesa da sessão normalmente
- Pedidos delivery/retirada continuam com o fluxo WhatsApp normal

**Realtime (migration)**
- Habilitar realtime na tabela `orders` para que o status atualize automaticamente no dialog do cliente

### Detalhes técnicos

- O `OrderTrackingDialog` receberá o `orderId` e fará um subscribe no canal Realtime filtrando por aquele pedido
- A timeline mostrará 3 etapas com ícones/cores: Em análise (amarelo), Em produção (azul), Pronto (verde)
- O lojista já muda o status pela tela de pedidos existente — nenhuma alteração necessária no painel
