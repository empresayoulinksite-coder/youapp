import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { ArrowLeft, Plus, Minus, Trash2, ShoppingBag } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";

export const Route = createFileRoute("/sacola")({
  head: () => ({
    meta: [{ title: "Sacola — Youlink" }],
  }),
  component: CartPage,
});

function CartPage() {
  const { user, loading } = useAuth();
  const { items, total, updateQuantity, removeItem, clear } = useCart();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  const storeName = items[0]?.stores?.name;
  const storeSlug = items[0]?.stores?.slug;

  return (
    <div className="min-h-screen bg-surface pb-32">
      <header className="sticky top-0 z-30 bg-card border-b border-border px-4 py-3 flex items-center gap-3">
        <Link to="/" className="p-1 -ml-1">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="font-semibold flex-1">Sua sacola</h1>
        {items.length > 0 && (
          <button onClick={clear} className="text-xs text-destructive font-semibold">Limpar</button>
        )}
      </header>

      <main className="px-4 py-5 max-w-md mx-auto">
        {items.length === 0 ? (
          <div className="text-center py-16">
            <ShoppingBag className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="font-semibold">Sua sacola está vazia</p>
            <p className="text-sm text-muted-foreground mt-1">Explore lojas e adicione itens.</p>
            <Link to="/" className="mt-5 inline-block bg-brand text-brand-foreground font-bold px-5 py-2.5 rounded-full text-sm">
              Ver lojas
            </Link>
          </div>
        ) : (
          <>
            {storeName && storeSlug && (
              <Link to="/loja/$slug" params={{ slug: storeSlug }} className="block bg-card rounded-2xl p-3 mb-4 shadow-[var(--shadow-card)]">
                <p className="text-[11px] text-muted-foreground uppercase">Pedido em</p>
                <p className="font-semibold">{storeName}</p>
              </Link>
            )}

            <div className="space-y-2">
              {items.map((item) => (
                <article key={item.id} className="bg-card rounded-2xl p-3 flex items-center gap-3 shadow-[var(--shadow-card)]">
                  <div className="h-14 w-14 rounded-xl bg-brand-soft flex items-center justify-center text-2xl">
                    {item.menu_items?.emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{item.menu_items?.name}</p>
                    <p className="text-xs text-muted-foreground">R$ {Number(item.menu_items?.price ?? 0).toFixed(2).replace(".", ",")}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="bg-brand-soft text-brand rounded-full p-1">
                        {item.quantity === 1 ? <Trash2 className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
                      </button>
                      <span className="text-sm font-bold min-w-[16px] text-center">{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="bg-brand text-brand-foreground rounded-full p-1">
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <button onClick={() => removeItem(item.id)} className="text-muted-foreground p-1" aria-label="Remover">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </article>
              ))}
            </div>

            <div className="bg-card rounded-2xl p-4 mt-5 shadow-[var(--shadow-card)] space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-semibold">R$ {total.toFixed(2).replace(".", ",")}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Entrega</span>
                <span className="font-semibold text-success">Grátis</span>
              </div>
              <div className="border-t border-border pt-2 flex justify-between">
                <span className="font-bold">Total</span>
                <span className="font-bold text-lg">R$ {total.toFixed(2).replace(".", ",")}</span>
              </div>
            </div>
          </>
        )}
      </main>

      {items.length > 0 && (
        <div className="fixed bottom-4 left-4 right-4 max-w-md mx-auto z-40">
          <button
            onClick={() => alert("Pedido enviado! (mock)")}
            className="w-full bg-brand text-brand-foreground font-bold py-3.5 rounded-full shadow-lg"
          >
            Finalizar pedido
          </button>
        </div>
      )}
    </div>
  );
}
