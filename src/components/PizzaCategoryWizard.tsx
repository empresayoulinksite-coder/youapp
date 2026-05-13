import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Pizza as PizzaIcon, Plus, Trash2, Check } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type PizzaSize = {
  id: string;
  store_id: string;
  name: string;
  slices: number;
  max_flavors: number;
  position: number;
  is_active: boolean;
};
type PizzaCrust = {
  id: string;
  store_id: string;
  name: string;
  price: number;
  position: number;
  is_active: boolean;
};

type CategoryRow = {
  id?: string;
  name: string;
  is_available: boolean;
  is_pizza: boolean;
  available_days?: number[] | null;
  available_start?: string | null;
  available_end?: string | null;
};

const TABS = [
  { key: "details", label: "Detalhes" },
  { key: "size", label: "Tamanho" },
  { key: "crust", label: "Borda" },
  { key: "availability", label: "Disponibilidade" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

const WEEKDAYS = [
  { value: 0, label: "Dom" },
  { value: 1, label: "Seg" },
  { value: 2, label: "Ter" },
  { value: 3, label: "Qua" },
  { value: 4, label: "Qui" },
  { value: 5, label: "Sex" },
  { value: 6, label: "Sáb" },
];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  storeId: string;
  initial?: CategoryRow | null;
  position: number;
  onSaved?: () => void;
}

export function PizzaCategoryWizard({
  open,
  onOpenChange,
  storeId,
  initial,
  position,
  onSaved,
}: Props) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<TabKey>("details");

  const [name, setName] = useState("");
  const [isAvailable, setIsAvailable] = useState(true);
  const [days, setDays] = useState<number[]>([]);
  const [startTime, setStartTime] = useState<string>("");
  const [endTime, setEndTime] = useState<string>("");

  useEffect(() => {
    if (open) {
      setTab("details");
      setName(initial?.name ?? "");
      setIsAvailable(initial?.is_available ?? true);
      setDays(initial?.available_days ?? []);
      setStartTime(initial?.available_start?.slice(0, 5) ?? "");
      setEndTime(initial?.available_end?.slice(0, 5) ?? "");
    }
  }, [open, initial]);

  const categoryId = initial?.id ?? null;

  // ---- Sizes & Crusts (escopados por categoria) ----
  const { data: sizes = [] } = useQuery({
    queryKey: ["pizza-sizes", "cat", categoryId],
    enabled: !!categoryId && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pizza_sizes")
        .select("*")
        .eq("category_id", categoryId!)
        .order("position");
      if (error) throw error;
      return (data || []) as PizzaSize[];
    },
  });

  const { data: crusts = [] } = useQuery({
    queryKey: ["pizza-crusts", "cat", categoryId],
    enabled: !!categoryId && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pizza_crusts")
        .select("*")
        .eq("category_id", categoryId!)
        .order("position");
      if (error) throw error;
      return (data || []) as PizzaCrust[];
    },
  });

  const invalidatePizza = () => {
    qc.invalidateQueries({ queryKey: ["pizza-sizes", "cat", categoryId] });
    qc.invalidateQueries({ queryKey: ["pizza-sizes", storeId] });
    qc.invalidateQueries({ queryKey: ["pizza-crusts", "cat", categoryId] });
    qc.invalidateQueries({ queryKey: ["pizza-crusts", storeId] });
  };


  // ---- Size mutations ----
  const addSize = useMutation({
    mutationFn: async () => {
      if (!categoryId) {
        throw new Error("Salve a categoria antes de adicionar tamanhos");
      }
      const { error } = await supabase.from("pizza_sizes").insert({
        store_id: storeId,
        category_id: categoryId,
        name: "Novo tamanho",
        slices: 8,
        max_flavors: 1,
        position: sizes.length,
      });
      if (error) throw error;
    },
    onSuccess: invalidatePizza,
    onError: (e: Error) => toast.error(e.message),
  });

  const updateSize = useMutation({
    mutationFn: async (s: Partial<PizzaSize> & { id: string }) => {
      const { error } = await supabase
        .from("pizza_sizes")
        .update({
          name: s.name,
          slices: s.slices,
          max_flavors: s.max_flavors,
        })
        .eq("id", s.id);
      if (error) throw error;
    },
    onSuccess: invalidatePizza,
    onError: (e: Error) => toast.error(e.message),
  });

  const delSize = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("pizza_sizes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidatePizza,
    onError: (e: Error) => toast.error(e.message),
  });

  // ---- Crust mutations ----
  const addCrust = useMutation({
    mutationFn: async () => {
      if (!categoryId) {
        throw new Error("Salve a categoria antes de adicionar bordas");
      }
      const { error } = await supabase.from("pizza_crusts").insert({
        store_id: storeId,
        category_id: categoryId,
        name: "Nova borda",
        price: 0,
        position: crusts.length,
      });
      if (error) throw error;
    },
    onSuccess: invalidatePizza,
    onError: (e: Error) => toast.error(e.message),
  });

  const updateCrust = useMutation({
    mutationFn: async (c: Partial<PizzaCrust> & { id: string }) => {
      const { error } = await supabase
        .from("pizza_crusts")
        .update({ name: c.name, price: c.price })
        .eq("id", c.id);
      if (error) throw error;
    },
    onSuccess: invalidatePizza,
    onError: (e: Error) => toast.error(e.message),
  });

  const delCrust = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("pizza_crusts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidatePizza,
    onError: (e: Error) => toast.error(e.message),
  });

  // ---- Save category ----
  const saveCategory = useMutation({
    mutationFn: async () => {
      const payload = {
        name: name.trim(),
        is_available: isAvailable,
        is_pizza: true,
        available_days: days,
        available_start: startTime || null,
        available_end: endTime || null,
      };
      if (initial?.id) {
        const { error } = await supabase
          .from("menu_categories")
          .update(payload)
          .eq("id", initial.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("menu_categories").insert({
          store_id: storeId,
          position,
          ...payload,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Categoria salva");
      qc.invalidateQueries({ queryKey: ["admin-cats", storeId] });
      onOpenChange(false);
      onSaved?.();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const tabIndex = TABS.findIndex((t) => t.key === tab);
  const isLast = tabIndex === TABS.length - 1;
  const canContinue = tab !== "details" || name.trim().length > 0;

  const goNext = () => {
    if (isLast) {
      saveCategory.mutate();
      return;
    }
    setTab(TABS[tabIndex + 1].key);
  };
  const goBack = () => {
    if (tabIndex === 0) return;
    setTab(TABS[tabIndex - 1].key);
  };

  const toggleDay = (d: number) => {
    setDays((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort(),
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto p-0">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle className="text-2xl font-bold">
            {initial?.id ? "Editar categoria" : "Nova categoria"}
          </DialogTitle>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex gap-6 border-b px-6">
          {TABS.map((t) => {
            const active = t.key === tab;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={cn(
                  "relative py-3 text-sm font-medium transition-colors",
                  active
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t.label}
                {active && (
                  <span className="absolute inset-x-0 -bottom-px h-0.5 bg-primary" />
                )}
              </button>
            );
          })}
        </div>

        <div className="px-6 py-5">
          {tab === "details" && (
            <div className="space-y-5">
              <div>
                <h3 className="text-lg font-semibold">Detalhes</h3>
                <p className="text-sm text-muted-foreground">
                  Preencha as informações da nova categoria.
                </p>
              </div>

              <div className="rounded-lg border p-3">
                <Label className="text-xs text-muted-foreground">
                  Tipo da categoria
                </Label>
                <div className="mt-1 flex items-center gap-3">
                  <PizzaIcon className="h-5 w-5 text-primary" />
                  <span className="font-semibold">Pizza</span>
                </div>
              </div>

              <div>
                <Label>Nome da categoria</Label>
                <Input
                  value={name}
                  maxLength={40}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Pizzas Salgadas"
                />
                <p className="mt-1 text-right text-xs text-muted-foreground">
                  {name.length}/40
                </p>
              </div>
            </div>
          )}

          {tab === "size" && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold">Tamanho</h3>
                <p className="text-sm text-muted-foreground">
                  Indique os tamanhos que suas pizzas são produzidas, em quantos
                  pedaços são cortadas e até quantos sabores cada tamanho aceita.
                </p>
              </div>

              {!categoryId ? (
                <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
                  Salve a categoria primeiro para cadastrar tamanhos exclusivos dela.
                </p>
              ) : (
                <>
                  <div className="space-y-3">
                    {sizes.map((s) => (
                      <SizeRow
                        key={s.id}
                        size={s}
                        onUpdate={(patch) =>
                          updateSize.mutate({ id: s.id, ...patch })
                        }
                        onDelete={() => {
                          if (confirm(`Excluir tamanho "${s.name}"?`))
                            delSize.mutate(s.id);
                        }}
                      />
                    ))}
                    {sizes.length === 0 && (
                      <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
                        Nenhum tamanho cadastrado.
                      </p>
                    )}
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => addSize.mutate()}
                    className="w-full"
                  >
                    <Plus className="h-4 w-4" /> Adicionar tamanho
                  </Button>
                </>
              )}
            </div>
          )}

          {tab === "crust" && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold">Borda</h3>
                <p className="text-sm text-muted-foreground">
                  Cadastre as bordas recheadas que o cliente pode escolher nesta categoria.
                </p>
                {!categoryId && (
                  <p className="mt-2 rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                    Salve a categoria primeiro (botão <strong>Concluir</strong>) para poder cadastrar bordas exclusivas dela.
                  </p>
                )}
              </div>

              <div className="space-y-3">
                {crusts.map((c) => (
                  <CrustRow
                    key={c.id}
                    crust={c}
                    onUpdate={(patch) =>
                      updateCrust.mutate({ id: c.id, ...patch })
                    }
                    onDelete={() => {
                      if (confirm(`Excluir borda "${c.name}"?`))
                        delCrust.mutate(c.id);
                    }}
                  />
                ))}
                {crusts.length === 0 && (
                  <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
                    Nenhuma borda cadastrada.
                  </p>
                )}
              </div>

              <Button
                type="button"
                variant="outline"
                onClick={() => addCrust.mutate()}
                className="w-full"
              >
                <Plus className="h-4 w-4" /> Adicionar borda
              </Button>
            </div>
          )}

          {tab === "availability" && (
            <div className="space-y-5">
              <div>
                <h3 className="text-lg font-semibold">Disponibilidade</h3>
                <p className="text-sm text-muted-foreground">
                  Defina em quais dias e horários esta categoria fica visível
                  para o cliente.
                </p>
              </div>

              <div className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <p className="text-sm font-medium">Categoria ativa</p>
                  <p className="text-xs text-muted-foreground">
                    Pausar oculta a categoria do cardápio.
                  </p>
                </div>
                <Switch checked={isAvailable} onCheckedChange={setIsAvailable} />
              </div>

              <div>
                <Label className="mb-2 block">Dias da semana</Label>
                <div className="flex flex-wrap gap-2">
                  {WEEKDAYS.map((d) => {
                    const active = days.includes(d.value);
                    return (
                      <button
                        key={d.value}
                        type="button"
                        onClick={() => toggleDay(d.value)}
                        className={cn(
                          "h-10 min-w-12 rounded-full border px-3 text-sm font-medium transition-colors",
                          active
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-input bg-background hover:bg-accent",
                        )}
                      >
                        {d.label}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Sem dias selecionados = disponível todos os dias.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Início</Label>
                  <Input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Fim</Label>
                  <Input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Deixe em branco para disponibilidade 24h.
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t bg-muted/30 px-6 py-4">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <div className="flex gap-2">
            {tabIndex > 0 && (
              <Button type="button" variant="outline" onClick={goBack}>
                Voltar
              </Button>
            )}
            <Button
              type="button"
              onClick={goNext}
              disabled={!canContinue || saveCategory.isPending}
            >
              {isLast ? (
                <>
                  <Check className="h-4 w-4" /> Salvar categoria
                </>
              ) : (
                "Continuar"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SizeRow({
  size,
  onUpdate,
  onDelete,
}: {
  size: PizzaSize;
  onUpdate: (patch: Partial<PizzaSize>) => void;
  onDelete: () => void;
}) {
  const [name, setName] = useState(size.name);
  const [slices, setSlices] = useState(size.slices);
  const [maxFlavors, setMaxFlavors] = useState(size.max_flavors);

  useEffect(() => {
    setName(size.name);
    setSlices(size.slices);
    setMaxFlavors(size.max_flavors);
  }, [size.id, size.name, size.slices, size.max_flavors]);

  const flavorOptions = [1, 2, 3, 4];

  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="grid gap-3 md:grid-cols-[1fr_110px_auto_auto] md:items-end">
        <div>
          <Label className="text-xs">Nome do tamanho</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => {
              if (name !== size.name) onUpdate({ name });
            }}
            placeholder="Ex: Pequena"
          />
        </div>
        <div>
          <Label className="text-xs">Qtd. Pedaços</Label>
          <Input
            type="number"
            min={1}
            value={slices}
            onChange={(e) => setSlices(Number(e.target.value) || 0)}
            onBlur={() => {
              if (slices !== size.slices) onUpdate({ slices });
            }}
          />
        </div>
        <div>
          <Label className="text-xs">Qtd. Sabores</Label>
          <div className="mt-1 flex gap-1.5">
            {flavorOptions.map((n) => {
              const active = maxFlavors === n;
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => {
                    setMaxFlavors(n);
                    onUpdate({ max_flavors: n });
                  }}
                  className={cn(
                    "h-9 w-9 rounded-full text-sm font-semibold transition-colors",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-accent",
                  )}
                >
                  {n}
                </button>
              );
            })}
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onDelete}
          className="text-destructive hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function CrustRow({
  crust,
  onUpdate,
  onDelete,
}: {
  crust: PizzaCrust;
  onUpdate: (patch: Partial<PizzaCrust>) => void;
  onDelete: () => void;
}) {
  const [name, setName] = useState(crust.name);
  const [price, setPrice] = useState<number>(crust.price);

  useEffect(() => {
    setName(crust.name);
    setPrice(crust.price);
  }, [crust.id, crust.name, crust.price]);

  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="grid gap-3 md:grid-cols-[1fr_140px_auto] md:items-end">
        <div>
          <Label className="text-xs">Nome da borda</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => {
              if (name !== crust.name) onUpdate({ name });
            }}
            placeholder="Ex: Catupiry"
          />
        </div>
        <div>
          <Label className="text-xs">Preço (R$)</Label>
          <Input
            type="number"
            step="0.01"
            value={price}
            onChange={(e) => setPrice(Number(e.target.value) || 0)}
            onBlur={() => {
              if (price !== crust.price) onUpdate({ price });
            }}
          />
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onDelete}
          className="text-destructive hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
