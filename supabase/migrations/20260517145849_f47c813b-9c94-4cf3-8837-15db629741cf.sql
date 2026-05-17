CREATE TABLE public.store_printer_settings (
  store_id uuid PRIMARY KEY,
  printer_orders text,
  printer_kitchen text,
  printer_drinks text,
  printer_cashier text,
  kitchen_category_ids uuid[] NOT NULL DEFAULT '{}',
  drinks_category_ids uuid[] NOT NULL DEFAULT '{}',
  auto_print boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.store_printer_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage printer settings"
  ON public.store_printer_settings FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Store team views printer settings"
  ON public.store_printer_settings FOR SELECT
  USING (can_manage_store_orders(auth.uid(), store_id));

CREATE POLICY "Store team inserts printer settings"
  ON public.store_printer_settings FOR INSERT
  WITH CHECK (can_manage_store_orders(auth.uid(), store_id));

CREATE POLICY "Store team updates printer settings"
  ON public.store_printer_settings FOR UPDATE
  USING (can_manage_store_orders(auth.uid(), store_id))
  WITH CHECK (can_manage_store_orders(auth.uid(), store_id));

CREATE TRIGGER update_store_printer_settings_updated_at
  BEFORE UPDATE ON public.store_printer_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();