## Renomear botão de checkout no modo mesa

No diálogo de revisão do pedido (`CheckoutReviewDialog.tsx`), quando o pedido é em **mesa**, o botão final hoje diz **"Confirmar e enviar pelo WhatsApp"**. Vou trocar apenas esse texto para **"Confirmar pedido"** quando `deliveryMode === "mesa"`.

### O que muda

- Quando o tipo de pedido for **mesa**: botão exibe **"Confirmar pedido"**.
- Quando for **delivery** ou **retirada**: continua exibindo **"Confirmar e enviar pelo WhatsApp"** (sem alteração).

### O que NÃO muda

- O comportamento do botão continua o mesmo: o pedido segue sendo enviado pelo WhatsApp da loja normalmente.
- O card **"WHATSAPP DA LOJA"** continua visível no resumo (conforme sua escolha).
- Nenhuma alteração em banco de dados, fluxo de status, ou demais modos de pedido.

### Detalhe técnico

Edição pontual em `src/components/CheckoutReviewDialog.tsx`, no texto do botão (linha ~381): adicionar uma condição `isMesa ? "Confirmar pedido" : "Confirmar e enviar pelo WhatsApp"` no último ramo do ternário.
