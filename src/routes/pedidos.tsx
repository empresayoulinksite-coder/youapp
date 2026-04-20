import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { ArrowLeft, Receipt, ShoppingBag, Home, Search, Heart, User } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export const Route = createFileRoute("/pedidos")({
  head: () => ({
    meta: [
      { title: "Meus pedidos — Youapp" },
      { name: "description", content: "Acompanhe seus pedidos no Youapp." },
    ],
  }),
  component: OrdersPage,
});

function OrdersPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  return (
    <div className="min-h-screen bg-surface pb-24">
      <header className="sticky top-0 z-30 bg-card border-b border-border px-4 py-3 flex items-center gap-3">
        <Link to="/" className="p-1 -ml-1" aria-label="Voltar">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="font-semibold flex-1">Meus pedidos</h1>
      </header>

      <main className="px-4 py-8 max-w-md mx-auto">
        <div className="text-center py-16">
          <div className="h-16 w-16 rounded-full bg-brand-soft mx-auto flex items-center justify-center mb-4">
            <Receipt className="h-8 w-8 text-brand" />
          </div>
          <h2 className="font-bold text-lg">Você ainda não fez pedidos</h2>
          <p className="text-sm text-muted-foreground mt-1.5 max-w-xs mx-auto">
            Quando você finalizar um pedido, ele aparece aqui para acompanhar o status.
          </p>
          <Link
            to="/"
            className="mt-6 inline-flex items-center gap-2 bg-brand text-brand-foreground font-bold px-5 py-2.5 rounded-full text-sm"
          >
            <ShoppingBag className="h-4 w-4" />
            Explorar lojas
          </Link>
        </div>
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
