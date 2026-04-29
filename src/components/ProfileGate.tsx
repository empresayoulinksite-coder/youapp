import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import youlinkLogo from "@/assets/youlink-logo.png";

// Rotas onde NÃO devemos forçar o redirect
const ALLOWED_INCOMPLETE = ["/completar-cadastro", "/auth"];

// Cache em memória por sessão: evita refetch a cada navegação
const completedCache = new Map<string, boolean>();

export function ProfileGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      setChecked(true);
      return;
    }
    if (ALLOWED_INCOMPLETE.includes(location.pathname)) {
      setChecked(true);
      return;
    }

    // Hit do cache: pula a query
    if (completedCache.get(user.id) === true) {
      setChecked(true);
      return;
    }

    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("profile_completed")
        .eq("user_id", user.id)
        .maybeSingle();

      if (cancelled) return;

      if (!data?.profile_completed) {
        completedCache.set(user.id, false);
        navigate({ to: "/completar-cadastro" });
      } else {
        completedCache.set(user.id, true);
        setChecked(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, loading, location.pathname, navigate]);

  if (loading || (!checked && user && !ALLOWED_INCOMPLETE.includes(location.pathname))) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/30">
        <div className="flex flex-col items-center gap-6 animate-in fade-in duration-500">
          {/* Logo Youlink animado */}
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-primary/20 blur-xl animate-pulse" />
            <div className="relative flex h-20 w-44 items-center justify-center">
              <img
                src={youlinkLogo}
                alt="Youlink"
                className="h-full w-full object-contain"
              />
            </div>
          </div>

          {/* Spinner */}
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]" />
            <div className="h-2 w-2 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]" />
            <div className="h-2 w-2 rounded-full bg-primary animate-bounce" />
          </div>

          <p className="text-sm font-medium text-muted-foreground tracking-wide">
            Tudo o que você precisa, em um só lugar...
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
