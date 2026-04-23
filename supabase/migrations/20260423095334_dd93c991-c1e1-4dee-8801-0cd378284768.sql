ALTER TABLE public.stores
ADD COLUMN IF NOT EXISTS payment_methods_list text[] NOT NULL DEFAULT '{}';

-- Migrar dados existentes (best-effort do texto livre para chaves padrão)
UPDATE public.stores
SET payment_methods_list = ARRAY(
  SELECT k FROM (
    VALUES
      ('pix',      position('pix'      in lower(coalesce(payment_methods,''))) > 0),
      ('dinheiro', position('dinheiro' in lower(coalesce(payment_methods,''))) > 0),
      ('credito',  position('crédito'  in lower(coalesce(payment_methods,''))) > 0
                 OR position('credito'  in lower(coalesce(payment_methods,''))) > 0
                 OR (position('cartão'  in lower(coalesce(payment_methods,''))) > 0
                     AND position('débito' in lower(coalesce(payment_methods,''))) = 0
                     AND position('debito' in lower(coalesce(payment_methods,''))) = 0)),
      ('debito',   position('débito'   in lower(coalesce(payment_methods,''))) > 0
                 OR position('debito'   in lower(coalesce(payment_methods,''))) > 0),
      ('vale',     position('vale'     in lower(coalesce(payment_methods,''))) > 0
                 OR position('refeição' in lower(coalesce(payment_methods,''))) > 0
                 OR position('refeicao' in lower(coalesce(payment_methods,''))) > 0
                 OR position('vr'       in lower(coalesce(payment_methods,''))) > 0
                 OR position('va'       in lower(coalesce(payment_methods,''))) > 0)
  ) AS t(k, has) WHERE has
)
WHERE coalesce(payment_methods,'') <> '';