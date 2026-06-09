import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Upload, Loader2, X, Images, Tag } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  category_id: string | null;
  show_services_cta: boolean;
}

interface FeedCategory {
  id: string;
  name: string;
  position: number;
}

const MAX_IMAGES = 5;
const NO_CATEGORY = "__none__";

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

  const { data: categories = [] } = useQuery({
    queryKey: ["admin-store-feed-categories", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_feed_categories")
        .select("*")
        .eq("store_id", storeId)
        .order("position", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as FeedCategory[];
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin-store-feed", storeId] });
    qc.invalidateQueries({ queryKey: ["store-feed", storeId] });
  };

  const invalidateCategories = () => {
    qc.invalidateQueries({ queryKey: ["admin-store-feed-categories", storeId] });
    qc.invalidateQueries({ queryKey: ["store-feed-categories", storeId] });
  };

  const createCategory = useMutation({
    mutationFn: async (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) throw new Error("Digite um nome para a categoria");
      const { error } = await supabase
        .from("store_feed_categories")
        .insert({ store_id: storeId, name: trimmed, position: categories.length });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateCategories();
      toast.success("Categoria criada");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const renameCategory = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await supabase
        .from("store_feed_categories")
        .update({ name: name.trim() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidateCategories,
    onError: (e: any) => toast.error(e.message),
  });

  const deleteCategory = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("store_feed_categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateCategories();
      invalidate();
      toast.success("Categoria removida");
    },
    onError: (e: any) => toast.error(e.message),
  });

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
      const url = await uploadImage("store-feed" as any, file, storeId);
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
            Posts com fotos em carrossel, organizados por categoria.
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

      <CategoriesManager
        categories={categories}
        onCreate={(name) => createCategory.mutate(name)}
        onRename={(id, name) => renameCategory.mutate({ id, name })}
        onDelete={(id) => {
          if (confirm("Remover esta categoria? Os posts vinculados ficarão sem categoria.")) {
            deleteCategory.mutate(id);
          }
        }}
      />

      <div className="space-y-3">
        {isLoading && <p className="text-xs text-muted-foreground">Carregando...</p>}
        {!isLoading && posts.length === 0 && (
          <p className="text-xs text-muted-foreground py-2">Nenhum post ainda.</p>
        )}

        {posts.map((p) => (
          <PostRow
            key={p.id}
            post={p}
            categories={categories}
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

function CategoriesManager({
  categories,
  onCreate,
  onRename,
  onDelete,
}: {
  categories: FeedCategory[];
  onCreate: (name: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}) {
  const [newName, setNewName] = useState("");

  return (
    <div className="rounded-lg border p-3 space-y-2 bg-background">
      <div className="flex items-center gap-2 text-xs font-medium">
        <Tag className="h-3.5 w-3.5" /> Categorias
      </div>
      <p className="text-[11px] text-muted-foreground">
        Crie categorias (ex: Cortes, Barba) e atribua a cada post.
      </p>

      <div className="flex gap-2">
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Nova categoria"
          className="h-8 text-sm"
          onKeyDown={(e) => {
            if (e.key === "Enter" && newName.trim()) {
              onCreate(newName);
              setNewName("");
            }
          }}
        />
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            if (newName.trim()) {
              onCreate(newName);
              setNewName("");
            }
          }}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {categories.length > 0 && (
        <div className="space-y-1.5 pt-1">
          {categories.map((c) => (
            <CategoryRow key={c.id} category={c} onRename={onRename} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  );
}

function CategoryRow({
  category,
  onRename,
  onDelete,
}: {
  category: FeedCategory;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}) {
  const [name, setName] = useState(category.name);
  const focusedRef = useRef(false);
  useEffect(() => {
    if (!focusedRef.current) setName(category.name);
  }, [category.name]);

  return (
    <div className="flex gap-2 items-center">
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onFocus={() => (focusedRef.current = true)}
        onBlur={() => {
          focusedRef.current = false;
          const trimmed = name.trim();
          if (trimmed && trimmed !== category.name) onRename(category.id, trimmed);
          else if (!trimmed) setName(category.name);
        }}
        className="h-8 text-sm"
      />
      <Button variant="ghost" size="sm" onClick={() => onDelete(category.id)}>
        <Trash2 className="h-3.5 w-3.5 text-destructive" />
      </Button>
    </div>
  );
}

function PostRow({
  post,
  categories,
  uploading,
  onPatch,
  onRemove,
  onAddImage,
  onRemoveImage,
}: {
  post: FeedPost;
  categories: FeedCategory[];
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
        <Label className="text-xs">Categoria</Label>
        <Select
          value={post.category_id ?? NO_CATEGORY}
          onValueChange={(v) => onPatch({ category_id: v === NO_CATEGORY ? null : v })}
        >
          <SelectTrigger className="h-9">
            <SelectValue placeholder="Sem categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_CATEGORY}>Sem categoria</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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

      <div className="flex items-center gap-2">
        <Switch
          checked={post.show_services_cta}
          onCheckedChange={(v) => onPatch({ show_services_cta: v })}
        />
        <span className="text-xs text-muted-foreground">
          Mostrar botão "Ver serviço completo"
        </span>
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
