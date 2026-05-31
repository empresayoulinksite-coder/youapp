## Problema

No campo **Telefone** de `/completar-cadastro`, o usuário não consegue apagar o traço final da máscara (ex.: `(13) 9916-`). Ao pressionar backspace, a função `maskPhone` reaplica o traço porque mantém o `-` mesmo quando não há dígito após ele.

## Causa

Em `src/routes/completar-cadastro.tsx` (linhas 50–54), `maskPhone` formata com `($1) $2-$3` e faz `.trim()`, mas **não remove o `-` quando o terceiro grupo está vazio**. Comparando com `maskPhoneInput` de `src/components/CheckoutReviewDialog.tsx` (que já faz `.replace(/-$/, "")`), o checkout funciona corretamente — apenas o cadastro tem o bug.

## Correção

Ajustar `maskPhone` em `src/routes/completar-cadastro.tsx` para remover o traço final quando não houver dígitos depois dele:

```ts
const maskPhone = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 10)
    return d.replace(/(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3").trim().replace(/-$/, "");
  return d.replace(/(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3").trim().replace(/-$/, "");
};
```

Nenhuma outra mudança é necessária — sem alterações de schema, validação ou layout.

## Arquivos afetados

- `src/routes/completar-cadastro.tsx` (apenas a função `maskPhone`)
