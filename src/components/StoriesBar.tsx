import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { StoriesViewer } from "./StoriesViewer";

export interface StoryRow {
  id: string;
  store_id: string | null;
  title: string;
  media_url: string;
  media_type: "image" | "video";
  thumbnail_url: string | null;
  cta_label: string | null;
  position: number;
  store?: { slug: string; name: string; image_url: string | null; emoji: string } | null;
}

/**
 * Seeded pseudo-random shuffle – deterministic per seed so stories stay
 * stable during the same "rotation window" but change across windows.
 */
function seededShuffle<T>(arr: T[], seed: number): T[] {
  const copy = [...arr];
  let s = seed;
  for (let i = copy.length - 1; i > 0; i--) {
    s = (s * 16807 + 0) % 2147483647;
    const j = s % (i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** Rotation seed changes every 30 minutes so all brands get exposure. */
function getRotationSeed() {
  return Math.floor(Date.now() / (30 * 60 * 1000));
}

export function StoriesBar() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const { user } = useAuth();

  const { data: stories = [], isLoading: loading } = useQuery({
    queryKey: ["stories"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("stories")
        .select("id, store_id, title, media_url, media_type, thumbnail_url, cta_label, position, stores(slug, name, image_url, emoji, is_hidden)")
        .order("position", { ascending: true });
      return (data ?? [])
        .filter((r: any) => !r.stores || r.stores.is_hidden !== true)
        .map((r: any) => ({ ...r, store: r.stores ?? null })) as StoryRow[];
    },
  });

  // Fetch interest signals for the logged-in user
  const { data: interestMap } = useQuery({
    queryKey: ["story-interest", user?.id],
    enabled: !!user,
    staleTime: 120_000,
    queryFn: async () => {
      const uid = user!.id;
      const [favRes, cartRes, bookRes] = await Promise.all([
        supabase.from("favorites").select("store_id").eq("user_id", uid),
        supabase.from("cart_items").select("store_id").eq("user_id", uid),
        supabase.from("bookings").select("store_id").eq("user_id", uid),
      ]);

      const scores = new Map<string, number>();
      const add = (sid: string, w: number) => scores.set(sid, (scores.get(sid) ?? 0) + w);

      for (const r of favRes.data ?? []) add(r.store_id, 3);
      for (const r of cartRes.data ?? []) add(r.store_id, 2);
      for (const r of bookRes.data ?? []) add(r.store_id, 2);

      return scores;
    },
  });

  // Sort: personalised scores first, then time-based rotation for fairness
  const sorted = useMemo(() => {
    if (stories.length === 0) return stories;

    const seed = getRotationSeed();
    // First shuffle all stories so every brand gets fair rotation
    const shuffled = seededShuffle(stories, seed);

    if (!interestMap || interestMap.size === 0) return shuffled;

    // Stable sort by interest score (higher first), preserving shuffle order for ties
    return [...shuffled].sort((a, b) => {
      const sa = (a.store_id ? interestMap.get(a.store_id) : 0) ?? 0;
      const sb = (b.store_id ? interestMap.get(b.store_id) : 0) ?? 0;
      return sb - sa;
    });
  }, [stories, interestMap]);

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 pb-3 flex gap-3 overflow-x-auto no-scrollbar">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="shrink-0 flex flex-col items-center gap-1.5">
            <div className="h-16 w-16 rounded-full bg-muted animate-pulse" />
            <div className="h-2.5 w-12 rounded bg-muted animate-pulse" />
          </div>
        ))}
      </div>
    );
  }

  if (sorted.length === 0) return null;

  return (
    <>
      <div className="mx-auto max-w-5xl px-4 pb-3 flex gap-3 overflow-x-auto no-scrollbar">
        {sorted.map((s, idx) => {
          const thumb = s.thumbnail_url || (s.media_type === "image" ? s.media_url : s.store?.image_url) || s.store?.image_url;
          const label = s.store?.name || s.title;
          return (
            <button
              key={s.id}
              onClick={() => setOpenIndex(idx)}
              className="shrink-0 flex flex-col items-center gap-1.5 group"
              aria-label={`Ver story de ${label}`}
            >
              <span
                className="h-16 w-16 rounded-full p-[2.5px] transition-transform group-active:scale-95"
                style={{
                  background: "var(--brand)",
                }}
              >
                <span className="block h-full w-full rounded-full bg-card p-[2px]">
                  <span className="flex h-full w-full items-center justify-center rounded-full bg-muted overflow-hidden text-2xl">
                    {thumb ? (
                      <img
                        src={thumb}
                        alt={label}
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span>{s.store?.emoji ?? "✨"}</span>
                    )}
                  </span>
                </span>
              </span>
              <span className="text-[11px] text-foreground max-w-[68px] truncate">
                {label}
              </span>
            </button>
          );
        })}
      </div>

      {openIndex !== null && (
        <StoriesViewer
          stories={sorted}
          startIndex={openIndex}
          onClose={() => setOpenIndex(null)}
        />
      )}
    </>
  );
}
