-- Categorias do feed (reutilizáveis por loja)
CREATE TABLE public.store_feed_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_store_feed_categories_store ON public.store_feed_categories(store_id);

ALTER TABLE public.store_feed_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Feed categories viewable by everyone"
ON public.store_feed_categories FOR SELECT USING (true);

CREATE POLICY "Store owners manage their feed categories"
ON public.store_feed_categories FOR ALL
USING (public.is_store_owner(auth.uid(), store_id))
WITH CHECK (public.is_store_owner(auth.uid(), store_id));

CREATE POLICY "Admins manage feed categories"
ON public.store_feed_categories FOR ALL
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_store_feed_categories_updated_at
BEFORE UPDATE ON public.store_feed_categories
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Vincular post a uma categoria e marcar se mostra botão "ver serviços"
ALTER TABLE public.store_feed_posts
  ADD COLUMN category_id UUID REFERENCES public.store_feed_categories(id) ON DELETE SET NULL,
  ADD COLUMN show_services_cta BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX idx_store_feed_posts_category ON public.store_feed_posts(category_id);