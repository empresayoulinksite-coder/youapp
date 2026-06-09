## Objetivo

Transformar o toggle "Loja sempre aberta" em uma **flag persistente** no banco (`stores.always_open`). Quando ativa, a loja é considerada aberta 24h **mesmo que existam intervalos cadastrados** — os intervalos continuam servindo para definir os horários de agendamento (com os gaps funcionando como pausas), mas o status geral da loja fica sempre "Aberta".

Hoje o toggle só reescreve os intervalos para `00:00–23:59`, o que apaga a configuração de agendamento. Isso vai mudar.

## Mudanças

### 1. Migração no banco
- Adicionar coluna `always_open boolean NOT NULL DEFAULT false` em `public.stores`.

### 2. `src/components/StoreHoursEditor.tsx`
- Carregar `always_open` da `stores` junto com os horários.
- Trocar `isAlwaysOpen` (computado dos intervalos) por um state real ligado à coluna.
- `setAlwaysOpen(v)` apenas atualiza `stores.always_open = v` — **não mexe nos intervalos**.
- Atualizar o texto auxiliar para deixar claro: "Quando ativa, a loja fica sempre aberta para os clientes. Os intervalos abaixo continuam valendo apenas para o agendamento."

### 3. `src/lib/store-hours.ts`
- `isStoreOpen(hours, now, alwaysOpen?)` → retorna `true` imediatamente se `alwaysOpen`.
- `isStoreAvailable(hours, isPaused, now, alwaysOpen?)` → mesma coisa, respeitando ainda `isPaused`.

### 4. Callers
- `src/routes/loja.$slug.tsx`: buscar `always_open` no select de `stores`, passar para `isStoreOpen` (linha ~352).
- `src/routes/sacola.tsx`: idem se aplicável.
- `src/routes/painel.tsx`: incluir `always_open` no select para não quebrar o type.

### 5. Geração de slots (não muda)
- `generateSlots` continua respeitando os intervalos como hoje — agendamento permanece restrito aos horários cadastrados, mesmo com `always_open=true`.

## Resultado
- Toggle ON + intervalos 09:20–11:20 e 13:20–19:20 → loja aparece como "Aberta agora" 24h; agendamento só permite slots dentro de 09:20–11:20 e 13:20–19:20.
- Toggle OFF → comportamento atual (status de aberto/fechado segue os intervalos).
