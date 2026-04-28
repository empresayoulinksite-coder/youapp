import { useEffect, useState } from "react";
import { Check, Clock, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { type GymPlan, type GymClass, WEEKDAY_LABELS, formatTime } from "@/lib/gym";

export function GymSections({ storeId }: { storeId: string }) {
  const [plans, setPlans] = useState<GymPlan[]>([]);
  const [classes, setClasses] = useState<GymClass[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [p, c] = await Promise.all([
        supabase
          .from("gym_plans")
          .select("*")
          .eq("store_id", storeId)
          .eq("is_active", true)
          .order("position"),
        supabase
          .from("gym_classes")
          .select("*")
          .eq("store_id", storeId)
          .eq("is_active", true)
          .order("weekday")
          .order("starts_at"),
      ]);
      setPlans((p.data ?? []) as GymPlan[]);
      setClasses((c.data ?? []) as GymClass[]);
      setLoading(false);
    })();
  }, [storeId]);

  if (loading) return null;
  if (plans.length === 0 && classes.length === 0) return null;

  // Group classes by weekday
  const byDay = new Map<number, GymClass[]>();
  classes.forEach((c) => {
    const arr = byDay.get(c.weekday) ?? [];
    arr.push(c);
    byDay.set(c.weekday, arr);
  });

  return (
    <div className="space-y-6 mb-6">
      {plans.length > 0 && (
        <section>
          <h3 className="font-bold mb-3">Planos</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className="relative rounded-2xl border bg-card p-4 shadow-[var(--shadow-card)]"
              >
                {plan.highlight && (
                  <span className="absolute -top-2 right-3 text-[10px] font-bold uppercase tracking-wide bg-brand text-brand-foreground px-2 py-0.5 rounded-full">
                    {plan.highlight}
                  </span>
                )}
                <h4 className="font-bold">{plan.name}</h4>
                {plan.description && (
                  <p className="text-xs text-muted-foreground mt-0.5">{plan.description}</p>
                )}
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-2xl font-extrabold text-brand">
                    R$ {plan.price.toFixed(2).replace(".", ",")}
                  </span>
                  <span className="text-xs text-muted-foreground">/ {plan.billing_period}</span>
                </div>
                {plan.features.length > 0 && (
                  <ul className="mt-3 space-y-1">
                    {plan.features.map((f, i) => (
                      <li key={i} className="text-xs flex items-start gap-1.5">
                        <Check className="h-3.5 w-3.5 text-brand mt-0.5 shrink-0" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {classes.length > 0 && (
        <section>
          <h3 className="font-bold mb-3">Aulas coletivas</h3>
          <div className="space-y-3">
            {WEEKDAY_LABELS.map((label, day) => {
              const items = byDay.get(day);
              if (!items || items.length === 0) return null;
              return (
                <div key={day} className="rounded-2xl border bg-card p-3">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2">
                    {label}
                  </p>
                  <ul className="space-y-2">
                    {items.map((c) => (
                      <li key={c.id} className="flex items-start gap-3 text-sm">
                        <span className="font-mono text-xs bg-brand-soft text-brand rounded-md px-2 py-1 shrink-0">
                          {formatTime(c.starts_at)}–{formatTime(c.ends_at)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold truncate">{c.name}</p>
                          {c.instructor && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <User className="h-3 w-3" /> {c.instructor}
                            </p>
                          )}
                          {c.description && (
                            <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                              {c.description}
                            </p>
                          )}
                        </div>
                        {c.capacity != null && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1 shrink-0">
                            <Clock className="h-3 w-3" /> {c.capacity} vagas
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
