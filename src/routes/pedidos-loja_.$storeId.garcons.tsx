import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Users, Plus, MoreVertical, KeyRound, Trash2, Power } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/pedidos-loja_/$storeId/garcons")({
  beforeLoad: async ({ params }) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw redirect({ to: "/auth" });
    const { data, error } = await supabase.rpc("can_manage_store_orders", {
      _user_id: session.user.id,
      _store_id: params.storeId,
    });
    if (error || !data) throw redirect({ to: "/painel" });
  },
  component: GarconsPage,
});

type Waiter = {
  id: string;
  store_id: string;
  full_name: string;
  is_active: boolean;
  created_at: string;
  permissions: {
    can_edit_orders: boolean;
    can_cancel_orders: boolean;
    auto_print_orders: boolean;
  } | null;
};

const waiterSchema = z.object({
  full_name: z.string().trim().min(1, "Nome é obrigatório").max(80),
  pin: z.string().regex(/^\d{4}$/, "PIN deve ter exatamente 4 dígitos"),
  confirmPin: z.string(),
}).refine((d) => d.pin === d.confirmPin, {
  message: "Os PINs não conferem",
  path: ["confirmPin"],
});

function GarconsPage() {
  const { storeId } = Route.useParams();
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [pinDialogFor, setPinDialogFor] = useState<Waiter | null>(null);
  const [deleteDialogFor, setDeleteDialogFor] = useState<Waiter | null>(null);

  const { data: waiters, isLoading } = useQuery({
    queryKey: ["store-waiters", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_waiters")
        .select("id, store_id, full_name, is_active, created_at, permissions:store_waiter_permissions(can_edit_orders, can_cancel_orders, auto_print_orders)")
        .eq("store_id", storeId)
        .order("full_name");
      if (error) throw error;
      return (data ?? []).map((w: any) => ({
        ...w,
        permissions: Array.isArray(w.permissions) ? w.permissions[0] ?? null : w.permissions,
      })) as Waiter[];
    },
  });

  const togglePermission = useMutation({
    mutationFn: async ({ waiterId, field, value }: { waiterId: string; field: "can_edit_orders" | "can_cancel_orders" | "auto_print_orders"; value: boolean }) => {
      const { error } = await supabase
        .from("store_waiter_permissions")
        .update({ [field]: value } as any)
        .eq("waiter_id", waiterId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["store-waiters", storeId] }),
    onError: (e: any) => toast.error(e.message ?? "Erro ao atualizar permissão"),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("store_waiters").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["store-waiters", storeId] }),
    onError: (e: any) => toast.error(e.message ?? "Erro ao atualizar status"),
  });

  const deleteWaiter = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("store_waiters").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["store-waiters", storeId] });
      toast.success("Garçom removido");
      setDeleteDialogFor(null);
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao remover"),
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <Link
        to="/pedidos-loja/$storeId"
        params={{ storeId }}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar ao painel
      </Link>

      <header className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-purple-100 p-2 text-purple-600 dark:bg-purple-950/40">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold">App do garçom</h1>
            <p className="text-sm text-muted-foreground">
              Cadastre os garçons desta loja e defina o que cada um pode fazer no aplicativo.
            </p>
          </div>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="shrink-0">
          <Plus className="h-4 w-4" />
          Novo garçom
        </Button>
      </header>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : !waiters || waiters.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center">
          <Users className="mx-auto h-10 w-10 text-muted-foreground/50" />
          <p className="mt-3 text-sm text-muted-foreground">
            Nenhum garçom cadastrado ainda. Clique em <strong>Novo garçom</strong> para começar.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {waiters.map((w) => (
            <div key={w.id} className="rounded-lg border bg-card p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{w.full_name}</h3>
                    {!w.is_active && (
                      <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                        Inativo
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">PIN de 4 dígitos definido</p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setPinDialogFor(w)}>
                      <KeyRound className="h-4 w-4" />
                      Trocar PIN
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => toggleActive.mutate({ id: w.id, is_active: !w.is_active })}
                    >
                      <Power className="h-4 w-4" />
                      {w.is_active ? "Desativar" : "Reativar"}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setDeleteDialogFor(w)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                      Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <PermissionToggle
                  label="Editar pedidos"
                  description="Pode modificar pedidos já gerados"
                  checked={!!w.permissions?.can_edit_orders}
                  onCheckedChange={(v) =>
                    togglePermission.mutate({ waiterId: w.id, field: "can_edit_orders", value: v })
                  }
                />
                <PermissionToggle
                  label="Cancelar pedidos"
                  description="Pode cancelar pedidos pelo app"
                  checked={!!w.permissions?.can_cancel_orders}
                  onCheckedChange={(v) =>
                    togglePermission.mutate({ waiterId: w.id, field: "can_cancel_orders", value: v })
                  }
                />
                <PermissionToggle
                  label="Impressão automática"
                  description="Imprime os pedidos automaticamente"
                  checked={!!w.permissions?.auto_print_orders}
                  onCheckedChange={(v) =>
                    togglePermission.mutate({ waiterId: w.id, field: "auto_print_orders", value: v })
                  }
                />
              </div>
            </div>
          ))}
        </div>
      )}

      <CreateWaiterDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        storeId={storeId}
        onCreated={() => qc.invalidateQueries({ queryKey: ["store-waiters", storeId] })}
      />

      <ChangePinDialog
        waiter={pinDialogFor}
        onClose={() => setPinDialogFor(null)}
      />

      <AlertDialog open={!!deleteDialogFor} onOpenChange={(o) => !o && setDeleteDialogFor(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir garçom?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteDialogFor?.full_name} não conseguirá mais entrar no app. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteDialogFor && deleteWaiter.mutate(deleteDialogFor.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function PermissionToggle({
  label,
  description,
  checked,
  onCheckedChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-md border bg-background p-3">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

function CreateWaiterDialog({
  open,
  onOpenChange,
  storeId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  storeId: string;
  onCreated: () => void;
}) {
  const [fullName, setFullName] = useState("");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setFullName("");
    setPin("");
    setConfirmPin("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = waiterSchema.safeParse({ full_name: fullName, pin, confirmPin });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("store_waiters").insert({
      store_id: storeId,
      full_name: parsed.data.full_name,
      pin: parsed.data.pin,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Garçom cadastrado");
    reset();
    onOpenChange(false);
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Novo garçom</DialogTitle>
            <DialogDescription>
              Defina o nome e um PIN de 4 dígitos. O garçom usará o PIN para entrar no app.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 space-y-4">
            <div>
              <Label htmlFor="full_name">Nome</Label>
              <Input
                id="full_name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                maxLength={80}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="pin">PIN (4 dígitos)</Label>
                <Input
                  id="pin"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  inputMode="numeric"
                  maxLength={4}
                  required
                />
              </div>
              <div>
                <Label htmlFor="confirmPin">Confirmar PIN</Label>
                <Input
                  id="confirmPin"
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  inputMode="numeric"
                  maxLength={4}
                  required
                />
              </div>
            </div>
          </div>
          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Salvando..." : "Cadastrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ChangePinDialog({
  waiter,
  onClose,
}: {
  waiter: Waiter | null;
  onClose: () => void;
}) {
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!waiter) return;
    if (!/^\d{4}$/.test(pin)) {
      toast.error("PIN deve ter 4 dígitos");
      return;
    }
    if (pin !== confirmPin) {
      toast.error("Os PINs não conferem");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("store_waiters").update({ pin }).eq("id", waiter.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("PIN atualizado");
    setPin("");
    setConfirmPin("");
    onClose();
  };

  return (
    <Dialog open={!!waiter} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Trocar PIN de {waiter?.full_name}</DialogTitle>
            <DialogDescription>Defina um novo PIN de 4 dígitos.</DialogDescription>
          </DialogHeader>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="new_pin">Novo PIN</Label>
              <Input
                id="new_pin"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                inputMode="numeric"
                maxLength={4}
                required
              />
            </div>
            <div>
              <Label htmlFor="confirm_new_pin">Confirmar</Label>
              <Input
                id="confirm_new_pin"
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                inputMode="numeric"
                maxLength={4}
                required
              />
            </div>
          </div>
          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
