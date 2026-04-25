import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Clock, Images } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ServiceGalleryDialog } from "@/components/ServiceGalleryDialog";

type Service = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  duration_minutes: number;
  image_url: string | null;
  feed_category_id: string | null;
  gallery_urls: string[];
  show_price: boolean;
  show_duration: boolean;
};

type FeedCategory = { id: string; name: string };

export function StoreFeedServicesDialog({
  open,
  onOpenChange,
  storeId,
  categoryId,
  isAuthenticated,
  onPickService,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  storeId: string;
  categoryId: string | null;
  isAuthenticated: boolean;
  onPickService: (serviceId: string) => void;
}) {
  const [activeService, setActiveService] = useState<Service | null>(null);

  const { data: services = [] } = useQuery({
    queryKey: ["feed-services-dialog", storeId, categoryId],
    enabled: open,
    queryFn: async () => {
      let q = supabase
        .from("services")
        .select(
          "id, name, description, price, duration_minutes, image_url, feed_category_id, gallery_urls, show_price, show_duration",
        )
        .eq("store_id", storeId)
        .eq("is_active", true)
        .order("position", { ascending: true });
      if (categoryId) q = q.eq("feed_category_id", categoryId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []).map((s) => ({ ...s, price: Number(s.price) })) as Service[];
    },
  });

  const { data: category } = useQuery({
    queryKey: ["feed-services-dialog-cat", categoryId],
    enabled: open && !!categoryId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_feed_categories")
        .select("id, name")
        .eq("id", categoryId!)
        .maybeSingle();
      if (error) throw error;
      return data as FeedCategory | null;
    },
  });

  const title = useMemo(
    () => (categoryId ? category?.name ?? "Serviços" : "Serviços"),
    [category, categoryId],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 max-w-md w-full h-[90vh] sm:h-[85vh] overflow-hidden flex flex-col gap-0">
        <header className="flex items-center gap-2 px-3 py-3 border-b shrink-0">
          <button
            onClick={() => onOpenChange(false)}
            className="p-1 -ml-1 rounded-full hover:bg-muted"
            aria-label="Voltar"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h2 className="text-base font-semibold truncate">{title}</h2>
        </header>

        <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-muted/30">
          {services.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">
              Nenhum serviço disponível nesta categoria.
            </p>
          ) : (
            services.map((s) => {
              const photoCount = s.gallery_urls?.length || (s.image_url ? 1 : 0);
              return (
                <article
                  key={s.id}
                  onClick={() => setActiveService(s)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setActiveService(s);
                    }
                  }}
                  className="bg-card rounded-2xl p-3 flex gap-3 shadow-[var(--shadow-card)] cursor-pointer transition-colors hover:bg-accent/40 focus:outline-none focus:ring-2 focus:ring-brand"
                >
                  <div className="relative h-20 w-20 rounded-xl overflow-hidden bg-brand-soft flex items-center justify-center text-3xl shrink-0">
                    {s.image_url ? (
                      <img
                        src={s.image_url}
                        alt={s.name}
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span>✂️</span>
                    )}
                    {photoCount > 1 && (
                      <span className="absolute bottom-1 right-1 text-[10px] font-semibold text-white bg-black/60 rounded-full px-1.5 py-0.5 inline-flex items-center gap-0.5">
                        <Images className="h-3 w-3" /> {photoCount}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold truncate">{s.name}</h4>
                    {s.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {s.description}
                      </p>
                    )}
                    {(s.show_price || s.show_duration) && (
                      <div className="flex items-center gap-2 mt-2">
                        {s.show_price && (
                          <span className="font-bold text-sm">
                            R$ {s.price.toFixed(2).replace(".", ",")}
                          </span>
                        )}
                        {s.show_duration && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" /> {s.duration_minutes} min
                          </span>
                        )}
                      </div>
                    )}
                    <div className="mt-2">
                      <span className="text-xs font-bold bg-brand text-brand-foreground rounded-full px-3 py-1.5 inline-flex items-center gap-1">
                        <Images className="h-3.5 w-3.5" /> Ver fotos
                      </span>
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </DialogContent>

      <ServiceGalleryDialog
        open={!!activeService}
        onOpenChange={(o) => !o && setActiveService(null)}
        service={activeService}
        isAuthenticated={isAuthenticated}
        onBook={(serviceId) => {
          setActiveService(null);
          onPickService(serviceId);
        }}
      />
    </Dialog>
  );
}
