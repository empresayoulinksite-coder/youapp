import { norm } from "@/lib/categories";

export const isBarbershopStore = (storeCategory?: string | null) => {
  if (!storeCategory) return false;
  const n = norm(storeCategory);
  return n === "barbearia" || n === "barber" || n === "barbershop";
};
