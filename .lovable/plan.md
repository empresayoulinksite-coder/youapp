## Objetivo
Adicionar, para cada loja na página `/admin/impressao-automatica`, um botão **"Baixar .bat"** que gera e baixa um arquivo pronto que abre o Chrome no modo correto de impressão automática — sem o usuário precisar criar atalho manualmente.

## O que muda

**Arquivo:** `src/routes/admin.impressao-automatica.tsx`

1. Adicionar função `buildBatFile(origin, storeId, storeName)` que retorna o conteúdo de um `.bat` assim:
   ```bat
   @echo off
   REM Impressao automatica - <nome da loja>
   REM Fecha Chromes abertos no perfil de impressao (opcional, evita conflito)
   start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" ^
     --user-data-dir="C:\YouappPrint" ^
     --kiosk-printing ^
     --kiosk ^
     --no-first-run ^
     --no-default-browser-check ^
     "<origin>/pedidos-loja/<storeId>/impressao"
   ```
   Com fallback para `C:\Program Files (x86)\...` caso o primeiro caminho não exista.

2. Adicionar componente `DownloadBatButton` que cria um `Blob` (`type: "application/bat"`), gera URL com `URL.createObjectURL`, dispara download via `<a download="Imprimir-<slug>.bat">` e revoga a URL.

3. Em cada card de loja, adicionar o botão **"Baixar .bat"** ao lado dos botões "Copiar comando" e "Abrir no navegador".

4. Atualizar o Passo 2 para: **"Baixe o arquivo .bat da sua loja, salve na área de trabalho e dê dois cliques. Pronto."** Manter o "Copiar comando" como alternativa avançada para quem prefere criar o atalho manual.

## Detalhes técnicos
- Conteúdo do `.bat` é gerado 100% no cliente (sem backend).
- Nome do arquivo: `Imprimir-<store-name-slugificado>.bat`.
- O `.bat` testa os dois caminhos padrão do Chrome (`Program Files` e `Program Files (x86)`) com `if exist`, e mostra um aviso amigável caso o Chrome não seja encontrado.
- Mantém todo o resto da página (instruções, FAQ, alertas) como está.

## Resultado esperado
O usuário entra em `/admin/impressao-automatica`, clica em "Baixar .bat" da loja, salva o arquivo e dá dois cliques — o Chrome abre direto em modo quiosque na página de impressão automática, sem precisar criar atalho manual nem editar parâmetros.