import { useEffect, useRef, useState } from "react";
import type L from "leaflet";
import "leaflet/dist/leaflet.css";
import { ChevronLeft, Loader2, Crosshair } from "lucide-react";

export type AdjustedLocation = {
  lat: number;
  lng: number;
  street: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  cep: string | null;
  label: string;
};

async function reverseGeocode(lat: number, lng: number): Promise<AdjustedLocation> {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=pt-BR`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  const data = await res.json();
  const a = data.address ?? {};
  const street: string | null = a.road ?? a.pedestrian ?? null;
  const neighborhood: string | null =
    a.suburb ?? a.neighbourhood ?? a.quarter ?? a.city_district ?? null;
  const city: string | null =
    a.city ?? a.town ?? a.village ?? a.municipality ?? null;
  const state: string | null = a.state ?? null;
  const cep: string | null = (a.postcode as string | undefined) ?? null;
  const label =
    [street, neighborhood].filter(Boolean).join(", ") || city || "Localização";
  return { lat, lng, street, neighborhood, city, state, cep, label };
}

export function LocationAdjuster({
  initialLat,
  initialLng,
  onCancel,
  onConfirm,
}: {
  initialLat: number;
  initialLng: number;
  onCancel: () => void;
  onConfirm: (loc: AdjustedLocation) => void;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const userAccuracyRef = useRef<L.Circle | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const leafletRef = useRef<typeof L | null>(null);
  const [current, setCurrent] = useState<AdjustedLocation | null>(null);
  const [resolving, setResolving] = useState(false);

  const renderUserPosition = (lat: number, lng: number, accuracy?: number) => {
    const map = mapInstance.current;
    const Leaflet = leafletRef.current;
    if (!map || !Leaflet) return;
    const userIcon = Leaflet.divIcon({
      className: "user-location-dot",
      html: `<div class="ulb-pulse"></div><div class="ulb-dot"></div>`,
      iconSize: [22, 22],
      iconAnchor: [11, 11],
    });
    if (!userMarkerRef.current) {
      userMarkerRef.current = Leaflet.marker([lat, lng], {
        icon: userIcon,
        interactive: false,
        keyboard: false,
        zIndexOffset: 1000,
      }).addTo(map);
    } else {
      userMarkerRef.current.setLatLng([lat, lng]);
    }
    if (accuracy && accuracy > 0) {
      if (!userAccuracyRef.current) {
        userAccuracyRef.current = Leaflet.circle([lat, lng], {
          radius: accuracy,
          color: "#1a73e8",
          fillColor: "#1a73e8",
          fillOpacity: 0.15,
          weight: 1,
          opacity: 0.4,
          interactive: false,
        }).addTo(map);
      } else {
        userAccuracyRef.current.setLatLng([lat, lng]);
        userAccuracyRef.current.setRadius(accuracy);
      }
    }
  };

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;
    let cancelled = false;
    let map: L.Map | null = null;

    void import("leaflet").then(({ default: Leaflet }) => {
      if (cancelled || !mapRef.current || mapInstance.current) return;

      const DefaultIcon = Leaflet.icon({
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41],
      });
      Leaflet.Marker.prototype.options.icon = DefaultIcon;
      leafletRef.current = Leaflet;

      map = Leaflet.map(mapRef.current, {
      zoomControl: false,
      attributionControl: false,
    }).setView([initialLat, initialLng], 17);
      Leaflet.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
    }).addTo(map);
      Leaflet.control.zoom({ position: "bottomright" }).addTo(map);

      mapInstance.current = map;

    const handleMove = () => {
      const c = map.getCenter();
      setResolving(true);
      reverseGeocode(c.lat, c.lng)
        .then((loc) => setCurrent(loc))
        .catch(() => {
          setCurrent({
            lat: c.lat,
            lng: c.lng,
            street: null,
            neighborhood: null,
            city: null,
            state: null,
            cep: null,
            label: "Localização ajustada",
          });
        })
        .finally(() => setResolving(false));
    };

      handleMove();
      map.on("moveend", handleMove);

    // Bolinha azul de posição real (estilo Google Maps)
      renderUserPosition(initialLat, initialLng);
      if ("geolocation" in navigator) {
        watchIdRef.current = navigator.geolocation.watchPosition(
          (pos) => {
            renderUserPosition(
              pos.coords.latitude,
              pos.coords.longitude,
              pos.coords.accuracy,
            );
          },
          undefined,
          { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
        );
      }
    });

    return () => {
      cancelled = true;
      if (watchIdRef.current !== null && "geolocation" in navigator) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      userMarkerRef.current = null;
      userAccuracyRef.current = null;
      map?.remove();
      mapInstance.current = null;
      leafletRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const recenter = () => {
    if (!mapInstance.current) return;
    if (!("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        mapInstance.current?.setView(
          [pos.coords.latitude, pos.coords.longitude],
          17,
        );
        renderUserPosition(
          pos.coords.latitude,
          pos.coords.longitude,
          pos.coords.accuracy,
        );
      },
      undefined,
      { enableHighAccuracy: true },
    );
  };

  return (
    <div className="flex flex-col h-[85vh]">
      <header className="px-5 py-4 flex items-center justify-center relative border-b border-border bg-background z-[1000]">
        <button
          onClick={onCancel}
          className="absolute left-4 p-1 text-brand"
          aria-label="Voltar"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
        <h2 className="font-bold tracking-wider text-sm">ENDEREÇO</h2>
      </header>

      <div className="relative flex-1 min-h-0">
        <div ref={mapRef} className="absolute inset-0" />

        {/* Pin central fixo */}
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-[500] -translate-x-1/2 -translate-y-full">
          <div className="flex flex-col items-center">
            <div className="bg-background rounded-2xl shadow-lg px-4 py-2 mb-2 text-center">
              <p className="text-sm font-bold">Você está aqui?</p>
              <p className="text-xs text-muted-foreground">Ajuste a localização</p>
            </div>
            <svg width="32" height="40" viewBox="0 0 32 40" className="drop-shadow-lg">
              <path
                d="M16 0C7.2 0 0 7.2 0 16c0 11 16 24 16 24s16-13 16-24C32 7.2 24.8 0 16 0z"
                fill="hsl(var(--brand))"
              />
              <circle cx="16" cy="16" r="6" fill="white" />
            </svg>
          </div>
        </div>

        <button
          onClick={recenter}
          className="absolute bottom-24 right-4 z-[600] h-11 w-11 rounded-full bg-background shadow-lg flex items-center justify-center"
          aria-label="Minha localização"
        >
          <Crosshair className="h-5 w-5 text-brand" />
        </button>
      </div>

      <div className="p-4 border-t border-border bg-background">
        {current && (
          <div className="mb-3 px-1">
            <p className="text-sm font-semibold truncate">
              {current.street ?? current.label}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {[current.neighborhood, current.city, current.state]
                .filter(Boolean)
                .join(", ") || "Mova o mapa para ajustar"}
            </p>
          </div>
        )}
        <button
          disabled={!current || resolving}
          onClick={() => current && onConfirm(current)}
          className="w-full bg-brand text-brand-foreground font-bold py-4 rounded-2xl disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {resolving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
            </>
          ) : (
            "Confirmar localização"
          )}
        </button>
      </div>
    </div>
  );
}
