import { useEffect, useState } from "react";
import { ArrowLeft, MessageCircle, Clock } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { openWhatsapp } from "@/lib/whatsapp";
import { optimizedImageUrl } from "@/lib/image-url";
import { toast } from "sonner";

type ServiceLike = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  duration_minutes: number;
  image_url: string | null;
  show_price?: boolean;
  show_duration?: boolean;
};

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  service: ServiceLike | null;
  storeName: string;
  storeWhatsapp: string | null;
  customerName?: string | null;
}

export function QuoteReviewDialog({
  open,
  onOpenChange,
  service,
  storeName,
  storeWhatsapp,
  customerName,
}: Props) {
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) setNotes("");
  }, [open]);

  if (!service) return null;

  const handleSend = () => {
    if (!storeWhatsapp) {
      toast.error("Esta loja não cadastrou um WhatsApp.");
      return;
    }
    const greeting = customerName ? `Oi! Sou ${customerName}.` : "Olá!";
    const lines = [
      `${greeting} Gostaria de um *orçamento* em *${storeName}*.`,
      ``,
      `🛎️ *Serviço:* ${service.name}`,
    ];
    if (service.show_price !== false) {
      lines.push(`💰 *Valor de referência:* R$ ${service.price.toFixed(2).replace(".", ",")}`);
    }
    if (service.show_duration !== false) {
      lines.push(`⏱️ *Duração estimada:* ${service.duration_minutes} min`);
    }
    if (notes.trim()) {
      lines.push(``, `📝 *Observações:*`, notes.trim());
    }
    lines.push(``, `Pode me passar mais detalhes? 🙏`);

    openWhatsapp(storeWhatsapp, lines.join("\n"));
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 max-w-md w-full max-h-[90vh] overflow-hidden flex flex-col gap-0">
        <header className="flex items-center gap-2 px-3 py-3 border-b shrink-0">
          <button
            onClick={() => onOpenChange(false)}
            className="p-1 -ml-1 rounded-full hover:bg-muted"
            aria-label="Voltar"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h2 className="text-base font-semibold truncate">Revisar pedido</h2>
        </header>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="flex gap-3 rounded-2xl bg-muted/40 p-3">
            <div className="h-20 w-20 rounded-xl overflow-hidden bg-muted shrink-0 flex items-center justify-center text-3xl">
              {service.image_url ? (
                <img
                  src={optimizedImageUrl(service.image_url, { width: 200, quality: 70 })}
                  alt={service.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span>✂️</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold">{service.name}</h3>
              {service.description && (
                <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                  {service.description}
                </p>
              )}
              <div className="flex items-center gap-3 mt-2 text-xs">
                {service.show_price !== false && (
                  <span className="font-bold text-sm">
                    R$ {service.price.toFixed(2).replace(".", ",")}
                  </span>
                )}
                {service.show_duration !== false && (
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" /> {service.duration_minutes} min
                  </span>
                )}
              </div>
            </div>
          </div>

          <div>
            <Label htmlFor="quote-notes" className="text-sm">
              Observações <span className="text-muted-foreground font-normal">(opcional)</span>
            </Label>
            <Textarea
              id="quote-notes"
              placeholder="Ex.: tenho disponibilidade quinta de manhã, dúvida sobre material, etc."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              className="mt-1.5 resize-none"
              maxLength={500}
            />
            <p className="text-[11px] text-muted-foreground mt-1 text-right">
              {notes.length}/500
            </p>
          </div>

          <div className="rounded-xl bg-muted/60 border p-3 text-xs text-muted-foreground">
            Ao enviar, vamos abrir o WhatsApp com a mensagem pronta. Você pode revisar
            antes de enviar para o profissional.
          </div>
        </div>

        <div className="p-3 border-t shrink-0 bg-background">
          <Button
            onClick={handleSend}
            className="w-full"
            size="lg"
          >
            <MessageCircle className="h-4 w-4 mr-2" />
            Enviar pelo WhatsApp
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
