import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import { useFavorites } from "@/contexts/FavoritesContext";
import { useAddress } from "@/contexts/AddressContext";
import { AddressPicker } from "@/components/AddressPicker";
import { supabase } from "@/integrations/supabase/client";
import { X } from "lucide-react";
import { normalizeText } from "@/hooks/use-location";
import { StoriesBar } from "@/components/StoriesBar";
import { StoreDistance } from "@/components/StoreDistance";
import { useUserCoords, haversineKm } from "@/lib/distance";
import { useInterestScores } from "@/hooks/use-interest-scores";
import { getRotationSeed, sortWithRotation } from "@/lib/rotation";

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
import { norm as normalize, isEcommerceStoreCategory } from "@/lib/categories";
import { getCategoryIcon } from "@/lib/category-icons";

type HomeCategoryRow = {
  slug: string;
  label: string;
  icon: string;
  tint: string;
  matches: string[];
  is_ecommerce: boolean;
};

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
  neighborhood: string | null;
  city: string | null;
  address: string | null;
  cep: string | null;
  lat: number | null;
  lng: number | null;
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
      .select("id, slug, name, emoji, image_url, category, rating, distance, delivery_time, delivery_fee, free_delivery, delivery_enabled, promo, neighborhood, city, address, cep, lat, lng")
      .eq("is_hidden", false)
      .order("name");
    if (error) throw error;
    const stores = (data ?? []) as StoreRow[];
    return { stores };
  },
  // Mantém o resultado do loader "fresco" por 60s ao navegar entre páginas
  staleTime: 60_000,
  gcTime: 5 * 60_000,
  errorComponent: ({ error }) => (
    <div className="min-h-screen flex items-center justify-center p-6 text-center text-sm text-muted-foreground">
      {error.message}
    </div>
  ),
  head: () => ({
    meta: [
      { title: "Youapp" },
      { name: "description", content: "Youapp" },
    ],
  }),
  component: Index,
});


