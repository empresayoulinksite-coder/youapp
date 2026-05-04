-- Drop the unique index that causes duplicate key errors
DROP INDEX IF EXISTS public.orders_store_number_idx;

-- Create a regular (non-unique) index for query performance
CREATE INDEX orders_store_number_idx ON public.orders (store_id, order_number);