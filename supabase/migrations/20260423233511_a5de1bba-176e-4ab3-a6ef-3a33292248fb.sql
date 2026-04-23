ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS benefit_delivery_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS benefit_delivery_title text NOT NULL DEFAULT 'Entrega em 30-40 min',
  ADD COLUMN IF NOT EXISTS benefit_delivery_subtitle text NOT NULL DEFAULT 'Frete grátis',
  ADD COLUMN IF NOT EXISTS benefit_protection_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS benefit_protection_title text NOT NULL DEFAULT 'Compra protegida',
  ADD COLUMN IF NOT EXISTS benefit_protection_subtitle text NOT NULL DEFAULT 'Reembolso garantido em caso de problemas',
  ADD COLUMN IF NOT EXISTS benefit_return_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS benefit_return_title text NOT NULL DEFAULT 'Troca em até 7 dias',
  ADD COLUMN IF NOT EXISTS benefit_return_subtitle text NOT NULL DEFAULT 'Direito de arrependimento';