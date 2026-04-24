import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, Search, ShoppingBag, Heart, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCart, DifferentStoreError } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import { useFavorites } from "@/contexts/FavoritesContext";
import { StoreReelsSection } from "@/components/StoreReelsSection";

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

interface Variation {
  id: string;
  name: string;
  price: number;
  original_price: number | null;
}

interface Product {
  id: string;
  category_id: string;
  name: string;
  description: string | null;
  price: number;
  original_price: number | null;
  emoji: string;
  image_url: string | null;
  promo: string | null;
  variations: Variation[];
}

interface CategoryRow {
  id: string;
  name: string;
  position: number;
  is_available: boolean;
}

function VitrineError({ error }: { error: Error }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 text-sm text-muted-foreground">
      {error.message}
    </div>
  );
}

function VitrineNotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 gap-3">
      <p className="font-semibold">Loja não encontrada</p>
      <Link to="/" className="text-sm text-brand font-semibold">Voltar</Link>
    </div>
  );
}

export const Route = createFileRoute("/vitrine/$slug")({
  loader: async ({ params }): Promise<{ store: Store; products: Product[]; categories: CategoryRow[] }> => {
    const { data: store, error } = await supabase
      .from("stores")
      .select("id, slug, name, emoji, image_url, category, rating, about, delivery_time, delivery_fee, free_delivery, promo")
      .eq("slug", params.slug)
      .maybeSingle();
    if (error) throw error;
    if (!store) throw notFound();

    const [{ data: items, error: itemsErr }, { data: cats, error: catsErr }] = await Promise.all([
      supabase
        .from("menu_items")
        .select("id, category_id, name, description, price, original_price, emoji, image_url, promo")
        .eq("store_id", store.id)
        .eq("is_available", true)
        .order("position"),
      supabase
        .from("menu_categories")
        .select("id, name, position, is_available")
        .eq("store_id", store.id)
        .order("position"),
    ]);
    if (itemsErr) throw itemsErr;
    if (catsErr) throw catsErr;

    const itemIds = (items ?? []).map((i) => i.id);
    const varsByItem = new Map<string, Variation[]>();
    if (itemIds.length > 0) {
      const { data: variations } = await supabase
        .from("menu_item_variations")
        .select("id, menu_item_id, name, price, original_price")
        .in("menu_item_id", itemIds)
        .eq("is_available", true)
        .order("position");
      for (const v of (variations ?? []) as Array<{ id: string; menu_item_id: string; name: string; price: number; original_price: number | null }>) {
        const list = varsByItem.get(v.menu_item_id) ?? [];
        list.push({
          id: v.id,
          name: v.name,
          price: Number(v.price),
          original_price: v.original_price !== null ? Number(v.original_price) : null,
        });
        varsByItem.set(v.menu_item_id, list);
      }
    }

    return {
      store: store as Store,
      products: ((items ?? []) as Omit<Product, "variations">[]).map((p) => ({
        ...p,
        variations: varsByItem.get(p.id) ?? [],
      })),
      categories: (cats ?? []) as CategoryRow[],
    };
  },
  errorComponent: VitrineError,
  notFoundComponent: VitrineNotFound,
  head: ({ loaderData }) => {
    const name = loaderData?.store?.name ?? "Vitrine";
    const meta: Array<Record<string, string>> = [
      { title: `${name} — Vitrine` },
      { name: "description", content: `Compre online os produtos de ${name} no Youapp.` },
      { property: "og:title", content: `${name} — Vitrine` },
    ];
    if (loaderData?.store?.image_url) {
      meta.push({ property: "og:image", content: loaderData.store.image_url });
    }
    return { meta };
  },
  component: VitrinePage,
});

type SortKey = "relevance" | "price-asc" | "price-desc" | "promo";

