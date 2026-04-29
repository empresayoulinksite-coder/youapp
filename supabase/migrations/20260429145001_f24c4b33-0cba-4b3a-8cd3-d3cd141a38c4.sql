-- Tabela de notificações para clientes
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  type TEXT NOT NULL, -- 'order_status' | 'feed_post' | 'reel'
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  emoji TEXT,
  image_url TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  order_id UUID,
  store_id UUID,
  post_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user_created ON public.notifications(user_id, created_at DESC);
CREATE INDEX idx_notifications_user_unread ON public.notifications(user_id) WHERE is_read = false;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view their notifications"
ON public.notifications FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users update their notifications"
ON public.notifications FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete their notifications"
ON public.notifications FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "Admins manage notifications"
ON public.notifications FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

-- Trigger: notificar cliente quando status do pedido muda
CREATE OR REPLACE FUNCTION public.notify_order_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  status_label TEXT;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    status_label := CASE NEW.status
      WHEN 'em_analise' THEN 'Em análise'
      WHEN 'em_producao' THEN 'Em produção 👨‍🍳'
      WHEN 'pronto' THEN 'Pronto 🛵'
      WHEN 'entregue' THEN 'Entregue ✅'
      WHEN 'cancelado' THEN 'Cancelado'
      ELSE NEW.status
    END;

    INSERT INTO public.notifications (user_id, type, title, body, link, emoji, image_url, order_id, store_id)
    VALUES (
      NEW.user_id,
      'order_status',
      NEW.store_name,
      'Seu pedido agora está: ' || status_label,
      '/pedidos',
      NEW.store_emoji,
      NEW.store_image_url,
      NEW.id,
      NEW.store_id
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_order_status_change
AFTER UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.notify_order_status_change();

-- Trigger: notificar quem favoritou a loja sobre novo post no feed
CREATE OR REPLACE FUNCTION public.notify_new_feed_post()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s RECORD;
  preview TEXT;
BEGIN
  IF NEW.is_active = false THEN
    RETURN NEW;
  END IF;

  SELECT name, emoji, image_url, slug, feed_enabled
  INTO s
  FROM public.stores
  WHERE id = NEW.store_id;

  IF NOT FOUND OR s.feed_enabled = false THEN
    RETURN NEW;
  END IF;

  preview := COALESCE(NULLIF(NEW.caption, ''), 'Publicou uma novidade no feed');
  IF length(preview) > 120 THEN
    preview := substring(preview, 1, 117) || '...';
  END IF;

  INSERT INTO public.notifications (user_id, type, title, body, link, emoji, image_url, store_id, post_id)
  SELECT
    f.user_id,
    'feed_post',
    s.name,
    preview,
    '/loja/' || s.slug,
    s.emoji,
    COALESCE((NEW.image_urls)[1], s.image_url),
    NEW.store_id,
    NEW.id
  FROM public.favorites f
  WHERE f.store_id = NEW.store_id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_new_feed_post
AFTER INSERT ON public.store_feed_posts
FOR EACH ROW
EXECUTE FUNCTION public.notify_new_feed_post();

-- Trigger: notificar quem favoritou a loja sobre novo reel
CREATE OR REPLACE FUNCTION public.notify_new_reel()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s RECORD;
BEGIN
  IF NEW.is_active = false THEN
    RETURN NEW;
  END IF;

  SELECT name, emoji, image_url, slug, reels_enabled
  INTO s
  FROM public.stores
  WHERE id = NEW.store_id;

  IF NOT FOUND OR s.reels_enabled = false THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (user_id, type, title, body, link, emoji, image_url, store_id)
  SELECT
    f.user_id,
    'reel',
    s.name,
    COALESCE(NULLIF(NEW.title, ''), 'Publicou um novo reel 🎬'),
    '/loja/' || s.slug,
    s.emoji,
    COALESCE(NEW.thumbnail_url, s.image_url),
    NEW.store_id
  FROM public.favorites f
  WHERE f.store_id = NEW.store_id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_new_reel
AFTER INSERT ON public.store_reels
FOR EACH ROW
EXECUTE FUNCTION public.notify_new_reel();