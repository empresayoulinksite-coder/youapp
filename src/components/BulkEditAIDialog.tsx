import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Sparkles, Loader2, ArrowRight, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  previewBulkEdit,
  applyBulkEdit,
  type PreviewChange,
} from "@/server/bulk-edit.functions";
import { supabase } from "@/integrations/supabase/client";

async function getAccessToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Faça login novamente");
  return token;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  storeId: string;
}

const EXAMPLE = `Pizza Calabresa - R$ 49,90 - descrição: massa fina, calabresa fatiada e cebola roxa
Coca-Cola 2L - R$ 12,00
Pizza Marguerita - descrição: molho de tomate, muçarela de búfala e manjericão fresco`;

function fmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function BulkEditAIDialog({ open, onOpenChange, storeId }: Props) {
  const qc = useQueryClient();
  const [prompt, setPrompt] = useState("");
  const [preview, setPreview] = useState<{ changes: PreviewChange[]; not_found: string[] } | null>(
    null,
  );

  const previewMut = useMutation({
    mutationFn: async () => {
      const accessToken = await getAccessToken();
      return previewBulkEdit({ data: { storeId, prompt, accessToken } });
    },
    onSuccess: (res) => {
      setPreview(res);
      const changes = res?.changes ?? [];
      const notFound = res?.not_found ?? [];
      if (changes.length === 0 && notFound.length === 0) {
        toast.info("A IA não identificou alterações.");
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const applyMut = useMutation({
    mutationFn: async () => {
      const accessToken = await getAccessToken();
      return applyBulkEdit({ data: { changes: preview!.changes, accessToken } });
    },
    onSuccess: (res) => {
      toast.success(`${res.applied} produto(s) atualizado(s).`);
      qc.invalidateQueries({ queryKey: ["admin-products"] });
      qc.invalidateQueries({ queryKey: ["menu-items"] });
      qc.invalidateQueries({ queryKey: ["admin-size-prices"] });
      qc.invalidateQueries({ queryKey: ["pizza-size-prices"] });
      reset();
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function reset() {
    setPrompt("");
    setPreview(null);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Assistente de IA — Alterações em massa
          </DialogTitle>
        </DialogHeader>

        {!preview ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Escreva os produtos que quer alterar, com nome, novo preço e/ou nova descrição.
              A IA vai localizar cada produto na loja e mostrar um preview antes de aplicar.
            </p>
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={EXAMPLE}
              rows={10}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Dica: um produto por linha. Pode incluir só o preço, só a descrição, ou ambos.
            </p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            {preview.changes.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma alteração identificada.</p>
            ) : (
              <div className="space-y-2">
                <p className="text-sm font-medium">
                  {preview.changes.length} alteração(ões) prontas para aplicar:
                </p>
                {preview.changes.map((c) => (
                  <div
                    key={c.menu_item_id + c.matched_query}
                    className="rounded-lg border p-3 text-sm space-y-1"
                  >
                    <div className="flex items-center gap-2 font-medium">
                      <span>{c.current_name}</span>
                      {normalize(c.matched_query) !== normalize(c.current_name) && (
                        <Badge variant="outline" className="text-xs">
                          buscou: "{c.matched_query}"
                        </Badge>
                      )}
                    </div>
                    {c.new_name && (
                      <Row label="Nome" before={c.current_name} after={c.new_name} />
                    )}
                    {c.new_price != null && (
                      <Row
                        label="Preço"
                        before={fmt(c.current_price)}
                        after={fmt(c.new_price)}
                      />
                    )}
                    {c.new_description != null && (
                      <Row
                        label="Descrição"
                        before={c.current_description || "(vazia)"}
                        after={c.new_description}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}

            {preview.not_found.length > 0 && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                <div className="flex items-center gap-2 text-sm font-medium text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  Não encontrados ({preview.not_found.length})
                </div>
                <ul className="mt-1 list-disc pl-5 text-sm text-muted-foreground">
                  {preview.not_found.map((n, i) => (
                    <li key={i}>{n}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          {!preview ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button
                onClick={() => previewMut.mutate()}
                disabled={!prompt.trim() || previewMut.isPending}
              >
                {previewMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Analisar com IA
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setPreview(null)}>
                Voltar
              </Button>
              <Button
                onClick={() => applyMut.mutate()}
                disabled={preview.changes.length === 0 || applyMut.isPending}
              >
                {applyMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Aplicar {preview.changes.length} alteração(ões)
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, before, after }: { label: string; before: string; after: string }) {
  return (
    <div className="flex items-start gap-2 text-xs">
      <span className="text-muted-foreground w-16 shrink-0">{label}:</span>
      <span className="line-through text-muted-foreground">{before}</span>
      <ArrowRight className="h-3 w-3 mt-0.5 shrink-0" />
      <span className="font-medium">{after}</span>
    </div>
  );
}

function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}
