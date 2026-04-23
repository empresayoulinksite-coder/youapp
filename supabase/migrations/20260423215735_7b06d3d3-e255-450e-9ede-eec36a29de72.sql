ALTER TABLE public.menu_categories
  ADD COLUMN IF NOT EXISTS available_days smallint[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS available_start time without time zone,
  ADD COLUMN IF NOT EXISTS available_end time without time zone;