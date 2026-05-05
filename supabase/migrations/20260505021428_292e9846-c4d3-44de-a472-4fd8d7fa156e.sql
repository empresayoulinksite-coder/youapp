
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS payment_method_2 text,
  ADD COLUMN IF NOT EXISTS payment_amount_1 numeric,
  ADD COLUMN IF NOT EXISTS payment_amount_2 numeric;
