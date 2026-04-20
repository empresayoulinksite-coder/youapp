import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, FolderPlus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

export const Route = createFileRoute("/admin/produtos")({
  component: AdminProducts,
});

type MenuItem = {
  id: string;
  store_id: string;
  category_id: string;
  name: string;
  description: string | null;
  price: number;
  original_price: number | null;
  promo: string | null;
  emoji: string;
  image_url: string | null;
  position: number;
};

function AdminProducts() {
  const qc = useQueryClient();
  const [storeId, setStoreId] = useState<string>("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<MenuItem> | null>(null);
  const [uploading, setUploading] = useState(false);
  const [catOpen, setCatOpen] = useState(false);
  const [newCat, setNewCat] = useState("");

  const { data: stores = [] } = useQuery({
    queryKey: ["admin-stores-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("stores").select("id,name").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["admin-cats", storeId],
    enabled: !!storeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("menu_categories")
        .select("*")
        .eq("store_id", storeId)
        .order("position");
      if (error) throw error;
      return data;
    },
  });

  const { data: items = [] } = useQuery({
    queryKey: ["admin-items", storeId],
    enabled: !!storeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("menu_items")
        .select("*")
        .eq("store_id", storeId)
        .order("position");
      if (error) throw error;
      return data as MenuItem[];
    },
  });

  const addCategory = useMutation({
    mutationFn: async (name: string) => {
      const { error } = await supabase.from("menu_categories").insert({
        store_id: storeId,
        name,
        position: categories.length,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Categoria criada");
      qc.invalidateQueries({ queryKey: ["admin-cats", storeId] });
      setNewCat("");
      setCatOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delCategory = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("menu_categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Categoria excluída");
      qc.invalidateQueries({ queryKey: ["admin-cats", storeId] });
      qc.invalidateQueries({ queryKey: ["admin-items", storeId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const save = useMutation({
    mutationFn: async (m: Partial<MenuItem>) => {
      const payload = {
        store_id: storeId,
        category_id: m.category_id!,
        name: m.name!,
        description: m.description || null,
        price: Number(m.price) || 0,
        original_price: m.original_price ? Number(m.original_price) : null,
        promo: m.promo || null,
        emoji: m.emoji || "🍽️",
        image_url: m.image_url || null,
        position: Number(m.position) || 0,
      };
      if (m.id) {
        const { error } = await supabase.from("menu_items").update(payload).eq("id", m.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("menu_items").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Produto salvo");
      qc.invalidateQueries({ queryKey: ["admin-items", storeId] });
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("menu_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Produto excluído");
      qc.invalidateQueries({ queryKey: ["admin-items", storeId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

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

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-2xl font-bold">Produtos</h1>
        <p className="text-sm text-muted-foreground">Selecione uma loja para gerenciar o cardápio</p>
      </div>

      <div className="mb-4 max-w-sm">
        <Label>Loja</Label>
        <Select value={storeId} onValueChange={setStoreId}>
          <SelectTrigger><SelectValue placeholder="Escolha uma loja" /></SelectTrigger>
          <SelectContent>
            {stores.map((s) => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {storeId && (
        <>
          <div className="mb-6 rounded-lg border bg-background p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold">Categorias</h2>
              <Button size="sm" variant="outline" onClick={() => setCatOpen(true)}>
                <FolderPlus className="h-4 w-4" /> Nova categoria
              </Button>
            </div>
            {categories.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma categoria. Crie a primeira para adicionar produtos.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {categories.map((c) => (
                  <div key={c.id} className="flex items-center gap-2 rounded-full bg-muted px-3 py-1 text-sm">
                    {c.name}
                    <button
                      onClick={() => {
                        if (confirm(`Excluir categoria ${c.name}? Os produtos dela também serão excluídos.`))
                          delCategory.mutate(c.id);
                      }}
                      className="text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Produtos ({items.length})</h2>
            <Button
              disabled={categories.length === 0}
              onClick={() => {
                setEditing({
                  category_id: categories[0]?.id,
                  emoji: "🍽️",
                  position: items.length,
                });
                setOpen(true);
              }}
            >
              <Plus className="h-4 w-4" /> Novo produto
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((m) => {
              const cat = categories.find((c) => c.id === m.category_id);
              return (
                <div key={m.id} className="rounded-lg border bg-background p-3">
                  <div className="flex items-start gap-3">
                    {m.image_url ? (
                      <img src={m.image_url} alt={m.name} className="h-16 w-16 rounded-md object-cover" />
                    ) : (
                      <div className="flex h-16 w-16 items-center justify-center rounded-md bg-muted text-2xl">
                        {m.emoji}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate font-semibold">{m.name}</h3>
                      <p className="text-xs text-muted-foreground">{cat?.name}</p>
                      <p className="text-sm font-bold">R$ {Number(m.price).toFixed(2)}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => { setEditing(m); setOpen(true); }}>
                      <Pencil className="h-3 w-3" /> Editar
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => { if (confirm(`Excluir ${m.name}?`)) del.mutate(m.id); }}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Dialog categoria */}
      <Dialog open={catOpen} onOpenChange={setCatOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova categoria</DialogTitle></DialogHeader>
          <Input value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="Ex: Pizzas Salgadas" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCatOpen(false)}>Cancelar</Button>
            <Button disabled={!newCat.trim()} onClick={() => addCategory.mutate(newCat.trim())}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog produto */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Editar produto" : "Novo produto"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label>Imagem</Label>
                <div className="mt-1 flex items-center gap-3">
                  {editing.image_url && (
                    <img src={editing.image_url} alt="" className="h-16 w-16 rounded object-cover" />
                  )}
                  <Input type="file" accept="image/*" disabled={uploading}
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
                  />
                </div>
              </div>
              <div className="sm:col-span-2">
                <Label>Categoria</Label>
                <Select value={editing.category_id || ""} onValueChange={(v) => setEditing({ ...editing, category_id: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2">
                <Label>Nome</Label>
                <Input value={editing.name || ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <Label>Descrição</Label>
                <Textarea rows={2} value={editing.description || ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
              </div>
              <div>
                <Label>Preço (R$)</Label>
                <Input type="number" step="0.01" value={editing.price ?? ""} onChange={(e) => setEditing({ ...editing, price: Number(e.target.value) })} />
              </div>
              <div>
                <Label>Preço original (riscado)</Label>
                <Input type="number" step="0.01" value={editing.original_price ?? ""} onChange={(e) => setEditing({ ...editing, original_price: e.target.value ? Number(e.target.value) : null })} />
              </div>
              <div>
                <Label>Emoji</Label>
                <Input value={editing.emoji || ""} onChange={(e) => setEditing({ ...editing, emoji: e.target.value })} />
              </div>
              <div>
                <Label>Promo (texto)</Label>
                <Input value={editing.promo || ""} onChange={(e) => setEditing({ ...editing, promo: e.target.value })} placeholder="Ex: -20%" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button
              disabled={save.isPending || uploading || !editing?.name || !editing?.category_id || !editing?.price}
              onClick={() => editing && save.mutate(editing)}
            >
              {save.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
