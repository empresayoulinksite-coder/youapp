import { useState } from "react";
import { X, HandCoins, ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function CashTransactionDialog({
  open,
  type,
  onClose,
  onConfirm,
}: {
  open: boolean;
  type: "deposit" | "withdrawal";
  onClose: () => void;
  onConfirm: (amount: number, reason: string) => void;
}) {
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");

  if (!open) return null;

  const isDeposit = type === "deposit";

  const handleConfirm = () => {
    const numericValue = Number(amount.replace(/\D/g, "")) / 100;
    if (numericValue <= 0) return;
    onConfirm(numericValue, reason.trim());
    setAmount("");
    setReason("");
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/\D/g, "");
    if (!rawValue) {
      setAmount("");
      return;
    }
    const numberValue = Number(rawValue) / 100;
    setAmount(
      new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
      }).format(numberValue)
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-md animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            {isDeposit ? <ArrowDownToLine className="h-5 w-5 text-emerald-600" /> : <ArrowUpFromLine className="h-5 w-5 text-red-600" />}
            {isDeposit ? "Informar suprimento" : "Informar retirada"}
          </h2>
          <button onClick={onClose} className="p-1 text-slate-500 hover:text-slate-800">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-sm text-slate-600">
            {isDeposit 
              ? "Informe o valor em dinheiro que está sendo adicionado ao caixa (Ex: troco, reforço)." 
              : "Informe o valor em dinheiro que está sendo retirado do caixa (Ex: sangria, pagamento de fornecedor)."}
          </p>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              Valor *
            </label>
            <Input 
              autoFocus
              value={amount}
              onChange={handleAmountChange}
              placeholder="R$ 0,00"
              className="h-12 text-lg font-medium"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              Motivo / Descrição (Opcional)
            </label>
            <Textarea 
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={isDeposit ? "Ex: Adição de troco" : "Ex: Pagamento do entregador"}
              className="resize-none"
              rows={3}
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 p-4 border-t bg-slate-50 rounded-b-lg">
          <Button variant="outline" onClick={onClose} className="h-10 px-6 font-medium">
            Cancelar
          </Button>
          <Button 
            onClick={handleConfirm} 
            disabled={!amount || amount === "R$ 0,00"} 
            className={`h-10 px-6 font-bold text-white ${isDeposit ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-600 hover:bg-red-700"}`}
          >
            Confirmar {isDeposit ? "Suprimento" : "Retirada"}
          </Button>
        </div>
      </div>
    </div>
  );
}
