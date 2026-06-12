
CREATE TABLE public.home_promo_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  badge TEXT NOT NULL,
  title TEXT NOT NULL,
  subtitle TEXT,
  cta_label TEXT NOT NULL,
  link_url TEXT NOT NULL,
  bg_style TEXT NOT NULL DEFAULT 'gradient',
  emoji TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.home_promo_cards TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.home_promo_cards TO authenticated;
GRANT ALL ON public.home_promo_cards TO service_role;

ALTER TABLE public.home_promo_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active promo cards"
  ON public.home_promo_cards FOR SELECT
  USING (is_active = true OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage promo cards"
  ON public.home_promo_cards FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_home_promo_cards_updated_at
  BEFORE UPDATE ON public.home_promo_cards
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.home_promo_cards (badge, title, subtitle, cta_label, link_url, bg_style, emoji, sort_order)
VALUES
  ('Clube Youapp', 'Entrega grátis ilimitada', 'Em milhares de restaurantes perto de você', 'Assinar agora', '/clube', 'gradient', '🛵', 1),
  ('Cupons', 'Até 50% OFF', 'Em pedidos selecionados hoje', 'Ver cupons', '/cupons', 'accent', '🎟️', 2);
