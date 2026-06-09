## Diagnóstico

A pausa real é definida pelo **vão entre os intervalos de `store_hours`** (ex: 09:20–11:20 e 13:20–19:20 → vão 11:20–13:20). O `generateSlots` já não cria slots dentro desse vão — então 12:20 já não deveria aparecer.

O problema atual: quando "agora" cai dentro do vão (ou fora do horário em geral), o `loja.$slug.tsx` bloqueia a abertura do `BookingDialog` com um toast "Loja fechada agora". Isso impede o cliente de agendar para 13:20+ ou para outro dia.

Além disso, a lógica `isPaused` que adicionei na rodada anterior (escondendo slots quando `store.is_paused = true`) não é mais necessária — a pausa será só via gaps de `store_hours`. O `is_paused` volta a ser apenas a flag de "loja pausada para pedidos".

## Mudanças

### 1. `src/routes/loja.$slug.tsx`
- Remover o bloco `if (!withinHours) { toast.error(...); return; }` dos dois `handleBook` (linhas atuais ~681 e ~713). Sempre abrir o `BookingDialog` quando o usuário clica em um serviço. O próprio diálogo mostra os slots válidos (ou mensagem de "sem horários nesse dia").
- Remover a prop `isPaused={store.is_paused}` que estávamos passando para `BookingDialog`.
- Manter o banner "Loja fechada pelo lojista" / "abre amanhã" (informativo).

### 2. `src/components/BookingDialog.tsx`
- Remover a prop `isPaused` da interface, do destructuring e da chamada de `generateSlots`.
- Remover o aviso amarelo "A loja está pausada agora".

### 3. `src/lib/booking-slots.ts`
- Reverter a assinatura de `generateSlots` para não receber `isPaused` e voltar ao filtro de passado original (`cursor.getTime() <= now.getTime()`).

## Resultado esperado
- Cliente clica em "Agendar" a qualquer momento (loja pausada, em horário de almoço, fora do expediente).
- O calendário/lista de horários mostra somente slots dentro de `store_hours` do dia escolhido — então 12:20 não aparece quando há gap 11:20–13:20.
- Slots passados continuam ocultos quando o dia escolhido é hoje.
- A flag `is_paused` deixa de afetar a tela de agendamento (volta a ser só para pedidos/banner).
