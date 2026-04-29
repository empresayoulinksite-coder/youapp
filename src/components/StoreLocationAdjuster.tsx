import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { ChevronLeft, Crosshair, Loader2, Search } from "lucide-react";

const DefaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

export type StoreLocation = { lat: number; lng: number };

export function StoreLocationAdjuster({
  initialLat,
  initialLng,
  fallbackQuery,
  onCancel,
  onConfirm,
}: {
  initialLat: number | null | undefined;
  initialLng: number | null | undefined;
  /** Endereço usado como ponto inicial caso lat/lng não existam. */
  fallbackQuery?: string;
  onCancel: () => void;
  onConfirm: (loc: StoreLocation) => void;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const [center, setCenter] = useState<StoreLocation | null>(
    initialLat != null && initialLng != null
      ? { lat: initialLat, lng: initialLng }
      : null,
  );
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;

    const start: [number, number] =
      initialLat != null && initialLng != null
        ? [initialLat, initialLng]
        : [-23.55, -46.633]; // SP fallback

    const map = L.map(mapRef.current, {
      zoomControl: false,
      attributionControl: false,
    }).setView(start, 18);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
    }).addTo(map);
    L.control.zoom({ position: "bottomright" }).addTo(map);

    mapInstance.current = map;

    const updateCenter = () => {
      const c = map.getCenter();
      setCenter({ lat: c.lat, lng: c.lng });
    };
    updateCenter();
    map.on("moveend", updateCenter);

    // Se não tem coordenadas iniciais, tenta geocodificar o endereço
    if ((initialLat == null || initialLng == null) && fallbackQuery) {
      setSearching(true);
      fetch(
        `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&accept-language=pt-BR&q=${encodeURIComponent(
          fallbackQuery,
        )}`,
        { headers: { Accept: "application/json" } },
      )
        .then((r) => r.json())
        .then((data: Array<{ lat: string; lon: string }>) => {
          if (data?.[0]) {
            const lat = Number(data[0].lat);
            const lng = Number(data[0].lon);
            map.setView([lat, lng], 18);
          }
        })
        .catch(() => {})
        .finally(() => setSearching(false));
    }

    return () => {
      map.off("moveend", updateCenter);
      map.remove();
      mapInstance.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const recenter = () => {
    if (!mapInstance.current || !("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        mapInstance.current?.setView(
          [pos.coords.latitude, pos.coords.longitude],
          18,
        );
      },
      undefined,
      { enableHighAccuracy: true },
    );
  };

  const searchAgain = async () => {
    if (!fallbackQuery || !mapInstance.current) return;
    setSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&accept-language=pt-BR&q=${encodeURIComponent(
          fallbackQuery,
        )}`,
        { headers: { Accept: "application/json" } },
      );
      const data = (await res.json()) as Array<{ lat: string; lon: string }>;
      if (data?.[0]) {
        mapInstance.current.setView(
          [Number(data[0].lat), Number(data[0].lon)],
          18,
        );
      }
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="flex flex-col h-[80vh]">
      <header className="px-5 py-3 flex items-center justify-center relative border-b border-border bg-background z-[1000]">
        <button
          onClick={onCancel}
          className="absolute left-4 p-1 text-primary"
          aria-label="Voltar"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
        <h2 className="font-bold tracking-wider text-sm">AJUSTAR LOCALIZAÇÃO DA LOJA</h2>
      </header>

      <div className="relative flex-1 min-h-0">
        <div ref={mapRef} className="absolute inset-0" />

        {/* Pin central fixo */}
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-[500] -translate-x-1/2 -translate-y-full">
          <div className="flex flex-col items-center">
            <div className="bg-background rounded-2xl shadow-lg px-4 py-2 mb-2 text-center">
              <p className="text-sm font-bold">Posição da loja</p>
              <p className="text-xs text-muted-foreground">Mova o mapa para ajustar</p>
            </div>
            <svg width="32" height="40" viewBox="0 0 32 40" className="drop-shadow-lg">
              <path
                d="M16 0C7.2 0 0 7.2 0 16c0 11 16 24 16 24s16-13 16-24C32 7.2 24.8 0 16 0z"
                fill="hsl(var(--primary))"
              />
              <circle cx="16" cy="16" r="6" fill="white" />
            </svg>
          </div>
        </div>

        {fallbackQuery && (
          <button
            onClick={searchAgain}
            disabled={searching}
            className="absolute top-3 left-3 z-[600] h-10 px-3 rounded-full bg-background shadow-lg flex items-center gap-1.5 text-xs font-medium"
          >
            {searching ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Search className="h-3.5 w-3.5 text-primary" />
            )}
            Buscar pelo endereço
          </button>
        )}

        <button
          onClick={recenter}
          className="absolute bottom-24 right-4 z-[600] h-11 w-11 rounded-full bg-background shadow-lg flex items-center justify-center"
          aria-label="Minha localização"
        >
          <Crosshair className="h-5 w-5 text-primary" />
        </button>
      </div>

      <div className="p-4 border-t border-border bg-background">
        {center && (
          <p className="text-xs text-muted-foreground mb-3 text-center">
            📍 {center.lat.toFixed(6)}, {center.lng.toFixed(6)}
          </p>
        )}
        <button
          disabled={!center}
          onClick={() => center && onConfirm(center)}
          className="w-full bg-primary text-primary-foreground font-bold py-3.5 rounded-xl disabled:opacity-60"
        >
          Confirmar localização
        </button>
      </div>
    </div>
  );
}
