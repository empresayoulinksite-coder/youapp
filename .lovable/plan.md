
## Pedido na Mesa - Checkout Simplificado

Quando o cliente acessa o cardápio digital via QR Code da mesa (`?mesa=N`), o fluxo de checkout será simplificado: apenas **nome** e **telefone** serão solicitados, sem endereço de entrega nem seleção delivery/retirada.

### O que muda

1. **Capturar o parâmetro `?mesa=N` na URL**
   - Na página da loja (`loja.$slug.tsx`), ler o parâmetro `mesa` da URL e salvar no contexto do carrinho ou via search params.
   - Propagar esse valor até a sacola.

2. **Sacola (`sacola.tsx`) - Modo Mesa**
   - Quando `mesa` estiver presente, esconder o toggle "Entrega / Retirada" e a seção de endereço.
   - Taxa de entrega = 0.
   - Passar `deliveryMode="mesa"` para o checkout dialog.

3. **CheckoutReviewDialog - Modo Mesa**
   - Mostrar apenas: **Nome**, **Telefone**, **Forma de pagamento** e **Observação**.
   - Esconder a seção de endereço.
   - Mostrar uma indicação "🍽️ Mesa N" no lugar do endereço.

4. **Pedido salvo no banco**
   - Adicionar campo `table_number` (integer, nullable) na tabela `orders` para registrar de qual mesa veio o pedido.
   - Na mensagem do WhatsApp, incluir "🍽️ Mesa N" ao invés de endereço.

### Detalhes técnicos

- **Migration**: `ALTER TABLE orders ADD COLUMN table_number integer;` (nullable, sem breaking change)
- **Arquivos editados**: `loja.$slug.tsx`, `sacola.tsx`, `CheckoutReviewDialog.tsx`
- **CartContext**: armazenar `tableNumber` quando presente na URL
- **Tipo de deliveryMode**: expandir para `"delivery" | "pickup" | "mesa"`
