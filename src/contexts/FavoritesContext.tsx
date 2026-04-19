import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./AuthContext";

interface FavoritesContextValue {
  favoriteIds: Set<string>;
  isFavorite: (storeId: string) => boolean;
  toggleFavorite: (storeId: string) => Promise<void>;
  loading: boolean;
}

const FavoritesContext = createContext<FavoritesContextValue | undefined>(undefined);

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) {
      setFavoriteIds(new Set());
      return;
    }
    setLoading(true);
    supabase
      .from("favorites")
      .select("store_id")
      .eq("user_id", user.id)
      .then(({ data }) => {
        setFavoriteIds(new Set((data ?? []).map((r) => r.store_id)));
        setLoading(false);
      });
  }, [user]);

  const toggleFavorite = useCallback(
    async (storeId: string) => {
      if (!user) return;
      const isFav = favoriteIds.has(storeId);
      // optimistic
      setFavoriteIds((prev) => {
        const next = new Set(prev);
        if (isFav) next.delete(storeId);
        else next.add(storeId);
        return next;
      });
      if (isFav) {
        await supabase.from("favorites").delete().eq("user_id", user.id).eq("store_id", storeId);
      } else {
        await supabase.from("favorites").insert({ user_id: user.id, store_id: storeId });
      }
    },
    [user, favoriteIds],
  );

  return (
    <FavoritesContext.Provider
      value={{ favoriteIds, isFavorite: (id) => favoriteIds.has(id), toggleFavorite, loading }}
    >
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites() {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error("useFavorites must be used within FavoritesProvider");
  return ctx;
}
