import { useEffect, useState } from "react";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, MessageCircle, Save } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Aceita 10 ou 11 dígitos (DDD + número), com ou sem máscara. */
const whatsappSchema = z
  .string()
  .trim()
  .max(20, "Número muito longo")
  .refine((v) => {
    const d = v.replace(/\D/g, "");
    return d.length === 10 || d.length === 11;
  }, "Informe DDD + número (10 ou 11 dígitos)");

function formatBR(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10)
    return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

type Props = {
  storeId: string;
  initialWhatsapp: string | null;
};

export function StoreWhatsappEditor({ storeId, initialWhatsapp }: Props) {
  const qc = useQueryClient();
  const [value, setValue] = useState(formatBR(initialWhatsapp ?? ""));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setValue(formatBR(initialWhatsapp ?? ""));
    setError(null);
  }, [initialWhatsapp, storeId]);

  const save = useMutation({
    mutationFn: async () => {
      const parsed = whatsappSchema.safeParse(value);
      if (!parsed.success) {
        const msg = parsed.error.issues[0]?.message ?? "Número inválido";
        setError(msg);
        throw new Error(msg);
      }
      setError(null);
      const digits = value.replace(/\D/g, "");
      const { error: err } = await supabase
        .from("stores")
        .update({ whatsapp: digits })
        .eq("id", storeId);
      if (err) throw err;
    },
    onSuccess: () => {
      toast.success("WhatsApp atualizado");
      qc.invalidateQueries({ queryKey: ["painel", "stores"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const isEmpty = !initialWhatsapp;

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <MessageCircle className="h-4 w-4 text-brand" />
        <h2 className="text-sm font-semibold">WhatsApp para receber pedidos</h2>
      </div>

      {isEmpty && (
        <div className="mb-3 flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 p-2.5 text-xs text-foreground">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <p>
            Cadastre seu WhatsApp para receber pedidos. Sem ele, clientes não
            conseguem finalizar pedidos nem agendamentos nesta loja.
          </p>
        </div>
      )}

      <Label htmlFor="store-whatsapp" className="text-xs">
        Número com DDD
      </Label>
      <div className="mt-1 flex gap-2">
        <Input
          id="store-whatsapp"
          value={value}
          onChange={(e) => {
            setValue(formatBR(e.target.value));
            if (error) setError(null);
          }}
          placeholder="(11) 99999-9999"
          inputMode="tel"
          maxLength={20}
          aria-invalid={!!error}
          aria-describedby={error ? "store-whatsapp-error" : undefined}
        />
        <Button
          onClick={() => save.mutate()}
          disabled={save.isPending}
          size="sm"
        >
          <Save className="h-4 w-4" />
          Salvar
        </Button>
      </div>
      {error && (
        <p id="store-whatsapp-error" className="mt-1.5 text-xs text-destructive">
          {error}
        </p>
      )}
      <p className="mt-2 text-[11px] text-muted-foreground">
        Usado em todas as lojas (Food, E-commerce e Serviços) para receber os
        pedidos pelo WhatsApp.
      </p>
    </div>
  );
}
