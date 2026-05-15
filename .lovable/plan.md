## Objetivo

Remover toda a complexidade do QZ Tray e implementar impressão automática de pedidos usando o **Modo Quiosque do Chrome** (`--kiosk-printing`). Solução 100% gratuita, sem certificado, sem instalação extra.

## Como vai funcionar

1. No PC da loja, cria-se um atalho do Chrome com a flag `--kiosk-printing`
2. Esse Chrome fica aberto numa nova página: **`/pedidos-loja/$storeId/impressao`**
3. A página escuta novos pedidos em tempo real (Supabase Realtime)
4. Quando chega pedido novo → renderiza o cupom e dispara `window.print()` automaticamente
5. Chrome envia direto para a impressora padrão, **sem mostrar diálogo**

## O que vou fazer

### 1. Limpeza do QZ Tray
- Remover `src/lib/qz-printer.ts`, `src/lib/qz-sign.functions.ts`, `src/lib/qz-cert-generator.functions.ts`
- Remover rota `/admin/qz-setup`
- Remover tabela `qz_certificates` (migração)
- Remover dependências `qz-tray` e `node-forge` do `package.json`
- Remover botões/chamadas de impressão QZ que existem hoje na tela de pedidos da loja

### 2. Nova página de impressão automática
- Rota: **`/pedidos-loja/$storeId/impressao`** (protegida, só dono/staff da loja)
- Componente:
  - Subscreve via Supabase Realtime na tabela `orders` filtrando por `store_id`
  - Ao receber `INSERT` de pedido novo: busca itens, monta o cupom, e chama `window.print()`
  - Mantém uma fila para evitar sobreposição de impressões
  - Marca o pedido como “impresso” em memória (localStorage) para não reimprimir em refresh
  - Mostra na tela: status “Aguardando pedidos…”, último pedido impresso, botão “Reimprimir”

### 3. Layout do cupom térmico (80mm)
- Componente `OrderReceipt` otimizado para 80mm:
  - Nome da loja, número do pedido, data/hora
  - Cliente, telefone, endereço/retirada
  - Itens (qtd × nome, observações, adicionais), subtotal, taxa, total
  - Forma de pagamento, troco
- CSS `@media print` com `@page { size: 80mm auto; margin: 0 }`

### 4. Realtime
- Migration: `ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;` (se ainda não estiver)

### 5. Tela de instruções
- Nova rota `/admin/impressao-automatica` com passo a passo:
  - Como criar o atalho do Chrome no Windows com `--kiosk-printing`
  - Como definir a impressora térmica como padrão
  - Link para abrir `/pedidos-loja/{store}/impressao`
  - Teste de impressão

## Detalhes técnicos

- **Realtime channel** por loja: `orders:store_id=eq.{storeId}` no evento `INSERT`
- **window.print()** dentro de `useEffect` após render do cupom; usa `setTimeout(0)` para garantir paint
- **Anti-duplicata**: `Set<orderId>` + `localStorage` (TTL 24h)
- **Atalho Windows** (instrução ao usuário):
  ```
  "C:\Program Files\Google\Chrome\Application\chrome.exe" --kiosk-printing --kiosk https://SEU-APP/pedidos-loja/STORE_ID/impressao
  ```

## Fora do escopo
- App mobile / impressão a partir de celular (kiosk só funciona em desktop com Chrome)
- Múltiplas impressoras seletivas (sempre usa a impressora padrão do PC)
