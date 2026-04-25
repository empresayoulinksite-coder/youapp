import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Tag, X, ImagePlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { uploadImage } from "@/lib/upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

type Service = {
  id: string;
  store_id: string;
  name: string;
  description: string | null;
  price: number;
  duration_minutes: number;
  is_active: boolean;
  position: number;
  image_url: string | null;
  feed_category_id: string | null;
  gallery_urls: string[];
  show_price: boolean;
  show_duration: boolean;
};

type FeedCategory = { id: string; name: string };

type Draft = {
  id?: string;
  name: string;
  description: string;
  price: string;
  promoPrice: string;
  duration_minutes: string;
  is_active: boolean;
  feed_category_id: string | null;
  image_url: string | null;
  gallery_urls: string[];
  show_price: boolean;
  show_duration: boolean;
};

const emptyDraft: Draft = {
  name: "",
  description: "",
  price: "",
  promoPrice: "",
  duration_minutes: "30",
  is_active: true,
  feed_category_id: null,
  image_url: null,
  gallery_urls: [],
  show_price: true,
  show_duration: true,
};

function brl(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

type GalleryUpload = { id: string; preview: string };

export function ServicesTab({ storeId }: { storeId: string }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Draft | null>(null);
  const [uploadingGallery, setUploadingGallery] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [galleryUploads, setGalleryUploads] = useState<GalleryUpload[]>([]);
  const [galleryProgress, setGalleryProgress] = useState({ done: 0, total: 0 });

  const handleCoverUpload = async (file: File) => {
    setEditing((prev) => prev);
    setUploadingCover(true);
    try {
      const url = await uploadImage("menu-images", file);
      setEditing((prev) => (prev ? { ...prev, image_url: url } : prev));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploadingCover(false);
    }
  };

  const handleGalleryUpload = async (files: FileList) => {
    const list = Array.from(files);
    const total = list.length;
    const placeholders: GalleryUpload[] = list.map((f) => ({
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
            setEditing((prev) =>
              prev ? { ...prev, gallery_urls: [...prev.gallery_urls, url] } : prev,
            );
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

  const { data: services = [], isLoading } = useQuery({
    queryKey: ["painel", "services", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services")
        .select("*")
        .eq("store_id", storeId)
        .order("position", { ascending: true })
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Service[];
    },
  });

  const { data: feedCategories = [] } = useQuery({
    queryKey: ["painel", "feed-categories", storeId],
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
    mutationFn: async (d: Draft) => {
      const price = Number(d.price.replace(",", "."));
      if (Number.isNaN(price) || price < 0) throw new Error("Preço inválido");
      const duration = parseInt(d.duration_minutes, 10);
      if (Number.isNaN(duration) || duration <= 0) throw new Error("Duração inválida");

      const payload = {
        store_id: storeId,
        name: d.name.trim(),
        description: d.description.trim() || null,
        price,
        duration_minutes: duration,
        is_active: d.is_active,
        feed_category_id: d.feed_category_id || null,
        image_url: d.image_url || null,
        gallery_urls: d.gallery_urls,
        show_price: d.show_price,
        show_duration: d.show_duration,
      };
      if (!payload.name) throw new Error("Nome obrigatório");

      if (d.id) {
        const { error } = await supabase.from("services").update(payload).eq("id", d.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("services").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Serviço salvo");
      qc.invalidateQueries({ queryKey: ["painel", "services"] });
      setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("services").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Serviço removido");
      qc.invalidateQueries({ queryKey: ["painel", "services"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase
        .from("services")
        .update({ is_active: active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["painel", "services"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Gerencie os serviços oferecidos pela loja.
        </p>
        <Button size="sm" onClick={() => setEditing({ ...emptyDraft })}>
          <Plus className="h-4 w-4" /> Novo serviço
        </Button>
      </div>

      {isLoading ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Carregando...</p>
      ) : services.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          Nenhum serviço cadastrado.
        </p>
      ) : (
        <ul className="divide-y rounded-lg border bg-card">
          {services.map((s) => (
            <li key={s.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold">{s.name}</p>
                  {!s.is_active && (
                    <Badge variant="outline" className="text-muted-foreground">
                      Inativo
                    </Badge>
                  )}
                </div>
                {s.description && (
                  <p className="text-xs text-muted-foreground">{s.description}</p>
                )}
                {(s.show_price || s.show_duration) && (
                  <p className="mt-1 text-sm">
                    {s.show_price && (
                      <span className="font-semibold">{brl(Number(s.price))}</span>
                    )}
                    {s.show_price && s.show_duration && (
                      <span className="text-muted-foreground"> · </span>
                    )}
                    {s.show_duration && (
                      <span className="text-muted-foreground">{s.duration_minutes} min</span>
                    )}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <Switch
                    checked={s.is_active}
                    onCheckedChange={(v) => toggleActive.mutate({ id: s.id, active: v })}
                  />
                  <span className="text-[11px] text-muted-foreground">Ativo</span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setEditing({
                      id: s.id,
                      name: s.name,
                      description: s.description ?? "",
                      price: String(s.price),
                      promoPrice: "",
                      duration_minutes: String(s.duration_minutes),
                      is_active: s.is_active,
                      feed_category_id: s.feed_category_id,
                      image_url: s.image_url,
                      gallery_urls: s.gallery_urls ?? [],
                      show_price: s.show_price ?? true,
                      show_duration: s.show_duration ?? true,
                    })
                  }
                >
                  <Pencil className="h-4 w-4" /> Editar
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    if (confirm(`Remover "${s.name}"?`)) remove.mutate(s.id);
                  }}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="rounded-lg border border-dashed bg-muted/30 p-3 text-xs text-muted-foreground">
        <p className="flex items-center gap-1.5 font-semibold text-foreground">
          <Tag className="h-3.5 w-3.5" /> Como fazer promoção?
        </p>
        <p className="mt-1">
          Para promoções com cupom (ex: 10% off), use a aba <strong>Cupons</strong>. Para
          baixar o preço de um serviço diretamente, edite o preço aqui — você pode
          restaurar quando quiser.
        </p>
      </div>

      {editing && (
        <Dialog open onOpenChange={(o) => !o && setEditing(null)}>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editing.id ? "Editar serviço" : "Novo serviço"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Foto de capa</Label>
                <div className="mt-1 flex items-center gap-3">
                  {editing.image_url ? (
                    <img
                      src={editing.image_url}
                      alt=""
                      className="h-16 w-16 rounded object-cover"
                    />
                  ) : (
                    <div className="h-16 w-16 rounded bg-muted flex items-center justify-center text-2xl">
                      ✂️
                    </div>
                  )}
                  <Input
                    type="file"
                    accept="image/*"
                    disabled={uploadingCover}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleCoverUpload(f);
                    }}
                  />
                </div>
              </div>
              <div>
                <Label>Nome</Label>
                <Input
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  placeholder="Ex: Corte masculino"
                />
              </div>
              <div>
                <Label>Descrição</Label>
                <Textarea
                  value={editing.description}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                  placeholder="Detalhes (opcional)"
                  rows={2}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Preço (R$)</Label>
                  <Input
                    inputMode="decimal"
                    value={editing.price}
                    onChange={(e) => setEditing({ ...editing, price: e.target.value })}
                    placeholder="0,00"
                    disabled={!editing.show_price}
                  />
                </div>
                <div>
                  <Label>Duração (min)</Label>
                  <Input
                    type="number"
                    min="5"
                    step="5"
                    value={editing.duration_minutes}
                    onChange={(e) =>
                      setEditing({ ...editing, duration_minutes: e.target.value })
                    }
                    disabled={!editing.show_duration}
                  />
                </div>
              </div>
              <div className="rounded-md border p-3 space-y-2 bg-muted/30">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">Mostrar preço</p>
                    <p className="text-[11px] text-muted-foreground">
                      Desligue para ocultar o valor para os clientes.
                    </p>
                  </div>
                  <Switch
                    checked={editing.show_price}
                    onCheckedChange={(v) => setEditing({ ...editing, show_price: v })}
                  />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">Mostrar duração</p>
                    <p className="text-[11px] text-muted-foreground">
                      Desligue para ocultar o tempo do serviço.
                    </p>
                  </div>
                  <Switch
                    checked={editing.show_duration}
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
                          ? "Crie categorias no feed primeiro"
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
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Vincule a um álbum do feed para aparecer no botão "Ver serviço completo".
                </p>
              </div>
              <div>
                <Label>Galeria de fotos do serviço</Label>
                <p className="text-[11px] text-muted-foreground mb-2">
                  Adicione várias fotos. O cliente verá um feed estilo Instagram ao
                  abrir o serviço.
                </p>
                {(editing.gallery_urls.length > 0 || galleryUploads.length > 0) && (
                  <div className="grid grid-cols-3 gap-2 mb-2">
                    {editing.gallery_urls.map((url, i) => (
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
                              gallery_urls: editing.gallery_urls.filter(
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
                    accept="image/*"
                    multiple
                    className="hidden"
                    disabled={uploadingGallery}
                    onChange={(e) => {
                      const files = e.target.files;
                      if (files && files.length > 0) handleGalleryUpload(files);
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={editing.is_active}
                  onCheckedChange={(v) => setEditing({ ...editing, is_active: v })}
                />
                <span className="text-sm">Ativo (visível para clientes)</span>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditing(null)}>
                Cancelar
              </Button>
              <Button onClick={() => save.mutate(editing)} disabled={save.isPending}>
                {save.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
