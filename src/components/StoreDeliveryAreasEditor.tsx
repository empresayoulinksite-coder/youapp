import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pencil, Trash2, Plus, Search } from "lucide-react";

interface Props {
  storeId: string;
}

interface DeliveryArea {
  id: string;
  neighborhood: string;
  fee: number;
  is_active: boolean;
}

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

  const invalidate = () => qc.invalidateQueries({ queryKey: ["delivery-areas", storeId] });

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

  const filtered = areas.filter((a) =>
    a.neighborhood.toLowerCase().includes(search.toLowerCase()),
  );

  if (isLoading) return null;

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div>
        <p className="text-sm font-semibold">Áreas de entrega</p>
        <p className="text-xs text-muted-foreground">
          Adicione bairros e defina a taxa de entrega para cada um.
        </p>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar"
            className="pl-8 h-8 text-sm"
          />
        </div>
        <Button
          size="sm"
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
        >
          <Plus className="h-4 w-4 mr-1" />
          Bairro
        </Button>
      </div>

      {showForm && (
        <div className="rounded-md border bg-muted/30 p-3 space-y-2">
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <Label className="text-xs">Bairro</Label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Nome do bairro"
                className="h-8 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">Taxa (R$)</Label>
              <Input
                value={formFee}
                onChange={(e) => setFormFee(e.target.value)}
                placeholder="0,00"
                className="h-8 text-sm"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => upsert.mutate()} disabled={upsert.isPending}>
              {editingId ? "Salvar" : "Adicionar"}
            </Button>
            <Button size="sm" variant="ghost" onClick={resetForm}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Total de {areas.length} registro{areas.length !== 1 ? "s" : ""}
      </p>

      {filtered.length > 0 && (
        <div className="text-xs grid grid-cols-[auto_1fr_auto_auto_auto] items-center gap-x-3 gap-y-1">
          <span className="text-muted-foreground font-medium">Status</span>
          <span className="text-muted-foreground font-medium">Bairro</span>
          <span className="text-muted-foreground font-medium text-right">Valor</span>
          <span />
          <span />
          {filtered.map((a) => (
            <AreaRow
              key={a.id}
              area={a}
              onToggle={(active) => toggleActive.mutate({ id: a.id, active })}
              onEdit={() => startEdit(a)}
              onDelete={() => remove.mutate(a.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function AreaRow({
  area,
  onToggle,
  onEdit,
  onDelete,
}: {
  area: DeliveryArea;
  onToggle: (v: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <>
      <button
        type="button"
        onClick={() => onToggle(!area.is_active)}
        className={`w-9 h-5 rounded-full transition-colors relative shrink-0 ${area.is_active ? "bg-primary" : "bg-muted"}`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${area.is_active ? "left-[18px]" : "left-0.5"}`}
        />
      </button>
      <span className="truncate">{area.neighborhood}</span>
      <span className="text-right whitespace-nowrap">
        R$ {Number(area.fee).toFixed(2).replace(".", ",")}
      </span>
      <button type="button" onClick={onEdit} className="text-muted-foreground hover:text-foreground">
        <Pencil className="h-3.5 w-3.5" />
      </button>
      <button type="button" onClick={onDelete} className="text-muted-foreground hover:text-destructive">
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </>
  );
}
