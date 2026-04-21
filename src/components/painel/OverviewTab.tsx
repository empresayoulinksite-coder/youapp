import { useMemo } from "react";
import { DollarSign, Calendar, CheckCircle2, XCircle, TrendingUp, Clock } from "lucide-react";
import type { BookingRow } from "./BookingsTab";

function brl(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function OverviewTab({ bookings }: { bookings: BookingRow[] }) {
  const stats = useMemo(() => {
    const now = new Date();
    const today = startOfDay(now);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const monthStart = startOfMonth(now);

    const completed = bookings.filter((b) => b.status === "completed");
    const cancelled = bookings.filter((b) => b.status === "cancelled");

    const completedToday = completed.filter((b) => {
      const t = new Date(b.starts_at);
      return t >= today && t < tomorrow;
    });
    const completedMonth = completed.filter((b) => new Date(b.starts_at) >= monthStart);

    const revenueToday = completedToday.reduce((s, b) => s + Number(b.total_price), 0);
    const revenueMonth = completedMonth.reduce((s, b) => s + Number(b.total_price), 0);

    const upcoming = bookings
      .filter((b) => (b.status === "pending" || b.status === "confirmed") && new Date(b.starts_at) >= now)
      .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())
      .slice(0, 5);

    const ticketAvg = completedMonth.length > 0 ? revenueMonth / completedMonth.length : 0;

    const pending = bookings.filter((b) => b.status === "pending").length;

    return {
      revenueToday,
      revenueMonth,
      completedToday: completedToday.length,
      completedMonth: completedMonth.length,
      cancelledMonth: cancelled.filter((b) => new Date(b.starts_at) >= monthStart).length,
      ticketAvg,
      pending,
      upcoming,
    };
  }, [bookings]);

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={DollarSign}
          label="Faturamento hoje"
          value={brl(stats.revenueToday)}
          accent="text-success"
        />
        <StatCard
          icon={TrendingUp}
          label="Faturamento do mês"
          value={brl(stats.revenueMonth)}
          accent="text-primary"
        />
        <StatCard
          icon={CheckCircle2}
          label="Atendimentos hoje"
          value={String(stats.completedToday)}
        />
        <StatCard
          icon={Calendar}
          label="Atendimentos no mês"
          value={String(stats.completedMonth)}
        />
        <StatCard
          icon={Clock}
          label="Pendentes de confirmação"
          value={String(stats.pending)}
          accent={stats.pending > 0 ? "text-amber-600" : undefined}
        />
        <StatCard
          icon={XCircle}
          label="Cancelados no mês"
          value={String(stats.cancelledMonth)}
          accent="text-destructive"
        />
        <StatCard
          icon={DollarSign}
          label="Ticket médio (mês)"
          value={brl(stats.ticketAvg)}
        />
      </div>

      <div className="rounded-lg border bg-card">
        <div className="border-b px-4 py-3">
          <h3 className="font-semibold text-sm">Próximos atendimentos</h3>
        </div>
        {stats.upcoming.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">
            Nada agendado.
          </p>
        ) : (
          <ul className="divide-y">
            {stats.upcoming.map((b) => {
              const t = new Date(b.starts_at);
              return (
                <li key={b.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {b.services?.name ?? "Serviço"} ·{" "}
                      {b.profiles?.display_name ?? "Cliente"}
                    </p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {t.toLocaleDateString("pt-BR", {
                        weekday: "short",
                        day: "2-digit",
                        month: "short",
                      })}{" "}
                      ·{" "}
                      {t.toLocaleTimeString("pt-BR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <span
                    className={
                      b.status === "pending"
                        ? "rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700"
                        : "rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary"
                    }
                  >
                    {b.status === "pending" ? "Pendente" : "Confirmado"}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className={`mt-1.5 text-2xl font-bold ${accent ?? ""}`}>{value}</p>
    </div>
  );
}