function VitrinePage() {
  const { store, products, categories } = Route.useLoaderData() as {
    store: Store;
    products: Product[];
    categories: CategoryRow[];
  };
  const { user } = useAuth();
  const { count: cartCount, addItem, switchStoreAndAdd } = useCart();
  const { isFavorite, toggleFavorite } = useFavorites();

  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState<string | null>(null);
  const [activeCat, setActiveCat] = useState<string>("all");
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const tabsRef = useRef<HTMLDivElement | null>(null);

  // Categorias visíveis: ativas + que tenham pelo menos 1 produto
  const visibleCategories = useMemo(() => {
    const productCatIds = new Set(products.map((p) => p.category_id));
    return categories.filter((c) => c.is_available && productCatIds.has(c.id));
  }, [categories, products]);

  // Filtragem por busca
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.description ?? "").toLowerCase().includes(q),
    );
  }, [products, query]);

  // Agrupado por categoria
  const grouped = useMemo(() => {
    const map = new Map<string, Product[]>();
    for (const c of visibleCategories) map.set(c.id, []);
    const orphans: Product[] = [];
    for (const p of filtered) {
      if (map.has(p.category_id)) map.get(p.category_id)!.push(p);
      else orphans.push(p);
    }
    return { map, orphans };
  }, [filtered, visibleCategories]);

  // Scroll suave ao clicar na aba
  const scrollToCategory = (id: string) => {
    setActiveCat(id);
    const el = sectionRefs.current[id];
    if (!el) return;
    const headerOffset = 132; // sticky header + tabs
    const top = el.getBoundingClientRect().top + window.scrollY - headerOffset;
    window.scrollTo({ top, behavior: "smooth" });
  };

  // Atualiza aba ativa conforme scroll
  useEffect(() => {
    if (visibleCategories.length === 0) return;
    const onScroll = () => {
      const trigger = window.scrollY + 180;
      const ids = ["all", ...visibleCategories.map((c) => c.id), "outros"];
      let current = ids[0];
      for (const id of ids) {
        const el = sectionRefs.current[id];
        if (el && el.offsetTop <= trigger) current = id;
      }
      setActiveCat((prev) => (prev === current ? prev : current));
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [visibleCategories]);

  const fmt = (n: number) => `R$ ${Number(n).toFixed(2).replace(".", ",")}`;
  const fav = isFavorite(store.id);

  const handleAdd = async (productId: string) => {
    if (!user) {
      window.location.href = "/auth";
      return;
    }
    setAdding(productId);
    try {
      await addItem(store.id, productId);
    } catch (err) {
      if (err instanceof DifferentStoreError) {
        const ok = window.confirm(
          "Você só pode pedir de uma loja por vez (o pedido vai pelo WhatsApp). Limpar o carrinho atual e adicionar este item?",
        );
        if (ok) await switchStoreAndAdd(store.id, productId);
      }
    }
    setTimeout(() => setAdding(null), 600);
  };

  const renderProductCard = (p: Product) => {
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
            <img src={p.image_url} alt={p.name} loading="lazy" className="h-full w-full object-cover" />
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
  };

  const totalCount = filtered.length;

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

        <div className="mx-auto max-w-5xl px-4 pb-3">
          <div className="flex items-center gap-2 rounded-full bg-muted px-4 py-2.5">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar nesta loja"
              className="bg-transparent outline-none text-sm w-full"
            />
          </div>
        </div>

        {/* Abas de categorias */}
        {visibleCategories.length > 0 && (
          <div ref={tabsRef} className="border-t border-border">
            <div className="mx-auto max-w-5xl px-2 overflow-x-auto no-scrollbar">
              <div className="flex gap-1.5 py-2 min-w-max">
                <button
                  onClick={() => scrollToCategory("all")}
                  className={`whitespace-nowrap text-xs font-semibold px-3 py-1.5 rounded-full transition-colors ${
                    activeCat === "all"
                      ? "bg-brand text-brand-foreground"
                      : "bg-muted text-foreground hover:bg-muted/70"
                  }`}
                >
                  Todos
                </button>
                {visibleCategories.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => scrollToCategory(c.id)}
                    className={`whitespace-nowrap text-xs font-semibold px-3 py-1.5 rounded-full transition-colors ${
                      activeCat === c.id
                        ? "bg-brand text-brand-foreground"
                        : "bg-muted text-foreground hover:bg-muted/70"
                    }`}
                  >
                    {c.name}
                  </button>
                ))}
                {grouped.orphans.length > 0 && (
                  <button
                    onClick={() => scrollToCategory("outros")}
                    className={`whitespace-nowrap text-xs font-semibold px-3 py-1.5 rounded-full transition-colors ${
                      activeCat === "outros"
                        ? "bg-brand text-brand-foreground"
                        : "bg-muted text-foreground hover:bg-muted/70"
                    }`}
                  >
                    Outros
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Hero da loja */}
      <section
        ref={(el) => {
          sectionRefs.current["all"] = el;
        }}
        className="mx-auto max-w-5xl px-4 pt-4"
      >
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
              <span
                className={`px-2 py-1 rounded-full ${
                  store.free_delivery ? "bg-success/10 text-success font-semibold" : "bg-muted"
                }`}
              >
                Frete {store.delivery_fee}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Seções de produtos por categoria */}
      <main className="mx-auto max-w-5xl px-4 py-5 space-y-8">
        <StoreReelsSection storeId={store.id} />
        {totalCount === 0 ? (
          <div className="bg-card border border-border rounded-2xl p-8 text-center">
            <p className="text-sm text-muted-foreground">
              {query ? "Nenhum produto encontrado para essa busca." : "Esta loja ainda não tem produtos."}
            </p>
          </div>
        ) : visibleCategories.length === 0 ? (
          // Sem categorias: mostra tudo num grid só
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold">Produtos</h3>
              <span className="text-xs text-muted-foreground">
                {totalCount} {totalCount === 1 ? "item" : "itens"}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {filtered.map(renderProductCard)}
            </div>
          </section>
        ) : (
          <>
            {visibleCategories.map((c) => {
              const items = grouped.map.get(c.id) ?? [];
              if (items.length === 0) return null;
              return (
                <section
                  key={c.id}
                  id={`cat-${c.id}`}
                  ref={(el) => {
                    sectionRefs.current[c.id] = el;
                  }}
                  className="scroll-mt-32"
                >
                  <div className="flex items-baseline justify-between mb-3">
                    <h3 className="font-bold text-lg">{c.name}</h3>
                    <span className="text-xs text-muted-foreground">
                      {items.length} {items.length === 1 ? "item" : "itens"}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {items.map(renderProductCard)}
                  </div>
                </section>
              );
            })}
            {grouped.orphans.length > 0 && (
              <section
                id="cat-outros"
                ref={(el) => {
                  sectionRefs.current["outros"] = el;
                }}
                className="scroll-mt-32"
              >
                <div className="flex items-baseline justify-between mb-3">
                  <h3 className="font-bold text-lg">Outros</h3>
                  <span className="text-xs text-muted-foreground">
                    {grouped.orphans.length} {grouped.orphans.length === 1 ? "item" : "itens"}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {grouped.orphans.map(renderProductCard)}
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}

