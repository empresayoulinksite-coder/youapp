import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useIsStoreOwner() {
  const { user, loading: authLoading } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["is-store-owner", user?.id],
    enabled: !!user?.id,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      if (!user?.id) return false;
      const { data, error } = await supabase
        .from("store_owners")
        .select("id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();
      if (error) return false;
      return !!data;
    },
  });

  return {
    isStoreOwner: !!data,
    loading: authLoading || isLoading,
  };
}
