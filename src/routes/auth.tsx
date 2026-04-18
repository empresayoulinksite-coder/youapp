import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, FormEvent, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — Youlink" },
      { name: "description", content: "Entre ou cadastre-se para fazer pedidos." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) navigate({ to: "/" });
  }, [user, navigate]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    if (mode === "signup") {
      const { error: err } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: { display_name: name },
        },
      });
      if (err) setError(err.message);
      else navigate({ to: "/" });
    } else {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password });
      if (err) setError(err.message);
      else navigate({ to: "/" });
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <header className="bg-card border-b border-border px-4 py-3 flex items-center gap-3">
        <Link to="/" className="p-1 -ml-1">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="font-semibold">{mode === "signin" ? "Entrar" : "Criar conta"}</h1>
      </header>

      <main className="flex-1 px-4 py-8 max-w-md mx-auto w-full">
        <h2 className="text-2xl font-bold mb-2">
          {mode === "signin" ? "Bem-vindo de volta" : "Crie sua conta"}
        </h2>
        <p className="text-sm text-muted-foreground mb-6">
          {mode === "signin" ? "Entre para fazer pedidos e ver seu carrinho." : "É rápido e gratuito."}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "signup" && (
            <div>
              <label className="text-sm font-medium block mb-1">Nome</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-border px-4 py-3 bg-card text-sm"
                placeholder="Seu nome"
                required
              />
            </div>
          )}
          <div>
            <label className="text-sm font-medium block mb-1">E-mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-border px-4 py-3 bg-card text-sm"
              placeholder="voce@email.com"
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Senha</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-border px-4 py-3 bg-card text-sm"
              placeholder="Mínimo 6 caracteres"
              minLength={6}
              required
            />
          </div>

          {error && (
            <div className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand text-brand-foreground font-bold py-3 rounded-full disabled:opacity-50"
          >
            {loading ? "Aguarde..." : mode === "signin" ? "Entrar" : "Criar conta"}
          </button>
        </form>

        <button
          onClick={() => {
            setMode(mode === "signin" ? "signup" : "signin");
            setError(null);
          }}
          className="mt-6 text-sm text-brand font-semibold w-full text-center"
        >
          {mode === "signin" ? "Não tem conta? Cadastre-se" : "Já tem conta? Entrar"}
        </button>
      </main>
    </div>
  );
}
