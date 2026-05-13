import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Pizza as PizzaIcon } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";

export const Route = createFileRoute("/admin/pizzas")({
  validateSearch: (search: Record<string, unknown>): { storeId?: string } => ({
    storeId: typeof search.storeId === "string" ? search.storeId : undefined,
  }),
  component: AdminPizzasRoute,
});

function AdminPizzasRoute() {
  const { storeId: presetStoreId } = Route.useSearch();
  return <AdminPizzas presetStoreId={presetStoreId} />;
}

export function AdminPizzasEmbedded({ storeId }: { storeId: string }) {
  return <AdminPizzas presetStoreId={storeId} embedded />;
}

type Store = { id: string; name: string; emoji: string; store_type: string };
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
type PizzaAddon = {
  id: string;
  store_id: string;
  name: string;
  price: number;
  position: number;
  is_active: boolean;
};
type PizzaCategory = {
  id: string;
  name: string;
  store_id: string;
  is_pizza: boolean;
};
type PizzaItem = {
  id: string;
  name: string;
  category_id: string;
  emoji: string;
};
type SizePrice = {
  id?: string;
  menu_item_id: string;
  pizza_size_id: string;
  price: number;
  is_available: boolean;
};

function AdminPizzas({ presetStoreId, embedded = false }: { presetStoreId?: string; embedded?: boolean }) {
  const [storeId, setStoreId] = useState<string>(presetStoreId ?? "");
  const qc = useQueryClient();

  const { data: stores = [] } = useQuery({
    queryKey: ["admin-pizzas-stores"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stores")
        .select("id, name, emoji, store_type")
        .order("name");
      if (error) throw error;
      return (data || []) as Store[];
    },
  });

  const selectedStore = stores.find((s) => s.id === storeId);

  return (
    <div className="space-y-6">
      {!embedded && (
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <PizzaIcon className="h-6 w-6" /> Pizzas
          </h1>
          <p className="text-sm text-muted-foreground">
            Configure tamanhos, preços por sabor, bordas e adicionais — estilo iFood.
          </p>
        </div>
      )}

      {!embedded && (
        <div className="max-w-md">
          <Label>Loja</Label>
          <Select value={storeId} onValueChange={setStoreId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione uma loja" />
            </SelectTrigger>
            <SelectContent>
              {stores.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.emoji} {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {storeId && selectedStore && (
        <Tabs defaultValue="sizes" className="space-y-4">
          <TabsList>
            <TabsTrigger value="sizes">Tamanhos</TabsTrigger>
            <TabsTrigger value="prices">Preços por sabor</TabsTrigger>
            <TabsTrigger value="crusts">Bordas</TabsTrigger>
            <TabsTrigger value="addons">Adicionais</TabsTrigger>
          </TabsList>

          <TabsContent value="sizes">
            <SizesTab storeId={storeId} qc={qc} />
          </TabsContent>
          <TabsContent value="prices">
            <PricesTab storeId={storeId} qc={qc} />
          </TabsContent>
          <TabsContent value="crusts">
            <CrustsTab storeId={storeId} qc={qc} />
          </TabsContent>
          <TabsContent value="addons">
            <AddonsTab storeId={storeId} qc={qc} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

/* ====================== TAMANHOS ====================== */
function SizesTab({ storeId, qc }: { storeId: string; qc: ReturnType<typeof useQueryClient> }) {
  const [editing, setEditing] = useState<Partial<PizzaSize> | null>(null);

  const { data: sizes = [] } = useQuery({
    queryKey: ["pizza-sizes", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pizza_sizes")
        .select("*")
        .eq("store_id", storeId)
        .order("position");
      if (error) throw error;
      return (data || []) as PizzaSize[];
    },
  });

  const save = useMutation({
    mutationFn: async (s: Partial<PizzaSize>) => {
      if (s.id) {
        const { error } = await supabase
          .from("pizza_sizes")
          .update({
            name: s.name,
            slices: s.slices,
            max_flavors: s.max_flavors,
            position: s.position ?? 0,
            is_active: s.is_active ?? true,
          })
          .eq("id", s.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("pizza_sizes").insert({
          store_id: storeId,
          name: s.name!,
          slices: s.slices ?? 8,
          max_flavors: s.max_flavors ?? 1,
          position: sizes.length,
          is_active: true,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Tamanho salvo");
      qc.invalidateQueries({ queryKey: ["pizza-sizes", storeId] });
      setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("pizza_sizes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Tamanho removido");
      qc.invalidateQueries({ queryKey: ["pizza-sizes", storeId] });
    },
  });

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button onClick={() => setEditing({ name: "", slices: 8, max_flavors: 1 })}>
          <Plus className="mr-2 h-4 w-4" /> Novo tamanho
        </Button>
      </div>

      <div className="space-y-2">
        {sizes.map((s) => (
          <div key={s.id} className="flex items-center justify-between rounded-lg border bg-background p-3">
            <div>
              <div className="font-medium">{s.name}</div>
              <div className="text-xs text-muted-foreground">
                {s.slices} fatias · até {s.max_flavors} sabor{s.max_flavors > 1 ? "es" : ""}
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="icon" variant="ghost" onClick={() => setEditing(s)}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => remove.mutate(s.id)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </div>
        ))}
        {sizes.length === 0 && (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            Nenhum tamanho cadastrado. Crie por exemplo: Broto (4 fatias, 1 sabor), Média (6, 2), Grande (8, 3).
          </p>
        )}
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Editar tamanho" : "Novo tamanho"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div>
                <Label>Nome</Label>
                <Input
                  value={editing.name || ""}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  placeholder="Broto, Média, Grande..."
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Fatias</Label>
                  <Input
                    type="number"
                    min={1}
                    value={editing.slices ?? 8}
                    onChange={(e) => setEditing({ ...editing, slices: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <Label>Máx. sabores</Label>
                  <Input
                    type="number"
                    min={1}
                    max={8}
                    value={editing.max_flavors ?? 1}
                    onChange={(e) => setEditing({ ...editing, max_flavors: Number(e.target.value) })}
                  />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button
              onClick={() => editing && save.mutate(editing)}
              disabled={!editing?.name?.trim()}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ====================== PREÇOS POR SABOR x TAMANHO ====================== */
function PricesTab({ storeId, qc }: { storeId: string; qc: ReturnType<typeof useQueryClient> }) {
  const { data: sizes = [] } = useQuery({
    queryKey: ["pizza-sizes", storeId],
    queryFn: async () => {
      const { data } = await supabase
        .from("pizza_sizes")
        .select("*")
        .eq("store_id", storeId)
        .eq("is_active", true)
        .order("position");
      return (data || []) as PizzaSize[];
    },
  });

  const { data: pizzaCategories = [] } = useQuery({
    queryKey: ["pizza-categories", storeId],
    queryFn: async () => {
      const { data } = await supabase
        .from("menu_categories")
        .select("id, name, store_id, is_pizza")
        .eq("store_id", storeId)
        .eq("is_pizza", true);
      return (data || []) as PizzaCategory[];
    },
  });

  const categoryIds = pizzaCategories.map((c) => c.id);

  const { data: items = [] } = useQuery({
    queryKey: ["pizza-items", storeId, categoryIds.join(",")],
    queryFn: async () => {
      if (categoryIds.length === 0) return [] as PizzaItem[];
      const { data } = await supabase
        .from("menu_items")
        .select("id, name, category_id, emoji")
        .in("category_id", categoryIds)
        .order("position");
      return (data || []) as PizzaItem[];
    },
    enabled: categoryIds.length > 0,
  });

  const itemIds = items.map((i) => i.id);
  const { data: prices = [], refetch } = useQuery({
    queryKey: ["pizza-size-prices", itemIds.join(",")],
    queryFn: async () => {
      if (itemIds.length === 0) return [] as SizePrice[];
      const { data } = await supabase
        .from("menu_item_size_prices")
        .select("*")
        .in("menu_item_id", itemIds);
      return (data || []) as SizePrice[];
    },
    enabled: itemIds.length > 0,
  });

  const getPrice = (itemId: string, sizeId: string) =>
    prices.find((p) => p.menu_item_id === itemId && p.pizza_size_id === sizeId);

  const setPrice = useMutation({
    mutationFn: async ({ itemId, sizeId, value }: { itemId: string; sizeId: string; value: number }) => {
      const existing = getPrice(itemId, sizeId);
      if (existing?.id) {
        const { error } = await supabase
          .from("menu_item_size_prices")
          .update({ price: value })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("menu_item_size_prices").insert({
          menu_item_id: itemId,
          pizza_size_id: sizeId,
          price: value,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => refetch(),
  });

  if (pizzaCategories.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        Nenhuma categoria está marcada como “categoria de pizza”. Vá em <strong>Produtos</strong> e ative o switch
        <em> Categoria de pizza 🍕</em> nas categorias desejadas.
      </div>
    );
  }

  if (sizes.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        Cadastre pelo menos um tamanho na aba <strong>Tamanhos</strong>.
      </div>
    );
  }

  return (
    <div className="overflow-auto">
      <table className="w-full min-w-[600px] border-collapse text-sm">
        <thead>
          <tr className="border-b bg-muted/40">
            <th className="p-2 text-left">Sabor</th>
            {sizes.map((s) => (
              <th key={s.id} className="p-2 text-center">{s.name}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="border-b">
              <td className="p-2">
                <span className="mr-1">{item.emoji}</span>
                {item.name}
              </td>
              {sizes.map((s) => {
                const cur = getPrice(item.id, s.id);
                return (
                  <td key={s.id} className="p-1 text-center">
                    <Input
                      type="number"
                      step="0.01"
                      min={0}
                      defaultValue={cur?.price ?? ""}
                      placeholder="0,00"
                      className="h-8 w-24 text-center"
                      onBlur={(e) => {
                        const v = Number(e.target.value);
                        if (!isNaN(v) && v !== (cur?.price ?? -1)) {
                          setPrice.mutate({ itemId: item.id, sizeId: s.id, value: v });
                        }
                      }}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
          {items.length === 0 && (
            <tr>
              <td colSpan={sizes.length + 1} className="p-6 text-center text-muted-foreground">
                Nenhum sabor cadastrado nas categorias de pizza desta loja.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/* ====================== BORDAS ====================== */
function CrustsTab({ storeId, qc }: { storeId: string; qc: ReturnType<typeof useQueryClient> }) {
  return <CategoryScopedListEditor
    storeId={storeId}
    qc={qc}
    table="pizza_crusts"
    keyName="pizza-crusts"
    labelSingular="borda"
    labelPlural="bordas"
    placeholder="Catupiry, Cheddar, Cream cheese..."
  />;
}

/* ====================== ADICIONAIS ====================== */
function AddonsTab({ storeId, qc }: { storeId: string; qc: ReturnType<typeof useQueryClient> }) {
  return <CategoryScopedListEditor
    storeId={storeId}
    qc={qc}
    table="pizza_addons"
    keyName="pizza-addons"
    labelSingular="adicional"
    labelPlural="adicionais"
    placeholder="Catupiry extra, Bacon, Cheddar extra..."
  />;
}

type SimpleRow = { id: string; store_id: string; category_id: string; name: string; price: number; position: number; is_active: boolean };

function CategoryScopedListEditor(props: {
  storeId: string;
  qc: ReturnType<typeof useQueryClient>;
  table: "pizza_crusts" | "pizza_addons";
  keyName: string;
  labelSingular: string;
  labelPlural: string;
  placeholder: string;
}) {
  const { storeId, labelPlural } = props;
  const { data: pizzaCategories = [] } = useQuery({
    queryKey: ["pizza-categories", storeId],
    queryFn: async () => {
      const { data } = await supabase
        .from("menu_categories")
        .select("id, name, store_id, is_pizza")
        .eq("store_id", storeId)
        .eq("is_pizza", true)
        .order("position");
      return (data || []) as PizzaCategory[];
    },
  });

  const [categoryId, setCategoryId] = useState<string>("");
  const effectiveCategoryId = categoryId || pizzaCategories[0]?.id || "";

  if (pizzaCategories.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        Nenhuma categoria de pizza nesta loja. Vá em <strong>Produtos</strong> e ative o switch
        <em> Categoria de pizza 🍕</em> em alguma categoria para cadastrar {labelPlural}.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {pizzaCategories.length > 1 && (
        <div className="max-w-md">
          <Label>Categoria de pizza</Label>
          <Select value={effectiveCategoryId} onValueChange={setCategoryId}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {pizzaCategories.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="mt-1 text-xs text-muted-foreground">
            As {labelPlural} cadastradas valem só para esta categoria.
          </p>
        </div>
      )}
      {effectiveCategoryId && (
        <SimpleListEditor {...props} categoryId={effectiveCategoryId} />
      )}
    </div>
  );
}

function SimpleListEditor({
  storeId,
  qc,
  table,
  keyName,
  labelSingular,
  labelPlural,
  placeholder,
  categoryId,
}: {
  storeId: string;
  qc: ReturnType<typeof useQueryClient>;
  table: "pizza_crusts" | "pizza_addons";
  keyName: string;
  labelSingular: string;
  labelPlural: string;
  placeholder: string;
  categoryId: string;
}) {
  const [editing, setEditing] = useState<Partial<SimpleRow> | null>(null);

  const { data: rows = [] } = useQuery({
    queryKey: [keyName, storeId, categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from(table)
        .select("*")
        .eq("category_id", categoryId)
        .order("position");
      if (error) throw error;
      return (data || []) as SimpleRow[];
    },
  });

  const save = useMutation({
    mutationFn: async (r: Partial<SimpleRow>) => {
      if (r.id) {
        const { error } = await supabase
          .from(table)
          .update({ name: r.name, price: r.price ?? 0, is_active: r.is_active ?? true })
          .eq("id", r.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from(table).insert({
          store_id: storeId,
          category_id: categoryId,
          name: r.name!,
          price: r.price ?? 0,
          position: rows.length,
          is_active: true,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Salvo");
      qc.invalidateQueries({ queryKey: [keyName, storeId, categoryId] });
      setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(table).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Removido");
      qc.invalidateQueries({ queryKey: [keyName, storeId] });
    },
  });

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button onClick={() => setEditing({ name: "", price: 0 })}>
          <Plus className="mr-2 h-4 w-4" /> Nova {labelSingular}
        </Button>
      </div>

      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.id} className="flex items-center justify-between rounded-lg border bg-background p-3">
            <div>
              <div className="font-medium">{r.name}</div>
              <div className="text-xs text-muted-foreground">
                R$ {Number(r.price).toFixed(2).replace(".", ",")}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={r.is_active}
                onCheckedChange={(v) => save.mutate({ ...r, is_active: v })}
              />
              <Button size="icon" variant="ghost" onClick={() => setEditing(r)}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => remove.mutate(r.id)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </div>
        ))}
        {rows.length === 0 && (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            Nenhuma {labelSingular} cadastrada.
          </p>
        )}
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing?.id ? `Editar ${labelSingular}` : `Nova ${labelSingular}`}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div>
                <Label>Nome</Label>
                <Input
                  value={editing.name || ""}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  placeholder={placeholder}
                />
              </div>
              <div>
                <Label>Preço (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min={0}
                  value={editing.price ?? 0}
                  onChange={(e) => setEditing({ ...editing, price: Number(e.target.value) })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button
              onClick={() => editing && save.mutate(editing)}
              disabled={!editing?.name?.trim()}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
