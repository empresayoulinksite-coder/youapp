ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS sizes text[] NOT NULL DEFAULT '{}'::text[];
ALTER TABLE public.cart_items ADD COLUMN IF NOT EXISTS selected_size text;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS selected_size text;