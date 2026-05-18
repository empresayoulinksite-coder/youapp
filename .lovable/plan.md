## Problema

Na tela do PDV, a faixa de categorias ("Todos", "Pizzas Salgadas/Doces", "Esfiha 1 Sabor"...) está rolável horizontalmente, mas a barra de rolagem está **oculta** (`no-scrollbar`). Em telas menores, você não enxerga que existem mais categorias à direita nem consegue arrastar com facilidade no desktop.

## Correção

Em `src/components/painel/PDVManager.tsx`, linha 366:

- Remover a classe `no-scrollbar` do container das categorias.
- Adicionar uma classe utilitária nova `thin-scrollbar` em `src/styles.css` que mostra uma barrinha fina e discreta (uns 6px de altura, cor `--border`, cantos arredondados) apenas no eixo horizontal.

Resultado: aparece uma barrinha fininha embaixo das categorias que você pode arrastar para o lado para ver as demais (Esfihas Especiais etc.), sem ficar visualmente pesada.

Nenhuma outra mudança — só CSS + uma troca de classe.