import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import { useFavorites } from "@/contexts/FavoritesContext";
import { supabase } from "@/integrations/supabase/client";
import { X, Loader2 } from "lucide-react";
import { useLocation as useUserLocation, normalizeText } from "@/hooks/use-location";

import {
  MapPin,
  ChevronDown,
  Search,
  ShoppingBag,
  Heart,
  User,
  Home,
  Receipt,
  Star,
  Clock,
  Bike,
  Pizza,
} from "lucide-react";
import youlinkLogo from "@/assets/youlink-logo.png";
import { categories as categoryList, norm as normalize } from "@/lib/categories";

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
  neighborhood: string | null;
  city: string | null;
}

interface MenuItemRow {
  id: string;
  store_id: string;
  name: string;
  price: number;
  original_price: number | null;
  emoji: string;
  promo: string | null;
  image_url: string | null;
}

export const Route = createFileRoute("/")({
  loader: async () => {
    const { data, error } = await supabase
      .from("stores")
      .select("id, slug, name, emoji, image_url, category, rating, distance, delivery_time, delivery_fee, free_delivery, promo, neighborhood, city")
      .order("name");
    if (error) throw error;
    const stores = (data ?? []) as StoreRow[];

    let items: MenuItemRow[] = [];
    if (stores.length > 0) {
      const { data: itemsData, error: itemsErr } = await supabase
        .from("menu_items")
        .select("id, store_id, name, price, original_price, emoji, promo, image_url")
        .in("store_id", stores.map((s) => s.id))
        .order("position", { ascending: true });
      if (itemsErr) throw itemsErr;
      items = (itemsData ?? []) as MenuItemRow[];
    }

    return { stores, items };
  },
  errorComponent: ({ error }) => (
    <div className="min-h-screen flex items-center justify-center p-6 text-center text-sm text-muted-foreground">
      {error.message}
    </div>
  ),
  head: () => ({
    meta: [
      { title: "Youlink — Comida em casa, rápido" },
      {
        name: "description",
        content:
          "Peça comida com entrega rápida. Os melhores restaurantes da sua região no Youlink.",
      },
    ],
  }),
  component: Index,
});


