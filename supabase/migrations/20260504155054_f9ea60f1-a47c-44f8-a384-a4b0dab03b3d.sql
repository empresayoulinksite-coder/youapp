CREATE OR REPLACE FUNCTION public.set_order_number()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.order_number IS NULL THEN
    -- Use advisory lock per store to prevent race conditions
    PERFORM pg_advisory_xact_lock(hashtext(NEW.store_id::text));
    SELECT COALESCE(MAX(order_number), 0) + 1
      INTO NEW.order_number
      FROM public.orders
      WHERE store_id = NEW.store_id;
  END IF;
  RETURN NEW;
END;
$$;