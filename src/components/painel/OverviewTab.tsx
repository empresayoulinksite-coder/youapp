import { useMemo, useState } from "react";
import { DollarSign, Calendar, CheckCircle2, XCircle, TrendingUp, Clock, Scissors, CreditCard } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { BookingRow } from "./BookingsTab";
import { PAYMENT_LABEL, isPaymentKey } from "@/lib/payment-methods";
import { Badge } from "@/components/ui/badge";

function brl(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 1);
}
function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export function OverviewTab({ bookings }: { bookings: BookingRow[] }) {
  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${now.getMonth()}`;
  const [monthKey, setMonthKey] = useState(currentMonthKey);
  const [selectedDay, setSelectedDay] = useState<number>(now.getDate());

  // Parse current month/year from key
  const [selYear, selMonth] = useMemo(() => {
    const [yStr, mStr] = monthKey.split("-");
    return [Number(yStr), Number(mStr)];
  }, [monthKey]);

  const isCurrentMonth = monthKey === currentMonthKey;

  // When month changes, reset day
  const handleMonthChange = (newKey: string) => {
    setMonthKey(newKey);
    if (newKey === currentMonthKey) {
      setSelectedDay(now.getDate());
    } else {
      setSelectedDay(1);
    }
  };

  // Day options for selected month
  const dayCount = useMemo(() => daysInMonth(selYear, selMonth), [selYear, selMonth]);

  // Build list of available months
  const monthOptions = useMemo(() => {
    const set = new Map<string, { year: number; month: number }>();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      set.set(`${d.getFullYear()}-${d.getMonth()}`, {
        year: d.getFullYear(),
        month: d.getMonth(),
      });
    }
    for (const b of bookings) {
      const d = new Date(b.starts_at);
      set.set(`${d.getFullYear()}-${d.getMonth()}`, {
        year: d.getFullYear(),
        month: d.getMonth(),
      });
    }
    return Array.from(set.entries())
      .map(([key, v]) => ({ key, ...v }))
      .sort((a, b) => (b.year - a.year) * 100 + (b.month - a.month));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookings]);

  const stats = useMemo(() => {
    const monthStart = new Date(selYear, selMonth, 1);
    const monthEnd = endOfMonth(monthStart);

    const dayStart = new Date(selYear, selMonth, selectedDay);
    const dayEnd = new Date(selYear, selMonth, selectedDay + 1);

    const completed = bookings.filter((b) => b.status === "completed");
    const cancelled = bookings.filter((b) => b.status === "cancelled");

    const completedDay = completed.filter((b) => {
      const t = new Date(b.starts_at);
      return t >= dayStart && t < dayEnd;
    });

    const completedMonth = completed.filter((b) => {
      const t = new Date(b.starts_at);
      return t >= monthStart && t < monthEnd;
    });

    const revenueDay = completedDay.reduce((s, b) => s + Number(b.total_price), 0);
    const revenueMonth = completedMonth.reduce((s, b) => s + Number(b.total_price), 0);

    const upcoming = isCurrentMonth
      ? bookings
          .filter((b) => (b.status === "pending" || b.status === "confirmed") && new Date(b.starts_at) >= now)
          .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())
          .slice(0, 5)
      : [];

    const ticketAvg = completedMonth.length > 0 ? revenueMonth / completedMonth.length : 0;

    const pending = isCurrentMonth ? bookings.filter((b) => b.status === "pending").length : 0;

    // Service ranking
    const serviceCount = new Map<string, number>();
    for (const b of completedMonth) {
      const name = b.services?.name ?? "Serviço";
      serviceCount.set(name, (serviceCount.get(name) ?? 0) + 1);
    }
    const topServices = Array.from(serviceCount.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    // Payment method ranking (month) — count + amount
    const paymentAgg = new Map<string, { count: number; amount: number }>();
    const addPayment = (label: string, amount: number) => {
      const cur = paymentAgg.get(label) ?? { count: 0, amount: 0 };
      cur.count += 1;
      cur.amount += amount;
      paymentAgg.set(label, cur);
    };
    for (const b of completedMonth) {
      if (!b.payment_method) continue;
      const total = Number(b.total_price) || 0;
      const hasSplit = !!b.payment_method_2;
      const amt1 = hasSplit ? Number(b.payment_amount_1) || 0 : total;
      const label1 = isPaymentKey(b.payment_method) ? PAYMENT_LABEL[b.payment_method] : b.payment_method;
      addPayment(label1, amt1);
      if (hasSplit && b.payment_method_2) {
        const amt2 = Number(b.payment_amount_2) || 0;
        const label2 = isPaymentKey(b.payment_method_2) ? PAYMENT_LABEL[b.payment_method_2] : b.payment_method_2;
        addPayment(label2, amt2);
      }
    }
    const topPayments = Array.from(paymentAgg.entries())
      .map(([name, v]) => ({ name, count: v.count, amount: v.amount }))
      .sort((a, b) => b.amount - a.amount);

    // Daily payment method ranking
    const dailyPaymentAgg = new Map<string, { count: number; amount: number }>();
    const addDaily = (label: string, amount: number) => {
      const cur = dailyPaymentAgg.get(label) ?? { count: 0, amount: 0 };
      cur.count += 1;
      cur.amount += amount;
      dailyPaymentAgg.set(label, cur);
    };
    for (const b of completedDay) {
      if (!b.payment_method) continue;
      const total = Number(b.total_price) || 0;
      const hasSplit = !!b.payment_method_2;
      const amt1 = hasSplit ? Number(b.payment_amount_1) || 0 : total;
      const label1 = isPaymentKey(b.payment_method) ? PAYMENT_LABEL[b.payment_method] : b.payment_method;
      addDaily(label1, amt1);
      if (hasSplit && b.payment_method_2) {
        const amt2 = Number(b.payment_amount_2) || 0;
        const label2 = isPaymentKey(b.payment_method_2) ? PAYMENT_LABEL[b.payment_method_2] : b.payment_method_2;
        addDaily(label2, amt2);
      }
    }
    const dailyTopPayments = Array.from(dailyPaymentAgg.entries())
      .map(([name, v]) => ({ name, count: v.count, amount: v.amount }))
      .sort((a, b) => b.amount - a.amount);

    return {
      revenueDay,
      revenueMonth,
      completedDay: completedDay.length,
      completedMonth: completedMonth.length,
      cancelledMonth: cancelled.filter((b) => {
        const t = new Date(b.starts_at);
        return t >= monthStart && t < monthEnd;
      }).length,
      ticketAvg,
      pending,
      upcoming,
      topServices,
      topPayments,
      dailyTopPayments,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookings, monthKey, selectedDay]);

  const selectedDate = new Date(selYear, selMonth, selectedDay);
  const dayLabel = selectedDate.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-xs text-muted-foreground">Período</p>
          <p className="text-sm font-semibold">
            {isCurrentMonth ? "Mês atual" : "Mês selecionado"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={monthKey} onValueChange={handleMonthChange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {monthOptions.map((o) => (
                <SelectItem key={o.key} value={o.key}>
                  {MONTH_NAMES[o.month]} {o.year}
                  {o.key === currentMonthKey ? " (atual)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(selectedDay)} onValueChange={(v) => setSelectedDay(Number(v))}>
            <SelectTrigger className="w-[90px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: dayCount }, (_, i) => i + 1).map((d) => (
                <SelectItem key={d} value={String(d)}>
                  Dia {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Resumo do dia selecionado */}
      <div className="rounded-lg border bg-card">
        <div className="border-b px-4 py-3 flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-semibold text-sm">Resumo do dia</h3>
          <span className="ml-auto text-xs text-muted-foreground">
            {dayLabel}
          </span>
        </div>
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-md bg-muted/50 p-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Atendimentos
              </div>
              <p className="mt-1 text-xl font-bold">{stats.completedDay}</p>
            </div>
            <div className="rounded-md bg-muted/50 p-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <DollarSign className="h-3.5 w-3.5" />
                Faturamento
              </div>
              <p className="mt-1 text-xl font-bold text-success">{brl(stats.revenueDay)}</p>
            </div>
          </div>
          {stats.dailyTopPayments.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1.5">
                <CreditCard className="h-3.5 w-3.5" />
                Formas de pagamento do dia
              </p>
              <div className="flex flex-wrap gap-2">
                {stats.dailyTopPayments.map((p) => (
                  <Badge key={p.name} variant="secondary" className="text-xs">
                    {p.name} · {brl(p.amount)} ({p.count}x)
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={DollarSign}
          label="Faturamento do dia"
          value={brl(stats.revenueDay)}
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
          label="Atendimentos do dia"
          value={String(stats.completedDay)}
        />
        <StatCard
          icon={Calendar}
          label="Atendimentos no mês"
          value={String(stats.completedMonth)}
        />
        {isCurrentMonth && (
          <StatCard
            icon={Clock}
            label="Pendentes de confirmação"
            value={String(stats.pending)}
            accent={stats.pending > 0 ? "text-amber-600" : undefined}
          />
        )}
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

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Top services */}
        <div className="rounded-lg border bg-card">
          <div className="border-b px-4 py-3 flex items-center gap-2">
            <Scissors className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-semibold text-sm">Serviços mais prestados</h3>
          </div>
          {stats.topServices.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              Nenhum atendimento concluído.
            </p>
          ) : (
            <ul className="divide-y">
              {stats.topServices.map((s, i) => (
                <li key={s.name} className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-sm">
                    <span className="font-medium text-muted-foreground mr-2">{i + 1}.</span>
                    {s.name}
                  </span>
                  <Badge variant="secondary" className="text-xs">{s.count}x</Badge>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Top payment methods */}
        <div className="rounded-lg border bg-card">
          <div className="border-b px-4 py-3 flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-semibold text-sm">Formas de pagamento</h3>
          </div>
          {stats.topPayments.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              Nenhum pagamento registrado.
            </p>
          ) : (
            <ul className="divide-y">
              {stats.topPayments.map((p, i) => (
                <li key={p.name} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <span className="text-sm min-w-0 truncate">
                    <span className="font-medium text-muted-foreground mr-2">{i + 1}.</span>
                    {p.name}
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm font-semibold text-success">{brl(p.amount)}</span>
                    <Badge variant="secondary" className="text-xs">{p.count}x</Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {isCurrentMonth && (
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
      )}
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
