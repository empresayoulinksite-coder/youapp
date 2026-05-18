import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { ArrowLeft, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/pedidos-loja/$storeId/entregas/cadastro")({
  beforeLoad: async ({ params }) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw redirect({ to: "/auth" });
    const { data, error } = await supabase.rpc("can_manage_store_orders", {
      _user_id: session.user.id,
      _store_id: params.storeId,
    });
    if (error || !data) throw redirect({ to: "/painel" });
  },
  component: CadastroEntregadoresLoja,
});

function CadastroEntregadoresLoja() {
  const { storeId } = Route.useParams();

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
        <UserPlus className="h-5 w-5 text-purple-600" />
        <h1 className="text-xl font-bold">Cadastro de entregadores</h1>
      </div>
      <p className="text-sm text-muted-foreground">
        Gerencie os entregadores desta loja.
      </p>
    </div>
  );
}
