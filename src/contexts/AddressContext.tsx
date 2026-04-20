import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation as useUserLocation, type UserLocation } from "@/hooks/use-location";

export type SavedAddress = {
  id: string;
  user_id: string;
  label: string;
  icon: string;
  cep: string | null;
  street: string;
  number: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  reference: string | null;
  lat: number | null;
  lng: number | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
};

export type ActiveAddress = {
  source: "saved" | "gps";
  id?: string;
  label: string;
  street: string | null;
  number: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  shortLabel: string;
};

type Ctx = {
  addresses: SavedAddress[];
  active: ActiveAddress | null;
  loading: boolean;
  gpsLocation: UserLocation | null;
  gpsStatus: ReturnType<typeof useUserLocation>["status"];
  detectGps: () => void;
  selectSaved: (id: string) => void;
  useGps: () => void;
  refresh: () => Promise<void>;
  removeAddress: (id: string) => Promise<void>;
  setDefault: (id: string) => Promise<void>;
};

const AddressContext = createContext<Ctx | null>(null);
const ACTIVE_KEY = "youapp:active-address";

function buildShort(
  street: string | null,
  number: string | null,
  neighborhood: string | null,
  city: string | null,
): string {
  const head = [street, number].filter(Boolean).join(", ");
  return head || neighborhood || city || "Localização";
}

export function AddressProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const {
    location: gpsLocation,
    status: gpsStatus,
    detect: detectGps,
  } = useUserLocation();
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeId, setActiveId] = useState<string | "gps" | null>(() => {
    if (typeof window === "undefined") return null;
    return (localStorage.getItem(ACTIVE_KEY) as string | null) ?? null;
  });

  const refresh = useCallback(async () => {
    if (!user) {
      setAddresses([]);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("user_addresses")
      .select("*")
      .eq("user_id", user.id)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false });
    setAddresses((data ?? []) as SavedAddress[]);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Se não tem activeId mas tem endereço padrão, usa ele
  useEffect(() => {
    if (activeId) return;
    const def = addresses.find((a) => a.is_default) ?? addresses[0];
    if (def) {
      setActiveId(def.id);
      try {
        localStorage.setItem(ACTIVE_KEY, def.id);
      } catch {
        // ignore
      }
    }
  }, [addresses, activeId]);

  const persist = (id: string | "gps" | null) => {
    setActiveId(id);
    try {
      if (id) localStorage.setItem(ACTIVE_KEY, id);
      else localStorage.removeItem(ACTIVE_KEY);
    } catch {
      // ignore
    }
  };

  const selectSaved = (id: string) => persist(id);
  const useGps = () => persist("gps");

  const removeAddress = async (id: string) => {
    await supabase.from("user_addresses").delete().eq("id", id);
    if (activeId === id) persist(null);
    await refresh();
  };

  const setDefault = async (id: string) => {
    await supabase.from("user_addresses").update({ is_default: true }).eq("id", id);
    persist(id);
    await refresh();
  };

  const active: ActiveAddress | null = useMemo(() => {
    if (activeId === "gps") {
      if (!gpsLocation) return null;
      return {
        source: "gps",
        label: "Localização atual",
        street: gpsLocation.street,
        number: null,
        complement: null,
        neighborhood: gpsLocation.neighborhood,
        city: gpsLocation.city,
        state: gpsLocation.state,
        shortLabel: gpsLocation.label,
      };
    }
    if (activeId) {
      const a = addresses.find((x) => x.id === activeId);
      if (a) {
        return {
          source: "saved",
          id: a.id,
          label: a.label,
          street: a.street,
          number: a.number,
          complement: a.complement,
          neighborhood: a.neighborhood,
          city: a.city,
          state: a.state,
          shortLabel: buildShort(a.street, a.number, a.neighborhood, a.city),
        };
      }
    }
    // fallback GPS quando não há nada salvo
    if (gpsLocation) {
      return {
        source: "gps",
        label: "Localização atual",
        street: gpsLocation.street,
        number: null,
        complement: null,
        neighborhood: gpsLocation.neighborhood,
        city: gpsLocation.city,
        state: gpsLocation.state,
        shortLabel: gpsLocation.label,
      };
    }
    return null;
  }, [activeId, addresses, gpsLocation]);

  return (
    <AddressContext.Provider
      value={{
        addresses,
        active,
        loading,
        gpsLocation,
        gpsStatus,
        detectGps,
        selectSaved,
        useGps,
        refresh,
        removeAddress,
        setDefault,
      }}
    >
      {children}
    </AddressContext.Provider>
  );
}

export function useAddress() {
  const ctx = useContext(AddressContext);
  if (!ctx) throw new Error("useAddress must be used inside AddressProvider");
  return ctx;
}
