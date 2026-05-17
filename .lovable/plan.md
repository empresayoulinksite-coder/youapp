## Objetivo

Permitir que cada loja configure múltiplas impressoras (pedidos, cozinha, bebidas, caixa) usando o novo `window.electronAPI`, salvar essa preferência no banco e fazer toda impressão (manual e automática) acontecer silenciosamente na impressora certa — sem nunca cair em `window.print()`.

## 1. Banco de dados

Nova tabela `store_printer_settings` (1:1 com `stores`):

- `store_id` (uuid, PK, FK lógica para `stores.id`)
- `printer_orders` (text) — impressora padrão (cupom completo do pedido)
- `printer_kitchen` (text) — itens de cozinha
- `printer_drinks` (text) — itens de bebida
- `printer_cashier` (text) — via do caixa
- `kitchen_category_ids` (uuid[]) — quais `menu_categories` vão pra cozinha
- `drinks_category_ids` (uuid[]) — quais `menu_categories` vão pra bebidas
- `auto_print` (bool, default false)
- `created_at` / `updated_at`

RLS: `SELECT/INSERT/UPDATE` apenas se `can_manage_store_orders(auth.uid(), store_id)`; admins têm tudo via `has_role`.

## 2. Bridge do Electron

Atualizar `src/lib/thermal-printer.ts`:

- Detectar `window.electronAPI` (novo) além do `window.electronPrint` legado.
- Nova função `listElectronPrinters(): Promise<string[]>` que chama `electronAPI.getPrinters()` (retorna `[]` no navegador comum).
- `browserPrintHTML(html, { silent?, printerName? })`:
  - Se `electronAPI.print` existir → chama `{ html, printerName }`.
  - Senão se `electronPrint.print` existir → fallback legado (HTML only).
  - Senão e `silent === true` → lança erro (sem popup).
  - Senão (modo navegador puro, uso manual) → mantém abertura de janela atual.

## 3. Tela de configuração

Nova aba "Impressoras" no painel da loja (`src/components/painel/PrintersSettings.tsx`, montada dentro de `painel.tsx`):

- Botão "Detectar impressoras" → `listElectronPrinters()`.
- 4 `<Select>` populados com as impressoras encontradas: Pedidos, Cozinha, Bebidas, Caixa.
- Multi-select de `menu_categories` da loja para Cozinha e Bebidas.
- Switch "Impressão automática ao aceitar pedido".
- Botão "Imprimir teste" por impressora → envia um HTML simples só com `printerName`.
- Persiste em `store_printer_settings` via Supabase client (RLS já cobre o dono/staff).
- Aviso visível quando rodando fora do Electron ("Abra pelo app desktop para detectar impressoras").

## 4. Roteamento por categoria no auto-print

Em `OrdersManager.printOrder`:

- Carregar `store_printer_settings` (React Query) junto com `printerPrefs`.
- Carregar `menu_items.category_id` dos itens do pedido (já temos `menu_item_id` em `order_items`).
- Particionar itens em três grupos: cozinha, bebidas, "outros".
- Para cada grupo com itens, gerar HTML com `buildReceiptHTML` (passando o subset de itens) e chamar `browserPrintHTML(html, { silent: true, printerName: <impressora do grupo> })`.
- Cupom completo (pedidos) sempre vai para `printer_orders`. Via do caixa (se configurada) sai em paralelo para `printer_cashier`.
- Remover qualquer caminho que termine em `window.print()` no fluxo automático — só erro/log silencioso se Electron ausente.
- Botão manual "Imprimir" usa a mesma função, só com `silent: false` para mostrar toasts.

## 5. Limpeza

- `TablesManager.tsx` (linha 135) ainda usa `window.print()` para imprimir contas de mesa. Migrar também para `browserPrintHTML(html, { printerName: printer_cashier })`.
- Rota `pedidos-loja_.$storeId.impressao.tsx`: passar `printerName` configurada ao chamar o bridge.

## Detalhes técnicos

```
electronAPI.print({ html, printerName })  → impressão silenciosa
electronAPI.getPrinters()                 → string[] nomes do Windows
```

Tipagem global em `src/types/electron.d.ts`:

```ts
interface Window {
  electronAPI?: {
    getPrinters: () => Promise<string[]>;
    print: (opts: { html: string; printerName?: string }) => Promise<{ success: boolean; error?: string }>;
  };
  electronPrint?: { print: (html: string) => Promise<unknown> }; // legado
}
```

Migration cria também trigger `update_updated_at_column` e índice único em `store_id`.

## Entregáveis

1. Migration `store_printer_settings` + RLS.
2. `src/types/electron.d.ts`.
3. `src/lib/thermal-printer.ts` atualizado (listPrinters + printerName).
4. `src/components/painel/PrintersSettings.tsx` (nova UI) + entrada no `painel.tsx`.
5. `OrdersManager.tsx` com auto-print por categoria + remoção do fallback.
6. `TablesManager.tsx` migrado para o bridge.
