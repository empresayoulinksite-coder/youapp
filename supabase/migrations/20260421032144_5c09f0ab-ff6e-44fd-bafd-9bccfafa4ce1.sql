
-- 1. Tabela de donos de loja
CREATE TABLE IF NOT EXISTS public.store_owners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_store_owners_user ON public.store_owners(user_id);
CREATE INDEX IF NOT EXISTS idx_store_owners_store ON public.store_owners(store_id);

ALTER TABLE public.store_owners ENABLE ROW LEVEL SECURITY;

-- Função security definer (evita recursão de RLS)
CREATE OR REPLACE FUNCTION public.is_store_owner(_user_id uuid, _store_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.store_owners
    WHERE user_id = _user_id AND store_id = _store_id
  )
$$;

-- Policies para store_owners
CREATE POLICY "Admins manage store_owners"
ON public.store_owners FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view their own store_owner rows"
ON public.store_owners FOR SELECT
USING (auth.uid() = user_id);

-- 2. RLS bookings: dono pode ver e atualizar agendamentos da sua loja
CREATE POLICY "Store owners view their store bookings"
ON public.bookings FOR SELECT
USING (public.is_store_owner(auth.uid(), store_id));

CREATE POLICY "Store owners update their store bookings"
ON public.bookings FOR UPDATE
USING (public.is_store_owner(auth.uid(), store_id))
WITH CHECK (public.is_store_owner(auth.uid(), store_id));

-- 3. RLS services: dono gerencia serviços da sua loja
CREATE POLICY "Store owners manage their services"
ON public.services FOR ALL
USING (public.is_store_owner(auth.uid(), store_id))
WITH CHECK (public.is_store_owner(auth.uid(), store_id));

-- 4. RLS store_hours: dono gerencia horários da sua loja
CREATE POLICY "Store owners manage their store_hours"
ON public.store_hours FOR ALL
USING (public.is_store_owner(auth.uid(), store_id))
WITH CHECK (public.is_store_owner(auth.uid(), store_id));

-- 5. RLS stores: dono pode atualizar campos da sua loja (ex: pausar, whatsapp)
CREATE POLICY "Store owners update their store"
ON public.stores FOR UPDATE
USING (public.is_store_owner(auth.uid(), id))
WITH CHECK (public.is_store_owner(auth.uid(), id));