function Index() {
  const { user } = useAuth();
  const { count: cartCount } = useCart();
  const { isFavorite, toggleFavorite } = useFavorites();
  const { stores, items } = Route.useLoaderData() as { stores: StoreRow[]; items: MenuItemRow[] };
  const { location, status: locStatus, detect: detectLocation } = useUserLocation();
  const [nearbyOnly, setNearbyOnly] = useState(true);

  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [freeOnly, setFreeOnly] = useState(false);
  const [sortBy, setSortBy] = useState<"relevance" | "rating" | "delivery">("relevance");
  const [sortOpen, setSortOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const focusSearch = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    setTimeout(() => searchInputRef.current?.focus(), 250);
  };

  const norm = normalize;

  // Lojas próximas: bairro do cliente; se vazio, cai pra cidade; se vazio, todas.
  const nearbyStores = useMemo(() => {
    if (!nearbyOnly || !location) return stores;
    const userHood = normalizeText(location.neighborhood);
    const userCity = normalizeText(location.city);
    if (userHood) {
      const sameHood = stores.filter(
        (s) => normalizeText(s.neighborhood) === userHood,
      );
      if (sameHood.length > 0) return sameHood;
    }
    if (userCity) {
      const sameCity = stores.filter(
        (s) => normalizeText(s.city) === userCity,
      );
      if (sameCity.length > 0) return sameCity;
    }
    return stores;
  }, [stores, location, nearbyOnly]);

  const filteredStores = useMemo(() => {
    const q = norm(query.trim());
    const cat = activeCategory ? categoryList.find((c) => c.label === activeCategory) : null;
    const catMatches = cat ? cat.matches.map(norm) : null;
    let list = nearbyStores.filter((s) => {
      if (q && !norm(s.name).includes(q) && !norm(s.category).includes(q)) return false;
      if (catMatches && !catMatches.includes(norm(s.category))) return false;
      if (freeOnly && !s.free_delivery) return false;
      return true;
    });
    if (sortBy === "rating") {
      list = [...list].sort((a, b) => Number(b.rating) - Number(a.rating));
    } else if (sortBy === "delivery") {
      const mins = (t: string) => parseInt(t.match(/\d+/)?.[0] ?? "999", 10);
      list = [...list].sort((a, b) => mins(a.delivery_time) - mins(b.delivery_time));
    }
    return list;
  }, [nearbyStores, query, activeCategory, freeOnly, sortBy]);

  const featured = useMemo(
    () => [...filteredStores].sort((a, b) => Number(b.rating) - Number(a.rating)).slice(0, 6),
    [filteredStores],
  );

  const hasActiveFilters = !!(query || activeCategory || freeOnly || sortBy !== "relevance");

  const clearAll = () => {
    setQuery("");
    setActiveCategory(null);
    setFreeOnly(false);
    setSortBy("relevance");
  };

  return (
    <div className="min-h-screen bg-surface pb-24">
      {/* Top bar */}
      <header className="sticky top-0 z-30 bg-card border-b border-border">
        <div className="mx-auto max-w-5xl px-4 py-3 flex items-center gap-3">
          <img
            src={youlinkLogo}
            alt="Youlink"
            className="h-9 w-auto shrink-0 object-contain"
          />
          <button
            onClick={detectLocation}
            className="flex items-center gap-1.5 text-left mx-auto min-w-0 max-w-[55%]"
            title="Atualizar localização"
          >
            {locStatus === "loading" ? (
              <Loader2 className="h-5 w-5 text-brand animate-spin shrink-0" />
            ) : (
              <MapPin className="h-5 w-5 text-brand shrink-0" />
            )}
            <div className="flex flex-col leading-tight min-w-0">
              <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Entregar em
              </span>
              <span className="text-sm font-semibold text-foreground flex items-center gap-1 truncate">
                <span className="truncate">
                  {locStatus === "loading"
                    ? "Detectando..."
                    : location
                      ? location.label
                      : locStatus === "denied"
                        ? "Permitir localização"
                        : "Definir localização"}
                </span>
                <ChevronDown className="h-4 w-4 shrink-0" />
              </span>
            </div>
          </button>
          <div className="flex items-center gap-4 shrink-0">
            <Link to={user ? "/favoritos" : "/auth"} aria-label="Favoritos"><Heart className="h-5 w-5 text-foreground" /></Link>
            <Link to="/sacola" className="relative">
              <ShoppingBag className="h-5 w-5 text-foreground" />
              {cartCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-brand text-brand-foreground text-[10px] font-bold rounded-full h-4 min-w-[16px] px-1 flex items-center justify-center">
                  {cartCount}
                </span>
              )}
            </Link>
            {!user && (
              <Link to="/auth" className="text-xs font-semibold text-brand">Entrar</Link>
            )}
          </div>
        </div>

        {/* Search */}
        <div className="mx-auto max-w-5xl px-4 pb-3">
          <div className="flex items-center gap-2 rounded-full bg-muted px-4 py-2.5">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              ref={searchInputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="bg-transparent outline-none text-sm w-full placeholder:text-muted-foreground"
              placeholder="Busque por item ou loja"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                aria-label="Limpar busca"
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <nav className="mx-auto max-w-5xl px-4 pb-2 flex gap-6 overflow-x-auto no-scrollbar text-sm">
          {([
            { label: "Todos", slug: null },
            { label: "Restaurantes", slug: "restaurantes" },
            { label: "Mercado", slug: "mercado" },
            { label: "Bebidas", slug: "bebidas" },
            { label: "Farmácia", slug: "farmacia" },
            { label: "Pet", slug: "pet" },
            { label: "Shopping", slug: "shopping" },
          ] as const).map((t) => {
            if (t.slug === null) {
              const isActive = activeCategory === null;
              return (
                <button
                  key={t.label}
                  onClick={() => setActiveCategory(null)}
                  className={`shrink-0 pb-2 border-b-2 transition-colors ${
                    isActive
                      ? "border-brand text-brand font-semibold"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t.label}
                </button>
              );
            }
            return (
              <Link
                key={t.label}
                to="/categoria/$slug"
                params={{ slug: t.slug }}
                className="shrink-0 pb-2 border-b-2 border-transparent text-muted-foreground hover:text-foreground transition-colors"
              >
                {t.label}
              </Link>
            );
          })}
        </nav>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-5 space-y-8">
        {/* Categories grid */}
        <section>
          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-y-5 gap-x-2">
            {categoryList.map(({ slug, label, Icon, tint }) => (
              <Link
                key={slug}
                to="/categoria/$slug"
                params={{ slug }}
                className="flex flex-col items-center gap-2 group"
              >
                <span
                  className={`h-14 w-14 rounded-2xl flex items-center justify-center ${tint} transition-transform group-hover:scale-105`}
                >
                  <Icon className="h-6 w-6" />
                </span>
                <span className="text-[11px] text-center leading-tight text-foreground">
                  {label}
                </span>
              </Link>
            ))}
          </div>
        </section>

        {/* Promo banners */}
        <section className="flex gap-3 overflow-x-auto no-scrollbar -mx-4 px-4 snap-x snap-mandatory">
          <div
            className="shrink-0 w-[85%] sm:w-[420px] snap-start rounded-2xl p-5 text-brand-foreground relative overflow-hidden shadow-[var(--shadow-card)]"
            style={{ backgroundImage: "var(--gradient-promo)" }}
          >
            <span className="text-[11px] font-bold uppercase tracking-wide bg-white/20 px-2 py-0.5 rounded-full">
              Clube Youlink
            </span>
            <h3 className="mt-3 text-2xl font-extrabold leading-tight">Entrega grátis ilimitada</h3>
            <p className="text-sm opacity-90 mt-1">Em milhares de restaurantes perto de você</p>
            <button className="mt-4 bg-white text-brand text-sm font-bold px-4 py-2 rounded-full">
              Assinar agora
            </button>
            <div className="absolute -right-4 -bottom-4 text-7xl opacity-30 select-none">🛵</div>
          </div>
          <div className="shrink-0 w-[85%] sm:w-[420px] snap-start rounded-2xl p-5 bg-accent text-foreground relative overflow-hidden shadow-[var(--shadow-card)]">
            <span className="text-[11px] font-bold uppercase tracking-wide bg-brand/10 text-brand px-2 py-0.5 rounded-full">
              Cupons
            </span>
            <h3 className="mt-3 text-2xl font-extrabold leading-tight">Até 50% OFF</h3>
            <p className="text-sm text-muted-foreground mt-1">Em pedidos selecionados hoje</p>
            <button className="mt-4 bg-brand text-brand-foreground text-sm font-bold px-4 py-2 rounded-full">
              Ver cupons
            </button>
            <div className="absolute -right-2 -bottom-2 text-7xl opacity-30 select-none">🎟️</div>
          </div>
        </section>

        {/* Featured stores */}
        {featured.length > 0 && (
          <section>
            <div className="flex items-end justify-between mb-3">
              <div>
                <h2 className="text-lg font-bold">Lojas em destaque</h2>
                <p className="text-xs text-muted-foreground">As mais bem avaliadas perto de você</p>
              </div>
            </div>
            <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-4 px-4 snap-x snap-mandatory">
              {featured.map((r) => (
                <Link
                  key={`featured-${r.id}`}
                  to="/loja/$slug"
                  params={{ slug: r.slug }}
                  className="shrink-0 w-44 snap-start"
                >
                  <article className="bg-card rounded-2xl overflow-hidden shadow-[var(--shadow-card)] hover:translate-y-[-1px] transition-transform">
                    <div className="relative h-24 bg-muted flex items-center justify-center text-4xl">
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
                      {r.promo && (
                        <span className="absolute top-2 left-2 text-[10px] font-bold text-brand-foreground bg-brand px-1.5 py-0.5 rounded">
                          {r.promo}
                        </span>
                      )}
                    </div>
                    <div className="p-3">
                      <h3 className="font-semibold text-sm truncate">{r.name}</h3>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                        <Star className="h-3 w-3 fill-warning text-warning" />
                        <span className="font-semibold text-foreground">{Number(r.rating).toFixed(1)}</span>
                        <span>•</span>
                        <span className="truncate">{r.delivery_time}</span>
                      </div>
                    </div>
                  </article>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Restaurants list */}
        <section>
          <div className="flex items-end justify-between mb-3 gap-2">
            <div className="min-w-0">
              <h2 className="text-lg font-bold">Lojas</h2>
              <p className="text-xs text-muted-foreground">
                {filteredStores.length} {filteredStores.length === 1 ? "resultado" : "resultados"}
              </p>
            </div>
            <div className="flex gap-2 relative">
              <div className="relative">
                <button
                  onClick={() => { setSortOpen((v) => !v); setFilterOpen(false); }}
                  className={`text-xs font-semibold border rounded-full px-3 py-1.5 ${sortBy !== "relevance" ? "border-brand text-brand bg-brand-soft" : "border-border"}`}
                >
                  Ordenar
                </button>
                {sortOpen && (
                  <div className="absolute right-0 mt-2 w-52 bg-card border border-border rounded-xl shadow-lg z-20 p-1">
                    {([
                      ["relevance", "Relevância"],
                      ["rating", "Melhor avaliado"],
                      ["delivery", "Entrega mais rápida"],
                    ] as const).map(([val, label]) => (
                      <button
                        key={val}
                        onClick={() => { setSortBy(val); setSortOpen(false); }}
                        className={`w-full text-left text-sm px-3 py-2 rounded-lg hover:bg-muted ${sortBy === val ? "text-brand font-semibold" : "text-foreground"}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="relative">
                <button
                  onClick={() => { setFilterOpen((v) => !v); setSortOpen(false); }}
                  className={`text-xs font-semibold border rounded-full px-3 py-1.5 ${freeOnly ? "border-brand text-brand bg-brand-soft" : "border-border"}`}
                >
                  Filtrar
                </button>
                {filterOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-card border border-border rounded-xl shadow-lg z-20 p-3 space-y-2">
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={nearbyOnly}
                        onChange={(e) => setNearbyOnly(e.target.checked)}
                        className="accent-[hsl(var(--brand))]"
                      />
                      Apenas próximas a mim
                    </label>
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={freeOnly}
                        onChange={(e) => setFreeOnly(e.target.checked)}
                        className="accent-[hsl(var(--brand))]"
                      />
                      Apenas entrega grátis
                    </label>
                    <button
                      onClick={() => { clearAll(); setFilterOpen(false); }}
                      className="w-full text-xs text-muted-foreground hover:text-foreground pt-1 border-t border-border"
                    >
                      Limpar todos os filtros
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {hasActiveFilters && (
            <div className="flex flex-wrap gap-2 mb-3">
              {query && (
                <Chip onRemove={() => setQuery("")}>Busca: "{query}"</Chip>
              )}
              {activeCategory && (
                <Chip onRemove={() => setActiveCategory(null)}>{activeCategory}</Chip>
              )}
              {freeOnly && <Chip onRemove={() => setFreeOnly(false)}>Entrega grátis</Chip>}
              {sortBy !== "relevance" && (
                <Chip onRemove={() => setSortBy("relevance")}>
                  {sortBy === "rating" ? "Melhor avaliado" : "Entrega rápida"}
                </Chip>
              )}
              <button onClick={clearAll} className="text-xs text-brand font-semibold px-2 py-1">
                Limpar tudo
              </button>
            </div>
          )}

          {filteredStores.length === 0 ? (
            <div className="bg-card rounded-2xl p-8 text-center shadow-[var(--shadow-card)]">
              <div className="text-4xl mb-2">🔍</div>
              <p className="font-semibold">Nenhuma loja encontrada</p>
              <p className="text-sm text-muted-foreground mt-1">Tente ajustar a busca ou os filtros.</p>
              <button onClick={clearAll} className="mt-4 text-sm font-semibold text-brand">
                Limpar filtros
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredStores.map((r) => {
                const storeItems = [...items.filter((it) => it.store_id === r.id)]
                  .sort((a, b) => Number(!!b.promo) - Number(!!a.promo))
                  .slice(0, 4);
                return (
                  <StoreWithItemsCard
                    key={r.id}
                    store={r}
                    items={storeItems}
                    isFav={isFavorite(r.id)}
                    onToggleFav={() => {
                      if (!user) { window.location.href = "/auth"; return; }
                      toggleFavorite(r.id);
                    }}
                  />
                );
              })}
            </div>

          )}
        </section>
      </main>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 inset-x-0 bg-card border-t border-border z-30">
        <div className="mx-auto max-w-5xl grid grid-cols-5 px-2 py-2">
          {[
            { Icon: Home, label: "Início", active: true, to: "/" as const, onClick: () => window.scrollTo({ top: 0, behavior: "smooth" }) },
            { Icon: Search, label: "Busca", active: false, onClick: focusSearch },
            { Icon: Receipt, label: "Pedidos", active: false, onClick: focusSearch },
            { Icon: Heart, label: "Favoritos", active: false, to: (user ? "/favoritos" : "/auth") as "/favoritos" | "/auth" },
            { Icon: User, label: "Perfil", active: false, to: (user ? "/perfil" : "/auth") as "/perfil" | "/auth" },
          ].map(({ Icon, label, active, onClick, to }) => {
            const inner = (
              <>
                <Icon className={`h-5 w-5 ${active ? "text-brand" : "text-muted-foreground"}`} />
                <span className={`text-[11px] ${active ? "text-brand font-semibold" : "text-muted-foreground"}`}>
                  {label}
                </span>
              </>
            );
            if (to) {
              return (
                <Link key={label} to={to} className="flex flex-col items-center gap-1 py-1">
                  {inner}
                </Link>
              );
            }
            return (
              <button key={label} onClick={onClick} className="flex flex-col items-center gap-1 py-1">
                {inner}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

function Chip({ children, onRemove }: { children: React.ReactNode; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium bg-brand-soft text-brand rounded-full pl-3 pr-1 py-1">
      {children}
      <button
        onClick={onRemove}
        aria-label="Remover filtro"
        className="h-5 w-5 rounded-full hover:bg-brand/10 flex items-center justify-center"
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

function StoreCard({
  store: r,
  isFav,
  onToggleFav,
}: {
  store: StoreRow;
  isFav: boolean;
  onToggleFav: () => void;
}) {
  return (
    <div className="relative">
      <Link to="/loja/$slug" params={{ slug: r.slug }} className="block">
        <article className="bg-card rounded-2xl p-3 flex items-center gap-3 shadow-[var(--shadow-card)] hover:translate-y-[-1px] transition-transform">
          <div className="h-16 w-16 rounded-xl overflow-hidden bg-muted flex items-center justify-center text-3xl shrink-0">
            {r.image_url ? (
              <img
                src={r.image_url}
                alt={`Logo ${r.name}`}
                loading="lazy"
                width={64}
                height={64}
                className="h-full w-full object-cover"
              />
            ) : (
              <span>{r.emoji}</span>
            )}
          </div>
          <div className="flex-1 min-w-0 pr-8">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold truncate">{r.name}</h3>
              {r.promo && (
                <span className="text-[10px] font-bold text-brand bg-brand-soft px-1.5 py-0.5 rounded">
                  {r.promo}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
              <Star className="h-3.5 w-3.5 fill-warning text-warning" />
              <span className="font-semibold text-foreground">{Number(r.rating).toFixed(1)}</span>
              <span>•</span>
              <span className="truncate">{r.category}</span>
              <span>•</span>
              <span>{r.distance}</span>
            </div>
            <div className="flex items-center gap-3 text-xs mt-1.5">
              <span className="flex items-center gap-1 text-muted-foreground">
                <Clock className="h-3.5 w-3.5" /> {r.delivery_time}
              </span>
              <span className={`flex items-center gap-1 ${r.free_delivery ? "text-success font-semibold" : "text-muted-foreground"}`}>
                <Bike className="h-3.5 w-3.5" /> {r.delivery_fee}
              </span>
            </div>
          </div>
        </article>
      </Link>
      <button
        onClick={(e) => {
          e.preventDefault();
          onToggleFav();
        }}
        aria-label={isFav ? "Remover dos favoritos" : "Adicionar aos favoritos"}
        className="absolute top-3 right-3 p-2 rounded-full bg-card/80 hover:bg-muted"
      >
        <Heart className={`h-4 w-4 ${isFav ? "fill-brand text-brand" : "text-muted-foreground"}`} />
      </button>
    </div>
  );
}

function StoreWithItemsCard({
  store: r,
  items,
  isFav,
  onToggleFav,
}: {
  store: StoreRow;
  items: MenuItemRow[];
  isFav: boolean;
  onToggleFav: () => void;
}) {
  return (
    <article className="relative bg-card rounded-2xl shadow-[var(--shadow-card)] overflow-hidden">
      <Link
        to="/loja/$slug"
        params={{ slug: r.slug }}
        className="flex items-center gap-3 p-3 pr-12 hover:bg-muted/40 transition-colors"
      >
        <div className="h-14 w-14 rounded-xl overflow-hidden bg-muted flex items-center justify-center text-3xl shrink-0">
          {r.image_url ? (
            <img src={r.image_url} alt={r.name} loading="lazy" className="h-full w-full object-cover" />
          ) : (
            <span>{r.emoji}</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold truncate">{r.name}</h3>
            {r.promo && (
              <span className="text-[10px] font-bold text-brand bg-brand-soft px-1.5 py-0.5 rounded shrink-0">
                {r.promo}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
            <Star className="h-3.5 w-3.5 fill-warning text-warning" />
            <span className="font-semibold text-foreground">{Number(r.rating).toFixed(1)}</span>
            <span>•</span>
            <span className="truncate">{r.category}</span>
          </div>
          <div className="flex items-center gap-3 text-xs mt-1">
            <span className="flex items-center gap-1 text-muted-foreground">
              <Clock className="h-3.5 w-3.5" /> {r.delivery_time}
            </span>
            <span className={`flex items-center gap-1 ${r.free_delivery ? "text-success font-semibold" : "text-muted-foreground"}`}>
              <Bike className="h-3.5 w-3.5" /> {r.delivery_fee}
            </span>
          </div>
        </div>
      </Link>

      <button
        onClick={onToggleFav}
        aria-label={isFav ? "Remover dos favoritos" : "Adicionar aos favoritos"}
        className="absolute top-3 right-3 p-2 rounded-full bg-card/80 hover:bg-muted"
      >
        <Heart className={`h-4 w-4 ${isFav ? "fill-brand text-brand" : "text-muted-foreground"}`} />
      </button>

      {items.length > 0 && (
        <div className="px-3 pb-3 -mt-1">
          <div className="flex gap-2 overflow-x-auto no-scrollbar snap-x snap-mandatory">
            {items.map((it) => (
              <Link
                key={it.id}
                to="/loja/$slug"
                params={{ slug: r.slug }}
                className="shrink-0 w-32 snap-start bg-surface rounded-xl overflow-hidden border border-border hover:border-brand/40 transition-colors"
              >
                <div className="relative h-20 bg-muted flex items-center justify-center text-3xl">
                  {it.image_url ? (
                    <img src={it.image_url} alt={it.name} loading="lazy" className="h-full w-full object-cover" />
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
}
