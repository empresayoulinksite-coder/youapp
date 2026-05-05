CREATE POLICY "Store owners delete their store bookings"
ON public.bookings
FOR DELETE
TO authenticated
USING (is_store_owner(auth.uid(), store_id));