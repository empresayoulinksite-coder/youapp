import { useEffect, useRef, useState } from "react";

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

// Distância simples em metros (haversine)
function distMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371000;
  const toRad = (n: number) => (n * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function useLocation() {
  const [location, setLocation] = useState<UserLocation | null>(() =>
    loadCached(),
  );
  const [status, setStatus] = useState<Status>(() =>
    loadCached() ? "ready" : "idle",
  );
  const [error, setError] = useState<string | null>(null);
  const lastGeocodedRef = useRef<{ lat: number; lng: number } | null>(null);
  const watchIdRef = useRef<number | null>(null);

  const handlePosition = async (pos: GeolocationPosition) => {
    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;

    // Atualiza lat/lng imediatamente (tempo real para cálculo de distância)
    setLocation((prev) => {
      const base: UserLocation = prev
        ? { ...prev, lat, lng }
        : {
            lat,
            lng,
            street: null,
            neighborhood: null,
            city: null,
            state: null,
            label: "Localização atual",
          };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(base));
      } catch {
        // ignore
      }
      return base;
    });
    setStatus("ready");

    // Reverse geocode apenas se moveu mais de 100m desde a última vez
    const last = lastGeocodedRef.current;
    if (!last || distMeters(last, { lat, lng }) > 100) {
      lastGeocodedRef.current = { lat, lng };
      try {
        const loc = await reverseGeocode(lat, lng);
        setLocation(loc);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(loc));
        } catch {
          // ignore
        }
      } catch {
        // mantém lat/lng mesmo se geocode falhar
      }
    }
  };

  const startWatch = () => {
    if (typeof window === "undefined" || !("geolocation" in navigator)) {
      setStatus("error");
      setError("Geolocalização não suportada neste navegador");
      return;
    }
    if (watchIdRef.current != null) return;
    setStatus((s) => (s === "ready" ? s : "loading"));
    setError(null);

    // Pega posição inicial rápido
    navigator.geolocation.getCurrentPosition(
      handlePosition,
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setStatus("denied");
          setError("Permissão de localização negada");
        } else {
          setStatus("error");
          setError(err.message);
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );

    // E mantém atualizando em tempo real
    watchIdRef.current = navigator.geolocation.watchPosition(
      handlePosition,
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setStatus("denied");
          setError("Permissão de localização negada");
        }
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 30000 },
    );
  };

  const detect = () => {
    // Reinicia o watcher para forçar nova leitura
    if (watchIdRef.current != null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    lastGeocodedRef.current = null;
    startWatch();
  };

  useEffect(() => {
    startWatch();
    return () => {
      if (watchIdRef.current != null && typeof navigator !== "undefined") {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
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
