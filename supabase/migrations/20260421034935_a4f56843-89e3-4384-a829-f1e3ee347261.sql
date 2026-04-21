ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS lat double precision,
  ADD COLUMN IF NOT EXISTS lng double precision;

CREATE INDEX IF NOT EXISTS idx_stores_lat_lng ON public.stores (lat, lng);