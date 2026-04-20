import { useEffect, useState } from "react";

export type UserLocation = {
  lat: number;
  lng: number;
  street: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  label: string;
};

type Status = "idle" | "loading" | "ready" | "denied" | "error";

const STORAGE_KEY = "youapp:user-location";

function loadCached(): UserLocation | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as UserLocation) : null;
  } catch {
    return null;
  }
}

async function reverseGeocode(
  lat: number,
  lng: number,
): Promise<UserLocation> {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=pt-BR`;
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error("Falha ao obter endereço");
  const data = await res.json();
  const a = data.address ?? {};
  const street: string | null = a.road ?? a.pedestrian ?? null;
  const neighborhood: string | null =
    a.suburb ?? a.neighbourhood ?? a.quarter ?? a.city_district ?? null;
  const city: string | null =
    a.city ?? a.town ?? a.village ?? a.municipality ?? null;
  const state: string | null = a.state ?? null;
  const label =
    [street, neighborhood].filter(Boolean).join(", ") ||
    city ||
    "Localização atual";
  return { lat, lng, street, neighborhood, city, state, label };
}

export function useLocation() {
  const [location, setLocation] = useState<UserLocation | null>(() =>
    loadCached(),
  );
  const [status, setStatus] = useState<Status>(() =>
    loadCached() ? "ready" : "idle",
  );
  const [error, setError] = useState<string | null>(null);

  const detect = () => {
    if (typeof window === "undefined" || !("geolocation" in navigator)) {
      setStatus("error");
      setError("Geolocalização não suportada neste navegador");
      return;
    }
    setStatus("loading");
    setError(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const loc = await reverseGeocode(
            pos.coords.latitude,
            pos.coords.longitude,
          );
          setLocation(loc);
          setStatus("ready");
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(loc));
          } catch {
            // ignore
          }
        } catch (e) {
          setStatus("error");
          setError(e instanceof Error ? e.message : "Erro ao buscar endereço");
        }
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setStatus("denied");
          setError("Permissão de localização negada");
        } else {
          setStatus("error");
          setError(err.message);
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5 * 60 * 1000 },
    );
  };

  // Detecta automaticamente uma vez se ainda não tem cache
  useEffect(() => {
    if (location || status !== "idle") return;
    detect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { location, status, error, detect };
}

export const normalizeText = (s: string | null | undefined) =>
  (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
