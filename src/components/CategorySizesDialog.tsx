import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

type Size = {
  id: string;
  name: string;
  position: number;
  category_id: string;
  store_id: string;
};

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  storeId: string;
  categoryId: string | null;
  categoryName?: string;
}

/**
 * Editor enxuto de tamanhos compartilhados de uma categoria de Produtos.
 * Reusa a tabela `pizza_sizes` (sem bordas, sabores ou pedaços).
 */
export function CategorySizesDialog({
  open,
  onOpenChange,
  storeId,
  categoryId,
  categoryName,
}: Props) {
  const qc = useQueryClient();

  const { data: sizes = [], isLoading } = useQuery({
    queryKey: ["category-sizes", categoryId],
    enabled: !!categoryId && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pizza_sizes")
        .select("id,name,position,category_id,store_id")
        .eq("category_id", categoryId!)
        .order("position");
      if (error) throw error;
      return (data ?? []) as Size[];
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["category-sizes", categoryId] });
    qc.invalidateQueries({ queryKey: ["admin-pizza-sizes", storeId] });
  };

  const addSize = useMutation({
    mutationFn: async () => {
      if (!categoryId) throw new Error("Categoria não definida");
      const { error } = await supabase.from("pizza_sizes").insert({
        store_id: storeId,
        category_id: categoryId,
        name: "Novo tamanho",
        position: sizes.length,
        slices: 1,
        max_flavors: 1,
        is_active: true,
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const updateSize = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await supabase
        .from("pizza_sizes")
        .update({ name })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const delSize = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("pizza_sizes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Tamanhos da categoria{categoryName ? ` — ${categoryName}` : ""}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Cadastre os tamanhos que se aplicam a todos os produtos desta categoria
            (ex: Inteira, Meia, Pequena, Média, Grande). Depois, em cada produto,
            você define o preço por tamanho.
          </p>

          {!categoryId ? (
            <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
              Salve a categoria primeiro para cadastrar tamanhos.
            </p>
          ) : isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : (
            <>
              <div className="space-y-2">
                {sizes.map((s) => (
                  <SizeRow
                    key={s.id}
                    size={s}
                    onUpdate={(name) => updateSize.mutate({ id: s.id, name })}
                    onDelete={() => {
                      if (confirm(`Excluir tamanho "${s.name}"?`))
                        delSize.mutate(s.id);
                    }}
                  />
                ))}
                {sizes.length === 0 && (
                  <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
                    Nenhum tamanho cadastrado.
                  </p>
                )}
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => addSize.mutate()}
                className="w-full"
                disabled={addSize.isPending}
              >
                <Plus className="h-4 w-4" /> Adicionar tamanho
              </Button>
            </>
          )}
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Concluir</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SizeRow({
  size,
  onUpdate,
  onDelete,
}: {
  size: Size;
  onUpdate: (name: string) => void;
  onDelete: () => void;
}) {
  const [name, setName] = useState(size.name);
  useEffect(() => setName(size.name), [size.id, size.name]);

  return (
    <div className="flex items-center gap-2 rounded-lg border bg-card p-2">
      <div className="flex-1">
        <Label className="sr-only">Nome do tamanho</Label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => {
            const trimmed = name.trim();
            if (trimmed && trimmed !== size.name) onUpdate(trimmed);
            else if (!trimmed) setName(size.name);
          }}
          placeholder="Ex: Inteira, Meia, Pequena…"
        />
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onDelete}
        className="text-destructive hover:text-destructive"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
