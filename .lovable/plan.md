
## Problema

O formulário de agendamento manual no painel (`BookingsTab.tsx`) ainda cria **uma linha por serviço** usando um `for` loop (linhas 1114-1131). Ele não usa a coluna `booked_services` nem unifica os serviços.

O `BookingDialog.tsx` (lado do cliente) já foi corrigido anteriormente, mas o fluxo manual do painel ficou de fora.

## Solução

### Arquivo: `src/components/painel/BookingsTab.tsx`

Substituir o `for` loop (linhas 1112-1131) por uma inserção única, seguindo o mesmo padrão do `BookingDialog.tsx`:

1. Construir o array `booked_services` com os horários individuais de cada serviço (starts_at, ends_at, name, price, duration_minutes, service_id)
2. Inserir **uma única row** com:
   - `service_id` = primeiro serviço
   - `starts_at` = início do primeiro serviço
   - `ends_at` = fim do último serviço
   - `total_price` = soma dos preços
   - `booked_services` = JSON array com detalhes de cada serviço
   - `status` = "confirmed"
3. Atualizar a mensagem de sucesso para "Agendamento criado" (singular)
