import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, X, Check } from "lucide-react";
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
import { openWhatsapp } from "@/lib/whatsapp";
import { getEffectivePrice, type PromoPrice } from "@/lib/service-pricing";

export interface ServiceLite {
  id: string;
  name: string;
  description: string | null;
  price: number;
  duration_minutes: number;
  image_url: string | null;
  show_price?: boolean;
  show_duration?: boolean;
  promo_prices?: PromoPrice[];
}

interface BookingDialogProps {
  open: boolean;
  onClose: () => void;
  storeId: string;
  storeName: string;
  storeWhatsapp: string | null;
  slotMinutes: number;
  storeHours: StoreHour[];
  services: ServiceLite[];
  initialServiceId?: string | null;
  onCreated?: () => void;
}

const formatBRL = (n: number) => `R$ ${n.toFixed(2).replace(".", ",")}`;

export function BookingDialog({
  open,
  onClose,
  storeId,
  storeName,
  storeWhatsapp,
  slotMinutes,
  storeHours,
  services,
  initialServiceId,
  onCreated,
}: BookingDialogProps) {
  const { user } = useAuth();
  const [date, setDate] = useState<Date>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [selectedSlot, setSelectedSlot] = useState<Date | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [bookings, setBookings] = useState<BookedRange[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Reset on open
  useEffect(() => {
    if (open) {
      setSelectedSlot(null);
      setNotes("");
      setSelectedIds(initialServiceId ? [initialServiceId] : []);
    }
  }, [open, initialServiceId]);

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

  const selectedServices = useMemo(
    () => selectedIds.map((id) => services.find((s) => s.id === id)).filter(Boolean) as ServiceLite[],
    [selectedIds, services],
  );

  const totalDuration = selectedServices.reduce((sum, s) => sum + s.duration_minutes, 0);
  const totalPrice = selectedServices.reduce(
    (sum, s) => sum + getEffectivePrice(s, date),
    0,
  );
  const originalPrice = selectedServices.reduce((sum, s) => sum + s.price, 0);
  const hasPromo = totalPrice < originalPrice;

  const slots = useMemo(() => {
    if (totalDuration === 0) return [];
    return generateSlots(date, storeHours, slotMinutes, totalDuration, bookings);
  }, [date, storeHours, slotMinutes, totalDuration, bookings]);

  // If duration changes, drop slot selection
  useEffect(() => {
    setSelectedSlot(null);
  }, [totalDuration]);

  const toggleService = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const buildWhatsappMessage = (slot: Date) => {
    const end = new Date(slot.getTime() + totalDuration * 60_000);
    const lines = [
      `Olá, ${storeName}! Gostaria de agendar:`,
      "",
      ...selectedServices.map(
        (s) => `• ${s.name} (${s.duration_minutes} min) — ${formatBRL(getEffectivePrice(s, slot))}`,
      ),
      "",
      `📅 ${format(slot, "EEEE, dd 'de' MMMM", { locale: ptBR })}`,
      `🕐 ${formatSlotLabel(slot)} às ${formatSlotLabel(end)}`,
      `💰 Total: ${formatBRL(totalPrice)}${hasPromo ? " (promo)" : ""}`,
    ];
    if (notes.trim()) {
      lines.push("", `📝 Obs: ${notes.trim()}`);
    }
    return lines.join("\n");
  };

  const submit = async () => {
    if (!user || selectedServices.length === 0 || !selectedSlot) return;
    if (!storeWhatsapp) {
      toast.error("Loja sem WhatsApp cadastrado.");
      return;
    }
    setSubmitting(true);

    // Build booked_services JSON with individual time slots
    let cursor = new Date(selectedSlot);
    const bookedServices = selectedServices.map((s) => {
      const start = new Date(cursor);
      const end = new Date(start.getTime() + s.duration_minutes * 60_000);
      cursor = end;
      return {
        service_id: s.id,
        name: s.name,
        duration_minutes: s.duration_minutes,
        price: getEffectivePrice(s, selectedSlot),
        starts_at: start.toISOString(),
        ends_at: end.toISOString(),
      };
    });

    const row = {
      user_id: user.id,
      store_id: storeId,
      service_id: selectedServices[0].id,
      starts_at: selectedSlot.toISOString(),
      ends_at: cursor.toISOString(),
      status: "pending" as const,
      customer_notes: notes || null,
      total_price: totalPrice,
      booked_services: bookedServices,
    };

    const { error } = await supabase.from("bookings").insert(row);
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }

    openWhatsapp(storeWhatsapp, buildWhatsappMessage(selectedSlot));
    toast.success("Solicitação enviada! Continue no WhatsApp.");

    onCreated?.();
    onClose();
  };

  if (!open) return null;

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
            <h2 className="font-bold truncate">Agendar serviços</h2>
            {selectedServices.length > 0 && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {selectedServices.length}{" "}
                {selectedServices.length === 1 ? "serviço" : "serviços"} · {totalDuration} min ·{" "}
                {hasPromo ? (
                  <>
                    <span className="line-through opacity-60">{formatBRL(originalPrice)}</span>{" "}
                    <span className="font-bold text-brand">{formatBRL(totalPrice)}</span>
                  </>
                ) : (
                  formatBRL(totalPrice)
                )}
              </p>
            )}
          </div>
          <button onClick={onClose} className="p-1 -mr-1" aria-label="Fechar">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Service multi-select */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground">
              Selecione os serviços
            </label>
            <div className="mt-2 space-y-2">
              {services.map((s) => {
                const checked = selectedIds.includes(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => toggleService(s.id)}
                    className={cn(
                      "w-full flex items-center gap-3 rounded-xl border p-3 text-left transition-colors",
                      checked ? "border-brand bg-brand-soft" : "border-border bg-background hover:border-brand/50",
                    )}
                  >
                    <div
                      className={cn(
                        "h-5 w-5 rounded-md border-2 flex items-center justify-center shrink-0",
                        checked ? "border-brand bg-brand" : "border-border",
                      )}
                    >
                      {checked && <Check className="h-3.5 w-3.5 text-brand-foreground" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{s.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {s.duration_minutes} min ·{" "}
                        {(() => {
                          const eff = getEffectivePrice(s, date);
                          if (eff < s.price) {
                            return (
                              <>
                                <span className="line-through opacity-60">{formatBRL(s.price)}</span>{" "}
                                <span className="font-bold text-brand">{formatBRL(eff)}</span>
                              </>
                            );
                          }
                          return formatBRL(s.price);
                        })()}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

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
            {selectedServices.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground bg-muted rounded-lg p-4 text-center">
                Selecione pelo menos um serviço.
              </p>
            ) : slots.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground bg-muted rounded-lg p-4 text-center">
                Sem horários para a duração total nesse dia. Tente outra data.
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
            disabled={!selectedSlot || selectedServices.length === 0 || submitting}
            className="w-full h-11 rounded-full bg-brand text-brand-foreground hover:bg-brand/90 font-bold"
          >
            {submitting
              ? "Enviando..."
              : selectedSlot
                ? `Enviar pelo WhatsApp · ${formatSlotLabel(selectedSlot)}`
                : "Selecione um horário"}
          </Button>
          <p className="text-[11px] text-muted-foreground text-center mt-2">
            Você será redirecionado ao WhatsApp da loja para confirmar.
          </p>
        </div>
      </div>
    </div>
  );
}
