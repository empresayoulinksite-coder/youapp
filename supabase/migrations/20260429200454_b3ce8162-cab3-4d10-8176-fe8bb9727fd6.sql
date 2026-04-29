UPDATE public.stores
SET reels_enabled = true
WHERE id IN (
  SELECT DISTINCT store_id
  FROM public.store_reels
  WHERE is_active = true
    AND video_url IS NOT NULL
    AND video_url <> ''
);