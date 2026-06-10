import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  CalendarClock,
  Home,
  Search,
  Heart,
  User,
  Receipt,
  ShoppingBag,
  X,
  AlertTriangle,
  Sparkles,
  CalendarPlus,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { SubscriptionBookingDialog } from "@/components/SubscriptionBookingDialog";

export const Route = createFileRoute("/agendamentos")({
  head: () => ({
    meta: [
      { title: "Meus agendamentos — Youapp" },
      { name: "description", content: "Acompanhe seus agendamentos no Youapp." },
    ],
  }),
  component: BookingsPage,
});

type BookedServiceItem = {
  service_id: string;
  name: string;
  duration_minutes: number;
  price: number;
  starts_at: string;
  ends_at: string;
};

type BookingRow = {
  id: string;
  starts_at: string;
  ends_at: string;
  status: "pending" | "confirmed" | "cancelled" | "completed";
  customer_notes: string | null;
  total_price: number;
  store_id: string;
  service_id: string;
  booked_services: BookedServiceItem[] | null;
  stores: { id: string; name: string; slug: string; emoji: string; image_url: string | null } | null;
  services: { id: string; name: string; duration_minutes: number } | null;
};

const STATUS_LABEL: Record<BookingRow["status"], { label: string; cls: string }> = {
  pending: { label: "Pendente", cls: "bg-warning/15 text-warning" },
  confirmed: { label: "Confirmado", cls: "bg-success/15 text-success" },
  cancelled: { label: "Cancelado", cls: "bg-destructive/15 text-destructive" },
  completed: { label: "Concluído", cls: "bg-muted text-muted-foreground" },
};

function BookingsPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ["my-bookings", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select(
          "id, starts_at, ends_at, status, customer_notes, total_price, store_id, service_id, booked_services, stores:stores(id, name, slug, emoji, image_url), services:services(id, name, duration_minutes)",
        )
        .eq("user_id", user!.id)
        .order("starts_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((b) => ({
        ...b,
        total_price: Number(b.total_price),
      })) as BookingRow[];
    },
  });

  type MySub = {
    subscription_id: string;
    store_id: string;
    store_name: string;
    store_slug: string;
    store_emoji: string | null;
    store_image_url: string | null;
    plan_id: string | null;
    plan_name: string;
    services_total: number;
    services_used: number;
    services_remaining: number;
    expires_at: string;
    status: string;
  };

  const [activeSub, setActiveSub] = useState<MySub | null>(null);

  const { data: mySubs = [] } = useQuery({
    queryKey: ["my-subscriptions", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_my_subscriptions");
      if (error) throw error;
      return (data ?? []) as MySub[];
    },
  });

  const cancel = async (id: string) => {
    if (!confirm("Cancelar este agendamento?")) return;
    const { error } = await supabase
      .from("bookings")
      .update({ status: "cancelled" })
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Agendamento cancelado");
    qc.invalidateQueries({ queryKey: ["my-bookings"] });
  };

  const upcoming = bookings.filter(
    (b) =>
      (b.status === "pending" || b.status === "confirmed") &&
      new Date(b.starts_at) >= new Date(Date.now() - 60 * 60_000),
  );
  const past = bookings.filter((b) => !upcoming.includes(b));

  return (
    <div className="min-h-screen bg-surface pb-24">
      <header className="sticky top-0 z-30 bg-card border-b border-border px-4 py-3 flex items-center gap-3">
        <Link to="/" className="p-1 -ml-1" aria-label="Voltar">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="font-semibold flex-1">Meus agendamentos</h1>
      </header>

      <main className="px-4 py-5 max-w-md mx-auto space-y-6">
        {mySubs.length > 0 && (
          <section>
            <h2 className="text-xs font-bold uppercase text-muted-foreground mb-2 px-1">
              Minhas assinaturas
            </h2>
            <div className="space-y-2">
              {mySubs.map((s) => {
                const remaining = s.services_remaining;
                const total = s.services_total;
                const pct = total > 0 ? Math.min(100, (s.services_used / total) * 100) : 0;
                const isActive = s.status === "active" && remaining > 0;
                const low = isActive && remaining <= 1;
                const ended = !isActive;
                return (
                  <article
                    key={s.subscription_id}
                    className={cn(
                      "bg-card rounded-2xl p-4 shadow-[var(--shadow-card)] border border-transparent",
                      low && "border-amber-500 bg-amber-50/50 dark:bg-amber-950/20",
                      ended && "opacity-80",
                    )}
                  >
                    <div className="flex items-start gap-3">
                      {s.store_image_url ? (
                        <img
                          src={s.store_image_url}
                          alt={s.store_name}
                          className="h-12 w-12 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="h-12 w-12 rounded-lg bg-brand-soft flex items-center justify-center text-2xl">
                          {s.store_emoji ?? "💈"}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-muted-foreground truncate">{s.store_name}</p>
                        <h3 className="font-semibold truncate flex items-center gap-1.5">
                          <Sparkles className="h-3.5 w-3.5 text-brand" />
                          {s.plan_name}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Válida até {new Date(s.expires_at).toLocaleDateString("pt-BR")}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "shrink-0 text-[11px] font-bold px-2 py-1 rounded-full",
                          ended
                            ? "bg-muted text-muted-foreground"
                            : low
                            ? "bg-amber-500 text-white"
                            : "bg-success/15 text-success",
                        )}
                      >
                        {remaining}/{total}
                      </span>
                    </div>
                    <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          ended ? "bg-muted-foreground/40" : low ? "bg-amber-500" : "bg-brand",
                        )}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    {low && (
                      <p className="mt-2 text-xs font-medium text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        Está acabando! Renove no estabelecimento.
                      </p>
                    )}
                    {ended && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Assinatura encerrada — procure {s.store_name} para renovar.
                      </p>
                    )}
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        disabled={ended}
                        onClick={() => setActiveSub(s)}
                        className={cn(
                          "flex-1 inline-flex items-center justify-center gap-1.5 rounded-full font-bold text-xs py-2.5 transition-colors",
                          ended
                            ? "bg-muted text-muted-foreground cursor-not-allowed"
                            : "bg-brand text-brand-foreground hover:bg-brand/90",
                        )}
                      >
                        <CalendarPlus className="h-3.5 w-3.5" />
                        Agendar pela assinatura
                      </button>
                      <Link
                        to="/loja/$slug"
                        params={{ slug: s.store_slug }}
                        className="inline-flex items-center justify-center rounded-full font-semibold text-xs py-2.5 px-4 border border-border text-foreground hover:bg-muted"
                      >
                        Ver loja
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}

        {activeSub && (
          <SubscriptionBookingDialog
            open={!!activeSub}
            onClose={() => setActiveSub(null)}
            subscriptionId={activeSub.subscription_id}
            storeId={activeSub.store_id}
            planId={activeSub.plan_id}
            planName={activeSub.plan_name}
            storeName={activeSub.store_name}
            onCreated={() => {
              qc.invalidateQueries({ queryKey: ["my-bookings"] });
              qc.invalidateQueries({ queryKey: ["my-subscriptions"] });
            }}
          />
        )}

        {isLoading ? (
          <p className="text-sm text-muted-foreground text-center py-12">Carregando...</p>
        ) : bookings.length === 0 ? (
          <div className="text-center py-16">
            <div className="h-16 w-16 rounded-full bg-brand-soft mx-auto flex items-center justify-center mb-4">
              <CalendarClock className="h-8 w-8 text-brand" />
            </div>
            <h2 className="font-bold text-lg">Nenhum agendamento ainda</h2>
            <p className="text-sm text-muted-foreground mt-1.5 max-w-xs mx-auto">
              Quando você agendar um serviço, ele aparece aqui.
            </p>
            <Link
              to="/"
              className="mt-6 inline-flex items-center gap-2 bg-brand text-brand-foreground font-bold px-5 py-2.5 rounded-full text-sm"
            >
              <ShoppingBag className="h-4 w-4" />
              Explorar lojas
            </Link>
          </div>
        ) : (
          <>
            {upcoming.length > 0 && (
              <section>
                <h2 className="text-xs font-bold uppercase text-muted-foreground mb-2 px-1">
                  Próximos
                </h2>
                <div className="space-y-2">
                  {upcoming.map((b) => (
                    <BookingCard key={b.id} b={b} onCancel={cancel} canCancel />
                  ))}
                </div>
              </section>
            )}
            {past.length > 0 && (
              <section>
                <h2 className="text-xs font-bold uppercase text-muted-foreground mb-2 px-1">
                  Histórico
                </h2>
                <div className="space-y-2">
                  {past.map((b) => (
                    <BookingCard key={b.id} b={b} onCancel={cancel} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>

      <nav className="fixed bottom-0 inset-x-0 bg-card border-t border-border z-30">
        <div className="mx-auto max-w-5xl grid grid-cols-5 px-2 py-2">
          {[
            { Icon: Home, label: "Início", to: "/" as const, active: false },
            { Icon: Search, label: "Busca", to: "/busca" as const, active: false },
            { Icon: Receipt, label: "Pedidos", to: "/pedidos" as const, active: false },
            { Icon: Heart, label: "Favoritos", to: (user ? "/favoritos" : "/auth") as "/favoritos" | "/auth", active: false },
            { Icon: User, label: "Perfil", to: (user ? "/perfil" : "/auth") as "/perfil" | "/auth", active: false },
          ].map(({ Icon, label, to, active }) => (
            <Link key={label} to={to} className="flex flex-col items-center gap-1 py-1">
              <Icon className={`h-5 w-5 ${active ? "text-brand" : "text-muted-foreground"}`} />
              <span className={`text-[11px] ${active ? "text-brand font-semibold" : "text-muted-foreground"}`}>
                {label}
              </span>
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}

function BookingCard({
  b,
  onCancel,
  canCancel,
}: {
  b: BookingRow;
  onCancel: (id: string) => void;
  canCancel?: boolean;
}) {
  const status = STATUS_LABEL[b.status];
  const start = new Date(b.starts_at);
  return (
    <article className="bg-card rounded-2xl p-4 shadow-[var(--shadow-card)]">
      <div className="flex items-start gap-3">
        {b.stores?.image_url ? (
          <img
            src={b.stores.image_url}
            alt={b.stores.name}
            className="h-12 w-12 rounded-lg object-cover"
          />
        ) : (
          <div className="h-12 w-12 rounded-lg bg-brand-soft flex items-center justify-center text-2xl">
            {b.stores?.emoji ?? "💼"}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground truncate">{b.stores?.name}</p>
          <h3 className="font-semibold truncate">
            {b.booked_services && b.booked_services.length > 0
              ? b.booked_services.map((s) => s.name).join(" + ")
              : b.services?.name ?? "Serviço"}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {format(start, "EEE, dd 'de' MMM 'às' HH:mm", { locale: ptBR })}
          </p>
          {b.booked_services && b.booked_services.length > 1 && (
            <div className="text-[11px] text-muted-foreground mt-0.5 space-y-0">
              {b.booked_services.map((s, i) => (
                <p key={i}>
                  {s.name}: {new Date(s.starts_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} - {new Date(s.ends_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </p>
              ))}
            </div>
          )}
        </div>
        <span
          className={`shrink-0 text-[11px] font-bold px-2 py-1 rounded-full ${status.cls}`}
        >
          {status.label}
        </span>
      </div>
      {b.customer_notes && (
        <p className="mt-3 text-xs text-muted-foreground bg-muted rounded-lg p-2.5">
          {b.customer_notes}
        </p>
      )}
      <div className="mt-3 flex items-center justify-between">
        <p className="text-sm font-bold">
          R$ {b.total_price.toFixed(2).replace(".", ",")}
        </p>
        {canCancel && b.status !== "cancelled" && (
          <button
            onClick={() => onCancel(b.id)}
            className="text-xs font-semibold text-destructive flex items-center gap-1"
          >
            <X className="h-3.5 w-3.5" /> Cancelar
          </button>
        )}
      </div>
    </article>
  );
}
