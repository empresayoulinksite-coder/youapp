Entendi: o print mostra que o problema está no `/painel` da loja, não apenas na tela de administração. Encontrei no arquivo `src/routes/painel.tsx` que os componentes de Entrega e Benefícios ainda estão sendo renderizados para qualquer loja.

Plano para corrigir:

1. Ajustar o painel da loja (`src/routes/painel.tsx`)
   - Criar/usar uma condição para identificar lojas de serviço: `currentStore?.store_type === "service"`.
   - Renderizar `StoreDeliveryEditor` e `StoreBenefitsEditor` somente quando a loja não for de serviço.
   - Assim, esses dois cards somem do painel da loja para serviços.

2. Conferir consistência com o admin
   - Manter a regra já aplicada em `src/routes/admin.loja.$storeId.tsx`, onde Entrega e Benefícios já ficam ocultos quando `isService` é verdadeiro.

3. Resultado esperado
   - Para lojas de serviço, como a loja do print, não aparecerão mais:
     - “Entrega”
     - “Faz entrega”
     - “Benefícios na página do produto”
     - Linhas de entrega/garantia/troca
   - Esses campos continuarão disponíveis para lojas de comida/e-commerce, onde fazem sentido.