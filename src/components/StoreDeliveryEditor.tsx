import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  storeId: string;
}

export function StoreDeliveryEditor({ storeId }: Props) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["store-delivery", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stores")
        .select("delivery_enabled, free_delivery, delivery_fee, delivery_time")
        .eq("id", storeId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const [deliveryEnabled, setDeliveryEnabled] = useState(true);
  const [freeDelivery, setFreeDelivery] = useState(false);
  const [deliveryFee, setDeliveryFee] = useState("");
  const [deliveryTime, setDeliveryTime] = useState("");

  useEffect(() => {
    if (data) {
      setDeliveryEnabled(data.delivery_enabled !== false);
      setFreeDelivery(!!data.free_delivery);
      setDeliveryFee(data.delivery_fee || "");
      setDeliveryTime(data.delivery_time || "");
    }
  }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("stores")
        .update({
          delivery_enabled: deliveryEnabled,
          free_delivery: deliveryEnabled ? freeDelivery : false,
          delivery_fee: deliveryEnabled ? (freeDelivery ? "Grátis" : (deliveryFee || "Grátis")) : "",
          delivery_time: deliveryTime || "30-40 min",
        })
        .eq("id", storeId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Entrega atualizada");
      qc.invalidateQueries({ queryKey: ["store-delivery", storeId] });
      qc.invalidateQueries({ queryKey: ["painel", "stores"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return null;

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div>
        <p className="text-sm font-semibold">Entrega</p>
        <p className="text-xs text-muted-foreground">
          Configure se sua loja faz entrega e a taxa cobrada.
        </p>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={deliveryEnabled}
          onChange={(e) => setDeliveryEnabled(e.target.checked)}
        />
        Faz entrega
      </label>

      {deliveryEnabled && (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label className="text-xs">Tempo de entrega</Label>
              <Input
                value={deliveryTime}
                placeholder="30-40 min"
                onChange={(e) => setDeliveryTime(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs">Taxa de entrega</Label>
              <Input
                value={freeDelivery ? "Grátis" : deliveryFee}
                placeholder="Ex: R$ 5,00"
                disabled={freeDelivery}
                onChange={(e) => setDeliveryFee(e.target.value)}
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={freeDelivery}
              onChange={(e) => setFreeDelivery(e.target.checked)}
            />
            Entrega grátis
          </label>
        </>
      )}

      <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
        Salvar
      </Button>
    </div>
  );
}
