
CREATE TABLE public.cash_registers (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id uuid NOT NULL,
  opened_by uuid,
  closed_by uuid,
  opened_at timestamptz DEFAULT now() NOT NULL,
  closed_at timestamptz,
  opening_balance numeric(10,2) DEFAULT 0 NOT NULL,
  closing_balance numeric(10,2),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  notes text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.cash_registers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Store team can view cash registers"
ON public.cash_registers FOR SELECT TO authenticated
USING (can_manage_store_orders(auth.uid(), store_id));

CREATE POLICY "Store team can open cash registers"
ON public.cash_registers FOR INSERT TO authenticated
WITH CHECK (can_manage_store_orders(auth.uid(), store_id));

CREATE POLICY "Store team can update cash registers"
ON public.cash_registers FOR UPDATE TO authenticated
USING (can_manage_store_orders(auth.uid(), store_id));

CREATE POLICY "Admins manage cash registers"
ON public.cash_registers FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_cash_registers_updated_at
BEFORE UPDATE ON public.cash_registers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
