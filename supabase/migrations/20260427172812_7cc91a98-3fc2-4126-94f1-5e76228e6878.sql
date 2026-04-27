CREATE TABLE public.welcome_modal (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  is_active BOOLEAN NOT NULL DEFAULT false,
  title TEXT NOT NULL DEFAULT 'Bem-vindo!',
  description TEXT,
  image_url TEXT,
  cta_label TEXT,
  cta_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.welcome_modal ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Active welcome modal viewable by everyone"
ON public.welcome_modal FOR SELECT
USING (is_active = true OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage welcome_modal"
ON public.welcome_modal FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_welcome_modal_updated_at
BEFORE UPDATE ON public.welcome_modal
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.welcome_modal (is_active, title, description, cta_label)
VALUES (false, 'Bem-vindo ao YouApp!', 'Aproveite as melhores ofertas e novidades pertinho de você.', 'Explorar agora');