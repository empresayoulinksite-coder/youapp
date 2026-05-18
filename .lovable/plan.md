## Objetivo
Pedir o CPF do cliente no checkout (opcional) e mostrar na nota impressa da comanda.

## Mudanças

### 1. Banco (migration)
- Adicionar coluna `customer_cpf text` em `public.orders` (nullable).

### 2. Checkout (`src/routes/sacola.tsx`)
- Novo campo "CPF na nota (opcional)" próximo aos campos de nome/telefone do cliente.
- Máscara `000.000.000-00` e validação de dígitos verificadores (reaproveitando a lógica de `completar-cadastro.tsx`).
- Pré-preencher com `profiles.cpf` quando já existir.
- Se preenchido e válido:
  - Persistir no `profiles.cpf` do usuário (igual já é feito com nome/telefone).
  - Salvar dígitos puros em `orders.customer_cpf`.
  - Adicionar linha `🧾 CPF: 000.000.000-00` na mensagem de WhatsApp.
- Se inválido: bloquear envio com mensagem de erro.

### 3. Impressão (`src/lib/receipt-template.ts` + `extension/print.js`)
- Estender `ReceiptOrder` com `customer_cpf?: string | null`.
- No bloco "CLIENTE" (ESC/POS e HTML), imprimir `CPF: 000.000.000-00` quando existir.
- Replicar a mesma linha em `extension/print.js` (impressão via extensão).

### 4. Consultas de impressão
- Conferir os pontos que carregam o pedido para impressão (ex.: `OrdersManager.tsx`, `pedidos-loja_.$storeId.impressao.tsx`) e incluir `customer_cpf` no `.select(...)` antes de passar para o template.

## Fora do escopo
- Tornar CPF obrigatório.
- Emissão fiscal / NFC-e.
- Validar CPF no servidor (mantém validação só no cliente, já que o campo é informativo).