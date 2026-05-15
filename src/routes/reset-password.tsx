import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Redefinir senha — Youapp" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // Supabase coloca os tokens no hash (#access_token=...&type=recovery)
    // O client detecta automaticamente e cria a sessão.
    const hash = window.location.hash;
    if (hash.includes("type=recovery") || hash.includes("access_token")) {
      setReady(true);
    } else {
      // Verifica se já existe sessão de recovery
      supabase.auth.getSession().then(({ data }) => {
        if (data.session) setReady(true);
        else setError("Link inválido ou expirado. Solicite um novo email de redefinição.");
      });
    }
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("As senhas não conferem.");
      return;
    }
    setLoading(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    setDone(true);
    setTimeout(() => navigate({ to: "/" }), 2500);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="w-full max-w-sm bg-card border border-border rounded-xl p-6 shadow-sm">
        <h1 className="text-xl font-semibold mb-1">Redefinir senha</h1>
        <p className="text-sm text-muted-foreground mb-4">
          Defina uma nova senha para sua conta. Você poderá usá-la para entrar
          na extensão de impressão.
        </p>

        {done ? (
          <div className="text-sm text-green-600">
            Senha atualizada! Redirecionando…
          </div>
        ) : ready ? (
          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              type="password"
              placeholder="Nova senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
              autoFocus
            />
            <input
              type="password"
              placeholder="Confirme a senha"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
            />
            {error && <div className="text-sm text-destructive">{error}</div>}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-10 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-60"
            >
              {loading ? "Salvando…" : "Salvar nova senha"}
            </button>
          </form>
        ) : (
          <div className="text-sm text-destructive">{error ?? "Verificando link…"}</div>
        )}
      </div>
    </div>
  );
}
