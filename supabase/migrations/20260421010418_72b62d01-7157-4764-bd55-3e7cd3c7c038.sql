-- 1. Pausar produtos e categorias
ALTER TABLE public.menu_items
  ADD COLUMN IF NOT EXISTS is_available boolean NOT NULL DEFAULT true;

ALTER TABLE public.menu_categories
  ADD COLUMN IF NOT EXISTS is_available boolean NOT NULL DEFAULT true;

-- 2. Variações (tamanhos)
CREATE TABLE IF NOT EXISTS public.menu_item_variations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_item_id uuid NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
  name text NOT NULL,
  price numeric NOT NULL,
  original_price numeric,
  position integer NOT NULL DEFAULT 0,
  is_available boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_menu_item_variations_item
  ON public.menu_item_variations(menu_item_id);

ALTER TABLE public.menu_item_variations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Variations viewable by everyone" ON public.menu_item_variations;
CREATE POLICY "Variations viewable by everyone"
  ON public.menu_item_variations FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admins manage variations" ON public.menu_item_variations;
CREATE POLICY "Admins manage variations"
  ON public.menu_item_variations FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP TRIGGER IF EXISTS trg_menu_item_variations_updated_at ON public.menu_item_variations;
CREATE TRIGGER trg_menu_item_variations_updated_at
  BEFORE UPDATE ON public.menu_item_variations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();