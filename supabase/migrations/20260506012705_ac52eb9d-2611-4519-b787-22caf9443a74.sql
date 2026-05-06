
CREATE TABLE public.store_delivery_areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  neighborhood TEXT NOT NULL,
  fee NUMERIC(10,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(store_id, neighborhood)
);

ALTER TABLE public.store_delivery_areas ENABLE ROW LEVEL SECURITY;

-- Public read for checkout
CREATE POLICY "Delivery areas viewable by everyone"
ON public.store_delivery_areas
FOR SELECT
USING (true);

-- Store owners manage
CREATE POLICY "Store owners manage their delivery areas"
ON public.store_delivery_areas
FOR ALL
USING (is_store_owner(auth.uid(), store_id))
WITH CHECK (is_store_owner(auth.uid(), store_id));

-- Admins manage
CREATE POLICY "Admins manage delivery areas"
ON public.store_delivery_areas
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_delivery_areas_store ON public.store_delivery_areas(store_id);
