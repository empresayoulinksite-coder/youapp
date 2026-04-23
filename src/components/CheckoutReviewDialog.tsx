import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { X, MapPin, CreditCard, Phone, Pencil, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import type { ActiveAddress } from "@/contexts/AddressContext";

export type PaymentMethod =
  | "Pix"
  | "Dinheiro"
  | "Cartão de crédito"
  | "Cartão de débito"
  | "Vale refeição";

interface Props {
  open: boolean;
  onClose: () => void;
  address: ActiveAddress | null;
  storeWhatsapp: string | null;
  acceptedPaymentMethods?: string | null;
  submitting: boolean;
  onConfirm: (data: { paymentMethod: PaymentMethod; notes: string }) => void;
}

const ALL_METHODS: PaymentMethod[] = [
  "Pix",
  "Dinheiro",
  "Cartão de crédito",
  "Cartão de débito",
  "Vale refeição",
];

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

function formatAddress(a: ActiveAddress | null): string {
  if (!a) return "";
  return [a.street, a.number, a.complement, a.neighborhood, a.city]
    .filter(Boolean)
    .join(", ");
}

export function CheckoutReviewDialog({
  open,
  onClose,
  address,
  storeWhatsapp,
  acceptedPaymentMethods,
  submitting,
  onConfirm,
}: Props) {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [notes, setNotes] = useState("");

  if (!open) return null;

  // Filtra os métodos pelos aceitos pela loja (se informado)
  const accepted = (acceptedPaymentMethods ?? "").toLowerCase();
  const methods =
    accepted.trim().length > 0
      ? ALL_METHODS.filter((m) => accepted.includes(m.toLowerCase().split(" ")[0]))
      : ALL_METHODS;
  const finalMethods = methods.length > 0 ? methods : ALL_METHODS;

  const addressText = formatAddress(address);
  const canConfirm = !!paymentMethod && !!addressText && !submitting;

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
          {/* Endereço */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" /> Endereço de entrega
              </h3>
              <Link
                to="/perfil"
                className="text-xs font-semibold text-brand flex items-center gap-1"
              >
                <Pencil className="h-3 w-3" /> Editar
              </Link>
            </div>
            {addressText ? (
              <div className="rounded-xl border border-border bg-background p-3">
                <p className="text-sm font-semibold">{address?.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{addressText}</p>
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
            <div className="space-y-2">
              {finalMethods.map((m) => {
                const checked = paymentMethod === m;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setPaymentMethod(m)}
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
                    <span className="text-sm font-semibold">{m}</span>
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
              paymentMethod && onConfirm({ paymentMethod, notes: notes.trim() })
            }
            disabled={!canConfirm}
            className="w-full bg-brand text-brand-foreground font-bold py-3.5 rounded-full shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting
              ? "Enviando..."
              : !addressText
                ? "Cadastre um endereço"
                : !paymentMethod
                  ? "Escolha o pagamento"
                  : "Confirmar e enviar pelo WhatsApp"}
          </button>
        </div>
      </div>
    </div>
  );
}
