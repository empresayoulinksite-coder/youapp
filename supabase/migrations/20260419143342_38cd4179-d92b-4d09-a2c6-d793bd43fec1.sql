
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS image_url text;
ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS image_url text;

INSERT INTO storage.buckets (id, name, public)
VALUES ('store-images', 'store-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Store images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'store-images');
