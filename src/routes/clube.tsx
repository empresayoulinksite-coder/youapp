import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Bike, Sparkles, Crown, Check, Mail } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/clube")({
  head: () => ({
    meta: [
      { title: "Clube Youapp — Entrega grátis ilimitada" },
      { name: "description", content: "Entre na lista de espera do Clube Youapp e tenha entrega grátis ilimitada." },
    ],
  }),
  component: ClubePage,
});

function ClubePage() {
  const { user } = useAuth();
  const [email, setEmail] = useState(user?.email ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSubmitting(true);
    const { error } = await supabase.from("club_waitlist").insert({
      email: email.trim().toLowerCase(),
      user_id: user?.id ?? null,
    });
    setSubmitting(false);
    if (error && !error.message.includes("duplicate")) {
      toast.error("Não conseguimos te adicionar agora", { description: error.message });
      return;
    }
    setDone(true);
    toast.success("Você está na lista!", { description: "A gente avisa quando o Clube lançar." });
  };

  return (
    <div className="min-h-screen bg-surface pb-12">
      <header className="sticky top-0 z-30 bg-card border-b border-border px-4 py-3 flex items-center gap-3">
        <Link to="/" className="p-1 -ml-1" aria-label="Voltar">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="font-semibold flex-1">Clube Youapp</h1>
      </header>

      <main className="max-w-md mx-auto px-4 py-6">
        <section
          className="rounded-3xl p-6 text-brand-foreground relative overflow-hidden shadow-[var(--shadow-card)]"
          style={{ backgroundImage: "var(--gradient-promo)" }}
        >
          <span className="text-[11px] font-bold uppercase tracking-wide bg-white/20 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
            <Crown className="h-3 w-3" /> Em breve
          </span>
          <h2 className="mt-4 text-3xl font-extrabold leading-tight">Entrega grátis ilimitada</h2>
          <p className="text-sm opacity-90 mt-2">
            Em milhares de lojas perto de você, todo dia.
          </p>
          <div className="absolute -right-4 -bottom-4 text-8xl opacity-30 select-none">🛵</div>
        </section>

        <section className="mt-6 space-y-3">
          {[
            { Icon: Bike, title: "Frete grátis ilimitado", desc: "Sem mínimo, em lojas selecionadas." },
            { Icon: Sparkles, title: "Cupons exclusivos", desc: "Descontos só para membros do Clube." },
            { Icon: Crown, title: "Atendimento prioritário", desc: "Suporte rápido sempre que precisar." },
          ].map(({ Icon, title, desc }) => (
            <div key={title} className="bg-card rounded-2xl p-4 flex items-start gap-3 shadow-[var(--shadow-card)]">
              <div className="h-10 w-10 rounded-xl bg-brand-soft text-brand flex items-center justify-center shrink-0">
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm">{title}</h3>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </div>
            </div>
          ))}
        </section>

        <section className="mt-7 bg-card rounded-2xl p-5 shadow-[var(--shadow-card)]">
          {done ? (
            <div className="text-center py-3">
              <div className="h-12 w-12 rounded-full bg-success/15 text-success mx-auto flex items-center justify-center mb-3">
                <Check className="h-6 w-6" />
              </div>
              <h3 className="font-bold">Você está na lista!</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Vamos te avisar assim que o Clube lançar.
              </p>
            </div>
          ) : (
            <form onSubmit={submit}>
              <h3 className="font-bold">Quer ser avisado primeiro?</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Entre na lista de espera e tenha acesso antecipado.
              </p>
              <div className="flex items-center gap-2 mt-3 rounded-full bg-muted px-4 py-2.5">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className="bg-transparent outline-none text-sm w-full placeholder:text-muted-foreground"
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="mt-3 w-full bg-brand text-brand-foreground font-bold py-3 rounded-full text-sm disabled:opacity-60"
              >
                {submitting ? "Salvando..." : "Entrar na lista"}
              </button>
            </form>
          )}
        </section>
      </main>
    </div>
  );
}
