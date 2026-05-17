Sim — podemos adicionar um botão de cadastro manual de impressora. Isso não força o Windows a listar a impressora, mas pode resolver quando a detecção falha, porque o Electron consegue imprimir usando o `deviceName` se o nome digitado for exatamente igual ao nome da impressora no Windows.

Plano:

1. **Adicionar botão “Cadastrar manualmente”**
   - Dentro do bloco “Impressoras múltiplas”, ao lado de “Detectar”.
   - Abrirá um campo para digitar o nome exato da impressora instalada no Windows.

2. **Salvar impressoras manuais na lista da tela**
   - A impressora cadastrada manualmente aparecerá nos selects de:
     - Pedidos
     - Cozinha
     - Bebidas
     - Caixa
   - Assim você poderá selecionar mesmo que o botão “Detectar” não encontre nada.

3. **Permitir testar a impressora cadastrada**
   - O botão “Testar” continuará enviando uma impressão para o nome selecionado.
   - Se o nome estiver correto, deve imprimir.
   - Se estiver errado, o app mostrará erro de impressão.

4. **Melhorar a mensagem de erro**
   - Trocar a mensagem atual por algo mais útil:
     - “Nenhuma impressora foi detectada automaticamente. Se ela está instalada no Windows, cadastre pelo nome exato e teste a impressão.”

5. **Manter a detecção automática**
   - Não removeremos o botão “Detectar”.
   - Ele continuará funcionando quando o Windows/Electron conseguir listar as impressoras.

Detalhe importante:
- O nome precisa ser exatamente o mesmo que aparece no Windows em **Configurações → Bluetooth e dispositivos → Impressoras e scanners**.
- Exemplo: se no Windows aparece `EPSON TM-T20X Receipt`, precisa cadastrar exatamente esse texto.