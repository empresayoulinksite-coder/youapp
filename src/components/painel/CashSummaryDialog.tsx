import { useQuery } from "@tanstack/react-query";
import { X, Receipt, ArrowDownToLine, ArrowUpFromLine, Banknote, Sigma } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export function CashSummaryDialog({
  open,
  onClose,
  cashRegisterId,
  storeId,
  openingBalance,
  openedAt,
}: {
  open: boolean;
  onClose: () => void;
  cashRegisterId?: string;
  storeId: string;
  openingBalance: number;
  openedAt: string;
}) {
  const { data: summary, isLoading } = useQuery({
    queryKey: ["cash-summary", cashRegisterId],
    enabled: open && !!cashRegisterId,
    queryFn: async () => {
      // 1. Fetch cash orders since openedAt
      const { data: orders } = await supabase
        .from("orders")
        .select("total, payment_method, status")
        .eq("store_id", storeId)
        .gte("created_at", openedAt)
        .neq("status", "cancelled");

      // Filter only cash orders
      // In the system, payment_method label for cash is usually "Dinheiro" or "Dinheiro / Balcão"
      const cashOrders = (orders || []).filter(o => 
        o.payment_method?.toLowerCase().includes("dinheiro")
      );
      
      const ordersTotal = cashOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);

      // 2. Fetch cash transactions
      const { data: transactions } = await supabase
        .from("cash_transactions")
        .select("type, amount")
        .eq("cash_register_id", cashRegisterId);

      const depositsTotal = (transactions || [])
        .filter(t => t.type === "deposit")
        .reduce((sum, t) => sum + Number(t.amount), 0);

      const withdrawalsTotal = (transactions || [])
        .filter(t => t.type === "withdrawal")
        .reduce((sum, t) => sum + Number(t.amount), 0);

      return {
        ordersTotal,
        depositsTotal,
        withdrawalsTotal,
        finalBalance: openingBalance + ordersTotal + depositsTotal - withdrawalsTotal
      };
    }
  });

  if (!open) return null;

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-md animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Receipt className="h-5 w-5 text-[#4c1554]" />
            Resumo Parcial do Caixa
          </h2>
          <button onClick={onClose} className="p-1 text-slate-500 hover:text-slate-800">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin h-6 w-6 border-2 border-[#4c1554] border-t-transparent rounded-full"></div>
            </div>
          ) : summary ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-dashed">
                <div className="flex items-center gap-2 text-slate-600">
                  <Banknote className="h-4 w-4" />
                  <span className="font-medium">Fundo de caixa (Abertura)</span>
                </div>
                <span className="font-semibold">{formatCurrency(openingBalance)}</span>
              </div>

              <div className="flex items-center justify-between pb-3 border-b border-dashed">
                <div className="flex items-center gap-2 text-emerald-600">
                  <Banknote className="h-4 w-4" />
                  <span className="font-medium">Vendas em dinheiro</span>
                </div>
                <span className="font-semibold text-emerald-600">+{formatCurrency(summary.ordersTotal)}</span>
              </div>

              <div className="flex items-center justify-between pb-3 border-b border-dashed">
                <div className="flex items-center gap-2 text-emerald-600">
                  <ArrowDownToLine className="h-4 w-4" />
                  <span className="font-medium">Suprimentos (Entradas)</span>
                </div>
                <span className="font-semibold text-emerald-600">+{formatCurrency(summary.depositsTotal)}</span>
              </div>

              <div className="flex items-center justify-between pb-3 border-b border-dashed">
                <div className="flex items-center gap-2 text-red-600">
                  <ArrowUpFromLine className="h-4 w-4" />
                  <span className="font-medium">Retiradas (Sangrias)</span>
                </div>
                <span className="font-semibold text-red-600">-{formatCurrency(summary.withdrawalsTotal)}</span>
              </div>

              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-2 text-[#4c1554]">
                  <Sigma className="h-5 w-5" />
                  <span className="font-bold text-lg">Total estimado em gaveta</span>
                </div>
                <span className="font-black text-xl text-[#4c1554]">{formatCurrency(summary.finalBalance)}</span>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-slate-500">Erro ao carregar resumo.</div>
          )}
        </div>
      </div>
    </div>
  );
}
