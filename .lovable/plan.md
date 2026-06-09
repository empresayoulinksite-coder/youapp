## Encaixar cliente no agendamento manual

No dialog "Novo agendamento" do painel (aba Agendamentos), adicionar um botão/toggle **"Encaixar cliente"** ao lado do título da seção **Horário**.

### Comportamento

- **Toggle desligado (padrão):** mostra a grade de horários disponíveis como hoje (respeita intervalos da loja, pausa, agendamentos existentes).
- **Toggle ligado (encaixe):** esconde a grade e mostra um campo `<input type="time">` para o atendente digitar qualquer horário (ex: 12:40, mesmo durante a pausa ou fora dos slots). Mostra um aviso curto: "Encaixe ignora a grade de horários e pode sobrepor outros agendamentos."

### Onde mexer

Apenas em `src/components/painel/BookingsTab.tsx` (dialog `NewBookingDialog`, linhas ~1176–1373):

1. Adicionar estado `manualMode: boolean` e `manualTime: string` (HH:MM).
2. Na seção "Horário" (linha 1315), adicionar um botão pequeno "Encaixar cliente" no header do label. Quando ativo:
   - renderizar `<Input type="time">` no lugar da grade
   - ao salvar, montar `startsAt` a partir de `date` + `manualTime` e `endsAt = startsAt + totalDuration`
3. Ajustar `save()` (linha ~1154) para usar `startsAt`/`endsAt` calculados manualmente quando `manualMode` estiver ligado, em vez de `slot` e `cursor`.
4. Ajustar o `disabled` do botão "Criar agendamento" (linha 1367): no modo encaixe, exige `manualTime` válido em vez de `slot`.

### Não-objetivos

- Não alterar a lógica de geração de slots (`booking-slots.ts`) nem a configuração de horários da loja.
- Não alterar o fluxo do cliente final (apenas painel do dono).
- Não mudar schema do banco — o agendamento de encaixe é salvo como qualquer outro `booking` com status `confirmed`.
