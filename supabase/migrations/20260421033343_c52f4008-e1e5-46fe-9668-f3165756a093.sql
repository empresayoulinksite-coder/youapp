-- Permitir que donos da loja gerenciem seus próprios cupons
CREATE POLICY "Store owners manage their store_coupons"
ON public.store_coupons
FOR ALL
USING (public.is_store_owner(auth.uid(), store_id))
WITH CHECK (public.is_store_owner(auth.uid(), store_id));