function Index() {
  const { user } = useAuth();
  const { count: cartCount } = useCart();
  const { isFavorite, toggleFavorite } = useFavorites();
  const { stores } = Route.useLoaderData() as { stores: StoreRow[] };
  const { active } = useAddress();
  const userCoords = useUserCoords();
  const [pickerOpen, setPickerOpen] = useState(false);
  const location = active
    ? { neighborhood: active.neighborhood, city: active.city }
    : null;
  void location;

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

  // Categorias da home (gerenciadas pelo admin)
  const { data: homeCategories = [] } = useQuery({
    queryKey: ["home-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("home_categories")
        .select("slug,label,icon,tint,matches,is_ecommerce,is_active,position")
        .eq("is_active", true)
        .order("position");
      if (error) throw error;
      return (data ?? []) as HomeCategoryRow[];
    },
    staleTime: 5 * 60_000,
  });

  const ecomMatchSet = useMemo(() => {
    const s = new Set<string>();
    for (const c of homeCategories) {
      if (c.is_ecommerce) for (const m of c.matches) s.add(norm(m));
    }
    return s;
  }, [homeCategories, norm]);

  const isEcommerceStoreCategory = (storeCategory: string) =>
    ecomMatchSet.has(norm(storeCategory));

  const ecommerceCats = useMemo(
    () => homeCategories.filter((c) => c.is_ecommerce),
    [homeCategories],
  );

  // IDs das lojas e-commerce — usado para buscar produtos da vitrine sob demanda
  const ecomStoreIds = useMemo(
    () => stores.filter((s) => ecomMatchSet.has(norm(s.category))).map((s) => s.id),
    [stores, ecomMatchSet, norm],
  );

  // Vitrine: produtos das lojas e-commerce (lazy — só busca se houver alguma)
  const { data: items = [] } = useQuery({
    queryKey: ["home-vitrine-items", ecomStoreIds],
    enabled: ecomStoreIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("menu_items")
        .select("id, store_id, name, price, original_price, emoji, promo, image_url")
        .in("store_id", ecomStoreIds)
        .order("position", { ascending: true });
      if (error) throw error;
      return (data ?? []) as MenuItemRow[];
    },
    staleTime: 60_000,
  });

  // Score de interesse por loja (favoritos + cart + bookings).
  const interestScores = useInterestScores(stores);

  // Semente diária da rotação justa: garante que todas as lojas tenham
  // chance de aparecer no topo, mas mantém a ordem estável durante o dia.
  const rotationSeed = useMemo(() => getRotationSeed(user?.id), [user?.id]);

  // Lojas próximas: raio de 10 km do endereço do usuário.
  // Ordenação combina rodízio diário + interesse do usuário + proximidade.
  const nearbyStores = useMemo(() => {
    const RADIUS_KM = 10;
    const enriched = stores.map((s) => {
      const km =
        userCoords && s.lat != null && s.lng != null
          ? haversineKm(userCoords, { lat: s.lat, lng: s.lng })
          : null;
      return { store: s, km };
    });
    const inRange = userCoords
      ? enriched.filter((x) => x.km != null && x.km <= RADIUS_KM)
      : enriched;
    const list = inRange.length > 0 ? inRange : enriched;
    return sortWithRotation(list, (x) => x.store.id, {
      seed: rotationSeed,
      interest: (x) => interestScores.get(x.store.id) ?? 0,
      distanceKm: (x) => x.km,
    }).map((x) => x.store);
  }, [stores, userCoords, interestScores, rotationSeed]);

  const filteredStores = useMemo(() => {
    const q = norm(query.trim());
    const cat = activeCategory ? homeCategories.find((c) => c.label === activeCategory) : null;
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
  }, [nearbyStores, query, activeCategory, freeOnly, sortBy, homeCategories, norm]);

  // Lojas em destaque: rodízio diário garante que todas as lojas
  // (não só as melhor avaliadas) apareçam ao longo dos dias.
  // Mistura: rotação + interesse + um leve peso de rating como qualidade base.
  const featured = useMemo(() => {
    const pool = filteredStores.slice(0, 30); // candidatas
    return sortWithRotation(pool, (s) => s.id, {
      seed: rotationSeed,
      interest: (s) => (interestScores.get(s.id) ?? 0) + Number(s.rating ?? 0) * 0.2,
      rotationWeight: 1.4, // dá mais peso ao rodízio para variar mais a vitrine
    }).slice(0, 6);
  }, [filteredStores, interestScores, rotationSeed]);

  // Vitrine: produtos das lojas e-commerce
  const ecomStoreMap = useMemo(() => {
    const map = new Map<string, StoreRow>();
    for (const s of stores) {
      if (ecomMatchSet.has(norm(s.category))) map.set(s.id, s);
    }
    return map;
  }, [stores, ecomMatchSet, norm]);

  const vitrineProducts = useMemo(() => {
    const list = items.filter((it) => ecomStoreMap.has(it.store_id));
    return list
      .sort((a, b) => Number(!!b.promo) - Number(!!a.promo))
      .slice(0, 12);
  }, [items, ecomStoreMap]);

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
            alt="Youapp"
            className="h-9 w-auto shrink-0 object-contain"
          />
          <button
            onClick={() => setPickerOpen(true)}
            className="flex items-center gap-1.5 text-left mx-auto min-w-0 max-w-[55%]"
            title="Trocar endereço"
          >
            <MapPin className="h-5 w-5 text-brand shrink-0" />
            <div className="flex flex-col leading-tight min-w-0">
              <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                {active?.label ?? "Entregar em"}
              </span>
              <span className="text-sm font-semibold text-foreground flex items-center gap-1 truncate">
                <span className="truncate">
                  {active ? active.shortLabel : "Definir localização"}
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
          <Link
            to="/busca"
            className="flex items-center gap-2 rounded-full bg-muted px-4 py-2.5"
          >
            <Search className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              Busque por item ou loja
            </span>
          </Link>
        </div>

        {/* Stories — empresas em destaque */}
        <StoriesBar />
      </header>

      <main className="mx-auto max-w-5xl px-4 py-5 space-y-8">
        {/* Categories — 2 fileiras com scroll horizontal */}
        <section className="-mx-4">
          <div className="overflow-x-auto no-scrollbar px-4 snap-x">
            <div className="grid grid-rows-2 grid-flow-col auto-cols-[68px] sm:auto-cols-[80px] gap-y-5 gap-x-2">
              {homeCategories.map((c) => {
                const Icon = getCategoryIcon(c.icon);
                return (
                  <Link
                    key={c.slug}
                    to="/categoria/$slug"
                    params={{ slug: c.slug }}
                    className="flex flex-col items-center gap-2 group snap-start"
                  >
                    <span
                      className={`h-14 w-14 rounded-2xl flex items-center justify-center ${c.tint} transition-transform group-hover:scale-105`}
                    >
                      <Icon className="h-6 w-6" />
                    </span>
                    <span className="text-[11px] text-center leading-tight text-foreground">
                      {c.label}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        {/* Promo banners */}
        <section className="flex gap-3 overflow-x-auto no-scrollbar -mx-4 px-4 snap-x snap-mandatory">
          <Link
            to="/clube"
            className="shrink-0 w-[85%] sm:w-[420px] snap-start rounded-2xl p-5 text-brand-foreground relative overflow-hidden shadow-[var(--shadow-card)] block"
            style={{ backgroundImage: "var(--gradient-promo)" }}
          >
            <span className="text-[11px] font-bold uppercase tracking-wide bg-white/20 px-2 py-0.5 rounded-full">
              Clube Youapp
            </span>
            <h3 className="mt-3 text-2xl font-extrabold leading-tight">Entrega grátis ilimitada</h3>
            <p className="text-sm opacity-90 mt-1">Em milhares de restaurantes perto de você</p>
            <span className="mt-4 inline-block bg-white text-brand text-sm font-bold px-4 py-2 rounded-full">
              Assinar agora
            </span>
            <div className="absolute -right-4 -bottom-4 text-7xl opacity-30 select-none">🛵</div>
          </Link>
          <Link
            to="/cupons"
            className="shrink-0 w-[85%] sm:w-[420px] snap-start rounded-2xl p-5 bg-accent text-foreground relative overflow-hidden shadow-[var(--shadow-card)] block"
          >
            <span className="text-[11px] font-bold uppercase tracking-wide bg-brand/10 text-brand px-2 py-0.5 rounded-full">
              Cupons
            </span>
            <h3 className="mt-3 text-2xl font-extrabold leading-tight">Até 50% OFF</h3>
            <p className="text-sm text-muted-foreground mt-1">Em pedidos selecionados hoje</p>
            <span className="mt-4 inline-block bg-brand text-brand-foreground text-sm font-bold px-4 py-2 rounded-full">
              Ver cupons
            </span>
            <div className="absolute -right-2 -bottom-2 text-7xl opacity-30 select-none">🎟️</div>
          </Link>
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
              {featured.map((r, idx) => {
                const ecom = isEcommerceStoreCategory(r.category);
                const isLcp = idx === 0;
                const inner = (
                  <article className="bg-card rounded-2xl overflow-hidden shadow-[var(--shadow-card)] hover:translate-y-[-1px] transition-transform">
                    <div className="relative h-24 bg-muted flex items-center justify-center text-4xl">
                      {r.image_url ? (
                        <img
                          src={r.image_url}
                          alt={`Logo ${r.name}`}
                          loading={isLcp ? "eager" : "lazy"}
                          // @ts-expect-error fetchpriority is a valid HTML attribute
                          fetchpriority={isLcp ? "high" : undefined}
                          decoding={isLcp ? "sync" : "async"}
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
                        <span className="truncate">{ecom ? "Vitrine" : r.delivery_time}</span>
                      </div>
                    </div>
                  </article>
                );
                return ecom ? (
                  <Link
                    key={`featured-${r.id}`}
                    to="/vitrine/$slug"
                    params={{ slug: r.slug }}
                    className="shrink-0 w-44 snap-start"
                  >
                    {inner}
                  </Link>
                ) : (
                  <Link
                    key={`featured-${r.id}`}
                    to="/loja/$slug"
                    params={{ slug: r.slug }}
                    className="shrink-0 w-44 snap-start"
                  >
                    {inner}
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* Vitrine — e-commerce (Moda, Calçados, Acessórios, Beleza) */}
        {vitrineProducts.length > 0 && (
          <section>
            <div className="flex items-end justify-between mb-3">
              <div>
                <h2 className="text-lg font-bold">Vitrine</h2>
                <p className="text-xs text-muted-foreground">Moda, calçados, acessórios e beleza</p>
              </div>
              <div className="flex gap-1.5">
                {ecommerceCats.map((cat) => (
                  <Link
                    key={cat.slug}
                    to="/categoria/$slug"
                    params={{ slug: cat.slug }}
                    className="text-[11px] font-semibold border border-border rounded-full px-2.5 py-1 hover:border-brand hover:text-brand"
                  >
                    {cat.label}
                  </Link>
                ))}
              </div>
            </div>
            <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-4 px-4 snap-x snap-mandatory">
              {vitrineProducts.map((p) => {
                const s = ecomStoreMap.get(p.store_id);
                if (!s) return null;
                const hasDiscount =
                  !!p.original_price && Number(p.original_price) > Number(p.price);
                const discountPct = hasDiscount
                  ? Math.round((1 - Number(p.price) / Number(p.original_price)) * 100)
                  : 0;
                return (
                  <Link
                    key={p.id}
                    to="/produto/$id"
                    params={{ id: p.id }}
                    className="shrink-0 w-40 snap-start bg-card rounded-2xl overflow-hidden shadow-[var(--shadow-card)] hover:translate-y-[-1px] transition-transform"
                  >
                    <div className="relative aspect-square bg-muted flex items-center justify-center text-4xl">
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
                    </div>
                    <div className="p-2.5">
                      <p className="text-[11px] text-muted-foreground truncate">{s.name}</p>
                      <p className="text-xs font-medium leading-tight line-clamp-2 min-h-[32px] mt-0.5">
                        {p.name}
                      </p>
                      <div className="flex items-baseline gap-1.5 mt-1">
                        <span className="text-sm font-bold">
                          R$ {Number(p.price).toFixed(2).replace(".", ",")}
                        </span>
                        {hasDiscount && (
                          <span className="text-[10px] text-muted-foreground line-through">
                            R$ {Number(p.original_price).toFixed(2).replace(".", ",")}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}
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
                    <label className="flex items-center gap-2 text-sm cursor-pointer opacity-70">
                      <input
                        type="checkbox"
                        checked={!!userCoords}
                        readOnly
                        className="accent-[hsl(var(--brand))]"
                      />
                      Apenas em até 10 km
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
            { Icon: Search, label: "Busca", active: false, to: "/busca" as const },
            { Icon: Receipt, label: "Pedidos", active: false, to: (user ? "/pedidos" : "/auth") as "/pedidos" | "/auth" },
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
      <AddressPicker open={pickerOpen} onOpenChange={setPickerOpen} />
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
              <StoreDistance store={r} />
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
                  <span className={`flex items-center gap-1 ${r.free_delivery ? "text-success font-semibold" : "text-muted-foreground"}`}>
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
  const isEcom = isEcommerceStoreCategory(r.category);
  return (
    <article className="relative bg-card rounded-2xl shadow-[var(--shadow-card)] overflow-hidden">
      {isEcom ? (
        <Link
          to="/vitrine/$slug"
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
            <div className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-brand bg-brand-soft px-2 py-0.5 rounded-full">
              Vitrine · ver loja →
            </div>
          </div>
        </Link>
      ) : (
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
              {r.delivery_enabled === false ? (
                <span className="flex items-center gap-1 text-muted-foreground font-semibold">
                  <Bike className="h-3.5 w-3.5" /> Apenas retirada
                </span>
              ) : (
                <>
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" /> {r.delivery_time}
                  </span>
                  <span className={`flex items-center gap-1 ${r.free_delivery ? "text-success font-semibold" : "text-muted-foreground"}`}>
                    <Bike className="h-3.5 w-3.5" /> {r.delivery_fee}
                  </span>
                </>
              )}
            </div>
          </div>
        </Link>
      )}

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
            {items.map((it) => {
              const inner = (
                <>
                  <div className={`relative ${isEcom ? "aspect-square" : "h-20"} bg-muted flex items-center justify-center text-3xl`}>
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
                </>
              );
              const cls = "shrink-0 w-32 snap-start bg-surface rounded-xl overflow-hidden border border-border hover:border-brand/40 transition-colors";
              return isEcom ? (
                <Link key={it.id} to="/produto/$id" params={{ id: it.id }} className={cls}>
                  {inner}
                </Link>
              ) : (
                <Link key={it.id} to="/loja/$slug" params={{ slug: r.slug }} className={cls}>
                  {inner}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </article>
  );
}
