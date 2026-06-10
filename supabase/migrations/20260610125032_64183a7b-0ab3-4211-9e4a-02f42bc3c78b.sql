DROP FUNCTION IF EXISTS public.get_my_subscriptions();

CREATE OR REPLACE FUNCTION public.get_my_subscriptions()
 RETURNS TABLE(subscription_id uuid, store_id uuid, store_name text, store_slug text, store_emoji text, store_image_url text, plan_id uuid, plan_name text, services_total integer, services_used integer, services_remaining integer, expires_at timestamp with time zone, status text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH me AS (
    SELECT auth.uid() AS uid,
           p.phone AS phone,
           p.email AS email
    FROM public.profiles p
    WHERE p.user_id = auth.uid()
  )
  SELECT cs.id,
         s.id, s.name, s.slug, s.emoji, s.image_url,
         cs.plan_id,
         COALESCE(sp.name, 'Plano'),
         cs.services_total,
         cs.services_used,
         (cs.services_total - cs.services_used)::int,
         cs.expires_at,
         cs.status
  FROM public.client_subscriptions cs
  JOIN public.stores s ON s.id = cs.store_id
  LEFT JOIN public.subscription_plans sp ON sp.id = cs.plan_id
  CROSS JOIN me
  WHERE auth.uid() IS NOT NULL
    AND (
      cs.customer_user_id = me.uid
      OR (cs.customer_email IS NOT NULL AND me.email IS NOT NULL
          AND lower(cs.customer_email) = lower(me.email))
      OR (cs.customer_phone IS NOT NULL AND me.phone IS NOT NULL
          AND public.normalize_phone(cs.customer_phone) = public.normalize_phone(me.phone))
    )
  ORDER BY (cs.status = 'active') DESC, cs.expires_at DESC;
$function$;

REVOKE ALL ON FUNCTION public.get_my_subscriptions() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_subscriptions() TO authenticated;