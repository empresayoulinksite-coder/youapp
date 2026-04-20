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

interface MenuItemRow {
  id: string;
  store_id: string;
  name: string;
  description: string | null;
  price: number;
  original_price: number | null;
  emoji: string;
  promo: string | null;
  image_url: string | null;
}

interface ItemWithStore extends MenuItemRow {
  store: { slug: string; name: string };
}

export const Route = createFileRoute("/categoria/$slug")({
  loader: async ({ params }) => {
    const cat = findCategoryBySlug(params.slug);
    if (!cat) throw notFound();

    const { data: storesData, error: storesErr } = await supabase
      .from("stores")
      .select(
        "id, slug, name, emoji, image_url, category, rating, distance, delivery_time, delivery_fee, free_delivery, promo",
      )
      .order("rating", { ascending: false });
    if (storesErr) throw storesErr;

    const matches = cat.matches.map(norm);
    const stores = ((storesData ?? []) as StoreRow[]).filter((s) =>
      matches.includes(norm(s.category)),
    );

    let items: ItemWithStore[] = [];
    if (stores.length > 0) {
      const storeIds = stores.map((s) => s.id);
      const { data: itemsData, error: itemsErr } = await supabase
        .from("menu_items")
        .select(
          "id, store_id, name, description, price, original_price, emoji, promo, image_url",
        )
        .in("store_id", storeIds)
        .order("position", { ascending: true });
      if (itemsErr) throw itemsErr;

      const storeMap = new Map(
        stores.map((s) => [s.id, { slug: s.slug, name: s.name }]),
      );
      items = ((itemsData ?? []) as MenuItemRow[])
        .map((it) => ({ ...it, store: storeMap.get(it.store_id)! }))
        .filter((it) => !!it.store);
    }

    return { category: cat, stores, items };
  },
  errorComponent: ({ error }) => (
    <div className="min-h-screen flex items-center justify-center p-6 text-center text-sm text-muted-foreground">
      {error.message}
    </div>
  ),
  notFoundComponent: () => (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 gap-3 text-center">
      <p className="font-semibold">Categoria não encontrada</p>
      <Link to="/" className="text-sm text-brand font-semibold">
        Voltar para o início
      </Link>
    </div>
  ),
  head: ({ params }) => {
    const cat = findCategoryBySlug(params.slug);
    const title = cat ? `${cat.label} — Youlink` : "Categoria — Youlink";
    return {
      meta: [
        { title },
        {
          name: "description",
          content: cat
            ? `Lojas e produtos da categoria ${cat.label} com entrega no Youlink.`
            : "Categoria no Youlink.",
        },
        { property: "og:title", content: title },
      ],
    };
  },
  component: CategoryPage,
});

