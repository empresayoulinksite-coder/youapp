CREATE OR REPLACE FUNCTION public.notify_store_new_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, title, body, link, emoji, image_url, order_id, store_id)
  SELECT DISTINCT recipient.user_id,
    'store_new_order',
    NEW.store_name,
    'Novo pedido #' || COALESCE(NEW.order_number::text, '—') || ' recebido',
    '/pedidos-loja/' || NEW.store_id::text,
    NEW.store_emoji,
    NEW.store_image_url,
    NEW.id,
    NEW.store_id
  FROM (
    SELECT so.user_id
    FROM public.store_owners so
    WHERE so.store_id = NEW.store_id

    UNION

    SELECT ss.user_id
    FROM public.store_staff ss
    WHERE ss.store_id = NEW.store_id
      AND ss.is_active = true
  ) AS recipient
  WHERE recipient.user_id IS NOT NULL;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_store_new_order ON public.orders;
CREATE TRIGGER trg_notify_store_new_order
AFTER INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.notify_store_new_order();