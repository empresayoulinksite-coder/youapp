import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Pencil,
  Trash2,
  FolderPlus,
  Search,
  GripVertical,
  Pause,
  Play,
  ChevronDown,
  ChevronRight,
  X,
  Upload,
  Pizza,
  Copy,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { supabase } from "@/integrations/supabase/client";
import { BackToStoreEditor } from "@/components/BackToStoreEditor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
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
import { PizzaCategoryWizard } from "@/components/PizzaCategoryWizard";
import { BulkEditAIDialog } from "@/components/BulkEditAIDialog";

export const Route = createFileRoute("/admin/produtos")({
  validateSearch: (search: Record<string, unknown>): { storeId?: string } => ({
    storeId: typeof search.storeId === "string" ? search.storeId : undefined,
  }),
  component: AdminProductsRoute,
});

function AdminProductsRoute() {
  const { storeId: presetStoreId } = Route.useSearch();
  return <AdminProducts presetStoreId={presetStoreId} />;
}

export function AdminProductsEmbedded({ storeId }: { storeId: string }) {
  return <AdminProducts presetStoreId={storeId} embedded />;
}

type Variation = {
  id?: string;
  menu_item_id?: string;
  name: string;
  price: number;
  original_price: number | null;
  position: number;
  is_available: boolean;
  _isNew?: boolean;
};

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
  is_available: boolean;
  sizes: string[];
  colors: string[];
};

type Category = {
  id: string;
  store_id: string;
  name: string;
  position: number;
  is_available: boolean;
  is_pizza: boolean;
  available_days?: number[] | null;
  available_start?: string | null;
  available_end?: string | null;
};

type StoreType = "food" | "ecommerce" | "service";
const STORE_TYPE_TABS: { value: StoreType; label: string }[] = [
  { value: "food", label: "Food" },
  { value: "ecommerce", label: "E-commerce" },
  { value: "service", label: "Serviços" },
];

