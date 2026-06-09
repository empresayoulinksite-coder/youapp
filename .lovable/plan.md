## Objetivo

Hoje, quando o barbeiro pausa a loja, o cliente não consegue abrir o agendamento. Vamos mudar para: mesmo pausada, o cliente pode agendar normalmente — só o horário do "agora" some da lista. Horários futuros (mais tarde no mesmo dia ou em outros dias) continuam disponíveis.

## Mudanças

### 1. `src/routes/loja.$slug.tsx`
- Criar um flag `canBook = withinHours` (ignora `is_paused`) ao lado do `open` atual.
- Nos dois pontos que bloqueiam o `BookingDialog` (linhas ~681 e ~715), trocar `if (!open)` por `if (!canBook)`. Assim, loja pausada porém dentro do horário → abre o agendamento normalmente. Loja fora do horário → continua bloqueando como hoje.
- Manter o banner "Loja fechada pelo lojista" (linha ~508) — só informativo.

### 2. `src/lib/booking-slots.ts`
- Adicionar parâmetro opcional `isPaused: boolean` em `generateSlots`.
- Quando `isPaused && isToday`, marcar como indisponíveis (ou filtrar) todos os slots cujo `start <= now`. Hoje já filtramos slots no passado; vamos estender para esconder também o slot "corrente" enquanto pausado.

### 3. `src/components/BookingDialog.tsx`
- Aceitar nova prop `isPaused: boolean` e passar para `generateSlots`.
- Mostrar um aviso discreto no topo do diálogo quando `isPaused` ("A loja está pausada agora. Escolha um horário futuro.").

### 4. Caller do `BookingDialog`
- Em `loja.$slug.tsx`, passar `isPaused={store.is_paused}` ao `BookingDialog`.

## Fora do escopo
- Agendamento manual no painel (BookingsTab) — pausa não afeta cadastro manual do dono.
- Janela de pausa com horário definido (das X às Y) — não foi pedido.
