import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ChevronLeft, Search, ShoppingBag, Heart, Star, SlidersHorizontal } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import { useFavorites } from "@/contexts/FavoritesContext";

interface Store {
  id: string;
  slug: string;
  name: string;
  emoji: string;
  image_url: string | null;
  category: string;
  rating: number;
  about: string | null;
  delivery_time: string;
  delivery_fee: string;
  free_delivery: boolean;
  promo: string | null;
}

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  original_price: number | null;
  emoji: string;
  image_url: string | null;
  promo: string | null;
}

export const Route = createFileRoute("/vitrine/$slug")({
  loader: async ({ params }): Promise<{ store: Store; products: Product[] }> => {
    const { data: store, error } = await supabase
      .from("stores")
      .select("id, slug, name, emoji, image_url, category, rating, about, delivery_time, delivery_fee, free_delivery, promo")
      .eq("slug", params.slug)
      .maybeSingle();
    if (error) throw error;
    if (!store) throw notFound();

    const { data: items, error: itemsErr } = await supabase
      .from("menu_items")
      .select("id, name, description, price, original_price, emoji, image_url, promo")
      .eq("store_id", store.id)
      .order("position");
    if (itemsErr) throw itemsErr;

    return { store: store as Store, products: (items ?? []) as Product[] };
  },
  errorComponent: ({ error }) => (
    <div className="min-h-screen flex items-center justify-center p-6 text-sm text-muted-foreground">
      {error.message}
    </div>
  ),
  notFoundComponent: () => (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 gap-3">
      <p className="font-semibold">Loja não encontrada</p>
      <Link to="/" className="text-sm text-brand font-semibold">Voltar</Link>
    </div>
  ),
  head: ({ loaderData }) => {
    const name = loaderData?.store?.name ?? "Vitrine";
    return {
      meta: [
        { title: `${name} — Vitrine` },
        { name: "description", content: `Compre online os produtos de ${name} no Youlink.` },
        { property: "og:title", content: `${name} — Vitrine` },
        ...(loaderData?.store?.image_url
          ? [{ property: "og:image", content: loaderData.store.image_url }]
          : []),
      ],
    };
  },
  component: VitrinePage,
});

type SortKey = "relevance" | "price-asc" | "price-desc" | "promo";

