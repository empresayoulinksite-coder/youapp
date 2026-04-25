import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Pause, Play, Clock, DollarSign, ImagePlus, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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

export const Route = createFileRoute("/admin/servicos")({
  component: AdminServices,
});

type Service = {
  id: string;
  store_id: string;
  name: string;
  description: string | null;
  price: number;
  duration_minutes: number;
  image_url: string | null;
  is_active: boolean;
  position: number;
  feed_category_id: string | null;
  gallery_urls: string[];
  show_price: boolean;
  show_duration: boolean;
};

type ServiceStore = {
  id: string;
  name: string;
  slot_minutes: number;
};

type FeedCategory = { id: string; name: string };

const empty: Partial<Service> = {
  name: "",
  description: "",
  price: 0,
  duration_minutes: 30,
  image_url: "",
  is_active: true,
  position: 0,
  feed_category_id: null,
  gallery_urls: [],
  show_price: true,
  show_duration: true,
};

function AdminServices() {
  const qc = useQueryClient();
  const [storeId, setStoreId] = useState<string>("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Service> | null>(null);
  const [uploading, setUploading] = useState(false);

  const { data: stores = [] } = useQuery({
    queryKey: ["admin-service-stores"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stores")
        .select("id, name, slot_minutes")
        .eq("store_type", "service")
        .order("name");
      if (error) throw error;
      return data as ServiceStore[];
    },
  });

  const currentStore = stores.find((s) => s.id === storeId);

  const { data: services = [], isLoading } = useQuery({
    queryKey: ["admin-services", storeId],
    enabled: !!storeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services")
        .select("*")
        .eq("store_id", storeId)
        .order("position");
      if (error) throw error;
      return (data as Service[]).map((s) => ({ ...s, price: Number(s.price) }));
    },
  });

  const { data: feedCategories = [] } = useQuery({
    queryKey: ["admin-services-feed-cats", storeId],
    enabled: !!storeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_feed_categories")
        .select("id, name")
        .eq("store_id", storeId)
        .order("position", { ascending: true });
      if (error) throw error;
      return (data ?? []) as FeedCategory[];
    },
  });

  const save = useMutation({
    mutationFn: async (s: Partial<Service>) => {
      const payload = {
        store_id: storeId,
        name: s.name!,
        description: s.description || null,
        price: Number(s.price) || 0,
        duration_minutes: Number(s.duration_minutes) || 30,
        image_url: s.image_url || null,
        is_active: s.is_active ?? true,
        position: Number(s.position) || services.length,
        feed_category_id: s.feed_category_id || null,
        gallery_urls: s.gallery_urls ?? [],
        show_price: s.show_price ?? true,
        show_duration: s.show_duration ?? true,
      };
      if (s.id) {
        const { error } = await supabase.from("services").update(payload).eq("id", s.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("services").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Serviço salvo");
      qc.invalidateQueries({ queryKey: ["admin-services", storeId] });
      setOpen(false);
      setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("services").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Serviço excluído");
      qc.invalidateQueries({ queryKey: ["admin-services", storeId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleActive = useMutation({
    mutationFn: async (s: Service) => {
      const { error } = await supabase
        .from("services")
        .update({ is_active: !s.is_active })
        .eq("id", s.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-services", storeId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const updateSlotMinutes = useMutation({
    mutationFn: async (slot_minutes: number) => {
      const { error } = await supabase
        .from("stores")
        .update({ slot_minutes })
        .eq("id", storeId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Tamanho do slot atualizado");
      qc.invalidateQueries({ queryKey: ["admin-service-stores"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [uploadingGallery, setUploadingGallery] = useState(false);
  const [galleryUploads, setGalleryUploads] = useState<{ id: string; preview: string }[]>([]);
  const [galleryProgress, setGalleryProgress] = useState({ done: 0, total: 0 });

  const handleFile = async (file: File) => {
    setUploading(true);
    try {
      const url = await uploadImage("menu-images", file);
      setEditing((prev) => ({ ...prev, image_url: url }));
      toast.success("Imagem enviada");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const handleGalleryFiles = async (files: FileList) => {
    const list = Array.from(files);
    const total = list.length;
    const placeholders = list.map((f) => ({
      id: `${f.name}-${f.size}-${Math.random().toString(36).slice(2, 8)}`,
      preview: URL.createObjectURL(f),
    }));
    setGalleryUploads(placeholders);
    setGalleryProgress({ done: 0, total });
    setUploadingGallery(true);
    const toastId = toast.loading(`Enviando 0 de ${total} foto(s)...`);

    let succeeded = 0;
    try {
      await Promise.all(
        list.map(async (f, idx) => {
          try {
            const url = await uploadImage("menu-images", f);
            setEditing((prev) => ({
              ...prev,
              gallery_urls: [...(prev?.gallery_urls ?? []), url],
            }));
            succeeded += 1;
          } finally {
            setGalleryUploads((prev) => prev.filter((p) => p.id !== placeholders[idx].id));
            setGalleryProgress((prev) => {
              const done = prev.done + 1;
              toast.loading(`Enviando ${done} de ${total} foto(s)...`, { id: toastId });
              return { done, total: prev.total };
            });
          }
        }),
      );
      if (succeeded === total) {
        toast.success(`${succeeded} foto(s) enviada(s) com sucesso!`, { id: toastId });
      } else {
        toast.error(
          `${succeeded} de ${total} enviada(s). Algumas falharam, tente novamente.`,
          { id: toastId },
        );
      }
    } finally {
      placeholders.forEach((p) => URL.revokeObjectURL(p.preview));
      setUploadingGallery(false);
      setGalleryUploads([]);
      setGalleryProgress({ done: 0, total: 0 });
    }
  };

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-2xl font-bold">Serviços</h1>
        <p className="text-sm text-muted-foreground">
          Catálogo de serviços oferecidos pelas lojas de agendamento
        </p>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-2 max-w-2xl">
        <div>
          <Label>Loja</Label>
          <Select value={storeId} onValueChange={setStoreId}>
            <SelectTrigger>
              <SelectValue
                placeholder={
                  stores.length === 0 ? "Nenhuma loja de serviço" : "Escolha uma loja"
                }
              />
            </SelectTrigger>
            <SelectContent>
              {stores.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {currentStore && (
          <div>
            <Label>Tamanho do slot (min)</Label>
            <Select
              value={String(currentStore.slot_minutes)}
              onValueChange={(v) => updateSlotMinutes.mutate(Number(v))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[15, 20, 30, 45, 60].map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n} min
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {storeId && (
        <>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {services.length} {services.length === 1 ? "serviço" : "serviços"}
            </p>
            <Button
              onClick={() => {
                setEditing({ ...empty, position: services.length });
                setOpen(true);
              }}
            >
              <Plus className="h-4 w-4" /> Novo serviço
            </Button>
          </div>

          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : services.length === 0 ? (
            <div className="rounded-lg border border-dashed bg-card p-8 text-center">
              <p className="text-sm text-muted-foreground">
                Nenhum serviço cadastrado. Crie o primeiro acima.
              </p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {services.map((s) => (
                <div
                  key={s.id}
                  className="rounded-lg border bg-background p-3 flex flex-col"
                >
                  <div className="flex items-start gap-3">
                    {s.image_url ? (
                      <img
                        src={s.image_url}
                        alt={s.name}
                        className="h-16 w-16 rounded-md object-cover"
                      />
                    ) : (
                      <div className="flex h-16 w-16 items-center justify-center rounded-md bg-muted text-2xl">
                        ✂️
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="truncate font-semibold">{s.name}</h3>
                        {!s.is_active && (
                          <span className="rounded-full bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium text-destructive">
                            Inativo
                          </span>
                        )}
                      </div>
                      {s.description && (
                        <p className="line-clamp-2 text-xs text-muted-foreground">
                          {s.description}
                        </p>
                      )}
                      <p className="mt-1 text-xs text-muted-foreground flex items-center gap-2">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" /> {s.duration_minutes} min
                        </span>
                        <span className="flex items-center gap-1 font-semibold text-foreground">
                          <DollarSign className="h-3 w-3" />
                          {s.price.toFixed(2).replace(".", ",")}
                        </span>
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Button
                      size="sm"
                      variant={s.is_active ? "secondary" : "default"}
                      className="flex-1"
                      onClick={() => toggleActive.mutate(s)}
                    >
                      {s.is_active ? (
                        <>
                          <Pause className="h-3 w-3" /> Pausar
                        </>
                      ) : (
                        <>
                          <Play className="h-3 w-3" /> Ativar
                        </>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditing(s);
                        setOpen(true);
                      }}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => {
                        if (confirm(`Excluir ${s.name}?`)) del.mutate(s.id);
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Editar serviço" : "Novo serviço"}</DialogTitle>
          </DialogHeader>

          {editing && (
            <div className="grid gap-3">
              <div>
                <Label>Imagem</Label>
                <div className="mt-1 flex items-center gap-3">
                  {editing.image_url && (
                    <img
                      src={editing.image_url}
                      alt=""
                      className="h-16 w-16 rounded object-cover"
                    />
                  )}
                  <Input
                    type="file"
                    accept="image/*,.heic,.heif,.HEIC,.HEIF"
                    disabled={uploading}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleFile(f);
                    }}
                  />
                </div>
              </div>
              <div>
                <Label>Nome</Label>
                <Input
                  value={editing.name || ""}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  placeholder="Ex: Corte feminino"
                />
              </div>
              <div>
                <Label>Descrição</Label>
                <Textarea
                  value={editing.description || ""}
                  onChange={(e) =>
                    setEditing({ ...editing, description: e.target.value })
                  }
                  placeholder="Detalhes do serviço"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Preço (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editing.price ?? 0}
                    onChange={(e) =>
                      setEditing({ ...editing, price: Number(e.target.value) })
                    }
                    disabled={editing.show_price === false}
                  />
                </div>
                <div>
                  <Label>Duração (min)</Label>
                  <Input
                    type="number"
                    min="5"
                    step="5"
                    value={editing.duration_minutes ?? 30}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        duration_minutes: Number(e.target.value),
                      })
                    }
                    disabled={editing.show_duration === false}
                  />
                </div>
              </div>
              <div className="rounded-md border p-3 space-y-2 bg-muted/30">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">Mostrar preço</p>
                    <p className="text-xs text-muted-foreground">
                      Desligue para ocultar o valor para os clientes.
                    </p>
                  </div>
                  <Switch
                    checked={editing.show_price ?? true}
                    onCheckedChange={(v) => setEditing({ ...editing, show_price: v })}
                  />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">Mostrar duração</p>
                    <p className="text-xs text-muted-foreground">
                      Desligue para ocultar o tempo do serviço.
                    </p>
                  </div>
                  <Switch
                    checked={editing.show_duration ?? true}
                    onCheckedChange={(v) => setEditing({ ...editing, show_duration: v })}
                  />
                </div>
              </div>
              <div>
                <Label>Categoria do feed</Label>
                <Select
                  value={editing.feed_category_id ?? "none"}
                  onValueChange={(v) =>
                    setEditing({
                      ...editing,
                      feed_category_id: v === "none" ? null : v,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        feedCategories.length === 0
                          ? "Nenhuma categoria do feed"
                          : "Sem categoria"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem categoria</SelectItem>
                    {feedCategories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="mt-1 text-xs text-muted-foreground">
                  Vincule o serviço a um álbum do feed para que apareça quando o
                  cliente clicar em "Ver serviço completo".
                </p>
              </div>
              <div>
                <Label>Galeria de fotos do serviço</Label>
                <p className="text-xs text-muted-foreground mb-2">
                  Adicione várias fotos. O cliente verá um feed estilo Instagram ao
                  abrir o serviço.
                </p>
                {((editing.gallery_urls && editing.gallery_urls.length > 0) ||
                  galleryUploads.length > 0) && (
                  <div className="grid grid-cols-3 gap-2 mb-2">
                    {(editing.gallery_urls ?? []).map((url, i) => (
                      <div key={`${url}-${i}`} className="relative aspect-square">
                        <img
                          src={url}
                          alt=""
                          className="w-full h-full object-cover rounded-md"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setEditing({
                              ...editing,
                              gallery_urls: (editing.gallery_urls ?? []).filter(
                                (_, idx) => idx !== i,
                              ),
                            })
                          }
                          className="absolute top-1 right-1 bg-black/60 hover:bg-black/80 text-white rounded-full p-0.5"
                          aria-label="Remover"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                    {galleryUploads.map((u) => (
                      <div
                        key={u.id}
                        className="relative aspect-square rounded-md overflow-hidden"
                      >
                        <img
                          src={u.preview}
                          alt=""
                          className="w-full h-full object-cover opacity-50"
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                          <Loader2 className="h-6 w-6 text-white animate-spin" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <label
                  className={`flex items-center justify-center gap-2 border border-dashed rounded-md py-3 text-sm cursor-pointer hover:bg-muted/50 ${uploadingGallery ? "opacity-50 pointer-events-none" : ""}`}
                >
                  {uploadingGallery ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Enviando {galleryProgress.done} de {galleryProgress.total}...
                    </>
                  ) : (
                    <>
                      <ImagePlus className="h-4 w-4" />
                      Adicionar fotos
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/*,.heic,.heif,.HEIC,.HEIF"
                    multiple
                    className="hidden"
                    disabled={uploadingGallery}
                    onChange={(e) => {
                      const files = e.target.files;
                      if (files && files.length > 0) handleGalleryFiles(files);
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>
              <div className="flex items-center gap-3 pt-1">
                <Switch
                  checked={editing.is_active ?? true}
                  onCheckedChange={(v) => setEditing({ ...editing, is_active: v })}
                />
                <Label>Disponível para agendamento</Label>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => editing && save.mutate(editing)}
              disabled={save.isPending || !editing?.name}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
