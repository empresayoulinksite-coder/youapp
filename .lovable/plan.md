## Resumo do Dia no Painel

Adicionar uma nova seção no topo do `OverviewTab` mostrando o resumo do dia atual, com:

1. **Atendimentos concluídos hoje** - quantidade total
2. **Faturamento do dia** - soma dos valores dos atendimentos concluídos
3. **Formas de pagamento mais usadas no dia** - ranking com contagem

### Detalhes Técnicos

**Arquivo: `src/components/painel/OverviewTab.tsx`**

- Adicionar um card/seção "Resumo do dia" antes do resumo mensal
- Calcular a partir dos bookings com status `completed` e `starts_at` no dia atual:
  - Total de atendimentos
  - Faturamento (soma de `total_price`)
  - Ranking de `payment_method` com labels traduzidos
- Visual: card com bordas, ícones e layout similar ao ranking mensal já existente
- A seção só aparece quando o mês selecionado for o mês atual (já existe essa lógica com `isCurrentMonth`)

Nenhuma alteração de banco de dados necessária - todos os dados já existem.
