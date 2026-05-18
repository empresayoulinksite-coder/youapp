import { createFileRoute } from "@tanstack/react-router";
import { requireAdminOnly } from "@/lib/admin-guards";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, ArrowUp, ArrowDown, Eye, EyeOff } from "lucide-react";
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
import {
  CATEGORY_ICON_NAMES,
  CATEGORY_TINTS,
  getCategoryIcon,
} from "@/lib/category-icons";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/categorias-home")({
  beforeLoad: () => requireAdminOnly(),
  component: AdminHomeCategories,
});

type HomeCategory = {
  id: string;
  slug: string;
  label: string;
  icon: string;
  tint: string;
  matches: string[];
  position: number;
  is_active: boolean;
  is_ecommerce: boolean;
};

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

function AdminHomeCategories() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<HomeCategory> | null>(null);
  const [matchesText, setMatchesText] = useState("");

  const { data: list = [], isLoading } = useQuery({
    queryKey: ["admin-home-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("home_categories")
        .select("*")
        .order("position");
      if (error) throw error;
      return (data ?? []) as HomeCategory[];
    },
  });

  const upsert = useMutation({
    mutationFn: async (c: Partial<HomeCategory>) => {
      const matches = matchesText
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const payload = {
        slug: c.slug || slugify(c.label || ""),
        label: c.label!,
        icon: c.icon || "ShoppingBag",
        tint: c.tint || "bg-muted text-foreground",
        matches,
        is_active: c.is_active ?? true,
        is_ecommerce: c.is_ecommerce ?? false,
        position: c.position ?? (list.at(-1)?.position ?? 0) + 1,
      };
      if (c.id) {
        const { error } = await supabase
          .from("home_categories")
          .update(payload)
          .eq("id", c.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("home_categories").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-home-categories"] });
      qc.invalidateQueries({ queryKey: ["home-categories"] });
      setOpen(false);
      setEditing(null);
      toast.success("Categoria salva");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("home_categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-home-categories"] });
      qc.invalidateQueries({ queryKey: ["home-categories"] });
      toast.success("Removida");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleActive = useMutation({
    mutationFn: async (c: HomeCategory) => {
      const { error } = await supabase
        .from("home_categories")
        .update({ is_active: !c.is_active })
        .eq("id", c.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-home-categories"] });
      qc.invalidateQueries({ queryKey: ["home-categories"] });
    },
  });

  const move = useMutation({
    mutationFn: async ({ id, dir }: { id: string; dir: -1 | 1 }) => {
      const idx = list.findIndex((c) => c.id === id);
      const swap = list[idx + dir];
      if (!swap) return;
      const a = list[idx];
      const { error: e1 } = await supabase
        .from("home_categories")
        .update({ position: swap.position })
        .eq("id", a.id);
      const { error: e2 } = await supabase
        .from("home_categories")
        .update({ position: a.position })
        .eq("id", swap.id);
      if (e1 || e2) throw e1 || e2;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-home-categories"] });
      qc.invalidateQueries({ queryKey: ["home-categories"] });
    },
  });

  function openNew() {
    setEditing({
      label: "",
      icon: "ShoppingBag",
      tint: "bg-muted text-foreground",
      is_active: true,
      is_ecommerce: false,
    });
    setMatchesText("");
    setOpen(true);
  }

  function openEdit(c: HomeCategory) {
    setEditing(c);
    setMatchesText(c.matches.join(", "));
    setOpen(true);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Categorias da Home</h1>
          <p className="text-sm text-muted-foreground">
            Os itens que aparecem em destaque na grade de categorias da página inicial.
          </p>
        </div>
        <Button onClick={openNew}>
          <Plus className="mr-1 h-4 w-4" /> Nova
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : (
        <div className="grid gap-2">
          {list.map((c, idx) => {
            const Icon = getCategoryIcon(c.icon);
            return (
              <div
                key={c.id}
                className={cn(
                  "flex items-center gap-3 rounded-md border bg-background p-3",
                  !c.is_active && "opacity-50",
                )}
              >
                <div
                  className={cn(
                    "grid h-12 w-12 place-items-center rounded-2xl",
                    c.tint,
                  )}
                >
                  <Icon className="h-6 w-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-medium">{c.label}</p>
                    {c.is_ecommerce && (
                      <span className="rounded-full bg-fuchsia-50 px-1.5 py-0.5 text-[10px] font-medium text-fuchsia-700">
                        E-com
                      </span>
                    )}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    /{c.slug} · {c.matches.join(", ") || "sem matches"}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    disabled={idx === 0}
                    onClick={() => move.mutate({ id: c.id, dir: -1 })}
                  >
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    disabled={idx === list.length - 1}
                    onClick={() => move.mutate({ id: c.id, dir: 1 })}
                  >
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => toggleActive.mutate(c)}
                  >
                    {c.is_active ? (
                      <Eye className="h-4 w-4" />
                    ) : (
                      <EyeOff className="h-4 w-4" />
                    )}
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => openEdit(c)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      if (confirm(`Remover "${c.label}"?`)) remove.mutate(c.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Editar categoria" : "Nova categoria"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="grid gap-3">
              <div>
                <Label>Nome</Label>
                <Input
                  value={editing.label || ""}
                  onChange={(e) => setEditing({ ...editing, label: e.target.value })}
                  placeholder="Ex: Pizza"
                />
              </div>
              <div>
                <Label>Slug (URL)</Label>
                <Input
                  value={editing.slug || ""}
                  onChange={(e) => setEditing({ ...editing, slug: e.target.value })}
                  placeholder={slugify(editing.label || "")}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Usado em /categoria/{editing.slug || slugify(editing.label || "...")}.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Ícone</Label>
                  <Select
                    value={editing.icon || "ShoppingBag"}
                    onValueChange={(v) => setEditing({ ...editing, icon: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORY_ICON_NAMES.map((n) => {
                        const Icon = getCategoryIcon(n);
                        return (
                          <SelectItem key={n} value={n}>
                            <span className="inline-flex items-center gap-2">
                              <Icon className="h-4 w-4" /> {n}
                            </span>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Cor</Label>
                  <Select
                    value={editing.tint || "bg-muted text-foreground"}
                    onValueChange={(v) => setEditing({ ...editing, tint: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORY_TINTS.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          <span className="inline-flex items-center gap-2">
                            <span className={cn("h-4 w-4 rounded", t.value)} />
                            {t.label}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="rounded-md border bg-muted/30 p-3">
                <p className="mb-2 text-xs text-muted-foreground">Pré-visualização</p>
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "grid h-14 w-14 place-items-center rounded-2xl",
                      editing.tint || "bg-muted text-foreground",
                    )}
                  >
                    {(() => {
                      const Icon = getCategoryIcon(editing.icon || "ShoppingBag");
                      return <Icon className="h-7 w-7" />;
                    })()}
                  </div>
                  <p className="text-sm font-medium">{editing.label || "Nome"}</p>
                </div>
              </div>
              <div>
                <Label>Termos para casar com lojas</Label>
                <Input
                  value={matchesText}
                  onChange={(e) => setMatchesText(e.target.value)}
                  placeholder="Ex: Pizza, Pizzaria"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Separe por vírgula. Compara com o campo "Categoria" das lojas (ignora acentos/maiúsculas).
                </p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="ecom"
                  checked={!!editing.is_ecommerce}
                  onChange={(e) =>
                    setEditing({ ...editing, is_ecommerce: e.target.checked })
                  }
                />
                <Label htmlFor="ecom">É categoria de e-commerce (vitrine)</Label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="active"
                  checked={editing.is_active ?? true}
                  onChange={(e) =>
                    setEditing({ ...editing, is_active: e.target.checked })
                  }
                />
                <Label htmlFor="active">Visível na home</Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => editing && upsert.mutate(editing)}
              disabled={!editing?.label}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
