-- Marca categorias do cardápio que são de pizza (libera meio a meio)
ALTER TABLE public.menu_categories
  ADD COLUMN IF NOT EXISTS is_pizza boolean NOT NULL DEFAULT false;

-- Campos para meio a meio no carrinho
ALTER TABLE public.cart_items
  ADD COLUMN IF NOT EXISTS half_two_menu_item_id uuid,
  ADD COLUMN IF NOT EXISTS half_two_name text,
  ADD COLUMN IF NOT EXISTS unit_price_override numeric;

-- Mesmos campos no histórico de pedidos
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS half_two_menu_item_id uuid,
  ADD COLUMN IF NOT EXISTS half_two_name text;