import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Plus, Minus, Trash2, ShoppingBag, Ticket, X, Check } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import { useCoupon } from "@/contexts/CouponContext";
import { useAddress } from "@/contexts/AddressContext";
import { supabase } from "@/integrations/supabase/client";
import { calculateDiscount, formatCouponLabel, type CouponLike } from "@/lib/coupons";
import { isStoreOpen, nextOpeningLabel, type StoreHour } from "@/lib/store-hours";
import { openWhatsapp } from "@/lib/whatsapp";
import { toast } from "sonner";
import { CheckoutReviewDialog, type PaymentMethod } from "@/components/CheckoutReviewDialog";
import { OrderTrackingDialog } from "@/components/OrderTrackingDialog";
import { getMesaSession, clearMesaSession } from "@/lib/mesa-session";

export const Route = createFileRoute("/sacola")({
  head: () => ({
    meta: [{ title: "Sacola — Youapp" }],
  }),
  component: CartPage,
});

function CartPage() {
  const { user, loading } = useAuth();
  const { items, total, updateQuantity, removeItem, clear } = useCart();
  const { applied, apply, clear: clearCoupon } = useCoupon();
  const navigate = useNavigate();

  const [code, setCode] = useState("");
  const [validating, setValidating] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  const storeName = items[0]?.stores?.name;
  const storeSlug = items[0]?.stores?.slug;
  const storeId = items[0]?.store_id ?? null;

  const [storeHours, setStoreHours] = useState<StoreHour[]>([]);
  const [storePaused, setStorePaused] = useState(false);
  const [storeAlwaysOpen, setStoreAlwaysOpen] = useState(false);
  const [storeWhatsapp, setStoreWhatsapp] = useState<string | null>(null);
  const [storeImageUrl, setStoreImageUrl] = useState<string | null>(null);
  const [storePaymentMethods, setStorePaymentMethods] = useState<string[] | null>(null);
  const [pickupEnabled, setPickupEnabled] = useState(false);
  const [storeAddress, setStoreAddress] = useState<string | null>(null);
  const [deliveryMode, setDeliveryMode] = useState<"delivery" | "pickup" | "mesa">("delivery");
  const [tableNumber, setTableNumber] = useState<number | null>(null);
  const [profileName, setProfileName] = useState<string | null>(null);
  const [profilePhone, setProfilePhone] = useState<string | null>(null);
  const [profileCpf, setProfileCpf] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [submitting, setSubmitting] = useState(false);
  const [deliveryFeeValue, setDeliveryFeeValue] = useState<number>(0);
  const [deliveryFeeLabel, setDeliveryFeeLabel] = useState<string>("Grátis");
  const [deliveryAreas, setDeliveryAreas] = useState<
    { id: string; neighborhood: string; fee: number }[]
  >([]);
  const [selectedNeighborhood, setSelectedNeighborhood] = useState<string | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [trackingOrderId, setTrackingOrderId] = useState<string | null>(null);
  const [trackingOrderNumber, setTrackingOrderNumber] = useState<number | null>(null);
  const [trackingOpen, setTrackingOpen] = useState(false);
  const { active } = useAddress();
  const { user: authUser } = useAuth();

  // Carrega nome/telefone salvos no perfil para pré-preencher a revisão
  useEffect(() => {
    if (!authUser) {
      setProfileName(null);
      setProfilePhone(null);
      setProfileCpf(null);
      return;
    }
    supabase
      .from("profiles")
      .select("display_name, phone, cpf")
      .eq("user_id", authUser.id)
      .maybeSingle()
      .then(({ data }) => {
        setProfileName(
          data?.display_name ??
            authUser.user_metadata?.full_name ??
            authUser.user_metadata?.name ??
            authUser.email?.split("@")[0] ??
            null,
        );
        setProfilePhone(data?.phone ?? null);
        setProfileCpf(data?.cpf ?? null);
      });
  }, [authUser]);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  // Detecta se é pedido de mesa via sessionStorage (com validade)
  useEffect(() => {
    if (typeof window === "undefined" || !storeId) return;
    const session = getMesaSession(storeId);
    if (session) {
      setTableNumber(session.tableNumber);
      setDeliveryMode("mesa");
    } else {
      setTableNumber(null);
      if (deliveryMode === "mesa") setDeliveryMode("delivery");
    }
  }, [storeId]);

  useEffect(() => {
    if (!storeId) {
      setStoreHours([]);
      setStorePaused(false);
      setStoreWhatsapp(null);
      setStoreImageUrl(null);
      setStorePaymentMethods(null);
      setPickupEnabled(false);
      setStoreAddress(null);
      return;
    }
    supabase
      .from("store_hours")
      .select("*")
      .eq("store_id", storeId)
      .then(({ data }) => setStoreHours((data ?? []) as StoreHour[]));
    supabase
      .from("stores")
      .select("is_paused, always_open, whatsapp, image_url, payment_methods_list, pickup_enabled, address, neighborhood, city")
      .eq("id", storeId)
      .maybeSingle()
      .then(({ data }) => {
        setStorePaused(!!data?.is_paused);
        setStoreAlwaysOpen(!!data?.always_open);
        setStoreWhatsapp(data?.whatsapp ?? null);
        setStoreImageUrl(data?.image_url ?? null);
        setStorePaymentMethods(
          Array.isArray(data?.payment_methods_list) ? data!.payment_methods_list : null,
        );
        setPickupEnabled(!!data?.pickup_enabled);
        const parts = [data?.address, data?.neighborhood, data?.city].filter(Boolean);
        setStoreAddress(parts.length ? parts.join(", ") : null);
      });
  }, [storeId]);

  // Carrega áreas de entrega da loja
  useEffect(() => {
    if (!storeId) {
      setDeliveryAreas([]);
      return;
    }
    supabase
      .from("store_delivery_areas")
      .select("id, fee, is_active, neighborhood")
      .eq("store_id", storeId)
      .then(({ data }) => {
        const areas = (data ?? [])
          .filter((a) => a.is_active)
          .map((a) => ({
            id: a.id as string,
            neighborhood: a.neighborhood as string,
            fee: Number(a.fee),
          }));
        setDeliveryAreas(areas);
      });
  }, [storeId]);

  // Pré-seleciona bairro a partir do endereço ativo
  useEffect(() => {
    if (deliveryAreas.length === 0) {
      setSelectedNeighborhood(null);
      return;
    }
    const norm = (s: string) =>
      s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    if (active?.neighborhood) {
      const match = deliveryAreas.find(
        (a) => norm(a.neighborhood) === norm(active.neighborhood!),
      );
      if (match) {
        setSelectedNeighborhood(match.neighborhood);
        return;
      }
    }
    // Mantém seleção atual se ainda existir na lista
    setSelectedNeighborhood((prev) => {
      if (!prev) return null;
      const stillExists = deliveryAreas.some(
        (a) => norm(a.neighborhood) === norm(prev),
      );
      return stillExists ? prev : null;
    });
  }, [deliveryAreas, active?.neighborhood]);

  // Calcula taxa de entrega com base no bairro selecionado
  useEffect(() => {
    if (deliveryMode === "pickup" || deliveryMode === "mesa") {
      setDeliveryFeeValue(0);
      setDeliveryFeeLabel("—");
      return;
    }
    if (!selectedNeighborhood || deliveryAreas.length === 0) {
      setDeliveryFeeValue(0);
      setDeliveryFeeLabel(deliveryAreas.length === 0 ? "Grátis" : "A definir");
      return;
    }
    const norm = (s: string) =>
      s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    const match = deliveryAreas.find(
      (a) => norm(a.neighborhood) === norm(selectedNeighborhood),
    );
    const fee = match ? Number(match.fee) : 0;
    setDeliveryFeeValue(fee);
    setDeliveryFeeLabel(fee > 0 ? `R$ ${fee.toFixed(2).replace(".", ",")}` : "Grátis");
  }, [selectedNeighborhood, deliveryAreas, deliveryMode]);

  const withinHours = storeHours.length === 0 ? true : isStoreOpen(storeHours, now);
  const storeOpen = !storePaused && withinHours;
  const nextOpen = !storeOpen && !storePaused ? nextOpeningLabel(storeHours, now) : null;

  // Garante que se a loja desabilitar retirada, voltamos para entrega
  useEffect(() => {
    if (!pickupEnabled && deliveryMode === "pickup") setDeliveryMode("delivery");
  }, [pickupEnabled, deliveryMode]);

  const { discount, reason } = calculateDiscount(applied, total, storeId);
  const grandTotal = Math.max(0, total - discount + (deliveryMode === "pickup" || deliveryMode === "mesa" ? 0 : deliveryFeeValue));

  const applyCode = async (codeToTry?: string) => {
    const c = (codeToTry ?? code).trim().toUpperCase();
    if (!c) return;
    setValidating(true);
    const { data, error } = await supabase
      .from("coupons")
      .select("id, code, title, description, discount_type, discount_value, min_order, max_discount, store_ids, expires_at")
      .eq("code", c)
      .eq("is_active", true)
      .maybeSingle();
    setValidating(false);
    if (error || !data) {
      toast.error("Cupom inválido");
      return;
    }
    apply(data as CouponLike);
    setCode("");
    toast.success(`Cupom ${data.code} aplicado!`);
  };

  return (
    <div className="min-h-screen bg-surface pb-32">
      <header className="sticky top-0 z-30 bg-card border-b border-border px-4 py-3 flex items-center gap-3">
        <Link to="/" className="p-1 -ml-1">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="font-semibold flex-1">Sua sacola</h1>
        {items.length > 0 && (
          <button onClick={clear} className="text-xs text-destructive font-semibold">Limpar</button>
        )}
      </header>

      <main className="px-4 py-5 max-w-md mx-auto">
        {items.length === 0 ? (
          <div className="text-center py-16">
            <ShoppingBag className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="font-semibold">Sua sacola está vazia</p>
            <p className="text-sm text-muted-foreground mt-1">Explore lojas e adicione itens.</p>
            <Link to="/" className="mt-5 inline-block bg-brand text-brand-foreground font-bold px-5 py-2.5 rounded-full text-sm">
              Ver lojas
            </Link>
          </div>
        ) : (
          <>
            {storeName && storeSlug && (
              <Link to="/loja/$slug" params={{ slug: storeSlug }} className="block bg-card rounded-2xl p-3 mb-4 shadow-[var(--shadow-card)]">
                <p className="text-[11px] text-muted-foreground uppercase">Pedido em</p>
                <p className="font-semibold">{storeName}</p>
              </Link>
            )}

            <div className="space-y-2">
              {items.map((item) => {
                const isPizza = Array.isArray(item.pizza_flavors) && item.pizza_flavors.length > 0;
                const unitPrice = Number(item.unit_price_override ?? item.menu_items?.price ?? 0);
                return (
                  <article key={item.id} className="bg-card rounded-2xl p-3 flex items-start gap-3 shadow-[var(--shadow-card)]">
                    <div className="h-14 w-14 rounded-xl bg-brand-soft flex items-center justify-center text-2xl overflow-hidden shrink-0">
                      {item.menu_items?.image_url ? (
                        <img
                          src={item.menu_items.image_url}
                          alt={item.menu_items?.name ?? "Produto"}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        isPizza ? "🍕" : item.menu_items?.emoji
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">
                        {isPizza
                          ? `Pizza ${item.pizza_size_name ?? ""}`.trim()
                          : item.half_two_name
                            ? `½ ${item.menu_items?.name} + ½ ${item.half_two_name}`
                            : item.menu_items?.name}
                      </p>
                      {isPizza && (
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {(item.pizza_flavors ?? []).map((f) => f.name).join(" + ")}
                        </p>
                      )}
                      {isPizza && item.pizza_crust_name && (
                        <p className="text-[11px] text-muted-foreground">Borda: {item.pizza_crust_name}</p>
                      )}
                      {isPizza && Array.isArray(item.pizza_addons) && item.pizza_addons.length > 0 && (
                        <p className="text-[11px] text-muted-foreground">
                          Adicionais: {item.pizza_addons.map((a) => a.name).join(", ")}
                        </p>
                      )}
                      {!isPizza && item.selected_size && (
                        <p className="text-[11px] font-semibold text-brand mt-0.5">Tamanho: {item.selected_size}</p>
                      )}
                      <p className="text-xs text-muted-foreground">R$ {unitPrice.toFixed(2).replace(".", ",")}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="bg-brand-soft text-brand rounded-full p-1">
                          {item.quantity === 1 ? <Trash2 className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
                        </button>
                        <span className="text-sm font-bold min-w-[16px] text-center">{item.quantity}</span>
                        <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="bg-brand text-brand-foreground rounded-full p-1">
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    <button onClick={() => removeItem(item.id)} className="text-muted-foreground p-1" aria-label="Remover">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </article>
                );
              })}
            </div>

            {/* Coupon */}
            <div className="bg-card rounded-2xl p-4 mt-5 shadow-[var(--shadow-card)]">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold text-sm flex items-center gap-2">
                  <Ticket className="h-4 w-4 text-brand" /> Cupom de desconto
                </h3>
                <Link to="/cupons" className="text-xs font-semibold text-brand">Ver cupons</Link>
              </div>

              {applied ? (
                <div className="flex items-center gap-3 rounded-xl bg-brand-soft p-3">
                  <div className="h-9 w-9 rounded-full bg-brand text-brand-foreground flex items-center justify-center">
                    <Check className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate">{applied.code}</p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {discount > 0
                        ? `Desconto de ${formatCouponLabel(applied)} aplicado`
                        : reason ?? "Cupom não aplicável agora"}
                    </p>
                  </div>
                  <button
                    onClick={() => clearCoupon()}
                    aria-label="Remover cupom"
                    className="p-1.5 rounded-full hover:bg-card"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <form
                  onSubmit={(e) => { e.preventDefault(); applyCode(); }}
                  className="flex items-center gap-2"
                >
                  <input
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="DIGITE O CÓDIGO"
                    className="flex-1 rounded-full bg-muted px-4 py-2.5 text-sm outline-none placeholder:text-muted-foreground font-mono"
                  />
                  <button
                    type="submit"
                    disabled={!code.trim() || validating}
                    className="bg-brand text-brand-foreground font-bold text-sm px-4 py-2.5 rounded-full disabled:opacity-50"
                  >
                    {validating ? "..." : "Aplicar"}
                  </button>
                </form>
              )}
            </div>

            {/* Toggle Entrega / Retirada (esconde no modo mesa) */}
            {pickupEnabled && deliveryMode !== "mesa" && (
              <div className="bg-card rounded-2xl p-3 mt-3 shadow-[var(--shadow-card)]">
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Como você quer receber?</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setDeliveryMode("delivery")}
                    className={`rounded-xl border-2 p-3 text-left transition-colors ${deliveryMode === "delivery" ? "border-brand bg-brand-soft" : "border-border bg-background"}`}
                  >
                    <p className="text-sm font-bold">🛵 Entrega</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Receber no meu endereço</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeliveryMode("pickup")}
                    className={`rounded-xl border-2 p-3 text-left transition-colors ${deliveryMode === "pickup" ? "border-brand bg-brand-soft" : "border-border bg-background"}`}
                  >
                    <p className="text-sm font-bold">🏪 Retirar no local</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Buscar na loja</p>
                  </button>
                </div>
              </div>
            )}

            {/* Indicador de mesa */}
            {deliveryMode === "mesa" && tableNumber && (
              <div className="bg-card rounded-2xl p-3 mt-3 shadow-[var(--shadow-card)]">
                <p className="text-sm font-bold">🍽️ Mesa {tableNumber}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Pedido será feito diretamente na mesa</p>
              </div>
            )}

            <div className="bg-card rounded-2xl p-4 mt-3 shadow-[var(--shadow-card)] space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-semibold">R$ {total.toFixed(2).replace(".", ",")}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Cupom {applied?.code}</span>
                  <span className="font-semibold text-success">- R$ {discount.toFixed(2).replace(".", ",")}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Entrega</span>
                <span className={`font-semibold ${deliveryFeeValue === 0 ? "text-success" : ""}`}>
                  {deliveryMode === "pickup" || deliveryMode === "mesa" ? "—" : deliveryFeeLabel}
                </span>
              </div>
              <div className="border-t border-border pt-2 flex justify-between">
                <span className="font-bold">Total</span>
                <span className="font-bold text-lg">R$ {grandTotal.toFixed(2).replace(".", ",")}</span>
              </div>
            </div>
          </>
        )}
      </main>

      {items.length > 0 && (
        <div className="fixed bottom-4 left-4 right-4 max-w-md mx-auto z-40">
          {!storeOpen && (
            <p className="mb-2 rounded-xl bg-destructive/10 text-destructive text-xs font-semibold text-center px-3 py-2">
              {storePaused
                ? "Loja temporariamente fechada pelo lojista."
                : `Loja fechada agora${nextOpen ? ` — ${nextOpen}` : ""}.`}
            </p>
          )}
          <button
            onClick={() => {
              if (loading) {
                toast.error("Aguarde sua conta carregar antes de finalizar.");
                return;
              }
              if (!authUser) {
                toast.error("Entre na sua conta para finalizar o pedido.");
                navigate({ to: "/auth" });
                return;
              }
              if (!storeOpen) {
                toast.error("A loja está fechada no momento.");
                return;
              }
              if (!storeWhatsapp && deliveryMode !== "mesa") {
                toast.error("Loja sem WhatsApp cadastrado. Não é possível finalizar.");
                return;
              }
              setReviewOpen(true);
            }}
            disabled={!storeOpen || submitting || loading}
            className="w-full bg-brand text-brand-foreground font-bold py-3.5 rounded-full shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {storeOpen ? "Revisar e finalizar" : "Loja fechada"}
          </button>
        </div>
      )}

      <CheckoutReviewDialog
        open={reviewOpen}
        onClose={() => !submitting && setReviewOpen(false)}
        address={active}
        storeWhatsapp={storeWhatsapp}
        acceptedPaymentMethods={storePaymentMethods}
        customerName={profileName}
        customerPhone={profilePhone}
        customerCpf={profileCpf}
        deliveryMode={deliveryMode}
        storeAddress={storeAddress}
        tableNumber={tableNumber}
        submitting={submitting}
        deliveryAreas={deliveryAreas}
        selectedNeighborhood={selectedNeighborhood}
        selectedDeliveryFee={deliveryFeeValue}
        onSelectNeighborhood={(area) => setSelectedNeighborhood(area.neighborhood)}
        onConfirm={async ({ paymentMethod, notes, number, complement, customerName, customerPhone, customerCpf }) => {
          if (!authUser) {
            toast.error("Entre na sua conta para finalizar o pedido.");
            navigate({ to: "/auth" });
            return;
          }
          if (!storeId) {
            toast.error("Não foi possível identificar a loja deste pedido.");
            return;
          }
          if (!storeWhatsapp && deliveryMode !== "mesa") return;
          setSubmitting(true);
          try {
            const fmtBRL = (n: number) => `R$ ${n.toFixed(2).replace(".", ",")}`;
            const lines = [
              `Olá, ${storeName}! Gostaria de fazer um pedido:`,
              "",
              ...items.map((i) => {
                const isPizza = Array.isArray(i.pizza_flavors) && i.pizza_flavors.length > 0;
                const unit = Number(i.unit_price_override ?? i.menu_items?.price ?? 0);
                if (isPizza) {
                  const flavorsTxt = (i.pizza_flavors ?? []).map((f) => f.name).join(" + ");
                  const parts: string[] = [];
                  parts.push(`• ${i.quantity}x 🍕 Pizza ${i.pizza_size_name ?? ""} — ${fmtBRL(unit * i.quantity)}`.replace(/\s+—/, " —"));
                  parts.push(`   Sabores: ${flavorsTxt}`);
                  if (i.pizza_crust_name) parts.push(`   Borda: ${i.pizza_crust_name}`);
                  if (Array.isArray(i.pizza_addons) && i.pizza_addons.length > 0) {
                    parts.push(`   Adicionais: ${i.pizza_addons.map((a) => a.name).join(", ")}`);
                  }
                  return parts.join("\n");
                }
                const name = i.half_two_name
                  ? `½ ${i.menu_items?.name} + ½ ${i.half_two_name}`
                  : (i.menu_items?.name ?? "Item");
                const sizeSuffix = i.selected_size ? ` (Tamanho: ${i.selected_size})` : "";
                return `• ${i.quantity}x ${name}${sizeSuffix} — ${fmtBRL(unit * i.quantity)}`;
              }),
              "",
              `Subtotal: ${fmtBRL(total)}`,
            ];
          if (discount > 0 && applied) {
            lines.push(`Cupom ${applied.code}: -${fmtBRL(discount)}`);
          }
          if (deliveryMode !== "pickup" && deliveryMode !== "mesa" && deliveryFeeValue > 0) {
            lines.push(`🛵 Entrega: ${fmtBRL(deliveryFeeValue)}`);
          }
          lines.push(`*Total: ${fmtBRL(grandTotal)}*`);
          lines.push("", `💳 Pagamento: ${paymentMethod}`);

          if (customerName) {
            lines.push(`👤 Cliente: ${customerName}`);
          }
          if (customerPhone) {
            const d = customerPhone.replace(/\D/g, "");
            const formatted =
              d.length === 11
                ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
                : d.length === 10
                  ? `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
                  : customerPhone;
            lines.push(`📱 Contato: ${formatted}`);
          }
          if (customerCpf) {
            const d = customerCpf.replace(/\D/g, "");
            const formattedCpf =
              d.length === 11
                ? `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
                : customerCpf;
            lines.push(`🧾 CPF: ${formattedCpf}`);
          }

          // Persiste alterações no perfil para próximas compras
          if (
            authUser &&
            (customerName !== (profileName ?? "") ||
              customerPhone !== (profilePhone ?? "") ||
              customerCpf !== (profileCpf ?? ""))
          ) {
            await supabase
              .from("profiles")
              .update({
                display_name: customerName || null,
                phone: customerPhone || null,
                cpf: customerCpf || null,
              })
              .eq("user_id", authUser.id);
            setProfileName(customerName || null);
            setProfilePhone(customerPhone || null);
            setProfileCpf(customerCpf || null);
          }
          let deliveryAddress: string | null = null;
          if (deliveryMode === "mesa" && tableNumber) {
            lines.push(`🍽️ Mesa ${tableNumber}`);
          } else if (deliveryMode === "pickup") {
            lines.push(`🏪 Retirada no local${storeAddress ? `: ${storeAddress}` : ""}`);
          } else if (active) {
            const finalNumber = number || active.number || "";
            const finalComplement = complement || active.complement || "";
            const addrParts = [
              active.street,
              finalNumber || null,
              finalComplement || null,
              selectedNeighborhood || active.neighborhood,
              active.city,
            ].filter(Boolean);
            if (addrParts.length > 0) {
              deliveryAddress = addrParts.join(", ");
              lines.push(`📍 Entrega: ${deliveryAddress}`);
            }
          }
          if (notes) {
            lines.push("", `📝 Obs: ${notes}`);
          }

          const message = lines.join("\n");

          // Salva o pedido no banco antes de abrir o WhatsApp
            const firstStore = items[0]?.stores;
            const { data: order, error: orderError } = await supabase
              .from("orders")
              .insert({
                user_id: authUser.id,
                store_id: storeId,
                store_name: storeName ?? firstStore?.name ?? "Loja",
                store_slug: storeSlug ?? firstStore?.slug ?? "",
                store_emoji: firstStore?.emoji ?? null,
                store_image_url: storeImageUrl,
                store_whatsapp: storeWhatsapp,
                total: grandTotal,
                delivery_fee: deliveryMode === "pickup" || deliveryMode === "mesa" ? 0 : deliveryFeeValue,
                discount,
                delivery_address: deliveryAddress,
                payment_method: paymentMethod,
                customer_notes: notes || null,
                customer_cpf: customerCpf || null,
                whatsapp_message: message,
                status: "em_analise",
                table_number: tableNumber ?? null,
              })
              .select("id, order_number")
              .single();
            if (orderError) throw orderError;
            if (!orderError && order) {
              const itemRows = items.map((i) => ({
                order_id: order.id,
                menu_item_id: i.menu_item_id,
                name: Array.isArray(i.pizza_flavors) && i.pizza_flavors.length > 0
                  ? `🍕 Pizza ${i.pizza_size_name ?? ""}`.trim()
                  : i.half_two_name
                    ? `½ ${i.menu_items?.name} + ½ ${i.half_two_name}`
                    : (i.menu_items?.name ?? "Item"),
                quantity: i.quantity,
                unit_price: Number(i.unit_price_override ?? i.menu_items?.price ?? 0),
                emoji: i.menu_items?.emoji ?? null,
                image_url: i.menu_items?.image_url ?? null,
                selected_size: i.selected_size ?? null,
                half_two_menu_item_id: i.half_two_menu_item_id ?? null,
                half_two_name: i.half_two_name ?? null,
                pizza_size_id: i.pizza_size_id ?? null,
                pizza_size_name: i.pizza_size_name ?? null,
                pizza_flavors: (i.pizza_flavors ?? null) as any,
                pizza_crust_id: i.pizza_crust_id ?? null,
                pizza_crust_name: i.pizza_crust_name ?? null,
                pizza_crust_price: i.pizza_crust_price ?? null,
                pizza_addons: (i.pizza_addons ?? null) as any,
              }));
              const { error: itemsError } = await supabase.from("order_items").insert(itemRows);
              if (itemsError) throw itemsError;
            }

          // Mesa: abre tracking dialog; outros: abre WhatsApp
          if (deliveryMode === "mesa" && order) {
            setTrackingOrderId(order.id);
            setTrackingOrderNumber(order.order_number ?? null);
            setReviewOpen(false);
            setTrackingOpen(true);
          } else if (storeWhatsapp) {
            openWhatsapp(storeWhatsapp, message);
            setReviewOpen(false);
          }

          await clear();
          clearCoupon();
          // Limpa mesa da sessão após pedido
          if (tableNumber) {
            clearMesaSession();
          }
          if (deliveryMode !== "mesa") {
            toast.success("Pedido enviado! Continue no WhatsApp.");
          }
          } catch (error) {
            console.error("Erro ao finalizar pedido:", error);
            toast.error("Não foi possível salvar o pedido. Tente novamente.");
          } finally {
            setSubmitting(false);
          }
        }}
      />

      <OrderTrackingDialog
        open={trackingOpen}
        onOpenChange={setTrackingOpen}
        orderId={trackingOrderId}
        orderNumber={trackingOrderNumber}
        tableNumber={tableNumber}
        storeName={storeName}
      />
    </div>
  );
}
