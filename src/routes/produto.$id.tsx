import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronLeft, ShoppingBag, Heart, Star, Truck, ShieldCheck, RotateCcw, Minus, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCart, DifferentStoreError } from "@/contexts/CartContext";
import { useFavorites } from "@/contexts/FavoritesContext";
import { toast } from "sonner";

interface Variation {
  id: string;
  name: string;
  price: number;
  original_price: number | null;
  is_available: boolean;
  position: number;
}

interface Product {
  id: string;
  store_id: string;
  name: string;
  description: string | null;
  price: number;
  original_price: number | null;
  emoji: string;
  image_url: string | null;
  promo: string | null;
  sizes: string[];
  colors: string[];
  variations: Variation[];
}

interface Store {
  id: string;
  slug: string;
  name: string;
  emoji: string;
  image_url: string | null;
  rating: number;
  category: string;
  delivery_time: string;
  delivery_fee: string;
  free_delivery: boolean;
  delivery_enabled: boolean;
  benefit_delivery_enabled: boolean;
  benefit_delivery_title: string;
  benefit_delivery_subtitle: string;
  benefit_protection_enabled: boolean;
  benefit_protection_title: string;
  benefit_protection_subtitle: string;
  benefit_return_enabled: boolean;
  benefit_return_title: string;
  benefit_return_subtitle: string;
}

export const Route = createFileRoute("/produto/$id")({
  loader: async ({ params }): Promise<{ product: Product; store: Store; related: Product[] }> => {
    const { data: product, error } = await supabase
      .from("menu_items")
      .select("id, store_id, name, description, price, original_price, emoji, image_url, promo, sizes, colors")
      .eq("id", params.id)
      .maybeSingle();
    if (error) throw error;
    if (!product) throw notFound();

    const { data: store, error: storeErr } = await supabase
      .from("stores")
      .select("id, slug, name, emoji, image_url, rating, category, delivery_time, delivery_fee, free_delivery, delivery_enabled, benefit_delivery_enabled, benefit_delivery_title, benefit_delivery_subtitle, benefit_protection_enabled, benefit_protection_title, benefit_protection_subtitle, benefit_return_enabled, benefit_return_title, benefit_return_subtitle")
      .eq("id", product.store_id)
      .maybeSingle();
    if (storeErr) throw storeErr;
    if (!store) throw notFound();

    const { data: related } = await supabase
      .from("menu_items")
      .select("id, store_id, name, description, price, original_price, emoji, image_url, promo, sizes, colors")
      .eq("store_id", product.store_id)
      .neq("id", product.id)
      .order("position")
      .limit(8);

    const relatedIds = (related ?? []).map((r) => r.id);
    const allIds = [product.id, ...relatedIds];
    const { data: variations } = await supabase
      .from("menu_item_variations")
      .select("id, menu_item_id, name, price, original_price, is_available, position")
      .in("menu_item_id", allIds)
      .eq("is_available", true)
      .order("position");

    const varsByItem = new Map<string, Variation[]>();
    for (const v of (variations ?? []) as Array<Variation & { menu_item_id: string }>) {
      const list = varsByItem.get(v.menu_item_id) ?? [];
      list.push({
        id: v.id,
        name: v.name,
        price: Number(v.price),
        original_price: v.original_price !== null ? Number(v.original_price) : null,
        is_available: v.is_available,
        position: v.position,
      });
      varsByItem.set(v.menu_item_id, list);
    }

    return {
      product: {
        ...product,
        sizes: Array.isArray(product.sizes) ? product.sizes : [],
        colors: Array.isArray(product.colors) ? product.colors : [],
        variations: varsByItem.get(product.id) ?? [],
      } as Product,
      store: store as Store,
      related: ((related ?? []) as Omit<Product, "variations">[]).map((p) => ({
        ...p,
        sizes: Array.isArray(p.sizes) ? p.sizes : [],
        colors: Array.isArray(p.colors) ? p.colors : [],
        variations: varsByItem.get(p.id) ?? [],
      })),
    };
  },
  errorComponent: ({ error }) => (
    <div className="min-h-screen flex items-center justify-center p-6 text-sm text-muted-foreground">
      {error.message}
    </div>
  ),
  notFoundComponent: () => (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 gap-3">
      <p className="font-semibold">Produto não encontrado</p>
      <Link to="/" className="text-sm text-brand font-semibold">Voltar</Link>
    </div>
  ),
  head: ({ loaderData }) => {
    const name = loaderData?.product?.name ?? "Produto";
    return {
      meta: [
        { title: `${name} — Youapp` },
        {
          name: "description",
          content: loaderData?.product?.description ?? `${name} disponível na vitrine Youapp.`,
        },
        { property: "og:title", content: name },
        ...(loaderData?.product?.image_url
          ? [{ property: "og:image", content: loaderData.product.image_url }]
          : []),
      ],
    };
  },
  component: ProductPage,
});

