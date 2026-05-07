import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Search, Plus, ChevronDown, QrCode, Printer, MoreVertical, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { QRCodeSVG } from "qrcode.react";

type StoreTable = {
  id: string;
  store_id: string;
  number: number;
  label: string;
  type: "mesa" | "comanda";
  status: "livre" | "ocupada" | "fechando_conta";
};

const STATUS_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  livre: { bg: "bg-green-100", text: "text-green-700", dot: "bg-green-500" },
  ocupada: { bg: "bg-orange-100", text: "text-orange-700", dot: "bg-orange-500" },
  fechando_conta: { bg: "bg-gray-200", text: "text-gray-600", dot: "bg-gray-500" },
};

const STATUS_LABELS: Record<string, string> = {
  livre: "Livre",
  ocupada: "Ocupada",
  fechando_conta: "Fechando conta",
};

export function TablesManager({ storeId, storeSlug }: { storeId: string; storeSlug?: string }) {
  const qc = useQueryClient();
  const [viewType, setViewType] = useState<"mesa" | "comanda">("mesa");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [qrDialog, setQrDialog] = useState<StoreTable | null>(null);
  const [createCount, setCreateCount] = useState(1);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const { data: tables = [], isLoading } = useQuery({
    queryKey: ["store-tables", storeId, viewType],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_tables")
        .select("*")
        .eq("store_id", storeId)
        .eq("type", viewType)
        .order("number", { ascending: true });
      if (error) throw error;
      return data as StoreTable[];
    },
  });

  const filtered = useMemo(() => {
    let result = tables;
    if (search.trim()) {
      const term = search.toLowerCase();
      result = result.filter(t => t.label.toLowerCase().includes(term) || String(t.number).includes(term));
    }
    if (statusFilter !== "all") {
      result = result.filter(t => t.status === statusFilter);
    }
    return result;
  }, [tables, search, statusFilter]);

  const createMutation = useMutation({
    mutationFn: async (count: number) => {
      const maxNumber = tables.length > 0 ? Math.max(...tables.map(t => t.number)) : 0;
      const rows = Array.from({ length: count }, (_, i) => {
        const num = maxNumber + i + 1;
        const typeLabel = viewType === "mesa" ? "Mesa" : "Comanda";
        return {
          store_id: storeId,
          number: num,
          label: `${typeLabel} #${num}`,
          type: viewType,
          status: "livre" as const,
        };
      });
      const { error } = await supabase.from("store_tables").insert(rows);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`${viewType === "mesa" ? "Mesa(s)" : "Comanda(s)"} criada(s)!`);
      qc.invalidateQueries({ queryKey: ["store-tables", storeId, viewType] });
      setCreateDialogOpen(false);
      setCreateCount(1);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "livre" | "ocupada" | "fechando_conta" }) => {
      const { error } = await supabase.from("store_tables").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["store-tables", storeId, viewType] }),
    onError: (err: any) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("store_tables").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Removido com sucesso!");
      qc.invalidateQueries({ queryKey: ["store-tables", storeId, viewType] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const getQrUrl = (table: StoreTable) => {
    const baseUrl = storeSlug ? `${window.location.origin}/loja/${storeSlug}` : `${window.location.origin}`;
    return `${baseUrl}?mesa=${table.number}`;
  };

  const handlePrintQr = () => {
    const svgEl = document.getElementById("qr-print-target");
    if (!svgEl) return;
    const svgData = new XMLSerializer().serializeToString(svgEl);
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
      <html><head><title>QR Code - ${qrDialog?.label}</title>
      <style>body{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;margin:0;font-family:sans-serif}h2{margin-bottom:16px}</style>
      </head><body>
      <h2>${qrDialog?.label}</h2>
      ${svgData}
      <p style="margin-top:12px;color:#666;font-size:14px">Escaneie para acessar o cardápio</p>
      <script>window.onload=()=>{window.print();window.close()}</script>
      </body></html>
    `);
    win.document.close();
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Header Tabs */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="inline-flex rounded-lg border bg-white p-1">
          <button
            className={cn(
              "px-5 py-2 rounded-md text-sm font-semibold transition-colors",
              viewType === "mesa" ? "bg-[#661f71] text-white" : "text-slate-600 hover:bg-slate-100"
            )}
            onClick={() => setViewType("mesa")}
          >
            Mesas
          </button>
          <button
            className={cn(
              "px-5 py-2 rounded-md text-sm font-semibold transition-colors",
              viewType === "comanda" ? "bg-[#661f71] text-white" : "text-slate-600 hover:bg-slate-100"
            )}
            onClick={() => setViewType("comanda")}
          >
            Comandas
          </button>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-xs text-slate-500">
          {Object.entries(STATUS_LABELS).map(([key, label]) => (
            <span key={key} className="flex items-center gap-1.5">
              <span className={cn("h-2.5 w-2.5 rounded-full", STATUS_COLORS[key].dot)} />
              {label}
            </span>
          ))}
        </div>
      </div>

      {/* Filters & Actions */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9 bg-white"
            placeholder={`Nº da ${viewType}`}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px] bg-white">
            <SelectValue placeholder="Todos os status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="livre">Livre</SelectItem>
            <SelectItem value="ocupada">Ocupada</SelectItem>
            <SelectItem value="fechando_conta">Fechando conta</SelectItem>
          </SelectContent>
        </Select>
        <div className="ml-auto flex gap-2">
          <Button
            variant="outline"
            className="border-[#661f71] text-[#661f71] hover:bg-[#661f71]/10"
            onClick={() => setCreateDialogOpen(true)}
          >
            <Plus className="h-4 w-4 mr-1" />
            Criar {viewType === "mesa" ? "mesa" : "comanda"}
          </Button>
        </div>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="text-center text-muted-foreground py-12">Carregando...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center text-muted-foreground py-12">
          {tables.length === 0
            ? `Nenhuma ${viewType} criada ainda. Clique em "Criar ${viewType}" para começar.`
            : "Nenhum resultado encontrado."}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(table => {
            const colors = STATUS_COLORS[table.status];
            return (
              <div key={table.id} className="bg-white rounded-xl border shadow-sm overflow-hidden flex flex-col">
                <div className="flex items-center justify-between px-4 py-3">
                  <div>
                    <span className="text-sm font-bold text-slate-800">{table.label.split("#")[0]}</span>
                    <span className="text-sm font-bold text-slate-800">#{table.number}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs border-slate-300"
                      onClick={() => {
                        if (table.status === "livre") {
                          updateStatus.mutate({ id: table.id, status: "ocupada" });
                        }
                        toast.info("Funcionalidade de pedido vinculado à mesa em breve!");
                      }}
                    >
                      <Plus className="h-3 w-3 mr-1" /> Pedido
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="h-8 w-8 p-0 border-slate-300">
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => {
                          if (table.status === "livre") {
                            updateStatus.mutate({ id: table.id, status: "ocupada" });
                          }
                          toast.info("Funcionalidade de pedido vinculado à mesa em breve!");
                        }}>
                          <Plus className="h-4 w-4 mr-2" /> Novo Pedido
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setQrDialog(table)}>
                          <QrCode className="h-4 w-4 mr-2" /> Imprimir QRCode
                        </DropdownMenuItem>
                        {table.status === "ocupada" && (
                          <DropdownMenuItem onClick={() => updateStatus.mutate({ id: table.id, status: "fechando_conta" })}>
                            Fechar conta
                          </DropdownMenuItem>
                        )}
                        {table.status !== "livre" && (
                          <DropdownMenuItem onClick={() => updateStatus.mutate({ id: table.id, status: "livre" })}>
                            Liberar {viewType}
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => {
                            if (confirm(`Excluir ${table.label}?`)) {
                              deleteMutation.mutate(table.id);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4 mr-2" /> Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
                <div className={cn("py-1.5 text-center text-xs font-semibold", colors.bg, colors.text)}>
                  {STATUS_LABELS[table.status]}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* QR Code Dialog */}
      <Dialog open={!!qrDialog} onOpenChange={() => setQrDialog(null)}>
        <DialogContent className="max-w-sm text-center">
          <DialogHeader>
            <DialogTitle>{qrDialog?.label}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            {qrDialog && (
              <QRCodeSVG
                id="qr-print-target"
                value={getQrUrl(qrDialog)}
                size={220}
                level="H"
                includeMargin
              />
            )}
            <p className="text-xs text-muted-foreground">Escaneie para acessar o cardápio</p>
            <Button onClick={handlePrintQr} className="bg-[#661f71] hover:bg-[#4c1554]">
              <Printer className="h-4 w-4 mr-2" /> Imprimir QR Code
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>Criar {viewType === "mesa" ? "mesas" : "comandas"}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <label className="text-sm font-medium">Quantidade</label>
            <Input
              type="number"
              min={1}
              max={50}
              value={createCount}
              onChange={e => setCreateCount(Math.max(1, Math.min(50, Number(e.target.value))))}
            />
            <Button
              onClick={() => createMutation.mutate(createCount)}
              disabled={createMutation.isPending}
              className="bg-[#661f71] hover:bg-[#4c1554]"
            >
              {createMutation.isPending ? "Criando..." : `Criar ${createCount} ${viewType === "mesa" ? "mesa(s)" : "comanda(s)"}`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
