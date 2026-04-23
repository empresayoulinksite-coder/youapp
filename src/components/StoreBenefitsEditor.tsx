import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Truck, ShieldCheck, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  storeId: string;
}

interface BenefitState {
  enabled: boolean;
  title: string;
  subtitle: string;
}

const ICONS = {
  delivery: Truck,
  protection: ShieldCheck,
  return: RotateCcw,
};

export function StoreBenefitsEditor({ storeId }: Props) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["store-benefits", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stores")
        .select(
          "benefit_delivery_enabled, benefit_delivery_title, benefit_delivery_subtitle, benefit_protection_enabled, benefit_protection_title, benefit_protection_subtitle, benefit_return_enabled, benefit_return_title, benefit_return_subtitle"
        )
        .eq("id", storeId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const [delivery, setDelivery] = useState<BenefitState>({ enabled: true, title: "", subtitle: "" });
  const [protection, setProtection] = useState<BenefitState>({ enabled: true, title: "", subtitle: "" });
  const [returnB, setReturnB] = useState<BenefitState>({ enabled: true, title: "", subtitle: "" });

  useEffect(() => {
    if (data) {
      setDelivery({
        enabled: data.benefit_delivery_enabled !== false,
        title: data.benefit_delivery_title || "",
        subtitle: data.benefit_delivery_subtitle || "",
      });
      setProtection({
        enabled: data.benefit_protection_enabled !== false,
        title: data.benefit_protection_title || "",
        subtitle: data.benefit_protection_subtitle || "",
      });
      setReturnB({
        enabled: data.benefit_return_enabled !== false,
        title: data.benefit_return_title || "",
        subtitle: data.benefit_return_subtitle || "",
      });
    }
  }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("stores")
        .update({
          benefit_delivery_enabled: delivery.enabled,
          benefit_delivery_title: delivery.title,
          benefit_delivery_subtitle: delivery.subtitle,
          benefit_protection_enabled: protection.enabled,
          benefit_protection_title: protection.title,
          benefit_protection_subtitle: protection.subtitle,
          benefit_return_enabled: returnB.enabled,
          benefit_return_title: returnB.title,
          benefit_return_subtitle: returnB.subtitle,
        })
        .eq("id", storeId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Benefícios atualizados");
      qc.invalidateQueries({ queryKey: ["store-benefits", storeId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return null;

  const renderRow = (
    key: "delivery" | "protection" | "return",
    state: BenefitState,
    setState: (s: BenefitState) => void,
  ) => {
    const Icon = ICONS[key];
    return (
      <div className="rounded-md border p-3 space-y-2">
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={state.enabled}
            onChange={(e) => setState({ ...state, enabled: e.target.checked })}
          />
          <Icon className="h-4 w-4 text-brand" />
          Mostrar esta linha
        </label>
        {state.enabled && (
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <Label className="text-xs">Título</Label>
              <Input
                value={state.title}
                onChange={(e) => setState({ ...state, title: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-xs">Subtítulo</Label>
              <Input
                value={state.subtitle}
                onChange={(e) => setState({ ...state, subtitle: e.target.value })}
              />
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div>
        <p className="text-sm font-semibold">Benefícios na página do produto</p>
        <p className="text-xs text-muted-foreground">
          Edite ou esconda as linhas de entrega, garantia e troca exibidas no produto.
        </p>
      </div>
      {renderRow("delivery", delivery, setDelivery)}
      {renderRow("protection", protection, setProtection)}
      {renderRow("return", returnB, setReturnB)}
      <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
        Salvar benefícios
      </Button>
    </div>
  );
}
