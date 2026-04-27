import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { X, ChevronLeft, ChevronRight, Volume2, VolumeX } from "lucide-react";
import type { StoryRow } from "./StoriesBar";

interface Props {
  stories: StoryRow[];
  startIndex: number;
  onClose: () => void;
}

const IMAGE_DURATION_MS = 5000;

export function StoriesViewer({ stories, startIndex, onClose }: Props) {
  const [index, setIndex] = useState(startIndex);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const startRef = useRef<number>(Date.now());
  const accumRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);
  const indexRef = useRef(startIndex);
  const pausedRef = useRef(false);
  const resumeRafRef = useRef<number | null>(null);

  const current = stories[index];

  const setStoryPaused = useCallback((value: boolean) => {
    pausedRef.current = value;
    setPaused(value);
  }, []);

  const resumeCurrentVideo = useCallback(() => {
    const video = videoRef.current;
    if (!video || current?.media_type !== "video") return;

    const tryPlay = () => {
      video.muted = false;
      video.volume = 1;
      setMuted(false);
      video.play().catch(() => {
        // Mantém o som ativo; a próxima interação do usuário tenta o play novamente.
      });
    };
    tryPlay();
    if (resumeRafRef.current) cancelAnimationFrame(resumeRafRef.current);
    resumeRafRef.current = requestAnimationFrame(() => {
      resumeRafRef.current = null;
      tryPlay();
    });
  }, [current?.media_type]);

  useEffect(() => {
    indexRef.current = index;
  }, [index]);

  // Lock body scroll
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Reset on index change
  useEffect(() => {
    setProgress(0);
    accumRef.current = 0;
    startRef.current = Date.now();
    // Garante som ativo ao trocar de story
    setMuted(false);
    const v = videoRef.current;
    if (v) {
      v.muted = false;
      v.volume = 1;
      v.play().catch(() => {
        setMuted(false);
      });
    }
  }, [index]);

  // Progress loop (image stories use timer; video uses native time)
  useEffect(() => {
    if (!current || current.media_type === "video") return;
    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      if (!paused) {
        const elapsed = accumRef.current + (Date.now() - startRef.current);
        const p = Math.min(1, elapsed / IMAGE_DURATION_MS);
        setProgress(p);
        if (p >= 1) {
          next();
          return;
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, paused, current?.media_type]);

  // Pause/resume timing accounting
  useEffect(() => {
    if (paused) {
      accumRef.current += Date.now() - startRef.current;
    } else {
      startRef.current = Date.now();
    }
  }, [paused]);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    return () => {
      if (resumeRafRef.current) cancelAnimationFrame(resumeRafRef.current);
    };
  }, []);

  // Video handlers
  useEffect(() => {
    const v = videoRef.current;
    if (!v || current?.media_type !== "video") return;
    if (pausedRef.current) v.pause();
    else resumeCurrentVideo();
  }, [paused, index, current?.media_type, resumeCurrentVideo]);

  const next = useCallback(() => {
    const currentIndex = indexRef.current;
    if (currentIndex < stories.length - 1) {
      const nextIndex = currentIndex + 1;
      indexRef.current = nextIndex;
      setIndex(nextIndex);
    }
    else onClose();
  }, [onClose, stories.length]);
  const prev = useCallback(() => {
    const currentIndex = indexRef.current;
    if (currentIndex > 0) {
      const prevIndex = currentIndex - 1;
      indexRef.current = prevIndex;
      setIndex(prevIndex);
    }
  }, []);

  // Keyboard nav
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  if (!current) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black flex items-center justify-center select-none">
      {/* Progress bars */}
      <div className="absolute top-0 inset-x-0 z-20 flex gap-1 px-2 pt-2">
        {stories.map((_, i) => (
          <div key={i} className="h-0.5 flex-1 bg-white/30 rounded overflow-hidden">
            <div
              className="h-full bg-white transition-[width] duration-100 ease-linear"
              style={{
                width:
                  i < index
                    ? "100%"
                    : i === index
                      ? `${progress * 100}%`
                      : "0%",
              }}
            />
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="absolute top-3 inset-x-0 z-20 flex items-center justify-between px-3 pt-2">
        <div className="flex items-center gap-2 min-w-0">
          {current.store?.image_url ? (
            <img
              src={current.store.image_url}
              alt=""
              className="h-8 w-8 rounded-full object-cover border border-white/40"
            />
          ) : (
            <span className="h-8 w-8 rounded-full bg-white/15 flex items-center justify-center text-base">
              {current.store?.emoji ?? "✨"}
            </span>
          )}
          <span className="text-white text-sm font-semibold truncate max-w-[55vw]">
            {current.store?.name ?? current.title}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setMuted((m) => {
                const next = !m;
                const v = videoRef.current;
                if (v) {
                  v.muted = next;
                  if (!next) v.play().catch(() => {});
                }
                return next;
              });
            }}
            aria-label={muted ? "Ativar som" : "Silenciar"}
            className="text-white p-1.5 rounded-full hover:bg-white/10"
          >
            {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
          </button>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="text-white p-1.5 rounded-full hover:bg-white/10"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Media */}
      <div
        ref={containerRef}
        className="relative h-full w-full overflow-hidden"
      >
        <div
          className="absolute inset-0 flex items-center justify-center bg-black"
          onPointerDown={() => setStoryPaused(true)}
          onPointerUp={() => setStoryPaused(false)}
          onPointerLeave={() => setStoryPaused(false)}
          onPointerCancel={() => setStoryPaused(false)}
        >
          {current.media_type === "video" ? (
            <video
              ref={videoRef}
              key={current.id}
              src={current.media_url}
              autoPlay
              muted={muted}
              playsInline
              preload="auto"
              onEnded={next}
              onLoadedData={resumeCurrentVideo}
              onCanPlay={resumeCurrentVideo}
              onTimeUpdate={(e) => {
                const v = e.currentTarget;
                if (v.duration) setProgress(v.currentTime / v.duration);
              }}
              className="max-h-full max-w-full object-contain"
            />
          ) : (
            <img
              src={current.media_url}
              alt={current.title}
              className="max-h-full max-w-full object-contain"
              draggable={false}
            />
          )}
        </div>

        {/* Tap zones */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            prev();
          }}
          aria-label="Anterior"
          className="absolute left-0 top-0 h-full w-1/3 z-10"
        />
        <button
          onClick={(e) => {
            e.stopPropagation();
            next();
          }}
          aria-label="Próximo"
          className="absolute right-0 top-0 h-full w-1/3 z-10"
        />

        {/* Desktop arrows */}
        <button
          onClick={prev}
          aria-label="Anterior"
          className="hidden sm:flex absolute -left-12 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-white/10 text-white items-center justify-center hover:bg-white/20"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <button
          onClick={next}
          aria-label="Próximo"
          className="hidden sm:flex absolute -right-12 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-white/10 text-white items-center justify-center hover:bg-white/20"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* CTA */}
      {current.store?.slug && (
        <div
          className="absolute inset-x-0 z-30 flex justify-center px-4 pointer-events-none"
          style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 96px)" }}
        >
          <Link
            to="/loja/$slug"
            params={{ slug: current.store.slug }}
            onClick={onClose}
            className="pointer-events-auto font-bold text-sm px-6 py-3 rounded-full shadow-2xl active:scale-95 transition-transform flex items-center gap-2"
            style={{ background: "var(--brand)", color: "var(--brand-foreground)" }}
          >
            {current.cta_label ?? "Ver loja"}
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      )}
    </div>
  );
}
