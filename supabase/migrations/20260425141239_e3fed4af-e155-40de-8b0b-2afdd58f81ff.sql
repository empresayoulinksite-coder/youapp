ALTER TABLE public.stores 
ADD COLUMN IF NOT EXISTS booking_mode text NOT NULL DEFAULT 'booking';

-- Validação: só aceita 'booking' ou 'quote'
ALTER TABLE public.stores 
DROP CONSTRAINT IF EXISTS stores_booking_mode_check;

ALTER TABLE public.stores 
ADD CONSTRAINT stores_booking_mode_check 
CHECK (booking_mode IN ('booking', 'quote'));