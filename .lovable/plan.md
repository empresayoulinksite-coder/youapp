## Causa do problema

A função do trigger `set_order_number` (BEFORE INSERT em `public.orders`) faz:

```sql
SELECT COALESCE(MAX(order_number), 0) + 1
FROM public.orders
WHERE store_id = NEW.store_id;
```

Mas a função **não é `SECURITY DEFINER`**, então roda como o usuário que está inserindo (o cliente final). As políticas de RLS de `orders` só permitem ao cliente ver os pedidos dele mesmo:

- `Users view their own orders` → `auth.uid() = user_id`

Resultado: o `MAX(order_number)` que o trigger calcula só enxerga os pedidos daquele cliente naquela loja. Para um cliente novo (ou que nunca pediu naquela loja), o `MAX` é 0 e o pedido vira **#1**. Foi exatamente isso que aconteceu: três clientes diferentes pediram quase ao mesmo tempo e cada um recebeu #1, enquanto pedidos anteriores da loja já estavam em #44.

O `pg_advisory_xact_lock` existente protege contra concorrência, mas não resolve nada se a query já está enxergando dados errados por causa de RLS.

## Correção

Recriar `public.set_order_number` como `SECURITY DEFINER` com `search_path = public`, mantendo o advisory lock por loja. Assim o trigger enxerga todos os pedidos da loja, independentemente do usuário, e gera o próximo número correto de forma atômica.

Mudança via migration:

```sql
CREATE OR REPLACE FUNCTION public.set_order_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.order_number IS NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext(NEW.store_id::text));
    SELECT COALESCE(MAX(order_number), 0) + 1
      INTO NEW.order_number
      FROM public.orders
      WHERE store_id = NEW.store_id;
  END IF;
  RETURN NEW;
END;
$$;
```

Opcional: renumerar os 3 pedidos que ficaram como #1 hoje, atribuindo 45, 46, 47 pela ordem de `created_at`, para limpar o histórico exibido no painel.

## Validação

- Inserir pedidos concorrentes de usuários diferentes na mesma loja e confirmar que recebem números sequenciais.
- Conferir o painel: novos pedidos devem aparecer como #45, #46, #47 etc.

Nenhuma mudança em código de frontend é necessária — o problema é 100% no banco.