
-- 1) store_staff: funcionários por loja
CREATE TABLE IF NOT EXISTS public.store_staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL,
  user_id uuid NOT NULL,
  display_name text,
  role text NOT NULL DEFAULT 'attendant',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_store_staff_store ON public.store_staff(store_id);
CREATE INDEX IF NOT EXISTS idx_store_staff_user ON public.store_staff(user_id);

ALTER TABLE public.store_staff ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER store_staff_set_updated_at
BEFORE UPDATE ON public.store_staff
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Funções auxiliares
CREATE OR REPLACE FUNCTION public.is_store_staff(_user_id uuid, _store_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.store_staff
    WHERE user_id = _user_id
      AND store_id = _store_id
      AND is_active = true
  )
$$;

CREATE OR REPLACE FUNCTION public.can_manage_store_orders(_user_id uuid, _store_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_store_owner(_user_id, _store_id)
    OR public.is_store_staff(_user_id, _store_id)
    OR public.has_role(_user_id, 'admin'::app_role)
$$;

-- 3) RLS de store_staff
CREATE POLICY "Admins manage store_staff"
ON public.store_staff
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Store owners manage their store_staff"
ON public.store_staff
FOR ALL
USING (is_store_owner(auth.uid(), store_id))
WITH CHECK (is_store_owner(auth.uid(), store_id));

CREATE POLICY "Staff can view their own staff row"
ON public.store_staff
FOR SELECT
USING (auth.uid() = user_id);

-- 4) Atualizar policies de orders para incluir staff
DROP POLICY IF EXISTS "Store owners view their store orders" ON public.orders;
DROP POLICY IF EXISTS "Store owners update their store orders" ON public.orders;

CREATE POLICY "Store team views their store orders"
ON public.orders
FOR SELECT
USING (can_manage_store_orders(auth.uid(), store_id));

CREATE POLICY "Store team updates their store orders"
ON public.orders
FOR UPDATE
USING (can_manage_store_orders(auth.uid(), store_id))
WITH CHECK (can_manage_store_orders(auth.uid(), store_id));

-- 5) order_items: ampliar visualização para staff
DROP POLICY IF EXISTS "Users view their order items" ON public.order_items;

CREATE POLICY "Users and store team view order items"
ON public.order_items
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_items.order_id
      AND (
        o.user_id = auth.uid()
        OR can_manage_store_orders(auth.uid(), o.store_id)
      )
  )
);

-- 6) Padronizar status (default já existia como 'sent' — mudar para 'em_analise')
ALTER TABLE public.orders ALTER COLUMN status SET DEFAULT 'em_analise';

-- Mapear valores antigos para o novo fluxo
UPDATE public.orders SET status = 'em_analise'
WHERE status IN ('sent', 'pending', 'novo', 'new');

-- 7) Realtime em orders
ALTER TABLE public.orders REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
