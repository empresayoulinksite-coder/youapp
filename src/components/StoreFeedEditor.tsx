import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Upload, Loader2, X, Images } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { uploadImage } from "@/lib/upload";

interface FeedPost {
  id: string;
  store_id: string;
  caption: string;
  image_urls: string[];
  is_active: boolean;
  position: number;
  likes_count: number;
  created_at: string;
}

const MAX_IMAGES = 5;

export function StoreFeedEditor({
  storeId,
  feedEnabled,
  onToggleEnabled,
}: {
  storeId: string;
  feedEnabled: boolean;
  onToggleEnabled: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ["admin-store-feed", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_feed_posts")
        .select("*")
        .eq("store_id", storeId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as FeedPost[];
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin-store-feed", storeId] });
    qc.invalidateQueries({ queryKey: ["store-feed", storeId] });
  };

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("store_feed_posts").insert({
        store_id: storeId,
        caption: "",
        image_urls: [],
        is_active: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Post criado");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async (p: Partial<FeedPost> & { id: string }) => {
      const { id, ...patch } = p;
      const { error } = await supabase.from("store_feed_posts").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("store_feed_posts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Post removido");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleAddImage = async (post: FeedPost, file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Selecione uma imagem");
      return;
    }
    if (post.image_urls.length >= MAX_IMAGES) {
      toast.error(`Máximo de ${MAX_IMAGES} imagens por post`);
      return;
    }
    setUploadingId(post.id);
    try {
      const url = await uploadImage("store-feed" as any, file);
      const next = [...post.image_urls, url];
      await update.mutateAsync({ id: post.id, image_urls: next });
    } catch (e: any) {
      toast.error(e.message ?? "Falha no upload");
    } finally {
      setUploadingId(null);
    }
  };

  const handleRemoveImage = (post: FeedPost, idx: number) => {
    const next = post.image_urls.filter((_, i) => i !== idx);
    update.mutate({ id: post.id, image_urls: next });
  };

  return (
    <div className="rounded-xl border bg-card p-4 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <Images className="h-4 w-4" /> Feed (estilo Instagram)
          </h3>
          <p className="text-xs text-muted-foreground">
            Posts com fotos em carrossel para mostrar trabalhos e novidades.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Label htmlFor={`feed-enabled-${storeId}`} className="text-xs">
            Mostrar na vitrine
          </Label>
          <Switch
            id={`feed-enabled-${storeId}`}
            checked={feedEnabled}
            onCheckedChange={onToggleEnabled}
          />
        </div>
      </div>

      <div className="space-y-3">
        {isLoading && <p className="text-xs text-muted-foreground">Carregando...</p>}
        {!isLoading && posts.length === 0 && (
          <p className="text-xs text-muted-foreground py-2">Nenhum post ainda.</p>
        )}

        {posts.map((p) => (
          <PostRow
            key={p.id}
            post={p}
            uploading={uploadingId === p.id}
            onPatch={(patch) => update.mutate({ id: p.id, ...patch })}
            onRemove={() => {
              if (confirm("Remover este post?")) remove.mutate(p.id);
            }}
            onAddImage={(f) => handleAddImage(p, f)}
            onRemoveImage={(i) => handleRemoveImage(p, i)}
          />
        ))}

        <Button onClick={() => create.mutate()} variant="outline" size="sm" className="w-full">
          <Plus className="h-4 w-4 mr-1" /> Novo post
        </Button>
      </div>
    </div>
  );
}

function PostRow({
  post,
  uploading,
  onPatch,
  onRemove,
  onAddImage,
  onRemoveImage,
}: {
  post: FeedPost;
  uploading: boolean;
  onPatch: (patch: Partial<FeedPost>) => void;
  onRemove: () => void;
  onAddImage: (f: File) => void;
  onRemoveImage: (i: number) => void;
}) {
  const [caption, setCaption] = useState(post.caption);
  const focusedRef = useRef(false);

  useEffect(() => {
    if (!focusedRef.current) setCaption(post.caption);
  }, [post.caption]);

  return (
    <div className="rounded-lg border p-3 space-y-3 bg-background">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {post.image_urls.map((url, i) => (
          <div key={i} className="relative shrink-0">
            <img src={url} alt="" className="h-20 w-20 rounded object-cover" />
            <button
              type="button"
              onClick={() => onRemoveImage(i)}
              className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground rounded-full p-0.5"
              aria-label="Remover imagem"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
        {post.image_urls.length < MAX_IMAGES && (
          <label className="shrink-0 h-20 w-20 rounded border border-dashed flex items-center justify-center cursor-pointer hover:bg-muted">
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4 text-muted-foreground" />
            )}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onAddImage(f);
                e.target.value = "";
              }}
            />
          </label>
        )}
      </div>

      <div>
        <Label className="text-xs">Legenda</Label>
        <Textarea
          value={caption}
          rows={2}
          onChange={(e) => setCaption(e.target.value)}
          onFocus={() => (focusedRef.current = true)}
          onBlur={() => {
            focusedRef.current = false;
            if (caption !== post.caption) onPatch({ caption });
          }}
          placeholder="Conte sobre este trabalho..."
        />
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Switch checked={post.is_active} onCheckedChange={(v) => onPatch({ is_active: v })} />
          <span className="text-xs text-muted-foreground">Ativo</span>
          <span className="text-xs text-muted-foreground ml-3">❤️ {post.likes_count}</span>
        </div>
        <Button variant="ghost" size="sm" onClick={onRemove}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>
    </div>
  );
}
