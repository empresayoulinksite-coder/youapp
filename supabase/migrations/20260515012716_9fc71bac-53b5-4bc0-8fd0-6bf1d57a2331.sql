CREATE TABLE public.qz_certificates (
  id INT PRIMARY KEY DEFAULT 1,
  private_key TEXT NOT NULL,
  public_cert TEXT NOT NULL,
  override_crt TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT singleton CHECK (id = 1)
);

ALTER TABLE public.qz_certificates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage qz_certificates" ON public.qz_certificates
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));