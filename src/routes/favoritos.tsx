import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Heart, Star, Clock, Bike } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useFavorites } from "@/contexts/FavoritesContext";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/favoritos")({
  head: () => ({
    meta: [
      { title: "Meus Favoritos — Youapp" },
      { name: "description", content: "Suas lojas favoritas em um só lugar." },
    ],
  }),
  component: FavoritesPage,
});

interface StoreRow {
  id: string;
  slug: string;
  name: string;
  emoji: string;
  image_url: string | null;
  category: string;
  rating: number;
  distance: string;
  delivery_time: string;
  delivery_fee: string;
  free_delivery: boolean;
  delivery_enabled: boolean;
  promo: string | null;
}

function FavoritesPage() {
  const { user, loading: authLoading } = useAuth();
  const { favoriteIds, toggleFavorite, loading: favLoading } = useFavorites();
  const navigate = useNavigate();
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/auth" });
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user || favLoading) return;
    const ids = Array.from(favoriteIds);
    if (ids.length === 0) {
      setStores([]);
      setFetching(false);
      return;
    }
    setFetching(true);
    supabase
      .from("stores")
      .select(
        "id, slug, name, emoji, image_url, category, rating, distance, delivery_time, delivery_fee, free_delivery, delivery_enabled, promo",
      )
      .in("id", ids)
      .eq("is_hidden", false)
      .then(({ data }) => {
        setStores((data ?? []) as StoreRow[]);
        setFetching(false);
      });
  }, [user, favoriteIds, favLoading]);

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
        Carregando...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface pb-12">
      <header className="bg-card border-b border-border px-4 py-3 flex items-center gap-3 sticky top-0 z-20">
        <Link to="/" className="p-1 -ml-1">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="font-semibold">Meus Favoritos</h1>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-5">
        {fetching ? (
          <div className="text-center text-sm text-muted-foreground py-12">Carregando...</div>
        ) : stores.length === 0 ? (
          <div className="bg-card rounded-2xl p-8 text-center shadow-[var(--shadow-card)] mt-6">
            <Heart className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="font-semibold">Você ainda não tem favoritos</p>
            <p className="text-sm text-muted-foreground mt-1">
              Toque no coração nas lojas para salvá-las aqui.
            </p>
            <Link
              to="/"
              className="inline-block mt-4 text-sm font-semibold text-brand"
            >
              Explorar lojas
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              {stores.length} {stores.length === 1 ? "loja favorita" : "lojas favoritas"}
            </p>
            {stores.map((r) => (
              <div key={r.id} className="relative">
                <Link to="/loja/$slug" params={{ slug: r.slug }} className="block">
                  <article className="bg-card rounded-2xl p-3 flex items-center gap-3 shadow-[var(--shadow-card)] hover:translate-y-[-1px] transition-transform">
                    <div className="h-16 w-16 rounded-xl overflow-hidden bg-muted flex items-center justify-center text-3xl shrink-0">
                      {r.image_url ? (
                        <img
                          src={r.image_url}
                          alt={`Logo ${r.name}`}
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span>{r.emoji}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0 pr-8">
                      <h3 className="font-semibold truncate">{r.name}</h3>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                        <Star className="h-3.5 w-3.5 fill-warning text-warning" />
                        <span className="font-semibold text-foreground">
                          {Number(r.rating).toFixed(1)}
                        </span>
                        <span>•</span>
                        <span className="truncate">{r.category}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs mt-1.5">
                        {r.delivery_enabled === false ? (
                          <span className="flex items-center gap-1 text-muted-foreground font-semibold">
                            <Bike className="h-3.5 w-3.5" /> Apenas retirada
                          </span>
                        ) : (
                          <>
                            <span className="flex items-center gap-1 text-muted-foreground">
                              <Clock className="h-3.5 w-3.5" /> {r.delivery_time}
                            </span>
                            <span
                              className={`flex items-center gap-1 ${r.free_delivery ? "text-success font-semibold" : "text-muted-foreground"}`}
                            >
                              <Bike className="h-3.5 w-3.5" /> {r.delivery_fee}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </article>
                </Link>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    toggleFavorite(r.id);
                  }}
                  aria-label="Remover dos favoritos"
                  className="absolute top-3 right-3 p-2 rounded-full bg-card/80 hover:bg-muted"
                >
                  <Heart className="h-4 w-4 fill-brand text-brand" />
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
