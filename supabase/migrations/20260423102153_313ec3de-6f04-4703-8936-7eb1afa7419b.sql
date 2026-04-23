ALTER TABLE public.stores 
ADD COLUMN IF NOT EXISTS show_route boolean NOT NULL DEFAULT false;