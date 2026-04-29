import { useState, useEffect } from "react";
import { Pencil, Check, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Switch } from "@/components/ui/switch";

export type ColumnTimes = {
  balcao_min: number;
  balcao_max: number;
  delivery_min: number;
  delivery_max: number;
};

type Props = {
  storeId: string;
  status: "em_analise" | "em_producao" | "pronto";
  times: ColumnTimes;
  // só para coluna "em_analise":
  autoAccept?: boolean;
  showAutoAccept?: boolean;
  canEdit: boolean;
};

const FIELD_MAP: Record<Props["status"], Record<keyof ColumnTimes, string>> = {
  em_analise: {
    balcao_min: "time_analise_balcao_min",
    balcao_max: "time_analise_balcao_max",
    delivery_min: "time_analise_delivery_min",
    delivery_max: "time_analise_delivery_max",
  },
  em_producao: {
    balcao_min: "time_producao_balcao_min",
    balcao_max: "time_producao_balcao_max",
    delivery_min: "time_producao_delivery_min",
    delivery_max: "time_producao_delivery_max",
  },
  pronto: {
    balcao_min: "time_pronto_balcao_min",
    balcao_max: "time_pronto_balcao_max",
    delivery_min: "time_pronto_delivery_min",
    delivery_max: "time_pronto_delivery_max",
  },
};

export function KanbanColumnTimes({
  storeId,
  status,
  times,
  autoAccept,
  showAutoAccept,
  canEdit,
}: Props) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<ColumnTimes>(times);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(times);
  }, [times.balcao_min, times.balcao_max, times.delivery_min, times.delivery_max]);

  async function save() {
    setSaving(true);
    const map = FIELD_MAP[status];
    const payload: Record<string, number> = {};
    (Object.keys(map) as (keyof ColumnTimes)[]).forEach((k) => {
      payload[map[k]] = Math.max(0, Math.round(Number(draft[k]) || 0));
    });
    const { error } = await supabase.from("stores").update(payload as never).eq("id", storeId);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Tempos atualizados");
    setEditing(false);
    qc.invalidateQueries({ queryKey: ["admin-orders-store", storeId] });
  }

  async function toggleAutoAccept(next: boolean) {
    const { error } = await supabase
      .from("stores")
      .update({ auto_accept_orders: next })
      .eq("id", storeId);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(next ? "Aceite automático ativado" : "Aceite automático desativado");
    qc.invalidateQueries({ queryKey: ["admin-orders-store", storeId] });
  }

  return (
    <div className="bg-white/95 mx-2 mt-2 rounded-md p-2 text-foreground text-xs">
      {editing ? (
        <div className="space-y-2">
          <div>
            <label className="block text-[10px] font-bold text-muted-foreground mb-0.5">
              Balcão (min)
            </label>
            <div className="flex items-center gap-1">
              <input
                type="number"
                min={0}
                value={draft.balcao_min}
                onChange={(e) => setDraft((d) => ({ ...d, balcao_min: +e.target.value }))}
                className="w-full rounded border px-1.5 py-1 text-xs"
              />
              <span className="text-muted-foreground">a</span>
              <input
                type="number"
                min={0}
                value={draft.balcao_max}
                onChange={(e) => setDraft((d) => ({ ...d, balcao_max: +e.target.value }))}
                className="w-full rounded border px-1.5 py-1 text-xs"
              />
              <span className="text-muted-foreground">min</span>
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-muted-foreground mb-0.5">
              Delivery (min)
            </label>
            <div className="flex items-center gap-1">
              <input
                type="number"
                min={0}
                value={draft.delivery_min}
                onChange={(e) => setDraft((d) => ({ ...d, delivery_min: +e.target.value }))}
                className="w-full rounded border px-1.5 py-1 text-xs"
              />
              <span className="text-muted-foreground">a</span>
              <input
                type="number"
                min={0}
                value={draft.delivery_max}
                onChange={(e) => setDraft((d) => ({ ...d, delivery_max: +e.target.value }))}
                className="w-full rounded border px-1.5 py-1 text-xs"
              />
              <span className="text-muted-foreground">min</span>
            </div>
          </div>
          <div className="flex items-center justify-end gap-1 pt-1">
            <button
              type="button"
              onClick={() => {
                setDraft(times);
                setEditing(false);
              }}
              className="rounded p-1 hover:bg-muted text-muted-foreground"
              aria-label="Cancelar"
            >
              <X className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="inline-flex items-center gap-1 rounded bg-primary text-primary-foreground px-2 py-1 text-[11px] font-semibold disabled:opacity-50"
            >
              <Check className="h-3 w-3" /> Salvar
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-0.5">
            <p>
              <span className="font-bold">Balcão:</span> {times.balcao_min} a {times.balcao_max} min
            </p>
            <p>
              <span className="font-bold">Delivery:</span> {times.delivery_min} a {times.delivery_max} min
            </p>
          </div>
          {canEdit && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline shrink-0"
            >
              <Pencil className="h-3 w-3" /> Editar
            </button>
          )}
        </div>
      )}

      {showAutoAccept && (
        <div className="mt-2 flex items-center justify-between gap-2 border-t pt-2">
          <span className="text-[11px] font-medium leading-tight">
            Aceitar os pedidos automaticamente
          </span>
          <Switch
            checked={!!autoAccept}
            onCheckedChange={toggleAutoAccept}
            disabled={!canEdit}
          />
        </div>
      )}
    </div>
  );
}
