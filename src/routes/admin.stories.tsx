import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { uploadImage } from "@/lib/upload";
import { BackToStoreEditor } from "@/components/BackToStoreEditor";

export const Route = createFileRoute("/admin/stories")({
  validateSearch: (search: Record<string, unknown>): { storeId?: string } => ({
    storeId: typeof search.storeId === "string" ? search.storeId : undefined,
  }),
  component: AdminStories,
});

type Story = {
  id: string;
  title: string;
  media_type: string;
  media_url: string;
  thumbnail_url: string | null;
  cta_label: string | null;
  store_id: string | null;
  position: number;
  is_active: boolean;
  expires_at: string | null;
};

function AdminStories() {
  const { storeId: presetStoreId } = Route.useSearch();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Story> | null>(null);
  const [uploading, setUploading] = useState(false);

  const { data: stores = [] } = useQuery({
    queryKey: ["admin-stores-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("stores").select("id,name").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: stories = [] } = useQuery({
    queryKey: ["admin-stories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("stories").select("*").order("position");
      if (error) throw error;
      return data as Story[];
    },
  });

  const save = useMutation({
    mutationFn: async (s: Partial<Story>) => {
      const payload = {
        title: s.title!,
        media_type: s.media_type || "image",
        media_url: s.media_url!,
        thumbnail_url: s.thumbnail_url || null,
        cta_label: s.cta_label || "Ver loja",
        store_id: s.store_id || null,
        position: Number(s.position) || 0,
        is_active: s.is_active ?? true,
        expires_at: s.expires_at || null,
      };
      if (s.id) {
        const { error } = await supabase.from("stories").update(payload).eq("id", s.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("stories").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Story salvo");
      qc.invalidateQueries({ queryKey: ["admin-stories"] });
      qc.invalidateQueries({ queryKey: ["stories"] });
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("stories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Excluído");
      qc.invalidateQueries({ queryKey: ["admin-stories"] });
      qc.invalidateQueries({ queryKey: ["stories"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleFile = async (file: File, field: "media_url" | "thumbnail_url") => {
    setUploading(true);
    try {
      const url = await uploadImage("story-media", file);
      setEditing((prev) => ({
        ...prev,
        [field]: url,
        ...(field === "media_url" && { media_type: file.type.startsWith("video") ? "video" : "image" }),
      }));
      toast.success("Enviado");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <BackToStoreEditor storeId={presetStoreId} />
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Stories</h1>
          <p className="text-sm text-muted-foreground">{stories.length} stories</p>
        </div>
        <Button onClick={() => { setEditing({ media_type: "image", is_active: true, position: stories.length, cta_label: "Ver loja" }); setOpen(true); }}>
          <Plus className="h-4 w-4" /> Novo story
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stories.map((s) => {
          const store = stores.find((st) => st.id === s.store_id);
          return (
            <div key={s.id} className="rounded-lg border bg-background p-3">
              <div className="relative mb-2 aspect-[9/16] overflow-hidden rounded-md bg-muted">
                {s.media_type === "video" ? (
                  <video src={s.media_url} className="h-full w-full object-cover" muted />
                ) : (
                  <img src={s.thumbnail_url || s.media_url} alt={s.title} className="h-full w-full object-cover" />
                )}
                {!s.is_active && <div className="absolute inset-0 bg-black/50 grid place-items-center text-xs text-white">Inativo</div>}
              </div>
              <h3 className="truncate text-sm font-semibold">{s.title}</h3>
              <p className="truncate text-xs text-muted-foreground">{store?.name || "Sem loja"}</p>
              <div className="mt-2 flex gap-2">
                <Button size="sm" variant="outline" className="flex-1" onClick={() => { setEditing(s); setOpen(true); }}>
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button size="sm" variant="destructive" onClick={() => { if (confirm("Excluir?")) del.mutate(s.id); }}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing?.id ? "Editar story" : "Novo story"}</DialogTitle></DialogHeader>
          {editing && (
            <div className="grid gap-3">
              <div>
                <Label>Mídia (imagem ou vídeo)</Label>
                <div className="mt-1 flex items-center gap-3">
                  {editing.media_url && (editing.media_type === "video"
                    ? <video src={editing.media_url} className="h-20 w-12 rounded object-cover" muted />
                    : <img src={editing.media_url} alt="" className="h-20 w-12 rounded object-cover" />
                  )}
                  <Input type="file" accept="image/*,video/*" disabled={uploading}
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f, "media_url"); }}
                  />
                </div>
              </div>
              <div>
                <Label>Thumbnail (opcional)</Label>
                <div className="mt-1 flex items-center gap-3">
                  {editing.thumbnail_url && <img src={editing.thumbnail_url} alt="" className="h-12 w-12 rounded object-cover" />}
                  <Input type="file" accept="image/*" disabled={uploading}
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f, "thumbnail_url"); }}
                  />
                </div>
              </div>
              <div><Label>Título</Label><Input value={editing.title || ""} onChange={(e) => setEditing({ ...editing, title: e.target.value })} /></div>
              <div>
                <Label>Loja vinculada (botão "Ver loja")</Label>
                <Select value={editing.store_id || ""} onValueChange={(v) => setEditing({ ...editing, store_id: v || null })}>
                  <SelectTrigger><SelectValue placeholder="Sem loja" /></SelectTrigger>
                  <SelectContent>
                    {stores.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Texto do botão</Label><Input value={editing.cta_label || ""} onChange={(e) => setEditing({ ...editing, cta_label: e.target.value })} placeholder="Ver loja" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Posição</Label><Input type="number" value={editing.position ?? 0} onChange={(e) => setEditing({ ...editing, position: Number(e.target.value) })} /></div>
                <div><Label>Expira em</Label><Input type="datetime-local" value={editing.expires_at?.slice(0, 16) || ""} onChange={(e) => setEditing({ ...editing, expires_at: e.target.value ? new Date(e.target.value).toISOString() : null })} /></div>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="active" checked={editing.is_active ?? true} onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })} />
                <Label htmlFor="active">Ativo</Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button disabled={save.isPending || uploading || !editing?.title || !editing?.media_url} onClick={() => editing && save.mutate(editing)}>
              {save.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
