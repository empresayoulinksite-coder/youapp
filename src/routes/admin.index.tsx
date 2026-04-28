import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, UtensilsCrossed, ShoppingBag, Briefcase, Pause, Play, Eye, EyeOff, Dumbbell, Settings } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { isGymStore } from "@/lib/gym";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { uploadImage } from "@/lib/upload";
import { StoreHoursEditor } from "@/components/StoreHoursEditor";
import { geocodeAddress } from "@/lib/distance";
import { PAYMENT_METHODS } from "@/lib/payment-methods";
import { StoreLocationAdjuster } from "@/components/StoreLocationAdjuster";
import { StoreBenefitsEditor } from "@/components/StoreBenefitsEditor";
import { StoreReelsEditor } from "@/components/StoreReelsEditor";
import { StoreFeedEditor } from "@/components/StoreFeedEditor";
import { CATEGORY_OPTIONS } from "@/lib/categories";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/admin/")({
  component: AdminStores,
});

type StoreType = "food" | "ecommerce" | "service";

const STORE_TYPES: Array<{ value: StoreType; label: string; description: string; Icon: typeof UtensilsCrossed; emoji: string }> = [
  { value: "food", label: "Loja Food", description: "Restaurante, lanches, mercado, doces", Icon: UtensilsCrossed, emoji: "🍔" },
  { value: "ecommerce", label: "E-commerce", description: "Moda, beleza, acessórios, calçados", Icon: ShoppingBag, emoji: "🛍️" },
  { value: "service", label: "Serviço", description: "Agendamento, profissionais", Icon: Briefcase, emoji: "💼" },
];

type Store = {
  id: string;
  slug: string;
  name: string;
  emoji: string;
  store_type: StoreType;
  category: string;
  rating: number;
  distance: string;
  delivery_time: string;
  delivery_fee: string;
  free_delivery: boolean;
  delivery_enabled: boolean;
  promo: string | null;
  image_url: string | null;
  about: string | null;
  cep: string | null;
  address: string | null;
  neighborhood: string | null;
  city: string | null;
  hours: string | null;
  payment_methods: string | null;
  payment_methods_list: string[];
  min_order: number;
  is_paused: boolean;
  is_hidden: boolean;
  whatsapp: string | null;
  lat: number | null;
  lng: number | null;
  show_route: boolean;
  route_url: string | null;
  pickup_enabled: boolean;
  is_pizzeria: boolean;
  reels_enabled: boolean;
  feed_enabled: boolean;
};

async function lookupCep(rawCep: string) {
  const cep = rawCep.replace(/\D/g, "");
  if (cep.length !== 8) return null;
  try {
    const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
    const data = await res.json();
    if (data?.erro) return null;
    return {
      street: data.logradouro as string,
      neighborhood: data.bairro as string,
      city: data.localidade as string,
    };
  } catch {
    return null;
  }
}

const empty: Partial<Store> = {
  slug: "",
  name: "",
  emoji: "🍽️",
  store_type: "food",
  category: "",
  rating: 4.5,
  distance: "1,0 km",
  delivery_time: "30-40 min",
  delivery_fee: "Grátis",
  free_delivery: true,
  delivery_enabled: true,
  promo: "",
  image_url: "",
  about: "",
  cep: "",
  address: "",
  neighborhood: "",
  city: "",
  hours: "",
  payment_methods: "",
  payment_methods_list: [],
  min_order: 0,
  whatsapp: "",
  show_route: false,
  route_url: "",
  pickup_enabled: false,
  is_pizzeria: false,
};

