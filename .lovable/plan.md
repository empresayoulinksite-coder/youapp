## Objetivo

Integrar o **QZ Tray** para imprimir cupons de pedidos automaticamente, sem diálogo de impressão, em qualquer impressora instalada no PC (térmica, jato de tinta, laser).

QZ Tray é um app gratuito (qz.io) que roda como serviço local no PC e expõe uma API via WebSocket em `wss://localhost:8181`. O navegador conversa com ele e ele envia o trabalho para qualquer impressora do Windows/macOS/Linux — **sem mostrar diálogo nenhum**.

## Como vai funcionar para o lojista

1. Lojista baixa e instala o QZ Tray uma vez (link direto no painel).
2. No painel → Configurações da impressora → clica **"Conectar QZ Tray"**.
3. Aparece a lista de impressoras instaladas no PC dele → ele escolhe (ex: EPSON L4260, ou a térmica futuramente).
4. Marca **"Imprimir automaticamente ao aceitar pedido"**.
5. Pronto — todo pedido aceito imprime sozinho, sem nenhuma janela.

Na primeira impressão o QZ Tray pede uma confirmação de segurança ("permitir este site?"), e o lojista marca **"Sempre permitir"**. Depois disso é silencioso para sempre.

## Mudanças no código

### 1. Dependência
- `bun add qz-tray`

### 2. `src/lib/qz-printer.ts` (novo)
Wrapper fino sobre a lib `qz-tray`:
- `qzConnect()` — conecta ao WebSocket local com retry. Configura modo "unsigned" (community), assinatura promiscua para evitar erro de cert (suficiente para uso local; QZ ainda mostra prompt na 1ª vez).
- `qzListPrinters()` — retorna nomes das impressoras instaladas.
- `qzPrintHTML(printerName, html)` — imprime HTML formatado em qualquer impressora.
- `qzPrintRaw(printerName, bytes)` — imprime bytes ESC/POS direto (para térmicas).
- `qzDisconnect()`.

### 3. `src/lib/thermal-printer.ts`
- Adicionar `kind: "qz"` ao `PrinterKind`.
- Adicionar campo `qzPrinterName: string | null` ao `PrinterPrefs`.

### 4. `src/components/painel/OrdersManager.tsx`
- No diálogo de configuração, adicionar bloco em destaque **"Imprimir em qualquer impressora (recomendado)"**:
  - Texto curto explicando o QZ Tray + link **"Baixar QZ Tray"** (https://qz.io/download/).
  - Botão **"Conectar QZ Tray"** → conecta e lista impressoras.
  - Após conectar, `<Select>` com as impressoras detectadas → ao escolher, salva `qzPrinterName` no prefs.
  - Botão **"Imprimir teste"** usa o caminho QZ quando configurado.
- Manter as opções WebUSB/Bluetooth/Serial abaixo, em uma seção **"Conexão direta (avançado)"** colapsada.
- Atualizar `printOrder()`:
  - Se `prefs.kind === "qz"` e tem nome de impressora → usar `qzPrintHTML(name, buildReceiptHTML(...))`.
  - Senão, fluxo atual (BT/USB/Serial/fallback browser).
- Auto-print no `useEffect` continua igual — só muda o caminho interno.

### 5. Carregamento da lib
A `qz-tray` só funciona no browser. Importar dinamicamente dentro das funções (`await import("qz-tray")`) para não quebrar SSR.

## Por que essa abordagem

- **Funciona com a EPSON L4260 dela hoje** (jato de tinta) — imprime via driver normal do Windows.
- **Funciona com impressora térmica no futuro** — basta o lojista escolher outra no Select.
- **Sem diálogo de impressão** depois do "Sempre permitir" inicial.
- **Sem precisar configurar atalho do Chrome** com flags.
- **Multi-PC**: cada PC instala o QZ uma vez; a configuração de qual impressora usar fica salva por loja no `localStorage`.

## Validação

1. Instalar QZ Tray no PC.
2. Painel → Config → "Conectar QZ Tray" → escolher EPSON L4260.
3. "Imprimir teste" → cupom sai sem diálogo (após permitir 1x).
4. Aceitar pedido real → imprime automaticamente.

## Arquivos alterados

- `package.json` (nova dependência `qz-tray`)
- `src/lib/qz-printer.ts` (novo)
- `src/lib/thermal-printer.ts` (kind "qz" + campo de prefs)
- `src/components/painel/OrdersManager.tsx` (UI + roteamento de impressão)
