CREATE OR REPLACE FUNCTION public.set_order_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NEW.order_number IS NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext(NEW.store_id::text));
    SELECT COALESCE(MAX(order_number), 0) + 1
      INTO NEW.order_number
      FROM public.orders
      WHERE store_id = NEW.store_id;
  END IF;
  RETURN NEW;
END;
$function$;

-- Renumber the 3 most recent orders that incorrectly got #1
WITH ranked AS (
  SELECT id,
         row_number() OVER (PARTITION BY store_id ORDER BY created_at) AS rn,
         store_id
  FROM public.orders
  WHERE order_number = 1
    AND created_at > now() - interval '1 day'
), maxes AS (
  SELECT store_id, COALESCE(MAX(order_number), 0) AS max_num
  FROM public.orders
  WHERE order_number > 1
  GROUP BY store_id
)
UPDATE public.orders o
SET order_number = m.max_num + r.rn
FROM ranked r
JOIN maxes m ON m.store_id = r.store_id
WHERE o.id = r.id;