import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/admin/donos")({
  component: AdminOwners,
});

type StoreLite = { id: string; name: string };
type OwnerRow = {
  id: string;
  user_id: string;
  store_id: string;
  created_at: string;
  profile: { display_name: string | null; email: string | null } | null;
  store: { name: string } | null;
};

function AdminOwners() {
  const qc = useQueryClient();
  const [storeId, setStoreId] = useState<string>("");
  const [email, setEmail] = useState("");

  const { data: stores = [] } = useQuery({
    queryKey: ["admin", "stores-lite"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stores")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data as StoreLite[];
    },
  });

  const { data: owners = [], isLoading } = useQuery({
    queryKey: ["admin", "store-owners"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_owners")
        .select("id, user_id, store_id, created_at, stores(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;

      const userIds = [...new Set((data ?? []).map((r) => r.user_id))];
      const profMap = new Map<
        string,
        { display_name: string | null; email: string | null }
      >();
      if (userIds.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("user_id, display_name, email")
          .in("user_id", userIds);
        (profs ?? []).forEach((p) =>
          profMap.set(p.user_id, {
            display_name: p.display_name,
            email: p.email,
          }),
        );
      }

      return (data ?? []).map((r) => ({
        id: r.id,
        user_id: r.user_id,
        store_id: r.store_id,
        created_at: r.created_at,
        store: r.stores as { name: string } | null,
        profile: profMap.get(r.user_id) ?? null,
      })) as OwnerRow[];
    },
  });

  const link = useMutation({
    mutationFn: async ({ storeId, email }: { storeId: string; email: string }) => {
      const cleanEmail = email.trim().toLowerCase();
      // Encontra user_id pelo email no profiles
      const { data: prof, error: profErr } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("email", cleanEmail)
        .maybeSingle();
      if (profErr) throw profErr;
      if (!prof) {
        throw new Error(
          "Usuário não encontrado. Peça para a pessoa criar uma conta no app primeiro.",
        );
      }
      const { error } = await supabase
        .from("store_owners")
        .insert({ store_id: storeId, user_id: prof.user_id });
      if (error) {
        if (error.code === "23505") throw new Error("Esse usuário já é dono dessa loja.");
        throw error;
      }
    },
    onSuccess: () => {
      toast.success("Dono vinculado");
      setEmail("");
      qc.invalidateQueries({ queryKey: ["admin", "store-owners"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const unlink = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("store_owners").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Acesso removido");
      qc.invalidateQueries({ queryKey: ["admin", "store-owners"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const grouped = useMemo(() => {
    const m = new Map<string, OwnerRow[]>();
    for (const o of owners) {
      const arr = m.get(o.store_id) ?? [];
      arr.push(o);
      m.set(o.store_id, arr);
    }
    return m;
  }, [owners]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Donos das lojas</h1>
        <p className="text-sm text-muted-foreground">
          Vincule um usuário do app para que ele acesse o painel da loja em <code>/painel</code>.
        </p>
      </div>

      <div className="rounded-lg border bg-card p-4">
        <h2 className="mb-3 text-sm font-semibold">Vincular novo dono</h2>
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <div>
            <Label>Loja</Label>
            <Select value={storeId} onValueChange={setStoreId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {stores.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>E-mail do dono</Label>
            <Input
              type="email"
              placeholder="dono@loja.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="flex items-end">
            <Button
              disabled={!storeId || !email || link.isPending}
              onClick={() => link.mutate({ storeId, email })}
            >
              <UserPlus className="h-4 w-4" />
              Vincular
            </Button>
          </div>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          O usuário precisa já ter conta no app (cadastrado em /auth).
        </p>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold">Vínculos atuais</h2>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : owners.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum dono vinculado ainda.</p>
        ) : (
          <div className="space-y-4">
            {stores
              .filter((s) => grouped.has(s.id))
              .map((s) => (
                <div key={s.id} className="rounded-lg border bg-card">
                  <div className="border-b px-4 py-2 text-sm font-semibold">
                    {s.name}
                  </div>
                  <ul className="divide-y">
                    {grouped.get(s.id)!.map((o) => (
                      <li
                        key={o.id}
                        className="flex items-center justify-between gap-3 px-4 py-3"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {o.profile?.display_name ?? "Usuário"}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {o.profile?.email ?? o.user_id}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => unlink.mutate(o.id)}
                          disabled={unlink.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                          Remover
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
