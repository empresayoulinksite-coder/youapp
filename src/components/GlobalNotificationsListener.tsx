import { useEffect, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNotificationSound } from "@/hooks/useNotificationSound";

/**
 * Escuta novas notificações em qualquer página do app:
 * - toca o "ding-ding"
 * - mostra toast deslizante
 * - invalida a query do sino
 */
export function GlobalNotificationsListener() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { playDing } = useNotificationSound("client-notif-sound");
  const initRef = useRef(false);

  useEffect(() => {
    if (!user?.id) return;
    initRef.current = false;
    const t = setTimeout(() => {
      initRef.current = true;
    }, 1500);

    const channel = supabase
      .channel(`global-notifications-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const n = payload.new as {
            title: string;
            body: string | null;
            link: string | null;
            emoji: string | null;
          };
          if (initRef.current) {
            playDing();
            toast.success(`${n.emoji ?? "🔔"} ${n.title}`, {
              description: n.body ?? undefined,
              duration: 6000,
              action: n.link
                ? {
                    label: "Ver",
                    onClick: () => navigate({ to: n.link! }),
                  }
                : undefined,
            });
          }
          qc.invalidateQueries({ queryKey: ["notifications", user.id] });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: ["notifications", user.id] });
        },
      )
      .subscribe();

    return () => {
      clearTimeout(t);
      supabase.removeChannel(channel);
    };
  }, [user?.id, qc, playDing, navigate]);

  return null;
}
