import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
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
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const startRef = useRef<number>(Date.now());
  const accumRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);
  const dragStartRef = useRef<{ x: number; y: number; t: number } | null>(null);
  const dragLockRef = useRef<"h" | "v" | null>(null);
  const longPressTimerRef = useRef<number | null>(null);

  const current = stories[index];

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

  // Video handlers
  useEffect(() => {
    const v = videoRef.current;
    if (!v || current?.media_type !== "video") return;
    if (paused) v.pause();
    else v.play().catch(() => {});
  }, [paused, index, current?.media_type]);

  const next = () => {
    if (index < stories.length - 1) setIndex(index + 1);
    else onClose();
  };
  const prev = () => {
    if (index > 0) setIndex(index - 1);
  };

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
        <button
          onClick={onClose}
          aria-label="Fechar"
          className="text-white p-1.5 rounded-full hover:bg-white/10"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Media */}
      <div
        className="relative h-full w-full max-w-md mx-auto flex items-center justify-center overflow-hidden touch-pan-y"
        onPointerDown={(e) => {
          dragStartRef.current = { x: e.clientX, y: e.clientY, t: Date.now() };
          dragLockRef.current = null;
          setDragX(0);
          setDragging(true);
          // Long press pausa (igual Instagram)
          if (longPressTimerRef.current) window.clearTimeout(longPressTimerRef.current);
          longPressTimerRef.current = window.setTimeout(() => {
            if (dragLockRef.current !== "h") setPaused(true);
          }, 200);
        }}
        onPointerMove={(e) => {
          const s = dragStartRef.current;
          if (!s) return;
          const dx = e.clientX - s.x;
          const dy = e.clientY - s.y;
          if (!dragLockRef.current) {
            if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
              dragLockRef.current = Math.abs(dx) > Math.abs(dy) ? "h" : "v";
              if (dragLockRef.current === "h" && longPressTimerRef.current) {
                window.clearTimeout(longPressTimerRef.current);
                longPressTimerRef.current = null;
              }
            }
          }
          if (dragLockRef.current === "h") {
            // Resistência nas pontas
            let nx = dx;
            if ((index === 0 && dx > 0) || (index === stories.length - 1 && dx < 0)) {
              nx = dx / 3;
            }
            setDragX(nx);
          }
        }}
        onPointerUp={(e) => {
          if (longPressTimerRef.current) {
            window.clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
          }
          setPaused(false);
          const s = dragStartRef.current;
          dragStartRef.current = null;
          setDragging(false);
          if (dragLockRef.current === "h" && s) {
            const dx = e.clientX - s.x;
            const dt = Date.now() - s.t;
            const velocity = Math.abs(dx) / Math.max(1, dt); // px/ms
            const width = (e.currentTarget as HTMLElement).clientWidth;
            const threshold = width * 0.2;
            if (dx <= -threshold || (dx < 0 && velocity > 0.5)) {
              setDragX(0);
              next();
            } else if (dx >= threshold || (dx > 0 && velocity > 0.5)) {
              setDragX(0);
              prev();
            } else {
              setDragX(0);
            }
          } else {
            setDragX(0);
          }
          dragLockRef.current = null;
        }}
        onPointerCancel={() => {
          if (longPressTimerRef.current) {
            window.clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
          }
          setPaused(false);
          setDragging(false);
          setDragX(0);
          dragStartRef.current = null;
          dragLockRef.current = null;
        }}
      >
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{
            transform: `translateX(${dragX}px)`,
            transition: dragging ? "none" : "transform 200ms ease-out",
          }}
        >
          {current.media_type === "video" ? (
            <video
              ref={videoRef}
              key={current.id}
              src={current.media_url}
              autoPlay
              playsInline
              onEnded={next}
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

        {/* Tap zones (não interferem com pointer events do pai) */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            prev();
          }}
          aria-label="Anterior"
          className="absolute left-0 top-0 h-full w-1/3 z-10"
          style={{ pointerEvents: dragging ? "none" : "auto" }}
        />
        <button
          onClick={(e) => {
            e.stopPropagation();
            next();
          }}
          aria-label="Próximo"
          className="absolute right-0 top-0 h-full w-1/3 z-10"
          style={{ pointerEvents: dragging ? "none" : "auto" }}
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
