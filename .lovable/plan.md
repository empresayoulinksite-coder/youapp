## Plano: Relatório Geral estilo Anota Aí

### O que será feito

Novo componente `src/components/painel/GeneralReportTab.tsx` substituindo o placeholder atual "Em desenvolvimento".

### Layout e funcionalidades

1. **Filtro de período** no topo
   - Seletor de intervalo de datas (data inicial e final)
   - Toggle "Comparar períodos" (visual, funcionalidade futura)

2. **4 cards de resumo** (dados vindos da tabela `bookings` filtrados por `store_id` e período)
   - **Faturamento** — soma dos valores dos pedidos concluídos
   - **Ticket médio** — faturamento / total de pedidos
   - **Total de pedidos** — contagem de pedidos no período
   - **Clientes ativos** — contagem distinta de `user_id`

3. **Abas de visualização**
   - **Pedidos e Entregas** — gráfico de barras agrupado por dia da semana (Dom-Sáb), com barras de Entregas vs Pedidos
   - **Faturamento** — gráfico de barras do faturamento por dia da semana
   - **Formas de pagamento** — distribuição por método de pagamento

4. **Seletor de agrupamento** (Diário / Semanal / Mensal) ao lado das abas

### Estilo visual
- Cards com ícones coloridos em fundo azul claro, valores em destaque
- Gráfico de barras com cores azul escuro (entregas) e azul claro (pedidos)
- Labels nos topos das barras com os valores
- Design limpo, fundo branco, bordas suaves

### Detalhes técnicos

- **Componente**: `src/components/painel/GeneralReportTab.tsx`
- **Gráficos**: biblioteca `recharts` (já disponível no projeto)
- **Dados**: query na tabela `bookings` com filtros de `store_id`, `status = 'completed'`, e intervalo de datas
- **Sidebar**: atualizar `pedidos-loja.$storeId.tsx` para renderizar `GeneralReportTab` no lugar do placeholder
- Sem alterações no banco de dados
