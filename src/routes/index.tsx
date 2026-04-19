import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import { supabase } from "@/integrations/supabase/client";

import {
  MapPin,
  ChevronDown,
  Search,
  ShoppingBag,
  Heart,
  User,
  Home,
  Receipt,
  UtensilsCrossed,
  Pizza,
  Beef,
  IceCream,
  Coffee,
  Sandwich,
  Soup,
  Salad,
  Cookie,
  Beer,
  Apple,
  Star,
  Clock,
  Bike,
} from "lucide-react";
import youlinkLogo from "@/assets/youlink-logo.png";

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

export const Route = createFileRoute("/")({
  loader: async () => {
    const { data, error } = await supabase
      .from("stores")
      .select("id, slug, name, emoji, image_url, category, rating, distance, delivery_time, delivery_fee, free_delivery, promo")
      .order("name");
    if (error) throw error;
    return { stores: (data ?? []) as StoreRow[] };
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

type Category = { label: string; Icon: typeof Pizza; tint: string };

const categories: Category[] = [
  { label: "Restaurantes", Icon: UtensilsCrossed, tint: "bg-brand-soft text-brand" },
  { label: "Mercado", Icon: Apple, tint: "bg-green-50 text-green-600" },
  { label: "Lanches", Icon: Sandwich, tint: "bg-amber-50 text-amber-600" },
  { label: "Pizza", Icon: Pizza, tint: "bg-orange-50 text-orange-600" },
  { label: "Brasileira", Icon: Beef, tint: "bg-rose-50 text-rose-600" },
  { label: "Japonesa", Icon: Soup, tint: "bg-pink-50 text-pink-600" },
  { label: "Saudável", Icon: Salad, tint: "bg-emerald-50 text-emerald-600" },
  { label: "Doces", Icon: Cookie, tint: "bg-yellow-50 text-yellow-700" },
  { label: "Sorvetes", Icon: IceCream, tint: "bg-sky-50 text-sky-600" },
  { label: "Café", Icon: Coffee, tint: "bg-stone-100 text-stone-700" },
  { label: "Bebidas", Icon: Beer, tint: "bg-indigo-50 text-indigo-600" },
];

function Index() {
  const { user } = useAuth();
  const { count: cartCount } = useCart();
  const { stores } = Route.useLoaderData() as { stores: StoreRow[] };

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
          <button className="flex items-center gap-1.5 text-left mx-auto">
            <MapPin className="h-5 w-5 text-brand" />
            <div className="flex flex-col leading-tight">
              <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Entregar em</span>
              <span className="text-sm font-semibold text-foreground flex items-center gap-1">
                Rua das Flores, 123 <ChevronDown className="h-4 w-4" />
              </span>
            </div>
          </button>
          <div className="flex items-center gap-4 shrink-0">
            <Heart className="h-5 w-5 text-foreground" />
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
              className="bg-transparent outline-none text-sm w-full placeholder:text-muted-foreground"
              placeholder="Busque por item ou loja"
            />
          </div>
        </div>

        {/* Tabs */}
        <nav className="mx-auto max-w-5xl px-4 pb-2 flex gap-6 overflow-x-auto no-scrollbar text-sm">
          {["Restaurantes", "Mercado", "Bebidas", "Farmácia", "Pet", "Shopping"].map((t, i) => (
            <button
              key={t}
              className={`shrink-0 pb-2 border-b-2 transition-colors ${
                i === 0
                  ? "border-brand text-brand font-semibold"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-5 space-y-8">
        {/* Categories grid */}
        <section>
          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-y-5 gap-x-2">
            {categories.map(({ label, Icon, tint }) => (
              <button key={label} className="flex flex-col items-center gap-2 group">
                <span className={`h-14 w-14 rounded-2xl flex items-center justify-center ${tint} transition-transform group-hover:scale-105`}>
                  <Icon className="h-6 w-6" />
                </span>
                <span className="text-[11px] text-foreground text-center leading-tight">{label}</span>
              </button>
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
        <section>
          <div className="flex items-end justify-between mb-3">
            <div>
              <h2 className="text-lg font-bold">Lojas em destaque</h2>
              <p className="text-xs text-muted-foreground">As mais bem avaliadas perto de você</p>
            </div>
          </div>
          <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-4 px-4 snap-x snap-mandatory">
            {[...stores]
              .sort((a, b) => Number(b.rating) - Number(a.rating))
              .slice(0, 6)
              .map((r) => (
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

        {/* Restaurants list */}
        <section>
          <div className="flex items-end justify-between mb-3">
            <div>
              <h2 className="text-lg font-bold">Lojas</h2>
              <p className="text-xs text-muted-foreground">Lojas perto de você</p>
            </div>
            <div className="flex gap-2">
              <button className="text-xs font-semibold border border-border rounded-full px-3 py-1.5">Ordenar</button>
              <button className="text-xs font-semibold border border-border rounded-full px-3 py-1.5">Filtrar</button>
            </div>
          </div>

          <div className="space-y-3">
            {stores.map((r) => (
              <Link
                key={r.id}
                to="/loja/$slug"
                params={{ slug: r.slug }}
                className="block"
              >
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
                  <div className="flex-1 min-w-0">
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
            ))}
          </div>
        </section>
      </main>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 inset-x-0 bg-card border-t border-border z-30">
        <div className="mx-auto max-w-5xl grid grid-cols-5 px-2 py-2">
          {[
            { Icon: Home, label: "Início", active: true },
            { Icon: Search, label: "Busca" },
            { Icon: Receipt, label: "Pedidos" },
            { Icon: Heart, label: "Favoritos" },
            { Icon: User, label: "Perfil" },
          ].map(({ Icon, label, active }) => (
            <button key={label} className="flex flex-col items-center gap-1 py-1">
              <Icon className={`h-5 w-5 ${active ? "text-brand" : "text-muted-foreground"}`} />
              <span className={`text-[11px] ${active ? "text-brand font-semibold" : "text-muted-foreground"}`}>
                {label}
              </span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
