import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./AuthContext";

export interface PizzaFlavorJson {
  menu_item_id: string;
  name: string;
  price: number;
}

export interface PizzaAddonJson {
  id: string;
  name: string;
  price: number;
}

export interface CartItemRow {
  id: string;
  user_id: string;
  store_id: string;
  menu_item_id: string;
  quantity: number;
  notes: string | null;
  selected_size: string | null;
  half_two_menu_item_id: string | null;
  half_two_name: string | null;
  unit_price_override: number | null;
  pizza_size_id: string | null;
  pizza_size_name: string | null;
  pizza_flavors: PizzaFlavorJson[] | null;
  pizza_crust_id: string | null;
  pizza_crust_name: string | null;
  pizza_crust_price: number | null;
  pizza_addons: PizzaAddonJson[] | null;
  menu_items: {
    id: string;
    name: string;
    price: number;
    emoji: string;
    image_url: string | null;
  } | null;
  stores: {
    id: string;
    name: string;
    slug: string;
    emoji: string;
  } | null;
}

export interface HalfHalfPayload {
  firstMenuItemId: string;
  firstName: string;
  firstPrice: number;
  secondMenuItemId: string;
  secondName: string;
  secondPrice: number;
  selectedSize: string | null;
}

export interface PizzaCartPayload {
  baseMenuItemId: string;
  sizeId: string;
  sizeName: string;
  flavors: PizzaFlavorJson[];
  crust: { id: string; name: string; price: number } | null;
  addons: PizzaAddonJson[];
  unitPrice: number;
}

interface CartContextValue {
  items: CartItemRow[];
  count: number;
  total: number;
  loading: boolean;
  addItem: (storeId: string, menuItemId: string, selectedSize?: string | null, unitPriceOverride?: number | null) => Promise<void>;
  addHalfHalf: (storeId: string, payload: HalfHalfPayload) => Promise<void>;
  addPizza: (storeId: string, payload: PizzaCartPayload) => Promise<void>;
  /** Limpa o carrinho atual e adiciona o item da nova loja. */
  switchStoreAndAdd: (storeId: string, menuItemId: string, selectedSize?: string | null, unitPriceOverride?: number | null) => Promise<void>;
  switchStoreAndAddHalfHalf: (storeId: string, payload: HalfHalfPayload) => Promise<void>;
  switchStoreAndAddPizza: (storeId: string, payload: PizzaCartPayload) => Promise<void>;
  /** Limpa o carrinho e adiciona vários itens (usado em "Pedir de novo"). */
  reorder: (storeId: string, items: Array<{ menu_item_id: string; quantity: number; selected_size?: string | null }>) => Promise<void>;
  /** Loja atualmente no carrinho, se houver. */
  currentStoreId: string | null;
  updateQuantity: (id: string, quantity: number) => Promise<void>;
  removeItem: (id: string) => Promise<void>;
  clear: () => Promise<void>;
  refresh: () => Promise<void>;
}

export class DifferentStoreError extends Error {
  constructor(public currentStoreId: string, public newStoreId: string) {
    super("Você só pode pedir de uma loja por vez.");
  }
}

