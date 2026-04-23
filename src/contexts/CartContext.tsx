import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./AuthContext";

export interface CartItemRow {
  id: string;
  user_id: string;
  store_id: string;
  menu_item_id: string;
  quantity: number;
  notes: string | null;
  selected_size: string | null;
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

interface CartContextValue {
  items: CartItemRow[];
  count: number;
  total: number;
  loading: boolean;
  addItem: (storeId: string, menuItemId: string, selectedSize?: string | null) => Promise<void>;
  /** Limpa o carrinho atual e adiciona o item da nova loja. */
  switchStoreAndAdd: (storeId: string, menuItemId: string, selectedSize?: string | null) => Promise<void>;
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
      .select("id, user_id, store_id, menu_item_id, quantity, notes, selected_size, menu_items(id, name, price, emoji, image_url), stores(id, name, slug, emoji)")
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

  const addItem = async (storeId: string, menuItemId: string, selectedSize: string | null = null) => {
    if (!user) return;
    const currentStoreId = items[0]?.store_id ?? null;
    if (currentStoreId && currentStoreId !== storeId) {
      throw new DifferentStoreError(currentStoreId, storeId);
    }
    const existing = items.find(
      (i) => i.menu_item_id === menuItemId && (i.selected_size ?? null) === (selectedSize ?? null),
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
    });
    if (!error) await refresh();
  };

  const switchStoreAndAdd = async (storeId: string, menuItemId: string, selectedSize: string | null = null) => {
    if (!user) return;
    await supabase.from("cart_items").delete().eq("user_id", user.id);
    const { error } = await supabase.from("cart_items").insert({
      user_id: user.id,
      store_id: storeId,
      menu_item_id: menuItemId,
      quantity: 1,
      selected_size: selectedSize,
    });
    if (!error) await refresh();
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

  const count = items.reduce((sum, i) => sum + i.quantity, 0);
  const total = items.reduce((sum, i) => sum + (i.menu_items ? Number(i.menu_items.price) * i.quantity : 0), 0);
  const currentStoreId = items[0]?.store_id ?? null;

  return (
    <CartContext.Provider value={{ items, count, total, loading, currentStoreId, addItem, switchStoreAndAdd, reorder, updateQuantity, removeItem, clear, refresh }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
