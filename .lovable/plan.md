## Objetivo

Quando a loja está com **"aceitar pedidos automaticamente"** ligado, o pedido já nasce como `em_producao`. Quero que, ao mesmo tempo, o **app Electron imprima o cupom automaticamente na impressora padrão, sem mostrar a caixa de diálogo "Imprimir"**.

Hoje a página `/pedidos-loja/{id}/impressao` já detecta pedidos novos e auto-aceitos, mas usa `iframe.print()`, que no navegador comum abre o diálogo. No Electron, dá pra imprimir silencioso via `webContents.print({ silent: true })`.

## Como vai funcionar

1. O app Electron expõe `window.electronPrint` para a página web via `preload.js`.
2. A página de impressão detecta:
   - **Electron presente** → manda o HTML do cupom e o Electron imprime silenciosamente na impressora padrão do Windows.
   - **Navegador comum** → mantém o fluxo atual (iframe + diálogo).
3. A lógica de auto-aceite + fila de impressão já existente continua igual — só troca o "como" imprimir.

## Mudanças no projeto Lovable (o que eu vou alterar)

**`src/routes/pedidos-loja_.$storeId.impressao.tsx`**
- Adicionar helper `printViaElectron(html): Promise<boolean>`.
- No `printOrder`, antes do iframe, tentar Electron primeiro; só cair no iframe se não estiver no Electron.
- Adicionar badge no topo: "🖨️ Modo Electron — impressão silenciosa ativa" quando detectado, ajuda você a confirmar que está funcionando.
- Garantir que a página continue funcionando 100% no navegador (PDV/web).

## Arquivos que você cola no SEU projeto Electron

Não dá pra eu mexer no seu projeto Electron daqui, então no chat eu vou te entregar prontos:

**`preload.js`** (novo arquivo)
```js
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('electronPrint', {
  print: (html) => ipcRenderer.invoke('silent-print', html),
});
```

**Ajustes no `main.js` / `main.cjs`** do seu Electron:
- `BrowserWindow` carregando `https://youapp.lovable.app` com:
  ```js
  webPreferences: {
    preload: path.join(__dirname, 'preload.js'),
    contextIsolation: true,
  }
  ```
- Handler IPC `silent-print` que:
  1. Cria um `BrowserWindow` oculto (`show: false`).
  2. Carrega o HTML do cupom (`loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))`).
  3. Chama `win.webContents.print({ silent: true, printBackground: true, margins: { marginType: 'none' } }, cb)` na impressora padrão.
  4. Fecha a janela após imprimir.

Você cola, rebuilda o `.exe` e está pronto.

## Pontos técnicos

- Detecção: `typeof window !== 'undefined' && !!window.electronPrint`.
- `silent: true` usa a impressora marcada como **padrão** no Windows — então basta o usuário marcar a térmica como padrão uma vez.
- A extensão Chrome continua existindo para quem não usa o Electron — não vou tocar nela.
- O fluxo de auto-aceite no banco (`apply_auto_accept_on_order`) já funciona; o pedido entra como `em_producao` e a página de impressão já enfileira via realtime + polling.

## Fora do escopo

- Não vou empacotar Electron nem mexer na extensão Chrome.
- Não vou alterar a regra de auto-aceite (já funciona).
- Seleção de impressora dentro do app (fica pra depois se quiser).
