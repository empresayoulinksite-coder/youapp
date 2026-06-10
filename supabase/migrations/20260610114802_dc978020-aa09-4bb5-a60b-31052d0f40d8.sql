
-- Planos de assinatura (por loja)
CREATE TABLE public.subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  price numeric(10,2) NOT NULL DEFAULT 0,
  total_services integer NOT NULL CHECK (total_services > 0),
  validity_days integer NOT NULL DEFAULT 30 CHECK (validity_days > 0),
  is_active boolean NOT NULL DEFAULT true,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscription_plans TO authenticated;
GRANT SELECT ON public.subscription_plans TO anon;
GRANT ALL ON public.subscription_plans TO service_role;

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active plans"
  ON public.subscription_plans FOR SELECT
  USING (is_active = true OR public.can_manage_store_orders(auth.uid(), store_id));

CREATE POLICY "Store managers can insert plans"
  ON public.subscription_plans FOR INSERT
  TO authenticated
  WITH CHECK (public.can_manage_store_orders(auth.uid(), store_id));

CREATE POLICY "Store managers can update plans"
  ON public.subscription_plans FOR UPDATE
  TO authenticated
  USING (public.can_manage_store_orders(auth.uid(), store_id))
  WITH CHECK (public.can_manage_store_orders(auth.uid(), store_id));

CREATE POLICY "Store managers can delete plans"
  ON public.subscription_plans FOR DELETE
  TO authenticated
  USING (public.can_manage_store_orders(auth.uid(), store_id));

CREATE TRIGGER update_subscription_plans_updated_at
  BEFORE UPDATE ON public.subscription_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Serviços incluídos no plano (N:N). Se vazio, plano cobre qualquer serviço.
CREATE TABLE public.subscription_plan_services (
  plan_id uuid NOT NULL REFERENCES public.subscription_plans(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  PRIMARY KEY (plan_id, service_id)
);

GRANT SELECT, INSERT, DELETE ON public.subscription_plan_services TO authenticated;
GRANT SELECT ON public.subscription_plan_services TO anon;
GRANT ALL ON public.subscription_plan_services TO service_role;

ALTER TABLE public.subscription_plan_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view plan services"
  ON public.subscription_plan_services FOR SELECT
  USING (true);

CREATE POLICY "Store managers can manage plan services"
  ON public.subscription_plan_services FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.subscription_plans p WHERE p.id = plan_id AND public.can_manage_store_orders(auth.uid(), p.store_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.subscription_plans p WHERE p.id = plan_id AND public.can_manage_store_orders(auth.uid(), p.store_id)));

-- Assinaturas ativas dos clientes
CREATE TABLE public.client_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES public.subscription_plans(id) ON DELETE SET NULL,
  customer_user_id uuid,
  customer_name text NOT NULL,
  customer_phone text,
  services_total integer NOT NULL CHECK (services_total > 0),
  services_used integer NOT NULL DEFAULT 0 CHECK (services_used >= 0),
  started_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','expired','cancelled')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX client_subscriptions_store_status_idx ON public.client_subscriptions(store_id, status);
CREATE INDEX client_subscriptions_user_idx ON public.client_subscriptions(customer_user_id) WHERE customer_user_id IS NOT NULL;
CREATE INDEX client_subscriptions_phone_idx ON public.client_subscriptions(store_id, customer_phone) WHERE customer_phone IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_subscriptions TO authenticated;
GRANT ALL ON public.client_subscriptions TO service_role;

ALTER TABLE public.client_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Store managers view all subscriptions"
  ON public.client_subscriptions FOR SELECT
  TO authenticated
  USING (public.can_manage_store_orders(auth.uid(), store_id));

CREATE POLICY "Users view own subscriptions"
  ON public.client_subscriptions FOR SELECT
  TO authenticated
  USING (customer_user_id = auth.uid());

CREATE POLICY "Store managers insert subscriptions"
  ON public.client_subscriptions FOR INSERT
  TO authenticated
  WITH CHECK (public.can_manage_store_orders(auth.uid(), store_id));

CREATE POLICY "Store managers update subscriptions"
  ON public.client_subscriptions FOR UPDATE
  TO authenticated
  USING (public.can_manage_store_orders(auth.uid(), store_id))
  WITH CHECK (public.can_manage_store_orders(auth.uid(), store_id));

CREATE POLICY "Store managers delete subscriptions"
  ON public.client_subscriptions FOR DELETE
  TO authenticated
  USING (public.can_manage_store_orders(auth.uid(), store_id));

