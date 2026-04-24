import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Heart, Bookmark, Share2, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

interface FeedPost {
  id: string;
  store_id: string;
  caption: string;
  image_urls: string[];
  is_active: boolean;
  likes_count: number;
  created_at: string;
}

export function StoreFeedSection({
  storeId,
  storeName,
  storeSlug,
}: {
  storeId: string;
  storeName: string;
  storeSlug: string;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: posts = [] } = useQuery({
    queryKey: ["store-feed", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_feed_posts")
        .select("*")
        .eq("store_id", storeId)
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as FeedPost[];
    },
  });

  const { data: likedIds = [] } = useQuery({
    queryKey: ["store-feed-likes", storeId, user?.id],
    enabled: !!user && posts.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_feed_likes")
        .select("post_id")
        .eq("user_id", user!.id)
        .in("post_id", posts.map((p) => p.id));
      if (error) throw error;
      return (data ?? []).map((r: any) => r.post_id as string);
    },
  });

  const { data: favoriteIds = [] } = useQuery({
    queryKey: ["store-feed-favorites", storeId, user?.id],
    enabled: !!user && posts.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_feed_favorites")
        .select("post_id")
        .eq("user_id", user!.id)
        .in("post_id", posts.map((p) => p.id));
      if (error) throw error;
      return (data ?? []).map((r: any) => r.post_id as string);
    },
  });

  const toggleLike = useMutation({
    mutationFn: async ({ postId, liked }: { postId: string; liked: boolean }) => {
      if (!user) throw new Error("Faça login para curtir");
      if (liked) {
        const { error } = await supabase
          .from("store_feed_likes")
          .delete()
          .eq("post_id", postId)
          .eq("user_id", user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("store_feed_likes")
          .insert({ post_id: postId, user_id: user.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["store-feed", storeId] });
      qc.invalidateQueries({ queryKey: ["store-feed-likes", storeId, user?.id] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleFavorite = useMutation({
    mutationFn: async ({ postId, fav }: { postId: string; fav: boolean }) => {
      if (!user) throw new Error("Faça login para favoritar");
      if (fav) {
        const { error } = await supabase
          .from("store_feed_favorites")
          .delete()
          .eq("post_id", postId)
          .eq("user_id", user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("store_feed_favorites")
          .insert({ post_id: postId, user_id: user.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["store-feed-favorites", storeId, user?.id] });
      toast.success("Atualizado");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleShare = async (post: FeedPost) => {
    const url = `${window.location.origin}/loja/${storeSlug}#feed-${post.id}`;
    const text = post.caption ? `${storeName}: ${post.caption}` : storeName;
    try {
      if (navigator.share) {
        await navigator.share({ title: storeName, text, url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success("Link copiado");
      }
    } catch {
      // user cancelled
    }
  };

  if (posts.length === 0) return null;

  return (
    <section className="mt-6">
      <div className="flex items-center justify-between mb-3 px-1">
        <h2 className="text-base font-semibold">Feed</h2>
        <span className="text-xs text-muted-foreground">{posts.length} {posts.length === 1 ? "post" : "posts"}</span>
      </div>
      <div className="space-y-5">
        {posts.map((p) => (
          <FeedPostCard
            key={p.id}
            post={p}
            liked={likedIds.includes(p.id)}
            favorited={favoriteIds.includes(p.id)}
            onLike={() => toggleLike.mutate({ postId: p.id, liked: likedIds.includes(p.id) })}
            onFavorite={() => toggleFavorite.mutate({ postId: p.id, fav: favoriteIds.includes(p.id) })}
            onShare={() => handleShare(p)}
          />
        ))}
      </div>
    </section>
  );
}

function FeedPostCard({
  post,
  liked,
  favorited,
  onLike,
  onFavorite,
  onShare,
}: {
  post: FeedPost;
  liked: boolean;
  favorited: boolean;
  onLike: () => void;
  onFavorite: () => void;
  onShare: () => void;
}) {
  const [idx, setIdx] = useState(0);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const total = post.image_urls.length;
  const hasImages = total > 0;

  const scrollTo = (i: number) => {
    const el = scrollerRef.current;
    if (!el) return;
    const target = Math.max(0, Math.min(i, total - 1));
    el.scrollTo({ left: target * el.clientWidth, behavior: "smooth" });
  };

  const onScroll = () => {
    const el = scrollerRef.current;
    if (!el) return;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    if (i !== idx) setIdx(i);
  };

  return (
    <article id={`feed-${post.id}`} className="rounded-xl overflow-hidden bg-card border">
      {hasImages && (
        <div className="relative bg-black aspect-square">
          <div
            ref={scrollerRef}
            onScroll={onScroll}
            className="flex h-full w-full overflow-x-auto snap-x snap-mandatory scroll-smooth no-scrollbar"
            style={{ scrollbarWidth: "none" }}
          >
            {post.image_urls.map((url, i) => (
              <div key={i} className="shrink-0 w-full h-full snap-center">
                <img
                  src={url}
                  alt=""
                  draggable={false}
                  className="w-full h-full object-cover select-none"
                />
              </div>
            ))}
          </div>
          {total > 1 && (
            <>
              <span className="absolute top-2 right-2 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded-full pointer-events-none">
                {idx + 1}/{total}
              </span>
              {idx > 0 && (
                <button
                  onClick={() => scrollTo(idx - 1)}
                  className="hidden sm:flex absolute left-1 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full p-1"
                  aria-label="Anterior"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
              )}
              {idx < total - 1 && (
                <button
                  onClick={() => scrollTo(idx + 1)}
                  className="hidden sm:flex absolute right-1 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full p-1"
                  aria-label="Próxima"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              )}
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1 pointer-events-none">
                {post.image_urls.map((_, i) => (
                  <span
                    key={i}
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      i === idx ? "bg-white" : "bg-white/50",
                    )}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      <div className="p-3 space-y-2">
        <div className="flex items-center gap-3">
          <button onClick={onLike} aria-label="Curtir" className="flex items-center gap-1">
            <Heart className={cn("h-6 w-6", liked ? "fill-red-500 text-red-500" : "text-foreground")} />
          </button>
          <button onClick={onShare} aria-label="Compartilhar">
            <Share2 className="h-6 w-6" />
          </button>
          <button onClick={onFavorite} aria-label="Favoritar" className="ml-auto">
            <Bookmark className={cn("h-6 w-6", favorited ? "fill-foreground" : "")} />
          </button>
        </div>
        {post.likes_count > 0 && (
          <p className="text-sm font-semibold">
            {post.likes_count} {post.likes_count === 1 ? "curtida" : "curtidas"}
          </p>
        )}
        {post.caption && <p className="text-sm whitespace-pre-wrap">{post.caption}</p>}
      </div>
    </article>
  );
}
