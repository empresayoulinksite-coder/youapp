# Clientes recorrentes para barbearias

Criar um sistema de assinatura por loja onde o cliente compra um pacote com X serviços inclusos, e cada agendamento concluído desconta 1 do saldo. Quando sobra apenas 1 serviço, o cliente fica destacado no painel para o dono saber que precisa renovar.

## Escopo

- Disponível apenas para lojas da categoria **Barbearia** (e similares — usaremos um helper `isBarbershopStore`).
- Pagamento **manual**: dono marca como pago ao criar/renovar a assinatura. Sem cobrança automática.
- Baixa **ao concluir o agendamento** (status `completed`).
- Alerta de cor quando restar **1 serviço**.

## Mudanças no banco

**1. `subscription_plans`** — planos que cada barbearia oferece
- `store_id`, `name`, `description`, `price`, `total_services` (quantos serviços inclusos), `validity_days` (validade em dias, ex: 30), `is_active`, `position`
- Tabela `subscription_plan_services` (N:N): quais `services.id` são cobertos pelo plano. Se vazio, vale para qualquer serviço da loja.

**2. `client_subscriptions`** — assinaturas ativas dos clientes
- `store_id`, `customer_user_id` (opcional, se cliente tiver conta), `customer_name`, `customer_phone`, `plan_id`, `services_total`, `services_used` (default 0), `started_at`, `expires_at`, `status` (`active` | `expired` | `cancelled`), `notes`
- Coluna gerada/calculada `services_remaining = services_total - services_used`.

**3. `bookings`** — adicionar `subscription_id uuid NULL` (referência à assinatura usada).

**4. Trigger `apply_subscription_on_booking_complete`**
- BEFORE UPDATE em `bookings`: quando `status` muda para `completed` e existe uma `client_subscriptions` ativa do mesmo `user_id`/`phone` na loja que cubra o serviço e ainda tenha saldo:
  - Marca `NEW.subscription_id`
  - Incrementa `services_used` na assinatura
  - Se atingir o total, marca `status = 'expired'`
- Outro trigger reverte o uso se um agendamento `completed` for revertido/cancelado.

**5. RLS + GRANTS** em todas as novas tabelas (donos/staff gerenciam; clientes leem só as próprias).

## Mudanças no frontend

**1. `src/lib/barbershop.ts`** (novo) — helper `isBarbershopStore(category)` espelhando `isGymStore`.

**2. Nova aba "Assinaturas" no painel da barbearia** (`src/components/painel/BookingsTab.tsx` ganha sub-link ou nova tab em `painel.tsx`):
- Lista de planos: criar/editar/desativar (nome, preço, qtd serviços, validade, serviços inclusos).
- Lista de clientes assinantes: nome, telefone, plano, **saldo restante (X/Y)**, validade, status.
- Botão "Nova assinatura": escolhe cliente (busca por nome/telefone, opcionalmente vincula `user_id`), escolhe plano, marca como pago → cria `client_subscriptions`.
- Botão "Renovar" em cada assinatura: cria nova ou reseta saldo.

**3. Indicação visual em `BookingsTab.tsx`**:
- Em cada card de agendamento, se o cliente tem assinatura ativa, mostrar badge "Assinante · X/Y restantes".
- Se `services_remaining <= 1`, badge em cor de alerta (amber/destructive) com texto "Renovar em breve".

**4. Após concluir um agendamento** (linha 590, status=completed):
- Invalidar query de assinaturas para refletir o novo saldo.
- Toast extra se a assinatura zerou: "Assinatura do cliente acabou — hora de renovar".

## Não-objetivos

- Não implementa cobrança recorrente automática (Stripe/Paddle).
- Cliente final **não** vê/compra a assinatura pelo app nesta versão — fluxo todo gerenciado pelo dono.
- Não muda nada para academias ou outros tipos de loja.
- Não altera o preço do agendamento na finalização (a baixa é só do contador; pagamento da assinatura é separado).

## Detalhes técnicos

- Matching cliente↔assinatura no trigger: tenta `customer_user_id = bookings.user_id` primeiro; se não tiver user_id, casa pelo telefone normalizado.
- Assinaturas expiram automaticamente quando `expires_at < now()` (verificado via função `is_subscription_active` usada no trigger e nas queries do painel).
- Filtro de serviço coberto: se `subscription_plan_services` estiver vazio para o plano, qualquer serviço da loja conta; senão precisa estar na lista.
