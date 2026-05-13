import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Search, X } from "lucide-react";
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
  basePrice: number;
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
  categoryId: string;
  baseItem: { id: string; name: string; emoji: string; image_url: string | null; description: string | null };
  flavorItems: FlavorItem[];
  /** Recebe 1 payload (modo meio a meio) ou N payloads (modo separadas). */
  onConfirm: (payloads: PizzaConfigPayload[]) => Promise<void> | void;
  disabled?: boolean;
}

type Mode = "combined" | "separate";

export function PizzaBuilderDialog({ open, onClose, storeId, categoryId, baseItem, flavorItems, onConfirm, disabled }: Props) {

  const [sizes, setSizes] = useState<PizzaSize[]>([]);
  const [prices, setPrices] = useState<SizePrice[]>([]);
  const [crusts, setCrusts] = useState<Crust[]>([]);
  const [addons, setAddons] = useState<Addon[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const [sizeId, setSizeId] = useState<string | null>(null);
  const [flavorIds, setFlavorIds] = useState<string[]>([]);
  const [mode, setMode] = useState<Mode>("combined");

  // combined mode
  const [crustId, setCrustId] = useState<string | null>(null);
  const [addonIds, setAddonIds] = useState<string[]>([]);

  // separate mode: por sabor (flavorId -> { crustId, addonIds })
  const [perFlavor, setPerFlavor] = useState<Record<string, { crustId: string | null; addonIds: string[] }>>({});
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    const itemIds = flavorItems.map((f) => f.id);
    Promise.all([
      supabase.from("pizza_sizes").select("*").eq("store_id", storeId).eq("is_active", true).order("position"),
      itemIds.length > 0
        ? supabase.from("menu_item_size_prices").select("*").in("menu_item_id", itemIds)
        : Promise.resolve({ data: [] as SizePrice[] }),
      supabase.from("pizza_crusts").select("*").eq("category_id", categoryId).eq("is_active", true).order("position"),
      supabase.from("pizza_addons").select("*").eq("category_id", categoryId).eq("is_active", true).order("position"),
    ]).then(([sz, pr, cr, ad]: any) => {
      const sizesData = (sz.data ?? []) as PizzaSize[];
      setSizes(sizesData);
      setPrices((pr.data ?? []).map((p: any) => ({ ...p, price: Number(p.price) })));
      setCrusts((cr.data ?? []).map((c: any) => ({ id: c.id, name: c.name, price: Number(c.price) })));
      setAddons((ad.data ?? []).map((a: any) => ({ id: a.id, name: a.name, price: Number(a.price) })));
      setSizeId(sizesData[0]?.id ?? null);
      setFlavorIds([baseItem.id]);
      setMode("combined");
      setCrustId(null);
      setAddonIds([]);
      setPerFlavor({});
      setExpanded(null);
      setSearchQuery("");
      setLoading(false);
    });
  }, [open, storeId, baseItem.id]);

  const selectedSize = sizes.find((s) => s.id === sizeId) ?? null;
  const maxFlavorsCombined = selectedSize?.max_flavors ?? 1;
  // No modo separado, sem limite (cada sabor = uma pizza inteira)
  const maxFlavors = mode === "combined" ? maxFlavorsCombined : flavorItems.length;

  useEffect(() => {
    if (mode === "combined" && flavorIds.length > maxFlavorsCombined) {
      setFlavorIds(flavorIds.slice(0, maxFlavorsCombined));
    }
  }, [maxFlavorsCombined, mode]); // eslint-disable-line

  const priceOf = (menuItemId: string, sId: string | null): number => {
    if (!sId) return 0;
    const row = prices.find((p) => p.menu_item_id === menuItemId && p.pizza_size_id === sId);
    if (row && row.is_available) return Number(row.price);
    return flavorItems.find((f) => f.id === menuItemId)?.basePrice ?? 0;
  };

  // === Cálculo do total ===
  const combinedFlavorPrice = useMemo(() => {
    if (!sizeId || flavorIds.length === 0) return 0;
    return Math.max(...flavorIds.map((id) => priceOf(id, sizeId)));
  }, [flavorIds, sizeId, prices]);

  const combinedCrust = crusts.find((c) => c.id === crustId) ?? null;
  const combinedAddons = addons.filter((a) => addonIds.includes(a.id));
  const combinedAddonsTotal = combinedAddons.reduce((s, a) => s + a.price, 0);
  const combinedUnitPrice = combinedFlavorPrice + (combinedCrust?.price ?? 0) + combinedAddonsTotal;

  const separateUnitPrice = (flavorId: string): number => {
    const base = priceOf(flavorId, sizeId);
    const cfg = perFlavor[flavorId];
    const c = cfg?.crustId ? crusts.find((x) => x.id === cfg.crustId)?.price ?? 0 : 0;
    const a = (cfg?.addonIds ?? []).reduce((s, id) => s + (addons.find((x) => x.id === id)?.price ?? 0), 0);
    return base + c + a;
  };

  const separateTotal = useMemo(() => {
    return flavorIds.reduce((s, id) => s + separateUnitPrice(id), 0);
  }, [flavorIds, sizeId, prices, perFlavor, crusts, addons]);

  const totalPrice = mode === "combined" ? combinedUnitPrice : separateTotal;

  const toggleFlavor = (id: string) => {
    setFlavorIds((cur) => {
      if (cur.includes(id)) {
        // remove config também
        setPerFlavor((p) => {
          const { [id]: _, ...rest } = p;
          return rest;
        });
        return cur.filter((x) => x !== id);
      }
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

  const setFlavorCrust = (flavorId: string, cId: string | null) => {
    setPerFlavor((p) => ({
      ...p,
      [flavorId]: { crustId: cId, addonIds: p[flavorId]?.addonIds ?? [] },
    }));
  };
  const toggleFlavorAddon = (flavorId: string, addonId: string) => {
    setPerFlavor((p) => {
      const cur = p[flavorId] ?? { crustId: null, addonIds: [] };
      const next = cur.addonIds.includes(addonId)
        ? cur.addonIds.filter((x) => x !== addonId)
        : [...cur.addonIds, addonId];
      return { ...p, [flavorId]: { ...cur, addonIds: next } };
    });
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

    if (mode === "combined") {
      const flavors: PizzaFlavorChoice[] = flavorIds.map((id) => ({
        menu_item_id: id,
        name: flavorItems.find((f) => f.id === id)?.name ?? "",
        price: priceOf(id, selectedSize.id),
      }));
      await onConfirm([
        {
          baseMenuItemId: baseItem.id,
          baseName: baseItem.name,
          sizeId: selectedSize.id,
          sizeName: selectedSize.name,
          flavors,
          crust: combinedCrust ? { id: combinedCrust.id, name: combinedCrust.name, price: combinedCrust.price } : null,
          addons: combinedAddons,
          unitPrice: combinedUnitPrice,
        },
      ]);
      return;
    }

    // separate: 1 payload por sabor
    const payloads: PizzaConfigPayload[] = flavorIds.map((id) => {
      const item = flavorItems.find((f) => f.id === id);
      const cfg = perFlavor[id];
      const c = cfg?.crustId ? crusts.find((x) => x.id === cfg.crustId) ?? null : null;
      const a = (cfg?.addonIds ?? [])
        .map((aid) => addons.find((x) => x.id === aid))
        .filter((x): x is Addon => !!x);
      const base = priceOf(id, selectedSize.id);
      const unit = base + (c?.price ?? 0) + a.reduce((s, x) => s + x.price, 0);
      return {
        baseMenuItemId: id, // cada pizza tem o próprio sabor como base
        baseName: item?.name ?? "",
        sizeId: selectedSize.id,
        sizeName: selectedSize.name,
        flavors: [{ menu_item_id: id, name: item?.name ?? "", price: base }],
        crust: c ? { id: c.id, name: c.name, price: c.price } : null,
        addons: a,
        unitPrice: unit,
      };
    });
    await onConfirm(payloads);
  };

  if (!open) return null;

  const canSeparate = flavorItems.length >= 1; // sempre pode separar

  const filteredFlavorItems = useMemo(() => {
    if (!searchQuery.trim()) return flavorItems;
    const lowerQuery = searchQuery.toLowerCase();
    return flavorItems.filter((f) => 
      f.name.toLowerCase().includes(lowerQuery) || 
      (f.description && f.description.toLowerCase().includes(lowerQuery))
    );
  }, [flavorItems, searchQuery]);

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
            {/* Modo: combinada x separadas */}
            {canSeparate && (
              <section>
                <p className="text-sm font-semibold mb-2">Como você quer pedir?</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setMode("combined")}
                    className={`rounded-xl border-2 p-3 text-left transition-colors ${
                      mode === "combined" ? "border-brand bg-brand-soft" : "border-border bg-card"
                    }`}
                  >
                    <p className="font-bold text-sm">Juntar em 1 pizza</p>
                    <p className="text-[11px] text-muted-foreground">Meio a meio (sabor mais caro)</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode("separate")}
                    className={`rounded-xl border-2 p-3 text-left transition-colors ${
                      mode === "separate" ? "border-brand bg-brand-soft" : "border-border bg-card"
                    }`}
                  >
                    <p className="font-bold text-sm">Pedir separadas</p>
                    <p className="text-[11px] text-muted-foreground">Cada sabor = 1 pizza inteira</p>
                  </button>
                </div>
              </section>
            )}

            {/* Tamanho */}
            <section>
              <p className="text-sm font-semibold mb-2">
                Tamanho <span className="text-destructive">*</span>
              </p>
              <div className="space-y-2">
                {sizes.map((s) => {
                  const active = sizeId === s.id;
                  const minPriceArr = flavorItems.map((f) => priceOf(f.id, s.id)).filter((n) => n > 0);
                  const minPrice = minPriceArr.length ? Math.min(...minPriceArr) : 0;
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
                          {s.slices} fatias
                          {mode === "combined" && (
                            <> · até {s.max_flavors} sabor{s.max_flavors > 1 ? "es" : ""}</>
                          )}
                        </p>
                      </div>
                      <span className="text-xs font-semibold text-muted-foreground">
                        {minPrice > 0 ? `a partir de R$ ${minPrice.toFixed(2).replace(".", ",")}` : "—"}
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
                  {flavorIds.length}
                  {mode === "combined" ? `/${maxFlavors}` : ""}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground mb-2">
                {mode === "combined"
                  ? "Cobramos o sabor mais caro entre os escolhidos."
                  : "Cada sabor vira uma pizza inteira na sacola."}
              </p>

              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Buscar sabor..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-background border border-input rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition-all"
                />
              </div>

              <div className="space-y-1.5 max-h-72 overflow-y-auto border border-border rounded-xl p-2">
                {filteredFlavorItems.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground py-4">Nenhum sabor encontrado.</p>
                ) : (
                  filteredFlavorItems.map((f) => {
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
                })
                )}
              </div>
            </section>

            {/* MODO COMBINADO: borda + adicionais únicos */}
            {mode === "combined" && crusts.length > 0 && (
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

            {mode === "combined" && addons.length > 0 && (
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

            {/* MODO SEPARADO: accordion por pizza */}
            {mode === "separate" && flavorIds.length > 0 && (crusts.length > 0 || addons.length > 0) && (
              <section>
                <p className="text-sm font-semibold mb-2">Borda e adicionais por pizza (opcional)</p>
                <div className="space-y-2">
                  {flavorIds.map((fid, idx) => {
                    const f = flavorItems.find((x) => x.id === fid);
                    const cfg = perFlavor[fid] ?? { crustId: null, addonIds: [] };
                    const isOpen = expanded === fid;
                    const unit = separateUnitPrice(fid);
                    return (
                      <div key={fid} className="border border-border rounded-xl overflow-hidden">
                        <button
                          type="button"
                          onClick={() => setExpanded(isOpen ? null : fid)}
                          className="w-full flex items-center justify-between gap-2 p-3 text-left bg-muted/30 hover:bg-muted/50"
                        >
                          <div className="min-w-0">
                            <p className="font-semibold text-sm truncate">
                              Pizza {idx + 1} — {f?.emoji} {f?.name}
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              R$ {unit.toFixed(2).replace(".", ",")}
                              {cfg.crustId || cfg.addonIds.length > 0 ? " · personalizada" : " · sem extras"}
                            </p>
                          </div>
                          {isOpen ? <ChevronUp className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
                        </button>
                        {isOpen && (
                          <div className="p-3 space-y-3">
                            {crusts.length > 0 && (
                              <div>
                                <p className="text-xs font-semibold mb-1.5">Borda recheada</p>
                                <div className="space-y-1.5">
                                  <button
                                    type="button"
                                    onClick={() => setFlavorCrust(fid, null)}
                                    className={`w-full flex items-center justify-between gap-2 p-2 rounded-lg border text-xs ${
                                      cfg.crustId === null ? "border-brand bg-brand-soft" : "border-border"
                                    }`}
                                  >
                                    <span>Sem borda</span>
                                    <span className="text-muted-foreground">Grátis</span>
                                  </button>
                                  {crusts.map((c) => (
                                    <button
                                      key={c.id}
                                      type="button"
                                      onClick={() => setFlavorCrust(fid, c.id)}
                                      className={`w-full flex items-center justify-between gap-2 p-2 rounded-lg border text-xs ${
                                        cfg.crustId === c.id ? "border-brand bg-brand-soft" : "border-border"
                                      }`}
                                    >
                                      <span className="font-medium">{c.name}</span>
                                      <span className="font-semibold">+ R$ {c.price.toFixed(2).replace(".", ",")}</span>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                            {addons.length > 0 && (
                              <div>
                                <p className="text-xs font-semibold mb-1.5">Adicionais</p>
                                <div className="space-y-1.5">
                                  {addons.map((a) => (
                                    <label
                                      key={a.id}
                                      className={`flex items-center justify-between gap-2 p-2 rounded-lg border text-xs cursor-pointer ${
                                        cfg.addonIds.includes(a.id) ? "border-brand bg-brand-soft" : "border-border"
                                      }`}
                                    >
                                      <div className="flex items-center gap-2">
                                        <input
                                          type="checkbox"
                                          checked={cfg.addonIds.includes(a.id)}
                                          onChange={() => toggleFlavorAddon(fid, a.id)}
                                          className="h-3.5 w-3.5 accent-brand"
                                        />
                                        <span className="font-medium">{a.name}</span>
                                      </div>
                                      <span className="font-semibold">+ R$ {a.price.toFixed(2).replace(".", ",")}</span>
                                    </label>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </div>
        )}

        {/* Footer */}
        {!loading && sizes.length > 0 && (
          <div className="sticky bottom-0 bg-card border-t border-border p-4 flex items-center gap-3">
            <div className="flex-1">
              <p className="text-[11px] text-muted-foreground">
                Total{mode === "separate" && flavorIds.length > 0 ? ` · ${flavorIds.length} pizza${flavorIds.length > 1 ? "s" : ""}` : ""}
              </p>
              <p className="text-lg font-bold">R$ {totalPrice.toFixed(2).replace(".", ",")}</p>
            </div>
            <button
              type="button"
              disabled={disabled || totalPrice <= 0}
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
