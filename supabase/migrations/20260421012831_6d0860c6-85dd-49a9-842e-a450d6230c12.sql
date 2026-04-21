ALTER TABLE public.stores
ADD COLUMN store_type TEXT NOT NULL DEFAULT 'food'
CHECK (store_type IN ('food', 'ecommerce', 'service'));

UPDATE public.stores
SET store_type = 'ecommerce'
WHERE lower(
  translate(category,
    'áàãâäéèêëíìîïóòõôöúùûüçÁÀÃÂÄÉÈÊËÍÌÎÏÓÒÕÔÖÚÙÛÜÇ',
    'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'
  )
) IN (
  'moda','roupas','roupa','vestuario',
  'calcados','sapatos','tenis',
  'acessorios','bolsas','joias','relogios',
  'beleza','cosmeticos','perfumaria','maquiagem'
);

CREATE INDEX IF NOT EXISTS idx_stores_store_type ON public.stores(store_type);