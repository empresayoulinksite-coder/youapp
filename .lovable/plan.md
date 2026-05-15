## Diagnóstico

O problema está no gatilho de aceite automático: quando a loja está com “aceitar pedidos automaticamente” ligado, o pedido já nasce no banco com status `em_producao`. A impressão automática atual só escuta o evento de criação do pedido (`INSERT`) e tenta imprimir imediatamente. Em pedidos do cliente e do PDV, os itens ainda podem ser inseridos logo depois do pedido, então a extensão/página pode buscar o pedido antes dos itens existirem — ou depender de uma transição de status que não acontece.

## Plano de correção

1. **Ajustar a extensão do Chrome**
   - Escutar também inserções em `order_items`, além de `orders`.
   - Quando chegar um pedido novo, aguardar rapidamente os itens aparecerem antes de imprimir.
   - Buscar pedidos recentes `em_producao` da loja ao conectar/reconectar, para recuperar pedidos que entraram enquanto a extensão estava iniciando ou desconectada.
   - Evitar impressão duplicada com controle por ID de pedido.

2. **Ajustar a página de impressão automática no app**
   - Aplicar a mesma lógica de espera pelos itens antes de imprimir.
   - Também escutar `order_items` para imprimir pedidos autoaceitos assim que os itens forem gravados.
   - Na conexão inicial, verificar pedidos recentes `em_producao` ainda não impressos.

3. **Recriar o arquivo da extensão**
   - Empacotar novamente `public/youapp-print.zip` com os arquivos corrigidos.
   - Depois você baixa novamente em Admin → Impressão Automática e recarrega a extensão no Chrome.

## Detalhes técnicos

- Não vou alterar a regra de aceite automático da loja.
- A correção fica focada no “pipeline” de impressão: evento de pedido + evento de itens + recuperação de pedidos recentes.
- Isso deve cobrir tanto pedidos criados pelo cliente quanto pedidos criados pelo PDV.