
## Objetivo

Quando o cliente seleciona mais de um serviço (ex: Corte 30min + Barba 20min), será criado **um único agendamento** em vez de um por serviço. Dentro desse agendamento, os horários de cada serviço ficam detalhados (ex: Corte 14:00-14:30, Barba 14:30-14:50).

## Mudanças

### 1. Banco de dados

Adicionar coluna `booked_services` (JSONB) na tabela `bookings`:
- Armazena um array com cada serviço: `service_id`, `name`, `duration_minutes`, `price`, `starts_at`, `ends_at`
- A coluna `service_id` existente será mantida (apontando para o primeiro serviço, para compatibilidade)
- `starts_at` / `ends_at` do booking = horário total (início do primeiro ao fim do último)
- `total_price` = soma de todos os serviços

### 2. BookingDialog (criação do agendamento)

- Em vez de criar N linhas, criar **uma única linha** com:
  - `service_id` = primeiro serviço
  - `starts_at` = início do bloco
  - `ends_at` = fim do último serviço
  - `total_price` = soma
  - `booked_services` = JSON com detalhes de cada serviço e seus horários individuais

### 3. BookingsTab (painel da loja)

- Exibir todos os serviços do agendamento (lendo `booked_services` quando presente, fallback para `services` quando for agendamento antigo com 1 serviço)
- Mostrar os horários individuais: "Corte 14:00-14:30 | Barba 14:30-14:50"

### 4. Página "Meus Agendamentos" (agendamentos.tsx)

- Ajustar exibição para mostrar múltiplos serviços quando `booked_services` estiver presente

### Detalhes Técnicos

**Migration SQL:**
```sql
ALTER TABLE public.bookings 
ADD COLUMN booked_services jsonb DEFAULT NULL;
```

**Formato do JSON `booked_services`:**
```json
[
  { "service_id": "uuid", "name": "Corte", "duration_minutes": 30, "price": 40, "starts_at": "...", "ends_at": "..." },
  { "service_id": "uuid", "name": "Barba", "duration_minutes": 20, "price": 25, "starts_at": "...", "ends_at": "..." }
]
```

**Arquivos editados:**
- `src/components/BookingDialog.tsx` - inserir 1 row com `booked_services`
- `src/components/painel/BookingsTab.tsx` - exibir múltiplos serviços
- `src/routes/agendamentos.tsx` - exibir múltiplos serviços na visão do cliente
