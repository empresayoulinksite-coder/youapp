ALTER TABLE public.services
ADD COLUMN feed_category_id uuid NULL REFERENCES public.store_feed_categories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_services_feed_category_id ON public.services(feed_category_id);