## Plano

1. **Adicionar o bridge real do Electron**
   - Criar a estrutura `electron/` com `main.cjs` e `preload.cjs`.
   - Expor `window.electronAPI.getPrinters()` no preload usando IPC seguro.
   - No processo principal, buscar impressoras com `webContents.getPrintersAsync()` e retornar os nomes para a tela.

2. **Adicionar impressão direcionada por impressora**
   - Implementar `window.electronAPI.print({ html, printerName })` para imprimir silenciosamente na impressora selecionada.
   - Manter compatibilidade com o formato que o app já usa hoje em `thermal-printer.ts`.

3. **Configurar o pacote desktop**
   - Atualizar `package.json` para apontar o app Electron para `electron/main.cjs`.
   - Ajustar `vite.config.ts` com `base: './'` para o `.EXE` carregar os arquivos corretamente quando empacotado.

4. **Melhorar a mensagem da tela**
   - Trocar “Abra pelo app desktop” por uma mensagem mais precisa quando o app desktop estiver sem bridge de impressão, por exemplo: “Este instalador ainda não tem suporte nativo a impressoras. Gere/instale a nova versão do app desktop.”
   - Assim fica claro que o problema não é você ter aberto o navegador errado, mas sim o `.EXE` atual não estar expondo a API de impressoras.

## Detalhes técnicos

O código da tela já chama `window.electronAPI.getPrinters()`, mas o projeto não tem os arquivos do Electron/preload que criam essa API. Por isso, mesmo no `.EXE`, a tela não consegue listar as impressoras do Windows. A correção é implementar esse bridge nativo e depois gerar uma nova versão do desktop.