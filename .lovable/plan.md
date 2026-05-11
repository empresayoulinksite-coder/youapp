## Mudar a luz roxa atrás da logo no carregamento para dourado

A luz roxa que você vê é o brilho atrás da logo na tela de carregamento (`src/components/ProfileGate.tsx`). Hoje ela usa `bg-primary/20` (a cor primária roxa do tema).

### Mudança

- Trocar `bg-primary/20` por um dourado equivalente ao baú (algo como `#F5B72A` / âmbar) com opacidade ~30% e blur, mantendo o `animate-pulse`.
- Os 3 pontinhos de loading abaixo continuam roxos (mantêm a identidade Youlink). Se preferir dourados também, é só avisar.

### Arquivos alterados

- `src/components/ProfileGate.tsx` (linha 66) — troca da classe do glow.