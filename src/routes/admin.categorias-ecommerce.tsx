import { createFileRoute } from "@tanstack/react-router";
import { requireAdminOnly } from "@/lib/admin-guards";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, ArrowUp, ArrowDown, Pause, Play } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/admin/categorias-ecommerce")({
  beforeLoad: () => requireAdminOnly(),
  component: AdminEcommerceCategories,
});

type Store = { id: string; name: string; emoji: string };
type Category = {
  id: string;
  store_id: string;
  name: string;
  position: number;
  is_available: boolean;
};

function AdminEcommerceCategories() {
  const qc = useQueryClient();
  const [storeId, setStoreId] = useState<string>("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Category> | null>(null);

  const { data: stores = [] } = useQuery({
    queryKey: ["admin-ecommerce-stores"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stores")
        .select("id, name, emoji")
        .eq("store_type", "ecommerce")
        .order("name");
      if (error) throw error;
      return data as Store[];
    },
  });

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ["ecommerce-categories", storeId],
    enabled: !!storeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("menu_categories")
        .select("*")
        .eq("store_id", storeId)
        .order("position");
      if (error) throw error;
      return data as Category[];
    },
  });

  const save = useMutation({
    mutationFn: async (c: Partial<Category>) => {
      if (c.id) {
        const { error } = await supabase
          .from("menu_categories")
          .update({ name: c.name!, is_available: !!c.is_available })
          .eq("id", c.id);
        if (error) throw error;
      } else {
        const nextPos = categories.length;
        const { error } = await supabase.from("menu_categories").insert({
          store_id: storeId,
          name: c.name!,
          position: nextPos,
          is_available: true,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Categoria salva");
      qc.invalidateQueries({ queryKey: ["ecommerce-categories", storeId] });
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("menu_categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Categoria excluída");
      qc.invalidateQueries({ queryKey: ["ecommerce-categories", storeId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const togglePause = useMutation({
    mutationFn: async (c: Category) => {
      const { error } = await supabase
        .from("menu_categories")
        .update({ is_available: !c.is_available })
        .eq("id", c.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ecommerce-categories", storeId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const move = useMutation({
    mutationFn: async ({ id, dir }: { id: string; dir: -1 | 1 }) => {
      const idx = categories.findIndex((c) => c.id === id);
      const swap = idx + dir;
      if (idx < 0 || swap < 0 || swap >= categories.length) return;
      const a = categories[idx];
      const b = categories[swap];
      const { error: e1 } = await supabase
        .from("menu_categories")
        .update({ position: b.position })
        .eq("id", a.id);
      if (e1) throw e1;
      const { error: e2 } = await supabase
        .from("menu_categories")
        .update({ position: a.position })
        .eq("id", b.id);
      if (e2) throw e2;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ecommerce-categories", storeId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Categorias do E-commerce</h1>
          <p className="text-sm text-muted-foreground">
            Organize os produtos das suas lojas em seções (ex: Moda Praia, Moda Inverno).
          </p>
        </div>
        <Button
          disabled={!storeId}
          onClick={() => {
            setEditing({ name: "", is_available: true });
            setOpen(true);
          }}
        >
          <Plus className="h-4 w-4" /> Nova categoria
        </Button>
      </div>

      <div className="mb-4 max-w-sm">
        <Label>Loja</Label>
        <Select value={storeId} onValueChange={setStoreId}>
          <SelectTrigger className="mt-1">
            <SelectValue placeholder="Selecione uma loja de e-commerce" />
          </SelectTrigger>
          <SelectContent>
            {stores.length === 0 ? (
              <div className="px-2 py-3 text-xs text-muted-foreground">
                Nenhuma loja de e-commerce cadastrada.
              </div>
            ) : (
              stores.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.emoji} {s.name}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      </div>

      {!storeId ? (
        <div className="rounded-lg border bg-background p-8 text-center text-sm text-muted-foreground">
          Selecione uma loja para gerenciar suas categorias.
        </div>
      ) : isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : categories.length === 0 ? (
        <div className="rounded-lg border bg-background p-8 text-center text-sm text-muted-foreground">
          Nenhuma categoria ainda. Crie a primeira!
        </div>
      ) : (
        <ul className="space-y-2">
          {categories.map((c, i) => (
            <li
              key={c.id}
              className="flex items-center gap-2 rounded-lg border bg-background p-3"
            >
              <div className="flex flex-col">
                <button
                  className="rounded p-0.5 hover:bg-muted disabled:opacity-30"
                  disabled={i === 0}
                  onClick={() => move.mutate({ id: c.id, dir: -1 })}
                  aria-label="Mover para cima"
                >
                  <ArrowUp className="h-3 w-3" />
                </button>
                <button
                  className="rounded p-0.5 hover:bg-muted disabled:opacity-30"
                  disabled={i === categories.length - 1}
                  onClick={() => move.mutate({ id: c.id, dir: 1 })}
                  aria-label="Mover para baixo"
                >
                  <ArrowDown className="h-3 w-3" />
                </button>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{c.name}</p>
                {!c.is_available && (
                  <span className="text-[10px] font-semibold text-warning">Pausada</span>
                )}
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => togglePause.mutate(c)}
                title={c.is_available ? "Pausar" : "Ativar"}
              >
                {c.is_available ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setEditing(c);
                  setOpen(true);
                }}
              >
                <Pencil className="h-3 w-3" />
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => {
                  if (
                    confirm(
                      `Excluir a categoria "${c.name}"? Os produtos associados precisarão ser movidos.`,
                    )
                  )
                    del.mutate(c.id);
                }}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing?.id ? "Editar categoria" : "Nova categoria"}
            </DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div>
                <Label>Nome</Label>
                <Input
                  value={editing.name || ""}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  placeholder="Ex: Moda Praia"
                  autoFocus
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              disabled={save.isPending || !editing?.name?.trim()}
              onClick={() => editing && save.mutate(editing)}
            >
              {save.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
