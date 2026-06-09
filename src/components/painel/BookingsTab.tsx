import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Check,
  X,
  CheckCircle2,
  Clock,
  CalendarIcon,
  Phone,
  MessageSquare,
  Calendar as CalIcon,
  Plus,
  Banknote,
  ChevronDown,
  ChevronUp,
  Pencil,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { generateSlots, formatSlotLabel, type BookedRange } from "@/lib/booking-slots";
import type { StoreHour } from "@/lib/store-hours";
import { cn } from "@/lib/utils";
import { PAYMENT_METHODS } from "@/lib/payment-methods";
import { getEffectivePrice, type PromoPrice } from "@/lib/service-pricing";

type ServiceLite = {
  id: string;
  name: string;
  duration_minutes: number;
  price: number;
  promo_prices?: PromoPrice[] | null;
};

export type BookedServiceItem = {
  service_id: string;
  name: string;
  duration_minutes: number;
  price: number;
  starts_at: string;
  ends_at: string;
};

export type BookingRow = {
  id: string;
  status: "pending" | "confirmed" | "cancelled" | "completed";
  starts_at: string;
  ends_at: string;
  total_price: number;
  customer_notes: string | null;
  user_id: string;
  store_id: string;
  service_id: string;
  payment_method: string | null;
  payment_method_2: string | null;
  payment_amount_1: number | null;
  payment_amount_2: number | null;
  booked_services: BookedServiceItem[] | null;
  services: { name: string; duration_minutes: number } | null;
  profiles?: { display_name: string | null; phone: string | null } | null;
};

export type StoreLite = {
  id: string;
  name: string;
  slot_minutes: number;
  whatsapp: string | null;
  is_paused: boolean;
  pickup_enabled?: boolean;
  store_type?: "food" | "ecommerce" | "service";
  feed_enabled?: boolean;
  booking_mode?: "booking" | "quote";
  category?: string;
};

const STATUS_LABEL: Record<BookingRow["status"], string> = {
  pending: "Pendente",
  confirmed: "Confirmado",
  cancelled: "Cancelado",
  completed: "Concluído",
};

const STATUS_VARIANT: Record<
  BookingRow["status"],
  "default" | "secondary" | "destructive" | "outline"
> = {
  pending: "outline",
  confirmed: "default",
  completed: "secondary",
  cancelled: "destructive",
};
/** Get display label for booking services */
function getBookingServiceLabel(booking: BookingRow): string {
  if (booking.booked_services && booking.booked_services.length > 0) {
    return booking.booked_services.map((s) => s.name).join(" + ");
  }
  return booking.services?.name ?? "Serviço";
}

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

function CashOpenMenu({
  getElapsedTime,
  cashRegister,
  onDeposit,
  onWithdrawal,
  onSummary,
  onCloseCash,
}: {
  getElapsedTime?: (openedAt?: string) => string;
  cashRegister?: { opened_at: string } | null;
  onDeposit?: () => void;
  onWithdrawal?: () => void;
  onSummary?: () => void;
  onCloseCash?: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="flex items-center gap-2 rounded-lg bg-green-600 px-3 py-1.5 text-white text-sm font-semibold"
        onClick={() => setOpen(!open)}
      >
        <Banknote className="h-4 w-4" />
        Caixa
        {open ? <ChevronUp className="h-3 w-3 opacity-70" /> : <ChevronDown className="h-3 w-3 opacity-70" />}
      </button>
      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 w-56 rounded-lg border bg-card p-3 shadow-lg space-y-2">
          <p className="text-xs text-muted-foreground">
            Aberto há: {getElapsedTime?.(cashRegister?.opened_at) ?? ""}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Button size="sm" variant="outline" onClick={() => { onDeposit?.(); setOpen(false); }}>Reforço</Button>
            <Button size="sm" variant="outline" onClick={() => { onWithdrawal?.(); setOpen(false); }}>Sangria</Button>
            <Button size="sm" variant="outline" onClick={() => { onSummary?.(); setOpen(false); }}>Resumo</Button>
            <Button size="sm" variant="destructive" onClick={() => { onCloseCash?.(); setOpen(false); }}>Fechar</Button>
          </div>
        </div>
      )}
    </>
  );
}

