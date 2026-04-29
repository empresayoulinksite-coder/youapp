import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNotificationSound } from "@/hooks/useNotificationSound";
import { Bell, BellOff } from "lucide-react";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import {
  ArrowLeft,
  Receipt,
  ShoppingBag,
  Home,
  Search,
  Heart,
  User,
  RefreshCw,
  MessageCircle,
  ChevronDown,
  ArrowUpDown,
  X,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import { openWhatsapp } from "@/lib/whatsapp";

const ordersSearchSchema = z.object({
  store: fallback(z.string(), "all").default("all"),
  status: fallback(
    z.enum(["all", "em_analise", "em_producao", "pronto", "entregue", "cancelado"]),
    "all",
  ).default("all"),
  sort: fallback(z.enum(["recent", "oldest", "highest", "lowest"]), "recent").default("recent"),
});

type OrdersSearch = z.infer<typeof ordersSearchSchema>;

export const Route = createFileRoute("/pedidos")({
  validateSearch: zodValidator(ordersSearchSchema),
  head: () => ({
    meta: [
      { title: "Meus pedidos — Youapp" },
      { name: "description", content: "Acompanhe seus pedidos no Youapp." },
    ],
  }),
  component: OrdersPage,
});

type OrderItem = {
  id: string;
  menu_item_id: string | null;
  name: string;
  quantity: number;
  unit_price: number;
  emoji: string | null;
  image_url: string | null;
};

type Order = {
  id: string;
  created_at: string;
  store_id: string;
  store_name: string;
  store_slug: string;
  store_emoji: string | null;
  store_image_url: string | null;
  store_whatsapp: string | null;
  total: number;
  discount: number;
  delivery_address: string | null;
  whatsapp_message: string;
  status: string;
  order_items: OrderItem[];
};

const fmtBRL = (n: number) => `R$ ${n.toFixed(2).replace(".", ",")}`;

const STATUS_OPTIONS: { value: "all" | "em_analise" | "em_producao" | "pronto" | "entregue" | "cancelado"; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "em_analise", label: "Em análise" },
  { value: "em_producao", label: "Em produção" },
  { value: "pronto", label: "Pronto" },
  { value: "entregue", label: "Entregue" },
  { value: "cancelado", label: "Cancelado" },
];

const SORT_OPTIONS: { value: "recent" | "oldest" | "highest" | "lowest"; label: string }[] = [
  { value: "recent", label: "Mais recentes" },
  { value: "oldest", label: "Mais antigos" },
  { value: "highest", label: "Maior valor" },
  { value: "lowest", label: "Menor valor" },
];

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  em_analise: { label: "Em análise", cls: "bg-orange-100 text-orange-700" },
  em_producao: { label: "Em produção", cls: "bg-amber-100 text-amber-700" },
  pronto: { label: "Pronto 🛵", cls: "bg-emerald-100 text-emerald-700" },
  entregue: { label: "Entregue", cls: "bg-success/15 text-success" },
  cancelado: { label: "Cancelado", cls: "bg-destructive/15 text-destructive" },
  // Compat com pedidos antigos
  sent: { label: "Em análise", cls: "bg-orange-100 text-orange-700" },
  preparing: { label: "Em produção", cls: "bg-amber-100 text-amber-700" },
  delivered: { label: "Entregue", cls: "bg-success/15 text-success" },
  cancelled: { label: "Cancelado", cls: "bg-destructive/15 text-destructive" },
};

function OrdersPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate({ from: "/pedidos" });
  const { store, status, sort } = Route.useSearch();
  const { reorder } = useCart();
  const [expanded, setExpanded] = useState<string | null>(null);
  const qc = useQueryClient();
  const { soundOn, setSoundOn, playDing } = useNotificationSound("client-orders-sound");
  const prevStatusRef = useRef<Map<string, string> | null>(null);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  // Realtime: cliente vê o status do pedido mudar ao vivo
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`my-orders-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "orders",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: ["my-orders", user.id] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, qc]);

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["my-orders", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select(
          "id, created_at, store_id, store_name, store_slug, store_emoji, store_image_url, store_whatsapp, total, discount, delivery_address, whatsapp_message, status, order_items(id, menu_item_id, name, quantity, unit_price, emoji, image_url)",
        )
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((o) => ({
        ...o,
        total: Number(o.total),
        discount: Number(o.discount),
        order_items: (o.order_items ?? []).map((it) => ({
          ...it,
          unit_price: Number(it.unit_price),
        })),
      })) as Order[];
    },
  });

  // Lojas únicas presentes nos pedidos
  const uniqueStores = useMemo(() => {
    const map = new Map<string, { id: string; name: string; emoji: string | null; image_url: string | null }>();
    orders.forEach((o) => {
      if (!map.has(o.store_id)) {
        map.set(o.store_id, { id: o.store_id, name: o.store_name, emoji: o.store_emoji, image_url: o.store_image_url });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [orders]);

  const filtered = useMemo(() => {
    let list = orders.slice();
    if (store !== "all") list = list.filter((o) => o.store_id === store);
    if (status !== "all") list = list.filter((o) => o.status === status);
    list.sort((a, b) => {
      switch (sort) {
        case "oldest":
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case "highest":
          return b.total - a.total;
        case "lowest":
          return a.total - b.total;
        case "recent":
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });
    return list;
  }, [orders, store, status, sort]);

  const hasActiveFilters = store !== "all" || status !== "all" || sort !== "recent";

  const handleReorder = async (order: Order) => {
    const validItems = order.order_items.filter((i) => i.menu_item_id);
    if (validItems.length === 0) {
      toast.error("Itens não disponíveis para reordenar.");
      return;
    }
    try {
      await reorder(
        order.store_id,
        validItems.map((i) => ({ menu_item_id: i.menu_item_id!, quantity: i.quantity })),
      );
      toast.success("Itens adicionados à sacola!");
      navigate({ to: "/sacola" });
    } catch {
      toast.error("Não foi possível reordenar.");
    }
  };

  const handleReopenWhatsapp = (order: Order) => {
    if (!order.store_whatsapp) {
      toast.error("Loja sem WhatsApp cadastrado.");
      return;
    }
    openWhatsapp(order.store_whatsapp, order.whatsapp_message);
  };

  return (
    <div className="min-h-screen bg-surface pb-24">
      <header className="sticky top-0 z-30 bg-card border-b border-border px-4 py-3 flex items-center gap-3">
        <Link to="/" className="p-1 -ml-1" aria-label="Voltar">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="font-semibold flex-1">Meus pedidos</h1>
      </header>

      <main className="px-4 py-5 max-w-md mx-auto">
        <Link
          to="/agendamentos"
          className="flex items-center justify-between bg-card rounded-2xl p-4 shadow-[var(--shadow-card)] mb-4"
        >
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-brand-soft flex items-center justify-center">
              <Receipt className="h-5 w-5 text-brand" />
            </div>
            <div>
              <p className="font-semibold text-sm">Meus agendamentos</p>
              <p className="text-xs text-muted-foreground">Serviços que você reservou</p>
            </div>
          </div>
          <span className="text-brand text-sm font-semibold">Ver</span>
        </Link>

        {orders.length > 0 && (
          <div className="bg-card rounded-2xl p-3 shadow-[var(--shadow-card)] mb-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase text-muted-foreground">Filtros</p>
              {hasActiveFilters && (
                <button
                  onClick={() =>
                    navigate({ search: { store: "all", status: "all", sort: "recent" } })
                  }
                  className="text-xs font-semibold text-brand inline-flex items-center gap-1"
                >
                  <X className="h-3 w-3" /> Limpar
                </button>
              )}
            </div>

            {/* Loja */}
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                Loja
              </label>
              <div className="flex gap-1.5 overflow-x-auto scrollbar-hide -mx-1 px-1 pb-1">
                <FilterChip
                  active={store === "all"}
                  onClick={() => navigate({ search: { store: "all", status, sort } })}
                >
                  Todas
                </FilterChip>
                {uniqueStores.map((s) => (
                  <FilterChip
                    key={s.id}
                    active={store === s.id}
                    onClick={() => navigate({ search: { store: s.id, status, sort } })}
                  >
                    {s.image_url ? (
                      <img src={s.image_url} alt="" className="inline-block h-4 w-4 rounded-full object-cover mr-1 -ml-0.5 align-[-2px]" />
                    ) : s.emoji ? (
                      <span className="mr-1">{s.emoji}</span>
                    ) : null}
                    {s.name}
                  </FilterChip>
                ))}
              </div>
            </div>

            {/* Status */}
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                Status
              </label>
              <div className="flex gap-1.5 overflow-x-auto scrollbar-hide -mx-1 px-1 pb-1">
                {STATUS_OPTIONS.map((opt) => (
                  <FilterChip
                    key={opt.value}
                    active={status === opt.value}
                    onClick={() => navigate({ search: { store, status: opt.value, sort } })}
                  >
                    {opt.label}
                  </FilterChip>
                ))}
              </div>
            </div>

            {/* Ordenação */}
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground block mb-1 flex items-center gap-1">
                <ArrowUpDown className="h-3 w-3" /> Ordenar por
              </label>
              <select
                value={sort}
                onChange={(e) =>
                  navigate({
                    search: { store, status, sort: e.target.value as typeof sort },
                  })
                }
                className="w-full rounded-full bg-muted px-3 py-2 text-sm font-semibold outline-none"
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {isLoading ? (
          <p className="text-sm text-muted-foreground text-center py-12">Carregando...</p>
        ) : orders.length === 0 ? (
          <div className="text-center py-12">
            <div className="h-16 w-16 rounded-full bg-brand-soft mx-auto flex items-center justify-center mb-4">
              <Receipt className="h-8 w-8 text-brand" />
            </div>
            <h2 className="font-bold text-lg">Você ainda não fez pedidos</h2>
            <p className="text-sm text-muted-foreground mt-1.5 max-w-xs mx-auto">
              Quando você finalizar um pedido, ele aparece aqui para acompanhar.
            </p>
            <Link
              to="/"
              className="mt-6 inline-flex items-center gap-2 bg-brand text-brand-foreground font-bold px-5 py-2.5 rounded-full text-sm"
            >
              <ShoppingBag className="h-4 w-4" />
              Explorar lojas
            </Link>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 bg-card rounded-2xl shadow-[var(--shadow-card)]">
            <p className="font-semibold text-sm">Nenhum pedido encontrado</p>
            <p className="text-xs text-muted-foreground mt-1">Tente ajustar os filtros.</p>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground px-1">
              {filtered.length} {filtered.length === 1 ? "pedido" : "pedidos"}
            </p>
            {filtered.map((o) => {
              const isOpen = expanded === o.id;
              const itemCount = o.order_items.reduce((s, i) => s + i.quantity, 0);
              const statusInfo = STATUS_LABEL[o.status] ?? STATUS_LABEL.em_analise;
              return (
                <article
                  key={o.id}
                  className="bg-card rounded-2xl p-4 shadow-[var(--shadow-card)]"
                >
                  <button
                    onClick={() => setExpanded(isOpen ? null : o.id)}
                    className="w-full flex items-start gap-3 text-left"
                  >
                    <div className="h-12 w-12 rounded-lg bg-brand-soft flex items-center justify-center text-2xl shrink-0 overflow-hidden">
                      {o.store_image_url ? (
                        <img
                          src={o.store_image_url}
                          alt={o.store_name}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        o.store_emoji ?? "🛍️"
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="font-semibold truncate">{o.store_name}</h3>
                        <ChevronDown
                          className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}
                        />
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${statusInfo.cls}`}
                        >
                          {statusInfo.label}
                        </span>
                        <p className="text-xs text-muted-foreground truncate">
                          {format(new Date(o.created_at), "dd 'de' MMM 'às' HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {itemCount} {itemCount === 1 ? "item" : "itens"} •{" "}
                        <span className="font-semibold text-foreground">{fmtBRL(o.total)}</span>
                      </p>
                    </div>
                  </button>

                  {isOpen && (
                    <div className="mt-3 pt-3 border-t border-border space-y-2">
                      {o.order_items.map((it) => (
                        <div key={it.id} className="flex items-center gap-2 text-sm">
                          <div className="h-8 w-8 rounded-md bg-brand-soft flex items-center justify-center text-base overflow-hidden shrink-0">
                            {it.image_url ? (
                              <img
                                src={it.image_url}
                                alt={it.name}
                                className="h-full w-full object-cover"
                                loading="lazy"
                              />
                            ) : (
                              it.emoji ?? "•"
                            )}
                          </div>
                          <span className="flex-1 truncate">
                            {it.quantity}x {it.name}
                          </span>
                          <span className="text-muted-foreground text-xs">
                            {fmtBRL(it.unit_price * it.quantity)}
                          </span>
                        </div>
                      ))}
                      {o.delivery_address && (
                        <p className="text-xs text-muted-foreground bg-muted rounded-lg p-2 mt-2">
                          📍 {o.delivery_address}
                        </p>
                      )}
                      <div className="flex gap-2 pt-2">
                        <button
                          onClick={() => handleReorder(o)}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 bg-brand text-brand-foreground font-semibold text-xs px-3 py-2 rounded-full"
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                          Pedir de novo
                        </button>
                        {o.store_whatsapp && (
                          <button
                            onClick={() => handleReopenWhatsapp(o)}
                            className="flex-1 inline-flex items-center justify-center gap-1.5 bg-muted text-foreground font-semibold text-xs px-3 py-2 rounded-full"
                          >
                            <MessageCircle className="h-3.5 w-3.5" />
                            Reabrir WhatsApp
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 inset-x-0 bg-card border-t border-border z-30">
        <div className="mx-auto max-w-5xl grid grid-cols-5 px-2 py-2">
          {[
            { Icon: Home, label: "Início", to: "/" as const, active: false },
            { Icon: Search, label: "Busca", to: "/busca" as const, active: false },
            { Icon: Receipt, label: "Pedidos", to: "/pedidos" as const, active: true },
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

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 whitespace-nowrap text-xs font-semibold px-3 py-1.5 rounded-full transition-colors ${
        active
          ? "bg-brand text-brand-foreground"
          : "bg-muted text-muted-foreground hover:bg-muted/70"
      }`}
    >
      {children}
    </button>
  );
}
