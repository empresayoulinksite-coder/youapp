Corrigir "modo mesa" persistindo entre visitas

## Problema

Quando o cliente lê o QR Code da mesa, salvamos `youapp_mesa` e `youapp_mesa_store` no `sessionStorage` do navegador. Esses valores só somem quando:

- O pedido é finalizado, **ou**
- A aba/janela do navegador é fechada.

No celular, a aba quase nunca é fechada. Resultado: dias depois, o cliente abre a loja para pedir delivery e o checkout ainda acha que ele está sentado na mesa.

## Solução

Dar um **prazo de validade curto** para o modo mesa e revalidar sempre que o cliente entra na loja.

### Regras

1. Quando o QR Code é lido (`?mesa=N` na URL da loja), salvar também um **timestamp** junto: `youapp_mesa_ts` = `Date.now()`.
2. Definir validade de **3 horas** (tempo razoável para uma refeição). Após esse tempo, o modo mesa é descartado automaticamente.
3. Na sacola, ao detectar o modo mesa, verificar se o timestamp ainda é válido. Se estiver expirado, limpar o `sessionStorage` e voltar para `delivery`.
4. Na página da loja (`loja.$slug.tsx`), se o cliente entrar **sem** `?mesa` na URL e já houver um modo mesa salvo expirado para essa loja, limpar também — assim ele não vê nada relacionado a mesa indevidamente.

### Arquivos a alterar

- `**src/routes/loja.$slug.tsx**` (efeito que captura `?mesa` da URL): salvar `youapp_mesa_ts` junto. Se entrar sem `?mesa`, checar se o mesa salvo expirou e limpar.
- `**src/routes/sacola.tsx**` (efeito que detecta mesa via `sessionStorage`): ler o timestamp, comparar com `Date.now()`, e se passou de 3h, limpar tudo e ficar em `delivery`.

### Constante compartilhada

Definir `MESA_TTL_MS = 3 * 60 * 60 * 1000` (3 horas) nos dois arquivos (ou criar `src/lib/mesa-session.ts` com helpers `setMesaSession`, `getMesaSession`, `clearMesaSession`). Recomendado o helper, fica mais limpo e evita duplicação de lógica.

## Não muda

- Comportamento do botão "Confirmar pedido" no modo mesa (mantido como está).
- Fluxo de QR Code novo: continua funcionando igual, só passa a ter validade.
- Limpeza após pedido finalizado: continua igual.

## Pergunta

O prazo de **3 horas** está bom, ou prefere outro valor (ex: 2h, 6h, "até meia-noite")?