function CategoryPage() {
  const { category, stores, items } = Route.useLoaderData() as {
    category: ReturnType<typeof findCategoryBySlug> & {};
    stores: StoreRow[];
    items: ItemWithStore[];
  };
  const Icon = category.Icon;

  // Agrupa até 4 itens em destaque por loja (promo primeiro)
  const itemsByStore = new Map<string, ItemWithStore[]>();
  for (const it of items) {
    const arr = itemsByStore.get(it.store_id) ?? [];
    arr.push(it);
    itemsByStore.set(it.store_id, arr);
  }
  for (const [k, arr] of itemsByStore) {
    const sorted = [...arr].sort(
      (a, b) => Number(!!b.promo) - Number(!!a.promo),
    );
    itemsByStore.set(k, sorted.slice(0, 4));
  }

  return (
    <div className="min-h-screen bg-surface pb-12">
      <header className="sticky top-0 z-30 bg-card border-b border-border">
        <div className="mx-auto max-w-5xl px-4 py-3 flex items-center gap-3">
          <Link
            to="/"
            aria-label="Voltar"
            className="p-1 -ml-1 rounded-full hover:bg-muted"
          >
            <ChevronLeft className="h-6 w-6" />
          </Link>
          <div
            className={`h-9 w-9 rounded-xl flex items-center justify-center ${category.tint}`}
          >
            <Icon className="h-5 w-5" />
          </div>
          <h1 className="text-lg font-bold">{category.label}</h1>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-5 space-y-7">
        {stores.length === 0 ? (
          <div className="bg-card border border-border rounded-2xl p-8 text-center">
            <div className="text-4xl mb-2">🤷</div>
            <p className="font-semibold">Nada nesta categoria ainda</p>
            <p className="text-sm text-muted-foreground mt-1">
              Volte em breve, novidades chegando!
            </p>
            <Link
              to="/"
              className="inline-block mt-4 text-sm font-semibold text-brand"
            >
              Ver tudo
            </Link>
          </div>
        ) : (
          <section className="space-y-6">
            <div>
              <h2 className="text-lg font-bold">Lojas e destaques</h2>
              <p className="text-xs text-muted-foreground">
                {stores.length}{" "}
                {stores.length === 1
                  ? "loja encontrada"
                  : "lojas encontradas"}
              </p>
            </div>

            {stores.map((s) => {
              const storeItems = itemsByStore.get(s.id) ?? [];
              return (
                <article
                  key={s.id}
                  className="bg-card rounded-2xl shadow-[var(--shadow-card)] overflow-hidden"
                >
                  {/* Cabeçalho da loja */}
                  <Link
                    to="/loja/$slug"
                    params={{ slug: s.slug }}
                    className="flex items-center gap-3 p-3 hover:bg-muted/40 transition-colors"
                  >
                    <div className="h-14 w-14 rounded-xl overflow-hidden bg-muted flex items-center justify-center text-3xl shrink-0">
                      {s.image_url ? (
                        <img
                          src={s.image_url}
                          alt={s.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span>{s.emoji}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="font-semibold truncate">{s.name}</h3>
                        <span className="flex items-center gap-1 text-xs font-semibold shrink-0">
                          <Star className="h-3.5 w-3.5 fill-warning text-warning" />
                          {Number(s.rating).toFixed(1)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {s.category} • {s.distance}
                      </p>
                      <div className="flex items-center gap-3 text-xs mt-1">
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <Clock className="h-3.5 w-3.5" /> {s.delivery_time}
                        </span>
                        <span
                          className={`flex items-center gap-1 ${s.free_delivery ? "text-success font-semibold" : "text-muted-foreground"}`}
                        >
                          <Bike className="h-3.5 w-3.5" /> {s.delivery_fee}
                        </span>
                      </div>
                    </div>
                  </Link>

                  {/* 4 produtos lado a lado */}
                  {storeItems.length > 0 && (
                    <div className="px-3 pb-3 -mt-1">
                      <div className="flex gap-2 overflow-x-auto no-scrollbar snap-x snap-mandatory">
                        {storeItems.map((it) => (
                          <Link
                            key={it.id}
                            to="/loja/$slug"
                            params={{ slug: s.slug }}
                            className="shrink-0 w-32 snap-start bg-surface rounded-xl overflow-hidden border border-border hover:border-brand/40 transition-colors"
                          >
                            <div className="relative h-20 bg-muted flex items-center justify-center text-3xl">
                              {it.image_url ? (
                                <img
                                  src={it.image_url}
                                  alt={it.name}
                                  loading="lazy"
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <span>{it.emoji}</span>
                              )}
                              {it.promo && (
                                <span className="absolute top-1 left-1 text-[9px] font-bold text-brand-foreground bg-brand px-1 py-0.5 rounded">
                                  {it.promo}
                                </span>
                              )}
                            </div>
                            <div className="p-2">
                              <p className="text-[11px] font-semibold leading-tight line-clamp-2 min-h-[28px]">
                                {it.name}
                              </p>
                              <div className="mt-1 flex items-baseline gap-1">
                                <span className="text-xs font-bold">
                                  R$ {Number(it.price).toFixed(2).replace(".", ",")}
                                </span>
                                {it.original_price && (
                                  <span className="text-[10px] text-muted-foreground line-through">
                                    R$ {Number(it.original_price).toFixed(2).replace(".", ",")}
                                  </span>
                                )}
                              </div>
                            </div>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </section>
        )}

        {/* Outras categorias */}
        <div className="pt-2">
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
