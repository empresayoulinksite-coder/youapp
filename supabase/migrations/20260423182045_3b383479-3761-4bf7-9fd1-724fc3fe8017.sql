-- =========================================================
-- PIZZA SIZES (tamanhos por loja)
-- =========================================================
CREATE TABLE public.pizza_sizes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL,
  name text NOT NULL,                  -- Broto, Média, Grande, Família
  slices integer NOT NULL DEFAULT 8,   -- nº de fatias
  max_flavors integer NOT NULL DEFAULT 1, -- até quantos sabores cabem
  position integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pizza_sizes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pizza sizes viewable by everyone"
  ON public.pizza_sizes FOR SELECT USING (true);

CREATE POLICY "Admins manage pizza_sizes"
  ON public.pizza_sizes FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Store owners manage their pizza_sizes"
  ON public.pizza_sizes FOR ALL
  USING (is_store_owner(auth.uid(), store_id))
  WITH CHECK (is_store_owner(auth.uid(), store_id));

CREATE TRIGGER update_pizza_sizes_updated_at
  BEFORE UPDATE ON public.pizza_sizes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_pizza_sizes_store ON public.pizza_sizes(store_id);

-- =========================================================
-- MENU ITEM SIZE PRICES (preço de cada sabor × tamanho)
-- =========================================================
CREATE TABLE public.menu_item_size_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_item_id uuid NOT NULL,
  pizza_size_id uuid NOT NULL,
  price numeric NOT NULL DEFAULT 0,
  is_available boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (menu_item_id, pizza_size_id)
);

ALTER TABLE public.menu_item_size_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Size prices viewable by everyone"
  ON public.menu_item_size_prices FOR SELECT USING (true);

CREATE POLICY "Admins manage size_prices"
  ON public.menu_item_size_prices FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Store owners manage their size_prices"
  ON public.menu_item_size_prices FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.menu_items mi
    WHERE mi.id = menu_item_size_prices.menu_item_id
      AND is_store_owner(auth.uid(), mi.store_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.menu_items mi
    WHERE mi.id = menu_item_size_prices.menu_item_id
      AND is_store_owner(auth.uid(), mi.store_id)
  ));

CREATE TRIGGER update_size_prices_updated_at
  BEFORE UPDATE ON public.menu_item_size_prices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_size_prices_item ON public.menu_item_size_prices(menu_item_id);
CREATE INDEX idx_size_prices_size ON public.menu_item_size_prices(pizza_size_id);

-- =========================================================
-- PIZZA CRUSTS (bordas recheadas)
-- =========================================================
CREATE TABLE public.pizza_crusts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL,
  name text NOT NULL,
  price numeric NOT NULL DEFAULT 0,
  position integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pizza_crusts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Crusts viewable by everyone"
  ON public.pizza_crusts FOR SELECT USING (true);

CREATE POLICY "Admins manage pizza_crusts"
  ON public.pizza_crusts FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Store owners manage their pizza_crusts"
  ON public.pizza_crusts FOR ALL
  USING (is_store_owner(auth.uid(), store_id))
  WITH CHECK (is_store_owner(auth.uid(), store_id));

CREATE TRIGGER update_pizza_crusts_updated_at
  BEFORE UPDATE ON public.pizza_crusts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_pizza_crusts_store ON public.pizza_crusts(store_id);

-- =========================================================
-- PIZZA ADDONS (adicionais opcionais)
-- =========================================================
CREATE TABLE public.pizza_addons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL,
  name text NOT NULL,
  price numeric NOT NULL DEFAULT 0,
  position integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pizza_addons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Addons viewable by everyone"
  ON public.pizza_addons FOR SELECT USING (true);

CREATE POLICY "Admins manage pizza_addons"
  ON public.pizza_addons FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Store owners manage their pizza_addons"
  ON public.pizza_addons FOR ALL
  USING (is_store_owner(auth.uid(), store_id))
  WITH CHECK (is_store_owner(auth.uid(), store_id));

CREATE TRIGGER update_pizza_addons_updated_at
  BEFORE UPDATE ON public.pizza_addons
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_pizza_addons_store ON public.pizza_addons(store_id);

-- =========================================================
-- CART / ORDER ITEMS — guardar pizza configurada
-- =========================================================
-- flavors: [{ menu_item_id, name, price }]
-- addons:  [{ id, name, price }]
ALTER TABLE public.cart_items
  ADD COLUMN IF NOT EXISTS pizza_size_id uuid,
  ADD COLUMN IF NOT EXISTS pizza_size_name text,
  ADD COLUMN IF NOT EXISTS pizza_flavors jsonb,
  ADD COLUMN IF NOT EXISTS pizza_crust_id uuid,
  ADD COLUMN IF NOT EXISTS pizza_crust_name text,
  ADD COLUMN IF NOT EXISTS pizza_crust_price numeric,
  ADD COLUMN IF NOT EXISTS pizza_addons jsonb;

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS pizza_size_id uuid,
  ADD COLUMN IF NOT EXISTS pizza_size_name text,
  ADD COLUMN IF NOT EXISTS pizza_flavors jsonb,
  ADD COLUMN IF NOT EXISTS pizza_crust_id uuid,
  ADD COLUMN IF NOT EXISTS pizza_crust_name text,
  ADD COLUMN IF NOT EXISTS pizza_crust_price numeric,
  ADD COLUMN IF NOT EXISTS pizza_addons jsonb;