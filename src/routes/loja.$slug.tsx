import { createFileRoute, Link, notFound, useRouter, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Star, Clock, Bike, MapPin, CreditCard, Tag, Plus, Minus, ShoppingBag, MessageSquare, X, CalendarClock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import { isStoreOpen, nextOpeningLabel, groupByWeekday, formatTime, WEEKDAYS, type StoreHour } from "@/lib/store-hours";
import { BookingDialog, type ServiceLite } from "@/components/BookingDialog";
import { StoreDistance } from "@/components/StoreDistance";

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
  promo: string | null;
  about: string | null;
  address: string | null;
  hours: string | null;
  payment_methods: string | null;
  min_order: number;
  is_paused: boolean;
  store_type: "food" | "ecommerce" | "service";
  slot_minutes: number;
  whatsapp: string | null;
  lat: number | null;
  lng: number | null;
}

interface MenuCategory {
  id: string;
  name: string;
  position: number;
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

    const [categoriesRes, itemsRes, couponsRes, reviewsRes, hoursRes, servicesRes] = await Promise.all([
      supabase.from("menu_categories").select("*").eq("store_id", store.id).order("position"),
      supabase.from("menu_items").select("*").eq("store_id", store.id).order("position"),
      supabase.from("store_coupons").select("*").eq("store_id", store.id),
      supabase.from("store_reviews").select("*").eq("store_id", store.id).order("created_at", { ascending: false }),
      supabase.from("store_hours").select("*").eq("store_id", store.id),
      supabase.from("services").select("*").eq("store_id", store.id).eq("is_active", true).order("position"),
    ]);

    return {
      store: store as Store,
      categories: (categoriesRes.data ?? []) as MenuCategory[],
      items: (itemsRes.data ?? []).map((i) => ({ ...i, price: Number(i.price), original_price: i.original_price ? Number(i.original_price) : null })) as MenuItem[],
      coupons: (couponsRes.data ?? []).map((c) => ({ ...c, min_order: Number(c.min_order) })) as Coupon[],
      reviews: (reviewsRes.data ?? []) as Review[],
      hours: (hoursRes.data ?? []) as StoreHour[],
      services: (servicesRes.data ?? []).map((s) => ({
        id: s.id as string,
        name: s.name as string,
        description: s.description as string | null,
        price: Number(s.price),
        duration_minutes: Number(s.duration_minutes),
        image_url: s.image_url as string | null,
      })),
    };
  },
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
  const { store, categories, items, coupons, reviews, hours, services } = Route.useLoaderData() as {
    store: Store;
    categories: MenuCategory[];
    items: MenuItem[];
    coupons: Coupon[];
    reviews: Review[];
    hours: StoreHour[];
    services: ServiceLite[];
  };
  const isService = store.store_type === "service";
  const { user } = useAuth();
  const { items: cartItems, addItem, updateQuantity, count: cartCount } = useCart();
  const [tab, setTab] = useState<"menu" | "info" | "reviews">("menu");
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [bookingInitialId, setBookingInitialId] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());

  // refresh "now" every minute so the open/closed badge updates without a refresh
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const withinHours = isStoreOpen(hours, now);
  const open = !store.is_paused && withinHours;
  const nextOpen = !open && !store.is_paused ? nextOpeningLabel(hours, now) : null;

  const tryAdd = async (storeId: string, menuItemId: string) => {
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
      await addItem(storeId, menuItemId);
    } catch (err) {
      if (err instanceof DifferentStoreError) {
        const ok = window.confirm(
          "Você só pode pedir de uma loja por vez (o pedido vai pelo WhatsApp). Limpar o carrinho atual e adicionar este item?",
        );
        if (ok) {
          await switchStoreAndAdd(storeId, menuItemId);
        }
      } else {
        throw err;
      }
    }
  };

  const itemQty = (id: string) => cartItems.find((c) => c.menu_item_id === id)?.quantity ?? 0;

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
        <div className="flex items-center gap-3 text-xs mt-2">
          <span className="flex items-center gap-1 text-muted-foreground">
            <Clock className="h-3.5 w-3.5" /> {store.delivery_time}
          </span>
          <span className={`flex items-center gap-1 ${store.free_delivery ? "text-success font-semibold" : "text-muted-foreground"}`}>
            <Bike className="h-3.5 w-3.5" /> {store.delivery_fee}
          </span>
        </div>
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

      <main className="px-4 pt-5">
        {tab === "menu" && isService && (
          <div className="space-y-3">
            {services.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-12">
                Esta loja ainda não cadastrou serviços.
              </p>
            ) : (
              services.map((s) => {
                const handleBook = () => {
                  if (!user) {
                    navigate({ to: "/auth" });
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
                };
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
                      <div className="flex items-center gap-2 mt-2">
                        <span className="font-bold text-sm">
                          R$ {s.price.toFixed(2).replace(".", ",")}
                        </span>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" /> {s.duration_minutes} min
                        </span>
                      </div>
                      <div className="mt-2">
                        <span
                          className="text-xs font-bold bg-brand text-brand-foreground rounded-full px-3 py-1.5 inline-flex items-center gap-1"
                          aria-hidden
                        >
                          {user ? (
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
              return (
                <section key={cat.id}>
                  <h3 className="font-bold text-base mb-3">{cat.name}</h3>
                  <div className="space-y-2">
                    {catItems.map((item) => {
                      const qty = itemQty(item.id);
                      return (
                        <article
                          key={item.id}
                          onClick={() => setSelectedItem(item)}
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
                          <div className="flex flex-col items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
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
                            {user ? (
                              qty > 0 ? (
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
                <div>
                  <p className="font-semibold text-sm">Endereço</p>
                  <p className="text-sm text-muted-foreground">{store.address}</p>
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
            {store.payment_methods && (
              <div className="flex items-start gap-3">
                <CreditCard className="h-5 w-5 text-brand shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-sm">Formas de pagamento</p>
                  <p className="text-sm text-muted-foreground">{store.payment_methods}</p>
                </div>
              </div>
            )}
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

              <div className="mt-6 flex items-center gap-3">
                {user ? (
                  <>
                    {itemQty(selectedItem.id) > 0 ? (
                      <div className="flex items-center gap-3 bg-brand-soft rounded-full px-3 py-2">
                        <button
                          onClick={() => {
                            const ci = cartItems.find((c) => c.menu_item_id === selectedItem.id);
                            if (ci) updateQuantity(ci.id, ci.quantity - 1);
                          }}
                          className="text-brand"
                          aria-label="Diminuir"
                        >
                          <Minus className="h-4 w-4" />
                        </button>
                        <span className="font-bold text-sm min-w-[20px] text-center">{itemQty(selectedItem.id)}</span>
                        <button onClick={() => tryAdd(store.id, selectedItem.id)} className="text-brand" aria-label="Aumentar">
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                    ) : null}
                    <button
                      onClick={async () => {
                        await tryAdd(store.id, selectedItem.id);
                        setSelectedItem(null);
                      }}
                      disabled={!open}
                      className="flex-1 bg-brand text-brand-foreground font-bold py-3 rounded-full disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {open ? "Adicionar à sacola" : "Loja fechada"}
                    </button>
                  </>
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
