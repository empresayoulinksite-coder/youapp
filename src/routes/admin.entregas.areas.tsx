import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, MapPin, Search, Settings } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { StoreDeliveryAreasEditor } from "@/components/StoreDeliveryAreasEditor";

export const Route = createFileRoute("/admin/entregas/areas")({
  component: AreasEntrega,
});

type StoreRow = {
  id: string;
  name: string;
  emoji: string;
  image_url: string | null;
  category: string | null;
  city: string | null;
};

const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

function AreasEntrega() {
  const { isAdmin, ownedStoreIds, loading: accessLoading } = useAdminAccess();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const { data: stores = [], isLoading } = useQuery({
    queryKey: ["admin-areas-stores", isAdmin ? "all" : ownedStoreIds.slice().sort().join(",")],
    enabled: !accessLoading && (isAdmin || ownedStoreIds.length > 0),
    queryFn: async () => {
      let q = supabase.from("stores").select("id, name, emoji, image_url, category, city").order("name");
      if (!isAdmin) q = q.in("id", ownedStoreIds);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as StoreRow[];
    },
  });

  const { data: counts = {} } = useQuery({
    queryKey: ["admin-areas-counts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_delivery_areas")
        .select("store_id");
      if (error) throw error;
      const map: Record<string, number> = {};
      for (const r of data ?? []) {
        map[r.store_id] = (map[r.store_id] ?? 0) + 1;
      }
      return map;
    },
  });

  const filtered = useMemo(() => {
    const q = norm(search.trim());
    if (!q) return stores;
    return stores.filter((s) =>
      [s.name, s.category, s.city]
        .filter(Boolean)
        .some((v) => norm(String(v)).includes(q)),
    );
  }, [stores, search]);

  const selected = stores.find((s) => s.id === selectedId) ?? null;

  if (selected) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedId(null)}
            className="gap-1"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>
        </div>

        <div className="flex items-center gap-3">
          {selected.image_url ? (
            <img
              src={selected.image_url}
              alt={selected.name}
              className="h-12 w-12 rounded-md object-cover"
            />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-md bg-muted text-2xl">
              {selected.emoji}
            </div>
          )}
          <div>
            <h1 className="text-xl font-bold">{selected.name}</h1>
            <p className="text-sm text-muted-foreground">
              Adicione pelo menos uma região de atendimento para esta loja.
            </p>
          </div>
        </div>

        <StoreDeliveryAreasEditor storeId={selected.id} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <MapPin className="h-5 w-5 text-purple-600" />
        <h1 className="text-xl font-bold">Áreas de entrega</h1>
      </div>
      <p className="text-sm text-muted-foreground -mt-2">
        Selecione uma loja para cadastrar os bairros atendidos e as taxas de entrega.
      </p>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar loja por nome, categoria ou cidade..."
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando lojas...</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma loja encontrada.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((s) => {
            const count = counts[s.id] ?? 0;
            return (
              <div
                key={s.id}
                className="rounded-lg border bg-background p-3 flex flex-col gap-3"
              >
                <div className="flex items-start gap-3">
                  {s.image_url ? (
                    <img
                      src={s.image_url}
                      alt={s.name}
                      className="h-14 w-14 rounded-md object-cover"
                    />
                  ) : (
                    <div className="flex h-14 w-14 items-center justify-center rounded-md bg-muted text-2xl">
                      {s.emoji}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-semibold">{s.name}</h3>
                    {s.category && (
                      <p className="truncate text-xs text-muted-foreground">
                        {s.category}
                      </p>
                    )}
                    <p className="mt-1 text-xs">
                      <span className="rounded-full bg-purple-100 px-2 py-0.5 font-medium text-purple-700 dark:bg-purple-950 dark:text-purple-300">
                        {count} {count === 1 ? "bairro" : "bairros"}
                      </span>
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  className="w-full"
                  onClick={() => setSelectedId(s.id)}
                >
                  <Settings className="h-3.5 w-3.5" />
                  Gerenciar áreas
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
