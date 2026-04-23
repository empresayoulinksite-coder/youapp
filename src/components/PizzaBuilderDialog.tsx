import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface PizzaFlavorChoice {
  menu_item_id: string;
  name: string;
  price: number;
}

export interface PizzaAddonChoice {
  id: string;
  name: string;
  price: number;
}

export interface PizzaConfigPayload {
  baseMenuItemId: string;
  baseName: string;
  sizeId: string;
  sizeName: string;
  flavors: PizzaFlavorChoice[];
  crust: { id: string; name: string; price: number } | null;
  addons: PizzaAddonChoice[];
  unitPrice: number; // max(flavor) + crust + sum(addons)
}

interface PizzaSize {
  id: string;
  name: string;
  slices: number;
  max_flavors: number;
  position: number;
  is_active: boolean;
}

interface FlavorItem {
  id: string;
  name: string;
  emoji: string;
  description: string | null;
  basePrice: number; // fallback do menu_items.price
}

interface SizePrice {
  menu_item_id: string;
  pizza_size_id: string;
  price: number;
  is_available: boolean;
}

interface Crust {
  id: string;
  name: string;
  price: number;
}

interface Addon {
  id: string;
  name: string;
  price: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  storeId: string;
  baseItem: { id: string; name: string; emoji: string; image_url: string | null; description: string | null };
  /** Sabores disponíveis nessa categoria (todos os menu_items da categoria pizza) */
  flavorItems: FlavorItem[];
  onConfirm: (payload: PizzaConfigPayload) => Promise<void> | void;
  disabled?: boolean;
}

