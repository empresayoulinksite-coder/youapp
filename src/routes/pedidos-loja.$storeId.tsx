import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { OrdersManager } from "@/components/painel/OrdersManager";

export const Route = createFileRoute("/pedidos-loja/$storeId")({
  component: PedidosLojaPage,
  beforeLoad: async ({ params }) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw redirect({ to: "/auth" });
    }
    // Permission check via RPC: can_manage_store_orders
    const { data, error } = await supabase.rpc("can_manage_store_orders", {
      _user_id: session.user.id,
      _store_id: params.storeId,
    });
    if (error || !data) {
      throw redirect({ to: "/painel" });
    }
  },
  errorComponent: ({ error }) => (
    <div className="p-6">
      <p className="text-sm text-destructive">Erro: {error.message}</p>
      <Link to="/painel" className="text-sm text-primary underline">
        Voltar
      </Link>
    </div>
  ),
});

function PedidosLojaPage() {
  const { storeId } = Route.useParams();

  const { data: store } = useQuery({
    queryKey: ["pedidos-loja-store", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stores")
        .select("id, name, slug, image_url, emoji")
        .eq("id", storeId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="flex shrink-0 items-center gap-3 border-b bg-card px-4 py-2.5">
        <Button asChild variant="ghost" size="icon">
          <Link to="/painel">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        {store?.image_url ? (
          <img src={store.image_url} alt={store.name} className="h-9 w-9 rounded-full object-cover" />
        ) : (
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
            {store?.emoji ?? "🏪"}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-bold">Gestor de Pedidos</h1>
          <p className="truncate text-xs text-muted-foreground">{store?.name}</p>
        </div>
        {store?.slug && (
          <Button asChild variant="outline" size="sm">
            <Link to="/loja/$slug" params={{ slug: store.slug }}>
              <ExternalLink className="h-3.5 w-3.5" />
              Ver loja
            </Link>
          </Button>
        )}
      </header>
      <div className="min-h-0 flex-1 overflow-hidden p-3">
        <OrdersManager storeId={storeId} fullScreen />
      </div>
    </div>
  );
}
