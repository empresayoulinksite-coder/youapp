import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Bell, Check, Trash2, Package, Image as ImageIcon, Film, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNotificationSound } from "@/hooks/useNotificationSound";

type Notif = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  emoji: string | null;
  image_url: string | null;
  is_read: boolean;
  created_at: string;
};

export function NotificationsBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const { soundOn, setSoundOn, playDing } = useNotificationSound("client-notif-sound");
  const initRef = useRef(false);
  const ref = useRef<HTMLDivElement | null>(null);

  const { data: notifications = [] } = useQuery({
    queryKey: ["notifications", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("id, type, title, body, link, emoji, image_url, is_read, created_at")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as Notif[];
    },
  });

  const unreadCount = useMemo(() => notifications.filter((n) => !n.is_read).length, [notifications]);

  // O listener global (GlobalNotificationsListener) já cuida de som, toast
  // e invalidação da query. Aqui não precisamos de outro canal Realtime.

  // Fecha ao clicar fora
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const markAllRead = async () => {
    if (!user?.id || unreadCount === 0) return;
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", user.id)
      .eq("is_read", false);
    if (error) {
      toast.error("Não foi possível marcar como lidas.");
      return;
    }
    qc.invalidateQueries({ queryKey: ["notifications", user.id] });
  };

  const handleClickItem = async (n: Notif) => {
    if (!n.is_read) {
      await supabase.from("notifications").update({ is_read: true }).eq("id", n.id);
      qc.invalidateQueries({ queryKey: ["notifications", user!.id] });
    }
    setOpen(false);
    if (n.link) navigate({ to: n.link });
  };

  const removeOne = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await supabase.from("notifications").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["notifications", user!.id] });
  };

  const clearAll = async () => {
    if (!user?.id) return;
    await supabase.from("notifications").delete().eq("user_id", user.id);
    qc.invalidateQueries({ queryKey: ["notifications", user.id] });
    setOpen(false);
  };

  if (!user) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative"
        aria-label="Notificações"
      >
        <Bell className="h-5 w-5 text-foreground" />
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 bg-brand text-brand-foreground text-[10px] font-bold rounded-full h-4 min-w-[16px] px-1 flex items-center justify-center animate-pulse">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          {/* Overlay para mobile */}
          <div className="fixed inset-0 bg-black/20 z-40 sm:hidden" onClick={() => setOpen(false)} />

          <div className="fixed sm:absolute top-14 sm:top-auto sm:mt-2 right-2 sm:right-0 z-50 w-[calc(100vw-1rem)] sm:w-[360px] max-w-md bg-card border border-border rounded-2xl shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm">Notificações</h3>
                {unreadCount > 0 && (
                  <span className="bg-brand text-brand-foreground text-[10px] font-bold rounded-full h-5 min-w-[20px] px-1.5 flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setSoundOn(!soundOn)}
                  className="p-1.5 rounded-full hover:bg-muted"
                  title={soundOn ? "Desativar som" : "Ativar som"}
                  aria-label="Alternar som"
                >
                  <Bell className={`h-4 w-4 ${soundOn ? "text-brand" : "text-muted-foreground"}`} />
                </button>
                <button
                  onClick={() => setOpen(false)}
                  className="p-1.5 rounded-full hover:bg-muted sm:hidden"
                  aria-label="Fechar"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {notifications.length > 0 && (
              <div className="flex items-center justify-between px-4 py-2 bg-muted/40 border-b border-border text-xs">
                <button
                  onClick={markAllRead}
                  disabled={unreadCount === 0}
                  className="font-semibold text-brand inline-flex items-center gap-1 disabled:opacity-40"
                >
                  <Check className="h-3.5 w-3.5" /> Marcar todas como lidas
                </button>
                <button
                  onClick={clearAll}
                  className="font-semibold text-muted-foreground inline-flex items-center gap-1 hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Limpar
                </button>
              </div>
            )}

            <div className="max-h-[60vh] sm:max-h-[420px] overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="text-center py-10 px-6">
                  <div className="h-12 w-12 rounded-full bg-brand-soft mx-auto flex items-center justify-center mb-3">
                    <Bell className="h-6 w-6 text-brand" />
                  </div>
                  <p className="font-semibold text-sm">Nenhuma notificação</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Você verá aqui o status dos seus pedidos e novidades das lojas favoritas.
                  </p>
                </div>
              ) : (
                <ul>
                  {notifications.map((n) => (
                    <li key={n.id}>
                      <button
                        onClick={() => handleClickItem(n)}
                        className={`w-full text-left px-4 py-3 flex items-start gap-3 border-b border-border hover:bg-muted/40 transition ${
                          !n.is_read ? "bg-brand-soft/30" : ""
                        }`}
                      >
                        <div className="h-10 w-10 rounded-full bg-brand-soft flex items-center justify-center text-lg shrink-0 overflow-hidden relative">
                          {n.image_url ? (
                            <img src={n.image_url} alt="" className="h-full w-full object-cover" loading="lazy" />
                          ) : (
                            <span>{n.emoji ?? "🔔"}</span>
                          )}
                          <span className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full bg-card border border-border flex items-center justify-center">
                            {n.type === "order_status" ? (
                              <Package className="h-2.5 w-2.5 text-brand" />
                            ) : n.type === "reel" ? (
                              <Film className="h-2.5 w-2.5 text-brand" />
                            ) : (
                              <ImageIcon className="h-2.5 w-2.5 text-brand" />
                            )}
                          </span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className={`text-sm truncate ${!n.is_read ? "font-bold" : "font-semibold"}`}>
                              {n.title}
                            </p>
                            {!n.is_read && <span className="h-2 w-2 rounded-full bg-brand shrink-0" />}
                          </div>
                          {n.body && (
                            <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{n.body}</p>
                          )}
                          <p className="text-[10px] text-muted-foreground mt-1">
                            {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: ptBR })}
                          </p>
                        </div>
                        <button
                          onClick={(e) => removeOne(e, n.id)}
                          className="p-1 rounded-full hover:bg-destructive/10 text-muted-foreground hover:text-destructive shrink-0"
                          aria-label="Remover"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <Link
              to="/pedidos"
              onClick={() => setOpen(false)}
              className="block text-center text-xs font-semibold text-brand py-3 border-t border-border hover:bg-muted/40"
            >
              Ver meus pedidos
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
