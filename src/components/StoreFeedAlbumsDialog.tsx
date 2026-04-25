import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, X, ChevronLeft, ChevronRight, MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { openWhatsapp } from "@/lib/whatsapp";

interface FeedPost {
  id: string;
  caption: string;
  image_urls: string[];
  category_id: string | null;
  created_at: string;
}

interface FeedCategory {
  id: string;
  name: string;
}

type Album = {
  category: FeedCategory;
  coverUrl: string;
  count: number;
};

export function StoreFeedAlbumsDialog({
  open,
  onOpenChange,
  storeId,
  storeName,
  storeWhatsapp,
  initialCategoryId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  storeId: string;
  storeName: string;
  storeWhatsapp: string | null;
  initialCategoryId?: string | null;
}) {
  const [view, setView] = useState<"list" | "album">("list");
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const { data: posts = [] } = useQuery({
    queryKey: ["store-feed-albums", storeId],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_feed_posts")
        .select("id, caption, image_urls, category_id, created_at")
        .eq("store_id", storeId)
        .eq("is_active", true)
        .not("category_id", "is", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as FeedPost[];
    },
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["store-feed-albums-categories", storeId],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_feed_categories")
        .select("id, name")
        .eq("store_id", storeId)
        .order("position", { ascending: true });
      if (error) throw error;
      return (data ?? []) as FeedCategory[];
    },
  });

  const albums: Album[] = useMemo(() => {
    const map = new Map<string, FeedPost[]>();
    for (const p of posts) {
      if (!p.category_id || p.image_urls.length === 0) continue;
      const arr = map.get(p.category_id) ?? [];
      arr.push(p);
      map.set(p.category_id, arr);
    }
    return categories
      .filter((c) => map.has(c.id))
      .map((c) => {
        const ps = map.get(c.id)!;
        const totalImgs = ps.reduce((acc, p) => acc + p.image_urls.length, 0);
        return { category: c, coverUrl: ps[0].image_urls[0], count: totalImgs };
      });
  }, [posts, categories]);

  const activeAlbumImages = useMemo(() => {
    if (!activeCategoryId) return [];
    return posts
      .filter((p) => p.category_id === activeCategoryId)
      .flatMap((p) => p.image_urls);
  }, [posts, activeCategoryId]);

  const activeCategory = categories.find((c) => c.id === activeCategoryId) ?? null;

  // Auto-open the album the user came from
  useEffect(() => {
    if (!open) return;
    if (initialCategoryId && albums.some((a) => a.category.id === initialCategoryId)) {
      setActiveCategoryId(initialCategoryId);
      setView("album");
    } else {
      setView("list");
      setActiveCategoryId(null);
    }
    setLightboxIndex(null);
  }, [open, initialCategoryId, albums]);

  const handleQuote = () => {
    if (!storeWhatsapp) return;
    const albumName = activeCategory?.name ?? "";
    const msg = `Olá! Vim pelo ${storeName} e gostaria de um orçamento${
      albumName ? ` para *${albumName}*` : ""
    }.`;
    openWhatsapp(storeWhatsapp, msg);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 max-w-md w-full h-[90vh] sm:h-[85vh] overflow-hidden flex flex-col gap-0">
        {/* Header */}
        <header className="flex items-center gap-2 px-3 py-3 border-b shrink-0">
          {view === "album" ? (
            <button
              onClick={() => {
                setView("list");
                setActiveCategoryId(null);
              }}
              className="p-1 -ml-1 rounded-full hover:bg-muted"
              aria-label="Voltar"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          ) : (
            <button
              onClick={() => onOpenChange(false)}
              className="p-1 -ml-1 rounded-full hover:bg-muted"
              aria-label="Fechar"
            >
              <X className="h-5 w-5" />
            </button>
          )}
          <h2 className="text-base font-semibold truncate">
            {view === "album" ? activeCategory?.name ?? "Álbum" : "Serviços"}
          </h2>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {view === "list" && (
            <div className="p-3 space-y-2">
              {albums.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-12">
                  Nenhum álbum disponível ainda.
                </p>
              ) : (
                albums.map((a) => (
                  <button
                    key={a.category.id}
                    onClick={() => {
                      setActiveCategoryId(a.category.id);
                      setView("album");
                    }}
                    className="w-full flex items-center gap-3 p-2 rounded-xl border hover:bg-muted/50 active:scale-[0.99] transition"
                  >
                    <img
                      src={a.coverUrl}
                      alt={a.category.name}
                      className="h-16 w-16 rounded-lg object-cover shrink-0"
                    />
                    <div className="flex-1 text-left min-w-0">
                      <p className="font-medium truncate">{a.category.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {a.count} {a.count === 1 ? "foto" : "fotos"}
                      </p>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}

          {view === "album" && (
            <div className="p-1">
              {activeAlbumImages.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-12">
                  Nenhuma foto neste álbum.
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-1">
                  {activeAlbumImages.map((url, i) => (
                    <button
                      key={`${url}-${i}`}
                      onClick={() => setLightboxIndex(i)}
                      className="aspect-square overflow-hidden bg-muted"
                    >
                      <img
                        src={url}
                        alt=""
                        loading="lazy"
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* CTA */}
        {view === "album" && storeWhatsapp && (
          <div className="p-3 border-t shrink-0 bg-background">
            <Button onClick={handleQuote} className="w-full" size="lg">
              <MessageCircle className="h-4 w-4 mr-2" />
              Pedir orçamento
            </Button>
          </div>
        )}

        {/* Lightbox */}
        {lightboxIndex !== null && activeAlbumImages.length > 0 && (
          <Lightbox
            images={activeAlbumImages}
            index={lightboxIndex}
            onClose={() => setLightboxIndex(null)}
            onChange={setLightboxIndex}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function Lightbox({
  images,
  index,
  onClose,
  onChange,
}: {
  images: string[];
  index: number;
  onClose: () => void;
  onChange: (i: number) => void;
}) {
  const total = images.length;
  const go = (delta: number) => {
    const next = (index + delta + total) % total;
    onChange(next);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, total]);

  return (
    <div className="fixed inset-0 z-[60] bg-black flex items-center justify-center">
      <button
        onClick={onClose}
        className="absolute top-3 right-3 z-10 text-white p-2 rounded-full bg-black/40 hover:bg-black/60"
        aria-label="Fechar"
      >
        <X className="h-5 w-5" />
      </button>
      <span className="absolute top-4 left-4 z-10 text-white/90 text-xs bg-black/40 px-2 py-1 rounded-full">
        {index + 1}/{total}
      </span>

      <img
        src={images[index]}
        alt=""
        className="max-h-full max-w-full object-contain select-none"
        draggable={false}
      />

      {total > 1 && (
        <>
          <button
            onClick={() => go(-1)}
            className={cn(
              "absolute left-2 top-1/2 -translate-y-1/2 text-white p-2 rounded-full bg-black/40 hover:bg-black/60",
            )}
            aria-label="Anterior"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button
            onClick={() => go(1)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-white p-2 rounded-full bg-black/40 hover:bg-black/60"
            aria-label="Próxima"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        </>
      )}
    </div>
  );
}
