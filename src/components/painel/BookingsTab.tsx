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

type ServiceLite = {
  id: string;
  name: string;
  duration_minutes: number;
  price: number;
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
  const [tab, setTab] = useState("pending");
  const [reschedFor, setReschedFor] = useState<BookingRow | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [completeTarget, setCompleteTarget] = useState<BookingRow | null>(null);
  const [completePayment, setCompletePayment] = useState("");

  const updateStatus = useMutation({
    mutationFn: async ({ id, status, payment_method }: { id: string; status: BookingRow["status"]; payment_method?: string }) => {
      const { error } = await supabase
        .from("bookings")
        .update({ status, ...(payment_method ? { payment_method } : {}) })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      toast.success(`Agendamento ${STATUS_LABEL[vars.status].toLowerCase()}`);
      qc.invalidateQueries({ queryKey: ["painel", "bookings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = useMemo(
    () =>
      bookings
        .filter((b) => (tab === "all" ? true : b.status === tab))
        .sort((a, b) => {
          if (tab === "completed" || tab === "cancelled") {
            return new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime();
          }
          return new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime();
        }),
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
                      return;
                    }
                    updateStatus.mutate({ id: b.id, status });
                  }}
                  onReschedule={() => setReschedFor(b)}
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
    </div>
  );
}

function BookingCard({
  booking,
  onUpdate,
  onReschedule,
  pending,
}: {
  booking: BookingRow;
  onUpdate: (status: BookingRow["status"]) => void;
  onReschedule: () => void;
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
            <h3 className="font-semibold">{booking.services?.name ?? "Serviço"}</h3>
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
            {booking.services?.name} · {duration} min ·{" "}
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
  const totalPrice = selectedServices.reduce((sum, s) => sum + Number(s.price), 0);

  const toggleService = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
    setSlot(null);
  };

  useEffect(() => {
    supabase
      .from("services")
      .select("id, name, duration_minutes, price")
      .eq("store_id", store.id)
      .eq("is_active", true)
      .order("position")
      .then(({ data }) => {
        const list = (data ?? []) as ServiceLite[];
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
    let hasError = false;
    for (const svc of selectedServices) {
      const ends = new Date(cursor.getTime() + svc.duration_minutes * 60_000);
      const { error } = await supabase.from("bookings").insert({
        store_id: store.id,
        service_id: svc.id,
        user_id: user.id,
        starts_at: cursor.toISOString(),
        ends_at: ends.toISOString(),
        total_price: svc.price,
        status: "confirmed",
        customer_notes: noteStr,
      });
      if (error) {
        toast.error(error.message);
        hasError = true;
        break;
      }
      cursor = ends;
    }
    setSaving(false);
    if (!hasError) {
      toast.success(
        selectedServices.length > 1
          ? `${selectedServices.length} agendamentos criados`
          : "Agendamento criado",
      );
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
