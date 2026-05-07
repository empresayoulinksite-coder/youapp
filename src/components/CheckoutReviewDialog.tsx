import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { X, MapPin, CreditCard, Phone, Pencil, Check, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { ActiveAddress } from "@/contexts/AddressContext";
import {
  PAYMENT_METHODS,
  PAYMENT_LABEL,
  normalizePaymentList,
  type PaymentMethodKey,
} from "@/lib/payment-methods";

export type PaymentMethod = string;

interface Props {
  open: boolean;
  onClose: () => void;
  address: ActiveAddress | null;
  storeWhatsapp: string | null;
  acceptedPaymentMethods?: string[] | null;
  customerName?: string | null;
  customerPhone?: string | null;
  deliveryMode?: "delivery" | "pickup" | "mesa";
  storeAddress?: string | null;
  tableNumber?: number | null;
  submitting: boolean;
  onConfirm: (data: {
    paymentMethod: PaymentMethod;
    notes: string;
    number: string;
    complement: string;
    customerName: string;
    customerPhone: string;
  }) => void;
}

function maskPhoneInput(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 10) return d.replace(/(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3").trim().replace(/-$/, "");
  return d.replace(/(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3").trim().replace(/-$/, "");
}

function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  const local = digits.startsWith("55") ? digits.slice(2) : digits;
  if (local.length === 11) {
    return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  }
  if (local.length === 10) {
    return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  }
  return raw;
}

function formatAddress(
  a: ActiveAddress | null,
  numberOverride?: string,
  complementOverride?: string,
): string {
  if (!a) return "";
  const num = (numberOverride ?? a.number ?? "").trim();
  const comp = (complementOverride ?? a.complement ?? "").trim();
  return [a.street, num || null, comp || null, a.neighborhood, a.city]
    .filter(Boolean)
    .join(", ");
}

export function CheckoutReviewDialog({
  open,
  onClose,
  address,
  storeWhatsapp,
  acceptedPaymentMethods,
  customerName: initialName,
  customerPhone: initialPhone,
  deliveryMode = "delivery",
  storeAddress,
  tableNumber,
  submitting,
  onConfirm,
}: Props) {
  const isPickup = deliveryMode === "pickup";
  const isMesa = deliveryMode === "mesa";
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [notes, setNotes] = useState("");
  const [number, setNumber] = useState("");
  const [complement, setComplement] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  // Sempre que o endereço ativo mudar (ou abrir), pré-preenche número/complemento
  useEffect(() => {
    if (!open) return;
    setNumber(address?.number ?? "");
    setComplement(address?.complement ?? "");
  }, [open, address?.id, address?.number, address?.complement]);

  useEffect(() => {
    if (!open) return;
    setName(initialName ?? "");
    setPhone(initialPhone ? maskPhoneInput(initialPhone) : "");
  }, [open, initialName, initialPhone]);

  if (!open) return null;

  // Lista padronizada vinda da loja (chaves)
  const acceptedKeys = normalizePaymentList(acceptedPaymentMethods);
  const finalMethods: { key: PaymentMethodKey; label: string }[] =
    acceptedKeys.length > 0
      ? acceptedKeys.map((k) => ({ key: k, label: PAYMENT_LABEL[k] }))
      : PAYMENT_METHODS;
  const noMethodsConfigured = acceptedKeys.length === 0;

  const addressText = formatAddress(address, number, complement);
  const hasNumber = number.trim().length > 0;
  const hasName = name.trim().length > 0;
  const phoneDigits = phone.replace(/\D/g, "");
  const hasPhone = phoneDigits.length >= 10;
  const addressOk = isPickup ? true : !!addressText && hasNumber;
  const canConfirm =
    !!paymentMethod && addressOk && hasName && hasPhone && !submitting;

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
          <div>
            <h2 className="font-bold">Revisar pedido</h2>
            <p className="text-xs text-muted-foreground">Confira tudo antes de enviar</p>
          </div>
          <button onClick={onClose} className="p-1 -mr-1" aria-label="Fechar">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Seus dados */}
          <section>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1.5 mb-2">
              <User className="h-3.5 w-3.5" /> Seus dados
            </h3>
            <div className="rounded-xl border border-border bg-background p-3 space-y-3">
              <div>
                <label className="text-[11px] font-semibold text-muted-foreground uppercase">
                  Nome *
                </label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Seu nome"
                  className="mt-1 h-9"
                  maxLength={80}
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-muted-foreground uppercase">
                  WhatsApp / Telefone *
                </label>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(maskPhoneInput(e.target.value))}
                  placeholder="(11) 99999-9999"
                  className="mt-1 h-9"
                  inputMode="tel"
                  type="tel"
                />
                {!hasPhone && phone.length > 0 && (
                  <p className="text-[11px] text-destructive font-semibold mt-1">
                    Telefone inválido
                  </p>
                )}
              </div>
            </div>
          </section>

          {/* Endereço / Retirada */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" />
                {isPickup ? "Retirada no local" : "Endereço de entrega"}
              </h3>
              {!isPickup && (
                <Link
                  to="/perfil"
                  className="text-xs font-semibold text-brand flex items-center gap-1"
                >
                  <Pencil className="h-3 w-3" /> Editar
                </Link>
              )}
            </div>
            {isPickup ? (
              <div className="rounded-xl border border-border bg-background p-3">
                <p className="text-sm font-semibold">🏪 Você vai retirar na loja</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {storeAddress ?? "Confirme o endereço com a loja pelo WhatsApp."}
                </p>
              </div>
            ) : address ? (
              <div className="rounded-xl border border-border bg-background p-3 space-y-3">
                <div>
                  <p className="text-sm font-semibold">{address.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {[address.street, address.neighborhood, address.city]
                      .filter(Boolean)
                      .join(", ")}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-semibold text-muted-foreground uppercase">
                      Número *
                    </label>
                    <Input
                      value={number}
                      onChange={(e) => setNumber(e.target.value)}
                      placeholder="123 ou Apto 45"
                      className="mt-1 h-9"
                      maxLength={20}
                      inputMode="text"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-muted-foreground uppercase">
                      Complemento
                    </label>
                    <Input
                      value={complement}
                      onChange={(e) => setComplement(e.target.value)}
                      placeholder="Bloco, fundos..."
                      className="mt-1 h-9"
                      maxLength={80}
                    />
                  </div>
                </div>
                {!hasNumber && (
                  <p className="text-[11px] text-destructive font-semibold">
                    Informe o número da casa/apartamento
                  </p>
                )}
              </div>
            ) : (
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3">
                <p className="text-sm text-destructive font-semibold">
                  Nenhum endereço cadastrado
                </p>
                <Link
                  to="/perfil"
                  className="text-xs font-semibold text-brand mt-1 inline-block"
                >
                  Cadastrar endereço →
                </Link>
              </div>
            )}
          </section>

          {/* WhatsApp da loja */}
          <section>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1.5 mb-2">
              <Phone className="h-3.5 w-3.5" /> WhatsApp da loja
            </h3>
            <div className="rounded-xl border border-border bg-background p-3">
              <p className="text-sm font-semibold">
                {storeWhatsapp ? formatPhone(storeWhatsapp) : "Não cadastrado"}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Você será redirecionado para esse número
              </p>
            </div>
          </section>

          {/* Pagamento */}
          <section>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1.5 mb-2">
              <CreditCard className="h-3.5 w-3.5" /> Forma de pagamento
            </h3>
            {noMethodsConfigured && (
              <p className="text-[11px] text-muted-foreground mb-2">
                A loja ainda não definiu formas de pagamento. Mostrando todas as opções.
              </p>
            )}
            <div className="space-y-2">
              {finalMethods.map((m) => {
                const checked = paymentMethod === m.label;
                return (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => setPaymentMethod(m.label)}
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
                      {checked && <Check className="h-3 w-3 text-brand-foreground" />}
                    </div>
                    <span className="text-sm font-semibold">{m.label}</span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Observação */}
          <section>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-2">
              Observação (opcional)
            </h3>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: sem cebola, troco para R$ 50, deixar na portaria..."
              className="min-h-[90px]"
              maxLength={500}
            />
            <p className="text-[11px] text-muted-foreground mt-1 text-right">
              {notes.length}/500
            </p>
          </section>
        </div>

        <div className="sticky bottom-0 bg-card border-t border-border p-4">
          <button
            onClick={() =>
              paymentMethod &&
              onConfirm({
                paymentMethod,
                notes: notes.trim(),
                number: number.trim(),
                complement: complement.trim(),
                customerName: name.trim(),
                customerPhone: phoneDigits,
              })
            }
            disabled={!canConfirm}
            className="w-full bg-brand text-brand-foreground font-bold py-3.5 rounded-full shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting
              ? "Enviando..."
              : !hasName
                ? "Informe seu nome"
                : !hasPhone
                  ? "Informe seu telefone"
                  : !isPickup && !address
                    ? "Cadastre um endereço"
                    : !isPickup && !hasNumber
                      ? "Informe o número"
                      : !paymentMethod
                        ? "Escolha o pagamento"
                        : "Confirmar e enviar pelo WhatsApp"}
          </button>
        </div>
      </div>
    </div>
  );
}
