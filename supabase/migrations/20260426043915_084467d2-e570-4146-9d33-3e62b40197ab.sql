ALTER TABLE public.store_coupons ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

DROP POLICY IF EXISTS "Store coupons are viewable by everyone" ON public.store_coupons;

CREATE POLICY "Active store coupons are viewable by everyone"
ON public.store_coupons
FOR SELECT
USING (is_active = true OR is_store_owner(auth.uid(), store_id) OR has_role(auth.uid(), 'admin'::app_role));