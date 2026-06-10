import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, X, Check, Sparkles, Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { StoreHour } from "@/lib/store-hours";
import { generateSlots, formatSlotLabel, type BookedRange } from "@/lib/booking-slots";
import { useAuth } from "@/contexts/AuthContext";

type ServiceRow = {
  id: string;
  name: string;
  duration_minutes: number;
  price: number;
};

interface Props {
  open: boolean;
  onClose: () => void;
  subscriptionId: string;
  storeId: string;
  planId: string | null;
  planName: string;
  storeName: string;
  onCreated?: () => void;
}

const formatBRL = (n: number) => `R$ ${n.toFixed(2).replace(".", ",")}`;

export function SubscriptionBookingDialog({
  open,
  onClose,
  subscriptionId,
  storeId,
  planId,
  planName,
  storeName,
  onCreated,
}: Props) {
  const { user } = useAuth();
  const [date, setDate] = useState<Date>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [comboServiceId, setComboServiceId] = useState<string | null>(null);
  const [extraEnabled, setExtraEnabled] = useState(false);
  const [extraServiceId, setExtraServiceId] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<Date | null>(null);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setComboServiceId(null);
      setExtraEnabled(false);
      setExtraServiceId(null);
      setSelectedSlot(null);
      setNotes("");
    }
  }, [open]);

  // Combo services (from subscription_plan_services)
  const { data: comboServices = [] } = useQuery({
    queryKey: ["sub-combo-services", planId],
    enabled: open && !!planId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscription_plan_services")
        .select("service_id, services:services(id, name, duration_minutes, price)")
        .eq("plan_id", planId!);
      if (error) throw error;
      return (data ?? [])
        .map((r: any) => r.services)
        .filter(Boolean)
        .map((s: any) => ({ ...s, price: Number(s.price) })) as ServiceRow[];
    },
  });

  // All active store services (for extra)
  const { data: allServices = [] } = useQuery({
    queryKey: ["sub-all-services", storeId],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services")
        .select("id, name, duration_minutes, price")
        .eq("store_id", storeId)
        .eq("is_active", true)
        .order("position", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((s: any) => ({ ...s, price: Number(s.price) })) as ServiceRow[];
    },
  });

  // Store hours + slot_minutes
  const { data: storeMeta } = useQuery({
    queryKey: ["sub-store-meta", storeId],
    enabled: open,
    queryFn: async () => {
      const [hoursRes, storeRes] = await Promise.all([
        supabase.from("store_hours").select("*").eq("store_id", storeId).eq("is_active", true),
        supabase.from("stores").select("slot_minutes").eq("id", storeId).maybeSingle(),
      ]);
      if (hoursRes.error) throw hoursRes.error;
      return {
        hours: (hoursRes.data ?? []) as StoreHour[],
        slotMinutes: (storeRes.data?.slot_minutes as number) ?? 30,
      };
    },
  });

  // Auto-pick if only one combo service
  useEffect(() => {
    if (comboServices.length === 1 && !comboServiceId) {
      setComboServiceId(comboServices[0].id);
    }
  }, [comboServices, comboServiceId]);

  const comboService = useMemo(
    () => comboServices.find((s) => s.id === comboServiceId) ?? null,
    [comboServices, comboServiceId],
  );
  const extraService = useMemo(
    () =>
      extraEnabled && extraServiceId
        ? allServices.find((s) => s.id === extraServiceId) ?? null
        : null,
    [extraEnabled, extraServiceId, allServices],
  );

  const totalDuration =
    (comboService?.duration_minutes ?? 0) + (extraService?.duration_minutes ?? 0);
  const extraPrice = extraService?.price ?? 0;

  // Booked ranges for selected date
  const { data: bookedRanges = [] } = useQuery({
    queryKey: ["sub-booked-day", storeId, date.toISOString().slice(0, 10)],
    enabled: open && !!storeId,
    queryFn: async () => {
      const start = new Date(date);
      const end = new Date(date);
      end.setDate(end.getDate() + 1);
      const { data, error } = await supabase
        .from("bookings")
        .select("starts_at, ends_at, status")
        .eq("store_id", storeId)
        .gte("starts_at", start.toISOString())
        .lt("starts_at", end.toISOString())
        .in("status", ["pending", "confirmed"]);
      if (error) throw error;
      return (data ?? []) as BookedRange[];
    },
  });

  const slots = useMemo(() => {
    if (!storeMeta || totalDuration === 0) return [];
    return generateSlots(date, storeMeta.hours, storeMeta.slotMinutes, totalDuration, bookedRanges);
  }, [storeMeta, totalDuration, date, bookedRanges]);

  useEffect(() => {
    setSelectedSlot(null);
  }, [totalDuration]);

  const submit = async () => {
    if (!user || !comboService || !selectedSlot) return;
    setSubmitting(true);

    const start = new Date(selectedSlot);
    const comboEnd = new Date(start.getTime() + comboService.duration_minutes * 60_000);
    const finalEnd = extraService
      ? new Date(comboEnd.getTime() + extraService.duration_minutes * 60_000)
      : comboEnd;

    const bookedServices: any[] = [
      {
        service_id: comboService.id,
        name: comboService.name,
        duration_minutes: comboService.duration_minutes,
        price: 0,
        starts_at: start.toISOString(),
        ends_at: comboEnd.toISOString(),
        is_subscription: true,
      },
    ];

    if (extraService) {
      bookedServices.push({
        service_id: extraService.id,
        name: extraService.name,
        duration_minutes: extraService.duration_minutes,
        price: extraService.price,
        starts_at: comboEnd.toISOString(),
        ends_at: finalEnd.toISOString(),
        extra: true,
      });
    }

    const baseNote = `Agendado pela assinatura — ${planName}`;
    const fullNotes = notes.trim() ? `${baseNote}\n${notes.trim()}` : baseNote;

    const { error } = await supabase.from("bookings").insert({
      user_id: user.id,
      store_id: storeId,
      service_id: comboService.id,
      starts_at: start.toISOString(),
      ends_at: finalEnd.toISOString(),
      status: "pending",
      customer_notes: fullNotes,
      total_price: extraPrice,
      booked_services: bookedServices,
      subscription_id: subscriptionId,
    });

    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Agendamento solicitado!");
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
            <h2 className="font-bold truncate flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-brand" />
              Agendar pela assinatura
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">{planName}</p>
          </div>
          <button onClick={onClose} className="p-1 -mr-1" aria-label="Fechar">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Combo service pick */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground">
              Serviço da assinatura
            </label>
            {comboServices.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground bg-muted rounded-lg p-3">
                Esta assinatura não tem serviços vinculados. Procure o estabelecimento.
              </p>
            ) : (
              <div className="mt-2 space-y-2">
                {comboServices.map((s) => {
                  const checked = comboServiceId === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setComboServiceId(s.id)}
                      className={cn(
                        "w-full flex items-center gap-3 rounded-xl border p-3 text-left transition-colors",
                        checked
                          ? "border-brand bg-brand-soft"
                          : "border-border bg-background hover:border-brand/50",
                      )}
                    >
                      <div
                        className={cn(
                          "h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0",
                          checked ? "border-brand bg-brand" : "border-border",
                        )}
                      >
                        {checked && <Check className="h-3.5 w-3.5 text-brand-foreground" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">{s.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {s.duration_minutes} min ·{" "}
                          <span className="text-success font-semibold">Incluso na assinatura</span>
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Extra service toggle */}
          <div className="rounded-xl border border-border p-3 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold flex items-center gap-1.5">
                  <Plus className="h-4 w-4" /> Adicionar serviço extra
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Será cobrado à parte, no balcão.
                </p>
              </div>
              <Switch
                checked={extraEnabled}
                onCheckedChange={(v) => {
                  setExtraEnabled(v);
                  if (!v) setExtraServiceId(null);
                }}
              />
            </div>
            {extraEnabled && (
              <div className="space-y-2">
                {allServices
                  .filter((s) => !comboServices.some((c) => c.id === s.id))
                  .map((s) => {
                    const checked = extraServiceId === s.id;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setExtraServiceId(s.id)}
                        className={cn(
                          "w-full flex items-center gap-3 rounded-lg border p-2.5 text-left transition-colors",
                          checked
                            ? "border-brand bg-brand-soft"
                            : "border-border bg-background hover:border-brand/50",
                        )}
                      >
                        <div
                          className={cn(
                            "h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0",
                            checked ? "border-brand bg-brand" : "border-border",
                          )}
                        >
                          {checked && <Check className="h-3 w-3 text-brand-foreground" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{s.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {s.duration_minutes} min · {formatBRL(s.price)}
                          </p>
                        </div>
                      </button>
                    );
                  })}
              </div>
            )}
          </div>

          {/* Date */}
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

          {/* Slots */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground">
              Horário disponível
            </label>
            {!comboService ? (
              <p className="mt-3 text-sm text-muted-foreground bg-muted rounded-lg p-4 text-center">
                Escolha o serviço da assinatura.
              </p>
            ) : extraEnabled && !extraService ? (
              <p className="mt-3 text-sm text-muted-foreground bg-muted rounded-lg p-4 text-center">
                Escolha o serviço extra ou desative a opção.
              </p>
            ) : slots.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground bg-muted rounded-lg p-4 text-center">
                Sem horários disponíveis nesse dia. Tente outra data.
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

          {/* Notes */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground">
              Observação (opcional)
            </label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Algo que o profissional precise saber?"
              className="mt-1.5 min-h-[70px]"
              maxLength={500}
            />
          </div>

          {/* Summary */}
          {comboService && (
            <div className="rounded-xl bg-muted p-3 text-sm space-y-1">
              <p className="flex justify-between">
                <span className="text-muted-foreground">{comboService.name}</span>
                <span className="font-semibold text-success">Incluso</span>
              </p>
              {extraService && (
                <p className="flex justify-between">
                  <span className="text-muted-foreground">+ {extraService.name}</span>
                  <span className="font-semibold">{formatBRL(extraService.price)}</span>
                </p>
              )}
              <div className="border-t border-border pt-1.5 mt-1.5 flex justify-between font-bold">
                <span>A pagar no balcão</span>
                <span>{formatBRL(extraPrice)}</span>
              </div>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 bg-card border-t border-border p-4">
          <Button
            onClick={submit}
            disabled={
              !selectedSlot ||
              !comboService ||
              (extraEnabled && !extraService) ||
              submitting
            }
            className="w-full h-11 rounded-full bg-brand text-brand-foreground hover:bg-brand/90 font-bold"
          >
            {submitting
              ? "Enviando..."
              : selectedSlot
                ? `Confirmar agendamento · ${formatSlotLabel(selectedSlot)}`
                : "Selecione um horário"}
          </Button>
        </div>
      </div>
    </div>
  );
}
