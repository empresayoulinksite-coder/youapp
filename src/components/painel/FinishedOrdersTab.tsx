import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon, Search, ShoppingBag, DollarSign, TrendingUp, Receipt } from "lucide-react";
import { cn } from "@/lib/utils";

type Preset = "today" | "week" | "month" | "custom";
type TypeFilter = "all" | "delivery" | "balcao" | "mesa";

type FinishedOrder = {
  id: string;
  order_number: number | null;
  total: number;
  delivery_fee: number;
  discount: number;
  payment_method: string | null;
  delivery_address: string | null;
  delivery_type: string | null;
  customer_notes: string | null;
  table_number: number | null;
  created_at: string;
  delivered_at: string | null;
  user_id: string;
  order_items?: {
    id: string;
    name: string;
    quantity: number;
    unit_price: number;
    notes: string | null;
    emoji: string | null;
  }[];
  profiles?: { display_name: string | null; phone: string | null } | null;
};

function getRange(preset: Preset, custom: { from?: Date; to?: Date }) {
  const now = new Date();
  const start = new Date(now);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  if (preset === "today") {
    start.setHours(0, 0, 0, 0);
  } else if (preset === "week") {
    const day = start.getDay();
    start.setDate(start.getDate() - day);
    start.setHours(0, 0, 0, 0);
  } else if (preset === "month") {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
  } else if (preset === "custom") {
    if (custom.from) {
      start.setTime(custom.from.getTime());
      start.setHours(0, 0, 0, 0);
    }
    if (custom.to) {
      end.setTime(custom.to.getTime());
      end.setHours(23, 59, 59, 999);
    }
  }
  return { start, end };
}

function getTypeOf(o: FinishedOrder): TypeFilter {
  if (o.table_number) return "mesa";
  const t = (o.delivery_type ?? "").toLowerCase();
  if (t.includes("retir") || t.includes("balc") || t === "pickup") return "balcao";
  if (!o.delivery_address) return "balcao";
  return "delivery";
}

function getTypeLabel(t: TypeFilter) {
  if (t === "mesa") return "Mesa";
  if (t === "balcao") return "Balcão";
  if (t === "delivery") return "Delivery";
  return "Todos";
}

function getCustomerName(o: FinishedOrder) {
  if (o.customer_notes) {
    const m = o.customer_notes.match(/Cliente: (.*?) \|/);
    if (m) return m[1].trim() || "Cliente";
  }
  return o.profiles?.display_name || "Cliente";
}

