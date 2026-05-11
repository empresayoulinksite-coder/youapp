# Trocar a logo da home pela imagem do baú Youlink

Substituir a logo atual (`src/assets/youlink-logo.png`) pela nova imagem do baú dourado/roxo com "Youlink.site" enviada agora.

## Passos

1. Copiar `user-uploads://Youlink_7.png` para `src/assets/youlink-logo.png` (sobrescrever).
2. Manter o import e o `<img>` em `src/routes/index.tsx` (linha ~277) exatamente como está — só o arquivo muda.
3. Verificar no preview que a nova logo aparece corretamente no topo da home.

## Observação

A imagem nova tem proporção horizontal (mais larga que a logo atual). O `<img>` atual usa classes de tamanho fixas — pode ser que ela apareça um pouco diferente em altura/largura. Se ficar estranha, ajusto o tamanho depois.

## Não muda

- Posição da logo na home.
- Nenhum outro elemento da página.
- Meta tags sociais (og:image continua a antiga até você pedir).
