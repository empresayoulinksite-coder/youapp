export type PaymentMethodKey = "pix" | "dinheiro" | "credito" | "debito" | "vale";

export const PAYMENT_METHODS: { key: PaymentMethodKey; label: string }[] = [
  { key: "pix", label: "Pix" },
  { key: "dinheiro", label: "Dinheiro" },
  { key: "credito", label: "Cartão de crédito" },
  { key: "debito", label: "Cartão de débito" },
  { key: "vale", label: "Vale refeição" },
];

export const PAYMENT_LABEL: Record<PaymentMethodKey, string> = PAYMENT_METHODS.reduce(
  (acc, m) => {
    acc[m.key] = m.label;
    return acc;
  },
  {} as Record<PaymentMethodKey, string>,
);

export function isPaymentKey(v: string): v is PaymentMethodKey {
  return PAYMENT_METHODS.some((m) => m.key === v);
}

export function normalizePaymentList(input: unknown): PaymentMethodKey[] {
  if (!Array.isArray(input)) return [];
  return input.filter((v): v is PaymentMethodKey => typeof v === "string" && isPaymentKey(v));
}

export function paymentLabelsFromList(list: PaymentMethodKey[]): string[] {
  return list.map((k) => PAYMENT_LABEL[k]);
}
