CREATE TABLE IF NOT EXISTS public.store_hours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  weekday smallint NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  opens_at time NOT NULL,
  closes_at time NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_store_hours_store_weekday
  ON public.store_hours(store_id, weekday);

ALTER TABLE public.store_hours ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Store hours viewable by everyone" ON public.store_hours;
CREATE POLICY "Store hours viewable by everyone"
  ON public.store_hours FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admins manage store_hours" ON public.store_hours;
CREATE POLICY "Admins manage store_hours"
  ON public.store_hours FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP TRIGGER IF EXISTS trg_store_hours_updated_at ON public.store_hours;
CREATE TRIGGER trg_store_hours_updated_at
  BEFORE UPDATE ON public.store_hours
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();