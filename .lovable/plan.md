## Objetivo

Garantir que os horários de agendamento apareçam na sequência completa que a loja configurou, começando no horário de abertura, andando de acordo com a grade (`slotMinutes`) e incluindo todos os horários até (e incluindo) o horário de fechamento — mesmo quando o serviço terminaria depois do fim do expediente.

Exemplo (loja 09:20–11:20 e 13:20–19:20, grade 40min):
- Manhã: 09:20, 10:00, 10:40, 11:20
- Tarde: 13:20, 14:00, 14:40, 15:20, 16:00, 16:40, 17:20, 18:00, 18:40, 19:20

## Mudanças

### `src/lib/booking-slots.ts` — `generateSlots`

1. Trocar o critério de parada: hoje quebra quando `cursor + duração > fechamento`. Passar a quebrar quando `cursor > fechamento` (ou seja, o início do slot ainda pode ser igual ao horário de fechamento).
2. Manter a re-ancoragem após agendamentos existentes (cursor pula para o `ends_at` do booking que sobrepõe) — esse comportamento continua igual.
3. Manter o passo entre slots = `slotMinutes` (grade da loja), não `durationMinutes`.
4. Manter o tratamento de slots passados (riscados) no dia de hoje.

Resultado:
- Slots no fim do expediente passam a aparecer (ex.: 11:20, 19:20), respeitando o pedido.
- O passo continua sendo o `slotMinutes` que a loja já configura em `admin.servicos`.

## Fora do escopo

- Sem mudanças no banco, RLS, server functions ou painel admin.
- Sem mudanças no `BookingDialog` — ele já passa `slotMinutes` e `totalDuration` corretamente.
- Sem alteração na duração do serviço nem na grade configurada.
