## Objetivo

Adicionar **"Agendar pela assinatura"** no card de assinatura do cliente em `/agendamentos`, com opção de incluir um serviço adicional (pago no balcão). No painel da barbearia, destacar o agendamento como vindo da assinatura, mostrar o adicional cobrado e permitir remover o adicional antes de concluir.

## Fluxo do cliente (/agendamentos)

1. Em cada card de **Minhas assinaturas** ativas (com `services_remaining > 0`), botão **Agendar pela assinatura**.
2. Modal `SubscriptionBookingDialog` abre com:
   - **Serviço do combo**: lista os serviços de `subscription_plan_services` para o `plan_id`. Se houver mais de um, cliente escolhe 1. Preço exibido como "Incluso na assinatura".
   - **Data e horário**: usa `store_hours` + `bookings` ocupados do dia (reaproveita `generateSlots`/`formatSlotLabel`).
   - **Adicionar serviço extra? (opcional)**: toggle. Quando ativo, lista os serviços ativos da loja (filtra os que já estão no combo). Cliente escolhe 1; preço somado e mostrado como "A pagar no balcão".
   - **Observações** livre.
3. Confirmar cria 1 `bookings` com:
   - `service_id` = serviço do combo (principal)
   - `subscription_id` = id da assinatura
   - `booked_services` (jsonb) com 2 itens quando houver extra:
     `[{ service_id, name, price: 0, is_subscription: true, ... }, { service_id, name, price: X, extra: true, ... }]`
   - `total_price` = preço do extra (0 quando sem extra)
   - `customer_notes` prefixado com "Agendado pela assinatura — {plano}"

## Fluxo da barbearia (BookingsTab)

- Quando `booking.subscription_id` não é nulo:
  - Badge **"Assinatura — {plano}"**.
  - Se `booked_services` tem item `extra: true`: bloco destacado **"Serviço adicional: {nome} — R$ X,XX (pago no balcão)"** com botão **Remover adicional**.
  - **Remover adicional**: atualiza `booked_services` (mantém só o item do combo) e `total_price = 0`. Útil quando o cliente desistiu do extra.
- Ao marcar como **Concluído**, o trigger `apply_subscription_on_booking_complete` já existente baixa 1 crédito automaticamente (1 booking = 1 baixa, independente do extra).

## Detalhes técnicos

- **Novo arquivo:** `src/components/SubscriptionBookingDialog.tsx`
  - Props: `{ open, onClose, subscriptionId, storeId, planId, planName, storeName, storeWhatsapp?, onCreated }`
  - Internamente busca: `subscription_plan_services` (com join em `services`), `services` ativos da loja (para o extra), `store_hours`, `stores.slot_minutes`.
  - Reaproveita `generateSlots`/`formatSlotLabel` de `@/lib/booking-slots`.
- **`src/routes/agendamentos.tsx`**:
  - Converter o `<Link>` de cada card em `<article>` com dois CTAs: **Agendar pela assinatura** (primário, abre modal; desabilitado quando `ended` ou `remaining <= 0`) e **Ver loja** (link secundário).
  - Estado local `activeSub` para controlar abertura do modal.
- **`src/components/painel/BookingsTab.tsx`**:
  - Incluir `subscription_id` e join opcional em `client_subscriptions(subscription_plans(name))` no select de bookings.
  - Renderizar badge "Assinatura — {plano}" e bloco de adicional baseado em `booked_services` (item com `extra: true`).
  - Botão **Remover adicional**: `update bookings set booked_services = <só combo>, total_price = 0 where id = ?`.
- **Sem migration nova.** Toda a estrutura já existe (`subscription_id`, `booked_services` jsonb, trigger de baixa na conclusão). As marcações `is_subscription` / `extra` são apenas convenções dentro do jsonb.
- **Tipos**: estender o tipo `BookedServiceItem` em `agendamentos.tsx` e em `BookingsTab.tsx` com `is_subscription?: boolean` e `extra?: boolean`.

## Decisões já confirmadas

1. Baixa do crédito segue automática ao **concluir o serviço** (trigger existente).
2. Pagamento do adicional é no **balcão** — sem fluxo de pagamento online.
3. Loja pode **remover o adicional** antes de concluir, caso o cliente desista.
