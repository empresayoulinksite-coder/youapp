ALTER TABLE public.services
ADD COLUMN IF NOT EXISTS promo_prices jsonb NOT NULL DEFAULT '[]'::jsonb;