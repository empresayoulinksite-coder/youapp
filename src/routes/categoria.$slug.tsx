import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { categories, findCategoryBySlug, norm } from "@/lib/categories";
import { ChevronLeft, Star, Clock, Bike } from "lucide-react";

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
  promo: string | null;
}

export const Route = createFileRoute("/categoria/$slug")({
  loader: async ({ params }) => {
    const cat = findCategoryBySlug(params.slug);
    if (!cat) throw notFound();
    const { data, error } = await supabase
      .from("stores")
      .select("id, slug, name, emoji, image_url, category, rating, distance, delivery_time, delivery_fee, free_delivery, promo")
      .order("rating", { ascending: false });
    if (error) throw error;
    const matches = cat.matches.map(norm);
    const stores = ((data ?? []) as StoreRow[]).filter((s) => matches.includes(norm(s.category)));
    return { category: cat, stores };
  },
  errorComponent: ({ error }) => (
    <div className="min-h-screen flex items-center justify-center p-6 text-center text-sm text-muted-foreground">
      {error.message}
    </div>
  ),
  notFoundComponent: () => (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 gap-3 text-center">
      <p className="font-semibold">Categoria não encontrada</p>
      <Link to="/" className="text-sm text-brand font-semibold">Voltar para o início</Link>
    </div>
  ),
  head: ({ params }) => {
    const cat = findCategoryBySlug(params.slug);
    const title = cat ? `${cat.label} — Youlink` : "Categoria — Youlink";
    return {
      meta: [
        { title },
        { name: "description", content: cat ? `Lojas da categoria ${cat.label} com entrega no Youlink.` : "Categoria no Youlink." },
        { property: "og:title", content: title },
      ],
    };
  },
  component: CategoryPage,
});

function CategoryPage() {
  const { category, stores } = Route.useLoaderData();
  const Icon = category.Icon;

  return (
    <div className="min-h-screen bg-surface pb-12">
      <header className="sticky top-0 z-30 bg-card border-b border-border">
        <div className="mx-auto max-w-5xl px-4 py-3 flex items-center gap-3">
          <Link to="/" aria-label="Voltar" className="p-1 -ml-1 rounded-full hover:bg-muted">
            <ChevronLeft className="h-6 w-6" />
          </Link>
          <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${category.tint}`}>
            <Icon className="h-5 w-5" />
          </div>
          <h1 className="text-lg font-bold">{category.label}</h1>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-5">
        <p className="text-sm text-muted-foreground mb-4">
          {stores.length} {stores.length === 1 ? "loja encontrada" : "lojas encontradas"}
        </p>

        {stores.length === 0 ? (
          <div className="bg-card border border-border rounded-2xl p-8 text-center">
            <div className="text-4xl mb-2">🤷</div>
            <p className="font-semibold">Nenhuma loja nesta categoria ainda</p>
            <p className="text-sm text-muted-foreground mt-1">Volte em breve, novas lojas chegando!</p>
            <Link to="/" className="inline-block mt-4 text-sm font-semibold text-brand">
              Ver todas as lojas
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {stores.map((s) => (
              <Link
                key={s.id}
                to="/loja/$slug"
                params={{ slug: s.slug }}
                className="flex items-center gap-3 bg-card rounded-2xl p-3 shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-soft)] transition-shadow"
              >
                <div className="h-16 w-16 rounded-xl overflow-hidden bg-muted flex items-center justify-center text-3xl shrink-0">
                  {s.image_url ? (
                    <img src={s.image_url} alt={s.name} className="h-full w-full object-cover" />
                  ) : (
                    <span>{s.emoji}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="font-semibold truncate">{s.name}</h2>
                    <span className="flex items-center gap-1 text-xs font-semibold shrink-0">
                      <Star className="h-3.5 w-3.5 fill-warning text-warning" />
                      {Number(s.rating).toFixed(1)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{s.category} • {s.distance}</p>
                  <div className="flex items-center gap-3 text-xs mt-1.5">
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" /> {s.delivery_time}
                    </span>
                    <span className={`flex items-center gap-1 ${s.free_delivery ? "text-success font-semibold" : "text-muted-foreground"}`}>
                      <Bike className="h-3.5 w-3.5" /> {s.delivery_fee}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        <div className="mt-8">
          <p className="text-sm font-semibold mb-3">Outras categorias</p>
          <div className="flex flex-wrap gap-2">
            {categories
              .filter((c) => c.slug !== category.slug)
              .map((c) => (
                <Link
                  key={c.slug}
                  to="/categoria/$slug"
                  params={{ slug: c.slug }}
                  className="text-xs font-medium bg-card border border-border rounded-full px-3 py-1.5 hover:border-brand hover:text-brand"
                >
                  {c.label}
                </Link>
              ))}
          </div>
        </div>
      </main>
    </div>
  );
}
