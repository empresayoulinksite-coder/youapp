import { useEffect, useState } from "react";
import { Plus, Trash2, Copy } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { WEEKDAYS, formatTime, type StoreHour } from "@/lib/store-hours";


interface DraftInterval {
  id?: string;
  opens_at: string;
  closes_at: string;
  is_active: boolean;
}

type DraftMap = Record<number, DraftInterval[]>;

export function StoreHoursEditor({ storeId }: { storeId: string }) {
  const [draft, setDraft] = useState<DraftMap>({ 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] });
  const [alwaysOpen, setAlwaysOpenState] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [hoursRes, storeRes] = await Promise.all([
        supabase
          .from("store_hours")
          .select("*")
          .eq("store_id", storeId)
          .order("opens_at"),
        supabase
          .from("stores")
          .select("always_open")
          .eq("id", storeId)
          .maybeSingle(),
      ]);
      if (cancelled) return;
      if (hoursRes.error) {
        toast.error(hoursRes.error.message);
        setLoading(false);
        return;
      }
      const next: DraftMap = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
      (hoursRes.data as StoreHour[]).forEach((h) => {
        next[h.weekday].push({
          id: h.id,
          opens_at: formatTime(h.opens_at),
          closes_at: formatTime(h.closes_at),
          is_active: h.is_active,
        });
      });
      setDraft(next);
      setAlwaysOpenState(Boolean(storeRes.data?.always_open));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [storeId]);


  const addInterval = (day: number) => {
    setDraft((d) => ({
      ...d,
      [day]: [...d[day], { opens_at: "11:00", closes_at: "23:00", is_active: true }],
    }));
  };

  const removeInterval = (day: number, idx: number) => {
    setDraft((d) => ({ ...d, [day]: d[day].filter((_, i) => i !== idx) }));
  };

  const updateInterval = (day: number, idx: number, patch: Partial<DraftInterval>) => {
    setDraft((d) => ({
      ...d,
      [day]: d[day].map((iv, i) => (i === idx ? { ...iv, ...patch } : iv)),
    }));
  };

  const copyToAll = (sourceDay: number) => {
    const source = draft[sourceDay];
    setDraft((d) => {
      const next = { ...d };
      for (let i = 0; i < 7; i++) {
        if (i === sourceDay) continue;
        next[i] = source.map((iv) => ({ opens_at: iv.opens_at, closes_at: iv.closes_at, is_active: iv.is_active }));
      }
      return next;
    });
    toast.success("Horário copiado para todos os dias");
  };

  const save = async () => {
    setSaving(true);
    try {
      // Validate
      for (let day = 0; day < 7; day++) {
        for (const iv of draft[day]) {
          if (!iv.opens_at || !iv.closes_at) {
            throw new Error(`Preencha os horários em ${WEEKDAYS[day]}`);
          }
          if (iv.opens_at === iv.closes_at) {
            throw new Error(`Abertura e fechamento iguais em ${WEEKDAYS[day]}`);
          }
        }
      }

      // Strategy: delete all existing for this store, insert fresh
      const { error: delErr } = await supabase.from("store_hours").delete().eq("store_id", storeId);
      if (delErr) throw delErr;

      const rows: Array<{
        store_id: string;
        weekday: number;
        opens_at: string;
        closes_at: string;
        is_active: boolean;
      }> = [];
      for (let day = 0; day < 7; day++) {
        for (const iv of draft[day]) {
          rows.push({
            store_id: storeId,
            weekday: day,
            opens_at: iv.opens_at,
            closes_at: iv.closes_at,
            is_active: iv.is_active,
          });
        }
      }
      if (rows.length > 0) {
        const { error: insErr } = await supabase.from("store_hours").insert(rows);
        if (insErr) throw insErr;
      }
      toast.success("Horários salvos");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const isAlwaysOpen = useMemo(() => {
    for (let day = 0; day < 7; day++) {
      const ivs = draft[day];
      if (ivs.length !== 1) return false;
      const iv = ivs[0];
      if (!iv.is_active) return false;
      if (formatTime(iv.opens_at) !== ALWAYS_OPEN_OPEN) return false;
      if (formatTime(iv.closes_at) !== ALWAYS_OPEN_CLOSE) return false;
    }
    return true;
  }, [draft]);

  const setAlwaysOpen = (v: boolean) => {
    if (v) {
      const next: DraftMap = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
      for (let day = 0; day < 7; day++) {
        next[day] = [{ opens_at: ALWAYS_OPEN_OPEN, closes_at: ALWAYS_OPEN_CLOSE, is_active: true }];
      }
      setDraft(next);
    } else {
      setDraft({ 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] });
    }
  };

  if (loading) return <p className="text-sm text-muted-foreground">Carregando horários...</p>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 rounded-lg border bg-background p-3">
        <div className="min-w-0">
          <Label htmlFor={`always-open-${storeId}`} className="text-sm font-semibold">
            Loja sempre aberta
          </Label>
          <p className="text-[11px] text-muted-foreground">
            Ative para manter a loja aberta 24h em todos os dias.
          </p>
        </div>
        <Switch
          id={`always-open-${storeId}`}
          checked={isAlwaysOpen}
          onCheckedChange={setAlwaysOpen}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Defina os intervalos em que a loja está aberta. Fora desses horários, os clientes não poderão fazer pedidos.
      </p>
      {WEEKDAYS.map((label, day) => {
        const intervals = draft[day];
        return (
          <div key={day} className="rounded-lg border bg-background p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm">{label}</span>
                {intervals.length === 0 && (
                  <span className="text-[11px] text-muted-foreground">Fechada</span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {intervals.length > 0 && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => copyToAll(day)}
                    title="Copiar para todos os dias"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                )}
                <Button type="button" size="sm" variant="outline" onClick={() => addInterval(day)}>
                  <Plus className="h-3.5 w-3.5" /> Intervalo
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              {intervals.map((iv, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <Input
                    type="time"
                    value={iv.opens_at}
                    onChange={(e) => updateInterval(day, idx, { opens_at: e.target.value })}
                    className="w-28"
                  />
                  <span className="text-xs text-muted-foreground">até</span>
                  <Input
                    type="time"
                    value={iv.closes_at}
                    onChange={(e) => updateInterval(day, idx, { closes_at: e.target.value })}
                    className="w-28"
                  />
                  <div className="flex items-center gap-1.5 ml-auto">
                    <Switch
                      checked={iv.is_active}
                      onCheckedChange={(v) => updateInterval(day, idx, { is_active: v })}
                    />
                    <span className="text-[11px] text-muted-foreground">Ativo</span>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => removeInterval(day, idx)}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        );
      })}
      <div className="flex justify-end pt-2">
        <Button onClick={save} disabled={saving}>
          {saving ? "Salvando..." : "Salvar horários"}
        </Button>
      </div>
    </div>
  );
}
