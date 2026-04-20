import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import type { CouponLike } from "@/lib/coupons";

const STORAGE_KEY = "youapp.appliedCoupon";

interface Ctx {
  applied: CouponLike | null;
  apply: (c: CouponLike) => void;
  clear: () => void;
}

const CouponContext = createContext<Ctx | undefined>(undefined);

export function CouponProvider({ children }: { children: ReactNode }) {
  const [applied, setApplied] = useState<CouponLike | null>(null);

  useEffect(() => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
      if (raw) setApplied(JSON.parse(raw));
    } catch {
      // ignore
    }
  }, []);

  const apply = (c: CouponLike) => {
    setApplied(c);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(c));
    } catch {
      // ignore
    }
  };

  const clear = () => {
    setApplied(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  };

  return (
    <CouponContext.Provider value={{ applied, apply, clear }}>{children}</CouponContext.Provider>
  );
}

export function useCoupon() {
  const ctx = useContext(CouponContext);
  if (!ctx) throw new Error("useCoupon must be used within CouponProvider");
  return ctx;
}