function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function FinishedOrdersTab({ storeId }: { storeId: string }) {
  const [preset, setPreset] = useState<Preset>("today");
  const [customFrom, setCustomFrom] = useState<Date | undefined>();
  const [customTo, setCustomTo] = useState<Date | undefined>();
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [search, setSearch] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<FinishedOrder | null>(null);

  const { start, end } = useMemo(
    () => getRange(preset, { from: customFrom, to: customTo }),
    [preset, customFrom, customTo],
  );

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["finished-orders", storeId, start.toISOString(), end.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, order_items(*)")
        .eq("store_id", storeId)
        .eq("status", "entregue")
        .gte("created_at", start.toISOString())
        .lte("created_at", end.toISOString())
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;

      const userIds = Array.from(new Set((data ?? []).map((o: any) => o.user_id).filter(Boolean)));
      let profilesMap: Record<string, { display_name: string | null; phone: string | null }> = {};
      if (userIds.length) {
        const { data: profs } = await supabase.rpc("get_order_customers_basic", { p_user_ids: userIds as string[] });
        ((profs ?? []) as any[]).forEach((p: any) => {
          profilesMap[p.user_id] = { display_name: p.display_name, phone: p.phone };
        });
      }
      return (data ?? []).map((o: any) => ({
        ...o,
        profiles: profilesMap[o.user_id] ?? null,
      })) as FinishedOrder[];
    },
  });

  const filtered = useMemo(() => {
    return orders.filter((o) => {
      if (typeFilter !== "all" && getTypeOf(o) !== typeFilter) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const num = String(o.order_number ?? "").includes(q);
        const name = getCustomerName(o).toLowerCase().includes(q);
        if (!num && !name) return false;
      }
      return true;
    });
  }, [orders, typeFilter, search]);

  const stats = useMemo(() => {
    const total = filtered.reduce((acc, o) => acc + Number(o.total || 0), 0);
    const count = filtered.length;
    const avg = count > 0 ? total / count : 0;
    return { count, total, avg };
  }, [filtered]);

  return (
    <div className="space-y-4">
      {/* Filtros principais */}
      <div className="rounded-lg border bg-white p-4 shadow-sm space-y-3">
        <div className="flex flex-wrap gap-2">
          {(["today", "week", "month", "custom"] as Preset[]).map((p) => (
            <Button
              key={p}
              size="sm"
              variant={preset === p ? "default" : "outline"}
              onClick={() => setPreset(p)}
              className={cn(preset === p && "bg-[#4c1554] hover:bg-[#360e3c]")}
            >
              {p === "today" && "Hoje"}
              {p === "week" && "Esta semana"}
              {p === "month" && "Este mês"}
              {p === "custom" && "Personalizado"}
            </Button>
          ))}
        </div>

        {preset === "custom" && (
          <div className="flex flex-wrap gap-2 items-center">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <CalendarIcon className="h-4 w-4" />
                  {customFrom ? customFrom.toLocaleDateString("pt-BR") : "Data inicial"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={customFrom}
                  onSelect={setCustomFrom}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
            <span className="text-sm text-muted-foreground">até</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <CalendarIcon className="h-4 w-4" />
                  {customTo ? customTo.toLocaleDateString("pt-BR") : "Data final"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={customTo}
                  onSelect={setCustomTo}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {(["all", "balcao", "mesa", "delivery"] as TypeFilter[]).map((t) => (
            <Button
              key={t}
              size="sm"
              variant={typeFilter === t ? "secondary" : "outline"}
              onClick={() => setTypeFilter(t)}
            >
              {getTypeLabel(t)}
            </Button>
          ))}
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nº do pedido ou cliente"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="rounded-lg border bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <ShoppingBag className="h-4 w-4" />
            Pedidos finalizados
          </div>
          <p className="mt-1 text-2xl font-bold text-slate-800">{stats.count}</p>
        </div>
        <div className="rounded-lg border bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <DollarSign className="h-4 w-4" />
            Faturamento
          </div>
          <p className="mt-1 text-2xl font-bold text-emerald-600">{formatBRL(stats.total)}</p>
        </div>
        <div className="rounded-lg border bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <TrendingUp className="h-4 w-4" />
            Ticket médio
          </div>
          <p className="mt-1 text-2xl font-bold text-slate-800">{formatBRL(stats.avg)}</p>
        </div>
      </div>

      {/* Lista */}
      <div className="rounded-lg border bg-white shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Carregando...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center">
            <Receipt className="mx-auto h-10 w-10 text-muted-foreground/50" />
            <p className="mt-2 text-sm text-muted-foreground">
              Nenhum pedido finalizado no período selecionado.
            </p>
          </div>
        ) : (
          <ul className="divide-y">
            {filtered.map((o) => {
              const t = getTypeOf(o);
              const date = new Date(o.created_at);
              return (
                <li key={o.id}>
                  <button
                    onClick={() => setSelectedOrder(o)}
                    className="flex w-full items-center gap-3 p-3 text-left hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 font-bold text-sm shrink-0">
                      #{o.order_number ?? "?"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-slate-800 truncate">
                          {getCustomerName(o)}
                        </span>
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium uppercase text-slate-600">
                          {getTypeLabel(t)}
                        </span>
                        {o.table_number && (
                          <span className="rounded bg-purple-100 px-1.5 py-0.5 text-[10px] font-medium text-purple-700">
                            Mesa {o.table_number}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {date.toLocaleDateString("pt-BR")} {date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        {o.payment_method && ` • ${o.payment_method}`}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold text-emerald-600 text-sm">{formatBRL(Number(o.total))}</p>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Detalhe */}
      <Dialog open={!!selectedOrder} onOpenChange={(v) => !v && setSelectedOrder(null)}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Pedido #{selectedOrder?.order_number ?? "?"}
            </DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-3 text-sm">
              <div className="rounded-lg bg-slate-50 p-3 space-y-1">
                <p><span className="text-muted-foreground">Cliente:</span> <strong>{getCustomerName(selectedOrder)}</strong></p>
                {selectedOrder.profiles?.phone && (
                  <p><span className="text-muted-foreground">Telefone:</span> {selectedOrder.profiles.phone}</p>
                )}
                <p><span className="text-muted-foreground">Tipo:</span> {getTypeLabel(getTypeOf(selectedOrder))}</p>
                {selectedOrder.table_number && (
                  <p><span className="text-muted-foreground">Mesa:</span> {selectedOrder.table_number}</p>
                )}
                {selectedOrder.delivery_address && (
                  <p><span className="text-muted-foreground">Endereço:</span> {selectedOrder.delivery_address}</p>
                )}
                {selectedOrder.payment_method && (
                  <p><span className="text-muted-foreground">Pagamento:</span> {selectedOrder.payment_method}</p>
                )}
                <p>
                  <span className="text-muted-foreground">Data:</span>{" "}
                  {new Date(selectedOrder.created_at).toLocaleString("pt-BR")}
                </p>
              </div>

              <div>
                <p className="font-semibold text-slate-800 mb-2">Itens</p>
                <ul className="space-y-2">
                  {(selectedOrder.order_items ?? []).map((it) => (
                    <li key={it.id} className="flex justify-between gap-2 border-b pb-2 last:border-0">
                      <div className="flex-1">
                        <p className="font-medium">
                          {it.quantity}× {it.emoji ?? ""} {it.name}
                        </p>
                        {it.notes && (
                          <p className="text-xs text-muted-foreground mt-0.5">Obs: {it.notes}</p>
                        )}
                      </div>
                      <p className="font-medium shrink-0">
                        {formatBRL(Number(it.unit_price) * it.quantity)}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-lg bg-slate-50 p-3 space-y-1">
                {Number(selectedOrder.delivery_fee) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Taxa de entrega</span>
                    <span>{formatBRL(Number(selectedOrder.delivery_fee))}</span>
                  </div>
                )}
                {Number(selectedOrder.discount) > 0 && (
                  <div className="flex justify-between text-emerald-600">
                    <span>Desconto</span>
                    <span>− {formatBRL(Number(selectedOrder.discount))}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-base pt-1 border-t">
                  <span>Total</span>
                  <span className="text-emerald-600">{formatBRL(Number(selectedOrder.total))}</span>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
