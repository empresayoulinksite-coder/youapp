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
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export const Route = createFileRoute("/agendamentos")({
  head: () => ({
    meta: [
      { title: "Meus agendamentos — Youapp" },
      { name: "description", content: "Acompanhe seus agendamentos no Youapp." },
    ],
  }),
  component: BookingsPage,
});

type BookingRow = {
  id: string;
  starts_at: string;
  ends_at: string;
  status: "pending" | "confirmed" | "cancelled" | "completed";
  customer_notes: string | null;
  total_price: number;
  store_id: string;
  service_id: string;
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
          "id, starts_at, ends_at, status, customer_notes, total_price, store_id, service_id, stores:stores(id, name, slug, emoji, image_url), services:services(id, name, duration_minutes)",
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

      <nav className="fixed bottom-0 inset-x-0 z-30 bg-card border-t border-border shadow-[0_-2px_10px_rgba(0,0,0,0.04)]">
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
          <h3 className="font-semibold truncate">{b.services?.name ?? "Serviço"}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {format(start, "EEE, dd 'de' MMM 'às' HH:mm", { locale: ptBR })}
          </p>
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
