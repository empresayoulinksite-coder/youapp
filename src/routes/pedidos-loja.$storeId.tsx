import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowLeft,
  ChevronRight,
  ChevronLeft,
  MessageCircle,
  XCircle,
  RefreshCw,
  Phone,
  MapPin,
  Receipt,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import {
  KANBAN_COLUMNS,
  STATUS_LABEL,
  whatsappStatusMessage,
  shortOrderId,
  type OrderStatus,
} from "@/lib/order-status";
import { openWhatsapp } from "@/lib/whatsapp";
import { StoreStaffEditor } from "@/components/StoreStaffEditor";

export const Route = createFileRoute("/pedidos-loja/$storeId")({
  head: () => ({
    meta: [
      { title: "Gestor de pedidos — Youapp" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminOrdersPage,
});

type OrderItem = {
  id: string;
  name: string;
  quantity: number;
  unit_price: number;
  notes: string | null;
};

type OrderRow = {
  id: string;
  created_at: string;
  store_id: string;
  store_name: string;
  user_id: string;
  total: number;
  delivery_fee: number;
  discount: number;
  delivery_address: string | null;
  payment_method: string | null;
  customer_notes: string | null;
  status: OrderStatus;
  whatsapp_message: string;
  store_whatsapp: string | null;
  customer: { display_name: string | null; phone: string | null } | null;
  order_items: OrderItem[];
};

const fmtBRL = (n: number) => `R$ ${Number(n).toFixed(2).replace(".", ",")}`;

function AdminOrdersPage() {
  const { storeId } = Route.useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"orders" | "staff">("orders");

  // Checagem de acesso: dono, staff ativo ou admin
  const { data: access, isLoading: accessLoading } = useQuery({
    queryKey: ["pedidos-loja-access", storeId, user?.id],
    enabled: !!user?.id && !!storeId,
    queryFn: async () => {
      const [{ data: owner }, { data: staff }, { data: roles }] = await Promise.all([
        supabase
          .from("store_owners")
          .select("id")
          .eq("user_id", user!.id)
          .eq("store_id", storeId)
          .maybeSingle(),
        supabase
          .from("store_staff")
          .select("id")
          .eq("user_id", user!.id)
          .eq("store_id", storeId)
          .eq("is_active", true)
          .maybeSingle(),
        supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user!.id)
          .eq("role", "admin")
          .maybeSingle(),
      ]);
      const isOwner = !!owner;
      const isStaff = !!staff;
      const isAdmin = !!roles;
      return { allowed: isOwner || isStaff || isAdmin, isOwner, isStaff, isAdmin };
    },
  });

  // Loja
  const { data: store } = useQuery({
    queryKey: ["admin-orders-store", storeId],
    enabled: !!access?.allowed,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stores")
        .select("id, name, slug, whatsapp, image_url, emoji, store_type")
        .eq("id", storeId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Pedidos
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["admin-orders", storeId],
    enabled: !!user?.id && !!access?.allowed,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select(
          "id, created_at, store_id, store_name, user_id, total, delivery_fee, discount, delivery_address, payment_method, customer_notes, status, whatsapp_message, store_whatsapp, order_items(id, name, quantity, unit_price, notes)",
        )
        .eq("store_id", storeId)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;

      // Buscar dados do cliente (display_name, phone) em paralelo
      const userIds = Array.from(new Set((data ?? []).map((o) => o.user_id)));
      let customersMap = new Map<
        string,
        { display_name: string | null; phone: string | null }
      >();
      if (userIds.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("user_id, display_name, phone")
          .in("user_id", userIds);
        (profs ?? []).forEach((p) =>
          customersMap.set(p.user_id, {
            display_name: p.display_name,
            phone: p.phone,
          }),
        );
      }

      return (data ?? []).map((o) => ({
        ...o,
        total: Number(o.total),
        delivery_fee: Number(o.delivery_fee),
        discount: Number(o.discount),
        order_items: (o.order_items ?? []).map((it) => ({
          ...it,
          unit_price: Number(it.unit_price),
        })),
        customer: customersMap.get(o.user_id) ?? null,
      })) as OrderRow[];
    },
  });

  // Realtime: novos pedidos e mudanças de status
  useEffect(() => {
    if (!storeId) return;
    const channel = supabase
      .channel(`admin-orders-${storeId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `store_id=eq.${storeId}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: ["admin-orders", storeId] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [storeId, qc]);

  useEffect(() => {
    if (!authLoading && !user) router.navigate({ to: "/auth" });
  }, [authLoading, user, router]);

  const grouped = useMemo(() => {
    const map: Record<string, OrderRow[]> = {
      em_analise: [],
      em_producao: [],
      pronto: [],
      entregue: [],
    };
    orders.forEach((o) => {
      if (o.status === "cancelado") return;
      if (map[o.status]) map[o.status].push(o);
    });
    return map;
  }, [orders]);

  async function updateStatus(
    order: OrderRow,
    next: OrderStatus,
    sendWhats = false,
  ) {
    const { error } = await supabase
      .from("orders")
      .update({ status: next })
      .eq("id", order.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Pedido #${shortOrderId(order.id)} → ${STATUS_LABEL[next].label}`);
    qc.invalidateQueries({ queryKey: ["admin-orders", storeId] });

    if (sendWhats) {
      const phone = order.customer?.phone;
      if (!phone) {
        toast.error("Cliente sem WhatsApp cadastrado.");
        return;
      }
      openWhatsapp(
        phone,
        whatsappStatusMessage(next, order.store_name, shortOrderId(order.id)),
      );
    }
  }

  if (authLoading || accessLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-sm text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  if (!access?.allowed) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 px-4 text-center">
        <h1 className="text-xl font-bold">Acesso restrito</h1>
        <p className="text-sm text-muted-foreground max-w-sm">
          Você não tem permissão para gerenciar os pedidos desta loja. Peça ao dono para te adicionar como funcionário.
        </p>
      </div>
    );
  }

  if (!store) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-sm text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  const canManageStaff = !!access.isOwner || !!access.isAdmin;

  return (
    <div>
      <header className="mb-4 flex items-center gap-3">
        <button
          onClick={() => router.history.back()}
          className="rounded-full p-2 hover:bg-muted"
          aria-label="Voltar"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        {store.image_url ? (
          <img
            src={store.image_url}
            alt={store.name}
            className="h-12 w-12 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-xl">
            {store.emoji}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-bold">Pedidos · {store.name}</h1>
          <p className="text-xs text-muted-foreground">
            {orders.filter((o) => o.status !== "entregue" && o.status !== "cancelado").length} ativos · atualiza ao vivo
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => qc.invalidateQueries({ queryKey: ["admin-orders", storeId] })}
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Atualizar
        </Button>
      </header>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList>
          <TabsTrigger value="orders" className="gap-1.5">
            <Receipt className="h-4 w-4" />
            Pedidos
          </TabsTrigger>
          <TabsTrigger value="staff" className="gap-1.5">
            <Users className="h-4 w-4" />
            Funcionários
          </TabsTrigger>
        </TabsList>

        <TabsContent value="orders" className="mt-4">
          {isLoading ? (
            <p className="py-12 text-center text-sm text-muted-foreground">Carregando pedidos...</p>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              {KANBAN_COLUMNS.map((col) => (
                <KanbanColumn
                  key={col.id}
                  title={col.label}
                  headerBg={col.headerBg}
                  columnBg={col.columnBg}
                  count={grouped[col.id]?.length ?? 0}
                >
                  {(grouped[col.id] ?? []).length === 0 ? (
                    <p className="text-center text-xs text-white/80 py-8 px-2">
                      Nenhum pedido por aqui.
                    </p>
                  ) : (
                    grouped[col.id]!.map((o) => (
                      <OrderCard
                        key={o.id}
                        order={o}
                        onAdvance={(next, sendWhats) =>
                          updateStatus(o, next, sendWhats)
                        }
                        onCancel={() => updateStatus(o, "cancelado")}
                      />
                    ))
                  )}
                </KanbanColumn>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="staff" className="mt-4">
          <div className="rounded-lg border bg-card p-4">
            <StoreStaffEditor storeId={storeId} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function KanbanColumn({
  title,
  headerBg,
  columnBg,
  count,
  children,
}: {
  title: string;
  headerBg: string;
  columnBg: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div className={`rounded-lg overflow-hidden flex flex-col min-h-[60vh] ${columnBg}`}>
      <div className={`${headerBg} px-3 py-2 flex items-center justify-between text-white`}>
        <span className="text-sm font-bold">{title}</span>
        <span className="text-sm font-bold">{count}</span>
      </div>
      <div className="flex-1 space-y-2 p-2 overflow-y-auto">{children}</div>
    </div>
  );
}

const NEXT_STATUS: Record<
  Exclude<OrderStatus, "cancelado" | "entregue">,
  OrderStatus
> = {
  em_analise: "em_producao",
  em_producao: "pronto",
  pronto: "entregue",
};

const PREV_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  em_producao: "em_analise",
  pronto: "em_producao",
  entregue: "pronto",
};

function OrderCard({
  order,
  onAdvance,
  onCancel,
}: {
  order: OrderRow;
  onAdvance: (next: OrderStatus, sendWhats: boolean) => void;
  onCancel: () => void;
}) {
  const [open, setOpen] = useState(false);
  const itemsCount = order.order_items.reduce((s, i) => s + i.quantity, 0);
  const customerName = order.customer?.display_name ?? "Cliente";
  const next = NEXT_STATUS[order.status as keyof typeof NEXT_STATUS];
  const prev = PREV_STATUS[order.status];
  const phone = order.customer?.phone;

  return (
    <div className="rounded-lg bg-white shadow-sm overflow-hidden text-foreground">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left px-3 py-2"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-bold text-muted-foreground">
            #{shortOrderId(order.id)}
          </span>
          <span className="text-[10px] text-muted-foreground">
            {format(new Date(order.created_at), "HH:mm", { locale: ptBR })}
          </span>
        </div>
        <p className="mt-0.5 text-sm font-semibold truncate">{customerName}</p>
        <p className="text-xs text-muted-foreground truncate">
          {itemsCount} {itemsCount === 1 ? "item" : "itens"} ·{" "}
          <span className="font-semibold text-foreground">{fmtBRL(order.total)}</span>
        </p>
      </button>

      {open && (
        <div className="border-t px-3 py-2 space-y-2 bg-muted/40">
          <div className="space-y-1">
            {order.order_items.map((it) => (
              <div key={it.id} className="text-xs flex justify-between gap-2">
                <span className="truncate">
                  {it.quantity}x {it.name}
                </span>
                <span className="text-muted-foreground shrink-0">
                  {fmtBRL(it.unit_price * it.quantity)}
                </span>
              </div>
            ))}
          </div>
          {order.delivery_address && (
            <p className="text-xs text-muted-foreground flex items-start gap-1">
              <MapPin className="h-3 w-3 mt-0.5 shrink-0" />
              {order.delivery_address}
            </p>
          )}
          {order.payment_method && (
            <p className="text-xs text-muted-foreground">
              💳 {order.payment_method}
            </p>
          )}
          {order.customer_notes && (
            <p className="text-xs italic text-muted-foreground">
              "{order.customer_notes}"
            </p>
          )}
          {phone && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Phone className="h-3 w-3" /> {phone}
            </p>
          )}
        </div>
      )}

      <div className="flex items-center gap-1 border-t bg-white px-2 py-1.5">
        {prev && (
          <button
            type="button"
            onClick={() => onAdvance(prev, false)}
            className="rounded p-1.5 hover:bg-muted text-muted-foreground"
            title="Voltar status"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}
        {next && (
          <button
            type="button"
            onClick={() => onAdvance(next, false)}
            className="flex-1 inline-flex items-center justify-center gap-1 rounded bg-primary text-primary-foreground text-xs font-semibold py-1.5 px-2 hover:opacity-90"
          >
            Avançar
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        )}
        {next && phone && (
          <button
            type="button"
            onClick={() => onAdvance(next, true)}
            className="inline-flex items-center justify-center gap-1 rounded bg-emerald-600 text-white text-xs font-semibold py-1.5 px-2 hover:opacity-90"
            title="Avançar e avisar no WhatsApp"
          >
            <MessageCircle className="h-3.5 w-3.5" />
          </button>
        )}
        {order.status !== "entregue" && (
          <button
            type="button"
            onClick={() => {
              if (confirm("Cancelar este pedido?")) onCancel();
            }}
            className="rounded p-1.5 hover:bg-destructive/10 text-destructive"
            title="Cancelar"
          >
            <XCircle className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
