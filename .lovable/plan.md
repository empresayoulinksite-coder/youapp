## Sempre imprimir cupom completo na cozinha

Adicionar um toggle no diálogo de "Tempos de produção" que força a impressora da cozinha a sempre imprimir o **cupom completo** do pedido — mesmo que nenhum item esteja nas categorias da cozinha.

### O que muda

1. **Novo toggle** no bloco de impressoras múltiplas, logo abaixo do select "Cozinha":
   - Label: **"Sempre imprimir cupom completo na cozinha"**
   - Descrição: "Imprime o pedido inteiro na cozinha, ignorando as categorias selecionadas."

2. **Comportamento da impressão**:
   - Toggle **desligado** (padrão): comportamento atual — só imprime na cozinha os itens cujas categorias estão marcadas.
   - Toggle **ligado**: a cozinha sempre recebe o cupom completo, igual à via de Pedidos. Útil para usar Pedidos = via do cliente / Cozinha = via da produção, na mesma impressora ou em impressoras separadas.

3. **Persistência**: salvo junto com as outras preferências de impressora (mesmo registro, mesma ação de salvar). Campo novo: `kitchen_always_full: boolean`, default `false`.

4. **Pequena pausa entre jobs na mesma impressora** (300 ms): quando dois jobs consecutivos vão para a mesma `printerName` (caso de Pedidos + Cozinha na mesma EPSON), espera um pouco para o driver do Windows não agrupar os dois em um só job.

### Arquivos afetados

- `src/components/painel/OrdersManager.tsx`
  - Tipo `PrinterSettings`: adicionar `kitchen_always_full?: boolean`.
  - Função `printOrder` (~linha 411): se `ps.printer_kitchen` existir e `kitchen_always_full` estiver ligado, criar o job de cozinha como `fullOrder: true` com todos os itens.
  - Loop de jobs (~linha 436): adicionar `await sleep(300)` antes do próximo job quando a impressora é a mesma do job anterior.
  - UI do diálogo de tempos de produção (~linha 1579+): adicionar o `Switch` novo abaixo do select da cozinha.
  - `handleSave` (~linha 1422): incluir `kitchen_always_full` no payload salvo.

Nenhuma migração de banco necessária — o campo entra no mesmo objeto JSON de preferências já persistido.