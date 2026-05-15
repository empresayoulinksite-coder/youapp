Pelo print, o pedido está sendo gerado e o `window.print()` está disparando, mas o Chrome está abrindo a janela de impressão. Isso indica que o atalho não está usando o Chrome com `--kiosk-printing` corretamente, ou que a página está sendo aberta em uma sessão/janela diferente da do atalho.

Plano:

1. Atualizar as instruções da página `/admin/impressao-automatica`
   - Trocar o comando do atalho para usar um perfil dedicado do Chrome com sessão persistente.
   - Incluir `--user-data-dir` para o modo quiosque não abrir um Chrome “limpo” sem login.
   - Colocar o link real de cada loja já pronto para copiar, em vez de depender de substituir `SEU_STORE_ID` manualmente.

2. Adicionar uma orientação clara de uso correto
   - Fechar todas as janelas do Chrome antes de abrir o atalho.
   - Fazer login uma vez usando o próprio atalho/perfil dedicado.
   - Depois disso, manter esse atalho aberto para impressão automática.

3. Opcionalmente melhorar a página de impressão automática
   - Mostrar um aviso quando a página detectar que não está em modo quiosque, explicando que aparecerá a janela “Imprimir”.
   - Manter a impressão atual funcionando como fallback, mas deixar claro que para não aparecer a janela precisa abrir pelo atalho com `--kiosk-printing`.

Resultado esperado: o usuário copiará um comando mais confiável, com perfil dedicado, e o Chrome imprimirá direto na impressora padrão sem mostrar essa tela de impressão.