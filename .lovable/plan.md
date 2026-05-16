Vou ajustar o frontend para que todos os fluxos automáticos de impressão de pedidos usem exclusivamente `window.electronPrint.print(html)`.

Plano:

1. Centralizar a regra no helper de impressão
   - Manter `browserPrintHTML(html, { silent: true })` como caminho obrigatório de impressão silenciosa.
   - Garantir que, quando `silent: true`, nunca exista fallback para `window.open()`, `window.print()` ou impressão do navegador.
   - Deixar o fallback com `window.print()` disponível apenas para impressão manual fora do Electron, se necessário.

2. Corrigir o auto-print do painel de pedidos
   - Revisar o fluxo que imprime quando o pedido muda para `em_producao`.
   - Forçar esse fluxo a chamar somente o caminho silencioso Electron.
   - Evitar qualquer impressão por conexão/fallback do navegador quando a ação for automática.

3. Corrigir a página `/pedidos-loja/{storeId}/impressao`
   - Garantir que realtime, polling e catch-up chamem apenas `window.electronPrint.print(html)`.
   - Se o Electron não estiver disponível, registrar erro e não abrir popup.

4. Remover/neutralizar textos e instruções antigas que indicam Chrome quiosque como caminho de impressão automática principal
   - Atualizar a orientação da tela para refletir o app Electron como fluxo correto.
   - Não mexer na extensão/manual de QR code, exceto se estiver dentro do fluxo automático de pedidos.

5. Validar por busca no código
   - Confirmar que não sobrou `window.print()` em nenhum fluxo automático de pedidos.
   - Qualquer `window.print()` restante deve estar limitado a fluxos manuais ou arquivos da extensão, não ao auto-print de pedidos.