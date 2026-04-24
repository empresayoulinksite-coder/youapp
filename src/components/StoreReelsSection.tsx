import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Play } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ReelPlayerDialog, type Reel } from "./ReelPlayerDialog";

export function StoreReelsSection({ storeId }: { storeId: string }) {
  const [openReel, setOpenReel] = useState<Reel | null>(null);

  const { data: reels = [] } = useQuery({
    queryKey: ["store-reels", storeId],
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("store_reels")
        .select("id, title, video_url, thumbnail_url, cta_label, cta_url, position")
        .eq("store_id", storeId)
        .eq("is_active", true)
        .order("position", { ascending: true });
      return (data ?? []) as Reel[];
    },
  });

  if (reels.length === 0) return null;

  return (
    <section className="space-y-2">
      <h3 className="font-bold text-base px-1">Reels sugeridos</h3>
      <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 pb-1">
        {reels.map((r) => (
          <button
            key={r.id}
            onClick={() => setOpenReel(r)}
            className="shrink-0 relative w-40 aspect-[9/16] rounded-2xl overflow-hidden bg-muted shadow-[var(--shadow-card)] active:scale-[.98] transition-transform"
            aria-label={`Abrir reel ${r.title || ""}`}
          >
            {r.thumbnail_url ? (
              <img src={r.thumbnail_url} alt={r.title} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
            ) : (
              <video src={r.video_url} muted preload="metadata" className="absolute inset-0 h-full w-full object-cover" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/0 to-black/0" />
            <div className="absolute top-2 right-2 h-7 w-7 rounded-full bg-black/40 backdrop-blur flex items-center justify-center">
              <Play className="h-3.5 w-3.5 text-white fill-white" />
            </div>
            {r.title && (
              <p className="absolute bottom-2 left-2 right-2 text-[11px] font-semibold text-white line-clamp-2 text-left drop-shadow">
                {r.title}
              </p>
            )}
          </button>
        ))}
      </div>

      {openReel && (
        <ReelPlayerDialog reel={openReel} onClose={() => setOpenReel(null)} />
      )}
    </section>
  );
}
