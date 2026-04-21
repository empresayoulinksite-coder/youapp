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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  services: { name: string; duration_minutes: number } | null;
  profiles?: { display_name: string | null; phone: string | null } | null;
};

export type StoreLite = {
  id: string;
  name: string;
  slot_minutes: number;
  whatsapp: string | null;
  is_paused: boolean;
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

export function BookingsTab({
  store,
  bookings,
  loading,
}: {
  store: StoreLite;
  bookings: BookingRow[];
  loading: boolean;
}) {
  const qc = useQueryClient();
  const [tab, setTab] = useState("pending");
  const [reschedFor, setReschedFor] = useState<BookingRow | null>(null);
  const [newOpen, setNewOpen] = useState(false);

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: BookingRow["status"] }) => {
      const { error } = await supabase.from("bookings").update({ status }).eq("id", id);
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
      <div className="mb-3 flex justify-end">
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
                  onUpdate={(status) => updateStatus.mutate({ id: b.id, status })}
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
