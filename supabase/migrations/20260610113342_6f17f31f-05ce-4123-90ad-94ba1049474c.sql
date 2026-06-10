
-- 1) Profiles: drop broad SELECT via bookings; provide safe RPC for booking customer contact info
DROP POLICY IF EXISTS "Store owners view customer profiles via bookings" ON public.profiles;

CREATE OR REPLACE FUNCTION public.get_booking_customers(_store_id uuid)
RETURNS TABLE (user_id uuid, display_name text, phone text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.user_id, p.display_name, p.phone
  FROM public.profiles p
  WHERE public.can_manage_store_orders(auth.uid(), _store_id)
    AND EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.store_id = _store_id AND b.user_id = p.user_id
    );
$$;

REVOKE ALL ON FUNCTION public.get_booking_customers(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_booking_customers(uuid) TO authenticated, service_role;

-- 2) store_feed_likes: only own likes are readable
DROP POLICY IF EXISTS "Likes viewable by authenticated users" ON public.store_feed_likes;
CREATE POLICY "Users view own likes"
ON public.store_feed_likes
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- 3) store_waiters: hide pin column from clients via column-level grants
REVOKE SELECT ON public.store_waiters FROM authenticated, anon;
GRANT SELECT (id, store_id, full_name, is_active, created_at, updated_at)
  ON public.store_waiters TO authenticated;
GRANT ALL ON public.store_waiters TO service_role;

-- 4) Storage policies for store-reels bucket, scoped to store owners by storeId prefix
DROP POLICY IF EXISTS "Store owners upload reel media" ON storage.objects;
DROP POLICY IF EXISTS "Store owners update reel media" ON storage.objects;
DROP POLICY IF EXISTS "Store owners delete reel media" ON storage.objects;

CREATE POLICY "Store owners upload reel media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'store-reels'
  AND public.is_store_owner(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "Store owners update reel media"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'store-reels'
  AND public.is_store_owner(auth.uid(), ((storage.foldername(name))[1])::uuid)
)
WITH CHECK (
  bucket_id = 'store-reels'
  AND public.is_store_owner(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "Store owners delete reel media"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'store-reels'
  AND public.is_store_owner(auth.uid(), ((storage.foldername(name))[1])::uuid)
);