CREATE TRIGGER update_client_subscriptions_updated_at
  BEFORE UPDATE ON public.client_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Adiciona referência de assinatura usada no agendamento
ALTER TABLE public.bookings ADD COLUMN subscription_id uuid REFERENCES public.client_subscriptions(id) ON DELETE SET NULL;

-- Função: normalizar telefone (só dígitos)
CREATE OR REPLACE FUNCTION public.normalize_phone(_phone text)
RETURNS text
LANGUAGE sql IMMUTABLE
AS $$
  SELECT regexp_replace(COALESCE(_phone, ''), '\D', '', 'g');
$$;

-- Trigger: aplica baixa na assinatura ao concluir agendamento
CREATE OR REPLACE FUNCTION public.apply_subscription_on_booking_complete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sub_id uuid;
  customer_phone text;
BEGIN
  -- Só age quando o status muda PARA 'completed' e ainda não há assinatura vinculada
  IF NEW.status <> 'completed' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'completed' THEN
    RETURN NEW;
  END IF;
  IF NEW.subscription_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Pega telefone do cliente (profiles)
  SELECT p.phone INTO customer_phone
  FROM public.profiles p WHERE p.user_id = NEW.user_id;

  -- Procura assinatura ativa que cubra este serviço
  SELECT cs.id INTO sub_id
  FROM public.client_subscriptions cs
  WHERE cs.store_id = NEW.store_id
    AND cs.status = 'active'
    AND cs.expires_at > now()
    AND cs.services_used < cs.services_total
    AND (
      cs.customer_user_id = NEW.user_id
      OR (customer_phone IS NOT NULL AND public.normalize_phone(cs.customer_phone) = public.normalize_phone(customer_phone) AND cs.customer_phone IS NOT NULL)
    )
    AND (
      cs.plan_id IS NULL
      OR NOT EXISTS (SELECT 1 FROM public.subscription_plan_services sps WHERE sps.plan_id = cs.plan_id)
      OR EXISTS (SELECT 1 FROM public.subscription_plan_services sps WHERE sps.plan_id = cs.plan_id AND sps.service_id = NEW.service_id)
    )
  ORDER BY cs.expires_at ASC
  LIMIT 1;

  IF sub_id IS NOT NULL THEN
    NEW.subscription_id := sub_id;
    UPDATE public.client_subscriptions
       SET services_used = services_used + 1,
           status = CASE WHEN services_used + 1 >= services_total THEN 'expired' ELSE status END,
           updated_at = now()
     WHERE id = sub_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER apply_subscription_on_booking_complete_trg
  BEFORE INSERT OR UPDATE OF status ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.apply_subscription_on_booking_complete();

-- Trigger: reverte baixa quando agendamento sai de 'completed'
CREATE OR REPLACE FUNCTION public.revert_subscription_on_booking_uncomplete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status = 'completed' AND NEW.status <> 'completed' AND OLD.subscription_id IS NOT NULL THEN
    UPDATE public.client_subscriptions
       SET services_used = GREATEST(services_used - 1, 0),
           status = CASE WHEN status = 'expired' AND expires_at > now() THEN 'active' ELSE status END,
           updated_at = now()
     WHERE id = OLD.subscription_id;
    NEW.subscription_id := NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER revert_subscription_on_booking_uncomplete_trg
  BEFORE UPDATE OF status ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.revert_subscription_on_booking_uncomplete();

-- RPC: dado uma lista de bookings (user_id + store_id), retornar a assinatura ativa do cliente
CREATE OR REPLACE FUNCTION public.get_active_subscriptions_for_users(_store_id uuid, _user_ids uuid[])
RETURNS TABLE(
  user_id uuid,
  subscription_id uuid,
  plan_name text,
  services_total integer,
  services_used integer,
  services_remaining integer,
  expires_at timestamptz,
  status text
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT cs.customer_user_id,
         cs.id,
         COALESCE(sp.name, 'Plano'),
         cs.services_total,
         cs.services_used,
         (cs.services_total - cs.services_used),
         cs.expires_at,
         cs.status
  FROM public.client_subscriptions cs
  LEFT JOIN public.subscription_plans sp ON sp.id = cs.plan_id
  WHERE cs.store_id = _store_id
    AND cs.status = 'active'
    AND cs.expires_at > now()
    AND cs.customer_user_id = ANY(_user_ids)
    AND public.can_manage_store_orders(auth.uid(), _store_id);
$$;
