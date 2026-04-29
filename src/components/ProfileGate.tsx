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
      <div className="min-h-screen flex flex-col items-center justify-center gap-5 bg-background">
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-primary/20 blur-2xl animate-pulse" />
          <img
            src={youlinkLogo}
            alt="YouLink"
            className="relative h-24 w-24 object-contain animate-pulse"
            style={{ animationDuration: "1.8s" }}
          />
        </div>
        
        <p className="text-sm text-muted-foreground animate-pulse">Carregando...</p>
      </div>
    );
  }

  return <>{children}</>;
}
