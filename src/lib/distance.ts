import { useMemo } from "react";
import { useAddress } from "@/contexts/AddressContext";

export type LatLng = { lat: number; lng: number };

/** Distância em km entre dois pontos pela fórmula de Haversine. */
export function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371; // raio da Terra em km
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

/** "1,2 km" ou "350 m". */
export function formatDistance(km: number): string {
  if (!isFinite(km) || km < 0) return "";
  if (km < 1) {
    const meters = Math.round(km * 1000 / 10) * 10;
    return `${meters} m`;
  }
  return `${km.toFixed(1).replace(".", ",")} km`;
}

/** Geocodifica endereço via Nominatim (OpenStreetMap). Retorna null se falhar. */
export async function geocodeAddress(
  parts: {
    address?: string | null;
    neighborhood?: string | null;
    city?: string | null;
    cep?: string | null;
  },
): Promise<LatLng | null> {
  const query = [parts.address, parts.neighborhood, parts.city, parts.cep, "Brasil"]
    .filter(Boolean)
    .join(", ");
  if (!query.trim()) return null;
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&accept-language=pt-BR&q=${encodeURIComponent(query)}`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    const data = (await res.json()) as Array<{ lat: string; lon: string }>;
    if (!data.length) return null;
    return { lat: Number(data[0].lat), lng: Number(data[0].lon) };
  } catch {
    return null;
  }
}

/** Coordenadas do endereço/local ativo do usuário, se disponíveis. */
export function useUserCoords(): LatLng | null {
  const { active, gpsLocation, addresses } = useAddress();
  return useMemo(() => {
    if (gpsLocation) return { lat: gpsLocation.lat, lng: gpsLocation.lng };
    if (active?.source === "saved" && active.id) {
      const saved = addresses.find((a) => a.id === active.id);
      if (saved?.lat != null && saved?.lng != null) {
        return { lat: saved.lat, lng: saved.lng };
      }
    }
    return null;
  }, [active, gpsLocation, addresses]);
}

/** Calcula a distância dinâmica até a loja, ou retorna o fallback. */
export function useStoreDistance(
  store: { lat?: number | null; lng?: number | null; distance?: string | null },
): string {
  const coords = useUserCoords();
  return useMemo(() => {
    if (coords && store.lat != null && store.lng != null) {
      return formatDistance(haversineKm(coords, { lat: store.lat, lng: store.lng }));
    }
    return store.distance || "";
  }, [coords, store.lat, store.lng, store.distance]);
}
