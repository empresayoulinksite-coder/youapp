-- COUPONS (globais Youapp)
CREATE TABLE public.coupons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percent', 'fixed')),
  discount_value NUMERIC NOT NULL CHECK (discount_value > 0),
  min_order NUMERIC NOT NULL DEFAULT 0,
  max_discount NUMERIC,
  store_ids UUID[] NOT NULL DEFAULT '{}',
  starts_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  usage_limit INTEGER,
  used_count INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Active coupons are viewable by everyone"
ON public.coupons FOR SELECT
USING (
  is_active = true
  AND (starts_at IS NULL OR starts_at <= now())
  AND (expires_at IS NULL OR expires_at > now())
);

CREATE TRIGGER update_coupons_updated_at
BEFORE UPDATE ON public.coupons
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- USER COUPONS (resgatados)
CREATE TABLE public.user_coupons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  coupon_id UUID NOT NULL REFERENCES public.coupons(id) ON DELETE CASCADE,
  redeemed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  used_at TIMESTAMPTZ,
  UNIQUE(user_id, coupon_id)
);

ALTER TABLE public.user_coupons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view their own redeemed coupons"
ON public.user_coupons FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users redeem coupons for themselves"
ON public.user_coupons FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update their own redeemed coupons"
ON public.user_coupons FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users delete their own redeemed coupons"
ON public.user_coupons FOR DELETE
USING (auth.uid() = user_id);

-- CLUBE YOUAPP — lista de espera
CREATE TABLE public.club_waitlist (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.club_waitlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can join waitlist"
ON public.club_waitlist FOR INSERT
WITH CHECK (true);
-- Sem SELECT policy: ninguém lê a lista pelo client.