
CREATE TABLE public.cash_transactions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  cash_register_id uuid NOT NULL REFERENCES public.cash_registers(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id),
  type text NOT NULL CHECK (type IN ('deposit', 'withdrawal')),
  amount numeric(10,2) NOT NULL CHECK (amount > 0),
  reason text,
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.cash_transactions ENABLE ROW LEVEL SECURITY;

-- Store team can view transactions for their store's cash registers
CREATE POLICY "Store team can view cash transactions"
ON public.cash_transactions FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.cash_registers cr
    WHERE cr.id = cash_transactions.cash_register_id
      AND can_manage_store_orders(auth.uid(), cr.store_id)
  )
);

-- Store team can insert transactions
CREATE POLICY "Store team can insert cash transactions"
ON public.cash_transactions FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.cash_registers cr
    WHERE cr.id = cash_transactions.cash_register_id
      AND can_manage_store_orders(auth.uid(), cr.store_id)
  )
);

-- Store team can update transactions
CREATE POLICY "Store team can update cash transactions"
ON public.cash_transactions FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.cash_registers cr
    WHERE cr.id = cash_transactions.cash_register_id
      AND can_manage_store_orders(auth.uid(), cr.store_id)
  )
);

-- Admins full access
CREATE POLICY "Admins manage cash transactions"
ON public.cash_transactions FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
