import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, DollarSign, Tag, ListOrdered, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
  LabelList,
  PieChart,
  Pie,
} from "recharts";

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

type Grouping = "Diário" | "Semanal" | "Mensal";
type ChartTab = "pedidos" | "faturamento" | "pagamento";

export function GeneralReportTab({ storeId }: { storeId: string }) {
  const now = new Date();
  const [dateFrom, setDateFrom] = useState<Date>(subDays(now, 30));
  const [dateTo, setDateTo] = useState<Date>(now);
  const [grouping, setGrouping] = useState<Grouping>("Semanal");
  const [chartTab, setChartTab] = useState<ChartTab>("pedidos");

  // Fetch orders
  const { data: orders = [] } = useQuery({
    queryKey: ["general-report-orders", storeId, dateFrom.toISOString(), dateTo.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, total, delivery_fee, discount, created_at, status, payment_method, user_id, delivery_type")
        .eq("store_id", storeId)
        .gte("created_at", startOfDay(dateFrom).toISOString())
        .lte("created_at", endOfDay(dateTo).toISOString())
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Fetch bookings
  const { data: bookings = [] } = useQuery({
    queryKey: ["general-report-bookings", storeId, dateFrom.toISOString(), dateTo.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("id, total_price, created_at, status, payment_method, user_id")
        .eq("store_id", storeId)
        .gte("created_at", startOfDay(dateFrom).toISOString())
        .lte("created_at", endOfDay(dateTo).toISOString());
      if (error) throw error;
      return data ?? [];
    },
  });

  const stats = useMemo(() => {
    const completedOrders = orders.filter((o) => !["cancelado", "cancelled"].includes(o.status));
    const completedBookings = bookings.filter((b) => b.status === "completed");

    const orderRevenue = completedOrders.reduce((s, o) => s + Number(o.total || 0), 0);
    const bookingRevenue = completedBookings.reduce((s, b) => s + Number(b.total_price || 0), 0);
    const totalRevenue = orderRevenue + bookingRevenue;

    const totalCount = completedOrders.length + completedBookings.length;
    const avgTicket = totalCount > 0 ? totalRevenue / totalCount : 0;

    const uniqueUsers = new Set([
      ...completedOrders.map((o) => o.user_id),
      ...completedBookings.map((b) => b.user_id),
    ]);

    return { totalRevenue, avgTicket, totalCount, activeClients: uniqueUsers.size };
  }, [orders, bookings]);

  // Chart data
  const chartData = useMemo(() => {
    const completedOrders = orders.filter((o) => !["cancelado", "cancelled"].includes(o.status));

    if (chartTab === "pagamento") {
      const byMethod: Record<string, number> = {};
      for (const o of completedOrders) {
        const m = o.payment_method || "Não informado";
        byMethod[m] = (byMethod[m] || 0) + 1;
      }
      const completedBookings = bookings.filter((b) => b.status === "completed");
      for (const b of completedBookings) {
        const m = b.payment_method || "Não informado";
        byMethod[m] = (byMethod[m] || 0) + 1;
      }
      const COLORS = ["#7C3AED", "#A78BFA", "#5B21B6", "#8B5CF6", "#DDD6FE", "#6D28D9", "#EDE9FE"];
      return Object.entries(byMethod)
        .sort((a, b) => b[1] - a[1])
        .map(([name, value], i) => ({ name, value, fill: COLORS[i % COLORS.length] }));
    }

    // Group by weekday for "Semanal"
    if (grouping === "Semanal") {
      const weekData = WEEKDAYS.map((day) => ({ name: day, pedidos: 0, entregas: 0, faturamento: 0 }));
      for (const o of completedOrders) {
        const d = new Date(o.created_at).getDay();
        weekData[d].pedidos += 1;
        weekData[d].faturamento += Number(o.total || 0);
        if (o.delivery_type === "delivery") weekData[d].entregas += 1;
      }
      return weekData;
    }

    // Group by day for "Diário"
    if (grouping === "Diário") {
      const dayMap: Record<string, { name: string; pedidos: number; entregas: number; faturamento: number }> = {};
      for (const o of completedOrders) {
        const key = format(new Date(o.created_at), "dd/MM");
        if (!dayMap[key]) dayMap[key] = { name: key, pedidos: 0, entregas: 0, faturamento: 0 };
        dayMap[key].pedidos += 1;
        dayMap[key].faturamento += Number(o.total || 0);
        if (o.delivery_type === "delivery") dayMap[key].entregas += 1;
      }
      return Object.values(dayMap);
    }

    // Mensal
    const monthMap: Record<string, { name: string; pedidos: number; entregas: number; faturamento: number }> = {};
    for (const o of completedOrders) {
      const key = format(new Date(o.created_at), "MMM/yy", { locale: ptBR });
      if (!monthMap[key]) monthMap[key] = { name: key, pedidos: 0, entregas: 0, faturamento: 0 };
      monthMap[key].pedidos += 1;
      monthMap[key].faturamento += Number(o.total || 0);
      if (o.delivery_type === "delivery") monthMap[key].entregas += 1;
    }
    return Object.values(monthMap);
  }, [orders, bookings, grouping, chartTab]);

  const periodLabel = `${format(dateFrom, "dd/MM/yyyy")} - ${format(dateTo, "dd/MM/yyyy")}`;

  return (
    <div className="p-4 md:p-6 space-y-5">
      <h2 className="text-xl font-bold text-slate-800">Relatório Geral</h2>

      {/* Period filter */}
      <div className="flex flex-wrap items-center gap-3">
        <DatePicker label="De" date={dateFrom} onChange={setDateFrom} />
        <DatePicker label="Até" date={dateTo} onChange={setDateTo} />
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={<DollarSign className="h-5 w-5 text-blue-500" />} value={`R$ ${stats.totalRevenue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} label="Faturamento" />
        <StatCard icon={<Tag className="h-5 w-5 text-blue-500" />} value={`R$ ${stats.avgTicket.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} label="Ticket médio" />
        <StatCard icon={<ListOrdered className="h-5 w-5 text-blue-500" />} value={String(stats.totalCount)} label="Total de pedidos" />
        <StatCard icon={<Users className="h-5 w-5 text-blue-500" />} value={String(stats.activeClients)} label="Clientes ativos" />
      </div>

      {/* Chart tabs + grouping */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1 border-b">
          {([
            ["pedidos", "Pedidos e Entregas"],
            ["faturamento", "Faturamento"],
            ["pagamento", "Formas de pagamento"],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setChartTab(key)}
              className={cn(
                "px-3 py-2 text-sm font-medium border-b-2 transition-colors",
                chartTab === key ? "border-blue-500 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-700"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {chartTab !== "pagamento" && (
          <select
            value={grouping}
            onChange={(e) => setGrouping(e.target.value as Grouping)}
            className="rounded-lg border px-3 py-1.5 text-sm text-slate-700"
          >
            <option>Diário</option>
            <option>Semanal</option>
            <option>Mensal</option>
          </select>
        )}
      </div>

      {/* Period label */}
      <p className="text-xs text-slate-500">{periodLabel}</p>

      {/* Charts */}
      <div className="rounded-lg border bg-white p-4 shadow-sm" style={{ minHeight: 350 }}>
        {chartTab === "pagamento" ? (
          <div className="flex flex-col items-center">
            <ResponsiveContainer width="100%" height={320}>
              <PieChart>
                <Pie
                  data={chartData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={110}
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {chartData.map((entry: any, i: number) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        ) : chartTab === "faturamento" ? (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={chartData} barCategoryGap="20%">
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${v}`} />
              <Tooltip formatter={(v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} />
              <Bar dataKey="faturamento" fill="#3B82F6" radius={[4, 4, 0, 0]}>
                <LabelList dataKey="faturamento" position="top" fontSize={10} formatter={(v: number) => v > 0 ? `R$${v.toFixed(0)}` : ""} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={chartData} barCategoryGap="20%">
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="entregas" name="Entregas" fill="#1E40AF" radius={[4, 4, 0, 0]}>
                <LabelList dataKey="entregas" position="top" fontSize={10} />
              </Bar>
              <Bar dataKey="pedidos" name="Pedidos" fill="#93C5FD" radius={[4, 4, 0, 0]}>
                <LabelList dataKey="pedidos" position="top" fontSize={10} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="flex flex-col items-center rounded-xl border bg-white p-4 shadow-sm text-center">
      <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-blue-50">
        {icon}
      </div>
      <span className="text-lg font-bold text-slate-800">{value}</span>
      <span className="text-xs text-slate-500">{label}</span>
    </div>
  );
}

function DatePicker({ label, date, onChange }: { label: string; date: Date; onChange: (d: Date) => void }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium text-slate-600">{label}</span>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="h-9 w-[180px] justify-start text-left text-sm font-normal">
            <CalendarIcon className="mr-2 h-4 w-4" />
            {format(date, "dd/MM/yyyy")}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={date}
            onSelect={(d) => d && onChange(d)}
            initialFocus
            className={cn("p-3 pointer-events-auto")}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
