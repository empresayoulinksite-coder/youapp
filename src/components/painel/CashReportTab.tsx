import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, Eye, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { CashSummaryDialog } from "./CashSummaryDialog";

const PAGE_SIZE = 10;

export function CashReportTab({ storeId }: { storeId: string }) {
  const now = new Date();
  const defaultFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);
  const [dateFrom, setDateFrom] = useState<Date>(defaultFrom);
  const [dateTo, setDateTo] = useState<Date>(now);
  const [page, setPage] = useState(1);
  const [viewingRegisterId, setViewingRegisterId] = useState<string | null>(null);

  const { data: registers = [], isLoading } = useQuery({
    queryKey: ["cash-report", storeId, dateFrom.toISOString(), dateTo.toISOString()],
    queryFn: async () => {
      const endOfDay = new Date(dateTo);
      endOfDay.setHours(23, 59, 59, 999);
      const { data, error } = await supabase
        .from("cash_registers")
        .select("*")
        .eq("store_id", storeId)
        .gte("opened_at", dateFrom.toISOString())
        .lte("opened_at", endOfDay.toISOString())
        .order("opened_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const totalPages = Math.max(1, Math.ceil(registers.length / PAGE_SIZE));
  const paged = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return registers.slice(start, start + PAGE_SIZE);
  }, [registers, page]);

  const formatDt = (dt: string | null) => {
    if (!dt) return "—";
    return format(new Date(dt), "dd/MM/yyyy - HH'h'mm", { locale: ptBR });
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <h2 className="text-xl font-bold text-slate-800">Relatório de Caixa</h2>

      {/* Date filters */}
      <div className="flex flex-wrap items-center gap-3">
        <DatePicker label="De" date={dateFrom} onChange={(d) => { setDateFrom(d); setPage(1); }} />
        <DatePicker label="Até" date={dateTo} onChange={(d) => { setDateTo(d); setPage(1); }} />
      </div>

      {/* Summary */}
      <p className="text-sm text-slate-500">
        Total de <span className="font-semibold text-slate-700">{registers.length}</span> registros
      </p>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-slate-50 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
              <th className="px-4 py-3">Nº do caixa</th>
              <th className="px-4 py-3">Abertura</th>
              <th className="px-4 py-3">Fechamento</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={5} className="py-8 text-center text-slate-400">Carregando...</td></tr>
            ) : paged.length === 0 ? (
              <tr><td colSpan={5} className="py-8 text-center text-slate-400">Nenhum registro encontrado</td></tr>
            ) : paged.map((r, i) => (
              <tr key={r.id} className={cn("border-b transition-colors hover:bg-slate-50", i % 2 === 0 ? "bg-white" : "bg-slate-25")}>
                <td className="px-4 py-3 font-medium text-slate-700">
                  #{r.id.slice(0, 8).toUpperCase()}
                </td>
                <td className="px-4 py-3 text-slate-600">{formatDt(r.opened_at)}</td>
                <td className="px-4 py-3 text-slate-600">{formatDt(r.closed_at)}</td>
                <td className="px-4 py-3">
                  {r.status === "open" ? (
                    <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                      Aberto
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-semibold text-orange-700">
                      Fechado
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setViewingRegisterId(r.id)}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2 text-sm text-slate-600">
          <span>{page} de {totalPages}</span>
          <Button variant="outline" size="icon" className="h-8 w-8" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Summary Dialog */}
      {viewingRegisterId && (
        <CashSummaryDialog
          open={!!viewingRegisterId}
          onClose={() => setViewingRegisterId(null)}
          registerId={viewingRegisterId}
          storeId={storeId}
        />
      )}
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
