export interface CouponLike {
  id: string;
  code: string;
  title: string;
  description: string | null;
  discount_type: "percent" | "fixed";
  discount_value: number;
  min_order: number;
  max_discount: number | null;
  store_ids: string[];
  expires_at: string | null;
}

export function calculateDiscount(
  coupon: CouponLike | null,
  subtotal: number,
  storeId?: string | null,
): { discount: number; reason?: string } {
  if (!coupon) return { discount: 0 };
  if (subtotal < Number(coupon.min_order)) {
    return {
      discount: 0,
      reason: `Pedido mínimo R$ ${Number(coupon.min_order).toFixed(2).replace(".", ",")}`,
    };
  }
  if (coupon.store_ids?.length && storeId && !coupon.store_ids.includes(storeId)) {
    return { discount: 0, reason: "Cupom não válido para esta loja" };
  }
  let discount =
    coupon.discount_type === "percent"
      ? (subtotal * Number(coupon.discount_value)) / 100
      : Number(coupon.discount_value);
  if (coupon.max_discount && discount > Number(coupon.max_discount)) {
    discount = Number(coupon.max_discount);
  }
  if (discount > subtotal) discount = subtotal;
  return { discount };
}

export function formatCouponLabel(c: CouponLike): string {
  if (c.discount_type === "percent") return `${c.discount_value}% OFF`;
  return `R$ ${Number(c.discount_value).toFixed(0)} OFF`;
}
