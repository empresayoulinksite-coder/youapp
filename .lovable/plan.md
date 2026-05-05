
## O que será feito

Adicionar duas novas seções no resumo mensal (OverviewTab):

1. **Serviços mais prestados** -- ranking dos serviços com quantidade de atendimentos concluídos no mês selecionado
2. **Forma de pagamento mais usada** -- ranking das formas de pagamento usadas nos agendamentos concluídos

Sim, é totalmente possível. Novos serviços e novas formas de pagamento aparecerão automaticamente conforme forem usados.

## Mudanças necessárias

### 1. Adicionar `payment_method` na tabela `bookings`

Hoje a tabela de agendamentos (bookings) não tem campo de forma de pagamento. Será criada uma migration adicionando a coluna `payment_method` (texto, opcional) à tabela bookings.

### 2. Permitir registrar forma de pagamento ao concluir agendamento

No BookingsTab, quando o lojista marca um agendamento como "concluído", será exibido um seletor de forma de pagamento (Pix, Dinheiro, Crédito, Débito, etc.) antes de salvar. As opções vêm da lista de métodos da loja, então novas formas de pagamento adicionadas à loja aparecem automaticamente.

### 3. Atualizar o BookingRow type e a query de bookings

Incluir `payment_method` no tipo BookingRow e na query que busca os agendamentos.

### 4. Adicionar seções no OverviewTab

- **Serviços mais prestados**: agrupa os bookings concluídos do mês por `services.name`, conta quantos de cada, e exibe em lista ordenada do mais para o menos prestado.
- **Forma de pagamento mais usada**: agrupa os bookings concluídos do mês por `payment_method`, conta quantos de cada, e exibe em lista ordenada.

Ambos são calculados dinamicamente a partir dos dados existentes -- qualquer novo serviço ou forma de pagamento aparece automaticamente no ranking.

## Arquivos afetados

- Nova migration SQL (adicionar coluna `payment_method` em bookings)
- `src/components/painel/BookingsTab.tsx` -- adicionar seletor de pagamento ao concluir, atualizar tipo e query
- `src/components/painel/OverviewTab.tsx` -- adicionar as duas novas seções de ranking
