
-- Migração para corrigir permissões de visualização de pedidos para equipe da loja

-- 1. Garantir que a função can_manage_store_orders existe e está correta
-- Esta função deve retornar true se o usuário for dono da loja OU se for staff da loja.
CREATE OR REPLACE FUNCTION public.can_manage_store_orders(_user_id uuid, _store_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verifica se é dono da loja
  IF EXISTS (SELECT 1 FROM public.store_owners WHERE user_id = _user_id AND store_id = _store_id) THEN
    RETURN TRUE;
  END IF;

  -- Verifica se é staff da loja (se a tabela existir)
  -- Nota: Usamos um bloco dinâmico ou checagem simples se soubermos que a tabela existe
  -- Com base no types.ts, a tabela store_staff existe.
  IF EXISTS (
    SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'store_staff'
  ) THEN
    RETURN EXISTS (
      SELECT 1 FROM public.store_staff 
      WHERE user_id = _user_id AND store_id = _store_id
    );
  END IF;

  RETURN FALSE;
END;
$$;

-- 2. Atualizar políticas da tabela public.orders
DROP POLICY IF EXISTS "Store owners view their store orders" ON public.orders;
CREATE POLICY "Store team view their store orders"
  ON public.orders FOR SELECT
  USING (public.can_manage_store_orders(auth.uid(), store_id));

DROP POLICY IF EXISTS "Store owners update their store orders" ON public.orders;
CREATE POLICY "Store team update their store orders"
  ON public.orders FOR UPDATE
  USING (public.can_manage_store_orders(auth.uid(), store_id))
  WITH CHECK (public.can_manage_store_orders(auth.uid(), store_id));

-- 3. Atualizar políticas da tabela public.order_items
DROP POLICY IF EXISTS "Users view their order items" ON public.order_items;
CREATE POLICY "Users and Store team view order items"
  ON public.order_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id
        AND (
          o.user_id = auth.uid()
          OR public.can_manage_store_orders(auth.uid(), o.store_id)
          OR public.has_role(auth.uid(), 'admin')
        )
    )
  );
