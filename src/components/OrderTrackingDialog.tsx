import { useEffect, useState } from "react";
import { Check, Clock, ChefHat, UtensilsCrossed, X } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type OrderStatus = "em_analise" | "em_producao" | "pronto" | "entregue" | "cancelado";

const STEPS: { key: OrderStatus; label: string; icon: typeof Clock }[] = [
  { key: "em_analise", label: "Em análise", icon: Clock },
  { key: "em_producao", label: "Em produção", icon: ChefHat },
  { key: "pronto", label: "Pronto", icon: UtensilsCrossed },
];

function stepIndex(status: OrderStatus) {
  const idx = STEPS.findIndex((s) => s.key === status);
  return idx === -1 ? -1 : idx;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  orderId: string | null;
  orderNumber?: number | null;
  tableNumber?: number | null;
  storeName?: string | null;
}

export function OrderTrackingDialog({
  open,
  onOpenChange,
  orderId,
  orderNumber,
  tableNumber,
  storeName,
}: Props) {
  const [status, setStatus] = useState<OrderStatus>("em_analise");

  useEffect(() => {
    if (!open || !orderId) return;

    // Fetch initial status
    supabase
      .from("orders")
      .select("status")
      .eq("id", orderId)
      .single()
      .then(({ data }) => {
        if (data?.status) setStatus(data.status as OrderStatus);
      });

    // Subscribe to realtime changes
    const channel = supabase
      .channel(`order-tracking-${orderId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "orders",
          filter: `id=eq.${orderId}`,
        },
        (payload) => {
          const newStatus = payload.new?.status as OrderStatus | undefined;
          if (newStatus) setStatus(newStatus);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [open, orderId]);

  const currentIdx = stepIndex(status);
  const isCancelled = status === "cancelado";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 max-w-md w-full max-h-[90vh] overflow-hidden flex flex-col gap-0">
        {/* Header */}
        <header className="flex items-center justify-between px-4 py-4 border-b">
          <div>
            <h2 className="text-base font-bold">
              {storeName ? storeName : "Pedido enviado!"} 
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {orderNumber ? `Pedido #${orderNumber}` : "Processando..."}
              {tableNumber ? ` • Mesa ${tableNumber}` : ""}
            </p>
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="p-1 rounded-full hover:bg-muted"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Success message */}
          <div className="text-center mb-8">
            <div className="mx-auto w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-3">
              <Check className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <h3 className="text-lg font-bold">Pedido enviado!</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Acompanhe o status abaixo
            </p>
          </div>

          {isCancelled ? (
            <div className="rounded-xl bg-destructive/10 border border-destructive/30 p-4 text-center">
              <p className="font-semibold text-destructive">Pedido cancelado</p>
              <p className="text-xs text-muted-foreground mt-1">
                Entre em contato com o estabelecimento se tiver dúvidas.
              </p>
            </div>
          ) : (
            /* Timeline */
            <div className="space-y-0">
              {STEPS.map((step, idx) => {
                const isCompleted = currentIdx > idx;
                const isCurrent = currentIdx === idx;
                const isPending = currentIdx < idx;
                const Icon = step.icon;

                return (
                  <div key={step.key} className="flex gap-4">
                    {/* Vertical line + circle */}
                    <div className="flex flex-col items-center">
                      <div
                        className={cn(
                          "w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-colors duration-500",
                          isCompleted && "bg-green-500 text-white",
                          isCurrent && "bg-primary text-primary-foreground ring-4 ring-primary/20",
                          isPending && "bg-muted text-muted-foreground",
                        )}
                      >
                        {isCompleted ? (
                          <Check className="h-5 w-5" />
                        ) : (
                          <Icon className="h-5 w-5" />
                        )}
                      </div>
                      {idx < STEPS.length - 1 && (
                        <div
                          className={cn(
                            "w-0.5 h-10 transition-colors duration-500",
                            isCompleted ? "bg-green-500" : "bg-muted",
                          )}
                        />
                      )}
                    </div>

                    {/* Label */}
                    <div className="pt-2 pb-4">
                      <p
                        className={cn(
                          "font-semibold text-sm",
                          isCurrent && "text-primary",
                          isPending && "text-muted-foreground",
                        )}
                      >
                        {step.label}
                      </p>
                      {isCurrent && (
                        <p className="text-xs text-muted-foreground mt-0.5 animate-pulse">
                          Aguardando...
                        </p>
                      )}
                      {isCompleted && (
                        <p className="text-xs text-green-600 dark:text-green-400 mt-0.5">
                          Concluído ✓
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-background">
          <Button
            onClick={() => onOpenChange(false)}
            variant="outline"
            className="w-full"
            size="lg"
          >
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
