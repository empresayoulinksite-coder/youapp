-- 1. Add helper columns to orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS order_number bigint,
  ADD COLUMN IF NOT EXISTS accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS ready_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivery_type text NOT NULL DEFAULT 'delivery';

-- 2. Per-store sequential order_number
CREATE OR REPLACE FUNCTION public.set_order_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.order_number IS NULL THEN
    SELECT COALESCE(MAX(order_number), 0) + 1
      INTO NEW.order_number
      FROM public.orders
      WHERE store_id = NEW.store_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_order_number ON public.orders;
CREATE TRIGGER trg_set_order_number
  BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.set_order_number();

-- Backfill existing rows
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY store_id ORDER BY created_at) AS n
  FROM public.orders
  WHERE order_number IS NULL
)
UPDATE public.orders o
   SET order_number = numbered.n
  FROM numbered
 WHERE o.id = numbered.id;

CREATE UNIQUE INDEX IF NOT EXISTS orders_store_number_idx
  ON public.orders (store_id, order_number);

-- 3. Auto-stamp lifecycle timestamps from status changes
CREATE OR REPLACE FUNCTION public.stamp_order_status_times()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'em_producao' AND NEW.accepted_at IS NULL THEN
      NEW.accepted_at := now();
    END IF;
    IF NEW.status = 'pronto' AND NEW.ready_at IS NULL THEN
      NEW.ready_at := now();
    END IF;
    IF NEW.status = 'entregue' AND NEW.delivered_at IS NULL THEN
      NEW.delivered_at := now();
    END IF;
    IF NEW.status = 'cancelado' AND NEW.cancelled_at IS NULL THEN
      NEW.cancelled_at := now();
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'em_producao' AND NEW.accepted_at IS NULL THEN
      NEW.accepted_at := now();
    END IF;
    IF NEW.status = 'pronto' AND NEW.ready_at IS NULL THEN
      NEW.ready_at := now();
    END IF;
    IF NEW.status = 'entregue' AND NEW.delivered_at IS NULL THEN
      NEW.delivered_at := now();
    END IF;
    IF NEW.status = 'cancelado' AND NEW.cancelled_at IS NULL THEN
      NEW.cancelled_at := now();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_stamp_order_status_times ON public.orders;
CREATE TRIGGER trg_stamp_order_status_times
  BEFORE INSERT OR UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.stamp_order_status_times();

-- 4. Realtime
ALTER TABLE public.orders REPLICA IDENTITY FULL;
ALTER TABLE public.order_items REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
     WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'orders'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.orders';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
     WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'order_items'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.order_items';
  END IF;
END $$;