
-- club_waitlist: add SELECT policy + tighten INSERT
DROP POLICY IF EXISTS "Anyone can join waitlist" ON public.club_waitlist;

CREATE POLICY "Users can view own waitlist entry"
ON public.club_waitlist FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Anyone can join waitlist"
ON public.club_waitlist FOR INSERT
TO anon, authenticated
WITH CHECK (
  (auth.uid() IS NULL AND user_id IS NULL)
  OR (auth.uid() IS NOT NULL AND user_id = auth.uid())
);

-- store_feed_likes: restrict SELECT to authenticated users
DROP POLICY IF EXISTS "Likes viewable by everyone" ON public.store_feed_likes;

CREATE POLICY "Likes viewable by authenticated users"
ON public.store_feed_likes FOR SELECT
TO authenticated
USING (true);

-- store-feed storage: enforce ownership via path prefix = store_id
DROP POLICY IF EXISTS "Authenticated upload store-feed" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated update store-feed" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete store-feed" ON storage.objects;

CREATE POLICY "Store owners upload store-feed"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'store-feed'
  AND public.is_store_owner(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "Store owners update store-feed"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'store-feed'
  AND public.is_store_owner(auth.uid(), ((storage.foldername(name))[1])::uuid)
)
WITH CHECK (
  bucket_id = 'store-feed'
  AND public.is_store_owner(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "Store owners delete store-feed"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'store-feed'
  AND public.is_store_owner(auth.uid(), ((storage.foldername(name))[1])::uuid)
);
