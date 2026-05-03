import { useState } from "react";
import { X, Calculator } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function CashRegisterDialog({
  open,
  onClose,
  onConfirm,
  isOpening,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (amount: number) => void;
  isOpening: boolean;
}) {
  const [amount, setAmount] = useState("");

  if (!open) return null;

  const handleConfirm = () => {
    // Remove R$ e converte pra número
    const numericValue = Number(amount.replace(/\D/g, "")) / 100;
    onConfirm(numericValue);
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
            <Calculator className="h-5 w-5" />
            {isOpening ? "Abrir frente de caixa" : "Fechar frente de caixa"}
          </h2>
          <button onClick={onClose} className="p-1 text-slate-500 hover:text-slate-800">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5">
          <p className="text-sm text-slate-600 mb-4">
            {isOpening 
              ? "Informe o valor total em dinheiro presente no caixa no ato da abertura" 
              : "Informe o valor total em dinheiro presente no caixa no ato do fechamento"}
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
          <Button variant="outline" onClick={onClose} className="h-10 px-6 font-medium">
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={!amount} className="h-10 px-6 font-bold bg-[#4c1554] hover:bg-[#360e3c] text-white">
            {isOpening ? "Abrir caixa" : "Fechar caixa"}
          </Button>
        </div>
      </div>
    </div>
  );
}
