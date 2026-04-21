import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import { openWhatsapp } from "@/lib/whatsapp";

export const Route = createFileRoute("/pedidos")({
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
};

type Order = {
  id: string;
  created_at: string;
  store_id: string;
  store_name: string;
  store_slug: string;
  store_emoji: string | null;
  store_whatsapp: string | null;
  total: number;
  discount: number;
  delivery_address: string | null;
  whatsapp_message: string;
  status: string;
  order_items: OrderItem[];
};

const fmtBRL = (n: number) => `R$ ${n.toFixed(2).replace(".", ",")}`;

function OrdersPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { reorder } = useCart();
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["my-orders", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select(
          "id, created_at, store_id, store_name, store_slug, store_emoji, store_whatsapp, total, discount, delivery_address, whatsapp_message, status, order_items(id, menu_item_id, name, quantity, unit_price, emoji)",
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
          className="flex items-center justify-between bg-card rounded-2xl p-4 shadow-[var(--shadow-card)] mb-6"
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
        ) : (
          <div className="space-y-2">
            {orders.map((o) => {
              const isOpen = expanded === o.id;
              const itemCount = o.order_items.reduce((s, i) => s + i.quantity, 0);
              return (
                <article
                  key={o.id}
                  className="bg-card rounded-2xl p-4 shadow-[var(--shadow-card)]"
                >
                  <button
                    onClick={() => setExpanded(isOpen ? null : o.id)}
                    className="w-full flex items-start gap-3 text-left"
                  >
                    <div className="h-12 w-12 rounded-lg bg-brand-soft flex items-center justify-center text-2xl shrink-0">
                      {o.store_emoji ?? "🛍️"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="font-semibold truncate">{o.store_name}</h3>
                        <ChevronDown
                          className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {format(new Date(o.created_at), "dd 'de' MMM 'às' HH:mm", { locale: ptBR })}
                      </p>
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
                          <span className="text-lg">{it.emoji ?? "•"}</span>
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
