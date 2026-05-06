
## Filtro de Dia no Resumo

Atualmente o painel mostra apenas "Resumo do dia" (dia atual) e os totais do mês. A ideia e adicionar um seletor de dia para que voce possa navegar entre os dias do mes selecionado e ver o faturamento, atendimentos e demais metricas de cada dia.

### O que muda

**`src/components/painel/OverviewTab.tsx`**:

1. Adicionar um estado `selectedDay` (numero do dia, default = dia atual quando no mes atual, ou 1 para meses passados).

2. Gerar a lista de dias do mes selecionado (1 a 28/29/30/31) como opcoes de um Select ou grupo de botoes.

3. Trocar a secao "Resumo do dia" para usar o dia selecionado em vez de sempre usar "hoje":
   - O titulo mostra a data selecionada (ex: "terça-feira, 05 de maio")
   - Os cards de "Faturamento hoje" e "Atendimentos hoje" passam a refletir o dia selecionado
   - O ranking de formas de pagamento do dia tambem usa o dia selecionado

4. O seletor de dia aparece ao lado do seletor de mes, como um segundo dropdown. Quando o usuario troca o mes, o dia reseta para 1 (ou dia atual se for o mes atual).

5. A secao "Resumo do dia" passa a ser exibida para todos os meses (nao apenas o mes atual), permitindo navegar o historico dia a dia.

### Sem mudancas no banco de dados
Tudo e feito no frontend, filtrando os bookings que ja sao carregados.
