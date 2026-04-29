import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Volume2, VolumeX } from "lucide-react";

export interface Reel {
  id: string;
  title: string;
  video_url: string;
  thumbnail_url: string | null;
  cta_label: string | null;
  cta_url: string | null;
  position: number;
}

export function ReelPlayerDialog({
  reel,
  reels,
  onClose,
}: {
  reel: Reel;
  reels?: Reel[];
  onClose: () => void;
}) {
  const list = reels && reels.length > 0 ? reels : [reel];
  const startIndex = Math.max(
    0,
    list.findIndex((r) => r.id === reel.id),
  );
  const [activeIndex, setActiveIndex] = useState(startIndex);
  const [muted, setMuted] = useState(true);
  const [progress, setProgress] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRefs = useRef<Array<HTMLVideoElement | null>>([]);

  // Lock body scroll + ESC to close
  useEffect(() => {
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

  // Scroll the starting reel into view on mount
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const child = el.children[startIndex] as HTMLElement | undefined;
    if (child) el.scrollTo({ left: child.offsetLeft, behavior: "auto" });
  }, [startIndex]);

  // Detect which reel is currently in view via IntersectionObserver
  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          const idx = Number((e.target as HTMLElement).dataset.idx);
          if (e.isIntersecting && e.intersectionRatio >= 0.6) {
            setActiveIndex(idx);
          }
        });
      },
      { root, threshold: [0.6] },
    );
    Array.from(root.children).forEach((child) => io.observe(child));
    return () => io.disconnect();
  }, [list.length]);

  // Play active video, pause others. Always start muted to bypass autoplay restrictions,
  // then try to unmute right after — keeps video visible even when audio is blocked.
  useEffect(() => {
    setProgress(0);
    videoRefs.current.forEach((v, i) => {
      if (!v) return;
      if (i === activeIndex) {
        v.muted = true;
        Promise.resolve(v.play())
          .then(() => {
            if (!muted) {
              v.muted = false;
              v.play().catch(() => {
                v.muted = true;
                setMuted(true);
              });
            }
          })
          .catch(() => {});
      } else {
        v.pause();
        v.currentTime = 0;
      }
    });
  }, [activeIndex, muted]);

  // Track progress of active video and auto-advance on end
  useEffect(() => {
    const v = videoRefs.current[activeIndex];
    if (!v) return;
    const onTime = () => {
      if (v.duration > 0) setProgress(v.currentTime / v.duration);
    };
    const goNext = () => {
      setProgress(1);
      const nextIdx = activeIndex + 1;
      if (nextIdx < list.length) {
        const root = containerRef.current;
        const child = root?.children[nextIdx] as HTMLElement | undefined;
        if (root && child) {
          root.scrollTo({ left: child.offsetLeft, behavior: "smooth" });
        } else {
          setActiveIndex(nextIdx);
        }
      } else {
        // Last video: loop it
        v.currentTime = 0;
        v.play().catch(() => {});
      }
    };
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("ended", goNext);
    return () => {
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("ended", goNext);
    };
  }, [activeIndex, list.length]);

  return (
    <div className="fixed inset-0 z-[60] bg-black flex items-center justify-center">
      {/* Progress bars (Instagram-style) */}
      <div className="absolute top-2 inset-x-0 z-20 px-3 flex gap-1 max-w-md mx-auto">
        {list.map((_, i) => {
          const fill = i < activeIndex ? 1 : i === activeIndex ? progress : 0;
          return (
            <div key={i} className="h-0.5 flex-1 rounded-full bg-white/30 overflow-hidden">
              <div
                className="h-full bg-white"
                style={{
                  width: `${Math.min(100, Math.max(0, fill * 100))}%`,
                  transition: i === activeIndex ? "width 120ms linear" : "none",
                }}
              />
            </div>
          );
        })}
      </div>

      <button
        onClick={onClose}
        className="absolute top-6 left-4 z-20 h-10 w-10 rounded-full bg-white/10 backdrop-blur flex items-center justify-center text-white"
        aria-label="Fechar"
      >
        <X className="h-5 w-5" />
      </button>
      <button
        onClick={() => setMuted((m) => !m)}
        className="absolute top-6 right-4 z-20 h-10 w-10 rounded-full bg-white/10 backdrop-blur flex items-center justify-center text-white"
        aria-label={muted ? "Ativar som" : "Silenciar"}
      >
        {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
      </button>

      <div
        ref={containerRef}
        className="h-full w-full max-w-md mx-auto overflow-x-auto overflow-y-hidden flex snap-x snap-mandatory no-scrollbar bg-black"
      >
        {list.map((r, i) => {
          const ctaUrl = r.cta_url?.trim();
          const ctaLabel = r.cta_label?.trim();
          return (
            <div
              key={r.id}
              data-idx={i}
              className="relative h-full w-full shrink-0 snap-start snap-always flex items-center justify-center"
              onClick={() => {
                const v = videoRefs.current[i];
                if (!v) return;
                if (v.paused) v.play().catch(() => {});
                else v.pause();
              }}
            >
              <video
                ref={(el) => {
                  videoRefs.current[i] = el;
                }}
                src={r.video_url}
                poster={r.thumbnail_url ?? undefined}
                playsInline
                loop={activeIndex === list.length - 1}
                muted={muted}
                preload={Math.abs(i - activeIndex) <= 1 ? "auto" : "none"}
                className="absolute inset-0 h-full w-full object-contain bg-black"
              />
              {(r.title || (ctaLabel && ctaUrl)) && (
                <div
                  className="absolute bottom-0 inset-x-0 p-4 pb-6 bg-gradient-to-t from-black/80 to-transparent space-y-3"
                  onClick={(e) => e.stopPropagation()}
                >
                  {r.title && (
                    <p className="text-white font-semibold text-sm drop-shadow line-clamp-2">
                      {r.title}
                    </p>
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
          );
        })}
      </div>
    </div>
  );
}