function ProductPage() {
  const { product, store, related } = Route.useLoaderData() as {
    product: Product;
    store: Store;
    related: Product[];
  };
  const { user } = useAuth();
  const { count: cartCount, addItem, switchStoreAndAdd } = useCart();
  const { isFavorite, toggleFavorite } = useFavorites();
  const fav = isFavorite(store.id);
  const [qty, setQty] = useState(1);
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [selectedVariationId, setSelectedVariationId] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);

  const fmt = (n: number) => `R$ ${Number(n).toFixed(2).replace(".", ",")}`;
  const hasVariations = (product.variations?.length ?? 0) > 0;
  const selectedVariation = hasVariations
    ? product.variations.find((v) => v.id === selectedVariationId) ?? null
    : null;

  // Preço corrente: variação selecionada > preço base. Se houver variações sem seleção,
  // mostramos "a partir de" usando o menor preço.
  const minVariationPrice = hasVariations
    ? Math.min(...product.variations.map((v) => Number(v.price)))
    : Number(product.price);
  const currentPrice = selectedVariation
    ? Number(selectedVariation.price)
    : hasVariations
      ? minVariationPrice
      : Number(product.price);
  const currentOriginalPrice = selectedVariation
    ? selectedVariation.original_price
    : product.original_price;

  const hasDiscount =
    !!currentOriginalPrice && Number(currentOriginalPrice) > Number(currentPrice);
  const discountPct = hasDiscount
    ? Math.round((1 - Number(currentPrice) / Number(currentOriginalPrice)) * 100)
    : 0;
  const totalPrice = Number(currentPrice) * qty;
  const hasSizes = product.sizes && product.sizes.length > 0;
  const hasColors = product.colors && product.colors.length > 0;

  const handleAdd = async () => {
    if (!user) {
      window.location.href = "/auth";
      return;
    }
    if (hasVariations && !selectedVariation) {
      toast.error("Escolha uma opção antes de adicionar.");
      return;
    }
    if (hasSizes && !selectedSize) {
      toast.error("Escolha um tamanho antes de adicionar.");
      return;
    }
    if (hasColors && !selectedColor) {
      toast.error("Escolha uma cor antes de adicionar.");
      return;
    }
    const sizeParts = [
      selectedVariation ? selectedVariation.name : selectedSize,
      selectedColor ? `Cor: ${selectedColor}` : null,
    ].filter(Boolean) as string[];
    const sizeForCart = sizeParts.length ? sizeParts.join(" · ") : null;
    const priceOverride = selectedVariation ? Number(selectedVariation.price) : null;
    setAdding(true);
    try {
      for (let i = 0; i < qty; i++) {
        await addItem(store.id, product.id, sizeForCart, priceOverride);
      }
    } catch (err) {
      if (err instanceof DifferentStoreError) {
        const ok = window.confirm(
          "Você só pode pedir de uma loja por vez (o pedido vai pelo WhatsApp). Limpar o carrinho atual e adicionar este item?",
        );
        if (ok) {
          await switchStoreAndAdd(store.id, product.id, sizeForCart, priceOverride);
          for (let i = 1; i < qty; i++) {
            await addItem(store.id, product.id, sizeForCart, priceOverride);
          }
        } else {
          setAdding(false);
          return;
        }
      } else {
        toast.error("Erro ao adicionar.");
        setAdding(false);
        return;
      }
    }
    setAdding(false);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  return (
    <div className="min-h-screen bg-surface pb-32">
      <header className="sticky top-0 z-30 bg-card border-b border-border">
        <div className="mx-auto max-w-5xl px-4 py-3 flex items-center gap-3">
          <Link to="/vitrine/$slug" params={{ slug: store.slug }} className="p-1 -ml-1 rounded-full hover:bg-muted" aria-label="Voltar">
            <ChevronLeft className="h-6 w-6" />
          </Link>
          <h1 className="flex-1 truncate text-sm font-semibold">{product.name}</h1>
          <Link to="/sacola" className="relative p-1">
            <ShoppingBag className="h-5 w-5" />
            {cartCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 bg-brand text-brand-foreground text-[10px] font-bold rounded-full h-4 min-w-[16px] px-1 flex items-center justify-center">
                {cartCount}
              </span>
            )}
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-4 space-y-5">
        {/* Galeria */}
        <div className="bg-card rounded-2xl overflow-hidden shadow-[var(--shadow-card)]">
          <div className="relative aspect-square bg-muted flex items-center justify-center text-8xl">
            {product.image_url ? (
              <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" />
            ) : (
              <span>{product.emoji}</span>
            )}
            {hasDiscount && (
              <span className="absolute top-3 left-3 text-xs font-bold text-brand-foreground bg-brand px-2 py-1 rounded-full">
                -{discountPct}% OFF
              </span>
            )}
            <button
              aria-label="Favoritar"
              onClick={() => {
                if (!user) {
                  toast.error("Faça login para favoritar");
                  return;
                }
                toggleFavorite(store.id);
              }}
              className="absolute top-3 right-3 h-9 w-9 bg-card/90 backdrop-blur rounded-full flex items-center justify-center shadow"
            >
              <Heart className={`h-4 w-4 ${fav ? "fill-brand text-brand" : ""}`} />
            </button>
          </div>
        </div>

        {/* Info */}
        <section className="space-y-3">
          <div>
            <Link
              to="/vitrine/$slug"
              params={{ slug: store.slug }}
              className="text-xs text-brand font-semibold"
            >
              {store.name}
            </Link>
            <h2 className="text-xl font-bold leading-tight mt-1">{product.name}</h2>
            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
              <Star className="h-3.5 w-3.5 fill-warning text-warning" />
              <span className="font-semibold text-foreground">{Number(store.rating).toFixed(1)}</span>
              <span>· loja oficial</span>
            </div>
          </div>

          <div className="bg-card rounded-2xl p-4 shadow-[var(--shadow-card)]">
            <div className="flex items-baseline gap-2 flex-wrap">
              {hasVariations && !selectedVariation && (
                <span className="text-xs text-muted-foreground">a partir de</span>
              )}
              <span className="text-3xl font-extrabold text-brand">{fmt(Number(currentPrice))}</span>
              {hasDiscount && (
                <span className="text-sm text-muted-foreground line-through">
                  {fmt(Number(currentOriginalPrice))}
                </span>
              )}
              {hasDiscount && (
                <span className="text-xs font-bold text-success bg-success/10 px-2 py-0.5 rounded-full">
                  Você economiza {fmt(Number(currentOriginalPrice) - Number(currentPrice))}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              em até 3x de {fmt(Number(currentPrice) / 3)} sem juros
            </p>
          </div>

          {hasVariations && (
            <div className="bg-card rounded-2xl p-4 shadow-[var(--shadow-card)]">
              <h3 className="font-semibold text-sm mb-2">
                Escolha uma opção <span className="text-destructive">*</span>
              </h3>
              <div className="flex flex-wrap gap-2">
                {product.variations.map((v) => {
                  const active = selectedVariationId === v.id;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setSelectedVariationId(v.id)}
                      className={
                        "px-3 py-2 rounded-xl border text-sm font-semibold transition-colors flex flex-col items-start gap-0.5 " +
                        (active
                          ? "bg-brand text-brand-foreground border-brand"
                          : "bg-card text-foreground border-border hover:border-brand")
                      }
                    >
                      <span>{v.name}</span>
                      <span className={"text-[11px] font-medium " + (active ? "opacity-90" : "text-muted-foreground")}>
                        {fmt(Number(v.price))}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {hasSizes && (
            <div className="bg-card rounded-2xl p-4 shadow-[var(--shadow-card)]">
              <h3 className="font-semibold text-sm mb-2">
                Escolha o tamanho <span className="text-destructive">*</span>
              </h3>
              <div className="flex flex-wrap gap-2">
                {product.sizes.map((s) => {
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

          {product.description && (
            <div className="bg-card rounded-2xl p-4 shadow-[var(--shadow-card)]">
              <h3 className="font-semibold text-sm mb-1">Descrição</h3>
              <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                {product.description}
              </p>
            </div>
          )}

          {(store.benefit_delivery_enabled || store.benefit_protection_enabled || store.benefit_return_enabled) && (
            <div className="bg-card rounded-2xl p-4 shadow-[var(--shadow-card)] space-y-3">
              {store.benefit_delivery_enabled && (
                <div className="flex items-start gap-3">
                  <div className="h-9 w-9 rounded-full bg-brand-soft text-brand flex items-center justify-center shrink-0">
                    <Truck className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{store.benefit_delivery_title}</p>
                    <p className="text-xs text-muted-foreground">{store.benefit_delivery_subtitle}</p>
                  </div>
                </div>
              )}
              {store.benefit_protection_enabled && (
                <div className="flex items-start gap-3">
                  <div className="h-9 w-9 rounded-full bg-brand-soft text-brand flex items-center justify-center shrink-0">
                    <ShieldCheck className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{store.benefit_protection_title}</p>
                    <p className="text-xs text-muted-foreground">{store.benefit_protection_subtitle}</p>
                  </div>
                </div>
              )}
              {store.benefit_return_enabled && (
                <div className="flex items-start gap-3">
                  <div className="h-9 w-9 rounded-full bg-brand-soft text-brand flex items-center justify-center shrink-0">
                    <RotateCcw className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{store.benefit_return_title}</p>
                    <p className="text-xs text-muted-foreground">{store.benefit_return_subtitle}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Relacionados */}
        {related.length > 0 && (
          <section>
            <h3 className="font-bold mb-3">Mais desta loja</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {related.map((p: Product) => (
                <Link
                  key={p.id}
                  to="/produto/$id"
                  params={{ id: p.id }}
                  className="bg-card rounded-2xl overflow-hidden shadow-[var(--shadow-card)] flex flex-col"
                >
                  <div className="relative aspect-square bg-muted flex items-center justify-center text-4xl">
                    {p.image_url ? (
                      <img src={p.image_url} alt={p.name} loading="lazy" className="h-full w-full object-cover" />
                    ) : (
                      <span>{p.emoji}</span>
                    )}
                  </div>
                  <div className="p-2">
                    <p className="text-xs font-medium leading-tight line-clamp-2 min-h-[32px]">{p.name}</p>
                    <p className="text-sm font-bold mt-1">{fmt(Number(p.price))}</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>

      {/* Barra de compra fixa */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-card border-t border-border">
        <div className="mx-auto max-w-5xl px-4 py-3 flex items-center gap-3">
          <div className="flex items-center gap-1 border border-border rounded-full p-1">
            <button
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              className="h-7 w-7 rounded-full hover:bg-muted flex items-center justify-center"
              aria-label="Diminuir"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <span className="w-6 text-center text-sm font-bold">{qty}</span>
            <button
              onClick={() => setQty((q) => q + 1)}
              className="h-7 w-7 rounded-full hover:bg-muted flex items-center justify-center"
              aria-label="Aumentar"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
          <button
            onClick={handleAdd}
            disabled={adding}
            className="flex-1 bg-brand text-brand-foreground font-bold py-3 rounded-full active:scale-[.98] transition disabled:opacity-60 flex items-center justify-center gap-2"
          >
            <ShoppingBag className="h-4 w-4" />
            {added ? "Adicionado ✓" : adding ? "Adicionando..." : `Adicionar · ${fmt(totalPrice)}`}
          </button>
        </div>
      </div>
    </div>
  );
}
