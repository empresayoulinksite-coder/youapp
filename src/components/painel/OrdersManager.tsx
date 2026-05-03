import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Search,
  Plus,
  Settings as SettingsIcon,
  Bike,
  ShoppingBag,
  Clock,
  Phone,
  MapPin,
  CreditCard,
  ChevronRight,
  ChevronLeft,
  X,
  Printer,
  MessageCircle,
  AlertCircle,
  Volume2,
  VolumeX,
  Pencil,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

type OrderStatus = "em_analise" | "em_producao" | "pronto" | "entregue" | "cancelado";

type OrderItem = {
  id: string;
  name: string;
  quantity: number;
  unit_price: number;
  notes: string | null;
  emoji: string | null;
  selected_size: string | null;
  pizza_size_name: string | null;
  pizza_crust_name: string | null;
  pizza_flavors: unknown;
  pizza_addons: unknown;
  half_two_name: string | null;
};

type Order = {
  id: string;
  order_number: number | null;
  status: OrderStatus;
  total: number;
  delivery_fee: number;
  discount: number;
  payment_method: string | null;
  delivery_address: string | null;
  delivery_type: string | null;
  customer_notes: string | null;
  store_id: string;
  user_id: string;
  created_at: string;
  accepted_at: string | null;
  ready_at: string | null;
  delivered_at: string | null;
  cancelled_at: string | null;
  profiles?: { display_name: string | null; phone: string | null } | null;
  order_items?: OrderItem[];
};

type StoreSettings = {
  id: string;
  name: string;
  whatsapp: string | null;
  auto_accept_orders: boolean;
  time_producao_balcao_min: number;
  time_producao_balcao_max: number;
  time_producao_delivery_min: number;
  time_producao_delivery_max: number;
};

type Filter = "todos" | "delivery" | "pickup";

const STATUS_LABEL: Record<OrderStatus, string> = {
  em_analise: "Em análise",
  em_producao: "Em produção",
  pronto: "Pronto",
  entregue: "Entregue",
  cancelado: "Cancelado",
};

function isPickup(o: Order) {
  return (o.delivery_type ?? "").toLowerCase().includes("retir") ||
    (o.delivery_type ?? "").toLowerCase() === "pickup" ||
    !o.delivery_address;
}

function getCustomerInfo(order: Order, profile?: { display_name: string | null; phone: string | null }) {
  if (order.customer_notes) {
    const match = order.customer_notes.match(/Cliente: (.*?) \| Fone: (.*?) \| Doc:/);
    if (match) {
      const name = match[1].trim();
      const phone = match[2].trim();
      if (name || phone) {
        return {
          display_name: name || "Cliente PDV",
          phone: phone || null,
        };
      }
    }
  }
  return profile;
}

