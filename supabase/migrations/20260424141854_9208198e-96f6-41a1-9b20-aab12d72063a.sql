-- Toggle on stores
ALTER TABLE public.stores
ADD COLUMN IF NOT EXISTS reels_enabled boolean NOT NULL DEFAULT false;

-- Reels table
CREATE TABLE IF NOT EXISTS public.store_reels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '',
  video_url text NOT NULL,
  thumbnail_url text,
  cta_label text,
  cta_url text,
  position integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_store_reels_store ON public.store_reels(store_id, position);

ALTER TABLE public.store_reels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reels viewable by everyone when active"
ON public.store_reels FOR SELECT
USING (
  is_active = true
  AND EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_reels.store_id AND s.reels_enabled = true)
);

CREATE POLICY "Admins manage store_reels"
ON public.store_reels FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_store_reels_updated_at
BEFORE UPDATE ON public.store_reels
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket for reel videos
INSERT INTO storage.buckets (id, name, public)
VALUES ('store-reels', 'store-reels', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Reel media public read"
ON storage.objects FOR SELECT
USING (bucket_id = 'store-reels');

CREATE POLICY "Admins upload reel media"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'store-reels' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update reel media"
ON storage.objects FOR UPDATE
USING (bucket_id = 'store-reels' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins delete reel media"
ON storage.objects FOR DELETE
USING (bucket_id = 'store-reels' AND has_role(auth.uid(), 'admin'::app_role));