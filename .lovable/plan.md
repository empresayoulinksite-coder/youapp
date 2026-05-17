## Problema

Quando você fez um pedido pelo PDV, ao voltar para a aba de Pedidos a impressora soltou **todos** os pedidos que já estavam "Em produção", não só o novo.

## Causa

No `OrdersManager.tsx`, o auto-print compara o status atual de cada pedido com o status anterior guardado em `lastStatusRef`. O problema:

- `lastStatusRef.current` é inicializado como `{}` (vazio).
- Quando o componente monta pela primeira vez (ex.: você estava no PDV e voltou para Pedidos), o "status anterior" de **todos** os pedidos é `undefined`.
- A condição `o.status === "em_producao" && prevStatus !== "em_producao"` passa para todos os pedidos que já estavam em produção.
- Resultado: imprime todos de uma vez.

## Correção

Na primeira carga dos pedidos, **semear** `lastStatusRef` e `printedRef` com o estado atual, sem disparar impressão. Só pedidos que **transicionarem** depois disso devem imprimir.

### Mudanças em `src/components/painel/OrdersManager.tsx`

1. Adicionar um `useRef<boolean>(false)` chamado `didSeedRef`.
2. No `useEffect` de auto-print (linha ~462):
   - Se `didSeedRef.current === false`: preencher `lastStatusRef.current` com o status atual de cada pedido, adicionar todos os pedidos `em_producao` em `printedRef` (para nunca imprimi-los), marcar `didSeedRef.current = true` e sair sem imprimir.
   - Nas execuções seguintes: lógica atual (imprimir só transições novas para `em_producao`).

Isso garante que o auto-print só dispare para pedidos que **realmente mudaram** de status enquanto a aba está aberta — exatamente o novo pedido criado no PDV.

Sem migração, sem mudança de UI, sem efeito colateral no fluxo de pedido manual (esse continua chamando `printOrder` direto via `updateStatus` + handler).