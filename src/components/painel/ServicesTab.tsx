import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Tag, X, ImagePlus } from "lucide-react";
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
};

function brl(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function ServicesTab({ storeId }: { storeId: string }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Draft | null>(null);

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
                <p className="mt-1 text-sm">
                  <span className="font-semibold">{brl(Number(s.price))}</span>
                  <span className="text-muted-foreground"> · {s.duration_minutes} min</span>
                </p>
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
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing.id ? "Editar serviço" : "Novo serviço"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
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
