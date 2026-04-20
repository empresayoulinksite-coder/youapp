import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2 } from "lucide-react";
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
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";

export const Route = createFileRoute("/admin/cupons")({
  component: AdminCoupons,
});

type Coupon = {
  id: string;
  code: string;
  title: string;
  description: string | null;
  discount_type: string;
  discount_value: number;
  min_order: number;
  max_discount: number | null;
  is_active: boolean;
  expires_at: string | null;
  usage_limit: number | null;
};

type StoreCoupon = {
  id: string;
  store_id: string;
  code: string;
  title: string;
  description: string | null;
  discount_label: string;
  min_order: number;
};

function AdminCoupons() {
  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">Cupons</h1>
      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">Cupons gerais</TabsTrigger>
          <TabsTrigger value="store">Cupons de loja</TabsTrigger>
        </TabsList>
        <TabsContent value="general"><GeneralCoupons /></TabsContent>
        <TabsContent value="store"><StoreCoupons /></TabsContent>
      </Tabs>
    </div>
  );
}

function GeneralCoupons() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Coupon> | null>(null);

  const { data: coupons = [] } = useQuery({
    queryKey: ["admin-coupons"],
    queryFn: async () => {
      const { data, error } = await supabase.from("coupons").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Coupon[];
    },
  });

  const save = useMutation({
    mutationFn: async (c: Partial<Coupon>) => {
      const payload = {
        code: c.code!.toUpperCase(),
        title: c.title!,
        description: c.description || null,
        discount_type: c.discount_type || "percent",
        discount_value: Number(c.discount_value) || 0,
        min_order: Number(c.min_order) || 0,
        max_discount: c.max_discount ? Number(c.max_discount) : null,
        is_active: c.is_active ?? true,
        expires_at: c.expires_at || null,
        usage_limit: c.usage_limit ? Number(c.usage_limit) : null,
      };
      if (c.id) {
        const { error } = await supabase.from("coupons").update(payload).eq("id", c.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("coupons").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Cupom salvo");
      qc.invalidateQueries({ queryKey: ["admin-coupons"] });
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("coupons").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Cupom excluído");
      qc.invalidateQueries({ queryKey: ["admin-coupons"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mt-4">
      <div className="mb-3 flex justify-end">
        <Button onClick={() => { setEditing({ discount_type: "percent", is_active: true, min_order: 0 }); setOpen(true); }}>
          <Plus className="h-4 w-4" /> Novo cupom
        </Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {coupons.map((c) => (
          <div key={c.id} className="rounded-lg border bg-background p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="rounded bg-primary/10 px-2 py-0.5 font-mono text-xs font-bold text-primary">{c.code}</span>
              <span className={`text-xs ${c.is_active ? "text-green-600" : "text-muted-foreground"}`}>
                {c.is_active ? "Ativo" : "Inativo"}
              </span>
            </div>
            <h3 className="font-semibold">{c.title}</h3>
            <p className="text-xs text-muted-foreground">
              {c.discount_type === "percent" ? `${c.discount_value}% OFF` : `R$ ${c.discount_value} OFF`}
              {c.min_order > 0 && ` · mín R$ ${c.min_order}`}
            </p>
            <div className="mt-3 flex gap-2">
              <Button size="sm" variant="outline" className="flex-1" onClick={() => { setEditing(c); setOpen(true); }}>
                <Pencil className="h-3 w-3" /> Editar
              </Button>
              <Button size="sm" variant="destructive" onClick={() => { if (confirm("Excluir?")) del.mutate(c.id); }}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing?.id ? "Editar cupom" : "Novo cupom"}</DialogTitle></DialogHeader>
          {editing && (
            <div className="grid gap-3">
              <div><Label>Código</Label><Input value={editing.code || ""} onChange={(e) => setEditing({ ...editing, code: e.target.value })} placeholder="PRIMEIRA10" /></div>
              <div><Label>Título</Label><Input value={editing.title || ""} onChange={(e) => setEditing({ ...editing, title: e.target.value })} /></div>
              <div><Label>Descrição</Label><Textarea rows={2} value={editing.description || ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Tipo</Label>
                  <Select value={editing.discount_type || "percent"} onValueChange={(v) => setEditing({ ...editing, discount_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percent">Porcentagem</SelectItem>
                      <SelectItem value="fixed">Valor fixo (R$)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Valor</Label><Input type="number" step="0.01" value={editing.discount_value ?? ""} onChange={(e) => setEditing({ ...editing, discount_value: Number(e.target.value) })} /></div>
                <div><Label>Mínimo do pedido (R$)</Label><Input type="number" step="0.01" value={editing.min_order ?? 0} onChange={(e) => setEditing({ ...editing, min_order: Number(e.target.value) })} /></div>
                <div><Label>Desconto máximo (R$)</Label><Input type="number" step="0.01" value={editing.max_discount ?? ""} onChange={(e) => setEditing({ ...editing, max_discount: e.target.value ? Number(e.target.value) : null })} /></div>
                <div><Label>Limite de uso</Label><Input type="number" value={editing.usage_limit ?? ""} onChange={(e) => setEditing({ ...editing, usage_limit: e.target.value ? Number(e.target.value) : null })} /></div>
                <div><Label>Expira em</Label><Input type="datetime-local" value={editing.expires_at?.slice(0, 16) || ""} onChange={(e) => setEditing({ ...editing, expires_at: e.target.value ? new Date(e.target.value).toISOString() : null })} /></div>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="active" checked={editing.is_active ?? true} onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })} />
                <Label htmlFor="active">Ativo</Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button disabled={save.isPending || !editing?.code || !editing?.title} onClick={() => editing && save.mutate(editing)}>
              {save.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StoreCoupons() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<StoreCoupon> | null>(null);

  const { data: stores = [] } = useQuery({
    queryKey: ["admin-stores-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("stores").select("id,name").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: coupons = [] } = useQuery({
    queryKey: ["admin-store-coupons"],
    queryFn: async () => {
      const { data, error } = await supabase.from("store_coupons").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as StoreCoupon[];
    },
  });

  const save = useMutation({
    mutationFn: async (c: Partial<StoreCoupon>) => {
      const payload = {
        store_id: c.store_id!,
        code: c.code!.toUpperCase(),
        title: c.title!,
        description: c.description || null,
        discount_label: c.discount_label!,
        min_order: Number(c.min_order) || 0,
      };
      if (c.id) {
        const { error } = await supabase.from("store_coupons").update(payload).eq("id", c.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("store_coupons").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Cupom salvo");
      qc.invalidateQueries({ queryKey: ["admin-store-coupons"] });
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("store_coupons").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Excluído");
      qc.invalidateQueries({ queryKey: ["admin-store-coupons"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mt-4">
      <div className="mb-3 flex justify-end">
        <Button onClick={() => { setEditing({ min_order: 0 }); setOpen(true); }}>
          <Plus className="h-4 w-4" /> Novo cupom de loja
        </Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {coupons.map((c) => {
          const store = stores.find((s) => s.id === c.store_id);
          return (
            <div key={c.id} className="rounded-lg border bg-background p-3">
              <p className="text-xs text-muted-foreground">{store?.name}</p>
              <div className="mb-1 flex items-center justify-between">
                <span className="rounded bg-primary/10 px-2 py-0.5 font-mono text-xs font-bold text-primary">{c.code}</span>
                <span className="text-xs font-bold">{c.discount_label}</span>
              </div>
              <h3 className="font-semibold">{c.title}</h3>
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="outline" className="flex-1" onClick={() => { setEditing(c); setOpen(true); }}>
                  <Pencil className="h-3 w-3" /> Editar
                </Button>
                <Button size="sm" variant="destructive" onClick={() => { if (confirm("Excluir?")) del.mutate(c.id); }}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing?.id ? "Editar" : "Novo"} cupom de loja</DialogTitle></DialogHeader>
          {editing && (
            <div className="grid gap-3">
              <div>
                <Label>Loja</Label>
                <Select value={editing.store_id || ""} onValueChange={(v) => setEditing({ ...editing, store_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Escolha" /></SelectTrigger>
                  <SelectContent>
                    {stores.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Código</Label><Input value={editing.code || ""} onChange={(e) => setEditing({ ...editing, code: e.target.value })} /></div>
              <div><Label>Título</Label><Input value={editing.title || ""} onChange={(e) => setEditing({ ...editing, title: e.target.value })} /></div>
              <div><Label>Descrição</Label><Textarea rows={2} value={editing.description || ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></div>
              <div><Label>Desconto (texto)</Label><Input value={editing.discount_label || ""} onChange={(e) => setEditing({ ...editing, discount_label: e.target.value })} placeholder="Ex: 20% OFF ou R$10 OFF" /></div>
              <div><Label>Mínimo do pedido (R$)</Label><Input type="number" step="0.01" value={editing.min_order ?? 0} onChange={(e) => setEditing({ ...editing, min_order: Number(e.target.value) })} /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button disabled={save.isPending || !editing?.store_id || !editing?.code || !editing?.title || !editing?.discount_label} onClick={() => editing && save.mutate(editing)}>
              {save.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
