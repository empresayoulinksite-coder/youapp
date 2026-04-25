import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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

export function StoriesBar() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

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

  if (stories.length === 0) return null;

  return (
    <>
      <div className="mx-auto max-w-5xl px-4 pb-3 flex gap-3 overflow-x-auto no-scrollbar">
        {stories.map((s, idx) => {
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
          stories={stories}
          startIndex={openIndex}
          onClose={() => setOpenIndex(null)}
        />
      )}
    </>
  );
}