export function BookingsTab({
  store,
  bookings,
  loading,
  cashRegister,
  isCashOpen,
  onOpenCash,
  onCloseCash,
  onDeposit,
  onWithdrawal,
  onSummary,
  getElapsedTime,
}: {
  store: StoreLite;
  bookings: BookingRow[];
  loading: boolean;
  cashRegister?: { id: string; opened_at: string; opening_balance: number; status: string } | null;
  isCashOpen?: boolean;
  onOpenCash?: () => void;
  onCloseCash?: () => void;
  onDeposit?: () => void;
  onWithdrawal?: () => void;
  onSummary?: () => void;
  getElapsedTime?: (openedAt?: string) => string;
}) {
  const qc = useQueryClient();
  const { user: authUser } = useAuth();
  const [tab, setTab] = useState("pending");
  const [reschedFor, setReschedFor] = useState<BookingRow | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [completeTarget, setCompleteTarget] = useState<BookingRow | null>(null);
  const [completePayment, setCompletePayment] = useState("");
  const [splitEnabled, setSplitEnabled] = useState(false);
  const [completePayment2, setCompletePayment2] = useState("");
  const [splitAmount1, setSplitAmount1] = useState("");
  const [splitAmount2, setSplitAmount2] = useState("");
  const [editTarget, setEditTarget] = useState<BookingRow | null>(null);
  const [editPayment, setEditPayment] = useState("");
  const [editSplit, setEditSplit] = useState(false);
  const [editPayment2, setEditPayment2] = useState("");
  const [editAmount1, setEditAmount1] = useState("");
  const [editAmount2, setEditAmount2] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [changeAmount, setChangeAmount] = useState("");

  const updateStatus = useMutation({
    mutationFn: async ({ id, status, payment_method, payment_method_2, payment_amount_1, payment_amount_2, change_amount }: { id: string; status: BookingRow["status"]; payment_method?: string; payment_method_2?: string; payment_amount_1?: number; payment_amount_2?: number; change_amount?: number }) => {
      const updateData = {
        status,
        payment_method: payment_method ?? null,
        payment_method_2: payment_method_2 ?? null,
        payment_amount_1: payment_amount_1 ?? null,
        payment_amount_2: payment_amount_2 ?? null,
        change_amount: change_amount ?? 0,
      };
      const { error } = await supabase
        .from("bookings")
        .update(updateData)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: async (_d, vars) => {
      toast.success(`Agendamento ${STATUS_LABEL[vars.status].toLowerCase()}`);
      qc.invalidateQueries({ queryKey: ["painel", "bookings"] });

      // Registrar troco como saída no caixa se estiver aberto
      if (
        vars.status === "completed" &&
        (vars.change_amount ?? 0) > 0 &&
        isCashOpen &&
        cashRegister?.id &&
        authUser?.id
      ) {
        const { error: txErr } = await supabase.from("cash_transactions").insert({
          cash_register_id: cashRegister.id,
          type: "withdrawal",
          amount: vars.change_amount!,
          reason: "Troco - Agendamento",
          user_id: authUser.id,
        });
        if (txErr) {
          toast.error("Erro ao registrar troco no caixa");
        } else {
          toast.info("Troco registrado no caixa");
          qc.invalidateQueries({ queryKey: ["painel", "cash"] });
        }
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const editBooking = useMutation({
    mutationFn: async (vars: { id: string; total_price: number; payment_method: string; payment_method_2?: string; payment_amount_1?: number; payment_amount_2?: number }) => {
      const { error } = await supabase
        .from("bookings")
        .update({
          total_price: vars.total_price,
          payment_method: vars.payment_method,
          payment_method_2: vars.payment_method_2 ?? null,
          payment_amount_1: vars.payment_amount_1 ?? null,
          payment_amount_2: vars.payment_amount_2 ?? null,
        })
        .eq("id", vars.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Agendamento atualizado");
      qc.invalidateQueries({ queryKey: ["painel", "bookings"] });
      setEditTarget(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteBooking = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("bookings").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Agendamento apagado");
      qc.invalidateQueries({ queryKey: ["painel", "bookings"] });
      setEditTarget(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = useMemo(
    () => {
      const now = Date.now();
      return bookings
        .filter((b) => (tab === "all" ? true : b.status === tab))
        .sort((a, b) => {
          if (tab === "completed" || tab === "cancelled") {
            return new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime();
          }
          // Próximo atendimento primeiro: futuros em ordem crescente (mais próximo no topo),
          // passados (atrasados) abaixo em ordem decrescente.
          const aTime = new Date(a.starts_at).getTime();
          const bTime = new Date(b.starts_at).getTime();
          const aFuture = aTime >= now;
          const bFuture = bTime >= now;
          if (aFuture && !bFuture) return -1;
          if (!aFuture && bFuture) return 1;
          if (aFuture && bFuture) return aTime - bTime;
          return bTime - aTime;
        });
    },
    [bookings, tab],
  );

  const counts = {
    pending: bookings.filter((b) => b.status === "pending").length,
    confirmed: bookings.filter((b) => b.status === "confirmed").length,
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        {/* Cash register button */}
        <div className="flex items-center gap-2">
          {isCashOpen ? (
            <div className="relative">
              <CashOpenMenu
                getElapsedTime={getElapsedTime}
                cashRegister={cashRegister}
                onDeposit={onDeposit}
                onWithdrawal={onWithdrawal}
                onSummary={onSummary}
                onCloseCash={onCloseCash}
              />
            </div>
          ) : onOpenCash ? (
            <Button size="sm" variant="outline" onClick={onOpenCash}>
              <Banknote className="h-4 w-4" /> Abrir caixa
            </Button>
          ) : null}
        </div>
        <Button size="sm" onClick={() => setNewOpen(true)}>
          <Plus className="h-4 w-4" /> Novo agendamento
        </Button>
      </div>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="pending">
            Pendentes {counts.pending > 0 && `(${counts.pending})`}
          </TabsTrigger>
          <TabsTrigger value="confirmed">
            Confirmados {counts.confirmed > 0 && `(${counts.confirmed})`}
          </TabsTrigger>
          <TabsTrigger value="completed">Concluídos</TabsTrigger>
          <TabsTrigger value="cancelled">Cancelados</TabsTrigger>
          <TabsTrigger value="all">Todos</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          {loading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Carregando...</p>
          ) : filtered.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              Nenhum agendamento.
            </p>
          ) : (
            <div className="space-y-3">
              {filtered.map((b) => (
                <BookingCard
                  key={b.id}
                  booking={b}
                  onUpdate={(status) => {
                    if (status === "completed") {
                      setCompleteTarget(b);
                      setCompletePayment("");
                      setSplitEnabled(false);
                      setCompletePayment2("");
                      setSplitAmount1("");
                      setSplitAmount2("");
                      setChangeAmount("");
                      return;
                    }
                    updateStatus.mutate({ id: b.id, status });
                  }}
                  onReschedule={() => setReschedFor(b)}
                  onEdit={() => {
                    setEditTarget(b);
                    setEditPayment(b.payment_method ?? "");
                    setEditSplit(!!b.payment_method_2);
                    setEditPayment2(b.payment_method_2 ?? "");
                    setEditAmount1(b.payment_amount_1 != null ? String(b.payment_amount_1) : "");
                    setEditAmount2(b.payment_amount_2 != null ? String(b.payment_amount_2) : "");
                    setEditPrice(String(b.total_price ?? 0));
                  }}
                  pending={updateStatus.isPending}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {reschedFor && (
        <RescheduleDialog
          booking={reschedFor}
          store={store}
          onClose={() => setReschedFor(null)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["painel", "bookings"] });
            setReschedFor(null);
          }}
        />
      )}

      {newOpen && (
        <NewBookingDialog
          store={store}
          onClose={() => setNewOpen(false)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["painel", "bookings"] });
            setNewOpen(false);
          }}
        />
      )}

      <Dialog open={!!completeTarget} onOpenChange={(o) => { if (!o) setCompleteTarget(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Concluir agendamento</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {splitEnabled ? "Selecione o 1º método:" : "Selecione a forma de pagamento utilizada:"}
          </p>
          <div className="grid grid-cols-2 gap-2">
            {PAYMENT_METHODS.map((m) => (
              <Button
                key={m.key}
                size="sm"
                variant={completePayment === m.key ? "default" : "outline"}
                onClick={() => setCompletePayment(m.key)}
              >
                {m.label}
              </Button>
            ))}
          </div>

          {splitEnabled && (
            <>
              <p className="text-sm text-muted-foreground mt-2">Selecione o 2º método:</p>
              <div className="grid grid-cols-2 gap-2">
                {PAYMENT_METHODS.filter((m) => m.key !== completePayment).map((m) => (
                  <Button
                    key={m.key}
                    size="sm"
                    variant={completePayment2 === m.key ? "default" : "outline"}
                    onClick={() => setCompletePayment2(m.key)}
                  >
                    {m.label}
                  </Button>
                ))}
              </div>

              {completeTarget && (
                <div className="space-y-2 mt-2">
                  <p className="text-xs text-muted-foreground">
                    Total: R$ {(completeTarget.total_price ?? 0).toFixed(2).replace(".", ",")}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-muted-foreground">Valor 1º</label>
                      <input
                        type="number"
                        step="0.01"
                        className="w-full rounded-md border bg-background px-3 py-1.5 text-sm"
                        placeholder="0,00"
                        value={splitAmount1}
                        onChange={(e) => {
                          setSplitAmount1(e.target.value);
                          const total = completeTarget.total_price ?? 0;
                          const v = parseFloat(e.target.value) || 0;
                          setSplitAmount2((total - v).toFixed(2));
                        }}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Valor 2º</label>
                      <input
                        type="number"
                        step="0.01"
                        className="w-full rounded-md border bg-background px-3 py-1.5 text-sm"
                        placeholder="0,00"
                        value={splitAmount2}
                        onChange={(e) => {
                          setSplitAmount2(e.target.value);
                          const total = completeTarget.total_price ?? 0;
                          const v = parseFloat(e.target.value) || 0;
                          setSplitAmount1((total - v).toFixed(2));
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          <div className="flex items-center gap-2 mt-2">
            <input
              type="checkbox"
              id="split-toggle"
              checked={splitEnabled}
              onChange={(e) => {
                setSplitEnabled(e.target.checked);
                if (!e.target.checked) {
                  setCompletePayment2("");
                  setSplitAmount1("");
                  setSplitAmount2("");
                }
              }}
              className="rounded border"
            />
            <label htmlFor="split-toggle" className="text-sm cursor-pointer">Dividir pagamento</label>
          </div>

          {(completePayment === "dinheiro" || (splitEnabled && completePayment2 === "dinheiro")) && (
            <div className="mt-2">
              <Label className="text-sm">Troco (R$)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="0,00"
                value={changeAmount}
                onChange={(e) => setChangeAmount(e.target.value)}
              />
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setCompleteTarget(null)}>
              Cancelar
            </Button>
            <Button
              disabled={
                !completePayment ||
                (splitEnabled && (!completePayment2 || !splitAmount1 || !splitAmount2)) ||
                updateStatus.isPending
              }
              onClick={() => {
                if (!completeTarget) return;
                updateStatus.mutate(
                  {
                    id: completeTarget.id,
                    status: "completed",
                    payment_method: completePayment,
                    change_amount: parseFloat(changeAmount) || 0,
                    ...(splitEnabled
                      ? {
                          payment_method_2: completePayment2,
                          payment_amount_1: parseFloat(splitAmount1) || 0,
                          payment_amount_2: parseFloat(splitAmount2) || 0,
                        }
                      : {}),
                  },
                  { onSuccess: () => setCompleteTarget(null) },
                );
              }}
            >
              <CheckCircle2 className="h-4 w-4" /> Concluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editTarget} onOpenChange={(o) => { if (!o) setEditTarget(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Editar agendamento</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <Label className="text-sm">Valor total</Label>
              <Input
                type="number"
                step="0.01"
                value={editPrice}
                onChange={(e) => setEditPrice(e.target.value)}
                placeholder="0,00"
              />
            </div>

            <div>
              <p className="text-sm text-muted-foreground mb-1">
                {editSplit ? "1º método de pagamento:" : "Forma de pagamento:"}
              </p>
              <div className="grid grid-cols-2 gap-2">
                {PAYMENT_METHODS.map((m) => (
                  <Button
                    key={m.key}
                    size="sm"
                    variant={editPayment === m.key ? "default" : "outline"}
                    onClick={() => setEditPayment(m.key)}
                  >
                    {m.label}
                  </Button>
                ))}
              </div>
            </div>

            {editSplit && (
              <>
                <p className="text-sm text-muted-foreground">2º método de pagamento:</p>
                <div className="grid grid-cols-2 gap-2">
                  {PAYMENT_METHODS.filter((m) => m.key !== editPayment).map((m) => (
                    <Button
                      key={m.key}
                      size="sm"
                      variant={editPayment2 === m.key ? "default" : "outline"}
                      onClick={() => setEditPayment2(m.key)}
                    >
                      {m.label}
                    </Button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-muted-foreground">Valor 1º</label>
                    <input
                      type="number"
                      step="0.01"
                      className="w-full rounded-md border bg-background px-3 py-1.5 text-sm"
                      value={editAmount1}
                      onChange={(e) => {
                        setEditAmount1(e.target.value);
                        const total = parseFloat(editPrice) || 0;
                        const v = parseFloat(e.target.value) || 0;
                        setEditAmount2((total - v).toFixed(2));
                      }}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Valor 2º</label>
                    <input
                      type="number"
                      step="0.01"
                      className="w-full rounded-md border bg-background px-3 py-1.5 text-sm"
                      value={editAmount2}
                      onChange={(e) => {
                        setEditAmount2(e.target.value);
                        const total = parseFloat(editPrice) || 0;
                        const v = parseFloat(e.target.value) || 0;
                        setEditAmount1((total - v).toFixed(2));
                      }}
                    />
                  </div>
                </div>
              </>
            )}

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="edit-split-toggle"
                checked={editSplit}
                onChange={(e) => {
                  setEditSplit(e.target.checked);
                  if (!e.target.checked) {
                    setEditPayment2("");
                    setEditAmount1("");
                    setEditAmount2("");
                  }
                }}
                className="rounded border"
              />
              <label htmlFor="edit-split-toggle" className="text-sm cursor-pointer">Dividir pagamento</label>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="destructive"
              className="sm:mr-auto"
              disabled={deleteBooking.isPending || editBooking.isPending}
              onClick={() => {
                if (!editTarget) return;
                if (!confirm("Tem certeza que deseja apagar este agendamento?")) return;
                deleteBooking.mutate(editTarget.id);
              }}
            >
              <Trash2 className="h-4 w-4" /> Apagar
            </Button>
            <Button variant="outline" onClick={() => setEditTarget(null)}>
              Cancelar
            </Button>
            <Button
              disabled={
                !editPayment ||
                !editPrice ||
                (editSplit && (!editPayment2 || !editAmount1 || !editAmount2)) ||
                editBooking.isPending
              }
              onClick={() => {
                if (!editTarget) return;
                editBooking.mutate({
                  id: editTarget.id,
                  total_price: parseFloat(editPrice) || 0,
                  payment_method: editPayment,
                  ...(editSplit
                    ? {
                        payment_method_2: editPayment2,
                        payment_amount_1: parseFloat(editAmount1) || 0,
                        payment_amount_2: parseFloat(editAmount2) || 0,
                      }
                    : {}),
                });
              }}
            >
              <Check className="h-4 w-4" /> Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function BookingCard({
  booking,
  onUpdate,
  onReschedule,
  onEdit,
  pending,
}: {
  booking: BookingRow;
  onUpdate: (status: BookingRow["status"]) => void;
  onReschedule: () => void;
  onEdit: () => void;
  pending: boolean;
}) {
  const start = new Date(booking.starts_at);
  const end = new Date(booking.ends_at);
  const dateLabel = start.toLocaleDateString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
  const timeLabel = `${start.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} - ${end.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;

  const phone = booking.profiles?.phone?.replace(/\D/g, "") ?? "";
  const waPhone = phone ? (phone.startsWith("55") ? phone : `55${phone}`) : "";

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold">{getBookingServiceLabel(booking)}</h3>
            <Badge variant={STATUS_VARIANT[booking.status]}>
              {STATUS_LABEL[booking.status]}
            </Badge>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="capitalize">{dateLabel}</span>
            <span className="text-muted-foreground">·</span>
            <span>{timeLabel}</span>
          </div>
          {booking.booked_services && booking.booked_services.length > 1 && (
            <div className="text-xs text-muted-foreground space-y-0.5 ml-5">
              {booking.booked_services.map((s, i) => (
                <p key={i}>
                  {s.name}: {fmtTime(s.starts_at)} - {fmtTime(s.ends_at)}
                </p>
              ))}
            </div>
          )}
          <p className="text-sm">
            <span className="text-muted-foreground">Cliente:</span>{" "}
            {booking.profiles?.display_name ?? "—"}
          </p>
          {booking.profiles?.phone && (
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <a
                href={`tel:${booking.profiles.phone}`}
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                <Phone className="h-3.5 w-3.5" />
                {booking.profiles.phone}
              </a>
              {waPhone && (
                <a
                  href={`https://wa.me/${waPhone}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-success hover:underline"
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  WhatsApp
                </a>
              )}
            </div>
          )}
          {booking.customer_notes && (
            <p className="text-sm text-muted-foreground">Obs: {booking.customer_notes}</p>
          )}
          <p className="text-sm font-medium">
            R$ {Number(booking.total_price).toFixed(2).replace(".", ",")}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {booking.status === "pending" && (
            <>
              <Button size="sm" onClick={() => onUpdate("confirmed")} disabled={pending}>
                <Check className="h-4 w-4" /> Confirmar
              </Button>
              <Button size="sm" variant="outline" onClick={onReschedule} disabled={pending}>
                <CalIcon className="h-4 w-4" /> Propor outro horário
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => onUpdate("cancelled")}
                disabled={pending}
              >
                <X className="h-4 w-4" /> Recusar
              </Button>
            </>
          )}
          {booking.status === "confirmed" && (
            <>
              <Button size="sm" onClick={() => onUpdate("completed")} disabled={pending}>
                <CheckCircle2 className="h-4 w-4" /> Concluir
              </Button>
              <Button size="sm" variant="outline" onClick={onReschedule} disabled={pending}>
                <CalIcon className="h-4 w-4" /> Reagendar
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onUpdate("cancelled")}
                disabled={pending}
              >
                <X className="h-4 w-4" /> Cancelar
              </Button>
            </>
          )}
          {(booking.status === "completed" || booking.status === "cancelled") && (
            <Button size="sm" variant="outline" onClick={onEdit}>
              <Pencil className="h-4 w-4" /> Editar
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function RescheduleDialog({
  booking,
  store,
  onClose,
  onSaved,
}: {
  booking: BookingRow;
  store: StoreLite;
  onClose: () => void;
  onSaved: () => void;
}) {
  const duration =
    booking.services?.duration_minutes ??
    Math.round(
      (new Date(booking.ends_at).getTime() - new Date(booking.starts_at).getTime()) / 60000,
    );

  const [date, setDate] = useState<Date>(() => {
    const d = new Date(booking.starts_at);
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [slot, setSlot] = useState<Date | null>(null);
  const [hours, setHours] = useState<StoreHour[]>([]);
  const [bookedRanges, setBookedRanges] = useState<BookedRange[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase
      .from("store_hours")
      .select("*")
      .eq("store_id", store.id)
      .then(({ data }) => setHours((data ?? []) as StoreHour[]));
  }, [store.id]);

  useEffect(() => {
    const start = new Date(date);
    const end = new Date(date);
    end.setDate(end.getDate() + 1);
    supabase
      .from("bookings")
      .select("starts_at, ends_at, status")
      .eq("store_id", store.id)
      .gte("starts_at", start.toISOString())
      .lt("starts_at", end.toISOString())
      .in("status", ["pending", "confirmed"])
      .then(({ data }) =>
        setBookedRanges(
          ((data ?? []) as BookedRange[]).filter(
            (b) => b.starts_at !== booking.starts_at || b.ends_at !== booking.ends_at,
          ),
        ),
      );
  }, [store.id, date, booking.starts_at, booking.ends_at]);

  const slots = useMemo(
    () => generateSlots(date, hours, store.slot_minutes || 30, duration, bookedRanges),
    [date, hours, store.slot_minutes, duration, bookedRanges],
  );

  const save = async () => {
    if (!slot) return;
    setSaving(true);
    const ends = new Date(slot.getTime() + duration * 60_000);
    const { error } = await supabase
      .from("bookings")
      .update({
        starts_at: slot.toISOString(),
        ends_at: ends.toISOString(),
        status: "confirmed",
      })
      .eq("id", booking.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Reagendado e confirmado");
    onSaved();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Propor outro horário</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            {getBookingServiceLabel(booking)} · {duration} min ·{" "}
            {booking.profiles?.display_name ?? "Cliente"}
          </p>
          <div>
            <label className="text-xs font-semibold text-muted-foreground">Dia</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="mt-1.5 w-full justify-start font-normal">
                  <CalendarIcon className="h-4 w-4" />
                  {format(date, "EEEE, dd 'de' MMMM", { locale: ptBR })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(d) => {
                    if (d) {
                      const nd = new Date(d);
                      nd.setHours(0, 0, 0, 0);
                      setDate(nd);
                      setSlot(null);
                    }
                  }}
                  disabled={(d) => {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    return d < today;
                  }}
                  initialFocus
                  locale={ptBR}
                  className="pointer-events-auto p-3"
                />
              </PopoverContent>
            </Popover>
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground">Novo horário</label>
            {slots.length === 0 ? (
              <p className="mt-2 rounded-md bg-muted p-3 text-center text-sm text-muted-foreground">
                Sem horários disponíveis nesse dia.
              </p>
            ) : (
              <div className="mt-2 grid grid-cols-3 gap-2">
                {slots.map((s) => {
                  const active = slot?.getTime() === s.start.getTime();
                  return (
                    <button
                      key={s.start.toISOString()}
                      type="button"
                      disabled={!s.available}
                      onClick={() => setSlot(s.start)}
                      className={cn(
                        "rounded-md border py-2 text-sm font-semibold transition-colors",
                        active
                          ? "border-primary bg-primary text-primary-foreground"
                          : s.available
                            ? "border-border hover:border-primary"
                            : "cursor-not-allowed border-border bg-muted text-muted-foreground line-through",
                      )}
                    >
                      {formatSlotLabel(s.start)}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={!slot || saving}>
            {saving ? "Salvando..." : "Confirmar novo horário"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NewBookingDialog({
  store,
  onClose,
  onSaved,
}: {
  store: StoreLite;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const [services, setServices] = useState<ServiceLite[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [date, setDate] = useState<Date>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [slot, setSlot] = useState<Date | null>(null);
  const [hours, setHours] = useState<StoreHour[]>([]);
  const [bookedRanges, setBookedRanges] = useState<BookedRange[]>([]);
  const [saving, setSaving] = useState(false);

  const selectedServices = services.filter((s) => selectedIds.includes(s.id));
  const totalDuration = selectedServices.reduce((sum, s) => sum + s.duration_minutes, 0) || 30;
  const totalPrice = selectedServices.reduce(
    (sum, s) => sum + getEffectivePrice({ price: Number(s.price), promo_prices: s.promo_prices ?? null }, date),
    0,
  );
  const originalPrice = selectedServices.reduce((sum, s) => sum + Number(s.price), 0);
  const hasPromo = totalPrice < originalPrice;

  const toggleService = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
    setSlot(null);
  };

  useEffect(() => {
    supabase
      .from("services")
      .select("id, name, duration_minutes, price, promo_prices")
      .eq("store_id", store.id)
      .eq("is_active", true)
      .order("position")
      .then(({ data }) => {
        const list = (data ?? []).map((s: any) => ({
          ...s,
          promo_prices: Array.isArray(s.promo_prices) ? (s.promo_prices as PromoPrice[]) : [],
        })) as ServiceLite[];
        setServices(list);
      });
    supabase
      .from("store_hours")
      .select("*")
      .eq("store_id", store.id)
      .then(({ data }) => setHours((data ?? []) as StoreHour[]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.id]);

  useEffect(() => {
    const start = new Date(date);
    const end = new Date(date);
    end.setDate(end.getDate() + 1);
    supabase
      .from("bookings")
      .select("starts_at, ends_at, status")
      .eq("store_id", store.id)
      .gte("starts_at", start.toISOString())
      .lt("starts_at", end.toISOString())
      .in("status", ["pending", "confirmed"])
      .then(({ data }) => setBookedRanges((data ?? []) as BookedRange[]));
  }, [store.id, date]);

  const slots = useMemo(
    () => generateSlots(date, hours, store.slot_minutes || 30, totalDuration, bookedRanges),
    [date, hours, store.slot_minutes, totalDuration, bookedRanges],
  );

  const save = async () => {
    if (!slot || selectedServices.length === 0 || !user) return;
    if (!customerName.trim()) {
      toast.error("Informe o nome do cliente");
      return;
    }
    setSaving(true);
    const noteParts = [
      `[Manual] ${customerName.trim()}`,
      customerPhone.trim() ? `Tel: ${customerPhone.trim()}` : "",
      notes.trim(),
    ].filter(Boolean);
    const noteStr = noteParts.join(" · ");

    let cursor = new Date(slot);
    const bookedServices = selectedServices.map((svc) => {
      const start = new Date(cursor);
      const end = new Date(start.getTime() + svc.duration_minutes * 60_000);
      cursor = end;
      return {
        service_id: svc.id,
        name: svc.name,
        duration_minutes: svc.duration_minutes,
        price: svc.price,
        starts_at: start.toISOString(),
        ends_at: end.toISOString(),
      };
    });

    const totalPrice = selectedServices.reduce((sum, s) => sum + s.price, 0);

    const { error } = await supabase.from("bookings").insert({
      store_id: store.id,
      service_id: selectedServices[0].id,
      user_id: user.id,
      starts_at: new Date(slot).toISOString(),
      ends_at: cursor.toISOString(),
      total_price: totalPrice,
      status: "confirmed",
      customer_notes: noteStr,
      booked_services: bookedServices,
    });
    const hasError = !!error;
    if (error) {
      toast.error(error.message);
    }
    setSaving(false);
    if (!hasError) {
      toast.success("Agendamento criado");
      onSaved();
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo agendamento</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label className="text-xs">Cliente *</Label>
              <Input
                className="mt-1.5"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Nome do cliente"
              />
            </div>
            <div>
              <Label className="text-xs">Telefone</Label>
              <Input
                className="mt-1.5"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="(11) 99999-9999"
              />
            </div>
          </div>

          <div>
            <Label className="text-xs">Serviços * <span className="font-normal text-muted-foreground">(selecione um ou mais)</span></Label>
            <div className="mt-1.5 max-h-40 overflow-y-auto rounded-md border p-2 space-y-1">
              {services.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-2">Nenhum serviço cadastrado.</p>
              ) : (
                services.map((s) => {
                  const checked = selectedIds.includes(s.id);
                  return (
                    <label
                      key={s.id}
                      className={cn(
                        "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm cursor-pointer transition-colors",
                        checked ? "bg-primary/10 font-medium" : "hover:bg-muted",
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleService(s.id)}
                        className="accent-[var(--primary)] h-4 w-4 rounded"
                      />
                      <span className="flex-1">{s.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {s.duration_minutes}min · R$ {Number(s.price).toFixed(2).replace(".", ",")}
                      </span>
                    </label>
                  );
                })
              )}
            </div>
            {selectedServices.length > 0 && (
              <div className="mt-1.5 flex items-center gap-3 text-xs text-muted-foreground">
                <span>Total: <strong className="text-foreground">{totalDuration}min</strong></span>
                <span>·</span>
                <span>R$ <strong className="text-foreground">{totalPrice.toFixed(2).replace(".", ",")}</strong></span>
                <span>·</span>
                <span>{selectedServices.length} serviço{selectedServices.length > 1 ? "s" : ""}</span>
              </div>
            )}
          </div>

          <div>
            <Label className="text-xs">Dia</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="mt-1.5 w-full justify-start font-normal">
                  <CalendarIcon className="h-4 w-4" />
                  {format(date, "EEEE, dd 'de' MMMM", { locale: ptBR })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(d) => {
                    if (d) {
                      const nd = new Date(d);
                      nd.setHours(0, 0, 0, 0);
                      setDate(nd);
                      setSlot(null);
                    }
                  }}
                  disabled={(d) => {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    return d < today;
                  }}
                  initialFocus
                  locale={ptBR}
                  className="pointer-events-auto p-3"
                />
              </PopoverContent>
            </Popover>
          </div>

          <div>
            <Label className="text-xs">Horário</Label>
            {selectedServices.length === 0 ? (
              <p className="mt-2 rounded-md bg-muted p-3 text-center text-sm text-muted-foreground">
                Escolha um serviço primeiro.
              </p>
            ) : slots.length === 0 ? (
              <p className="mt-2 rounded-md bg-muted p-3 text-center text-sm text-muted-foreground">
                Sem horários disponíveis nesse dia.
              </p>
            ) : (
              <div className="mt-2 grid grid-cols-3 gap-2">
                {slots.map((s) => {
                  const active = slot?.getTime() === s.start.getTime();
                  return (
                    <button
                      key={s.start.toISOString()}
                      type="button"
                      disabled={!s.available}
                      onClick={() => setSlot(s.start)}
                      className={cn(
                        "rounded-md border py-2 text-sm font-semibold transition-colors",
                        active
                          ? "border-primary bg-primary text-primary-foreground"
                          : s.available
                            ? "border-border hover:border-primary"
                            : "cursor-not-allowed border-border bg-muted text-muted-foreground line-through",
                      )}
                    >
                      {formatSlotLabel(s.start)}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <Label className="text-xs">Observações</Label>
            <Textarea
              className="mt-1.5"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: cliente pediu corte degradê"
              rows={2}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={!slot || selectedServices.length === 0 || saving}>
            {saving ? "Salvando..." : "Criar agendamento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
