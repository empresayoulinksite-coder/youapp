-- 1. Set search_path on normalize_phone
ALTER FUNCTION public.normalize_phone(text) SET search_path = public;

-- 2. Allow admins to read club waitlist entries
CREATE POLICY "Admins view all waitlist"
ON public.club_waitlist
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 3. Replace broad profile policy with a column-restricted RPC for store team
DROP POLICY IF EXISTS "Store team views customer profiles via orders" ON public.profiles;

CREATE OR REPLACE FUNCTION public.get_order_customers_basic(p_user_ids uuid[])
RETURNS TABLE(user_id uuid, display_name text, phone text, email text, avatar_url text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.user_id, p.display_name, p.phone, p.email, p.avatar_url
  FROM public.profiles p
  WHERE p.user_id = ANY(p_user_ids)
    AND EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.user_id = p.user_id
        AND public.can_manage_store_orders(auth.uid(), o.store_id)
    );
$$;

REVOKE EXECUTE ON FUNCTION public.get_order_customers_basic(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_order_customers_basic(uuid[]) TO authenticated;

-- 4. Prevent waiter PIN hash from being readable by clients via column-level grants
REVOKE SELECT ON public.store_waiters FROM authenticated, anon;
GRANT SELECT (id, store_id, full_name, is_active, created_at, updated_at)
  ON public.store_waiters TO authenticated;