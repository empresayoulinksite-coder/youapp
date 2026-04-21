import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, UtensilsCrossed, ShoppingBag, Briefcase, Pause, Play } from "lucide-react";
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
  promo: string | null;
  image_url: string | null;
  about: string | null;
  cep: string | null;
  address: string | null;
  neighborhood: string | null;
  city: string | null;
  hours: string | null;
  payment_methods: string | null;
  min_order: number;
  is_paused: boolean;
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
  promo: "",
  image_url: "",
  about: "",
  cep: "",
  address: "",
  neighborhood: "",
  city: "",
  hours: "",
  payment_methods: "",
  min_order: 0,
};

function AdminStores() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Store> | null>(null);
  const [uploading, setUploading] = useState(false);

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
        promo: s.promo || null,
        image_url: s.image_url || null,
        about: s.about || null,
        cep: s.cep || null,
        address: s.address || null,
        neighborhood: s.neighborhood || null,
        city: s.city || null,
        hours: s.hours || null,
        payment_methods: s.payment_methods || null,
        min_order: Number(s.min_order) || 0,
      };
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
                  <h3 className="truncate font-semibold">{s.name}</h3>
                  <div className="flex items-center gap-1.5">
                    <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                      {STORE_TYPES.find((t) => t.value === s.store_type)?.label ?? "Food"}
                    </span>
                    <p className="truncate text-xs text-muted-foreground">{s.category}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">⭐ {s.rating} · {s.delivery_time}</p>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setEditing(s);
                    setOpen(true);
                  }}
                >
                  <Pencil className="h-3 w-3" /> Editar
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
                <Input
                  value={editing.category || ""}
                  onChange={(e) => setEditing({ ...editing, category: e.target.value })}
                  placeholder="Pizza, Lanches, Doces..."
                />
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
              {editing.store_type === "food" && (
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
                      onChange={(e) => setEditing({ ...editing, free_delivery: e.target.checked })}
                    />
                    <Label htmlFor="free">Entrega grátis</Label>
                  </div>
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
                <Label>Formas de pagamento</Label>
                <Input
                  value={editing.payment_methods || ""}
                  onChange={(e) => setEditing({ ...editing, payment_methods: e.target.value })}
                  placeholder="Pix, Cartão, Dinheiro"
                />
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
    </div>
  );
}
