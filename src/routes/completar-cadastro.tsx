import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { User as UserIcon, Phone, FileText, MapPin, Save, LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/completar-cadastro")({
  head: () => ({
    meta: [
      { title: "Completar cadastro — Youapp" },
      { name: "description", content: "Complete seu cadastro para começar a pedir." },
    ],
  }),
  component: CompletarCadastroPage,
});

interface FormState {
  display_name: string;
  phone: string;
  cpf: string;
  cep: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
}

const empty: FormState = {
  display_name: "",
  phone: "",
  cpf: "",
  cep: "",
  street: "",
  number: "",
  complement: "",
  neighborhood: "",
  city: "",
  state: "",
};

// Máscaras simples
const maskCpf = (v: string) =>
  v.replace(/\D/g, "").slice(0, 11)
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");

const maskPhone = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 10) return d.replace(/(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3").trim();
  return d.replace(/(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3").trim();
};

const maskCep = (v: string) =>
  v.replace(/\D/g, "").slice(0, 8).replace(/(\d{5})(\d)/, "$1-$2");

// Validação CPF (dígitos verificadores)
function isValidCpf(cpf: string) {
  const c = cpf.replace(/\D/g, "");
  if (c.length !== 11 || /^(\d)\1+$/.test(c)) return false;
  let s = 0;
  for (let i = 0; i < 9; i++) s += parseInt(c[i]) * (10 - i);
  let d1 = 11 - (s % 11);
  if (d1 >= 10) d1 = 0;
  if (d1 !== parseInt(c[9])) return false;
  s = 0;
  for (let i = 0; i < 10; i++) s += parseInt(c[i]) * (11 - i);
  let d2 = 11 - (s % 11);
  if (d2 >= 10) d2 = 0;
  return d2 === parseInt(c[10]);
}

function CompletarCadastroPage() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState<FormState>(empty);
  const [saving, setSaving] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  // Pré-carrega dados existentes
  useEffect(() => {
    if (!user) return;
    (async () => {
      setFetching(true);
      const { data } = await supabase
        .from("profiles")
        .select("display_name, phone, cpf, cep, street, number, complement, neighborhood, city, state, profile_completed")
        .eq("user_id", user.id)
        .maybeSingle();

      if (data) {
        if (data.profile_completed) {
          navigate({ to: "/" });
          return;
        }
        setForm({
          display_name: data.display_name ?? "",
          phone: data.phone ? maskPhone(data.phone) : "",
          cpf: data.cpf ? maskCpf(data.cpf) : "",
          cep: data.cep ? maskCep(data.cep) : "",
          street: data.street ?? "",
          number: data.number ?? "",
          complement: data.complement ?? "",
          neighborhood: data.neighborhood ?? "",
          city: data.city ?? "",
          state: data.state ?? "",
        });
      }
      setFetching(false);
    })();
  }, [user, navigate]);

  const update = (k: keyof FormState, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  const handleCepBlur = async () => {
    const cep = form.cep.replace(/\D/g, "");
    if (cep.length !== 8) return;
    try {
      setCepLoading(true);
      const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setForm((f) => ({
          ...f,
          street: data.logradouro || f.street,
          neighborhood: data.bairro || f.neighborhood,
          city: data.localidade || f.city,
          state: data.uf || f.state,
        }));
      }
    } catch {
      // silencioso
    } finally {
      setCepLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setError(null);

    // Validação
    if (!form.display_name.trim()) return setError("Informe seu nome completo.");
    if (form.phone.replace(/\D/g, "").length < 10) return setError("Telefone inválido.");
    if (!isValidCpf(form.cpf)) return setError("CPF inválido.");
    if (form.cep.replace(/\D/g, "").length !== 8) return setError("CEP inválido.");
    if (!form.street.trim()) return setError("Informe a rua.");
    if (!form.number.trim()) return setError("Informe o número.");
    if (!form.neighborhood.trim()) return setError("Informe o bairro.");
    if (!form.city.trim()) return setError("Informe a cidade.");
    if (!form.state.trim()) return setError("Informe o estado.");

    setSaving(true);
    const payload = {
      user_id: user.id,
      email: user.email ?? null,
      display_name: form.display_name.trim(),
      phone: form.phone.replace(/\D/g, ""),
      cpf: form.cpf.replace(/\D/g, ""),
      cep: form.cep.replace(/\D/g, ""),
      street: form.street.trim(),
      number: form.number.trim(),
      complement: form.complement.trim() || null,
      neighborhood: form.neighborhood.trim(),
      city: form.city.trim(),
      state: form.state.trim().toUpperCase().slice(0, 2),
      profile_completed: true,
    };

    // Tenta UPDATE primeiro
    const { data: updated, error: upErr } = await supabase
      .from("profiles")
      .update(payload)
      .eq("user_id", user.id)
      .select("user_id");

    let finalErr = upErr;
    // Se não atualizou nenhuma linha, faz INSERT
    if (!upErr && (!updated || updated.length === 0)) {
      const { error: insErr } = await supabase.from("profiles").insert(payload);
      finalErr = insErr;
    }
    setSaving(false);

    if (finalErr) {
      console.error("[completar-cadastro] save error:", finalErr);
      setError(finalErr.message);
      return;
    }
    navigate({ to: "/" });
  };

  const handleLogout = async () => {
    await signOut();
    navigate({ to: "/auth" });
  };

  if (loading || !user || fetching) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
        Carregando...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface pb-12">
      <header className="bg-card border-b border-border px-4 py-4 sticky top-0 z-20">
        <div className="max-w-md mx-auto">
          <h1 className="font-bold text-lg">Complete seu cadastro</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Precisamos desses dados para entregar seus pedidos
          </p>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Dados pessoais */}
          <section className="bg-card rounded-2xl p-4 shadow-[var(--shadow-card)] space-y-4">
            <h2 className="font-semibold text-sm flex items-center gap-1.5">
              <UserIcon className="h-4 w-4" /> Dados pessoais
            </h2>

            <div>
              <label className="text-xs font-medium block mb-1">Nome completo</label>
              <input
                type="text"
                value={form.display_name}
                onChange={(e) => update("display_name", e.target.value)}
                className="w-full rounded-lg border border-border px-4 py-3 bg-surface text-sm"
                placeholder="Seu nome completo"
                required
              />
            </div>

            <div>
              <label className="text-xs font-medium block mb-1 flex items-center gap-1.5">
                <Phone className="h-3 w-3" /> Telefone
              </label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => update("phone", maskPhone(e.target.value))}
                className="w-full rounded-lg border border-border px-4 py-3 bg-surface text-sm"
                placeholder="(11) 99999-9999"
                required
              />
            </div>

            <div>
              <label className="text-xs font-medium block mb-1 flex items-center gap-1.5">
                <FileText className="h-3 w-3" /> CPF
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={form.cpf}
                onChange={(e) => update("cpf", maskCpf(e.target.value))}
                className="w-full rounded-lg border border-border px-4 py-3 bg-surface text-sm"
                placeholder="000.000.000-00"
                required
              />
            </div>
          </section>

          {/* Endereço */}
          <section className="bg-card rounded-2xl p-4 shadow-[var(--shadow-card)] space-y-4">
            <h2 className="font-semibold text-sm flex items-center gap-1.5">
              <MapPin className="h-4 w-4" /> Endereço de entrega
            </h2>

            <div>
              <label className="text-xs font-medium block mb-1">CEP</label>
              <input
                type="text"
                inputMode="numeric"
                value={form.cep}
                onChange={(e) => update("cep", maskCep(e.target.value))}
                onBlur={handleCepBlur}
                className="w-full rounded-lg border border-border px-4 py-3 bg-surface text-sm"
                placeholder="00000-000"
                required
              />
              {cepLoading && (
                <p className="text-xs text-muted-foreground mt-1">Buscando endereço...</p>
              )}
            </div>

            <div>
              <label className="text-xs font-medium block mb-1">Rua</label>
              <input
                type="text"
                value={form.street}
                onChange={(e) => update("street", e.target.value)}
                className="w-full rounded-lg border border-border px-4 py-3 bg-surface text-sm"
                placeholder="Nome da rua"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium block mb-1">Número</label>
                <input
                  type="text"
                  value={form.number}
                  onChange={(e) => update("number", e.target.value)}
                  className="w-full rounded-lg border border-border px-4 py-3 bg-surface text-sm"
                  placeholder="123"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-medium block mb-1">Complemento</label>
                <input
                  type="text"
                  value={form.complement}
                  onChange={(e) => update("complement", e.target.value)}
                  className="w-full rounded-lg border border-border px-4 py-3 bg-surface text-sm"
                  placeholder="Apto, bloco..."
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium block mb-1">Bairro</label>
              <input
                type="text"
                value={form.neighborhood}
                onChange={(e) => update("neighborhood", e.target.value)}
                className="w-full rounded-lg border border-border px-4 py-3 bg-surface text-sm"
                placeholder="Bairro"
                required
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="text-xs font-medium block mb-1">Cidade</label>
                <input
                  type="text"
                  value={form.city}
                  onChange={(e) => update("city", e.target.value)}
                  className="w-full rounded-lg border border-border px-4 py-3 bg-surface text-sm"
                  placeholder="Cidade"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-medium block mb-1">UF</label>
                <input
                  type="text"
                  value={form.state}
                  onChange={(e) => update("state", e.target.value.toUpperCase().slice(0, 2))}
                  className="w-full rounded-lg border border-border px-4 py-3 bg-surface text-sm uppercase"
                  placeholder="SP"
                  maxLength={2}
                  required
                />
              </div>
            </div>
          </section>

          {error && (
            <div className="text-sm bg-destructive/10 text-destructive rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-brand text-brand-foreground font-bold py-3.5 rounded-full disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Save className="h-4 w-4" />
            {saving ? "Salvando..." : "Concluir cadastro"}
          </button>

          <button
            type="button"
            onClick={handleLogout}
            className="w-full text-sm text-muted-foreground py-2 flex items-center justify-center gap-1.5"
          >
            <LogOut className="h-3.5 w-3.5" /> Sair e voltar depois
          </button>
        </form>
      </main>
    </div>
  );
}
