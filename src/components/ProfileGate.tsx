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
  const [exiting, setExiting] = useState(false);
  const [showLoader, setShowLoader] = useState(true);

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

  const isLoading = loading || (!checked && user && !ALLOWED_INCOMPLETE.includes(location.pathname));

  // Dispara animação de saída quando o loading termina
  useEffect(() => {
    if (!isLoading && showLoader) {
      setExiting(true);
      const t = setTimeout(() => setShowLoader(false), 400);
      return () => clearTimeout(t);
    }
  }, [isLoading, showLoader]);

  return (
    <>
      {showLoader && (
        <div
          className={`fixed inset-0 z-[100] flex flex-col items-center justify-center gap-5 bg-background transition-all duration-500 ease-out ${
            exiting ? "opacity-0 scale-105 pointer-events-none" : "opacity-100 scale-100"
          }`}
        >
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-primary/20 blur-2xl animate-pulse" />
            <img
              src={youlinkLogo}
              alt="YouLink"
              className="relative h-40 w-40 object-contain animate-pulse"
              style={{ animationDuration: "1.8s" }}
            />
          </div>
          <div className="relative h-1.5 w-40 overflow-hidden rounded-full bg-primary/20">
            <div
              className="absolute top-0 left-0 h-full w-2/5 rounded-full bg-primary"
              style={{ animation: "loader-bar 1.4s ease-in-out infinite" }}
            />
          </div>
        </div>
      )}

      <div
        className={`transition-all duration-500 ease-out ${
          isLoading ? "opacity-0 scale-[0.98]" : "opacity-100 scale-100 animate-fade-in"
        }`}
      >
        {children}
      </div>
    </>
  );
}