function formatCurrency(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function elapsedMinutes(from: string) {
  return Math.max(0, Math.floor((Date.now() - new Date(from).getTime()) / 60000));
}

function formatHM(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function OrdersManager({ storeId, fullScreen = false, onEditOrder }: { storeId: string; fullScreen?: boolean; onEditOrder?: (o: Order, c?: any) => void }) {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<Filter>("todos");
  const [search, setSearch] = useState("");
  const [soundOn, setSoundOn] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [detailOrder, setDetailOrder] = useState<Order | null>(null);
  const [cancelOrder, setCancelOrder] = useState<Order | null>(null);
  const [, setTick] = useState(0);
  const lastIdsRef = useRef<Set<string>>(new Set());
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const initRef = useRef(false);

  useEffect(() => {
    const i = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(i);
  }, []);

  useEffect(() => {
    audioRef.current = new Audio(
      "data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQBvT18AAA==",
    );
  }, []);

  function playBeep() {
    if (!soundOn) return;
    try {
      const Ctor = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
      const ctx = new Ctor();
      const now = ctx.currentTime;
      [0, 0.18, 0.36].forEach((t) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.setValueAtTime(880, now + t);
        gain.gain.setValueAtTime(0.0001, now + t);
        gain.gain.exponentialRampToValueAtTime(0.4, now + t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + t + 0.15);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now + t);
        osc.stop(now + t + 0.16);
      });
      setTimeout(() => ctx.close(), 1500);
    } catch {
    }
  }

  const { data: store, isLoading: loadingStore } = useQuery({
    queryKey: ["orders-manager-store", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stores")
        .select(
          "id, name, whatsapp, auto_accept_orders, time_producao_balcao_min, time_producao_balcao_max, time_producao_delivery_min, time_producao_delivery_max",
        )
        .eq("id", storeId)
        .maybeSingle();
      if (error) throw error;
      return data as StoreSettings | null;
    },
  });

  const { data: orders = [], isLoading: loadingOrders } = useQuery({
    queryKey: ["orders-manager", storeId],
    refetchOnMount: true,
    staleTime: 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select(
          `id, order_number, status, total, delivery_fee, discount, payment_method,
           delivery_address, delivery_type, customer_notes, store_id, user_id, created_at,
           accepted_at, ready_at, delivered_at, cancelled_at,
           order_items(id, name, quantity, unit_price, notes, emoji, selected_size,
             pizza_size_name, pizza_crust_name, pizza_flavors, pizza_addons, half_two_name)`,
        )
        .eq("store_id", storeId)
        .in("status", ["em_analise", "em_producao", "pronto"])
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as Order[];
    },
  });

  const userIds = useMemo(() => Array.from(new Set(orders.map((o) => o.user_id))), [orders]);
  const { data: profilesMap = {} } = useQuery({
    queryKey: ["orders-manager-profiles", storeId, userIds.join(",")],
    enabled: userIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, display_name, phone")
        .in("user_id", userIds);
      if (error) throw error;
      const map: Record<string, { display_name: string | null; phone: string | null }> = {};
      for (const p of data ?? []) map[p.user_id] = { display_name: p.display_name, phone: p.phone };
      return map;
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel(`orders-${storeId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `store_id=eq.${storeId}` },
        () => {
          qc.invalidateQueries({ queryKey: ["orders-manager", storeId] });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "order_items" },
        () => {
          qc.invalidateQueries({ queryKey: ["orders-manager", storeId] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [storeId, qc]);

  useEffect(() => {
    const ids = new Set(orders.map((o) => o.id));
    if (!initRef.current) {
      initRef.current = true;
      lastIdsRef.current = ids;
      return;
    }
    const fresh = orders.filter((o) => !lastIdsRef.current.has(o.id) && o.status === "em_analise");
    if (fresh.length > 0) {
      playBeep();
      toast.info(`${fresh.length} novo(s) pedido(s)!`);
    }
    lastIdsRef.current = ids;
  }, [orders]);

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: OrderStatus }) => {
      const { error } = await supabase.from("orders").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orders-manager", storeId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return orders.filter((o) => {
      if (filter === "delivery" && isPickup(o)) return false;
      if (filter === "pickup" && !isPickup(o)) return false;
      if (!s) return true;
      const num = String(o.order_number ?? "");
      const cInfo = getCustomerInfo(o, profilesMap[o.user_id]);
      const name = (cInfo?.display_name ?? "").toLowerCase();
      const phone = (cInfo?.phone ?? "").toLowerCase();
      return num.includes(s) || name.includes(s) || phone.includes(s);
    });
  }, [orders, filter, search, profilesMap]);

  const cols: { key: OrderStatus; label: string; tone: string }[] = [
    { key: "em_analise", label: "Em análise", tone: "bg-[#f46a00]" },
    { key: "em_producao", label: "Em produção", tone: "bg-[#f59e0b]" },
    { key: "pronto", label: "Prontos para entrega", tone: "bg-[#008e56]" },
  ];

  const grouped: Record<OrderStatus, Order[]> = {
    em_analise: filtered.filter((o) => o.status === "em_analise"),
    em_producao: filtered.filter((o) => o.status === "em_producao"),
    pronto: filtered.filter((o) => o.status === "pronto"),
    entregue: [],
    cancelado: [],
  };

  if (loadingStore || loadingOrders) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-3", fullScreen && "h-full")}>
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-md border bg-card p-0.5">
          <FilterBtn active={filter === "todos"} onClick={() => setFilter("todos")} activeClass="bg-[#661f71] text-white">
            Todos
          </FilterBtn>
          <FilterBtn active={filter === "delivery"} onClick={() => setFilter("delivery")}>
            <Bike className="h-4 w-4" />
          </FilterBtn>
          <FilterBtn active={filter === "pickup"} onClick={() => setFilter("pickup")}>
            <ShoppingBag className="h-4 w-4" />
          </FilterBtn>
        </div>

        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por cliente ou nº do pedido"
            className="pl-9"
          />
        </div>

        <Button
          variant="outline"
          size="icon"
          onClick={() => setSoundOn((v) => !v)}
          title={soundOn ? "Som ativado" : "Som desativado"}
        >
          {soundOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
        </Button>

        <Button variant="outline" size="icon" onClick={() => setSettingsOpen(true)} title="Configurações">
          <SettingsIcon className="h-4 w-4" />
        </Button>
      </div>

      <div className={cn("grid gap-3", "grid-cols-1 md:grid-cols-3", fullScreen && "min-h-0 flex-1")}>
        {cols.map((c) => (
          <div
            key={c.key}
            className={cn(
              "flex flex-col rounded-lg border bg-muted/30",
              fullScreen && "min-h-0",
            )}
          >
            <div className={cn("flex items-center justify-between rounded-t-lg px-3 py-2 text-white", c.tone)}>
              <span className="text-sm font-semibold">{c.label}</span>
              <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs font-bold">
                {grouped[c.key].length}
              </span>
            </div>

            {c.key === "em_analise" && (
              <div className="border-b bg-card p-3">
                <div className="mb-2 text-xs">
                  <span className="font-medium">Balcão:</span>{" "}
                  {store?.time_producao_balcao_min}–{store?.time_producao_balcao_max} min
                  <br />
                  <span className="font-medium">Delivery:</span>{" "}
                  {store?.time_producao_delivery_min}–{store?.time_producao_delivery_max} min
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id="auto-accept"
                    checked={!!store?.auto_accept_orders}
                    onCheckedChange={async (v) => {
                      const { error } = await supabase
                        .from("stores")
                        .update({ auto_accept_orders: v })
                        .eq("id", storeId);
                      if (error) toast.error(error.message);
                      else {
                        toast.success(v ? "Aceite automático ativado" : "Aceite automático desativado");
                        qc.invalidateQueries({ queryKey: ["orders-manager-store", storeId] });
                      }
                    }}
                  />
                  <Label htmlFor="auto-accept" className="text-xs">
                    Aceitar pedidos automaticamente
                  </Label>
                </div>
              </div>
            )}

            <div className={cn("flex-1 space-y-2 overflow-y-auto p-2", fullScreen && "min-h-0")}>
              {grouped[c.key].length === 0 ? (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  {c.key === "em_analise" && store?.auto_accept_orders
                    ? "Todos os pedidos são aceitos automaticamente"
                    : "Sem pedidos aqui"}
                </div>
              ) : (
                grouped[c.key].map((o) => (
                  <OrderCard
                    key={o.id}
                    order={o}
                    store={store ?? undefined}
                    customer={getCustomerInfo(o, profilesMap[o.user_id])}
                    onAdvance={() => {
                      const next: Record<OrderStatus, OrderStatus | null> = {
                        em_analise: "em_producao",
                        em_producao: "pronto",
                        pronto: "entregue",
                        entregue: null,
                        cancelado: null,
                      };
                      const ns = next[o.status];
                      if (ns) updateStatus.mutate({ id: o.id, status: ns });
                    }}
                    onCancel={() => setCancelOrder(o)}
                    onOpen={() => setDetailOrder(o)}
                    onRevert={() => {
                      const prev: Record<OrderStatus, OrderStatus | null> = {
                        em_analise: null,
                        em_producao: "em_analise",
                        pronto: "em_producao",
                        entregue: "pronto",
                        cancelado: null,
                      };
                      const ps = prev[o.status];
                      if (ps) updateStatus.mutate({ id: o.id, status: ps });
                    }}
                  />
                ))
              )}
            </div>
          </div>
        ))}
      </div>

      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        store={store ?? null}
        onSaved={() => qc.invalidateQueries({ queryKey: ["orders-manager-store", storeId] })}
      />

      <OrderDetailDialog
        order={detailOrder}
        customer={detailOrder ? getCustomerInfo(detailOrder, profilesMap[detailOrder.user_id]) : undefined}
        store={store ?? undefined}
        onClose={() => setDetailOrder(null)}
        onEditOrder={onEditOrder}
      />

      <AlertDialog open={!!cancelOrder} onOpenChange={(v) => !v && setCancelOrder(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar pedido?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O cliente será notificado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (cancelOrder) {
                  updateStatus.mutate({ id: cancelOrder.id, status: "cancelado" });
                  setCancelOrder(null);
                }
              }}
            >
              Cancelar pedido
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function FilterBtn({
  active,
  onClick,
  children,
  activeClass = "bg-primary text-primary-foreground"
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  activeClass?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium transition-colors",
        active ? activeClass : "text-muted-foreground hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}

function OrderCard({
  order,
  store,
  customer,
  onAdvance,
  onCancel,
  onOpen,
  onRevert,
}: {
  order: Order;
  store?: StoreSettings;
  customer?: { display_name: string | null; phone: string | null };
  onAdvance: () => void;
  onCancel: () => void;
  onOpen: () => void;
  onRevert: () => void;
}) {
  const pickup = isPickup(order);
  const elapsed = elapsedMinutes(order.created_at);

  const maxAllowed = pickup
    ? (store?.time_producao_balcao_max ?? 25) + 10
    : (store?.time_producao_delivery_max ?? 45) + 15;
  const late = order.status !== "pronto" && elapsed > maxAllowed;

  const advanceLabel: Record<OrderStatus, string> = {
    em_analise: "Aceitar pedido",
    em_producao: "Avançar pedido",
    pronto: "Finalizar pedido",
    entregue: "",
    cancelado: "",
  };

  const itemsCount = (order.order_items ?? []).reduce((s, it) => s + it.quantity, 0);

  return (
    <div className="rounded-md border bg-card shadow-sm">
      <button onClick={onOpen} className="flex w-full items-center justify-between border-b px-3 py-2 text-left">
        <div className="flex items-center gap-2 text-sm font-semibold">
          {pickup ? <ShoppingBag className="h-4 w-4 text-muted-foreground" /> : <Bike className="h-4 w-4 text-muted-foreground" />}
          Pedido #{order.order_number ?? "—"}
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          {formatHM(order.created_at)}
        </div>
      </button>

      <div className="space-y-2 p-3">
        {late && (
          <div className="flex items-center gap-1.5 rounded bg-destructive/10 px-2 py-1 text-xs font-semibold text-destructive">
            <AlertCircle className="h-3.5 w-3.5" /> Pedido atrasado · {elapsed} min
          </div>
        )}

        <div className="flex items-center justify-between text-xs">
          <span className="inline-flex items-center gap-1.5">
            <span className="rounded bg-muted px-1.5 py-0.5 font-semibold">{itemsCount}</span>
            <span className="font-medium">{customer?.display_name ?? "Cliente"}</span>
          </span>
          {customer?.phone && (
            <span className="text-muted-foreground">{customer.phone}</span>
          )}
        </div>

        <div className="flex items-start gap-1.5 rounded border bg-muted/30 px-2 py-1.5 text-xs">
          {pickup ? (
            <>
              <ShoppingBag className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span>Retirada no local</span>
            </>
          ) : (
            <>
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="line-clamp-2">{order.delivery_address}</span>
            </>
          )}
        </div>

        <div className="flex items-center justify-between text-xs">
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <CreditCard className="h-3.5 w-3.5" />
            {order.payment_method ?? "—"}
          </span>
          <span className="font-bold">{formatCurrency(order.total)}</span>
        </div>

        <div className="flex gap-2 pt-1">
          <Button variant="outline" size="sm" className="flex-1" onClick={onCancel}>
            <X className="h-3.5 w-3.5" />
            Cancelar
          </Button>
          {order.status !== "em_analise" && (
            <Button variant="outline" size="sm" className="px-2 text-muted-foreground" onClick={onRevert} title="Voltar etapa">
              <ChevronLeft className="h-4 w-4" />
            </Button>
          )}
          <Button size="sm" className="flex-1" onClick={onAdvance}>
            {advanceLabel[order.status]}
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function OrderDetailDialog({
  order,
  customer,
  store,
  onClose,
  onEditOrder,
}: {
  order: Order | null;
  customer?: { display_name: string | null; phone: string | null };
  store?: StoreSettings;
  onClose: () => void;
  onEditOrder?: (o: Order, c?: any) => void;
}) {
  if (!order) return null;
  const pickup = isPickup(order);

  function buildPrintHTML() {
    const itemsHTML = (order!.order_items ?? [])
      .map(
        (it) => `<tr><td>${it.quantity}x</td><td>${it.name}${it.notes ? `<br><small>${it.notes}</small>` : ""}</td><td style="text-align:right">${formatCurrency(it.unit_price * it.quantity)}</td></tr>`,
      )
      .join("");
    return `<!doctype html><html><head><meta charset="utf-8"><title>Pedido #${order!.order_number}</title>
      <style>body{font-family:monospace;padding:8px;max-width:300px;font-size:12px}h1{font-size:14px;margin:4px 0;text-align:center}h2{font-size:13px;margin:6px 0 2px}table{width:100%;border-collapse:collapse}td{padding:2px 0;vertical-align:top}.tot{border-top:1px dashed #000;padding-top:4px;margin-top:4px}</style>
      </head><body>
      <h1>${store?.name ?? "Pedido"}</h1>
      <h1>Pedido #${order!.order_number}</h1>
      <div>${formatHM(order!.created_at)} — ${pickup ? "Retirada" : "Delivery"}</div>
      <hr>
      <h2>Cliente</h2>
      <div>${customer?.display_name ?? "—"}</div>
      <div>${customer?.phone ?? ""}</div>
      ${pickup ? "" : `<h2>Endereço</h2><div>${order!.delivery_address ?? ""}</div>`}
      <hr>
      <table>${itemsHTML}</table>
      <div class="tot">Subtotal: ${formatCurrency(order!.total - (order!.delivery_fee ?? 0) + (order!.discount ?? 0))}</div>
      ${order!.delivery_fee ? `<div>Entrega: ${formatCurrency(order!.delivery_fee)}</div>` : ""}
      ${order!.discount ? `<div>Desconto: -${formatCurrency(order!.discount)}</div>` : ""}
      <div><strong>Total: ${formatCurrency(order!.total)}</strong></div>
      <div>Pagamento: ${order!.payment_method ?? "—"}</div>
      ${order!.customer_notes ? `<hr><div><strong>Obs:</strong> ${order!.customer_notes}</div>` : ""}
      <script>window.print();setTimeout(()=>window.close(),300);</script>
      </body></html>`;
  }

  function handlePrint() {
    const w = window.open("", "_blank", "width=380,height=600");
    if (!w) {
      toast.error("Permita pop-ups para imprimir");
      return;
    }
    w.document.write(buildPrintHTML());
    w.document.close();
  }

  function handleWhatsapp() {
    if (!customer?.phone) {
      toast.error("Cliente sem telefone");
      return;
    }
    const phone = customer.phone.replace(/\D/g, "");
    const msg = encodeURIComponent(
      `Olá ${customer.display_name ?? ""}! Sobre o seu pedido #${order!.order_number} no ${store?.name ?? ""}...`,
    );
    window.open(`https://wa.me/55${phone}?text=${msg}`, "_blank");
  }

  return (
    <Dialog open={!!order} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Pedido #{order.order_number}</DialogTitle>
          <DialogDescription>
            {formatHM(order.created_at)} · {pickup ? "Retirada no local" : "Delivery"} · {STATUS_LABEL[order.status]}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] space-y-3 overflow-y-auto">
          <div className="rounded border p-3 text-sm">
            <div className="font-semibold">{customer?.display_name ?? "Cliente"}</div>
            {customer?.phone && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Phone className="h-3 w-3" /> {customer.phone}
              </div>
            )}
            {!pickup && order.delivery_address && (
              <div className="mt-1.5 flex items-start gap-1.5 text-xs">
                <MapPin className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
                {order.delivery_address}
              </div>
            )}
          </div>

          <div className="rounded border">
            <div className="border-b px-3 py-1.5 text-xs font-semibold uppercase text-muted-foreground">
              Itens
            </div>
            <ul className="divide-y">
              {(order.order_items ?? []).map((it) => (
                <li key={it.id} className="flex justify-between gap-3 px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <div>
                      <span className="font-semibold">{it.quantity}x</span> {it.name}
                    </div>
                    {it.pizza_flavors && Array.isArray(it.pizza_flavors) && (it.pizza_flavors as any[]).length > 0 ? (
                      <div className="text-xs text-muted-foreground mt-0.5">
                        Sabores: {(it.pizza_flavors as any[]).map((f: any) => f.name).join(" e ")}
                      </div>
                    ) : null}
                    {it.pizza_size_name && (
                      <div className="text-xs text-muted-foreground">
                        Tam: {it.pizza_size_name}
                        {it.pizza_crust_name ? ` · Borda: ${it.pizza_crust_name}` : ""}
                      </div>
                    )}
                    {it.pizza_addons && Array.isArray(it.pizza_addons) && (it.pizza_addons as any[]).length > 0 ? (
                      <div className="text-xs text-muted-foreground">
                        Adicionais: {(it.pizza_addons as any[]).map((a: any) => a.name).join(", ")}
                      </div>
                    ) : null}
                    {it.half_two_name && (
                      <div className="text-xs text-muted-foreground">2ª metade: {it.half_two_name}</div>
                    )}
                    {it.notes && <div className="text-xs text-muted-foreground">{it.notes}</div>}
                  </div>
                  <div className="shrink-0 text-sm font-medium">
                    {formatCurrency(it.unit_price * it.quantity)}
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {order.customer_notes && (
            <div className="rounded border bg-amber-50 p-3 text-sm dark:bg-amber-950/30">
              <div className="text-xs font-semibold uppercase text-muted-foreground">Observações</div>
              {order.customer_notes}
            </div>
          )}

          <div className="space-y-1 rounded border p-3 text-sm">
            <Row label="Subtotal" value={formatCurrency(order.total - (order.delivery_fee ?? 0) + (order.discount ?? 0))} />
            {!!order.delivery_fee && <Row label="Entrega" value={formatCurrency(order.delivery_fee)} />}
            {!!order.discount && <Row label="Desconto" value={`-${formatCurrency(order.discount)}`} />}
            <Row label="Total" value={formatCurrency(order.total)} bold />
            <Row label="Pagamento" value={order.payment_method ?? "—"} />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" className="mr-auto" onClick={() => { if(onEditOrder && order) onEditOrder(order, customer); }}>
            <Pencil className="h-4 w-4 mr-1.5" /> Editar pedido
          </Button>
          <Button variant="outline" onClick={handleWhatsapp}>
            <MessageCircle className="h-4 w-4 mr-1.5" /> WhatsApp
          </Button>
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-1.5" /> Imprimir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={cn("flex justify-between", bold && "border-t pt-1 font-bold")}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function SettingsDialog({
  open,
  onOpenChange,
  store,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  store: StoreSettings | null;
  onSaved: () => void;
}) {
  const [bMin, setBMin] = useState(0);
  const [bMax, setBMax] = useState(0);
  const [dMin, setDMin] = useState(0);
  const [dMax, setDMax] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (store) {
      setBMin(store.time_producao_balcao_min);
      setBMax(store.time_producao_balcao_max);
      setDMin(store.time_producao_delivery_min);
      setDMax(store.time_producao_delivery_max);
    }
  }, [store]);

  async function save() {
    if (!store) return;
    setSaving(true);
    const { error } = await supabase
      .from("stores")
      .update({
        time_producao_balcao_min: bMin,
        time_producao_balcao_max: bMax,
        time_producao_delivery_min: dMin,
        time_producao_delivery_max: dMax,
      })
      .eq("id", store.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Tempos atualizados");
    onSaved();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tempos de produção</DialogTitle>
          <DialogDescription>
            Tempo estimado mostrado ao cliente para preparo do pedido.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="mb-2 block text-sm font-semibold">Balcão (retirada)</Label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs text-muted-foreground">Mínimo (min)</Label>
                <Input type="number" min={0} value={bMin} onChange={(e) => setBMin(+e.target.value)} />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Máximo (min)</Label>
                <Input type="number" min={0} value={bMax} onChange={(e) => setBMax(+e.target.value)} />
              </div>
            </div>
          </div>

          <div>
            <Label className="mb-2 block text-sm font-semibold">Delivery</Label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs text-muted-foreground">Mínimo (min)</Label>
                <Input type="number" min={0} value={dMin} onChange={(e) => setDMin(+e.target.value)} />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Máximo (min)</Label>
                <Input type="number" min={0} value={dMax} onChange={(e) => setDMax(+e.target.value)} />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

void Plus;
void Pencil;
