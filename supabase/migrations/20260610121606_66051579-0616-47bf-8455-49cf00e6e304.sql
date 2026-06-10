CREATE OR REPLACE FUNCTION public.apply_subscription_on_booking_complete()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  sub_id uuid;
  v_phone text;
  v_email text;
  new_remaining int;
  store_name text;
  store_emoji text;
  store_image text;
  store_slug text;
BEGIN
  IF NEW.status <> 'completed' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'completed' THEN
    RETURN NEW;
  END IF;
  IF NEW.subscription_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT p.phone, p.email INTO v_phone, v_email
  FROM public.profiles p WHERE p.user_id = NEW.user_id;

  SELECT cs.id INTO sub_id
  FROM public.client_subscriptions cs
  WHERE cs.store_id = NEW.store_id
    AND cs.status = 'active'
    AND cs.expires_at > now()
    AND cs.services_used < cs.services_total
    AND (
      cs.customer_user_id = NEW.user_id
      OR (v_phone IS NOT NULL AND cs.customer_phone IS NOT NULL
          AND public.normalize_phone(cs.customer_phone) = public.normalize_phone(v_phone))
      OR (v_email IS NOT NULL AND cs.customer_email IS NOT NULL
          AND lower(cs.customer_email) = lower(v_email))
    )
    AND (
      cs.plan_id IS NULL
      OR NOT EXISTS (SELECT 1 FROM public.subscription_plan_services sps WHERE sps.plan_id = cs.plan_id)
      OR EXISTS (SELECT 1 FROM public.subscription_plan_services sps WHERE sps.plan_id = cs.plan_id AND sps.service_id = NEW.service_id)
    )
  ORDER BY cs.expires_at ASC
  LIMIT 1;

  IF sub_id IS NOT NULL THEN
    NEW.subscription_id := sub_id;
    UPDATE public.client_subscriptions
       SET services_used = services_used + 1,
           status = CASE WHEN services_used + 1 >= services_total THEN 'expired' ELSE status END,
           updated_at = now()
     WHERE id = sub_id
     RETURNING (services_total - services_used) INTO new_remaining;

    IF NEW.user_id IS NOT NULL AND new_remaining <= 1 THEN
      SELECT name, emoji, image_url, slug
        INTO store_name, store_emoji, store_image, store_slug
      FROM public.stores WHERE id = NEW.store_id;

      INSERT INTO public.notifications (user_id, type, title, body, link, emoji, image_url, store_id)
      VALUES (
        NEW.user_id,
        'subscription_low',
        COALESCE(store_name, 'Sua assinatura'),
        CASE WHEN new_remaining <= 0
          THEN 'Sua assinatura acabou. Procure o estabelecimento para renovar.'
          ELSE 'Está acabando! Resta 1 serviço na sua assinatura. Renove no estabelecimento.'
        END,
        '/agendamentos',
        store_emoji,
        store_image,
        NEW.store_id
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;