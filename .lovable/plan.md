## Objetivo
Adicionar botão **"Relatório do caixa"** ao lado de **"Abrir caixa"** (no topo de `BookingsTab`) que abre a tela de relatório já existente (`CashReportTab`) em um diálogo.

## Mudanças

### `src/components/painel/BookingsTab.tsx`
- Novo botão `Relatório do caixa` (variant `outline`, ícone `FileText` ou `BarChart3`) renderizado sempre, logo ao lado do bloco "Abrir caixa"/menu do caixa aberto.
- Estado local `reportOpen` controla um `Dialog` (shadcn) em tela cheia (max-w-5xl) que renderiza `<CashReportTab storeId={storeId} />` no corpo.
- Importar `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle` e `CashReportTab`.
- O título "Relatório de Caixa" já existe dentro do componente, então o `DialogTitle` pode ficar com texto curto ("Relatório do caixa") e o conteúdo padding ajustado.

### Sem mudanças
- `CashReportTab` permanece igual (já tem filtros de data, paginação, dialog de detalhes).
- Nenhuma migration / backend.

## Resultado
Na aba de agendamentos do painel, o dono vê:
`[Abrir caixa]  [Relatório do caixa]                              [Novo agendamento]`
Clicando em "Relatório do caixa" abre um modal com a listagem por período (igual à imagem enviada), com botão de olho para ver o resumo de cada caixa.
