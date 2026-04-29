import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, UserCheck, UserX } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Staff = {
  id: string;
  user_id: string;
  display_name: string | null;
  role: string;
  is_active: boolean;
  profile?: { display_name: string | null; email: string | null } | null;
};

export function StoreStaffEditor({ storeId }: { storeId: string }) {
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [adding, setAdding] = useState(false);

  const { data: staff = [], isLoading } = useQuery({
    queryKey: ["store-staff", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_staff")
        .select("id, user_id, display_name, role, is_active")
        .eq("store_id", storeId)
        .order("created_at", { ascending: true });
      if (error) throw error;

      const userIds = (data ?? []).map((s) => s.user_id);
      let map = new Map<string, { display_name: string | null; email: string | null }>();
      if (userIds.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("user_id, display_name, email")
          .in("user_id", userIds);
        (profs ?? []).forEach((p) =>
          map.set(p.user_id, { display_name: p.display_name, email: p.email }),
        );
      }
      return (data ?? []).map((s) => ({ ...s, profile: map.get(s.user_id) ?? null })) as Staff[];
    },
  });

  async function add() {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      toast.error("Informe o e-mail do funcionário.");
      return;
    }
    setAdding(true);
    try {
      // Encontrar usuário pelo e-mail no profile
      const { data: prof, error: pErr } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("email", trimmed)
        .maybeSingle();
      if (pErr) throw pErr;
      if (!prof) {
        toast.error("Nenhum usuário encontrado com esse e-mail. Peça para a pessoa se cadastrar primeiro no app.");
        return;
      }

      const { error } = await supabase.from("store_staff").insert({
        store_id: storeId,
        user_id: prof.user_id,
        display_name: name.trim() || null,
      });
      if (error) {
        if (error.code === "23505") {
          toast.error("Esse usuário já é funcionário da loja.");
        } else {
          toast.error(error.message);
        }
        return;
      }
      setEmail("");
      setName("");
      toast.success("Funcionário adicionado.");
      qc.invalidateQueries({ queryKey: ["store-staff", storeId] });
    } finally {
      setAdding(false);
    }
  }

  async function toggleActive(s: Staff) {
    const { error } = await supabase
      .from("store_staff")
      .update({ is_active: !s.is_active })
      .eq("id", s.id);
    if (error) toast.error(error.message);
    else qc.invalidateQueries({ queryKey: ["store-staff", storeId] });
  }

  async function remove(s: Staff) {
    if (!confirm("Remover este funcionário da loja?")) return;
    const { error } = await supabase.from("store_staff").delete().eq("id", s.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Funcionário removido.");
      qc.invalidateQueries({ queryKey: ["store-staff", storeId] });
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-muted-foreground">
          Funcionários cadastrados aqui podem acessar o painel de pedidos desta loja.
          A pessoa precisa já ter conta no app (mesmo e-mail).
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <div className="md:col-span-1">
          <Label htmlFor="staff-name">Nome (opcional)</Label>
          <Input
            id="staff-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex.: Maria"
          />
        </div>
        <div className="md:col-span-1">
          <Label htmlFor="staff-email">E-mail do funcionário</Label>
          <Input
            id="staff-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="funcionario@email.com"
          />
        </div>
        <div className="md:col-span-1 flex items-end">
          <Button onClick={add} disabled={adding} className="w-full">
            <Plus className="h-4 w-4" />
            Adicionar
          </Button>
        </div>
      </div>

      <div className="rounded-lg border divide-y">
        {isLoading ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Carregando...</p>
        ) : staff.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Nenhum funcionário cadastrado ainda.
          </p>
        ) : (
          staff.map((s) => (
            <div key={s.id} className="flex items-center gap-3 p-3">
              <div className={`h-9 w-9 rounded-full flex items-center justify-center text-sm font-bold ${s.is_active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                {(s.display_name ?? s.profile?.display_name ?? s.profile?.email ?? "?").slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold truncate">
                  {s.display_name ?? s.profile?.display_name ?? "Sem nome"}
                  {!s.is_active && <span className="ml-2 text-[10px] text-muted-foreground">(inativo)</span>}
                </p>
                <p className="text-xs text-muted-foreground truncate">{s.profile?.email}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => toggleActive(s)} title={s.is_active ? "Desativar" : "Ativar"}>
                {s.is_active ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
              </Button>
              <Button variant="ghost" size="icon" onClick={() => remove(s)} title="Remover">
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
