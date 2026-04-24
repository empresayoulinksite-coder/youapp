import { useEffect, useRef } from "react";
import { X } from "lucide-react";

export interface Reel {
  id: string;
  title: string;
  video_url: string;
  thumbnail_url: string | null;
  cta_label: string | null;
  cta_url: string | null;
  position: number;
}

export function ReelPlayerDialog({ reel, onClose }: { reel: Reel; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const v = videoRef.current;
    if (v) v.play().catch(() => {});
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const ctaUrl = reel.cta_url?.trim();
  const ctaLabel = reel.cta_label?.trim();

  return (
    <div className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4" onClick={onClose}>
      <button
        onClick={onClose}
        className="absolute top-4 right-4 h-10 w-10 rounded-full bg-white/10 backdrop-blur flex items-center justify-center text-white"
        aria-label="Fechar"
      >
        <X className="h-5 w-5" />
      </button>
      <div
        className="relative w-full max-w-sm aspect-[9/16] rounded-2xl overflow-hidden bg-black"
        onClick={(e) => e.stopPropagation()}
      >
        <video
          ref={videoRef}
          src={reel.video_url}
          poster={reel.thumbnail_url ?? undefined}
          controls
          playsInline
          className="absolute inset-0 h-full w-full object-contain bg-black"
        />
        {(reel.title || (ctaLabel && ctaUrl)) && (
          <div className="absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-black/80 to-transparent space-y-3">
            {reel.title && (
              <p className="text-white font-semibold text-sm drop-shadow line-clamp-2">{reel.title}</p>
            )}
            {ctaLabel && ctaUrl && (
              <a
                href={ctaUrl}
                target={ctaUrl.startsWith("http") ? "_blank" : undefined}
                rel="noopener noreferrer"
                className="block text-center bg-brand text-brand-foreground font-bold text-sm py-3 rounded-full"
              >
                {ctaLabel}
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
