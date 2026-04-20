import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Ticket, Copy, Check, Store as StoreIcon, Tag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCoupon } from "@/contexts/CouponContext";
import { calculateDiscount, formatCouponLabel, type CouponLike } from "@/lib/coupons";
import { toast } from "sonner";

export const Route = createFileRoute("/cupons")({
  head: () => ({
    meta: [
      { title: "Cupons — Youapp" },
      { name: "description", content: "Cupons e ofertas com até 50% OFF no Youapp." },
    ],
  }),
  component: CouponsPage,
});

interface StoreCoupon {
  id: string;
  store_id: string;
  code: string;
  title: string;
  description: string | null;
  discount_label: string;
  min_order: number;
  stores: { name: string; slug: string; emoji: string; image_url: string | null } | null;
}

function CouponsPage() {
  const [globals, setGlobals] = useState<CouponLike[]>([]);
  const [storeCoupons, setStoreCoupons] = useState<StoreCoupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);
  const { applied, apply, clear } = useCoupon();

  useEffect(() => {
    Promise.all([
      supabase
        .from("coupons")
        .select("id, code, title, description, discount_type, discount_value, min_order, max_discount, store_ids, expires_at")
        .order("expires_at", { ascending: true, nullsFirst: false }),
      supabase
        .from("store_coupons")
        .select("id, store_id, code, title, description, discount_label, min_order, stores(name, slug, emoji, image_url)"),
    ]).then(([g, s]) => {
      setGlobals((g.data ?? []) as CouponLike[]);
      setStoreCoupons((s.data ?? []) as unknown as StoreCoupon[]);
      setLoading(false);
    });
  }, []);

  const copy = (code: string) => {
    navigator.clipboard.writeText(code).catch(() => {});
    setCopied(code);
    setTimeout(() => setCopied(null), 1500);
  };

  const handleApply = (c: CouponLike) => {
    apply(c);
    toast.success(`Cupom ${c.code} pronto pra usar`, {
      description: "Será aplicado automaticamente na sacola.",
    });
  };

  return (
    <div className="min-h-screen bg-surface pb-12">
      <header className="sticky top-0 z-30 bg-card border-b border-border px-4 py-3 flex items-center gap-3">
        <Link to="/" className="p-1 -ml-1" aria-label="Voltar">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="font-semibold flex-1">Cupons</h1>
      </header>

      {applied && (
        <div className="mx-auto max-w-2xl px-4 pt-4">
          <div className="bg-brand text-brand-foreground rounded-2xl p-3 flex items-center gap-3">
            <Check className="h-5 w-5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs opacity-90">Cupom ativo</p>
              <p className="font-bold text-sm truncate">{applied.code} — {formatCouponLabel(applied)}</p>
            </div>
            <button
              onClick={() => { clear(); toast.message("Cupom removido"); }}
              className="text-xs font-semibold underline"
            >
              Remover
            </button>
          </div>
        </div>
      )}

      <main className="max-w-2xl mx-auto px-4 py-5 space-y-8">
        {loading ? (
          <p className="text-sm text-muted-foreground text-center py-8">Carregando...</p>
        ) : (
          <>
            <section>
              <h2 className="text-base font-bold mb-3 flex items-center gap-2">
                <Ticket className="h-4 w-4 text-brand" /> Ofertas Youapp
              </h2>
              {globals.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum cupom global no momento.</p>
              ) : (
                <div className="space-y-2.5">
                  {globals.map((c) => {
                    const isApplied = applied?.id === c.id;
                    const test = calculateDiscount(c, c.min_order); // ok mínimo
                    return (
                      <article
                        key={c.id}
                        className={`bg-card rounded-2xl p-4 shadow-[var(--shadow-card)] border ${isApplied ? "border-brand" : "border-transparent"}`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="h-12 w-12 rounded-xl bg-brand-soft text-brand flex items-center justify-center font-extrabold text-sm shrink-0">
                            {formatCouponLabel(c).split(" ")[0]}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-sm">{c.title}</h3>
                            {c.description && (
                              <p className="text-xs text-muted-foreground mt-0.5">{c.description}</p>
                            )}
                            <div className="flex items-center gap-2 mt-2">
                              <button
                                onClick={() => copy(c.code)}
                                className="inline-flex items-center gap-1.5 text-[11px] font-mono font-bold border border-dashed border-border rounded-md px-2 py-1 hover:border-brand hover:text-brand"
                              >
                                {copied === c.code ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                                {c.code}
                              </button>
                              <span className="text-[11px] text-muted-foreground">
                                Mín. R$ {Number(c.min_order).toFixed(2).replace(".", ",")}
                              </span>
                            </div>
                            {test.reason && (
                              <p className="text-[11px] text-muted-foreground mt-1">{test.reason}</p>
                            )}
                          </div>
                          <button
                            onClick={() => (isApplied ? clear() : handleApply(c))}
                            className={`shrink-0 text-xs font-bold px-3 py-1.5 rounded-full ${
                              isApplied
                                ? "bg-muted text-foreground"
                                : "bg-brand text-brand-foreground"
                            }`}
                          >
                            {isApplied ? "Ativo" : "Usar"}
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>

            <section>
              <h2 className="text-base font-bold mb-3 flex items-center gap-2">
                <StoreIcon className="h-4 w-4 text-brand" /> Cupons por loja
              </h2>
              {storeCoupons.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma loja com cupons ativos.</p>
              ) : (
                <div className="space-y-2.5">
                  {storeCoupons.map((c) => (
                    <article key={c.id} className="bg-card rounded-2xl p-4 shadow-[var(--shadow-card)]">
                      <div className="flex items-start gap-3">
                        <div className="h-12 w-12 rounded-xl bg-muted overflow-hidden flex items-center justify-center text-xl shrink-0">
                          {c.stores?.image_url ? (
                            <img src={c.stores.image_url} alt={c.stores.name} className="h-full w-full object-cover" loading="lazy" />
                          ) : (
                            <span>{c.stores?.emoji ?? "🏪"}</span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          {c.stores && (
                            <Link
                              to="/loja/$slug"
                              params={{ slug: c.stores.slug }}
                              className="text-[11px] font-semibold text-brand"
                            >
                              {c.stores.name}
                            </Link>
                          )}
                          <h3 className="font-bold text-sm">{c.title}</h3>
                          {c.description && (
                            <p className="text-xs text-muted-foreground mt-0.5">{c.description}</p>
                          )}
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-[11px] font-bold text-brand bg-brand-soft px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                              <Tag className="h-3 w-3" /> {c.discount_label}
                            </span>
                            <button
                              onClick={() => copy(c.code)}
                              className="inline-flex items-center gap-1.5 text-[11px] font-mono font-bold border border-dashed border-border rounded-md px-2 py-1 hover:border-brand hover:text-brand"
                            >
                              {copied === c.code ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                              {c.code}
                            </button>
                          </div>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
