import { createFileRoute, Link, notFound, useRouter, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, lazy, Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Star, Clock, Bike, MapPin, CreditCard, Tag, Plus, Minus, ShoppingBag, MessageSquare, X, CalendarClock, Navigation, Menu } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCart, DifferentStoreError } from "@/contexts/CartContext";
import { isStoreOpen, nextOpeningLabel, groupByWeekday, formatTime, WEEKDAYS, type StoreHour } from "@/lib/store-hours";
import { BookingDialog, type ServiceLite } from "@/components/BookingDialog";
import { StoreDistance } from "@/components/StoreDistance";
import { normalizePaymentList, paymentLabelsFromList } from "@/lib/payment-methods";
import type { PizzaConfigPayload } from "@/components/PizzaBuilderDialog";
import { StoreReelsSection } from "@/components/StoreReelsSection";
import { StoreFeedSection } from "@/components/StoreFeedSection";
import { GymSections } from "@/components/GymSections";
import { isGymStore } from "@/lib/gym";

// Dialogs pesados — carregados sob demanda quando o usuário abre
const PizzaBuilderDialog = lazy(() =>
  import("@/components/PizzaBuilderDialog").then((m) => ({ default: m.PizzaBuilderDialog })),
);
const StoreFeedServicesDialog = lazy(() =>
  import("@/components/StoreFeedServicesDialog").then((m) => ({ default: m.StoreFeedServicesDialog })),
);
const QuoteReviewDialog = lazy(() =>
  import("@/components/QuoteReviewDialog").then((m) => ({ default: m.QuoteReviewDialog })),
);

interface Store {
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
  about: string | null;
  address: string | null;
  hours: string | null;
  payment_methods: string | null;
  payment_methods_list: string[] | null;
  min_order: number;
  is_paused: boolean;
  store_type: "food" | "ecommerce" | "service";
  slot_minutes: number;
  whatsapp: string | null;
  lat: number | null;
  lng: number | null;
  show_route: boolean;
  route_url: string | null;
  feed_enabled?: boolean;
  booking_mode?: "booking" | "quote";
}

interface MenuCategory {
  id: string;
  name: string;
  position: number;
  is_pizza: boolean;
}

interface MenuItem {
  id: string;
  category_id: string;
  name: string;
  description: string | null;
  price: number;
  original_price: number | null;
  emoji: string;
  image_url: string | null;
  promo: string | null;
  sizes: string[];
  colors: string[];
}

interface Coupon {
  id: string;
  code: string;
  title: string;
  description: string | null;
  discount_label: string;
  min_order: number;
}

interface Review {
  id: string;
  author_name: string;
  rating: number;
  comment: string | null;
  created_at: string;
}

export const Route = createFileRoute("/loja/$slug")({
  loader: async ({ params }) => {
    const { data: store, error } = await supabase
      .from("stores")
      .select("*")
      .eq("slug", params.slug)
      .maybeSingle();
    if (error) throw error;
    if (!store) throw notFound();

    // Carrega só o essencial para o primeiro render (cardápio + horários + serviços)
    const [categoriesRes, itemsRes, hoursRes, servicesRes] = await Promise.all([
      supabase.from("menu_categories").select("*").eq("store_id", store.id).order("position"),
      supabase.from("menu_items").select("*").eq("store_id", store.id).eq("is_available", true).order("position"),
      supabase.from("store_hours").select("*").eq("store_id", store.id),
      supabase.from("services").select("*").eq("store_id", store.id).eq("is_active", true).order("position"),
    ]);

    return {
      store: store as Store,
      categories: (categoriesRes.data ?? []) as MenuCategory[],
      items: (itemsRes.data ?? []).map((i) => ({ ...i, price: Number(i.price), original_price: i.original_price ? Number(i.original_price) : null, sizes: Array.isArray(i.sizes) ? i.sizes : [], colors: Array.isArray((i as { colors?: string[] }).colors) ? (i as { colors: string[] }).colors : [] })) as MenuItem[],
      hours: (hoursRes.data ?? []) as StoreHour[],
      services: (servicesRes.data ?? []).map((s) => ({
        id: s.id as string,
        name: s.name as string,
        description: s.description as string | null,
        price: Number(s.price),
        duration_minutes: Number(s.duration_minutes),
        image_url: s.image_url as string | null,
        show_price: s.show_price ?? true,
        show_duration: s.show_duration ?? true,
      })),
    };
  },
  // Cache do loader: voltar para a loja é instantâneo
  staleTime: 60_000,
  gcTime: 5 * 60_000,
  errorComponent: ({ error }) => {
    const router = useRouter();
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-center">
        <div>
          <p className="text-sm text-muted-foreground mb-3">{error.message}</p>
          <button onClick={() => router.invalidate()} className="text-brand font-semibold">Tentar novamente</button>
        </div>
      </div>
    );
  },
  notFoundComponent: () => (
    <div className="min-h-screen flex items-center justify-center p-6 text-center">
      <div>
        <h1 className="text-2xl font-bold">Loja não encontrada</h1>
        <Link to="/" className="text-brand font-semibold mt-3 inline-block">Voltar para o início</Link>
      </div>
    </div>
  ),
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData ? `${loaderData.store.name} — Youapp` : "Loja — Youapp" },
      { name: "description", content: loaderData?.store.about ?? "Veja o cardápio e faça seu pedido." },
    ],
  }),
  component: StorePage,
});

