
ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS auto_accept_bookings boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.apply_auto_accept_on_booking()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  auto_accept boolean;
BEGIN
  IF NEW.status = 'pending' THEN
    SELECT s.auto_accept_bookings INTO auto_accept
    FROM public.stores s
    WHERE s.id = NEW.store_id;

    IF COALESCE(auto_accept, false) THEN
      NEW.status := 'confirmed';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS apply_auto_accept_on_booking_trg ON public.bookings;
CREATE TRIGGER apply_auto_accept_on_booking_trg
BEFORE INSERT ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION public.apply_auto_accept_on_booking();
