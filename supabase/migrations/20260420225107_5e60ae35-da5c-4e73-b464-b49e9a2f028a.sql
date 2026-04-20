
-- 1. Enum de papéis
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- 2. Tabela user_roles
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 3. Função segura para checar papel (security definer evita recursão)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- 4. Políticas em user_roles
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
  ON public.user_roles FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage roles"
  ON public.user_roles FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 5. Políticas de admin nas tabelas existentes (mantendo as policies de leitura pública)

-- stores
CREATE POLICY "Admins manage stores"
  ON public.stores FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- menu_categories
CREATE POLICY "Admins manage menu_categories"
  ON public.menu_categories FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- menu_items
CREATE POLICY "Admins manage menu_items"
  ON public.menu_items FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- coupons
CREATE POLICY "Admins manage coupons"
  ON public.coupons FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- store_coupons
CREATE POLICY "Admins manage store_coupons"
  ON public.store_coupons FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- stories
CREATE POLICY "Admins manage stories"
  ON public.stories FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 6. Buckets de storage
INSERT INTO storage.buckets (id, name, public)
VALUES ('menu-images', 'menu-images', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('story-media', 'story-media', true)
ON CONFLICT (id) DO NOTHING;

-- 7. Políticas dos buckets
CREATE POLICY "Public read menu-images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'menu-images');

CREATE POLICY "Admins upload menu-images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'menu-images' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update menu-images"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'menu-images' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete menu-images"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'menu-images' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Public read story-media"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'story-media');

CREATE POLICY "Admins upload story-media"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'story-media' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update story-media"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'story-media' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete story-media"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'story-media' AND public.has_role(auth.uid(), 'admin'));

-- 8. Política de admin no bucket existente store-images
CREATE POLICY "Admins upload store-images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'store-images' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update store-images"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'store-images' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete store-images"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'store-images' AND public.has_role(auth.uid(), 'admin'));
