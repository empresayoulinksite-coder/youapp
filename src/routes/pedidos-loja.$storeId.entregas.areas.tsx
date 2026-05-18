import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { StoreDeliveryAreasEditor } from "@/components/StoreDeliveryAreasEditor";

export const Route = createFileRoute("/pedidos-loja/$storeId/entregas/areas")({
  beforeLoad: async ({ params }) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw redirect({ to: "/auth" });
    const { data, error } = await supabase.rpc("can_manage_store_orders", {
      _user_id: session.user.id,
      _store_id: params.storeId,
    });
    if (error || !data) throw redirect({ to: "/painel" });
  },
  component: AreasEntregaLoja,
});

function AreasEntregaLoja() {
  const { storeId } = Route.useParams();

  const { data: store } = useQuery({
    queryKey: ["entregas-areas-store", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stores")
        .select("id, name, emoji, image_url")
        .eq("id", storeId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4 sm:p-6">
      <Link
        to="/pedidos-loja/$storeId"
        params={{ storeId }}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar ao painel
      </Link>

      <div className="flex items-center gap-2">
        <MapPin className="h-5 w-5 text-purple-600" />
        <h1 className="text-xl font-bold">Áreas de entrega</h1>
      </div>

      {store && (
        <div className="flex items-center gap-3">
          {store.image_url ? (
            <img
              src={store.image_url}
              alt={store.name}
              className="h-12 w-12 rounded-md object-cover"
            />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-md bg-muted text-2xl">
              {store.emoji}
            </div>
          )}
          <div>
            <h2 className="font-semibold">{store.name}</h2>
            <p className="text-sm text-muted-foreground">
              Adicione pelo menos uma região de atendimento para esta loja.
            </p>
          </div>
        </div>
      )}

      <StoreDeliveryAreasEditor storeId={storeId} />
    </div>
  );
}