function VitrinePage() {
  const { store, products } = Route.useLoaderData() as { store: Store; products: Product[] };
  const { user } = useAuth();
  const { count: cartCount, addItem } = useCart();
  const { isFavorite, toggleFavorite } = useFavorites();

  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("relevance");
  const [adding, setAdding] = useState<string | null>(null);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    let arr = products.filter(
      (p) =>
        !q ||
        p.name.toLowerCase().includes(q) ||
        (p.description ?? "").toLowerCase().includes(q),
    );
    if (sort === "price-asc") arr = [...arr].sort((a, b) => Number(a.price) - Number(b.price));
    else if (sort === "price-desc") arr = [...arr].sort((a, b) => Number(b.price) - Number(a.price));
    else if (sort === "promo") arr = [...arr].sort((a, b) => Number(!!b.promo) - Number(!!a.promo));
    return arr;
  }, [products, query, sort]);

  const fmt = (n: number) => `R$ ${Number(n).toFixed(2).replace(".", ",")}`;
  const fav = isFavorite(store.id);

  const handleAdd = async (productId: string) => {
    if (!user) {
      window.location.href = "/auth";
      return;
    }
    setAdding(productId);
    await addItem(store.id, productId);
    setTimeout(() => setAdding(null), 600);
  };

  return (
    <div className="min-h-screen bg-surface pb-24">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-card border-b border-border">
        <div className="mx-auto max-w-5xl px-4 py-3 flex items-center gap-3">
          <Link to="/" className="p-1 -ml-1 rounded-full hover:bg-muted" aria-label="Voltar">
            <ChevronLeft className="h-6 w-6" />
          </Link>
          <h1 className="flex-1 truncate font-bold">{store.name}</h1>
          <button
            onClick={() => toggleFavorite(store.id)}
            aria-label="Favoritar"
            className="p-1 rounded-full hover:bg-muted"
          >
            <Heart className={`h-5 w-5 ${fav ? "fill-brand text-brand" : "text-foreground"}`} />
          </button>
          <Link to="/sacola" className="relative p-1">
            <ShoppingBag className="h-5 w-5" />
            {cartCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 bg-brand text-brand-foreground text-[10px] font-bold rounded-full h-4 min-w-[16px] px-1 flex items-center justify-center">
                {cartCount}
              </span>
            )}
          </Link>
        </div>

        <div className="mx-auto max-w-5xl px-4 pb-3 flex gap-2">
          <div className="flex-1 flex items-center gap-2 rounded-full bg-muted px-4 py-2.5">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar nesta loja"
              className="bg-transparent outline-none text-sm w-full"
            />
          </div>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="text-xs font-semibold border border-border rounded-full px-3 py-1.5 bg-card"
            aria-label="Ordenar"
          >
            <option value="relevance">Relevância</option>
            <option value="price-asc">Menor preço</option>
            <option value="price-desc">Maior preço</option>
            <option value="promo">Em promoção</option>
          </select>
        </div>
      </header>

      {/* Hero da loja */}
      <section className="mx-auto max-w-5xl px-4 pt-4">
        <div className="rounded-2xl overflow-hidden bg-card shadow-[var(--shadow-card)]">
          <div className="relative h-32 sm:h-40 bg-gradient-to-br from-brand-soft to-accent flex items-center justify-center text-6xl">
            {store.image_url ? (
              <img src={store.image_url} alt={store.name} className="h-full w-full object-cover" />
            ) : (
              <span>{store.emoji}</span>
            )}
            {store.promo && (
              <span className="absolute top-3 left-3 text-[11px] font-bold text-brand-foreground bg-brand px-2 py-1 rounded-full">
                {store.promo}
              </span>
            )}
          </div>
          <div className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">{store.category}</p>
                <h2 className="font-bold truncate">{store.name}</h2>
              </div>
              <span className="flex items-center gap-1 text-xs font-semibold shrink-0">
                <Star className="h-3.5 w-3.5 fill-warning text-warning" />
                {Number(store.rating).toFixed(1)}
              </span>
            </div>
            {store.about && (
              <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{store.about}</p>
            )}
            <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
              <span className="px-2 py-1 rounded-full bg-muted">Entrega {store.delivery_time}</span>
              <span className={`px-2 py-1 rounded-full ${store.free_delivery ? "bg-success/10 text-success font-semibold" : "bg-muted"}`}>
                Frete {store.delivery_fee}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Grid de produtos */}
      <main className="mx-auto max-w-5xl px-4 py-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold">Produtos</h3>
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            {list.length} {list.length === 1 ? "item" : "itens"}
          </span>
        </div>

        {list.length === 0 ? (
          <div className="bg-card border border-border rounded-2xl p-8 text-center">
            <p className="text-sm text-muted-foreground">Nenhum produto encontrado.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {list.map((p) => {
              const hasDiscount = !!p.original_price && Number(p.original_price) > Number(p.price);
              const discountPct = hasDiscount
                ? Math.round((1 - Number(p.price) / Number(p.original_price)) * 100)
                : 0;
              return (
                <article
                  key={p.id}
                  className="bg-card rounded-2xl overflow-hidden shadow-[var(--shadow-card)] flex flex-col"
                >
                  <Link
                    to="/produto/$id"
                    params={{ id: p.id }}
                    className="relative block aspect-square bg-muted flex items-center justify-center text-5xl overflow-hidden"
                  >
                    {p.image_url ? (
                      <img
                        src={p.image_url}
                        alt={p.name}
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span>{p.emoji}</span>
                    )}
                    {hasDiscount && (
                      <span className="absolute top-2 left-2 text-[10px] font-bold text-brand-foreground bg-brand px-1.5 py-0.5 rounded">
                        -{discountPct}%
                      </span>
                    )}
                  </Link>
                  <div className="p-2.5 flex flex-col gap-1.5 flex-1">
                    <Link
                      to="/produto/$id"
                      params={{ id: p.id }}
                      className="text-xs font-medium leading-tight line-clamp-2 min-h-[32px]"
                    >
                      {p.name}
                    </Link>
                    <div className="flex items-baseline gap-1.5 flex-wrap">
                      <span className="text-sm font-bold">{fmt(Number(p.price))}</span>
                      {hasDiscount && (
                        <span className="text-[10px] text-muted-foreground line-through">
                          {fmt(Number(p.original_price))}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => handleAdd(p.id)}
                      disabled={adding === p.id}
                      className="mt-auto bg-brand text-brand-foreground text-xs font-bold py-2 rounded-full hover:opacity-90 active:scale-[.98] transition disabled:opacity-60"
                    >
                      {adding === p.id ? "Adicionado ✓" : "Comprar"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
