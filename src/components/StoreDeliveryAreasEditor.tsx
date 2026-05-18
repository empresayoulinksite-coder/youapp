import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MapPin, Pencil, Trash2, Plus, Search } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  storeId: string;
}

interface DeliveryArea {
  id: string;
  neighborhood: string;
  fee: number;
  is_active: boolean;
}

const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export function StoreDeliveryAreasEditor({ storeId }: Props) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formFee, setFormFee] = useState("");

  const { data: areas = [], isLoading } = useQuery({
    queryKey: ["delivery-areas", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_delivery_areas")
        .select("id, neighborhood, fee, is_active")
        .eq("store_id", storeId)
        .order("neighborhood");
      if (error) throw error;
      return (data ?? []) as DeliveryArea[];
    },
  });

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["delivery-areas", storeId] });

  const upsert = useMutation({
    mutationFn: async () => {
      const name = formName.trim();
      if (!name) throw new Error("Informe o nome do bairro");
      const feeNum = parseFloat(formFee.replace(",", ".")) || 0;

      if (editingId) {
        const { error } = await supabase
          .from("store_delivery_areas")
          .update({ neighborhood: name, fee: feeNum })
          .eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("store_delivery_areas")
          .insert({ store_id: storeId, neighborhood: name, fee: feeNum });
        if (error) {
          if (error.code === "23505") throw new Error("Bairro já cadastrado");
          throw error;
        }
      }
    },
    onSuccess: () => {
      toast.success(editingId ? "Bairro atualizado" : "Bairro adicionado");
      resetForm();
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase
        .from("store_delivery_areas")
        .update({ is_active: active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("store_delivery_areas")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Bairro removido");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setFormName("");
    setFormFee("");
  };

  const startEdit = (area: DeliveryArea) => {
    setEditingId(area.id);
    setFormName(area.neighborhood);
    setFormFee(area.fee.toFixed(2).replace(".", ","));
    setShowForm(true);
  };

  const filtered = useMemo(() => {
    const q = norm(search.trim());
    if (!q) return areas;
    return areas.filter((a) => norm(a.neighborhood).includes(q));
  }, [areas, search]);

  if (isLoading) return null;

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-start gap-3 border-b bg-muted/30 p-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-100 text-purple-600 dark:bg-purple-950 dark:text-purple-300">
          <MapPin className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <p className="font-semibold">Áreas de entrega</p>
          <p className="text-xs text-muted-foreground">
            Adicione pelo menos uma região de atendimento do seu estabelecimento.
          </p>
        </div>
      </div>

      <div className="p-4 space-y-3">
        {/* Toolbar */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar"
              className="pl-8 h-9"
            />
          </div>
          <Button
            size="sm"
            className="h-9"
            onClick={() => {
              resetForm();
              setShowForm(true);
            }}
          >
            <Plus className="h-4 w-4 mr-1" />
            Bairro
          </Button>
        </div>

        {/* Form */}
        {showForm && (
          <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <Label className="text-xs">Bairro</Label>
                <Input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Nome do bairro"
                  className="h-9"
                />
              </div>
              <div>
                <Label className="text-xs">Taxa (R$)</Label>
                <Input
                  value={formFee}
                  onChange={(e) => setFormFee(e.target.value)}
                  placeholder="0,00"
                  className="h-9"
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="ghost" onClick={resetForm}>
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={() => upsert.mutate()}
                disabled={upsert.isPending}
              >
                {editingId ? "Salvar" : "Adicionar"}
              </Button>
            </div>
          </div>
        )}

        {/* Empty state */}
        {areas.length === 0 ? (
          <div className="rounded-lg border border-dashed bg-muted/20 p-8 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-purple-100 text-purple-600 dark:bg-purple-950 dark:text-purple-300">
              <MapPin className="h-6 w-6" />
            </div>
            <p className="mt-3 text-sm font-medium">
              Nenhum bairro cadastrado ainda
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Cadastre os bairros que sua loja atende e defina a taxa de cada um.
            </p>
            {!showForm && (
              <Button
                size="sm"
                className="mt-4"
                onClick={() => {
                  resetForm();
                  setShowForm(true);
                }}
              >
                <Plus className="h-4 w-4 mr-1" />
                Cadastrar primeiro bairro
              </Button>
            )}
          </div>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              Total de {areas.length} registro{areas.length !== 1 ? "s" : ""}
              {search && ` · ${filtered.length} encontrado${filtered.length !== 1 ? "s" : ""}`}
            </p>

            <div className="rounded-lg border overflow-hidden">
              {/* Table header */}
              <div className="grid grid-cols-[64px_1fr_110px_72px] items-center gap-x-2 px-3 py-2 bg-muted/40 text-xs font-medium text-muted-foreground border-b">
                <span>Status</span>
                <span>Bairro</span>
                <span className="text-right">Valor</span>
                <span />
              </div>

              {filtered.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-6">
                  Nenhum bairro encontrado.
                </p>
              ) : (
                filtered.map((a, idx) => (
                  <AreaRow
                    key={a.id}
                    area={a}
                    zebra={idx % 2 === 1}
                    onToggle={(active) =>
                      toggleActive.mutate({ id: a.id, active })
                    }
                    onEdit={() => startEdit(a)}
                    onDelete={() => {
                      if (confirm(`Remover o bairro "${a.neighborhood}"?`)) {
                        remove.mutate(a.id);
                      }
                    }}
                  />
                ))
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function AreaRow({
  area,
  zebra,
  onToggle,
  onEdit,
  onDelete,
}: {
  area: DeliveryArea;
  zebra: boolean;
  onToggle: (v: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-[64px_1fr_110px_72px] items-center gap-x-2 px-3 py-2.5 text-sm border-b last:border-b-0",
        zebra ? "bg-muted/20" : "bg-background",
      )}
    >
      <button
        type="button"
        onClick={() => onToggle(!area.is_active)}
        className={cn(
          "w-10 h-5 rounded-full transition-colors relative shrink-0",
          area.is_active ? "bg-primary" : "bg-muted-foreground/30",
        )}
        aria-label={area.is_active ? "Desativar" : "Ativar"}
      >
        <span
          className={cn(
            "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform",
            area.is_active ? "left-[22px]" : "left-0.5",
          )}
        />
      </button>
      <span className="truncate font-medium">{area.neighborhood}</span>
      <span className="text-right whitespace-nowrap tabular-nums">
        R$ {Number(area.fee).toFixed(2).replace(".", ",")}
      </span>
      <div className="flex justify-end gap-1">
        <button
          type="button"
          onClick={onEdit}
          className="p-1.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Editar"
        >
          <Pencil className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="p-1.5 rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          aria-label="Excluir"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