const CartContext = createContext<CartContextValue | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [items, setItems] = useState<CartItemRow[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) {
      setItems([]);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("cart_items")
      .select("id, user_id, store_id, menu_item_id, quantity, notes, selected_size, half_two_menu_item_id, half_two_name, unit_price_override, pizza_size_id, pizza_size_name, pizza_flavors, pizza_crust_id, pizza_crust_name, pizza_crust_price, pizza_addons, menu_items(id, name, price, emoji, image_url), stores(id, name, slug, emoji)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });
    if (!error && data) {
      setItems(data as unknown as CartItemRow[]);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addItem = async (storeId: string, menuItemId: string, selectedSize: string | null = null, unitPriceOverride: number | null = null) => {
    if (!user) return;
    const currentStoreId = items[0]?.store_id ?? null;
    if (currentStoreId && currentStoreId !== storeId) {
      throw new DifferentStoreError(currentStoreId, storeId);
    }
    const existing = items.find(
      (i) =>
        i.menu_item_id === menuItemId &&
        (i.selected_size ?? null) === (selectedSize ?? null) &&
        !i.half_two_menu_item_id,
    );
    if (existing) {
      await updateQuantity(existing.id, existing.quantity + 1);
      return;
    }
    const { error } = await supabase.from("cart_items").insert({
      user_id: user.id,
      store_id: storeId,
      menu_item_id: menuItemId,
      quantity: 1,
      selected_size: selectedSize,
      unit_price_override: unitPriceOverride,
    });
    if (!error) await refresh();
  };

  const switchStoreAndAdd = async (storeId: string, menuItemId: string, selectedSize: string | null = null, unitPriceOverride: number | null = null) => {
    if (!user) return;
    await supabase.from("cart_items").delete().eq("user_id", user.id);
    const { error } = await supabase.from("cart_items").insert({
      user_id: user.id,
      store_id: storeId,
      menu_item_id: menuItemId,
      quantity: 1,
      selected_size: selectedSize,
      unit_price_override: unitPriceOverride,
    });
    if (!error) await refresh();
  };

  const insertHalfHalf = async (storeId: string, p: HalfHalfPayload) => {
    if (!user) return;
    const unitPrice = Math.max(Number(p.firstPrice) || 0, Number(p.secondPrice) || 0);
    const { error } = await supabase.from("cart_items").insert({
      user_id: user.id,
      store_id: storeId,
      menu_item_id: p.firstMenuItemId,
      quantity: 1,
      selected_size: p.selectedSize,
      half_two_menu_item_id: p.secondMenuItemId,
      half_two_name: p.secondName,
      unit_price_override: unitPrice,
    });
    if (!error) await refresh();
  };

  const addHalfHalf = async (storeId: string, p: HalfHalfPayload) => {
    if (!user) return;
    const currentStoreId = items[0]?.store_id ?? null;
    if (currentStoreId && currentStoreId !== storeId) {
      throw new DifferentStoreError(currentStoreId, storeId);
    }
    await insertHalfHalf(storeId, p);
  };

  const switchStoreAndAddHalfHalf = async (storeId: string, p: HalfHalfPayload) => {
    if (!user) return;
    await supabase.from("cart_items").delete().eq("user_id", user.id);
    await insertHalfHalf(storeId, p);
  };

  const insertPizza = async (storeId: string, p: PizzaCartPayload) => {
    if (!user) return;
    const { error } = await supabase.from("cart_items").insert({
      user_id: user.id,
      store_id: storeId,
      menu_item_id: p.baseMenuItemId,
      quantity: 1,
      unit_price_override: p.unitPrice,
      pizza_size_id: p.sizeId,
      pizza_size_name: p.sizeName,
      pizza_flavors: p.flavors as any,
      pizza_crust_id: p.crust?.id ?? null,
      pizza_crust_name: p.crust?.name ?? null,
      pizza_crust_price: p.crust?.price ?? null,
      pizza_addons: p.addons as any,
    });
    if (!error) await refresh();
  };

  const addPizza = async (storeId: string, p: PizzaCartPayload) => {
    if (!user) return;
    const currentStoreId = items[0]?.store_id ?? null;
    if (currentStoreId && currentStoreId !== storeId) {
      throw new DifferentStoreError(currentStoreId, storeId);
    }
    await insertPizza(storeId, p);
  };

  const switchStoreAndAddPizza = async (storeId: string, p: PizzaCartPayload) => {
    if (!user) return;
    await supabase.from("cart_items").delete().eq("user_id", user.id);
    await insertPizza(storeId, p);
  };

  const reorder = async (
    storeId: string,
    newItems: Array<{ menu_item_id: string; quantity: number; selected_size?: string | null }>,
  ) => {
    if (!user) return;
    await supabase.from("cart_items").delete().eq("user_id", user.id);
    if (newItems.length > 0) {
      const rows = newItems.map((i) => ({
        user_id: user.id,
        store_id: storeId,
        menu_item_id: i.menu_item_id,
        quantity: i.quantity,
        selected_size: i.selected_size ?? null,
      }));
      await supabase.from("cart_items").insert(rows);
    }
    await refresh();
  };

  const updateQuantity = async (id: string, quantity: number) => {
    if (quantity <= 0) {
      await removeItem(id);
      return;
    }
    const { error } = await supabase.from("cart_items").update({ quantity }).eq("id", id);
    if (!error) await refresh();
  };

  const removeItem = async (id: string) => {
    const { error } = await supabase.from("cart_items").delete().eq("id", id);
    if (!error) await refresh();
  };

  const clear = async () => {
    if (!user) return;
    const { error } = await supabase.from("cart_items").delete().eq("user_id", user.id);
    if (!error) await refresh();
  };

  const unitPriceOf = (i: CartItemRow) =>
    i.unit_price_override != null
      ? Number(i.unit_price_override)
      : Number(i.menu_items?.price ?? 0);

  const count = items.reduce((sum, i) => sum + i.quantity, 0);
  const total = items.reduce((sum, i) => sum + unitPriceOf(i) * i.quantity, 0);
  const currentStoreId = items[0]?.store_id ?? null;

  return (
    <CartContext.Provider value={{ items, count, total, loading, currentStoreId, addItem, addHalfHalf, addPizza, switchStoreAndAdd, switchStoreAndAddHalfHalf, switchStoreAndAddPizza, reorder, updateQuantity, removeItem, clear, refresh }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
