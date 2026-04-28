import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Dumbbell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { GymTab } from "@/components/painel/GymTab";
import { isGymStore } from "@/lib/gym";

export const Route = createFileRoute("/admin/academia/$storeId")({
  component: AdminGymPage,
  errorComponent: ({ error }) => (
    <div className="p-6">
      <p className="text-sm text-destructive">Erro: {error.message}</p>
      <Link to="/admin" className="text-sm text-primary underline">
        Voltar
      </Link>
    </div>
  ),
  notFoundComponent: () => (
    <div className="p-6">
      <p className="text-sm">Academia não encontrada.</p>
      <Link to="/admin" className="text-sm text-primary underline">
        Voltar
      </Link>
    </div>
  ),
});

function AdminGymPage() {
  const { storeId } = Route.useParams();
  const router = useRouter();

  const { data: store, isLoading } = useQuery({
    queryKey: ["admin-gym-store", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stores")
        .select("id, name, category, image_url, emoji")
        .eq("id", storeId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  if (!store) {
    return (
      <div className="p-6">
        <p className="text-sm">Loja não encontrada.</p>
        <Link to="/admin" className="text-sm text-primary underline">
          Voltar
        </Link>
      </div>
    );
  }

  const isGym = isGymStore(store.category);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
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
              className="h-10 w-10 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-lg">
              {store.emoji ?? "🏋️"}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-bold">{store.name}</h1>
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <Dumbbell className="h-3 w-3" /> Gestão da academia
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-4">
        {!isGym && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
            Esta loja não está cadastrada como categoria <strong>Academia</strong>.
            Para liberar todos os recursos, ajuste a categoria no cadastro da loja.
          </div>
        )}
        <GymTab storeId={storeId} />
      </main>
    </div>
  );
}
