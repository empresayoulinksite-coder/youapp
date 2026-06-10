## Aceitar agendamentos automaticamente

Adicionar um toggle **"Aceitar automaticamente"** logo abaixo da linha de abas (onde fica o botão "Pendentes") no painel de Agendamentos. Quando ligado, todo novo agendamento criado pelo cliente entra direto como **Confirmado**, sem passar por Pendentes.

### Comportamento

- Toggle persistente por loja (salvo no banco em `stores.auto_accept_bookings`).
- Ligado: novos agendamentos do cliente já entram como `confirmed`. O dono não precisa aceitar manualmente.
- Desligado (padrão): fluxo atual — novos agendamentos chegam como `pending` e precisam ser aceitos.
- Agendamentos já existentes não são alterados.
- Não afeta agendamentos manuais criados pelo próprio painel (esses já são criados como confirmados).

### Mudanças

**1. Migração** — adicionar coluna e trigger:
- `ALTER TABLE stores ADD COLUMN auto_accept_bookings boolean NOT NULL DEFAULT false`
- Função `apply_auto_accept_on_booking()` (espelha `apply_auto_accept_on_order`): no BEFORE INSERT, se `NEW.status = 'pending'` e a loja tem `auto_accept_bookings = true`, muda para `'confirmed'`.
- Trigger BEFORE INSERT em `public.bookings`.

**2. `src/routes/painel.tsx`** — incluir `auto_accept_bookings` no SELECT de stores (linha 66).

**3. `src/components/painel/BookingsTab.tsx`**:
- Adicionar `auto_accept_bookings?: boolean` em `StoreLite`.
- Logo abaixo do `<TabsList>` (linha ~362), renderizar uma faixa com `<Switch>` + label "Aceitar agendamentos automaticamente" + uma linha curta de ajuda ("Novos agendamentos serão confirmados sem precisar de aprovação.").
- O switch atualiza `stores.auto_accept_bookings` via `supabase.from('stores').update(...)` e invalida a query da store.

### Não-objetivos

- Não muda nada para o cliente final além do status inicial do agendamento dele.
- Não mexe na lógica de slots, encaixe manual ou pagamento.
- Não cria notificação diferente — segue o fluxo atual.
