import { useEffect, useState } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, X, CalendarClock, Clock, MessageCircle } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { optimizedImageUrl } from "@/lib/image-url";

type ServiceLike = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  duration_minutes: number;
  image_url: string | null;
  gallery_urls: string[];
  show_price?: boolean;
  show_duration?: boolean;
};

export function ServiceGalleryDialog({
  open,
  onOpenChange,
  service,
  isAuthenticated,
  onBook,
  bookingMode = "booking",
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  service: ServiceLike | null;
  isAuthenticated: boolean;
  onBook: (serviceId: string) => void;
  bookingMode?: "booking" | "quote";
}) {
  const [lightbox, setLightbox] = useState<number | null>(null);

  useEffect(() => {
    if (!open) setLightbox(null);
  }, [open]);

  if (!service) return null;

  const photos = (service.gallery_urls?.length
    ? service.gallery_urls
    : service.image_url
      ? [service.image_url]
      : []) as string[];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 max-w-md w-full h-[90vh] sm:h-[85vh] overflow-hidden flex flex-col gap-0">
        {/* Header */}
        <header className="flex items-center gap-2 px-3 py-3 border-b shrink-0">
          <button
            onClick={() => onOpenChange(false)}
            className="p-1 -ml-1 rounded-full hover:bg-muted"
            aria-label="Voltar"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold truncate">{service.name}</h2>
            {(service.show_price !== false || service.show_duration !== false) && (
              <p className="text-[11px] text-muted-foreground flex items-center gap-2">
                {service.show_price !== false && (
                  <span className="font-semibold text-foreground">
                    R$ {service.price.toFixed(2).replace(".", ",")}
                  </span>
                )}
                {service.show_duration !== false && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" /> {service.duration_minutes} min
                  </span>
                )}
              </p>
            )}
          </div>
        </header>

        {/* Feed */}
        <div className="flex-1 overflow-y-auto bg-background">
          {service.description && (
            <p className="px-3 pt-3 text-sm text-muted-foreground">{service.description}</p>
          )}

          {photos.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">
              Nenhuma foto cadastrada para esse serviço.
            </p>
          ) : (
            <div className="p-3 space-y-3">
              {photos.map((url, i) => (
                <button
                  key={`${url}-${i}`}
                  onClick={() => setLightbox(i)}
                  className="block w-full overflow-hidden rounded-xl bg-muted"
                >
                  <img
                    src={url}
                    alt={`${service.name} ${i + 1}`}
                    loading="lazy"
                    className="w-full h-auto object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* CTA */}
        <div className="p-3 border-t shrink-0 bg-background">
          <Button onClick={() => onBook(service.id)} className="w-full" size="lg">
            <CalendarClock className="h-4 w-4 mr-2" />
            {isAuthenticated ? "Agendar serviço" : "Entrar para agendar"}
          </Button>
        </div>

        {/* Lightbox */}
        {lightbox !== null && photos.length > 0 && (
          <Lightbox
            images={photos}
            index={lightbox}
            onClose={() => setLightbox(null)}
            onChange={setLightbox}
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
  const go = (delta: number) => onChange((index + delta + total) % total);

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
