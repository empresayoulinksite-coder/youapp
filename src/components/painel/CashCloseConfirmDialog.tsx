import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { X, Calculator, AlertTriangle, CheckCircle2, Banknote, ArrowDownToLine, ArrowUpFromLine, Sigma, TrendingDown, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

export function CashCloseConfirmDialog({
  open,
  onClose,
  onConfirm,
  cashRegisterId,
  storeId,
  openingBalance,
  openedAt,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (amount: number) => void;
  cashRegisterId: string;
  storeId: string;
  openingBalance: number;
  openedAt: string;
}) {
  const [amount, setAmount] = useState("");
  const [step, setStep] = useState<"input" | "confirm">("input");

  const { data: summary, isLoading } = useQuery({
    queryKey: ["cash-close-summary", cashRegisterId],
    enabled: open && !!cashRegisterId,
    queryFn: async () => {
      const { data: orders } = await supabase
        .from("orders")
        .select("total, payment_method, status")
        .eq("store_id", storeId)
        .gte("created_at", openedAt)
        .neq("status", "cancelled");

      const cashOrders = (orders || []).filter(o =>
        o.payment_method?.toLowerCase().includes("dinheiro")
      );
      const ordersTotal = cashOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);

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
        expectedBalance: openingBalance + ordersTotal + depositsTotal - withdrawalsTotal,
      };
    },
  });

  if (!open) return null;

  const numericValue = amount ? Number(amount.replace(/\D/g, "")) / 100 : 0;
  const difference = summary ? numericValue - summary.expectedBalance : 0;

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/\D/g, "");
    if (!rawValue) {
      setAmount("");
      return;
    }
    const numberValue = Number(rawValue) / 100;
    setAmount(
      new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(numberValue)
    );
  };

  const handleNext = () => {
    setStep("confirm");
  };

  const handleBack = () => {
    setStep("input");
  };

  const handleConfirm = () => {
    onConfirm(numericValue);
    setStep("input");
    setAmount("");
  };

  const handleClose = () => {
    setStep("input");
    setAmount("");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-md animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Fechar frente de caixa
          </h2>
          <button onClick={handleClose} className="p-1 text-slate-500 hover:text-slate-800">
            <X className="h-5 w-5" />
          </button>
        </div>

        {step === "input" ? (
          <>
            <div className="p-5">
              <p className="text-sm text-slate-600 mb-4">
                Informe o valor total em dinheiro presente no caixa no ato do fechamento
              </p>
              <label className="block text-sm font-semibold text-slate-700 mb-1">
                Valor em dinheiro *
              </label>
              <Input
                autoFocus
                value={amount}
                onChange={handleAmountChange}
                placeholder="R$ 0,00"
                className="h-12 text-lg font-medium"
              />
            </div>
            <div className="flex items-center justify-end gap-3 p-4 border-t bg-slate-50 rounded-b-lg">
              <Button variant="outline" onClick={handleClose} className="h-10 px-6 font-medium">
                Cancelar
              </Button>
              <Button
                onClick={handleNext}
                disabled={!amount || isLoading}
                className="h-10 px-6 font-bold bg-[#4c1554] hover:bg-[#360e3c] text-white"
              >
                Avançar
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="p-5">
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin h-6 w-6 border-2 border-[#4c1554] border-t-transparent rounded-full"></div>
                </div>
              ) : summary ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-dashed">
                    <div className="flex items-center gap-2 text-slate-600">
                      <Banknote className="h-4 w-4" />
                      <span className="text-sm font-medium">Fundo de caixa</span>
                    </div>
                    <span className="font-semibold text-sm">{formatCurrency(openingBalance)}</span>
                  </div>

                  <div className="flex items-center justify-between pb-2 border-b border-dashed">
                    <div className="flex items-center gap-2 text-emerald-600">
                      <Banknote className="h-4 w-4" />
                      <span className="text-sm font-medium">Vendas em dinheiro</span>
                    </div>
                    <span className="font-semibold text-sm text-emerald-600">+{formatCurrency(summary.ordersTotal)}</span>
                  </div>

                  <div className="flex items-center justify-between pb-2 border-b border-dashed">
                    <div className="flex items-center gap-2 text-emerald-600">
                      <ArrowDownToLine className="h-4 w-4" />
                      <span className="text-sm font-medium">Suprimentos</span>
                    </div>
                    <span className="font-semibold text-sm text-emerald-600">+{formatCurrency(summary.depositsTotal)}</span>
                  </div>

                  <div className="flex items-center justify-between pb-2 border-b border-dashed">
                    <div className="flex items-center gap-2 text-red-600">
                      <ArrowUpFromLine className="h-4 w-4" />
                      <span className="text-sm font-medium">Retiradas</span>
                    </div>
                    <span className="font-semibold text-sm text-red-600">-{formatCurrency(summary.withdrawalsTotal)}</span>
                  </div>

                  <div className="flex items-center justify-between pb-2 border-b border-dashed">
                    <div className="flex items-center gap-2 text-[#4c1554]">
                      <Sigma className="h-4 w-4" />
                      <span className="text-sm font-bold">Valor esperado</span>
                    </div>
                    <span className="font-black text-[#4c1554]">{formatCurrency(summary.expectedBalance)}</span>
                  </div>

                  <div className="flex items-center justify-between pb-2 border-b border-dashed">
                    <div className="flex items-center gap-2 text-slate-700">
                      <Calculator className="h-4 w-4" />
                      <span className="text-sm font-bold">Valor informado</span>
                    </div>
                    <span className="font-black text-slate-700">{formatCurrency(numericValue)}</span>
                  </div>

                  {/* Difference highlight */}
                  {Math.abs(difference) < 0.01 ? (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                      <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                      <span className="text-sm font-semibold text-emerald-700">
                        Caixa batendo! Nenhuma diferença.
                      </span>
                    </div>
                  ) : difference < 0 ? (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
                      <TrendingDown className="h-5 w-5 text-red-600 shrink-0" />
                      <div>
                        <span className="text-sm font-semibold text-red-700">
                          Faltando no caixa: {formatCurrency(Math.abs(difference))}
                        </span>
                        <p className="text-xs text-red-500 mt-0.5">O valor informado é menor que o esperado.</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-50 border border-blue-200">
                      <TrendingUp className="h-5 w-5 text-blue-600 shrink-0" />
                      <div>
                        <span className="text-sm font-semibold text-blue-700">
                          Sobrando no caixa: {formatCurrency(difference)}
                        </span>
                        <p className="text-xs text-blue-500 mt-0.5">O valor informado é maior que o esperado.</p>
                      </div>
                    </div>
                  )}

                  {Math.abs(difference) >= 0.01 && (
                    <div className="flex items-center gap-2 p-2 rounded bg-amber-50 border border-amber-200">
                      <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                      <span className="text-xs text-amber-700">
                        Deseja fechar o caixa mesmo assim?
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-slate-500">Erro ao carregar resumo.</div>
              )}
            </div>
            <div className="flex items-center justify-end gap-3 p-4 border-t bg-slate-50 rounded-b-lg">
              <Button variant="outline" onClick={handleBack} className="h-10 px-6 font-medium">
                Voltar
              </Button>
              <Button
                onClick={handleConfirm}
                className="h-10 px-6 font-bold bg-[#4c1554] hover:bg-[#360e3c] text-white"
              >
                Confirmar fechamento
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
