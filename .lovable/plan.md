## Plano: Seção Relatórios na Sidebar

### O que será feito

1. **Nova seção colapsável "Relatórios" na sidebar** (`pedidos-loja.$storeId.tsx`)
   - Abaixo da seção "Entregas", adicionar uma seção colapsável "Relatórios" com ícone `BarChart3`
   - Dois sub-itens: **Geral** e **Caixa**
   - Ao clicar, cada um muda o `activeTab` para renderizar o conteúdo correspondente

2. **Tela "Relatório Caixa"** (novo componente `src/components/painel/CashReportTab.tsx`)
   - Estilo inspirado no Anota Aí (imagem de referência)
   - Filtro de período (data inicial e final) no topo
   - Tabela com colunas: Nº do caixa, Abertura, Fechamento, Status
   - Dados vindos da tabela `cash_registers` já existente no banco
   - Paginação na tabela
   - Botões de ação por linha (visualizar resumo)

3. **Tela "Relatório Geral"** (placeholder inicial)
   - Componente simples com título "Relatório Geral" e mensagem "Em desenvolvimento"
   - Pode ser expandido futuramente

### Detalhes técnicos

- **Sidebar**: adicionar estado `relatoriosOpen` e lógica colapsável idêntica à seção "Entregas"
- **CashReportTab**: query na tabela `cash_registers` filtrando por `store_id` e período, ordenado por `opened_at DESC`
- Sem alterações no banco de dados — usa tabelas existentes
