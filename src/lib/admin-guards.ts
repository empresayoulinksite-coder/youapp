import { redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

/** beforeLoad guard: only admins. Non-admins redirect to /admin. */
export async function requireAdminOnly() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw redirect({ to: "/auth" });
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", session.user.id)
    .eq("role", "admin")
    .maybeSingle();
  if (error || !data) throw redirect({ to: "/admin" });
}

/** beforeLoad guard for /admin/loja/$storeId: admin or owner of that store. */
export async function requireAdminOrStoreOwner(storeId: string) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw redirect({ to: "/auth" });
  const userId = session.user.id;

  const [{ data: roleRow }, { data: ownerRow }] = await Promise.all([
    supabase.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle(),
    supabase.from("store_owners").select("id").eq("user_id", userId).eq("store_id", storeId).maybeSingle(),
  ]);

  if (!roleRow && !ownerRow) throw redirect({ to: "/admin" });
}
