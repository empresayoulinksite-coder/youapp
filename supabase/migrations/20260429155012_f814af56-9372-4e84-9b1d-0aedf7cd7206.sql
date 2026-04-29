-- Campos de tempos por status (balcão e delivery, mínimo e máximo em minutos)
ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS time_analise_balcao_min  integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS time_analise_balcao_max  integer NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS time_analise_delivery_min  integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS time_analise_delivery_max  integer NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS time_producao_balcao_min  integer NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS time_producao_balcao_max  integer NOT NULL DEFAULT 25,
  ADD COLUMN IF NOT EXISTS time_producao_delivery_min  integer NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS time_producao_delivery_max  integer NOT NULL DEFAULT 45,
  ADD COLUMN IF NOT EXISTS time_pronto_balcao_min  integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS time_pronto_balcao_max  integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS time_pronto_delivery_min  integer NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS time_pronto_delivery_max  integer NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS auto_accept_orders boolean NOT NULL DEFAULT false;

-- Função: ao inserir um pedido, se a loja tem auto_accept_orders, ir direto para em_producao
CREATE OR REPLACE FUNCTION public.apply_auto_accept_on_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  auto_accept boolean;
BEGIN
  IF NEW.status = 'em_analise' THEN
    SELECT s.auto_accept_orders INTO auto_accept
    FROM public.stores s
    WHERE s.id = NEW.store_id;

    IF COALESCE(auto_accept, false) THEN
      NEW.status := 'em_producao';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_apply_auto_accept_on_order ON public.orders;
CREATE TRIGGER trg_apply_auto_accept_on_order
BEFORE INSERT ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.apply_auto_accept_on_order();