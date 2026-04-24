import { useState } from "react";
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
      toast.success("Reel adicionado");
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
      toast.success("Reel removido");
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
          <h3 className="font-semibold text-sm">Reels da loja</h3>
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
          <p className="text-xs text-muted-foreground py-2">Nenhum reel cadastrado.</p>
        )}

        {reels.map((r) => {
          const isUp = uploadingId === r.id;
          const isThumbUp = uploadingId === r.id + ":thumb";
          return (
            <div key={r.id} className="rounded-lg border p-3 space-y-3 bg-background">
              <div className="flex items-start gap-3">
                <GripVertical className="h-4 w-4 text-muted-foreground mt-2 shrink-0" />
                <div className="flex-1 space-y-2 min-w-0">
                  <div className="grid sm:grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Título</Label>
                      <Input
                        value={r.title}
                        onChange={(e) => update.mutate({ id: r.id, title: e.target.value })}
                        placeholder="Hoje temos..."
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Posição</Label>
                      <Input
                        type="number"
                        value={r.position}
                        onChange={(e) =>
                          update.mutate({ id: r.id, position: Number(e.target.value) })
                        }
                      />
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Texto do botão (opcional)</Label>
                      <Input
                        value={r.cta_label ?? ""}
                        onChange={(e) =>
                          update.mutate({ id: r.id, cta_label: e.target.value || null })
                        }
                        placeholder="Ver produto"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Link do botão (opcional)</Label>
                      <Input
                        value={r.cta_url ?? ""}
                        onChange={(e) =>
                          update.mutate({ id: r.id, cta_url: e.target.value || null })
                        }
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
                          {r.video_url ? "Trocar" : "Enviar"}
                          <input
                            type="file"
                            accept="video/*"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) handleUploadVideo(r, f);
                              e.target.value = "";
                            }}
                          />
                        </label>
                        {r.video_url && (
                          <video src={r.video_url} className="h-12 w-9 rounded object-cover bg-black" muted />
                        )}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs">Capa (opcional)</Label>
                      <div className="flex items-center gap-2">
                        <label className="inline-flex items-center gap-2 text-xs px-3 py-2 rounded-md bg-muted hover:bg-muted/70 cursor-pointer">
                          {isThumbUp ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                          {r.thumbnail_url ? "Trocar" : "Enviar"}
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) handleUploadThumb(r, f);
                              e.target.value = "";
                            }}
                          />
                        </label>
                        {r.thumbnail_url && (
                          <img src={r.thumbnail_url} alt="" className="h-12 w-9 rounded object-cover" />
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={r.is_active}
                        onCheckedChange={(v) => update.mutate({ id: r.id, is_active: v })}
                      />
                      <span className="text-xs text-muted-foreground">Ativo</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (confirm("Remover este reel?")) remove.mutate(r.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        <Button onClick={() => create.mutate()} variant="outline" size="sm" className="w-full">
          <Plus className="h-4 w-4 mr-1" /> Adicionar reel
        </Button>
      </div>
    </div>
  );
}
