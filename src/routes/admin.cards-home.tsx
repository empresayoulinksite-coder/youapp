import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Eye, EyeOff, ArrowUp, ArrowDown } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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

export const Route = createFileRoute("/admin/cards-home")({
  component: AdminCardsHome,
});

type PromoCard = {
  id: string;
  badge: string;
  title: string;
  subtitle: string | null;
  cta_label: string;
  link_url: string;
  bg_style: string;
  emoji: string | null;
  sort_order: number;
  is_active: boolean;
};

type Draft = Partial<PromoCard>;

const empty: Draft = {
  badge: "",
  title: "",
  subtitle: "",
  cta_label: "",
  link_url: "/",
  bg_style: "gradient",
  emoji: "",
  sort_order: 0,
  is_active: true,
};

function AdminCardsHome() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Draft | null>(null);

  const { data: cards = [], isLoading } = useQuery({
    queryKey: ["admin-promo-cards"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("home_promo_cards")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data as PromoCard[];
    },
  });

  const save = useMutation({
    mutationFn: async (d: Draft) => {
      if (!d.badge?.trim()) throw new Error("Informe a tag");
      if (!d.title?.trim()) throw new Error("Informe o título");
      if (!d.cta_label?.trim()) throw new Error("Informe o texto do botão");
      if (!d.link_url?.trim()) throw new Error("Informe o link");
      const payload = {
        badge: d.badge.trim(),
        title: d.title.trim(),
        subtitle: d.subtitle?.trim() || null,
        cta_label: d.cta_label.trim(),
        link_url: d.link_url.trim(),
        bg_style: d.bg_style || "gradient",
        emoji: d.emoji?.trim() || null,
        sort_order: Number(d.sort_order) || 0,
        is_active: d.is_active ?? true,
      };
      if (d.id) {
        const { error } = await supabase.from("home_promo_cards").update(payload).eq("id", d.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("home_promo_cards").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Card salvo");
      qc.invalidateQueries({ queryKey: ["admin-promo-cards"] });
      qc.invalidateQueries({ queryKey: ["home-promo-cards"] });
      setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("home_promo_cards").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Card excluído");
      qc.invalidateQueries({ queryKey: ["admin-promo-cards"] });
      qc.invalidateQueries({ queryKey: ["home-promo-cards"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("home_promo_cards")
        .update({ is_active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-promo-cards"] });
      qc.invalidateQueries({ queryKey: ["home-promo-cards"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const move = useMutation({
    mutationFn: async ({ id, sort_order }: { id: string; sort_order: number }) => {
      const { error } = await supabase
        .from("home_promo_cards")
        .update({ sort_order })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-promo-cards"] });
      qc.invalidateQueries({ queryKey: ["home-promo-cards"] });
    },
  });

  return (
    <div>
      <div className="mb-4 flex items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">Cards da Home</h1>
          <p className="text-sm text-muted-foreground">
            Banners promocionais exibidos no topo da home.
          </p>
        </div>
        <Button onClick={() => setEditing({ ...empty, sort_order: (cards.at(-1)?.sort_order ?? 0) + 1 })}>
          <Plus className="h-4 w-4" /> Novo card
        </Button>
      </div>

      {isLoading ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Carregando...</p>
      ) : cards.length === 0 ? (
        <div className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
          Nenhum card criado.
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((c, idx) => (
            <li
              key={c.id}
              className={`rounded-2xl border bg-card p-4 ${!c.is_active ? "opacity-60" : ""}`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="inline-block rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-bold uppercase text-primary">
                  {c.badge}
                </span>
                <div className="flex items-center gap-1.5">
                  {c.is_active ? (
                    <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                  ) : (
                    <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                  <Switch
                    checked={c.is_active}
                    onCheckedChange={(v) => toggleActive.mutate({ id: c.id, is_active: v })}
                  />
                </div>
              </div>
              <h3 className="mt-2 text-lg font-extrabold leading-tight">
                {c.emoji && <span className="mr-1">{c.emoji}</span>}
                {c.title}
              </h3>
              {c.subtitle && (
                <p className="mt-1 text-sm text-muted-foreground">{c.subtitle}</p>
              )}
              <p className="mt-2 text-xs">
                <span className="font-semibold">Botão:</span> {c.cta_label} →{" "}
                <span className="font-mono text-muted-foreground">{c.link_url}</span>
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Fundo: {c.bg_style === "gradient" ? "Gradiente roxo" : "Bege claro"}
              </p>
              <div className="mt-3 flex gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setEditing(c)}
                >
                  <Pencil className="h-3 w-3" /> Editar
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={idx === 0}
                  onClick={() => {
                    const prev = cards[idx - 1];
                    if (!prev) return;
                    move.mutate({ id: c.id, sort_order: prev.sort_order });
                    move.mutate({ id: prev.id, sort_order: c.sort_order });
                  }}
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={idx === cards.length - 1}
                  onClick={() => {
                    const next = cards[idx + 1];
                    if (!next) return;
                    move.mutate({ id: c.id, sort_order: next.sort_order });
                    move.mutate({ id: next.id, sort_order: c.sort_order });
                  }}
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    if (confirm(`Excluir card "${c.title}"?`)) del.mutate(c.id);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <Dialog open onOpenChange={(o) => !o && setEditing(null)}>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editing.id ? "Editar card" : "Novo card"}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-3">
              <div>
                <Label>Tag (badge superior)</Label>
                <Input
                  value={editing.badge || ""}
                  onChange={(e) => setEditing({ ...editing, badge: e.target.value })}
                  placeholder="Ex: Clube Youapp"
                />
              </div>
              <div>
                <Label>Título</Label>
                <Input
                  value={editing.title || ""}
                  onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                  placeholder="Ex: Entrega grátis ilimitada"
                />
              </div>
              <div>
                <Label>Subtítulo</Label>
                <Textarea
                  rows={2}
                  value={editing.subtitle || ""}
                  onChange={(e) => setEditing({ ...editing, subtitle: e.target.value })}
                  placeholder="Ex: Em milhares de restaurantes perto de você"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Texto do botão</Label>
                  <Input
                    value={editing.cta_label || ""}
                    onChange={(e) => setEditing({ ...editing, cta_label: e.target.value })}
                    placeholder="Ex: Assinar agora"
                  />
                </div>
                <div>
                  <Label>Link (para onde leva)</Label>
                  <Input
                    value={editing.link_url || ""}
                    onChange={(e) => setEditing({ ...editing, link_url: e.target.value })}
                    placeholder="/cupons"
                  />
                </div>
                <div>
                  <Label>Estilo do fundo</Label>
                  <Select
                    value={editing.bg_style || "gradient"}
                    onValueChange={(v) => setEditing({ ...editing, bg_style: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gradient">Gradiente roxo</SelectItem>
                      <SelectItem value="accent">Bege claro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Emoji decorativo</Label>
                  <Input
                    value={editing.emoji || ""}
                    onChange={(e) => setEditing({ ...editing, emoji: e.target.value })}
                    placeholder="🛵"
                  />
                </div>
                <div>
                  <Label>Ordem</Label>
                  <Input
                    type="number"
                    value={editing.sort_order ?? 0}
                    onChange={(e) =>
                      setEditing({ ...editing, sort_order: Number(e.target.value) })
                    }
                  />
                </div>
                <div className="flex items-end gap-2">
                  <Switch
                    checked={editing.is_active ?? true}
                    onCheckedChange={(v) => setEditing({ ...editing, is_active: v })}
                  />
                  <Label>Ativo</Label>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditing(null)}>
                Cancelar
              </Button>
              <Button disabled={save.isPending} onClick={() => save.mutate(editing)}>
                {save.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
