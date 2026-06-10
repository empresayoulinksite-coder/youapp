REVOKE EXECUTE ON FUNCTION public.get_my_subscriptions() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_subscriptions() TO authenticated;