function AdminProducts({ presetStoreId, embedded = false }: { presetStoreId?: string; embedded?: boolean }) {
  const qc = useQueryClient();
  const [storeType, setStoreType] = useState<StoreType>("food");
  const [storeId, setStoreId] = useState<string>(presetStoreId ?? "");
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState<string>("all");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<MenuItem> | null>(null);
  const [editingVars, setEditingVars] = useState<Variation[]>([]);
  const [sizesInput, setSizesInput] = useState<string>("");
  const [colorsInput, setColorsInput] = useState<string>("");
  const [editingPizzaPrices, setEditingPizzaPrices] = useState<
    Record<string, string>
  >({});
  const [uploading, setUploading] = useState(false);

  const [catOpen, setCatOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<Partial<Category> | null>(null);
  const [pizzaWizardOpen, setPizzaWizardOpen] = useState(false);
  const [pizzaWizardInitial, setPizzaWizardInitial] = useState<Category | null>(null);
  const [aiBulkOpen, setAiBulkOpen] = useState(false);

  const { data: stores = [] } = useQuery({
    queryKey: ["admin-stores-list", storeType],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stores")
        .select("id,name,store_type,category,is_pizzeria")
        .eq("store_type", storeType)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Quando chegamos com ?storeId=..., descobrir o store_type da loja para alinhar o filtro
  useEffect(() => {
    if (!presetStoreId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("stores")
        .select("store_type")
        .eq("id", presetStoreId)
        .maybeSingle();
      if (!cancelled && data?.store_type) {
        setStoreType(data.store_type as StoreType);
        setStoreId(presetStoreId);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [presetStoreId]);

  const currentStore = stores.find((s) => s.id === storeId);
  const isPizzeria = !!currentStore && (currentStore.is_pizzeria === true || currentStore.category === "Pizza");

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
      return data as Category[];
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

  const { data: variationsByItem = {} } = useQuery({
    queryKey: ["admin-variations", storeId, items.map((i) => i.id).join(",")],
    enabled: !!storeId && items.length > 0,
    queryFn: async () => {
      const ids = items.map((i) => i.id);
      const { data, error } = await supabase
        .from("menu_item_variations")
        .select("*")
        .in("menu_item_id", ids)
        .order("position");
      if (error) throw error;
      const map: Record<string, Variation[]> = {};
      (data as Variation[]).forEach((v) => {
        const k = v.menu_item_id!;
        (map[k] ||= []).push(v);
      });
      return map;
    },
  });

  const { data: pizzaPriceByItem = {} } = useQuery({
    queryKey: ["admin-size-prices", storeId, items.map((i) => i.id).join(",")],
    enabled: !!storeId && items.length > 0,
    queryFn: async () => {
      const ids = items.map((i) => i.id);
      const { data, error } = await supabase
        .from("menu_item_size_prices")
        .select("menu_item_id,price")
        .in("menu_item_id", ids);
      if (error) throw error;
      const map: Record<string, number> = {};
      (data ?? []).forEach((p) => {
        const cur = map[p.menu_item_id] ?? 0;
        const v = Number(p.price) || 0;
        if (v > cur) map[p.menu_item_id] = v;
      });
      return map;
    },
  });

  const { data: allPizzaSizes = [] } = useQuery({
    queryKey: ["admin-pizza-sizes", storeId],
    enabled: !!storeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pizza_sizes")
        .select("id,name,position,category_id")
        .eq("store_id", storeId)
        .eq("is_active", true)
        .order("position");
      if (error) throw error;
      return data as { id: string; name: string; position: number; category_id: string }[];
    },
  });

  const sizesByCategory = (categoryId: string | null | undefined) =>
    categoryId ? allPizzaSizes.filter((s) => s.category_id === categoryId) : [];

  // ---------- Mutations ----------
  const saveCategory = useMutation({
    mutationFn: async (c: Partial<Category>) => {
      if (c.id) {
        const { error } = await supabase
          .from("menu_categories")
          .update({
            name: c.name!,
            is_available: c.is_available ?? true,
            is_pizza: c.is_pizza ?? false,
          })
          .eq("id", c.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("menu_categories").insert({
          store_id: storeId,
          name: c.name!,
          position: categories.length,
          is_pizza: c.is_pizza ?? false,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Categoria salva");
      qc.invalidateQueries({ queryKey: ["admin-cats", storeId] });
      setCatOpen(false);
      setEditingCat(null);
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

  const toggleCategoryAvailable = useMutation({
    mutationFn: async (c: Category) => {
      const { error } = await supabase
        .from("menu_categories")
        .update({ is_available: !c.is_available })
        .eq("id", c.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-cats", storeId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const patchCategory = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await supabase
        .from("menu_categories")
        .update({ name })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-cats", storeId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const reorderCategories = useMutation({
    mutationFn: async (ordered: Category[]) => {
      await Promise.all(
        ordered.map((c, idx) =>
          supabase.from("menu_categories").update({ position: idx }).eq("id", c.id),
        ),
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-cats", storeId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const saveItem = useMutation({
    mutationFn: async ({
      m,
      vars,
      pizzaPrices,
    }: {
      m: Partial<MenuItem>;
      vars: Variation[];
      pizzaPrices: Record<string, string>;
    }) => {
      const cat = categories.find((c) => c.id === m.category_id);
      const pizzaSizes = sizesByCategory(m.category_id);
      const isPizza = !!cat?.is_pizza && pizzaSizes.length > 0;
      const pizzaAutoPrice = isPizza
        ? Math.max(
            0,
            ...pizzaSizes
              .map((s) => Number(pizzaPrices[s.id]))
              .filter((n) => !isNaN(n) && n > 0),
          )
        : 0;
      const payload = {
        store_id: storeId,
        category_id: m.category_id!,
        name: m.name!,
        description: m.description || null,
        price: isPizza ? pizzaAutoPrice : Number(m.price) || 0,
        original_price: m.original_price ? Number(m.original_price) : null,
        promo: m.promo || null,
        emoji: m.emoji || (isPizzeria ? "🍕" : "🍽️"),
        image_url: m.image_url || null,
        position: Number(m.position) || 0,
        is_available: m.is_available ?? true,
        sizes: Array.isArray(m.sizes) ? m.sizes.filter((s) => s.trim()) : [],
        colors: Array.isArray(m.colors) ? m.colors.filter((s) => s.trim()) : [],
      };

      let itemId = m.id;
      if (itemId) {
        const { error } = await supabase
          .from("menu_items")
          .update(payload)
          .eq("id", itemId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("menu_items")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw error;
        itemId = data.id;
      }

      // Sincroniza variações
      const existing = variationsByItem[itemId!] || [];
      const keptIds = vars.filter((v) => v.id).map((v) => v.id!);
      const toDelete = existing.filter((v) => !keptIds.includes(v.id!)).map((v) => v.id!);
      if (toDelete.length) {
        await supabase.from("menu_item_variations").delete().in("id", toDelete);
      }
      for (let i = 0; i < vars.length; i++) {
        const v = vars[i];
        const data = {
          menu_item_id: itemId!,
          name: v.name,
          price: Number(v.price) || 0,
          original_price: v.original_price ? Number(v.original_price) : null,
          position: i,
          is_available: v.is_available,
        };
        if (v.id && !v._isNew) {
          await supabase.from("menu_item_variations").update(data).eq("id", v.id);
        } else {
          await supabase.from("menu_item_variations").insert(data);
        }
      }

      // Sincroniza preços por tamanho (pizzas)
      if (isPizza) {
        const { data: existingPrices } = await supabase
          .from("menu_item_size_prices")
          .select("id,pizza_size_id")
          .eq("menu_item_id", itemId!);
        const byId = new Map(
          (existingPrices ?? []).map((p) => [p.pizza_size_id, p.id]),
        );
        for (const size of pizzaSizes) {
          const raw = pizzaPrices[size.id];
          const num = raw === "" || raw === undefined ? null : Number(raw);
          const existsId = byId.get(size.id);
          if (num === null || isNaN(num)) {
            if (existsId) {
              await supabase
                .from("menu_item_size_prices")
                .delete()
                .eq("id", existsId);
            }
            continue;
          }
          if (existsId) {
            await supabase
              .from("menu_item_size_prices")
              .update({ price: num })
              .eq("id", existsId);
          } else {
            await supabase.from("menu_item_size_prices").insert({
              menu_item_id: itemId!,
              pizza_size_id: size.id,
              price: num,
            });
          }
        }
      }
    },
    onSuccess: () => {
      toast.success("Produto salvo");
      qc.invalidateQueries({ queryKey: ["admin-items", storeId] });
      qc.invalidateQueries({ queryKey: ["admin-variations"] });
      qc.invalidateQueries({ queryKey: ["admin-size-prices"] });
      qc.invalidateQueries({ queryKey: ["pizza-size-prices"] });
      setOpen(false);
      setEditing(null);
      setEditingVars([]);
      setEditingPizzaPrices({});
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delItem = useMutation({
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

  const patchItem = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<MenuItem> }) => {
      const { error } = await supabase.from("menu_items").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-items", storeId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const patchVariation = useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string;
      patch: { price?: number; original_price?: number | null; name?: string; is_available?: boolean };
    }) => {
      const { error } = await supabase.from("menu_item_variations").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-variations", storeId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const duplicateCategory = useMutation({
    mutationFn: async (cat: Category) => {
      const { data: newCat, error } = await supabase
        .from("menu_categories")
        .insert({
          store_id: storeId,
          name: `${cat.name} (cópia)`,
          position: categories.length,
          is_available: cat.is_available,
          is_pizza: cat.is_pizza,
          ...(cat.available_days ? { available_days: cat.available_days } : {}),
          ...(cat.available_start ? { available_start: cat.available_start } : {}),
          ...(cat.available_end ? { available_end: cat.available_end } : {}),
        })
        .select("id")
        .single();
      if (error) throw error;

      const catItems = items.filter((i) => i.category_id === cat.id);
      for (let idx = 0; idx < catItems.length; idx++) {
        const it = catItems[idx];
        const { data: newItem, error: e1 } = await supabase
          .from("menu_items")
          .insert({
            store_id: storeId,
            category_id: newCat.id,
            name: it.name,
            description: it.description,
            price: it.price,
            original_price: it.original_price,
            promo: it.promo,
            emoji: it.emoji,
            image_url: it.image_url,
            position: idx,
            is_available: it.is_available,
            sizes: it.sizes ?? [],
            colors: it.colors ?? [],
          })
          .select("id")
          .single();
        if (e1) throw e1;

        const vars = variationsByItem[it.id] || [];
        if (vars.length) {
          await supabase.from("menu_item_variations").insert(
            vars.map((v, i) => ({
              menu_item_id: newItem.id,
              name: v.name,
              price: v.price,
              original_price: v.original_price,
              position: i,
              is_available: v.is_available,
            })),
          );
        }

        const { data: pizzaPrices } = await supabase
          .from("menu_item_size_prices")
          .select("pizza_size_id,price,is_available")
          .eq("menu_item_id", it.id);
        if (pizzaPrices?.length) {
          await supabase.from("menu_item_size_prices").insert(
            pizzaPrices.map((p) => ({
              menu_item_id: newItem.id,
              pizza_size_id: p.pizza_size_id,
              price: p.price,
              is_available: p.is_available,
            })),
          );
        }
      }
    },
    onSuccess: () => {
      toast.success("Categoria duplicada");
      qc.invalidateQueries({ queryKey: ["admin-cats", storeId] });
      qc.invalidateQueries({ queryKey: ["admin-items", storeId] });
      qc.invalidateQueries({ queryKey: ["admin-variations"] });
      qc.invalidateQueries({ queryKey: ["admin-size-prices"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const duplicateItem = useMutation({
    mutationFn: async (it: MenuItem) => {
      const sameCat = items.filter((i) => i.category_id === it.category_id);
      const { data: newItem, error } = await supabase
        .from("menu_items")
        .insert({
          store_id: storeId,
          category_id: it.category_id,
          name: `${it.name} (cópia)`,
          description: it.description,
          price: it.price,
          original_price: it.original_price,
          promo: it.promo,
          emoji: it.emoji,
          image_url: it.image_url,
          position: sameCat.length,
          is_available: it.is_available,
          sizes: it.sizes ?? [],
          colors: it.colors ?? [],
        })
        .select("id")
        .single();
      if (error) throw error;

      const vars = variationsByItem[it.id] || [];
      if (vars.length) {
        await supabase.from("menu_item_variations").insert(
          vars.map((v, i) => ({
            menu_item_id: newItem.id,
            name: v.name,
            price: v.price,
            original_price: v.original_price,
            position: i,
            is_available: v.is_available,
          })),
        );
      }

      const { data: pizzaPrices } = await supabase
        .from("menu_item_size_prices")
        .select("pizza_size_id,price,is_available")
        .eq("menu_item_id", it.id);
      if (pizzaPrices?.length) {
        await supabase.from("menu_item_size_prices").insert(
          pizzaPrices.map((p) => ({
            menu_item_id: newItem.id,
            pizza_size_id: p.pizza_size_id,
            price: p.price,
            is_available: p.is_available,
          })),
        );
      }
    },
    onSuccess: () => {
      toast.success("Produto duplicado");
      qc.invalidateQueries({ queryKey: ["admin-items", storeId] });
      qc.invalidateQueries({ queryKey: ["admin-variations"] });
      qc.invalidateQueries({ queryKey: ["admin-size-prices"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleItemAvailable = useMutation({
    mutationFn: async (m: MenuItem) => {
      const { error } = await supabase
        .from("menu_items")
        .update({ is_available: !m.is_available })
        .eq("id", m.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-items", storeId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const reorderItems = useMutation({
    mutationFn: async (ordered: MenuItem[]) => {
      await Promise.all(
        ordered.map((m, idx) =>
          supabase.from("menu_items").update({ position: idx }).eq("id", m.id),
        ),
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-items", storeId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  // ---------- Helpers ----------
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

  const filteredCategories = useMemo(() => {
    if (filterCat === "all") return categories;
    return categories.filter((c) => c.id === filterCat);
  }, [categories, filterCat]);

  const itemsByCategory = useMemo(() => {
    const term = search.trim().toLowerCase();
    const map: Record<string, MenuItem[]> = {};
    for (const c of filteredCategories) map[c.id] = [];
    for (const it of items) {
      if (!map[it.category_id]) continue;
      if (term && !it.name.toLowerCase().includes(term)) continue;
      map[it.category_id].push(it);
    }
    return map;
  }, [items, filteredCategories, search]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragCategories = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = categories.findIndex((c) => c.id === active.id);
    const newIdx = categories.findIndex((c) => c.id === over.id);
    const next = arrayMove(categories, oldIdx, newIdx);
    qc.setQueryData(["admin-cats", storeId], next);
    reorderCategories.mutate(next);
  };

  const onDragItemsInCategory = (catId: string) => (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const list = itemsByCategory[catId];
    const oldIdx = list.findIndex((m) => m.id === active.id);
    const newIdx = list.findIndex((m) => m.id === over.id);
    const reordered = arrayMove(list, oldIdx, newIdx);
    // Reescreve posições globais mantendo as outras categorias intactas
    const next = items.map((it) => {
      if (it.category_id !== catId) return it;
      const idxInCat = reordered.findIndex((r) => r.id === it.id);
      return { ...it, position: idxInCat };
    });
    qc.setQueryData(["admin-items", storeId], next);
    reorderItems.mutate(reordered);
  };

  const openNewItem = (categoryId?: string) => {
    setEditing({
      category_id: categoryId || categories[0]?.id,
      emoji: isPizzeria ? "🍕" : "🍽️",
      name: "",
      price: 0,
      is_available: true,
      sizes: [],
      colors: [],
    });
    setEditingVars([]);
    setSizesInput("");
    setColorsInput("");
    setEditingPizzaPrices({});
    setOpen(true);
  };

  const openEditItem = async (m: MenuItem) => {
    setEditing(m);
    setEditingVars((variationsByItem[m.id] || []).map((v) => ({ ...v })));
    setSizesInput((m.sizes ?? []).join(", "));
    setColorsInput((m.colors ?? []).join(", "));
    setEditingPizzaPrices({});
    setOpen(true);
    const cat = categories.find((c) => c.id === m.category_id);
    if (cat?.is_pizza) {
      const { data } = await supabase
        .from("menu_item_size_prices")
        .select("pizza_size_id,price")
        .eq("menu_item_id", m.id);
      const map: Record<string, string> = {};
      (data ?? []).forEach((p) => {
        map[p.pizza_size_id] = String(p.price);
      });
      setEditingPizzaPrices(map);
    }
  };


  // ---------- Render ----------
  return (
    <div>
      {!embedded && <BackToStoreEditor storeId={presetStoreId} />}
      {!embedded && (
        <div className="mb-4">
          <h1 className="text-2xl font-bold">Vitrine</h1>
          <p className="text-sm text-muted-foreground">
            Gerencie categorias, produtos e variações no estilo iFood
          </p>
        </div>
      )}

      {!embedded && (
        <div className="mb-4 flex gap-2 border-b">
          {STORE_TYPE_TABS.map((t) => {
            const active = t.value === storeType;
            return (
              <button
                key={t.value}
                onClick={() => {
                  setStoreType(t.value);
                  setStoreId("");
                }}
                className={
                  "relative px-4 py-2 text-sm font-medium transition-colors " +
                  (active
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground")
                }
              >
                {t.label}
                {active && (
                  <span className="absolute inset-x-0 -bottom-px h-0.5 bg-primary" />
                )}
              </button>
            );
          })}
        </div>
      )}

      {!embedded && (
        <div className="mb-4 max-w-sm">
          <Label>Loja</Label>
          <Select value={storeId} onValueChange={setStoreId}>
            <SelectTrigger>
              <SelectValue placeholder={
                stores.length === 0
                  ? `Nenhuma loja ${STORE_TYPE_TABS.find((t) => t.value === storeType)?.label}`
                  : "Escolha uma loja"
              } />
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
      )}

      {storeId && isPizzeria && (
        <div className="mb-4 flex items-center gap-3 rounded-lg border border-orange-200 bg-orange-50 p-3 dark:border-orange-900/40 dark:bg-orange-950/20">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-100 text-orange-600 dark:bg-orange-900/40">
            <Pizza className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Esta loja é uma pizzaria</p>
            <p className="text-xs text-muted-foreground">
              Ao criar uma categoria, configure tamanhos, bordas e disponibilidade no estilo iFood.
            </p>
          </div>
        </div>
      )}

      {storeId && (
        <>
          {/* Toolbar */}
          <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border bg-card p-3">
            <div className="relative min-w-[220px] flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar um item"
                className="pl-9"
              />
            </div>
            <Select value={filterCat} onValueChange={setFilterCat}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Selecionar categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as categorias</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              onClick={() => {
                if (isPizzeria) {
                  setPizzaWizardInitial(null);
                  setPizzaWizardOpen(true);
                } else {
                  setEditingCat({ name: "", is_available: true });
                  setCatOpen(true);
                }
              }}
            >
              <FolderPlus className="h-4 w-4" /> Adicionar categoria
            </Button>
            <Button asChild variant="outline">
              <Link to="/admin/importar-cardapio">
                <Upload className="h-4 w-4" /> Importar cardápio
              </Link>
            </Button>
            <Button
              variant="outline"
              onClick={() => setAiBulkOpen(true)}
            >
              <Sparkles className="h-4 w-4" /> Assistente IA
            </Button>
            <Button
              disabled={categories.length === 0}
              onClick={() => openNewItem()}
            >
              <Plus className="h-4 w-4" /> Novo produto
            </Button>
          </div>

          {categories.length === 0 ? (
            <div className="rounded-lg border bg-card p-8 text-center">
              <p className="text-sm text-muted-foreground">
                Nenhuma categoria. Crie a primeira para começar a adicionar produtos.
              </p>
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={onDragCategories}
            >
              <SortableContext
                items={filteredCategories.map((c) => c.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-3">
                  {filteredCategories.map((cat) => (
                    <SortableCategory
                      key={cat.id}
                      category={cat}
                      items={itemsByCategory[cat.id] || []}
                      variationsByItem={variationsByItem}
                      pizzaPriceByItem={pizzaPriceByItem}
                      isPizzaCategory={!!cat.is_pizza}
                      collapsed={!!collapsed[cat.id]}
                      onToggle={() =>
                        setCollapsed((p) => ({ ...p, [cat.id]: !p[cat.id] }))
                      }
                      onEditCategory={() => {
                        if (cat.is_pizza || isPizzeria) {
                          setPizzaWizardInitial(cat);
                          setPizzaWizardOpen(true);
                        } else {
                          setEditingCat(cat);
                          setCatOpen(true);
                        }
                      }}
                      onDeleteCategory={() => {
                        if (
                          confirm(
                            `Excluir categoria "${cat.name}"? Os produtos dela também serão excluídos.`,
                          )
                        )
                          delCategory.mutate(cat.id);
                      }}
                      onToggleAvailable={() => toggleCategoryAvailable.mutate(cat)}
                      onDuplicateCategory={() => duplicateCategory.mutate(cat)}
                      onAddItem={() => openNewItem(cat.id)}
                      onEditItem={openEditItem}
                      onDeleteItem={(id, name) => {
                        if (confirm(`Excluir "${name}"?`)) delItem.mutate(id);
                      }}
                      onToggleItemAvailable={(m) => toggleItemAvailable.mutate(m)}
                      onDuplicateItem={(m) => duplicateItem.mutate(m)}
                      onPatchItem={(id, patch) => patchItem.mutate({ id, patch })}
                      onPatchVariation={(id, patch) => patchVariation.mutate({ id, patch })}
                      onPatchCategoryName={(name) => patchCategory.mutate({ id: cat.id, name })}
                      onDragItems={onDragItemsInCategory(cat.id)}
                      sensors={sensors}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </>
      )}

      {/* Dialog categoria */}
      <Dialog
        open={catOpen}
        onOpenChange={(o) => {
          setCatOpen(o);
          if (!o) setEditingCat(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCat?.id ? "Editar categoria" : "Nova categoria"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome</Label>
              <Input
                value={editingCat?.name || ""}
                onChange={(e) =>
                  setEditingCat({ ...editingCat, name: e.target.value })
                }
                placeholder="Ex: Pizzas Salgadas"
              />
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <p className="text-sm font-medium">Categoria de pizza 🍕</p>
                <p className="text-xs text-muted-foreground">
                  Permite que o cliente monte pedido meio a meio com 2 sabores desta categoria.
                </p>
              </div>
              <Switch
                checked={editingCat?.is_pizza ?? false}
                onCheckedChange={(v) =>
                  setEditingCat({ ...editingCat, is_pizza: v })
                }
              />
            </div>
            {editingCat?.id && (
              <div className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <p className="text-sm font-medium">Disponível</p>
                  <p className="text-xs text-muted-foreground">
                    Pausar oculta a categoria do cardápio
                  </p>
                </div>
                <Switch
                  checked={editingCat?.is_available ?? true}
                  onCheckedChange={(v) =>
                    setEditingCat({ ...editingCat, is_available: v })
                  }
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCatOpen(false)}>
              Cancelar
            </Button>
            <Button
              disabled={!editingCat?.name?.trim()}
              onClick={() => editingCat && saveCategory.mutate(editingCat)}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog produto */}
      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) {
            setEditing(null);
            setEditingVars([]);
            setEditingPizzaPrices({});
          }
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing?.id ? "Editar produto" : "Novo produto"}
            </DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label>Imagem</Label>
                <div
                  className="mt-1 flex items-center gap-3 rounded-md border border-dashed p-3 focus-within:ring-2 focus-within:ring-ring"
                  tabIndex={0}
                  onPaste={(e) => {
                    const item = Array.from(e.clipboardData.items).find((i) =>
                      i.type.startsWith("image/"),
                    );
                    const file = item?.getAsFile();
                    if (file) {
                      e.preventDefault();
                      handleFile(file);
                    }
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const f = Array.from(e.dataTransfer.files).find((x) =>
                      x.type.startsWith("image/"),
                    );
                    if (f) handleFile(f);
                  }}
                >
                  {editing.image_url && (
                    <img
                      src={editing.image_url}
                      alt=""
                      className="h-16 w-16 rounded object-cover"
                    />
                  )}
                  <div className="flex-1 space-y-1">
                    <Input
                      type="file"
                      accept="image/*"
                      disabled={uploading}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleFile(f);
                      }}
                    />
                    <p className="text-xs text-muted-foreground">
                      Dica: clique aqui e cole (Ctrl+V) ou arraste uma imagem.
                    </p>
                  </div>
                </div>
              </div>
              <div className="sm:col-span-2">
                <Label>Categoria</Label>
                <Select
                  value={editing.category_id || ""}
                  onValueChange={(v) => setEditing({ ...editing, category_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2">
                <Label>Nome</Label>
                <Input
                  value={editing.name || ""}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                />
              </div>
              <div className="sm:col-span-2">
                <Label>Descrição</Label>
                <Textarea
                  rows={2}
                  value={editing.description || ""}
                  onChange={(e) =>
                    setEditing({ ...editing, description: e.target.value })
                  }
                />
              </div>
              {(() => {
                const cat = categories.find((c) => c.id === editing.category_id);
                const pizzaSizes = sizesByCategory(editing.category_id);
                const isPizza = !!cat?.is_pizza && pizzaSizes.length > 0;
                const autoPrice = isPizza
                  ? Math.max(
                      0,
                      ...pizzaSizes
                        .map((s) => Number(editingPizzaPrices[s.id]))
                        .filter((n) => !isNaN(n) && n > 0),
                    )
                  : null;
                return (
                  <div>
                    <Label>Preço base (R$)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      disabled={isPizza}
                      value={isPizza ? (autoPrice || 0) : (editing.price ?? "")}
                      onChange={(e) =>
                        setEditing({ ...editing, price: Number(e.target.value) })
                      }
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      {isPizza
                        ? "Definido automaticamente pelo maior tamanho (Grande)"
                        : "Usado quando não há variações"}
                    </p>
                  </div>
                );
              })()}
              <div>
                <Label>Preço original (riscado)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={editing.original_price ?? ""}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      original_price: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                />
              </div>
              <div>
                <Label>Emoji</Label>
                <Input
                  value={editing.emoji || ""}
                  onChange={(e) => setEditing({ ...editing, emoji: e.target.value })}
                />
              </div>
              <div>
                <Label>Promo (texto)</Label>
                <Input
                  value={editing.promo || ""}
                  onChange={(e) => setEditing({ ...editing, promo: e.target.value })}
                  placeholder="Ex: -20%"
                />
              </div>

              {/* Tamanhos disponíveis (e-commerce) */}
              <div className="sm:col-span-2 rounded-md border p-3">
                <div className="mb-2">
                  <p className="text-sm font-semibold">Tamanhos disponíveis</p>
                  <p className="text-xs text-muted-foreground">
                    Separe por vírgula. Ex: P, M, G, GG, 38, 39, 40. Deixe vazio se o produto não tem tamanho.
                  </p>
                </div>
                <Input
                  value={sizesInput}
                  onChange={(e) => {
                    const raw = e.target.value;
                    setSizesInput(raw);
                    const parts = raw
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean);
                    setEditing({ ...editing, sizes: parts });
                  }}
                  onBlur={() => {
                    const parts = sizesInput
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean);
                    setSizesInput(parts.join(", "));
                  }}
                  placeholder="P, M, G, GG"
                />
                {(editing.sizes ?? []).length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {(editing.sizes ?? []).map((s, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">
                        {s}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              {/* Cores disponíveis (e-commerce) — não alteram o preço */}
              <div className="sm:col-span-2 rounded-md border p-3">
                <div className="mb-2">
                  <p className="text-sm font-semibold">Cores disponíveis</p>
                  <p className="text-xs text-muted-foreground">
                    Separe por vírgula. Ex: Preto, Branco, Azul. A cor não altera o preço do produto.
                  </p>
                </div>
                <Input
                  value={colorsInput}
                  onChange={(e) => {
                    const raw = e.target.value;
                    setColorsInput(raw);
                    const parts = raw
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean);
                    setEditing({ ...editing, colors: parts });
                  }}
                  onBlur={() => {
                    const parts = colorsInput
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean);
                    setColorsInput(parts.join(", "));
                  }}
                  placeholder="Preto, Branco, Azul"
                />
                {(editing.colors ?? []).length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {(editing.colors ?? []).map((s, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">
                        {s}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>


              {/* Preços por tamanho (pizzas) */}
              {(() => {
                const cat = categories.find(
                  (c) => c.id === editing.category_id,
                );
                const pizzaSizes = sizesByCategory(editing.category_id);
                if (!cat?.is_pizza || pizzaSizes.length === 0) return null;
                return (
                  <div className="sm:col-span-2 rounded-md border p-3">
                    <div className="mb-2">
                      <p className="text-sm font-semibold">
                        🍕 Preço por tamanho de pizza
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Defina o preço deste sabor em cada tamanho. Deixe vazio
                        para não vender neste tamanho.
                      </p>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {pizzaSizes.map((s) => (
                        <div key={s.id}>
                          <Label className="text-xs">{s.name} (R$)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            min={0}
                            placeholder="0,00"
                            value={editingPizzaPrices[s.id] ?? ""}
                            onChange={(e) =>
                              setEditingPizzaPrices((prev) => ({
                                ...prev,
                                [s.id]: e.target.value,
                              }))
                            }
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              <div className="sm:col-span-2 mt-2 rounded-md border p-3">
                <div className="mb-2 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold">Tamanhos / Variações</p>
                    <p className="text-xs text-muted-foreground">
                      Ex: Pequena, Média, Grande
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setEditingVars((p) => [
                        ...p,
                        {
                          name: "",
                          price: 0,
                          original_price: null,
                          position: p.length,
                          is_available: true,
                          _isNew: true,
                        },
                      ])
                    }
                  >
                    <Plus className="h-3 w-3" /> Adicionar
                  </Button>
                </div>
                {editingVars.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Sem variações — usa o preço base.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {editingVars.map((v, i) => (
                      <div
                        key={i}
                        className="grid grid-cols-[1fr_110px_110px_auto] gap-2"
                      >
                        <Input
                          placeholder="Nome (ex: Média)"
                          value={v.name}
                          onChange={(e) => {
                            const next = [...editingVars];
                            next[i] = { ...v, name: e.target.value };
                            setEditingVars(next);
                          }}
                        />
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="Preço"
                          value={v.price}
                          onChange={(e) => {
                            const next = [...editingVars];
                            next[i] = { ...v, price: Number(e.target.value) };
                            setEditingVars(next);
                          }}
                        />
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="De (riscado)"
                          value={v.original_price ?? ""}
                          onChange={(e) => {
                            const next = [...editingVars];
                            next[i] = {
                              ...v,
                              original_price: e.target.value
                                ? Number(e.target.value)
                                : null,
                            };
                            setEditingVars(next);
                          }}
                        />
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          onClick={() =>
                            setEditingVars(editingVars.filter((_, j) => j !== i))
                          }
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="sm:col-span-2 flex items-center justify-between rounded-md border p-3">
                <div>
                  <p className="text-sm font-medium">Disponível</p>
                  <p className="text-xs text-muted-foreground">
                    Pausar oculta o produto do cardápio
                  </p>
                </div>
                <Switch
                  checked={editing.is_available ?? true}
                  onCheckedChange={(v) => setEditing({ ...editing, is_available: v })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              disabled={
                saveItem.isPending ||
                uploading ||
                !editing?.name ||
                !editing?.category_id
              }
              onClick={() =>
                editing &&
                saveItem.mutate({
                  m: editing,
                  vars: editingVars,
                  pizzaPrices: editingPizzaPrices,
                })
              }
            >
              {saveItem.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PizzaCategoryWizard
        open={pizzaWizardOpen}
        onOpenChange={(o) => {
          setPizzaWizardOpen(o);
          if (!o) setPizzaWizardInitial(null);
        }}
        storeId={storeId}
        initial={pizzaWizardInitial}
        position={categories.length}
      />

      {storeId && (
        <BulkEditAIDialog
          open={aiBulkOpen}
          onOpenChange={setAiBulkOpen}
          storeId={storeId}
          initialCategoryId={filterCat === "all" ? null : filterCat}
        />
      )}
    </div>
  );
}

// ---------- Sortable category card ----------
function SortableCategory({
  category,
  items,
  variationsByItem,
  pizzaPriceByItem,
  isPizzaCategory,
  collapsed,
  onToggle,
  onEditCategory,
  onDeleteCategory,
  onToggleAvailable,
  onDuplicateCategory,
  onAddItem,
  onEditItem,
  onDeleteItem,
  onToggleItemAvailable,
  onDuplicateItem,
  onPatchItem,
  onPatchVariation,
  onPatchCategoryName,
  onDragItems,
  sensors,
}: {
  category: Category;
  items: MenuItem[];
  variationsByItem: Record<string, Variation[]>;
  pizzaPriceByItem: Record<string, number>;
  isPizzaCategory: boolean;
  collapsed: boolean;
  onToggle: () => void;
  onEditCategory: () => void;
  onDeleteCategory: () => void;
  onToggleAvailable: () => void;
  onDuplicateCategory: () => void;
  onAddItem: () => void;
  onEditItem: (m: MenuItem) => void;
  onDeleteItem: (id: string, name: string) => void;
  onToggleItemAvailable: (m: MenuItem) => void;
  onDuplicateItem: (m: MenuItem) => void;
  onPatchItem: (id: string, patch: Partial<MenuItem>) => void;
  onPatchVariation: (id: string, patch: { price?: number }) => void;
  onPatchCategoryName: (name: string) => void;
  onDragItems: (e: DragEndEvent) => void;
  sensors: ReturnType<typeof useSensors>;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: category.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const [editingCatName, setEditingCatName] = useState(false);
  const [catNameDraft, setCatNameDraft] = useState(category.name);

  const commitCatName = () => {
    const v = catNameDraft.trim();
    setEditingCatName(false);
    if (!v || v === category.name) {
      setCatNameDraft(category.name);
      return;
    }
    if (v.length > 80) {
      toast.error("Nome muito longo");
      setCatNameDraft(category.name);
      return;
    }
    onPatchCategoryName(v);
  };

  return (
    <div ref={setNodeRef} style={style} className="rounded-lg border bg-card">
      <div className="flex items-center gap-2 border-b p-3">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab text-muted-foreground hover:text-foreground"
          aria-label="Arrastar categoria"
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <button onClick={onToggle} className="text-muted-foreground">
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </button>
        <div className="flex flex-1 items-center gap-2">
          {editingCatName ? (
            <Input
              autoFocus
              value={catNameDraft}
              onChange={(e) => setCatNameDraft(e.target.value)}
              onBlur={commitCatName}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitCatName();
                if (e.key === "Escape") {
                  setCatNameDraft(category.name);
                  setEditingCatName(false);
                }
              }}
              className="h-7 max-w-xs text-sm font-semibold"
            />
          ) : (
            <button
              type="button"
              onClick={() => {
                setCatNameDraft(category.name);
                setEditingCatName(true);
              }}
              className="font-semibold hover:underline"
              title="Clique para editar o nome"
            >
              {category.name}
            </button>
          )}
          <span className="text-xs text-muted-foreground">
            ({items.length} {items.length === 1 ? "item" : "itens"})
          </span>
          {!category.is_available && (
            <Badge variant="secondary" className="text-xs">
              Pausada
            </Badge>
          )}
        </div>
        <Button size="sm" variant="outline" onClick={onAddItem}>
          <Plus className="h-3 w-3" /> Adicionar item
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={onToggleAvailable}
          title={category.is_available ? "Pausar categoria" : "Ativar categoria"}
        >
          {category.is_available ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4" />
          )}
        </Button>
        <Button size="icon" variant="ghost" onClick={onEditCategory}>
          <Pencil className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="ghost" onClick={onDuplicateCategory} title="Duplicar categoria">
          <Copy className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="ghost" onClick={onDeleteCategory}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>

      {!collapsed && (
        <div className="divide-y">
          {items.length === 0 ? (
            <p className="p-4 text-center text-sm text-muted-foreground">
              Sem produtos nesta categoria
            </p>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={onDragItems}
            >
              <SortableContext
                items={items.map((i) => i.id)}
                strategy={verticalListSortingStrategy}
              >
                {items.map((m) => (
                  <SortableItemRow
                    key={m.id}
                    item={m}
                    variations={variationsByItem[m.id] || []}
                    pizzaPrice={
                      isPizzaCategory && pizzaPriceByItem[m.id] != null && pizzaPriceByItem[m.id]! > 0
                        ? pizzaPriceByItem[m.id]!
                        : null
                    }
                    onEdit={() => onEditItem(m)}
                    onDelete={() => onDeleteItem(m.id, m.name)}
                    onToggleAvailable={() => onToggleItemAvailable(m)}
                    onDuplicate={() => onDuplicateItem(m)}
                    onPatch={(patch) => onPatchItem(m.id, patch)}
                    onPatchVariation={onPatchVariation}
                  />
                ))}
              </SortableContext>
            </DndContext>
          )}
        </div>
      )}
    </div>
  );
}

// ---------- Sortable item row ----------
function SortableItemRow({
  item,
  variations,
  pizzaPrice,
  onEdit,
  onDelete,
  onToggleAvailable,
  onDuplicate,
  onPatch,
  onPatchVariation,
}: {
  item: MenuItem;
  variations: Variation[];
  pizzaPrice: number | null;
  onEdit: () => void;
  onDelete: () => void;
  onToggleAvailable: () => void;
  onDuplicate: () => void;
  onPatch: (patch: Partial<MenuItem>) => void;
  onPatchVariation: (id: string, patch: { price?: number }) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const hasVariations = variations.length > 0;
  const isPizza = pizzaPrice !== null;
  // Variação de menor preço (a que aparece como "A partir de").
  const cheapestVariation = hasVariations
    ? variations.reduce((acc, v) => (Number(v.price) < Number(acc.price) ? v : acc), variations[0])
    : null;
  const minPrice = isPizza
    ? Number(pizzaPrice)
    : hasVariations
      ? Number(cheapestVariation!.price)
      : Number(item.price);

  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(item.name);
  const [editingPrice, setEditingPrice] = useState(false);
  const [priceDraft, setPriceDraft] = useState(String(minPrice ?? 0));

  const commitName = () => {
    const v = nameDraft.trim();
    setEditingName(false);
    if (!v || v === item.name) {
      setNameDraft(item.name);
      return;
    }
    if (v.length > 120) {
      toast.error("Nome muito longo");
      setNameDraft(item.name);
      return;
    }
    onPatch({ name: v });
  };

  const commitPrice = () => {
    setEditingPrice(false);
    const n = Number(priceDraft.replace(",", "."));
    if (!Number.isFinite(n) || n < 0) {
      toast.error("Preço inválido");
      setPriceDraft(String(minPrice ?? 0));
      return;
    }
    if (hasVariations && cheapestVariation && cheapestVariation.id) {
      if (n === Number(cheapestVariation.price)) return;
      onPatchVariation(cheapestVariation.id, { price: n });
    } else {
      if (n === Number(item.price)) return;
      onPatch({ price: n });
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 p-3 hover:bg-muted/40"
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab text-muted-foreground hover:text-foreground"
        aria-label="Arrastar produto"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      {item.image_url ? (
        <img
          src={item.image_url}
          alt={item.name}
          className="h-12 w-12 rounded object-cover"
        />
      ) : (
        <div className="flex h-12 w-12 items-center justify-center rounded bg-muted text-xl">
          {item.emoji}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {editingName ? (
            <Input
              autoFocus
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onBlur={commitName}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitName();
                if (e.key === "Escape") {
                  setNameDraft(item.name);
                  setEditingName(false);
                }
              }}
              className="h-7 text-sm"
            />
          ) : (
            <button
              type="button"
              onClick={() => {
                setNameDraft(item.name);
                setEditingName(true);
              }}
              className="truncate text-left font-medium hover:underline"
              title="Clique para editar o nome"
            >
              {item.name}
            </button>
          )}
          {!item.is_available && (
            <Badge variant="secondary" className="text-xs">
              Pausado
            </Badge>
          )}
        </div>
        {item.description && (
          <p className="truncate text-xs text-muted-foreground">{item.description}</p>
        )}
      </div>
      {hasVariations && (
        <Badge variant="outline" className="hidden sm:inline-flex">
          {variations.length} tamanhos
        </Badge>
      )}
      <div className="text-right">
        {hasVariations && (
          <p className="text-[10px] text-muted-foreground">A partir de</p>
        )}
        {editingPrice ? (
          <div className="flex items-center gap-1">
            <span className="text-sm font-semibold">R$</span>
            <Input
              autoFocus
              type="number"
              step="0.01"
              min="0"
              value={priceDraft}
              onChange={(e) => setPriceDraft(e.target.value)}
              onBlur={commitPrice}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitPrice();
                if (e.key === "Escape") {
                  setPriceDraft(String(minPrice ?? 0));
                  setEditingPrice(false);
                }
              }}
              className="h-7 w-24 text-right text-sm"
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              if (isPizza) {
                toast.info("Preço é definido pelos tamanhos da pizza");
                onEdit();
                return;
              }
              if (hasVariations && variations.length > 1) {
                // Múltiplas variações: abre o editor completo para evitar confusão.
                toast.info("Edite os preços das variações no formulário");
                onEdit();
                return;
              }
              setPriceDraft(String(minPrice ?? 0));
              setEditingPrice(true);
            }}
            className="text-sm font-semibold hover:underline"
            title={
              hasVariations && variations.length > 1
                ? "Produto com várias variações — edite no formulário"
                : "Clique para editar o preço"
            }
          >
            R$ {minPrice.toFixed(2)}
          </button>
        )}
      </div>
      <Button
        size="icon"
        variant="ghost"
        onClick={onToggleAvailable}
        title={item.is_available ? "Pausar" : "Ativar"}
      >
        {item.is_available ? (
          <Pause className="h-4 w-4" />
        ) : (
          <Play className="h-4 w-4" />
        )}
      </Button>
      <Button size="icon" variant="ghost" onClick={onEdit}>
        <Pencil className="h-4 w-4" />
      </Button>
      <Button size="icon" variant="ghost" onClick={onDuplicate} title="Duplicar produto">
        <Copy className="h-4 w-4" />
      </Button>
      <Button size="icon" variant="ghost" onClick={onDelete}>
        <Trash2 className="h-4 w-4 text-destructive" />
      </Button>
    </div>
  );
}
