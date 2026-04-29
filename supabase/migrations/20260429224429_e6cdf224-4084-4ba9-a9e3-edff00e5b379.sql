-- 1) Lock down profiles SELECT to prevent public PII exposure
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;

-- Self
CREATE POLICY "Users view their own profile"
ON public.profiles FOR SELECT
USING (auth.uid() = user_id);

-- Admin
CREATE POLICY "Admins view all profiles"
ON public.profiles FOR SELECT
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Store owners/staff can view profiles of customers who ordered or booked at their store
CREATE POLICY "Store team views customer profiles via orders"
ON public.profiles FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.user_id = profiles.user_id
      AND public.can_manage_store_orders(auth.uid(), o.store_id)
  )
);

CREATE POLICY "Store owners view customer profiles via bookings"
ON public.profiles FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE b.user_id = profiles.user_id
      AND public.is_store_owner(auth.uid(), b.store_id)
  )
);

-- 2) Constrain review content length to prevent unbounded writes
ALTER TABLE public.store_reviews
  ADD CONSTRAINT store_reviews_comment_length_chk
    CHECK (comment IS NULL OR char_length(comment) <= 1000),
  ADD CONSTRAINT store_reviews_author_name_length_chk
    CHECK (char_length(author_name) <= 100);