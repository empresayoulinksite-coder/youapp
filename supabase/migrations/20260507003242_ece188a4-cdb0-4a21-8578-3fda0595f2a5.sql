
-- Create enum for table/comanda type
CREATE TYPE public.store_table_type AS ENUM ('mesa', 'comanda');

-- Create enum for table status
CREATE TYPE public.store_table_status AS ENUM ('livre', 'ocupada', 'fechando_conta');

-- Create store_tables table
CREATE TABLE public.store_tables (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL,
  number INTEGER NOT NULL,
  label TEXT NOT NULL,
  type store_table_type NOT NULL DEFAULT 'mesa',
  status store_table_status NOT NULL DEFAULT 'livre',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (store_id, type, number)
);

-- Enable RLS
ALTER TABLE public.store_tables ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Store team can view store tables"
ON public.store_tables FOR SELECT TO authenticated
USING (can_manage_store_orders(auth.uid(), store_id));

CREATE POLICY "Store team can create store tables"
ON public.store_tables FOR INSERT TO authenticated
WITH CHECK (can_manage_store_orders(auth.uid(), store_id));

CREATE POLICY "Store team can update store tables"
ON public.store_tables FOR UPDATE TO authenticated
USING (can_manage_store_orders(auth.uid(), store_id));

CREATE POLICY "Store team can delete store tables"
ON public.store_tables FOR DELETE TO authenticated
USING (can_manage_store_orders(auth.uid(), store_id));

CREATE POLICY "Admins manage store_tables"
ON public.store_tables FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_store_tables_updated_at
BEFORE UPDATE ON public.store_tables
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
