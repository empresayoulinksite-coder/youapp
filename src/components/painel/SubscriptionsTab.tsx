import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, RefreshCw, AlertTriangle, Package, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type Plan = {
  id: string;
  store_id: string;
  name: string;
  description: string | null;
  price: number;
  total_services: number;
  validity_days: number;
  is_active: boolean;
  position: number;
};

type PlanService = { plan_id: string; service_id: string };

type Service = { id: string; name: string };

type Subscription = {
  id: string;
  store_id: string;
  plan_id: string | null;
  customer_user_id: string | null;
  customer_name: string;
  customer_phone: string | null;
  services_total: number;
  services_used: number;
  started_at: string;
  expires_at: string;
  status: "active" | "expired" | "cancelled";
  notes: string | null;
  subscription_plans?: { name: string } | null;
};

export function SubscriptionsTab({ storeId }: { storeId: string }) {
  const [innerTab, setInnerTab] = useState<"subscribers" | "plans">("subscribers");
  return (
    <div className="space-y-4">
      <Tabs value={innerTab} onValueChange={(v) => setInnerTab(v as "subscribers" | "plans")}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="subscribers" className="gap-1.5">
            <Users className="h-4 w-4" /> Assinantes
          </TabsTrigger>
          <TabsTrigger value="plans" className="gap-1.5">
            <Package className="h-4 w-4" /> Planos
          </TabsTrigger>
        </TabsList>
        <TabsContent value="subscribers" className="mt-4">
          <SubscribersList storeId={storeId} />
        </TabsContent>
        <TabsContent value="plans" className="mt-4">
          <PlansList storeId={storeId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ---------- Plans ----------

function PlansList({ storeId }: { storeId: string }) {
  const qc = useQueryClient();
  const [editTarget, setEditTarget] = useState<Plan | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ["subscription-plans", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscription_plans")
        .select("*")
        .eq("store_id", storeId)
        .order("position")
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as Plan[];
    },
  });

  const removePlan = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("subscription_plans").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Plano apagado");
      qc.invalidateQueries({ queryKey: ["subscription-plans", storeId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Crie planos com quantidade de serviços inclusos.
        </p>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> Novo plano
        </Button>
      </div>
      {isLoading ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Carregando...</p>
      ) : plans.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          Nenhum plano cadastrado ainda.
        </p>
      ) : (
        <div className="space-y-3">
          {plans.map((p) => (
            <div key={p.id} className="rounded-lg border bg-card p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold">{p.name}</h3>
                    {!p.is_active && <Badge variant="secondary">Inativo</Badge>}
                  </div>
                  {p.description && (
                    <p className="text-sm text-muted-foreground">{p.description}</p>
                  )}
                  <p className="text-sm">
                    <span className="text-muted-foreground">Inclui:</span>{" "}
                    <strong>{p.total_services}</strong> serviços ·{" "}
                    <span className="text-muted-foreground">validade:</span>{" "}
                    {p.validity_days} dias
                  </p>
                  <p className="text-sm font-medium">
                    R$ {Number(p.price).toFixed(2).replace(".", ",")}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setEditTarget(p)}>
                    <Pencil className="h-4 w-4" /> Editar
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => {
                      if (confirm("Apagar este plano?")) removePlan.mutate(p.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {(createOpen || editTarget) && (
        <PlanDialog
          storeId={storeId}
          plan={editTarget}
          onClose={() => {
            setCreateOpen(false);
            setEditTarget(null);
          }}
        />
      )}
    </div>
  );
}

function PlanDialog({
  storeId,
  plan,
  onClose,
}: {
  storeId: string;
  plan: Plan | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const isEdit = !!plan;
  const [name, setName] = useState(plan?.name ?? "");
  const [description, setDescription] = useState(plan?.description ?? "");
  const [price, setPrice] = useState(String(plan?.price ?? ""));
  const [totalServices, setTotalServices] = useState(String(plan?.total_services ?? 4));
  const [validityDays, setValidityDays] = useState(String(plan?.validity_days ?? 30));
  const [isActive, setIsActive] = useState(plan?.is_active ?? true);
  const [selectedServiceIds, setSelectedServiceIds] = useState<Set<string>>(new Set());

  const { data: services = [] } = useQuery({
    queryKey: ["services-light", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services")
        .select("id, name")
        .eq("store_id", storeId)
        .eq("is_active", true)
        .order("position");
      if (error) throw error;
      return (data ?? []) as Service[];
    },
  });

  const { data: existingPlanServices } = useQuery({
    queryKey: ["plan-services", plan?.id],
    enabled: !!plan?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscription_plan_services")
        .select("plan_id, service_id")
        .eq("plan_id", plan!.id);
      if (error) throw error;
      return (data ?? []) as PlanService[];
    },
  });

  // Initialize selected services once
  useMemo(() => {
    if (existingPlanServices) {
      setSelectedServiceIds(new Set(existingPlanServices.map((s) => s.service_id)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingPlanServices]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        store_id: storeId,
        name: name.trim(),
        description: description.trim() || null,
        price: Number(price) || 0,
        total_services: Number(totalServices) || 1,
        validity_days: Number(validityDays) || 30,
        is_active: isActive,
      };
      if (!payload.name) throw new Error("Informe o nome do plano");
      if (payload.total_services < 1) throw new Error("Total de serviços deve ser ≥ 1");

      let planId = plan?.id ?? "";
      if (isEdit) {
        const { error } = await supabase
          .from("subscription_plans")
          .update(payload)
          .eq("id", plan!.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("subscription_plans")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw error;
        planId = data.id;
      }

      // Sync subscription_plan_services
      const { error: delErr } = await supabase
        .from("subscription_plan_services")
        .delete()
        .eq("plan_id", planId);
      if (delErr) throw delErr;
      if (selectedServiceIds.size > 0) {
        const rows = Array.from(selectedServiceIds).map((service_id) => ({
          plan_id: planId,
          service_id,
        }));
        const { error: insErr } = await supabase.from("subscription_plan_services").insert(rows);
        if (insErr) throw insErr;
      }
    },
    onSuccess: () => {
      toast.success(isEdit ? "Plano atualizado" : "Plano criado");
      qc.invalidateQueries({ queryKey: ["subscription-plans", storeId] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleService = (id: string) => {
    setSelectedServiceIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar plano" : "Novo plano"}</DialogTitle>
          <DialogDescription>
            Defina os detalhes do plano de assinatura recorrente.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="plan-name">Nome do plano</Label>
            <Input
              id="plan-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Plano Premium"
            />
          </div>
          <div>
            <Label htmlFor="plan-desc">Descrição (opcional)</Label>
            <Textarea
              id="plan-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label htmlFor="plan-price">Preço (R$)</Label>
              <Input
                id="plan-price"
                type="number"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="plan-total">Serviços</Label>
              <Input
                id="plan-total"
                type="number"
                min="1"
                value={totalServices}
                onChange={(e) => setTotalServices(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="plan-valid">Validade (dias)</Label>
              <Input
                id="plan-valid"
                type="number"
                min="1"
                value={validityDays}
                onChange={(e) => setValidityDays(e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <Label htmlFor="plan-active">Plano ativo</Label>
            <Switch id="plan-active" checked={isActive} onCheckedChange={setIsActive} />
          </div>
          <div>
            <Label className="mb-2 block">Serviços inclusos</Label>
            <p className="mb-2 text-xs text-muted-foreground">
              Se nenhum for selecionado, o plano vale para qualquer serviço da loja.
            </p>
            <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border p-2">
              {services.length === 0 ? (
                <p className="py-2 text-center text-xs text-muted-foreground">
                  Cadastre serviços primeiro.
                </p>
              ) : (
                services.map((s) => (
                  <label
                    key={s.id}
                    className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-muted"
                  >
                    <input
                      type="checkbox"
                      checked={selectedServiceIds.has(s.id)}
                      onChange={() => toggleService(s.id)}
                    />
                    <span className="text-sm">{s.name}</span>
                  </label>
                ))
              )}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Subscribers ----------

function SubscribersList({ storeId }: { storeId: string }) {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [renewTarget, setRenewTarget] = useState<Subscription | null>(null);

  const { data: subs = [], isLoading } = useQuery({
    queryKey: ["client-subscriptions", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_subscriptions")
        .select("*, subscription_plans(name)")
        .eq("store_id", storeId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Subscription[];
    },
  });

  const cancelSub = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("client_subscriptions")
        .update({ status: "cancelled" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Assinatura cancelada");
      qc.invalidateQueries({ queryKey: ["client-subscriptions", storeId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeSub = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("client_subscriptions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Assinatura apagada");
      qc.invalidateQueries({ queryKey: ["client-subscriptions", storeId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const now = Date.now();

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Clientes com plano de serviços recorrentes.
        </p>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> Nova assinatura
        </Button>
      </div>
      {isLoading ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Carregando...</p>
      ) : subs.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          Nenhum cliente assinante ainda.
        </p>
      ) : (
        <div className="space-y-3">
          {subs.map((s) => {
            const remaining = s.services_total - s.services_used;
            const expired = new Date(s.expires_at).getTime() < now;
            const isActive = s.status === "active" && !expired && remaining > 0;
            const lowBalance = isActive && remaining <= 1;

            return (
              <div
                key={s.id}
                className={cn(
                  "rounded-lg border bg-card p-4",
                  lowBalance && "border-amber-500 bg-amber-50/50 dark:bg-amber-950/20",
                  (!isActive && s.status !== "cancelled") && "opacity-70",
                )}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">{s.customer_name}</h3>
                      {lowBalance && (
                        <Badge className="bg-amber-500 text-white hover:bg-amber-600">
                          <AlertTriangle className="mr-1 h-3 w-3" /> Renovar em breve
                        </Badge>
                      )}
                      {!isActive && s.status === "active" && (
                        <Badge variant="secondary">Esgotada</Badge>
                      )}
                      {s.status === "expired" && (
                        <Badge variant="secondary">Expirada</Badge>
                      )}
                      {s.status === "cancelled" && (
                        <Badge variant="outline">Cancelada</Badge>
                      )}
                    </div>
                    {s.customer_phone && (
                      <p className="text-sm text-muted-foreground">{s.customer_phone}</p>
                    )}
                    <p className="text-sm">
                      <span className="text-muted-foreground">Plano:</span>{" "}
                      {s.subscription_plans?.name ?? "—"}
                    </p>
                    <p className="text-sm">
                      <span className="text-muted-foreground">Saldo:</span>{" "}
                      <strong
                        className={cn(
                          lowBalance && "text-amber-600 dark:text-amber-400",
                        )}
                      >
                        {remaining}/{s.services_total}
                      </strong>{" "}
                      serviços restantes
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Válida até {new Date(s.expires_at).toLocaleDateString("pt-BR")}
                    </p>
                    {s.notes && (
                      <p className="text-xs text-muted-foreground">Obs: {s.notes}</p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setRenewTarget(s)}
                    >
                      <RefreshCw className="h-4 w-4" /> Renovar
                    </Button>
                    {s.status === "active" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          if (confirm("Cancelar esta assinatura?")) cancelSub.mutate(s.id);
                        }}
                      >
                        Cancelar
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => {
                        if (confirm("Apagar definitivamente?")) removeSub.mutate(s.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {createOpen && (
        <SubscriptionDialog
          storeId={storeId}
          onClose={() => setCreateOpen(false)}
        />
      )}
      {renewTarget && (
        <SubscriptionDialog
          storeId={storeId}
          renewFrom={renewTarget}
          onClose={() => setRenewTarget(null)}
        />
      )}
    </div>
  );
}

function SubscriptionDialog({
  storeId,
  renewFrom,
  onClose,
}: {
  storeId: string;
  renewFrom?: Subscription;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [customerName, setCustomerName] = useState(renewFrom?.customer_name ?? "");
  const [customerPhone, setCustomerPhone] = useState(renewFrom?.customer_phone ?? "");
  const [planId, setPlanId] = useState<string>(renewFrom?.plan_id ?? "");
  const [notes, setNotes] = useState("");
  const [paid, setPaid] = useState(true);

  const { data: plans = [] } = useQuery({
    queryKey: ["subscription-plans-active", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscription_plans")
        .select("*")
        .eq("store_id", storeId)
        .eq("is_active", true)
        .order("position");
      if (error) throw error;
      return (data ?? []) as Plan[];
    },
  });

  const selectedPlan = plans.find((p) => p.id === planId);

  const save = useMutation({
    mutationFn: async () => {
      if (!customerName.trim()) throw new Error("Informe o nome do cliente");
      if (!selectedPlan) throw new Error("Selecione um plano");
      if (!paid) throw new Error("Confirme o pagamento para ativar a assinatura");

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + selectedPlan.validity_days);

      // Try to find user_id by phone (optional)
      let customer_user_id: string | null = renewFrom?.customer_user_id ?? null;
      if (!customer_user_id && customerPhone.trim()) {
        const normalized = customerPhone.replace(/\D/g, "");
        if (normalized) {
          const { data: prof } = await supabase
            .from("profiles")
            .select("user_id, phone")
            .ilike("phone", `%${normalized.slice(-8)}%`)
            .limit(5);
          const match = (prof ?? []).find(
            (p) => p.phone && p.phone.replace(/\D/g, "") === normalized,
          );
          if (match) customer_user_id = match.user_id;
        }
      }

      const { error } = await supabase.from("client_subscriptions").insert({
        store_id: storeId,
        plan_id: selectedPlan.id,
        customer_user_id,
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim() || null,
        services_total: selectedPlan.total_services,
        services_used: 0,
        expires_at: expiresAt.toISOString(),
        status: "active",
        notes: notes.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(renewFrom ? "Assinatura renovada" : "Assinatura criada");
      qc.invalidateQueries({ queryKey: ["client-subscriptions", storeId] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {renewFrom ? "Renovar assinatura" : "Nova assinatura"}
          </DialogTitle>
          <DialogDescription>
            Registre o pagamento manual e ative o plano para o cliente.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="sub-name">Nome do cliente</Label>
            <Input
              id="sub-name"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Nome completo"
            />
          </div>
          <div>
            <Label htmlFor="sub-phone">Telefone</Label>
            <Input
              id="sub-phone"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="(11) 99999-9999"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              O telefone vincula a assinatura aos agendamentos do cliente.
            </p>
          </div>
          <div>
            <Label htmlFor="sub-plan">Plano</Label>
            <Select value={planId} onValueChange={setPlanId}>
              <SelectTrigger id="sub-plan">
                <SelectValue placeholder="Selecione o plano" />
              </SelectTrigger>
              <SelectContent>
                {plans.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} · {p.total_services} serviços · R${" "}
                    {Number(p.price).toFixed(2).replace(".", ",")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="sub-notes">Observações</Label>
            <Textarea
              id="sub-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label htmlFor="sub-paid" className="text-sm">
                Pagamento confirmado
              </Label>
              <p className="text-xs text-muted-foreground">
                Marque após receber o pagamento do cliente.
              </p>
            </div>
            <Switch id="sub-paid" checked={paid} onCheckedChange={setPaid} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "Salvando..." : renewFrom ? "Renovar" : "Criar assinatura"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
