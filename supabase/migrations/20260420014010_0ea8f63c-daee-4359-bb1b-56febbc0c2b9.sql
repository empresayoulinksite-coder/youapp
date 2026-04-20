ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS neighborhood TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT;

CREATE INDEX IF NOT EXISTS idx_stores_city ON public.stores (city);
CREATE INDEX IF NOT EXISTS idx_stores_neighborhood ON public.stores (neighborhood);