-- Toggle no nível da loja para habilitar o feed
ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS feed_enabled boolean NOT NULL DEFAULT false;

-- Bucket público para mídias do feed
INSERT INTO storage.buckets (id, name, public)
VALUES ('store-feed', 'store-feed', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas de storage para o bucket store-feed
CREATE POLICY "Public read store-feed"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'store-feed');

CREATE POLICY "Authenticated upload store-feed"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'store-feed');

CREATE POLICY "Authenticated update store-feed"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'store-feed');

CREATE POLICY "Authenticated delete store-feed"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'store-feed');

-- Tabela de posts do feed
CREATE TABLE public.store_feed_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  caption text NOT NULL DEFAULT '',
  image_urls text[] NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  position integer NOT NULL DEFAULT 0,
  likes_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_store_feed_posts_store ON public.store_feed_posts(store_id, created_at DESC);

ALTER TABLE public.store_feed_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Feed posts viewable when active and feed enabled"
  ON public.store_feed_posts FOR SELECT
  USING (
    is_active = true
    AND EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_feed_posts.store_id AND s.feed_enabled = true)
  );

CREATE POLICY "Admins manage feed posts"
  ON public.store_feed_posts FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Store owners view their feed posts"
  ON public.store_feed_posts FOR SELECT
  USING (is_store_owner(auth.uid(), store_id));

CREATE POLICY "Store owners manage their feed posts"
  ON public.store_feed_posts FOR ALL
  USING (is_store_owner(auth.uid(), store_id))
  WITH CHECK (is_store_owner(auth.uid(), store_id));

CREATE TRIGGER update_store_feed_posts_updated_at
  BEFORE UPDATE ON public.store_feed_posts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Tabela de curtidas
CREATE TABLE public.store_feed_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.store_feed_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id)
);

CREATE INDEX idx_store_feed_likes_user ON public.store_feed_likes(user_id);

ALTER TABLE public.store_feed_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Likes viewable by everyone"
  ON public.store_feed_likes FOR SELECT USING (true);

CREATE POLICY "Users like posts"
  ON public.store_feed_likes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users unlike own"
  ON public.store_feed_likes FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Tabela de favoritos de posts (separada de favoritos de loja)
CREATE TABLE public.store_feed_favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.store_feed_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id)
);

CREATE INDEX idx_store_feed_favorites_user ON public.store_feed_favorites(user_id);

ALTER TABLE public.store_feed_favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own post favorites"
  ON public.store_feed_favorites FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users favorite posts"
  ON public.store_feed_favorites FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users unfavorite own"
  ON public.store_feed_favorites FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Triggers para manter likes_count
CREATE OR REPLACE FUNCTION public.increment_post_likes()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  UPDATE public.store_feed_posts SET likes_count = likes_count + 1 WHERE id = NEW.post_id;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.decrement_post_likes()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  UPDATE public.store_feed_posts SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = OLD.post_id;
  RETURN OLD;
END;
$$;

CREATE TRIGGER trg_inc_post_likes
  AFTER INSERT ON public.store_feed_likes
  FOR EACH ROW EXECUTE FUNCTION public.increment_post_likes();

CREATE TRIGGER trg_dec_post_likes
  AFTER DELETE ON public.store_feed_likes
  FOR EACH ROW EXECUTE FUNCTION public.decrement_post_likes();