import { createFileRoute } from "@tanstack/react-router";
import youlinkLogo from "@/assets/youlink-logo.png";
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

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "iFood — Comida, mercado e farmácia em casa" },
      {
        name: "description",
        content:
          "Peça comida, mercado, farmácia e mais com entrega rápida. Os melhores restaurantes da sua região no iFood.",
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

type Restaurant = {
  name: string;
  emoji: string;
  rating: number;
  category: string;
  distance: string;
  time: string;
  fee: string;
  free?: boolean;
  promo?: string;
};

const restaurants: Restaurant[] = [
  { name: "Burger Habits", emoji: "🍔", rating: 4.8, category: "Lanches", distance: "1,2 km", time: "25-35 min", fee: "Grátis", free: true, promo: "20% OFF" },
  { name: "Sabor da Casa", emoji: "🍛", rating: 4.7, category: "Brasileira", distance: "2,1 km", time: "30-40 min", fee: "R$ 6,99" },
  { name: "Sushi Kyoto", emoji: "🍣", rating: 4.9, category: "Japonesa", distance: "3,4 km", time: "40-55 min", fee: "R$ 9,90", promo: "Leve+ Pague-" },
  { name: "Pizzaria Bella", emoji: "🍕", rating: 4.6, category: "Pizza", distance: "1,8 km", time: "35-45 min", fee: "Grátis", free: true },
  { name: "Açaí da Praia", emoji: "🍧", rating: 4.8, category: "Sorvetes", distance: "0,9 km", time: "15-25 min", fee: "R$ 4,99" },
  { name: "Verde & Leve", emoji: "🥗", rating: 4.7, category: "Saudável", distance: "2,7 km", time: "30-40 min", fee: "Grátis", free: true, promo: "Cupom R$10" },
  { name: "Padaria Central", emoji: "🥐", rating: 4.5, category: "Padaria", distance: "0,6 km", time: "20-30 min", fee: "R$ 3,99" },
  { name: "Cantina Italiana", emoji: "🍝", rating: 4.6, category: "Italiana", distance: "2,9 km", time: "40-50 min", fee: "R$ 7,90" },
];

function Index() {
  return (
    <div className="min-h-screen bg-surface pb-24">
      {/* Top bar */}
      <header className="sticky top-0 z-30 bg-card border-b border-border">
        <div className="mx-auto max-w-5xl px-4 py-3 flex items-center gap-3">
          <img
            src="/fe9f7ef1-e88c-46e8-9138-bd1aeadbab22.png"
            alt="Youlink"
            className="h-9 w-auto shrink-0"
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
            <ShoppingBag className="h-5 w-5 text-foreground" />
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
        <section className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div
            className="rounded-2xl p-5 text-brand-foreground relative overflow-hidden shadow-[var(--shadow-card)]"
            style={{ backgroundImage: "var(--gradient-promo)" }}
          >
            <span className="text-[11px] font-bold uppercase tracking-wide bg-white/20 px-2 py-0.5 rounded-full">
              Clube iFood
            </span>
            <h3 className="mt-3 text-2xl font-extrabold leading-tight">Entrega grátis ilimitada</h3>
            <p className="text-sm opacity-90 mt-1">Em milhares de restaurantes perto de você</p>
            <button className="mt-4 bg-white text-brand text-sm font-bold px-4 py-2 rounded-full">
              Assinar agora
            </button>
            <div className="absolute -right-4 -bottom-4 text-7xl opacity-30 select-none">🛵</div>
          </div>
          <div className="rounded-2xl p-5 bg-accent text-foreground relative overflow-hidden shadow-[var(--shadow-card)]">
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

        {/* Famous brands */}
        <section>
          <div className="flex items-end justify-between mb-3">
            <h2 className="text-lg font-bold">Famosos no iFood</h2>
            <button className="text-sm text-brand font-semibold">Ver mais</button>
          </div>
          <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
            {[
              { name: "McDonald's", emoji: "🍟", tint: "bg-yellow-100" },
              { name: "Burger King", emoji: "👑", tint: "bg-orange-100" },
              { name: "Subway", emoji: "🥪", tint: "bg-green-100" },
              { name: "KFC", emoji: "🍗", tint: "bg-red-100" },
              { name: "Habib's", emoji: "🥙", tint: "bg-rose-100" },
              { name: "Outback", emoji: "🥩", tint: "bg-amber-100" },
              { name: "Bob's", emoji: "🍔", tint: "bg-red-50" },
              { name: "Domino's", emoji: "🍕", tint: "bg-blue-100" },
            ].map((b) => (
              <div key={b.name} className="shrink-0 w-20 flex flex-col items-center gap-2">
                <div className={`h-16 w-16 rounded-full flex items-center justify-center text-2xl ${b.tint} shadow-[var(--shadow-soft)]`}>
                  {b.emoji}
                </div>
                <span className="text-[11px] text-center leading-tight">{b.name}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Restaurants list */}
        <section>
          <div className="flex items-end justify-between mb-3">
            <div>
              <h2 className="text-lg font-bold">Lojas</h2>
              <p className="text-xs text-muted-foreground">Mais de 200 lojas perto de você</p>
            </div>
            <div className="flex gap-2">
              <button className="text-xs font-semibold border border-border rounded-full px-3 py-1.5">Ordenar</button>
              <button className="text-xs font-semibold border border-border rounded-full px-3 py-1.5">Filtrar</button>
            </div>
          </div>

          <div className="space-y-3">
            {restaurants.map((r) => (
              <article
                key={r.name}
                className="bg-card rounded-2xl p-3 flex items-center gap-3 shadow-[var(--shadow-card)] hover:translate-y-[-1px] transition-transform"
              >
                <div className="h-16 w-16 rounded-xl bg-brand-soft flex items-center justify-center text-3xl shrink-0">
                  {r.emoji}
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
                    <span className="font-semibold text-foreground">{r.rating.toFixed(1)}</span>
                    <span>•</span>
                    <span className="truncate">{r.category}</span>
                    <span>•</span>
                    <span>{r.distance}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs mt-1.5">
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" /> {r.time}
                    </span>
                    <span className={`flex items-center gap-1 ${r.free ? "text-success font-semibold" : "text-muted-foreground"}`}>
                      <Bike className="h-3.5 w-3.5" /> {r.fee}
                    </span>
                  </div>
                </div>
              </article>
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