function StorePage() {
  const router = useRouter();
  const navigate = useNavigate();
  const { store, categories, items, hours, services } = Route.useLoaderData() as {
    store: Store;
    categories: MenuCategory[];
    items: MenuItem[];
    hours: StoreHour[];
    services: ServiceLite[];
  };
  const isService = store.store_type === "service";
  const { user } = useAuth();
  const { items: cartItems, addItem, addHalfHalf, addPizza, switchStoreAndAdd, switchStoreAndAddHalfHalf, switchStoreAndAddPizza, updateQuantity, count: cartCount } = useCart();
  const [tab, setTab] = useState<"menu" | "info" | "reviews">("menu");
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [orderMode, setOrderMode] = useState<"whole" | "half">("whole");
  const [secondHalfId, setSecondHalfId] = useState<string | null>(null);
  const [pizzaBuilderItem, setPizzaBuilderItem] = useState<MenuItem | null>(null);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [bookingInitialId, setBookingInitialId] = useState<string | null>(null);
  const [quoteService, setQuoteService] = useState<typeof services[number] | null>(null);
  const [albumsOpen, setAlbumsOpen] = useState(false);
  const [albumsInitialCategory, setAlbumsInitialCategory] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [menuSheetOpen, setMenuSheetOpen] = useState(false);

  // Reviews e cupons são carregados sob demanda (só quando o usuário abre as abas / vê)
  const { data: reviews = [] } = useQuery({
    queryKey: ["store-reviews", store.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_reviews")
        .select("*")
        .eq("store_id", store.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Review[];
    },
    staleTime: 5 * 60_000,
  });

  const { data: coupons = [] } = useQuery({
    queryKey: ["store-coupons", store.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_coupons")
        .select("*")
        .eq("store_id", store.id)
        .eq("is_active", true);
      if (error) throw error;
      return (data ?? []).map((c) => ({ ...c, min_order: Number(c.min_order) })) as Coupon[];
    },
    staleTime: 5 * 60_000,
  });

  // refresh "now" every minute so the open/closed badge updates without a refresh
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  // Categorias visíveis (com itens) para o filtro sticky estilo iFood
  const visibleCategories = categories.filter((c) => items.some((i) => i.category_id === c.id));

  const ALL_CATEGORIES_ID = "__all__";

  // Seleciona "Todos" por padrão (ou mantém a atual se ainda existir)
  useEffect(() => {
    if (tab !== "menu" || isService || visibleCategories.length === 0) return;
    setActiveCategoryId((prev) => {
      if (prev === ALL_CATEGORIES_ID) return prev;
      if (prev && visibleCategories.some((c) => c.id === prev)) return prev;
      return ALL_CATEGORIES_ID;
    });
  }, [tab, isService, visibleCategories.map((c) => c.id).join(",")]);

  // Mantém a pílula ativa visível na barra horizontal
  useEffect(() => {
    if (!activeCategoryId) return;
    const btn = document.querySelector(`[data-cat-pill="${activeCategoryId}"]`) as HTMLElement | null;
    btn?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [activeCategoryId]);

  const selectCategory = (id: string) => {
    setActiveCategoryId(id);
    setMenuSheetOpen(false);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  // Reset selecionados quando trocar/abrir item
  useEffect(() => {
    setSelectedSize(null);
    setSelectedColor(null);
    setOrderMode("whole");
    setSecondHalfId(null);
  }, [selectedItem?.id]);

  const withinHours = isStoreOpen(hours, now);
  const open = !store.is_paused && withinHours;
  const nextOpen = !open && !store.is_paused ? nextOpeningLabel(hours, now) : null;

  const tryAdd = async (storeId: string, menuItemId: string, size: string | null = null) => {
    if (!open) {
      const msg = store.is_paused
        ? "Loja temporariamente fechada pelo lojista."
        : nextOpen
          ? `Loja fechada agora. ${nextOpen}.`
          : "Loja fechada no momento.";
      toast.error(msg);
      return;
    }
    try {
      await addItem(storeId, menuItemId, size);
    } catch (err) {
      if (err instanceof DifferentStoreError) {
        const ok = window.confirm(
          "Você só pode pedir de uma loja por vez (o pedido vai pelo WhatsApp). Limpar o carrinho atual e adicionar este item?",
        );
        if (ok) {
          await switchStoreAndAdd(storeId, menuItemId, size);
        }
      } else {
        throw err;
      }
    }
  };

  const tryAddHalfHalf = async (
    storeId: string,
    first: MenuItem,
    second: MenuItem,
    size: string | null,
  ) => {
    if (!open) {
      toast.error(store.is_paused ? "Loja fechada pelo lojista." : "Loja fechada no momento.");
      return;
    }
    const payload = {
      firstMenuItemId: first.id,
      firstName: first.name,
      firstPrice: Number(first.price),
      secondMenuItemId: second.id,
      secondName: second.name,
      secondPrice: Number(second.price),
      selectedSize: size,
    };
    try {
      await addHalfHalf(storeId, payload);
    } catch (err) {
      if (err instanceof DifferentStoreError) {
        const ok = window.confirm(
          "Você só pode pedir de uma loja por vez. Limpar o carrinho atual e adicionar este item?",
        );
        if (ok) await switchStoreAndAddHalfHalf(storeId, payload);
      } else {
        throw err;
      }
    }
  };

  const tryAddPizzas = async (storeId: string, payloads: PizzaConfigPayload[]) => {
    if (!open) {
      toast.error(store.is_paused ? "Loja fechada pelo lojista." : "Loja fechada no momento.");
      return;
    }
    if (payloads.length === 0) return;
    try {
      // primeira pizza pode disparar DifferentStoreError; depois disso o carrinho está na loja certa
      await addPizza(storeId, payloads[0]);
      for (let i = 1; i < payloads.length; i++) {
        await addPizza(storeId, payloads[i]);
      }
    } catch (err) {
      if (err instanceof DifferentStoreError) {
        const ok = window.confirm(
          payloads.length > 1
            ? `Você só pode pedir de uma loja por vez. Limpar o carrinho atual e adicionar essas ${payloads.length} pizzas?`
            : "Você só pode pedir de uma loja por vez. Limpar o carrinho atual e adicionar esta pizza?",
        );
        if (ok) {
          await switchStoreAndAddPizza(storeId, payloads[0]);
          for (let i = 1; i < payloads.length; i++) {
            await addPizza(storeId, payloads[i]);
          }
        }
      } else {
        throw err;
      }
    }
  };

  const itemQty = (id: string) => cartItems.filter((c) => c.menu_item_id === id).reduce((s, c) => s + c.quantity, 0);

  const openItemModal = (item: MenuItem) => {
    const cat = categories.find((c) => c.id === item.category_id);
    if (cat?.is_pizza) {
      setPizzaBuilderItem(item);
    } else {
      setSelectedItem(item);
    }
  };

  const avgRating = reviews.length
    ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
    : store.rating.toFixed(1);

  return (
    <div className="min-h-screen bg-surface pb-32">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-card border-b border-border">
        <div className="px-4 py-3 flex items-center gap-3">
          <Link to="/" className="p-1 -ml-1">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="font-semibold truncate flex-1">{store.name}</h1>
        </div>
      </header>

      {/* Cover */}
      <div
        className="h-40 flex items-center justify-center relative overflow-hidden"
        style={{ backgroundImage: "var(--gradient-promo)" }}
      >
        {store.image_url ? (
          <img
            src={store.image_url}
            alt={`Logo ${store.name}`}
            width={160}
            height={160}
            className="h-28 w-28 object-contain bg-white rounded-2xl p-2 shadow-md"
          />
        ) : (
          <span className="text-6xl">{store.emoji}</span>
        )}
      </div>

      {/* Store info card */}
      <div className="mx-4 -mt-6 bg-card rounded-2xl p-4 shadow-[var(--shadow-card)] relative">
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-xl font-bold">{store.name}</h2>
          <span
            className={`shrink-0 text-[11px] font-bold px-2 py-1 rounded-full ${
              open ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"
            }`}
          >
            {open ? "Aberta" : "Fechada"}
          </span>
        </div>
        {!open && store.is_paused && (
          <p className="text-[11px] text-muted-foreground mt-1">Pausada pelo lojista</p>
        )}
        {!open && !store.is_paused && nextOpen && (
          <p className="text-[11px] text-muted-foreground mt-1">{nextOpen}</p>
        )}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-2">
          <Star className="h-3.5 w-3.5 fill-warning text-warning" />
          <span className="font-semibold text-foreground">{avgRating}</span>
          <span>•</span>
          <span>{store.category}</span>
          <span>•</span>
          <StoreDistance store={store} />
        </div>
        {!isService && (
          <div className="flex items-center gap-3 text-xs mt-2">
            {store.delivery_enabled === false ? (
              <span className="flex items-center gap-1 text-muted-foreground font-semibold">
                <Bike className="h-3.5 w-3.5" /> Apenas retirada
              </span>
            ) : (
              <>
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" /> {store.delivery_time}
                </span>
                <span className={`flex items-center gap-1 ${store.free_delivery ? "text-success font-semibold" : "text-muted-foreground"}`}>
                  <Bike className="h-3.5 w-3.5" /> {store.delivery_fee}
                </span>
              </>
            )}
          </div>
        )}
        {store.min_order > 0 && (
          <p className="text-[11px] text-muted-foreground mt-2">Pedido mínimo: R$ {store.min_order.toFixed(2).replace(".", ",")}</p>
        )}
      </div>

      {/* Tabs */}
      <nav className="px-4 mt-5 flex gap-6 border-b border-border text-sm sticky top-[57px] bg-surface z-20">
        {([
          { id: "menu", label: isService ? "Serviços" : "Vitrine" },
          { id: "info", label: "Informações" },
          { id: "reviews", label: `Avaliações (${reviews.length})` },
        ] as const).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`pb-2 -mb-px border-b-2 transition-colors ${
              tab === t.id ? "border-brand text-brand font-semibold" : "border-transparent text-muted-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {/* Filtro de categorias estilo iFood */}
      {tab === "menu" && !isService && visibleCategories.length > 0 && (
        <div className="sticky top-[93px] bg-surface z-20 border-b border-border">
          <div className="flex items-stretch">
            <Sheet open={menuSheetOpen} onOpenChange={setMenuSheetOpen}>
              <SheetTrigger asChild>
                <button
                  className="px-3 flex items-center justify-center text-foreground border-r border-border shrink-0"
                  aria-label="Ver todas as categorias"
                >
                  <Menu className="h-5 w-5" />
                </button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[80vw] sm:w-80">
                <SheetHeader>
                  <SheetTitle>Categorias</SheetTitle>
                </SheetHeader>
                <ul className="mt-4 space-y-1">
                  {[{ id: ALL_CATEGORIES_ID, name: "Todos", count: items.length }, ...visibleCategories.map((c) => ({ id: c.id, name: c.name, count: items.filter((i) => i.category_id === c.id).length }))].map((c) => {
                    const active = activeCategoryId === c.id;
                    return (
                      <li key={c.id}>
                        <button
                          onClick={() => selectCategory(c.id)}
                          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-colors ${
                            active ? "bg-brand-soft text-brand font-semibold" : "hover:bg-accent"
                          }`}
                        >
                          <span className="truncate">{c.name}</span>
                          <span className="text-xs text-muted-foreground ml-2">{c.count}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </SheetContent>
            </Sheet>
            <div className="flex-1 overflow-x-auto no-scrollbar">
              <div className="flex gap-5 px-4 py-3 whitespace-nowrap">
                {[{ id: ALL_CATEGORIES_ID, name: "Todos" }, ...visibleCategories].map((c) => {
                  const active = activeCategoryId === c.id;
                  return (
                    <button
                      key={c.id}
                      data-cat-pill={c.id}
                      onClick={() => selectCategory(c.id)}
                      className={`text-sm pb-1 -mb-1 border-b-2 transition-colors ${
                        active ? "border-brand text-brand font-bold" : "border-transparent text-muted-foreground"
                      }`}
                    >
                      {c.name}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      <main className="px-4 pt-5">
        <div className="mb-5">
          <StoreReelsSection storeId={store.id} />
          {isService && store.feed_enabled && (
            <StoreFeedSection
              storeId={store.id}
              storeName={store.name}
              storeSlug={store.slug}
              onSeeServices={(categoryId) => {
                setAlbumsInitialCategory(categoryId);
                setAlbumsOpen(true);
              }}
            />
          )}
        </div>
        {albumsOpen && (
          <Suspense fallback={null}>
            <StoreFeedServicesDialog
              open={albumsOpen}
              onOpenChange={setAlbumsOpen}
              storeId={store.id}
              categoryId={albumsInitialCategory}
              isAuthenticated={!!user}
              bookingMode={store.booking_mode === "quote" ? "quote" : "booking"}
              onPickService={(serviceId) => {
                setAlbumsOpen(false);
                if (!user) {
                  navigate({ to: "/auth" });
                  return;
                }
                const svc = services.find((x) => x.id === serviceId);
                if (store.booking_mode === "quote") {
                  if (!svc) return;
                  setQuoteService(svc);
                  return;
                }
                if (!open) {
                  toast.error(
                    store.is_paused
                      ? "Loja fechada pelo lojista."
                      : nextOpen
                        ? `Fechada agora. ${nextOpen}.`
                        : "Loja fechada agora.",
                  );
                  return;
                }
                setBookingInitialId(serviceId);
                setBookingOpen(true);
              }}
            />
          </Suspense>
        )}
        {tab === "menu" && isService && (
          <div id="services-list" className="space-y-3">
            {isGymStore(store.category) && <GymSections storeId={store.id} />}
            {services.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-12">
                Esta loja ainda não cadastrou serviços.
              </p>
            ) : (
              services.map((s) => {
                function handleBook() {
                  if (!user) {
                    navigate({ to: "/auth" });
                    return;
                  }
                  if (store.booking_mode === "quote") {
                    setQuoteService(s);
                    return;
                  }
                  if (!open) {
                    toast.error(
                      store.is_paused
                        ? "Loja fechada pelo lojista."
                        : nextOpen
                          ? `Fechada agora. ${nextOpen}.`
                          : "Loja fechada agora.",
                    );
                    return;
                  }
                  setBookingInitialId(s.id);
                  setBookingOpen(true);
                }
                return (
                  <article
                    key={s.id}
                    onClick={handleBook}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleBook();
                      }
                    }}
                    className="bg-card rounded-2xl p-3 flex gap-3 shadow-[var(--shadow-card)] cursor-pointer transition-colors hover:bg-accent/40 focus:outline-none focus:ring-2 focus:ring-brand"
                  >
                    <div className="h-20 w-20 rounded-xl overflow-hidden bg-brand-soft flex items-center justify-center text-3xl shrink-0">
                      {s.image_url ? (
                        <img
                          src={s.image_url}
                          alt={s.name}
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span>✂️</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold truncate">{s.name}</h4>
                      {s.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                          {s.description}
                        </p>
                      )}
                      {(s.show_price !== false || s.show_duration !== false) && (
                        <div className="flex items-center gap-2 mt-2">
                          {s.show_price !== false && (
                            <span className="font-bold text-sm">
                              R$ {s.price.toFixed(2).replace(".", ",")}
                            </span>
                          )}
                          {s.show_duration !== false && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" /> {s.duration_minutes} min
                            </span>
                          )}
                        </div>
                      )}
                      <div className="mt-2">
                        <span
                          className="text-xs font-bold bg-brand text-brand-foreground rounded-full px-3 py-1.5 inline-flex items-center gap-1"
                          aria-hidden
                        >
                          {store.booking_mode === "quote" ? (
                            user ? (
                              <>
                                <MessageSquare className="h-3.5 w-3.5" /> Fazer orçamento
                              </>
                            ) : (
                              "Entrar para orçar"
                            )
                          ) : user ? (
                            <>
                              <CalendarClock className="h-3.5 w-3.5" /> Agendar
                            </>
                          ) : (
                            "Entrar para agendar"
                          )}
                        </span>
                      </div>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        )}

        {tab === "menu" && !isService && (
          <div className="space-y-7">
            {coupons.length > 0 && (
              <section>
                <h3 className="font-bold mb-2 flex items-center gap-2"><Tag className="h-4 w-4 text-brand" /> Cupons da loja</h3>
                <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-4 px-4">
                  {coupons.map((c) => (
                    <div key={c.id} className="shrink-0 w-64 rounded-2xl bg-brand-soft border border-brand/20 p-3">
                      <p className="text-xs font-bold text-brand uppercase tracking-wide">{c.discount_label}</p>
                      <p className="font-semibold text-sm mt-1">{c.title}</p>
                      {c.description && <p className="text-xs text-muted-foreground mt-0.5">{c.description}</p>}
                      <p className="text-[11px] text-muted-foreground mt-2">Código: <span className="font-mono font-bold text-foreground">{c.code}</span></p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {categories.map((cat) => {
              const catItems = items.filter((i) => i.category_id === cat.id);
              if (!catItems.length) return null;
              if (activeCategoryId && activeCategoryId !== ALL_CATEGORIES_ID && cat.id !== activeCategoryId) return null;
              return (
                <section key={cat.id} data-category-id={cat.id} className="scroll-mt-[150px]">
                  <h3 className="font-bold text-base mb-3">{cat.name}</h3>
                  <div className="space-y-2">
                    {catItems.map((item) => {
                      const qty = itemQty(item.id);
                      return (
                        <article
                          key={item.id}
                          onClick={() => openItemModal(item)}
                          className="bg-card rounded-2xl p-3 flex gap-3 shadow-[var(--shadow-card)] cursor-pointer active:scale-[0.99] transition-transform"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h4 className="font-semibold truncate">{item.name}</h4>
                              {item.promo && (
                                <span className="text-[10px] font-bold text-brand bg-brand-soft px-1.5 py-0.5 rounded">{item.promo}</span>
                              )}
                            </div>
                            {item.description && (
                              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{item.description}</p>
                            )}
                            <div className="flex items-center gap-2 mt-2">
                              <span className="font-bold text-sm">R$ {item.price.toFixed(2).replace(".", ",")}</span>
                              {item.original_price && (
                                <span className="text-xs text-muted-foreground line-through">R$ {item.original_price.toFixed(2).replace(".", ",")}</span>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-col items-center gap-2 shrink-0">
                            <div className="h-20 w-20 rounded-xl overflow-hidden bg-brand-soft flex items-center justify-center text-3xl">
                              {item.image_url ? (
                                <img
                                  src={item.image_url}
                                  alt={item.name}
                                  loading="lazy"
                                  width={80}
                                  height={80}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <span>{item.emoji}</span>
                              )}
                            </div>
                            <div onClick={(e) => e.stopPropagation()}>
                              {user ? (
                                cat.is_pizza ? (
                                  <button
                                    onClick={() => openItemModal(item)}
                                    className="text-brand bg-brand-soft rounded-full p-1.5"
                                    aria-label="Montar pizza"
                                  >
                                    <Plus className="h-4 w-4" />
                                  </button>
                                ) : item.sizes && item.sizes.length > 0 ? (
                                  <button
                                    onClick={() => openItemModal(item)}
                                    className="text-brand bg-brand-soft rounded-full p-1.5"
                                    aria-label="Escolher tamanho"
                                  >
                                    {qty > 0 ? (
                                      <span className="text-xs font-bold px-1">{qty}</span>
                                    ) : (
                                      <Plus className="h-4 w-4" />
                                    )}
                                  </button>
                                ) : qty > 0 ? (
                                  <div className="flex items-center gap-2 bg-brand text-brand-foreground rounded-full px-2 py-1">
                                    <button className="p-0.5" aria-label="Diminuir">
                                      <QtyDecrement itemId={item.id} />
                                    </button>
                                    <span className="text-xs font-bold min-w-[14px] text-center">{qty}</span>
                                    <button onClick={() => tryAdd(store.id, item.id)} className="p-0.5" aria-label="Aumentar">
                                      <Plus className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => tryAdd(store.id, item.id)}
                                    className="text-brand bg-brand-soft rounded-full p-1.5"
                                    aria-label="Adicionar"
                                  >
                                    <Plus className="h-4 w-4" />
                                  </button>
                                )
                              ) : (
                                <Link to="/auth" className="text-[10px] text-brand font-semibold">Entrar</Link>
                              )}
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        )}

        {tab === "info" && (
          <div className="space-y-4 bg-card rounded-2xl p-4 shadow-[var(--shadow-card)]">
            {store.about && (
              <div>
                <h3 className="font-bold text-sm mb-1">Sobre</h3>
                <p className="text-sm text-muted-foreground">{store.about}</p>
              </div>
            )}
            {store.address && (
              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-brand shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold text-sm">Endereço</p>
                  <p className="text-sm text-muted-foreground">{store.address}</p>
                  {store.show_route && (
                    <a
                      href={
                        store.route_url && store.route_url.trim()
                          ? store.route_url
                          : store.lat != null && store.lng != null
                            ? `https://www.google.com/maps/dir/?api=1&destination=${store.lat},${store.lng}`
                            : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
                                [store.address, store.name].filter(Boolean).join(", "),
                              )}`
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-brand bg-brand-soft hover:bg-brand/10 transition-colors rounded-full px-3 py-1.5"
                    >
                      <Navigation className="h-3.5 w-3.5" />
                      Ver rota até a loja
                    </a>
                  )}
                </div>
              </div>
            )}
            {(hours.length > 0 || store.hours) && (
              <div className="flex items-start gap-3">
                <Clock className="h-5 w-5 text-brand shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold text-sm flex items-center gap-2">
                    Horários
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                        open ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"
                      }`}
                    >
                      {open ? "Aberta agora" : "Fechada"}
                    </span>
                  </p>
                  {hours.length > 0 ? (
                    <ul className="text-sm text-muted-foreground mt-1 space-y-0.5">
                      {(() => {
                        const grouped = groupByWeekday(hours);
                        return WEEKDAYS.map((label, day) => {
                          const dayHours = grouped[day]?.filter((h) => h.is_active) ?? [];
                          return (
                            <li key={day} className="flex justify-between gap-3">
                              <span className={day === now.getDay() ? "font-semibold text-foreground" : ""}>
                                {label}
                              </span>
                              <span className="text-right">
                                {dayHours.length === 0
                                  ? "Fechada"
                                  : dayHours
                                      .map((h) => `${formatTime(h.opens_at)}–${formatTime(h.closes_at)}`)
                                      .join(", ")}
                              </span>
                            </li>
                          );
                        });
                      })()}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">{store.hours}</p>
                  )}
                </div>
              </div>
            )}
            {(() => {
              const list = paymentLabelsFromList(
                normalizePaymentList(store.payment_methods_list),
              );
              const text = list.length > 0 ? list.join(", ") : store.payment_methods;
              if (!text) return null;
              return (
                <div className="flex items-start gap-3">
                  <CreditCard className="h-5 w-5 text-brand shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-sm">Formas de pagamento</p>
                    <p className="text-sm text-muted-foreground">{text}</p>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {tab === "reviews" && (
          <ReviewsTab storeId={store.id} reviews={reviews} />
        )}
      </main>

      {/* Bottom cart bar (only for non-service stores) */}
      {!isService && cartCount > 0 && (
        <Link
          to="/sacola"
          className="fixed bottom-4 left-4 right-4 z-40 bg-brand text-brand-foreground rounded-full px-5 py-3 flex items-center justify-between shadow-lg max-w-md mx-auto"
        >
          <span className="flex items-center gap-2 font-semibold">
            <ShoppingBag className="h-5 w-5" />
            Ver sacola
          </span>
          <span className="bg-white/20 px-3 py-1 rounded-full text-sm font-bold">{cartCount} {cartCount === 1 ? "item" : "itens"}</span>
        </Link>
      )}

      {/* Item details modal */}
      {selectedItem && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center"
          onClick={() => setSelectedItem(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-card w-full max-w-md rounded-t-3xl sm:rounded-3xl max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom duration-200"
          >
            <div className="relative h-64 flex items-center justify-center overflow-hidden bg-muted" style={{ backgroundImage: !selectedItem.image_url ? "var(--gradient-promo)" : undefined }}>
              {selectedItem.image_url ? (
                <img
                  src={selectedItem.image_url}
                  alt={selectedItem.name}
                  width={512}
                  height={512}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-7xl">{selectedItem.emoji}</span>
              )}
              <button
                onClick={() => setSelectedItem(null)}
                className="absolute top-3 right-3 bg-card rounded-full p-2 shadow-md"
                aria-label="Fechar"
              >
                <X className="h-5 w-5" />
              </button>
              {selectedItem.promo && (
                <span className="absolute top-3 left-3 bg-brand text-brand-foreground text-xs font-bold px-2.5 py-1 rounded-full">
                  {selectedItem.promo}
                </span>
              )}
            </div>
            <div className="p-5">
              <h2 className="text-xl font-bold">{selectedItem.name}</h2>
              {selectedItem.description && (
                <p className="text-sm text-muted-foreground mt-2">{selectedItem.description}</p>
              )}
              <div className="flex items-baseline gap-2 mt-4">
                <span className="text-2xl font-bold">R$ {selectedItem.price.toFixed(2).replace(".", ",")}</span>
                {selectedItem.original_price && (
                  <span className="text-sm text-muted-foreground line-through">
                    R$ {selectedItem.original_price.toFixed(2).replace(".", ",")}
                  </span>
                )}
              </div>

              {selectedItem.sizes && selectedItem.sizes.length > 0 && (
                <div className="mt-5">
                  <p className="text-sm font-semibold mb-2">
                    Escolha o tamanho <span className="text-destructive">*</span>
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {selectedItem.sizes.map((s) => {
                      const active = selectedSize === s;
                      return (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setSelectedSize(s)}
                          className={
                            "min-w-[48px] px-3 py-2 rounded-xl border text-sm font-semibold transition-colors " +
                            (active
                              ? "bg-brand text-brand-foreground border-brand"
                              : "bg-card text-foreground border-border hover:border-brand")
                          }
                        >
                          {s}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {selectedItem.colors && selectedItem.colors.length > 0 && (
                <div className="mt-5">
                  <p className="text-sm font-semibold mb-2">
                    Escolha a cor <span className="text-destructive">*</span>
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {selectedItem.colors.map((c) => {
                      const active = selectedColor === c;
                      return (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setSelectedColor(c)}
                          className={
                            "px-3 py-2 rounded-xl border text-sm font-semibold transition-colors " +
                            (active
                              ? "bg-brand text-brand-foreground border-brand"
                              : "bg-card text-foreground border-border hover:border-brand")
                          }
                        >
                          {c}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {(() => {
                const cat = categories.find((c) => c.id === selectedItem.category_id);
                if (!cat?.is_pizza) return null;
                const flavorOptions = items.filter(
                  (i) => i.category_id === selectedItem.category_id && i.id !== selectedItem.id,
                );
                const second = flavorOptions.find((i) => i.id === secondHalfId) ?? null;
                const halfPrice = second
                  ? Math.max(Number(selectedItem.price), Number(second.price))
                  : Number(selectedItem.price);
                return (
                  <div className="mt-5">
                    <p className="text-sm font-semibold mb-2">Como você quer a pizza?</p>
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      <button
                        type="button"
                        onClick={() => { setOrderMode("whole"); setSecondHalfId(null); }}
                        className={`rounded-xl border-2 p-3 text-sm font-semibold transition-colors ${orderMode === "whole" ? "border-brand bg-brand-soft" : "border-border bg-card"}`}
                      >
                        🍕 Inteira
                      </button>
                      <button
                        type="button"
                        onClick={() => setOrderMode("half")}
                        className={`rounded-xl border-2 p-3 text-sm font-semibold transition-colors ${orderMode === "half" ? "border-brand bg-brand-soft" : "border-border bg-card"}`}
                      >
                        🍕½ Meio a meio
                      </button>
                    </div>
                    {orderMode === "half" && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-2">
                          1ª metade: <span className="font-semibold text-foreground">{selectedItem.name}</span> · Escolha o 2º sabor:
                        </p>
                        {flavorOptions.length === 0 ? (
                          <p className="text-xs text-destructive">Sem outros sabores cadastrados nesta categoria.</p>
                        ) : (
                          <div className="max-h-48 overflow-y-auto space-y-1 border border-border rounded-xl p-2">
                            {flavorOptions.map((f) => (
                              <button
                                key={f.id}
                                type="button"
                                onClick={() => setSecondHalfId(f.id)}
                                className={`w-full flex items-center justify-between gap-2 p-2 rounded-lg text-left text-sm ${secondHalfId === f.id ? "bg-brand-soft border border-brand" : "border border-transparent hover:bg-muted"}`}
                              >
                                <span className="truncate font-medium">{f.name}</span>
                                <span className="text-xs text-muted-foreground shrink-0">R$ {Number(f.price).toFixed(2).replace(".", ",")}</span>
                              </button>
                            ))}
                          </div>
                        )}
                        {second && (
                          <p className="text-xs text-muted-foreground mt-2">
                            Preço do meio a meio: <span className="font-bold text-foreground">R$ {halfPrice.toFixed(2).replace(".", ",")}</span> (cobramos o sabor mais caro)
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}

              <div className="mt-6 flex items-center gap-3">
                {user ? (
                  <button
                    onClick={async () => {
                      const needsSize = selectedItem.sizes && selectedItem.sizes.length > 0;
                      const needsColor = selectedItem.colors && selectedItem.colors.length > 0;
                      if (needsSize && !selectedSize) {
                        toast.error("Escolha um tamanho antes de adicionar.");
                        return;
                      }
                      if (needsColor && !selectedColor) {
                        toast.error("Escolha uma cor antes de adicionar.");
                        return;
                      }
                      const sizeParts = [
                        selectedSize,
                        selectedColor ? `Cor: ${selectedColor}` : null,
                      ].filter(Boolean) as string[];
                      const sizeForCart = sizeParts.length ? sizeParts.join(" · ") : null;
                      if (orderMode === "half") {
                        const second = items.find((i) => i.id === secondHalfId);
                        if (!second) {
                          toast.error("Escolha o 2º sabor da pizza.");
                          return;
                        }
                        await tryAddHalfHalf(store.id, selectedItem, second, sizeForCart);
                      } else {
                        await tryAdd(store.id, selectedItem.id, sizeForCart);
                      }
                      setSelectedItem(null);
                    }}
                    disabled={!open}
                    className="flex-1 bg-brand text-brand-foreground font-bold py-3 rounded-full disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {open ? "Adicionar à sacola" : "Loja fechada"}
                  </button>
                ) : (
                  <Link
                    to="/auth"
                    className="flex-1 bg-brand text-brand-foreground font-bold py-3 rounded-full text-center"
                  >
                    Entrar para pedir
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {pizzaBuilderItem && (
        <Suspense fallback={null}>
          <PizzaBuilderDialog
            open={!!pizzaBuilderItem}
            onClose={() => setPizzaBuilderItem(null)}
            storeId={store.id}
            baseItem={{
              id: pizzaBuilderItem.id,
              name: pizzaBuilderItem.name,
              emoji: pizzaBuilderItem.emoji,
              image_url: pizzaBuilderItem.image_url,
              description: pizzaBuilderItem.description,
            }}
            flavorItems={items
              .filter((i) => i.category_id === pizzaBuilderItem.category_id)
              .map((i) => ({
                id: i.id,
                name: i.name,
                emoji: i.emoji,
                description: i.description,
                basePrice: Number(i.price),
              }))}
            disabled={!open}
            onConfirm={async (payloads) => {
              await tryAddPizzas(store.id, payloads);
              setPizzaBuilderItem(null);
            }}
          />
        </Suspense>
      )}

      <BookingDialog
        open={bookingOpen}
        onClose={() => setBookingOpen(false)}
        storeId={store.id}
        storeName={store.name}
        storeWhatsapp={store.whatsapp}
        slotMinutes={store.slot_minutes || 30}
        storeHours={hours}
        services={services}
        initialServiceId={bookingInitialId}
        onCreated={() => router.invalidate()}
      />

      {quoteService && (
        <Suspense fallback={null}>
          <QuoteReviewDialog
            open={!!quoteService}
            onOpenChange={(o) => !o && setQuoteService(null)}
            service={quoteService}
            storeName={store.name}
            storeWhatsapp={store.whatsapp}
            customerName={(user?.user_metadata?.display_name as string) || null}
          />
        </Suspense>
      )}
    </div>
  );
}

function QtyDecrement({ itemId }: { itemId: string }) {
  const { items, updateQuantity } = useCart();
  const ci = items.find((c) => c.menu_item_id === itemId);
  return (
    <Minus
      className="h-3.5 w-3.5"
      onClick={(e) => {
        e.stopPropagation();
        if (ci) updateQuantity(ci.id, ci.quantity - 1);
      }}
    />
  );
}

function ReviewsTab({ storeId, reviews: initial }: { storeId: string; reviews: Review[] }) {
  const { user } = useAuth();
  const router = useRouter();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [reviews, setReviews] = useState<Review[]>(initial);

  useEffect(() => setReviews(initial), [initial]);

  const submit = async () => {
    if (!user) return;
    setSubmitting(true);
    const authorName = (user.user_metadata?.display_name as string) || user.email?.split("@")[0] || "Cliente";
    const { data, error } = await supabase
      .from("store_reviews")
      .insert({ store_id: storeId, user_id: user.id, author_name: authorName, rating, comment: comment || null })
      .select()
      .single();
    if (!error && data) {
      setReviews([data as Review, ...reviews]);
      setComment("");
      setRating(5);
      router.invalidate();
    }
    setSubmitting(false);
  };

  return (
    <div className="space-y-4">
      <div className="bg-card rounded-2xl p-4 shadow-[var(--shadow-card)]">
        <h3 className="font-bold text-sm mb-2 flex items-center gap-2"><MessageSquare className="h-4 w-4 text-brand" /> Avaliar loja</h3>
        {user ? (
          <>
            <div className="flex gap-1 mb-3">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} onClick={() => setRating(n)} aria-label={`${n} estrelas`}>
                  <Star className={`h-7 w-7 ${n <= rating ? "fill-warning text-warning" : "text-muted-foreground"}`} />
                </button>
              ))}
            </div>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Conte como foi sua experiência..."
              className="w-full rounded-lg border border-border bg-surface text-sm p-3 min-h-[80px]"
            />
            <button
              onClick={submit}
              disabled={submitting}
              className="mt-3 bg-brand text-brand-foreground font-bold text-sm px-5 py-2 rounded-full disabled:opacity-50"
            >
              {submitting ? "Enviando..." : "Enviar avaliação"}
            </button>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            <Link to="/auth" className="text-brand font-semibold">Entre</Link> para avaliar esta loja.
          </p>
        )}
      </div>

      {reviews.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">Ainda não há avaliações. Seja o primeiro!</p>
      ) : (
        <div className="space-y-2">
          {reviews.map((r) => (
            <div key={r.id} className="bg-card rounded-2xl p-4 shadow-[var(--shadow-card)]">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-sm">{r.author_name}</p>
                <div className="flex">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star key={n} className={`h-3.5 w-3.5 ${n <= r.rating ? "fill-warning text-warning" : "text-muted-foreground"}`} />
                  ))}
                </div>
              </div>
              {r.comment && <p className="text-sm text-muted-foreground mt-1">{r.comment}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
