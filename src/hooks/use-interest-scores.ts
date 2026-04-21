import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Calcula um "score de interesse" por loja com base em sinais existentes:
 *  - Favoritos do usuário (peso 3 na própria loja, peso 1 em lojas da mesma categoria)
 *  - Pedidos passados via cart_items (peso 2 por loja, peso 0.5 nas da mesma categoria)
 *  - Agendamentos via bookings (peso 2 por loja, peso 0.5 nas da mesma categoria)
 *
 * Retorna um Map<storeId, score>. Para anônimos, devolve mapa vazio.
 */
export function useInterestScores(stores: { id: string; category: string }[]) {
  const { user } = useAuth();
  const [scores, setScores] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    if (!user || stores.length === 0) {
      setScores(new Map());
      return;
    }
    let cancelled = false;

    (async () => {
      const [favRes, cartRes, bookRes] = await Promise.all([
        supabase.from("favorites").select("store_id").eq("user_id", user.id),
        supabase.from("cart_items").select("store_id").eq("user_id", user.id),
        supabase.from("bookings").select("store_id").eq("user_id", user.id),
      ]);

      const catByStore = new Map(stores.map((s) => [s.id, s.category]));
      const directScore = new Map<string, number>();
      const catScore = new Map<string, number>();

      const add = (storeId: string, direct: number, indirect: number) => {
        directScore.set(storeId, (directScore.get(storeId) ?? 0) + direct);
        const cat = catByStore.get(storeId);
        if (cat) catScore.set(cat, (catScore.get(cat) ?? 0) + indirect);
      };

      for (const r of favRes.data ?? []) add(r.store_id, 3, 1);
      for (const r of cartRes.data ?? []) add(r.store_id, 2, 0.5);
      for (const r of bookRes.data ?? []) add(r.store_id, 2, 0.5);

      const finalScores = new Map<string, number>();
      for (const s of stores) {
        const direct = directScore.get(s.id) ?? 0;
        const cat = catScore.get(s.category) ?? 0;
        finalScores.set(s.id, direct + cat);
      }

      if (!cancelled) setScores(finalScores);
    })();

    return () => {
      cancelled = true;
    };
  }, [user, stores]);

  return scores;
}
