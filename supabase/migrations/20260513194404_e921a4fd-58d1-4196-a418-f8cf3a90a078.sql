-- Add category_id to pizza_sizes
ALTER TABLE public.pizza_sizes
  ADD COLUMN category_id uuid REFERENCES public.menu_categories(id) ON DELETE CASCADE;

-- Backfill: for each existing size, clone into every pizza category of the same store
INSERT INTO public.pizza_sizes (store_id, category_id, name, slices, max_flavors, position, is_active)
SELECT ps.store_id, mc.id, ps.name, ps.slices, ps.max_flavors, ps.position, ps.is_active
FROM public.pizza_sizes ps
JOIN public.menu_categories mc
  ON mc.store_id = ps.store_id AND mc.is_pizza = true
WHERE ps.category_id IS NULL;

-- Remove orphan rows (the originals without category_id)
DELETE FROM public.pizza_sizes WHERE category_id IS NULL;

-- Enforce NOT NULL
ALTER TABLE public.pizza_sizes ALTER COLUMN category_id SET NOT NULL;

-- Replace store index with category index
DROP INDEX IF EXISTS public.idx_pizza_sizes_store;
CREATE INDEX IF NOT EXISTS idx_pizza_sizes_category ON public.pizza_sizes(category_id, position);