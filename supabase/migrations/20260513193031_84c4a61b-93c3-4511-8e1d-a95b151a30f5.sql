
-- 1) Add category_id columns (nullable for backfill)
ALTER TABLE public.pizza_crusts ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.menu_categories(id) ON DELETE CASCADE;
ALTER TABLE public.pizza_addons ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.menu_categories(id) ON DELETE CASCADE;

-- 2) Backfill: clone each existing crust/addon into every pizza category of its store
DO $$
DECLARE
  r RECORD;
  cat RECORD;
  first_cat uuid;
BEGIN
  -- CRUSTS
  FOR r IN SELECT * FROM public.pizza_crusts WHERE category_id IS NULL LOOP
    first_cat := NULL;
    FOR cat IN
      SELECT id FROM public.menu_categories
      WHERE store_id = r.store_id AND is_pizza = true
      ORDER BY position
    LOOP
      IF first_cat IS NULL THEN
        first_cat := cat.id;
        UPDATE public.pizza_crusts SET category_id = cat.id WHERE id = r.id;
      ELSE
        INSERT INTO public.pizza_crusts (store_id, category_id, name, price, position, is_active)
        VALUES (r.store_id, cat.id, r.name, r.price, r.position, r.is_active);
      END IF;
    END LOOP;
  END LOOP;

  -- ADDONS
  FOR r IN SELECT * FROM public.pizza_addons WHERE category_id IS NULL LOOP
    first_cat := NULL;
    FOR cat IN
      SELECT id FROM public.menu_categories
      WHERE store_id = r.store_id AND is_pizza = true
      ORDER BY position
    LOOP
      IF first_cat IS NULL THEN
        first_cat := cat.id;
        UPDATE public.pizza_addons SET category_id = cat.id WHERE id = r.id;
      ELSE
        INSERT INTO public.pizza_addons (store_id, category_id, name, price, position, is_active)
        VALUES (r.store_id, cat.id, r.name, r.price, r.position, r.is_active);
      END IF;
    END LOOP;
  END LOOP;
END $$;

-- 3) Drop orphans (stores with no pizza category)
DELETE FROM public.pizza_crusts WHERE category_id IS NULL;
DELETE FROM public.pizza_addons WHERE category_id IS NULL;

-- 4) Make NOT NULL
ALTER TABLE public.pizza_crusts ALTER COLUMN category_id SET NOT NULL;
ALTER TABLE public.pizza_addons ALTER COLUMN category_id SET NOT NULL;

-- 5) Indexes
CREATE INDEX IF NOT EXISTS pizza_crusts_category_id_idx ON public.pizza_crusts (category_id, position);
CREATE INDEX IF NOT EXISTS pizza_addons_category_id_idx ON public.pizza_addons (category_id, position);
