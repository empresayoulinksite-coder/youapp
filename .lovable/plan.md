
## Problema

No diálogo "Novo agendamento" do painel, aba **Assinatura**:
1. Os horários não aparecem (a lista de serviços não tem `is_subscription`/`extra`, então a duração não é calculada como no fluxo do cliente).
2. Todos os serviços aparecem como cobráveis — deveria mostrar os **serviços do plano** como "Incluso na assinatura" e os demais como **adicional** (cobrado à parte).

## Objetivo

Replicar a UX do `SubscriptionBookingDialog.tsx` (usado pelo cliente) dentro da aba **Assinatura** do `BookingsTab.tsx` quando o barbeiro faz o agendamento manual.

## Mudanças (apenas `src/components/painel/BookingsTab.tsx`)

Dentro do `NewBookingDialog` (ou componente do diálogo "Novo agendamento"), quando `clientMode === "subscription"` e uma assinatura está selecionada:

1. **Buscar serviços do plano** da assinatura selecionada via `subscription_plan_services` join `services(id, name, duration_minutes, price)` usando o `plan_id` da assinatura (precisa incluir `plan_id` no fetch atual de assinaturas).

2. **UI dos serviços** (substitui a lista atual quando em modo assinatura):
   - **Serviço da assinatura** (rádio): lista apenas os serviços do plano, marcados como "Incluso na assinatura" (preço 0, sem cobrança). Auto-seleciona se houver apenas um.
   - **Adicionar serviço extra** (switch + rádio): lista os demais serviços ativos da loja, exibindo `duração · R$ preço`. Cobrado à parte.

3. **Cálculo de duração e horários**:
   - `totalDuration = comboService.duration_minutes + (extraService?.duration_minutes ?? 0)`
   - Passar essa duração para `generateSlots(...)` — assim os horários voltam a aparecer.

4. **Salvar no insert de `bookings`**:
   - `service_id = comboService.id`
   - `booked_services`: combo com `price: 0, is_subscription: true` + (se houver) extra com `price, extra: true`, cada um com `starts_at`/`ends_at` sequenciais.
   - `total_price = extraService?.price ?? 0`
   - `subscription_id = subscriptionId`
   - `customer_notes`: prefixar com `"Agendado pela assinatura — <plano>"` igual ao fluxo do cliente.

5. Manter o cabeçalho atual da assinatura (cartão "Samuka · Combo venus · X de Y restantes · vence em…") com botão **Trocar**.

6. Quando o modo é **Cliente comum**, comportamento atual permanece inalterado.

## Fora do escopo

- Nenhuma migração de banco; backend não muda.
- Nenhuma alteração no `SubscriptionBookingDialog` do cliente.
- Sem alterações em outras abas.
