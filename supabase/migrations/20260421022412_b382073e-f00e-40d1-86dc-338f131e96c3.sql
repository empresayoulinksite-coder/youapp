CREATE TABLE public.home_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT 'ShoppingBag',
  tint TEXT NOT NULL DEFAULT 'bg-muted text-foreground',
  matches TEXT[] NOT NULL DEFAULT '{}',
  position INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_ecommerce BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.home_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Active home categories viewable by everyone"
ON public.home_categories FOR SELECT
USING (is_active = true OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage home_categories"
ON public.home_categories FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_home_categories_updated_at
BEFORE UPDATE ON public.home_categories
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.home_categories (slug, label, icon, tint, matches, position, is_ecommerce) VALUES
('restaurantes','Restaurantes','UtensilsCrossed','bg-brand-soft text-brand', ARRAY['Lanches','Pizza','Japonesa','Brasileira','Saudável','Italiana','Mexicana','Árabe','Vegetariana'],1,false),
('mercado','Mercado','Apple','bg-green-50 text-green-600', ARRAY['Mercado'],2,false),
('lanches','Lanches','Sandwich','bg-amber-50 text-amber-600', ARRAY['Lanches'],3,false),
('pizza','Pizza','Pizza','bg-orange-50 text-orange-600', ARRAY['Pizza'],4,false),
('brasileira','Brasileira','Beef','bg-rose-50 text-rose-600', ARRAY['Brasileira'],5,false),
('japonesa','Japonesa','Soup','bg-pink-50 text-pink-600', ARRAY['Japonesa'],6,false),
('saudavel','Saudável','Salad','bg-emerald-50 text-emerald-600', ARRAY['Saudável'],7,false),
('doces','Doces','Cookie','bg-yellow-50 text-yellow-700', ARRAY['Doces','Confeitaria'],8,false),
('sorvetes','Sorvetes','IceCream','bg-sky-50 text-sky-600', ARRAY['Sorvetes','Açaí'],9,false),
('cafe','Café','Coffee','bg-stone-100 text-stone-700', ARRAY['Café','Cafeteria'],10,false),
('bebidas','Bebidas','Beer','bg-indigo-50 text-indigo-600', ARRAY['Bebidas','Adega'],11,false),
('farmacia','Farmácia','Pill','bg-red-50 text-red-600', ARRAY['Farmácia','Farmacia'],12,false),
('pet','Pet','Dog','bg-purple-50 text-purple-600', ARRAY['Pet','Petshop','Pet Shop'],13,false),
('shopping','Shopping','ShoppingBag','bg-fuchsia-50 text-fuchsia-600', ARRAY['Shopping','Loja'],14,false),
('moda','Moda','Shirt','bg-pink-50 text-pink-700', ARRAY['Moda','Roupas','Roupa','Vestuário'],15,true),
('calcados','Calçados','Footprints','bg-amber-50 text-amber-700', ARRAY['Calçados','Calcados','Sapatos','Tênis'],16,true),
('acessorios','Acessórios','Watch','bg-slate-100 text-slate-700', ARRAY['Acessórios','Acessorios','Bolsas','Joias','Relógios'],17,true),
('beleza','Beleza','Sparkles','bg-rose-50 text-rose-700', ARRAY['Beleza','Cosméticos','Cosmeticos','Perfumaria','Maquiagem'],18,true);