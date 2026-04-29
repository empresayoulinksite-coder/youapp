import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, GripVertical, Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { uploadImage } from "@/lib/upload";

interface Reel {
  id: string;
  store_id: string;
  title: string;
  video_url: string;
  thumbnail_url: string | null;
  cta_label: string | null;
  cta_url: string | null;
  position: number;
  is_active: boolean;
}

export function StoreReelsEditor({
  storeId,
  reelsEnabled,
  onToggleEnabled,
}: {
  storeId: string;
  reelsEnabled: boolean;
  onToggleEnabled: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  const { data: reels = [], isLoading } = useQuery({
    queryKey: ["admin-store-reels", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_reels")
        .select("*")
        .eq("store_id", storeId)
        .order("position", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Reel[];
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin-store-reels", storeId] });
    qc.invalidateQueries({ queryKey: ["store-reels", storeId] });
  };

  const create = useMutation({
    mutationFn: async () => {
      const nextPos = (reels[reels.length - 1]?.position ?? -1) + 1;
      const { error } = await supabase.from("store_reels").insert({
        store_id: storeId,
        title: "",
        video_url: "",
        position: nextPos,
        is_active: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Flow adicionado");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async (r: Partial<Reel> & { id: string }) => {
      const { id, ...patch } = r;
      const { error } = await supabase.from("store_reels").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("store_reels").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Flow removido");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleUploadVideo = async (reel: Reel, file: File) => {
    if (!file.type.startsWith("video/")) {
      toast.error("Selecione um arquivo de vídeo");
      return;
    }
    setUploadingId(reel.id);
    try {
      const url = await uploadImage("store-reels", file);
      await update.mutateAsync({ id: reel.id, video_url: url });
      // Garante que o YouFlow fique visível na vitrine assim que o primeiro vídeo é enviado.
      if (!reelsEnabled) {
        await supabase.from("stores").update({ reels_enabled: true }).eq("id", storeId);
        onToggleEnabled(true);
      }
      toast.success("Vídeo enviado");
    } catch (e: any) {
      toast.error(e.message ?? "Falha no upload");
    } finally {
      setUploadingId(null);
    }
  };

  const handleUploadThumb = async (reel: Reel, file: File) => {
    setUploadingId(reel.id + ":thumb");
    try {
      const url = await uploadImage("store-reels", file);
      await update.mutateAsync({ id: reel.id, thumbnail_url: url });
    } catch (e: any) {
      toast.error(e.message ?? "Falha no upload");
    } finally {
      setUploadingId(null);
    }
  };

  return (
    <div className="rounded-xl border bg-card p-4 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold text-sm">YouFlow da loja</h3>
          <p className="text-xs text-muted-foreground">
            Vídeos curtos exibidos na vitrine. Apenas o admin gerencia.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Label htmlFor={`reels-enabled-${storeId}`} className="text-xs">
            Mostrar na vitrine
          </Label>
          <Switch
            id={`reels-enabled-${storeId}`}
            checked={reelsEnabled}
            onCheckedChange={onToggleEnabled}
          />
        </div>
      </div>

      <div className="space-y-3">
        {isLoading && <p className="text-xs text-muted-foreground">Carregando...</p>}

        {!isLoading && reels.length === 0 && (
          <p className="text-xs text-muted-foreground py-2">Nenhum flow cadastrado.</p>
        )}

        {reels.map((r) => (
          <ReelRow
            key={r.id}
            reel={r}
            uploadingId={uploadingId}
            onPatch={(patch) => update.mutate({ id: r.id, ...patch })}
            onRemove={() => {
              if (confirm("Remover este flow?")) remove.mutate(r.id);
            }}
            onUploadVideo={(f) => handleUploadVideo(r, f)}
            onUploadThumb={(f) => handleUploadThumb(r, f)}
          />
        ))}

        <Button onClick={() => create.mutate()} variant="outline" size="sm" className="w-full">
          <Plus className="h-4 w-4 mr-1" /> Adicionar flow
        </Button>
      </div>
    </div>
  );
}

function ReelRow({
  reel,
  uploadingId,
  onPatch,
  onRemove,
  onUploadVideo,
  onUploadThumb,
}: {
  reel: Reel;
  uploadingId: string | null;
  onPatch: (patch: Partial<Reel>) => void;
  onRemove: () => void;
  onUploadVideo: (f: File) => void;
  onUploadThumb: (f: File) => void;
}) {
  const isUp = uploadingId === reel.id;
  const isThumbUp = uploadingId === reel.id + ":thumb";

  // Local draft state — avoids losing characters when the query refetches
  const [title, setTitle] = useState(reel.title);
  const [position, setPosition] = useState(String(reel.position));
  const [ctaLabel, setCtaLabel] = useState(reel.cta_label ?? "");
  const [ctaUrl, setCtaUrl] = useState(reel.cta_url ?? "");
  const focusedRef = useRef<string | null>(null);

  // Sync from server only when the field is not focused (prevents overwriting in-progress typing)
  useEffect(() => {
    if (focusedRef.current !== "title") setTitle(reel.title);
  }, [reel.title]);
  useEffect(() => {
    if (focusedRef.current !== "position") setPosition(String(reel.position));
  }, [reel.position]);
  useEffect(() => {
    if (focusedRef.current !== "ctaLabel") setCtaLabel(reel.cta_label ?? "");
  }, [reel.cta_label]);
  useEffect(() => {
    if (focusedRef.current !== "ctaUrl") setCtaUrl(reel.cta_url ?? "");
  }, [reel.cta_url]);

  return (
    <div className="rounded-lg border p-3 space-y-3 bg-background">
      <div className="flex items-start gap-3">
        <GripVertical className="h-4 w-4 text-muted-foreground mt-2 shrink-0" />
        <div className="flex-1 space-y-2 min-w-0">
          <div className="grid sm:grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Título</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onFocus={() => (focusedRef.current = "title")}
                onBlur={() => {
                  focusedRef.current = null;
                  if (title !== reel.title) onPatch({ title });
                }}
                placeholder="Hoje temos..."
              />
            </div>
            <div>
              <Label className="text-xs">Posição</Label>
              <Input
                type="number"
                value={position}
                onChange={(e) => setPosition(e.target.value)}
                onFocus={() => (focusedRef.current = "position")}
                onBlur={() => {
                  focusedRef.current = null;
                  const n = Number(position);
                  if (!Number.isNaN(n) && n !== reel.position) onPatch({ position: n });
                }}
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Texto do botão (opcional)</Label>
              <Input
                value={ctaLabel}
                onChange={(e) => setCtaLabel(e.target.value)}
                onFocus={() => (focusedRef.current = "ctaLabel")}
                onBlur={() => {
                  focusedRef.current = null;
                  const next = ctaLabel || null;
                  if (next !== (reel.cta_label ?? null)) onPatch({ cta_label: next });
                }}
                placeholder="Ver produto"
              />
            </div>
            <div>
              <Label className="text-xs">Link do botão (opcional)</Label>
              <Input
                value={ctaUrl}
                onChange={(e) => setCtaUrl(e.target.value)}
                onFocus={() => (focusedRef.current = "ctaUrl")}
                onBlur={() => {
                  focusedRef.current = null;
                  const next = ctaUrl || null;
                  if (next !== (reel.cta_url ?? null)) onPatch({ cta_url: next });
                }}
                placeholder="https://... ou /produto/123"
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3 pt-1">
            <div className="space-y-1.5">
              <Label className="text-xs">Vídeo (mp4/webm)</Label>
              <div className="flex items-center gap-2">
                <label className="inline-flex items-center gap-2 text-xs px-3 py-2 rounded-md bg-muted hover:bg-muted/70 cursor-pointer">
                  {isUp ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                  {reel.video_url ? "Trocar" : "Enviar"}
                  <input
                    type="file"
                    accept="video/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) onUploadVideo(f);
                      e.target.value = "";
                    }}
                  />
                </label>
                {reel.video_url && (
                  <video src={reel.video_url} className="h-12 w-9 rounded object-cover bg-black" muted />
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Capa (opcional)</Label>
              <div className="flex items-center gap-2">
                <label className="inline-flex items-center gap-2 text-xs px-3 py-2 rounded-md bg-muted hover:bg-muted/70 cursor-pointer">
                  {isThumbUp ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                  {reel.thumbnail_url ? "Trocar" : "Enviar"}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) onUploadThumb(f);
                      e.target.value = "";
                    }}
                  />
                </label>
                {reel.thumbnail_url && (
                  <img src={reel.thumbnail_url} alt="" className="h-12 w-9 rounded object-cover" />
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-2">
              <Switch
                checked={reel.is_active}
                onCheckedChange={(v) => onPatch({ is_active: v })}
              />
              <span className="text-xs text-muted-foreground">Ativo</span>
            </div>
            <Button variant="ghost" size="sm" onClick={onRemove}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