function AdminStores() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Store> | null>(null);
  const [uploading, setUploading] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);

  const { data: stores = [], isLoading } = useQuery({
    queryKey: ["admin-stores"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stores")
        .select("*")
        .order("name");
      if (error) throw error;
      return data as Store[];
    },
  });

  const { data: dynamicCategoryOptions = [] } = useQuery({
    queryKey: ["admin-home-category-options"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("home_categories")
        .select("label, matches")
        .eq("is_active", true)
        .order("position", { ascending: true });
      if (error) throw error;
      const seen = new Set<string>();
      const out: Array<{ value: string; label: string }> = [];
      for (const opt of CATEGORY_OPTIONS) {
        const key = opt.value.toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          out.push(opt);
        }
      }
      for (const row of data ?? []) {
        const values = [row.label, ...(row.matches ?? [])];
        for (const v of values) {
          const name = (v ?? "").trim();
          if (!name) continue;
          const key = name.toLowerCase();
          if (seen.has(key)) continue;
          seen.add(key);
          out.push({ value: name, label: name });
        }
      }
      return out.sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
    },
  });

  const save = useMutation({
    mutationFn: async (s: Partial<Store>) => {
      const payload = {
        slug: s.slug!,
        name: s.name!,
        emoji: s.emoji || "🍽️",
        store_type: (s.store_type || "food") as StoreType,
        category: s.category!,
        rating: Number(s.rating) || 4.5,
        distance: s.distance || "1,0 km",
        delivery_time: s.delivery_time || "30-40 min",
        delivery_fee: s.delivery_fee || "Grátis",
        free_delivery: !!s.free_delivery,
        delivery_enabled: s.delivery_enabled !== false,
        promo: s.promo || null,
        image_url: s.image_url || null,
        about: s.about || null,
        cep: s.cep || null,
        address: s.address || null,
        neighborhood: s.neighborhood || null,
        city: s.city || null,
        hours: s.hours || null,
        payment_methods: s.payment_methods || null,
        payment_methods_list: Array.isArray(s.payment_methods_list)
          ? s.payment_methods_list
          : [],
        min_order: Number(s.min_order) || 0,
        whatsapp: s.whatsapp ? s.whatsapp.replace(/\D/g, "") : null,
        lat: s.lat ?? null,
        lng: s.lng ?? null,
        show_route: !!s.show_route,
        route_url: s.route_url?.trim() ? s.route_url.trim() : null,
        pickup_enabled: !!s.pickup_enabled,
        is_pizzeria: !!s.is_pizzeria,
      };

      // Geocodifica automaticamente APENAS se temos endereço e ainda não temos coordenadas.
      // Se admin já ajustou manualmente (lat/lng definidos), preservamos o ajuste.
      const hasAddress = !!(s.address || s.cep || s.city);
      const hasCoords = s.lat != null && s.lng != null;
      if (hasAddress && !hasCoords) {
        const coords = await geocodeAddress({
          address: s.address,
          neighborhood: s.neighborhood,
          city: s.city,
          cep: s.cep,
        });
        if (coords) {
          payload.lat = coords.lat;
          payload.lng = coords.lng;
        }
      }

      if (s.id) {
        const { error } = await supabase.from("stores").update(payload).eq("id", s.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("stores").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Loja salva");
      qc.invalidateQueries({ queryKey: ["admin-stores"] });
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("stores").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Loja excluída");
      qc.invalidateQueries({ queryKey: ["admin-stores"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const togglePause = useMutation({
    mutationFn: async ({ id, is_paused }: { id: string; is_paused: boolean }) => {
      const { error } = await supabase.from("stores").update({ is_paused }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      toast.success(vars.is_paused ? "Loja pausada" : "Loja reaberta");
      qc.invalidateQueries({ queryKey: ["admin-stores"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleHidden = useMutation({
    mutationFn: async ({ id, is_hidden }: { id: string; is_hidden: boolean }) => {
      const { error } = await supabase.from("stores").update({ is_hidden }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      toast.success(vars.is_hidden ? "Loja oculta do app" : "Loja visível no app");
      qc.invalidateQueries({ queryKey: ["admin-stores"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleFile = async (file: File) => {
    setUploading(true);
    try {
      const url = await uploadImage("store-images", file);
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
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Lojas</h1>
          <p className="text-sm text-muted-foreground">{stores.length} cadastradas</p>
        </div>
        <Button
          onClick={() => {
            setEditing({ ...empty });
            setOpen(true);
          }}
        >
          <Plus className="h-4 w-4" /> Nova loja
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {stores.map((s) => (
            <div key={s.id} className="rounded-lg border bg-background p-3">
              <div className="flex items-start gap-3">
                {s.image_url ? (
                  <img
                    src={s.image_url}
                    alt={s.name}
                    className="h-16 w-16 rounded-md object-cover"
                  />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-md bg-muted text-2xl">
                    {s.emoji}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate font-semibold">{s.name}</h3>
                    {s.is_paused && (
                      <span className="rounded-full bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium text-destructive">
                        Pausada
                      </span>
                    )}
                    {s.is_hidden && (
                      <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                        Oculta
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                      {STORE_TYPES.find((t) => t.value === s.store_type)?.label ?? "Food"}
                    </span>
                    <p className="truncate text-xs text-muted-foreground">{s.category}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">⭐ {s.rating} · {s.delivery_time}</p>
                </div>
              </div>
              <div className="mt-3 space-y-2">
                <Button asChild size="sm" className="w-full">
                  <Link to="/admin/loja/$storeId" params={{ storeId: s.id }}>
                    <Settings className="h-3.5 w-3.5" />
                    Gerenciar loja
                  </Link>
                </Button>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant={s.is_paused ? "default" : "secondary"}
                    className="flex-1"
                    onClick={() => togglePause.mutate({ id: s.id, is_paused: !s.is_paused })}
                    disabled={togglePause.isPending}
                  >
                    {s.is_paused ? (
                      <>
                        <Play className="h-3 w-3" /> Reabrir
                      </>
                    ) : (
                      <>
                        <Pause className="h-3 w-3" /> Fechar
                      </>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    title="Editar dados básicos"
                    onClick={() => {
                      setEditing(s);
                      setOpen(true);
                    }}
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                  {isGymStore(s.category) && (
                    <Button
                      asChild
                      size="sm"
                      variant="outline"
                      title="Gerenciar academia (planos, aulas, alunos, treinos)"
                    >
                      <Link to="/admin/academia/$storeId" params={{ storeId: s.id }}>
                        <Dumbbell className="h-3 w-3" />
                      </Link>
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    title={s.is_hidden ? "Mostrar no app" : "Ocultar do app"}
                    onClick={() => toggleHidden.mutate({ id: s.id, is_hidden: !s.is_hidden })}
                    disabled={toggleHidden.isPending}
                  >
                    {s.is_hidden ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
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
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing?.id
                ? "Editar loja"
                : !editing?.store_type || !(editing as Partial<Store> & { __typed?: boolean }).__typed
                ? "Que tipo de loja você quer criar?"
                : `Nova ${STORE_TYPES.find((t) => t.value === editing.store_type)?.label}`}
            </DialogTitle>
          </DialogHeader>

          {/* Step 1: type selection for new stores */}
          {editing && !editing.id && !(editing as Partial<Store> & { __typed?: boolean }).__typed && (
            <div className="grid gap-3 sm:grid-cols-3">
              {STORE_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() =>
                    setEditing({
                      ...editing,
                      store_type: t.value,
                      emoji: t.emoji,
                      ...({ __typed: true } as object),
                    })
                  }
                  className="flex flex-col items-center gap-2 rounded-xl border-2 border-border bg-background p-6 text-center transition-colors hover:border-primary hover:bg-primary/5"
                >
                  <t.Icon className="h-10 w-10 text-primary" />
                  <span className="font-semibold">{t.label}</span>
                  <span className="text-xs text-muted-foreground">{t.description}</span>
                </button>
              ))}
            </div>
          )}

          {editing && (editing.id || (editing as Partial<Store> & { __typed?: boolean }).__typed) && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2 flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2">
                {(() => {
                  const t = STORE_TYPES.find((x) => x.value === (editing.store_type || "food"));
                  const Icon = t?.Icon ?? UtensilsCrossed;
                  return (
                    <>
                      <Icon className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium">{t?.label}</span>
                      <span className="text-xs text-muted-foreground">· {t?.description}</span>
                    </>
                  );
                })()}
              </div>
              <div className="sm:col-span-2">
                <Label>Imagem</Label>
                <div className="mt-1 flex items-center gap-3">
                  {editing.image_url && (
                    <img src={editing.image_url} alt="" className="h-16 w-16 rounded object-cover" />
                  )}
                  <Input
                    type="file"
                    accept="image/*"
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
                />
              </div>
              <div>
                <Label>Slug (URL)</Label>
                <Input
                  value={editing.slug || ""}
                  onChange={(e) => setEditing({ ...editing, slug: e.target.value })}
                  placeholder="ex: pizzaria-do-bairro"
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
                <Label>Categoria</Label>
                <Select
                  value={editing.category || ""}
                  onValueChange={(v) => setEditing({ ...editing, category: v })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecione a categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {dynamicCategoryOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  Use uma destas opções para a loja aparecer no botão correspondente da home.
                </p>
              </div>
              <div>
                <Label>Avaliação</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={editing.rating ?? 4.5}
                  onChange={(e) => setEditing({ ...editing, rating: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label>Distância</Label>
                <Input
                  value={editing.distance || ""}
                  onChange={(e) => setEditing({ ...editing, distance: e.target.value })}
                />
              </div>
              {(editing.store_type === "food" || editing.store_type === "ecommerce") && (
                <>
                  <div className="flex items-center gap-2 pt-6 sm:col-span-2">
                    <input
                      type="checkbox"
                      id="delivery_enabled"
                      checked={editing.delivery_enabled !== false}
                      onChange={(e) => setEditing({ ...editing, delivery_enabled: e.target.checked })}
                    />
                    <Label htmlFor="delivery_enabled">Faz entrega</Label>
                  </div>
                  {editing.delivery_enabled !== false && (
                    <>
                      <div>
                        <Label>Tempo de entrega</Label>
                        <Input
                          value={editing.delivery_time || ""}
                          onChange={(e) => setEditing({ ...editing, delivery_time: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label>Taxa de entrega</Label>
                        <Input
                          value={editing.delivery_fee || ""}
                          onChange={(e) => setEditing({ ...editing, delivery_fee: e.target.value })}
                          disabled={!!editing.free_delivery}
                          placeholder={editing.free_delivery ? "Grátis" : "Ex: R$ 5,00"}
                        />
                      </div>
                      <div>
                        <Label>Pedido mínimo (R$)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={editing.min_order ?? 0}
                          onChange={(e) => setEditing({ ...editing, min_order: Number(e.target.value) })}
                        />
                      </div>
                      <div className="flex items-center gap-2 pt-6">
                        <input
                          type="checkbox"
                          id="free"
                          checked={!!editing.free_delivery}
                          onChange={(e) => setEditing({ ...editing, free_delivery: e.target.checked, delivery_fee: e.target.checked ? "Grátis" : (editing.delivery_fee || "") })}
                        />
                        <Label htmlFor="free">Entrega grátis</Label>
                      </div>
                    </>
                  )}
                </>
              )}
              <div className="sm:col-span-2">
                <Label>Promoção (texto)</Label>
                <Input
                  value={editing.promo || ""}
                  onChange={(e) => setEditing({ ...editing, promo: e.target.value })}
                  placeholder="Ex: 20% OFF acima de R$50"
                />
              </div>
              <div>
                <Label>CEP</Label>
                <Input
                  value={editing.cep || ""}
                  maxLength={9}
                  placeholder="00000-000"
                  onChange={async (e) => {
                    const raw = e.target.value;
                    const digits = raw.replace(/\D/g, "").slice(0, 8);
                    const masked = digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
                    setEditing({ ...editing, cep: masked });
                    if (digits.length === 8) {
                      const found = await lookupCep(digits);
                      if (found) {
                        setEditing((prev) => ({
                          ...(prev || {}),
                          cep: masked,
                          address: found.street || prev?.address || "",
                          neighborhood: found.neighborhood || prev?.neighborhood || "",
                          city: found.city || prev?.city || "",
                        }));
                        toast.success("Endereço preenchido pelo CEP");
                      } else {
                        toast.error("CEP não encontrado");
                      }
                    }
                  }}
                />
              </div>
              <div>
                <Label>Endereço (rua, número)</Label>
                <Input
                  value={editing.address || ""}
                  onChange={(e) => setEditing({ ...editing, address: e.target.value })}
                />
              </div>
              <div>
                <Label>Bairro</Label>
                <Input
                  value={editing.neighborhood || ""}
                  onChange={(e) => setEditing({ ...editing, neighborhood: e.target.value })}
                />
              </div>
              <div>
                <Label>Cidade</Label>
                <Input
                  value={editing.city || ""}
                  onChange={(e) => setEditing({ ...editing, city: e.target.value })}
                />
              </div>
              <div className="sm:col-span-2 rounded-lg border bg-muted/30 p-3">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div className="min-w-0">
                    <Label className="block">Coordenadas (GPS)</Label>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {editing.lat != null && editing.lng != null
                        ? `📍 ${editing.lat.toFixed(5)}, ${editing.lng.toFixed(5)}`
                        : "Sem coordenadas. Usadas para o botão de rota e cálculo de distância."}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={!(editing.address || editing.cep || editing.city)}
                      onClick={async () => {
                        const t = toast.loading("Buscando coordenadas...");
                        const coords = await geocodeAddress({
                          address: editing.address,
                          neighborhood: editing.neighborhood,
                          city: editing.city,
                          cep: editing.cep,
                        });
                        toast.dismiss(t);
                        if (coords) {
                          setEditing((prev) => ({ ...(prev || {}), lat: coords.lat, lng: coords.lng }));
                          toast.success("Coordenadas encontradas");
                        } else {
                          toast.error("Não foi possível localizar o endereço");
                        }
                      }}
                    >
                      Buscar pelo endereço
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => setMapOpen(true)}
                    >
                      📍 Ajustar no mapa
                    </Button>
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground mt-2">
                  💡 Use "Ajustar no mapa" para arrastar o pin até a entrada exata da loja. Isso garante que a rota leve o cliente ao local correto.
                </p>
              </div>
              <div className="sm:col-span-2">
                <label className="flex items-start gap-3 rounded-md border p-3 cursor-pointer hover:bg-muted/30 transition-colors">
                  <input
                    type="checkbox"
                    checked={!!editing.show_route}
                    onChange={(e) =>
                      setEditing({ ...editing, show_route: e.target.checked })
                    }
                    className="h-4 w-4 mt-0.5 accent-[hsl(var(--brand))]"
                  />
                  <div>
                    <p className="font-medium text-sm">Mostrar botão "Ver rota até a loja"</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Ative para lojas com endereço físico. Desative para lojas online ou somente delivery.
                    </p>
                  </div>
                </label>
              </div>
              {editing.show_route && (
                <div className="sm:col-span-2">
                  <Label htmlFor="route_url">Link manual da rota (opcional)</Label>
                  <Input
                    id="route_url"
                    type="url"
                    inputMode="url"
                    placeholder="https://maps.app.goo.gl/..."
                    value={editing.route_url ?? ""}
                    onChange={(e) =>
                      setEditing({ ...editing, route_url: e.target.value })
                    }
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Cole aqui o link da rota (Google Maps, Waze, etc.) já alinhado no local exato. Se preenchido, este link será usado no botão. Caso contrário, usaremos a localização ajustada no mapa ou o endereço.
                  </p>
                </div>
              )}
              <div className="sm:col-span-2">
                <label className="flex items-start gap-3 rounded-md border p-3 cursor-pointer hover:bg-muted/30 transition-colors">
                  <input
                    type="checkbox"
                    checked={!!editing.pickup_enabled}
                    onChange={(e) =>
                      setEditing({ ...editing, pickup_enabled: e.target.checked })
                    }
                    className="h-4 w-4 mt-0.5 accent-[hsl(var(--brand))]"
                  />
                  <div>
                    <p className="font-medium text-sm">Permitir "Retirar no local"</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Quando ativado, o cliente poderá escolher entre receber em casa ou retirar no endereço da loja.
                    </p>
                  </div>
                </label>
              </div>
              {editing.store_type === "food" && (
                <div className="sm:col-span-2">
                  <label className="flex items-start gap-3 rounded-md border border-orange-200 bg-orange-50/40 p-3 cursor-pointer hover:bg-orange-50 transition-colors dark:border-orange-900/40 dark:bg-orange-950/10">
                    <input
                      type="checkbox"
                      checked={!!editing.is_pizzeria}
                      onChange={(e) =>
                        setEditing({ ...editing, is_pizzeria: e.target.checked })
                      }
                      className="h-4 w-4 mt-0.5 accent-[hsl(var(--brand))]"
                    />
                    <div>
                      <p className="font-medium text-sm">🍕 Esta loja é uma pizzaria</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Habilita o módulo de pizzas em "Produtos" (tamanhos, sabores meio a meio, bordas recheadas e adicionais). Lojas com categoria "Pizza" já vêm habilitadas automaticamente.
                      </p>
                    </div>
                  </label>
                </div>
              )}
              {editing.id && (
                <div className="sm:col-span-2">
                  <Label>Horários de funcionamento</Label>
                  <div className="mt-2">
                    <StoreHoursEditor storeId={editing.id} />
                  </div>
                </div>
              )}
              {!editing.id && (
                <div className="sm:col-span-2 rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
                  Salve a loja primeiro para configurar os horários de funcionamento.
                </div>
              )}
              <div className="sm:col-span-2">
                <Label>Formas de pagamento aceitas</Label>
                <p className="text-[11px] text-muted-foreground mt-1 mb-2">
                  Marque todas as opções que a loja aceita. Aparecerão para o cliente na hora de finalizar o pedido.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {PAYMENT_METHODS.map((m) => {
                    const list = editing.payment_methods_list ?? [];
                    const checked = list.includes(m.key);
                    return (
                      <label
                        key={m.key}
                        className={`flex items-center gap-2 rounded-md border p-2.5 cursor-pointer text-sm transition-colors ${
                          checked ? "border-brand bg-brand-soft" : "border-border"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            const next = e.target.checked
                              ? [...list.filter((k) => k !== m.key), m.key]
                              : list.filter((k) => k !== m.key);
                            setEditing({ ...editing, payment_methods_list: next });
                          }}
                          className="h-4 w-4 accent-[hsl(var(--brand))]"
                        />
                        <span className="font-medium">{m.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
              <div className="sm:col-span-2">
                <Label>WhatsApp da loja (com DDD)</Label>
                <Input
                  value={editing.whatsapp || ""}
                  placeholder="(11) 99999-9999"
                  onChange={(e) => setEditing({ ...editing, whatsapp: e.target.value })}
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  Obrigatório para receber pedidos (Food, E-commerce) e
                  solicitações de agendamento (Serviços).
                </p>
              </div>
              <div className="sm:col-span-2">
                <Label>Sobre</Label>
                <Textarea
                  rows={3}
                  value={editing.about || ""}
                  onChange={(e) => setEditing({ ...editing, about: e.target.value })}
                />
              </div>
            </div>
          )}
          {editing && editing.id && (
            <div className="mt-4 space-y-4">
              <StoreBenefitsEditor storeId={editing.id} />
              <StoreReelsEditor
                storeId={editing.id}
                reelsEnabled={!!editing.reels_enabled}
                onToggleEnabled={async (v) => {
                  setEditing({ ...editing, reels_enabled: v });
                  const { error } = await supabase
                    .from("stores")
                    .update({ reels_enabled: v })
                    .eq("id", editing.id!);
                  if (error) toast.error(error.message);
                  else toast.success(v ? "Seção Reels ativada" : "Seção Reels desativada");
                }}
              />
              {(
                <StoreFeedEditor
                  storeId={editing.id}
                  feedEnabled={!!editing.feed_enabled}
                  onToggleEnabled={async (v) => {
                    setEditing({ ...editing, feed_enabled: v });
                    const { error } = await supabase
                      .from("stores")
                      .update({ feed_enabled: v })
                      .eq("id", editing.id!);
                    if (error) toast.error(error.message);
                    else toast.success(v ? "Feed ativado" : "Feed desativado");
                  }}
                />
              )}
            </div>
          )}
          {editing && (editing.id || (editing as Partial<Store> & { __typed?: boolean }).__typed) && (
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button
                disabled={save.isPending || uploading || !editing?.name || !editing?.slug || !editing?.category}
                onClick={() => editing && save.mutate(editing)}
              >
                {save.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          )}
          {editing && !editing.id && !(editing as Partial<Store> & { __typed?: boolean }).__typed && (
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={mapOpen} onOpenChange={setMapOpen}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden">
          <DialogHeader className="sr-only">
            <DialogTitle>Ajustar localização da loja</DialogTitle>
          </DialogHeader>
          {mapOpen && editing && (
            <StoreLocationAdjuster
              initialLat={editing.lat ?? null}
              initialLng={editing.lng ?? null}
              fallbackQuery={[editing.address, editing.neighborhood, editing.city, editing.cep, "Brasil"]
                .filter(Boolean)
                .join(", ")}
              onCancel={() => setMapOpen(false)}
              onConfirm={(loc) => {
                setEditing((prev) => ({ ...(prev || {}), lat: loc.lat, lng: loc.lng }));
                setMapOpen(false);
                toast.success("Localização ajustada");
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
