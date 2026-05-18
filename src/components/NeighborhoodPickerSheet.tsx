import { useMemo, useState } from "react";
import { Search, X, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface DeliveryArea {
  id: string;
  neighborhood: string;
  fee: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  areas: DeliveryArea[];
  selectedNeighborhood: string | null;
  onSelect: (area: DeliveryArea) => void;
}

const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

function fmtFee(fee: number): string {
  return fee > 0 ? `R$ ${fee.toFixed(2).replace(".", ",")}` : "Grátis";
}

export function NeighborhoodPickerSheet({
  open,
  onClose,
  areas,
  selectedNeighborhood,
  onSelect,
}: Props) {
  const [search, setSearch] = useState("");

  const sorted = useMemo(
    () =>
      [...areas].sort((a, b) =>
        a.neighborhood.localeCompare(b.neighborhood, "pt-BR"),
      ),
    [areas],
  );

  const filtered = useMemo(() => {
    if (!search.trim()) return sorted;
    const q = norm(search);
    return sorted.filter((a) => norm(a.neighborhood).includes(q));
  }, [sorted, search]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/50 flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-card w-full max-w-md rounded-t-3xl sm:rounded-3xl max-h-[85vh] flex flex-col animate-in slide-in-from-bottom duration-200"
      >
        <div className="px-5 pt-4 pb-3 border-b border-border flex items-start justify-between gap-3">
          <h2 className="font-bold text-lg">Selecione seu bairro</h2>
          <button onClick={onClose} className="p-1 -mr-1" aria-label="Fechar">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-5 pt-3 pb-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Pesquise pelo seu bairro"
              className="w-full h-10 pl-9 pr-3 rounded-xl border border-border bg-background text-sm outline-none focus:border-brand"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-4">
          {filtered.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">
              Nenhum bairro encontrado.
            </p>
          ) : (
            <ul>
              {filtered.map((a) => {
                const checked =
                  selectedNeighborhood != null &&
                  norm(selectedNeighborhood) === norm(a.neighborhood);
                return (
                  <li key={a.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onSelect(a);
                        onClose();
                      }}
                      className={cn(
                        "w-full flex items-center justify-between gap-3 px-3 py-3 rounded-xl text-left transition-colors",
                        checked ? "bg-brand-soft" : "hover:bg-muted",
                      )}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">
                          {a.neighborhood}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Taxa {fmtFee(a.fee)}
                        </p>
                      </div>
                      <div
                        className={cn(
                          "h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0",
                          checked ? "border-brand bg-brand" : "border-border",
                        )}
                      >
                        {checked && (
                          <Check className="h-3 w-3 text-brand-foreground" />
                        )}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
