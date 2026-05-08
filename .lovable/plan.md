## Pedidos finalizados — botão e tela de histórico

Adicionar uma forma de visualizar os pedidos já finalizados (status `entregue`) no Gestor de Pedidos, com filtros por dia e mês.

### Onde fica o botão

No menu lateral do Gestor de Pedidos (`pedidos-loja/$storeId`), logo abaixo de "Meus pedidos", adicionar um novo item:

- **"Pedidos finalizados"** (ícone de histórico/arquivo)

Ao clicar, abre uma nova aba dentro da própria página (mesmo padrão das demais — sem trocar de rota).

### Tela "Pedidos finalizados"

Layout limpo focado em consulta/histórico:

**Topo — Filtros:**
- Botões rápidos: **Hoje**, **Esta semana**, **Este mês**, **Personalizado** (abre um seletor de data inicial e final)
- Filtro de **tipo**: Todos / Balcão / Mesa / Delivery
- Campo de busca: por nº do pedido ou cliente

**Resumo (cards no topo):**
- Total de pedidos no período
- Faturamento total (R$)
- Ticket médio

**Lista de pedidos:**
Tabela/cards com: nº do pedido, data/hora, cliente, tipo (mesa/balcão/delivery), valor total, forma de pagamento. Ao clicar em um pedido, abre um diálogo com os detalhes completos (itens, observações, endereço se delivery).

**Padrão:** ao abrir a aba, o filtro inicial é **Hoje**.

### Detalhes técnicos

- Nova aba `"Pedidos finalizados"` em `NAV_ITEMS` e em `handleNavClick` no arquivo `src/routes/pedidos-loja.$storeId.tsx`.
- Novo componente `src/components/painel/FinishedOrdersTab.tsx` contendo filtros + resumo + lista.
- Query Supabase: `orders` filtrando por `store_id`, `status = 'entregue'` e `created_at` dentro do período selecionado, ordenando por `created_at desc`.
- Reaproveitar tipos e utilitários já existentes em `OrdersManager.tsx` para exibir itens/totais.
- Diálogo de detalhes pode reaproveitar componentes já usados no `OrdersManager`.

### O que não muda

- Nenhuma alteração no fluxo de status dos pedidos ativos.
- Nenhuma migração de banco — usamos a tabela `orders` que já existe.
