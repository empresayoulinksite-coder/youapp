import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Pencil, Ticket } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

type Coupon = {
  id: string;
  store_id: string;
  code: string;
  title: string;
  description: string | null;
  discount_label: string;
  min_order: number;
};

type Draft = {
  id?: string;
  code: string;
  title: string;
  description: string;
  discount_label: string;
  min_order: string;
};

const empty: Draft = {
  code: "",
  title: "",
  description: "",
  discount_label: "",
  min_order: "0",
};

export function CouponsTab({ storeId }: { storeId: string }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Draft | null>(null);

  const { data: coupons = [], isLoading } = useQuery({
    queryKey: ["painel", "coupons", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_coupons")
        .select("*")
        .eq("store_id", storeId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Coupon[];
    },
  });

  const save = useMutation({
    mutationFn: async (d: Draft) => {
      const min = Number(d.min_order.replace(",", ".")) || 0;
      if (!d.code.trim()) throw new Error("Código obrigatório");
      if (!d.title.trim()) throw new Error("Título obrigatório");
      if (!d.discount_label.trim()) throw new Error("Informe o desconto (ex: 10% OFF)");

      const payload = {
        store_id: storeId,
        code: d.code.trim().toUpperCase(),
        title: d.title.trim(),
        description: d.description.trim() || null,
        discount_label: d.discount_label.trim(),
        min_order: min,
      };
      if (d.id) {
        const { error } = await supabase
          .from("store_coupons")
          .update(payload)
          .eq("id", d.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("store_coupons").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Cupom salvo");
      qc.invalidateQueries({ queryKey: ["painel", "coupons"] });
      setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("store_coupons").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Cupom removido");
      qc.invalidateQueries({ queryKey: ["painel", "coupons"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Crie cupons promocionais exclusivos da sua loja.
        </p>
        <Button size="sm" onClick={() => setEditing({ ...empty })}>
          <Plus className="h-4 w-4" /> Novo cupom
        </Button>
      </div>

      {isLoading ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Carregando...</p>
      ) : coupons.length === 0 ? (
        <div className="rounded-lg border border-dashed py-12 text-center">
          <Ticket className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">Nenhum cupom criado.</p>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {coupons.map((c) => (
            <li key={c.id} className="rounded-lg border bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-bold">{c.title}</p>
                  <p className="text-xs text-muted-foreground">
                    Código:{" "}
                    <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] font-semibold">
                      {c.code}
                    </span>
                  </p>
                  <p className="mt-1 text-sm text-primary font-semibold">
                    {c.discount_label}
                  </p>
                  {c.description && (
                    <p className="mt-1 text-xs text-muted-foreground">{c.description}</p>
                  )}
                  {c.min_order > 0 && (
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Pedido mín:{" "}
                      {Number(c.min_order).toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })}
                    </p>
                  )}
                </div>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      setEditing({
                        id: c.id,
                        code: c.code,
                        title: c.title,
                        description: c.description ?? "",
                        discount_label: c.discount_label,
                        min_order: String(c.min_order),
                      })
                    }
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      if (confirm(`Remover cupom "${c.code}"?`)) remove.mutate(c.id);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <Dialog open onOpenChange={(o) => !o && setEditing(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing.id ? "Editar cupom" : "Novo cupom"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Código</Label>
                <Input
                  value={editing.code}
                  onChange={(e) =>
                    setEditing({ ...editing, code: e.target.value.toUpperCase() })
                  }
                  placeholder="EX: BARBA10"
                />
              </div>
              <div>
                <Label>Título</Label>
                <Input
                  value={editing.title}
                  onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                  placeholder="Ex: 10% no primeiro corte"
                />
              </div>
              <div>
                <Label>Desconto (texto exibido)</Label>
                <Input
                  value={editing.discount_label}
                  onChange={(e) =>
                    setEditing({ ...editing, discount_label: e.target.value })
                  }
                  placeholder="Ex: 10% OFF ou R$ 5 OFF"
                />
              </div>
              <div>
                <Label>Descrição (opcional)</Label>
                <Textarea
                  rows={2}
                  value={editing.description}
                  onChange={(e) =>
                    setEditing({ ...editing, description: e.target.value })
                  }
                  placeholder="Regras ou detalhes"
                />
              </div>
              <div>
                <Label>Pedido mínimo (R$)</Label>
                <Input
                  inputMode="decimal"
                  value={editing.min_order}
                  onChange={(e) => setEditing({ ...editing, min_order: e.target.value })}
                  placeholder="0,00"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditing(null)}>
                Cancelar
              </Button>
              <Button onClick={() => save.mutate(editing)} disabled={save.isPending}>
                {save.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