export function PizzaBuilderDialog({ open, onClose, storeId, baseItem, flavorItems, onConfirm, disabled }: Props) {
  const [sizes, setSizes] = useState<PizzaSize[]>([]);
  const [prices, setPrices] = useState<SizePrice[]>([]);
  const [crusts, setCrusts] = useState<Crust[]>([]);
  const [addons, setAddons] = useState<Addon[]>([]);
  const [loading, setLoading] = useState(false);

  const [sizeId, setSizeId] = useState<string | null>(null);
  const [flavorIds, setFlavorIds] = useState<string[]>([]);
  const [crustId, setCrustId] = useState<string | null>(null);
  const [addonIds, setAddonIds] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    const itemIds = flavorItems.map((f) => f.id);
    Promise.all([
      supabase.from("pizza_sizes").select("*").eq("store_id", storeId).eq("is_active", true).order("position"),
      itemIds.length > 0
        ? supabase.from("menu_item_size_prices").select("*").in("menu_item_id", itemIds)
        : Promise.resolve({ data: [] as SizePrice[] }),
      supabase.from("pizza_crusts").select("*").eq("store_id", storeId).eq("is_active", true).order("position"),
      supabase.from("pizza_addons").select("*").eq("store_id", storeId).eq("is_active", true).order("position"),
    ]).then(([sz, pr, cr, ad]: any) => {
      const sizesData = (sz.data ?? []) as PizzaSize[];
      setSizes(sizesData);
      setPrices((pr.data ?? []).map((p: any) => ({ ...p, price: Number(p.price) })));
      setCrusts((cr.data ?? []).map((c: any) => ({ id: c.id, name: c.name, price: Number(c.price) })));
      setAddons((ad.data ?? []).map((a: any) => ({ id: a.id, name: a.name, price: Number(a.price) })));
      // pré-seleciona base como primeiro sabor e primeiro tamanho
      setSizeId(sizesData[0]?.id ?? null);
      setFlavorIds([baseItem.id]);
      setCrustId(null);
      setAddonIds([]);
      setLoading(false);
    });
  }, [open, storeId, baseItem.id]);

  const selectedSize = sizes.find((s) => s.id === sizeId) ?? null;
  const maxFlavors = selectedSize?.max_flavors ?? 1;

  // Quando trocar de tamanho, garante que respeitamos o limite
  useEffect(() => {
    if (flavorIds.length > maxFlavors) {
      setFlavorIds(flavorIds.slice(0, maxFlavors));
    }
  }, [maxFlavors]); // eslint-disable-line

  const priceOf = (menuItemId: string, sId: string | null): number => {
    if (!sId) return 0;
    const row = prices.find((p) => p.menu_item_id === menuItemId && p.pizza_size_id === sId);
    if (row && row.is_available) return Number(row.price);
    // fallback: usa o preço base do menu_items
    return flavorItems.find((f) => f.id === menuItemId)?.basePrice ?? 0;
  };

  const flavorPrice = useMemo(() => {
    if (!sizeId || flavorIds.length === 0) return 0;
    return Math.max(...flavorIds.map((id) => priceOf(id, sizeId)));
  }, [flavorIds, sizeId, prices]);

  const crust = crusts.find((c) => c.id === crustId) ?? null;
  const selectedAddons = addons.filter((a) => addonIds.includes(a.id));
  const addonsTotal = selectedAddons.reduce((s, a) => s + a.price, 0);
  const unitPrice = flavorPrice + (crust?.price ?? 0) + addonsTotal;

  const toggleFlavor = (id: string) => {
    setFlavorIds((cur) => {
      if (cur.includes(id)) return cur.filter((x) => x !== id);
      if (cur.length >= maxFlavors) {
        toast.error(`Esse tamanho permite no máximo ${maxFlavors} sabor${maxFlavors > 1 ? "es" : ""}.`);
        return cur;
      }
      return [...cur, id];
    });
  };

  const toggleAddon = (id: string) => {
    setAddonIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  };

  const handleConfirm = async () => {
    if (!selectedSize) {
      toast.error("Escolha um tamanho.");
      return;
    }
    if (flavorIds.length === 0) {
      toast.error("Escolha pelo menos um sabor.");
      return;
    }
    const flavors: PizzaFlavorChoice[] = flavorIds.map((id) => ({
      menu_item_id: id,
      name: flavorItems.find((f) => f.id === id)?.name ?? "",
      price: priceOf(id, selectedSize.id),
    }));
    await onConfirm({
      baseMenuItemId: baseItem.id,
      baseName: baseItem.name,
      sizeId: selectedSize.id,
      sizeName: selectedSize.name,
      flavors,
      crust: crust ? { id: crust.id, name: crust.name, price: crust.price } : null,
      addons: selectedAddons,
      unitPrice,
    });
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-card w-full max-w-md rounded-t-3xl sm:rounded-3xl max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom duration-200"
      >
        <div className="sticky top-0 bg-card border-b border-border px-5 py-3 flex items-center justify-between z-10">
          <h2 className="font-bold text-base truncate">🍕 Monte sua pizza</h2>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-muted" aria-label="Fechar">
            <X className="h-5 w-5" />
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Carregando opções...</div>
        ) : sizes.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Esta pizzaria ainda não cadastrou tamanhos. Avise o lojista.
          </div>
        ) : (
          <div className="p-5 space-y-6">
            {/* Tamanho */}
            <section>
              <p className="text-sm font-semibold mb-2">
                Tamanho <span className="text-destructive">*</span>
              </p>
              <div className="space-y-2">
                {sizes.map((s) => {
                  const active = sizeId === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSizeId(s.id)}
                      className={`w-full flex items-center justify-between gap-3 rounded-xl border-2 p-3 text-left transition-colors ${
                        active ? "border-brand bg-brand-soft" : "border-border bg-card"
                      }`}
                    >
                      <div>
                        <p className="font-bold text-sm">{s.name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {s.slices} fatias · até {s.max_flavors} sabor{s.max_flavors > 1 ? "es" : ""}
                        </p>
                      </div>
                      <span className="text-xs font-semibold text-muted-foreground">
                        a partir de R$ {Math.min(...flavorItems.map((f) => priceOf(f.id, s.id)).filter((n) => n > 0), Number.POSITIVE_INFINITY).toString() === "Infinity"
                          ? "—"
                          : Math.min(...flavorItems.map((f) => priceOf(f.id, s.id)).filter((n) => n > 0)).toFixed(2).replace(".", ",")}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Sabores */}
            <section>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold">
                  Sabores <span className="text-destructive">*</span>
                </p>
                <span className="text-[11px] text-muted-foreground">
                  {flavorIds.length}/{maxFlavors}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground mb-2">
                Cobramos o sabor mais caro entre os escolhidos.
              </p>
              <div className="space-y-1.5 max-h-72 overflow-y-auto border border-border rounded-xl p-2">
                {flavorItems.map((f) => {
                  const checked = flavorIds.includes(f.id);
                  const p = priceOf(f.id, sizeId);
                  return (
                    <label
                      key={f.id}
                      className={`flex items-start gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                        checked ? "bg-brand-soft" : "hover:bg-muted"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleFlavor(f.id)}
                        className="mt-1 h-4 w-4 accent-brand"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">
                          {f.emoji} {f.name}
                        </p>
                        {f.description && (
                          <p className="text-[11px] text-muted-foreground line-clamp-2">{f.description}</p>
                        )}
                      </div>
                      <span className="text-xs font-semibold shrink-0">
                        {p > 0 ? `R$ ${p.toFixed(2).replace(".", ",")}` : "—"}
                      </span>
                    </label>
                  );
                })}
              </div>
            </section>

            {/* Borda */}
            {crusts.length > 0 && (
              <section>
                <p className="text-sm font-semibold mb-2">Borda recheada (opcional)</p>
                <div className="space-y-1.5">
                  <button
                    type="button"
                    onClick={() => setCrustId(null)}
                    className={`w-full flex items-center justify-between gap-2 p-2.5 rounded-lg border text-sm ${
                      crustId === null ? "border-brand bg-brand-soft" : "border-border"
                    }`}
                  >
                    <span>Sem borda recheada</span>
                    <span className="text-xs text-muted-foreground">Grátis</span>
                  </button>
                  {crusts.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setCrustId(c.id)}
                      className={`w-full flex items-center justify-between gap-2 p-2.5 rounded-lg border text-sm ${
                        crustId === c.id ? "border-brand bg-brand-soft" : "border-border"
                      }`}
                    >
                      <span className="font-medium">{c.name}</span>
                      <span className="text-xs font-semibold">+ R$ {c.price.toFixed(2).replace(".", ",")}</span>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* Adicionais */}
            {addons.length > 0 && (
              <section>
                <p className="text-sm font-semibold mb-2">Adicionais (opcional)</p>
                <div className="space-y-1.5">
                  {addons.map((a) => (
                    <label
                      key={a.id}
                      className={`flex items-center justify-between gap-2 p-2.5 rounded-lg border text-sm cursor-pointer ${
                        addonIds.includes(a.id) ? "border-brand bg-brand-soft" : "border-border"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={addonIds.includes(a.id)}
                          onChange={() => toggleAddon(a.id)}
                          className="h-4 w-4 accent-brand"
                        />
                        <span className="font-medium">{a.name}</span>
                      </div>
                      <span className="text-xs font-semibold">+ R$ {a.price.toFixed(2).replace(".", ",")}</span>
                    </label>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        {/* Footer */}
        {!loading && sizes.length > 0 && (
          <div className="sticky bottom-0 bg-card border-t border-border p-4 flex items-center gap-3">
            <div className="flex-1">
              <p className="text-[11px] text-muted-foreground">Total</p>
              <p className="text-lg font-bold">R$ {unitPrice.toFixed(2).replace(".", ",")}</p>
            </div>
            <button
              type="button"
              disabled={disabled || unitPrice <= 0}
              onClick={handleConfirm}
              className="flex-1 bg-brand text-brand-foreground font-bold py-3 rounded-full disabled:opacity-50"
            >
              Adicionar à sacola
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
