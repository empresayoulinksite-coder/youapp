import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useIsAdmin() {
  const { user, loading: authLoading } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["is-admin", user?.id],
    enabled: !!user?.id,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      if (!user?.id) return false;
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      if (error) return false;
      return !!data;
    },
  });

  return {
    isAdmin: !!data,
    loading: authLoading || isLoading,
    user,
  };
}

export function useAdminAccess() {
  const { user, loading: authLoading } = useAuth();

  const { data: isAdmin = false, isLoading: adminLoading } = useQuery({
    queryKey: ["is-admin", user?.id],
    enabled: !!user?.id,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      if (!user?.id) return false;
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      if (error) return false;
      return !!data;
    },
  });

  const { data: ownedStoreIds = [], isLoading: ownerLoading } = useQuery({
    queryKey: ["owned-store-ids", user?.id],
    enabled: !!user?.id,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      if (!user?.id) return [] as string[];
      const { data, error } = await supabase
        .from("store_owners")
        .select("store_id")
        .eq("user_id", user.id);
      if (error) return [] as string[];
      return (data ?? []).map((r) => r.store_id as string);
    },
  });

  const isOwner = ownedStoreIds.length > 0;

  return {
    isAdmin,
    isOwner,
    hasAccess: isAdmin || isOwner,
    ownedStoreIds,
    loading: authLoading || adminLoading || ownerLoading,
    user,
  };
}
