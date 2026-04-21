import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { StoreHour } from "@/lib/store-hours";
import { generateSlots, formatSlotLabel, type BookedRange } from "@/lib/booking-slots";
import { useAuth } from "@/contexts/AuthContext";

export interface ServiceLite {
  id: string;
  name: string;
  description: string | null;
  price: number;
  duration_minutes: number;
  image_url: string | null;
}

interface BookingDialogProps {
  open: boolean;
  onClose: () => void;
  storeId: string;
  storeName: string;
  slotMinutes: number;
  storeHours: StoreHour[];
  service: ServiceLite | null;
  onCreated?: () => void;
}

export function BookingDialog({
  open,
  onClose,
  storeId,
  storeName,
  slotMinutes,
  storeHours,
  service,
  onCreated,
}: BookingDialogProps) {
  const { user } = useAuth();
  const [date, setDate] = useState<Date>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [selectedSlot, setSelectedSlot] = useState<Date | null>(null);
  const [notes, setNotes] = useState("");
  const [bookings, setBookings] = useState<BookedRange[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Reset when modal opens with a new service
  useEffect(() => {
    if (open) {
      setSelectedSlot(null);
      setNotes("");
    }
  }, [open, service?.id]);

  // Load existing bookings for the store on the picked day
  useEffect(() => {
    if (!open || !storeId) return;
    const start = new Date(date);
    const end = new Date(date);
    end.setDate(end.getDate() + 1);

    supabase
      .from("bookings")
      .select("starts_at, ends_at, status")
      .eq("store_id", storeId)
      .gte("starts_at", start.toISOString())
      .lt("starts_at", end.toISOString())
      .in("status", ["pending", "confirmed"])
      .then(({ data }) => setBookings((data ?? []) as BookedRange[]));
  }, [open, storeId, date]);

  const slots = useMemo(() => {
    if (!service) return [];
    return generateSlots(date, storeHours, slotMinutes, service.duration_minutes, bookings);
  }, [date, storeHours, slotMinutes, service, bookings]);

  const submit = async () => {
    if (!user || !service || !selectedSlot) return;
    setSubmitting(true);
    const end = new Date(selectedSlot.getTime() + service.duration_minutes * 60_000);
    const { error } = await supabase.from("bookings").insert({
      user_id: user.id,
      store_id: storeId,
      service_id: service.id,
      starts_at: selectedSlot.toISOString(),
      ends_at: end.toISOString(),
      status: "pending",
      customer_notes: notes || null,
      total_price: service.price,
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Agendamento solicitado! Aguarde a confirmação do lojista.");
    onCreated?.();
    onClose();
  };

  if (!open || !service) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-card w-full max-w-md rounded-t-3xl sm:rounded-3xl max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom duration-200"
      >
        <div className="sticky top-0 bg-card border-b border-border px-5 py-4 flex items-start justify-between gap-3 z-10">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">{storeName}</p>
            <h2 className="font-bold truncate">Agendar {service.name}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {service.duration_minutes} min · R$ {service.price.toFixed(2).replace(".", ",")}
            </p>
          </div>
          <button onClick={onClose} className="p-1 -mr-1" aria-label="Fechar">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          <div>
            <label className="text-xs font-semibold text-muted-foreground">Dia</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn("w-full justify-start text-left font-normal mt-1.5")}
                >
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
                      setSelectedSlot(null);
                    }
                  }}
                  disabled={(d) => {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    return d < today;
                  }}
                  initialFocus
                  locale={ptBR}
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground">
              Horário disponível
            </label>
            {slots.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground bg-muted rounded-lg p-4 text-center">
                A loja não atende neste dia. Escolha outra data.
              </p>
            ) : (
              <div className="mt-2 grid grid-cols-3 gap-2">
                {slots.map((s) => {
                  const active = selectedSlot?.getTime() === s.start.getTime();
                  return (
                    <button
                      key={s.start.toISOString()}
                      type="button"
                      disabled={!s.available}
                      onClick={() => setSelectedSlot(s.start)}
                      className={cn(
                        "rounded-lg border text-sm font-semibold py-2.5 transition-colors",
                        active
                          ? "border-brand bg-brand text-brand-foreground"
                          : s.available
                            ? "border-border bg-background hover:border-brand"
                            : "border-border bg-muted text-muted-foreground line-through cursor-not-allowed",
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
            <label className="text-xs font-semibold text-muted-foreground">
              Observação (opcional)
            </label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Algo que o profissional precise saber?"
              className="mt-1.5 min-h-[80px]"
              maxLength={500}
            />
          </div>
        </div>

        <div className="sticky bottom-0 bg-card border-t border-border p-4">
          <Button
            onClick={submit}
            disabled={!selectedSlot || submitting}
            className="w-full h-11 rounded-full bg-brand text-brand-foreground hover:bg-brand/90 font-bold"
          >
            {submitting
              ? "Enviando..."
              : selectedSlot
                ? `Confirmar ${formatSlotLabel(selectedSlot)}`
                : "Selecione um horário"}
          </Button>
          <p className="text-[11px] text-muted-foreground text-center mt-2">
            O lojista precisa confirmar o agendamento.
          </p>
        </div>
      </div>
    </div>
  );
}
