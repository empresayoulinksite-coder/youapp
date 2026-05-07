import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { 
  ArrowLeft, 
  ExternalLink, 
  Search, 
  MonitorSmartphone, 
  KanbanSquare, 
  PenSquare, 
  Armchair, 
  CalendarDays, 
  MenuSquare, 
  Globe, 
  Truck,
  UserPlus,
  FileText,
  MapPin,
  Menu,
  X,
  ChevronDown,
  ChevronUp,
  BarChart3,
  PieChart
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OrdersManager } from "@/components/painel/OrdersManager";
import { PDVManager } from "@/components/painel/PDVManager";
import { CashRegisterDialog } from "@/components/painel/CashRegisterDialog";
import { CashTransactionDialog } from "@/components/painel/CashTransactionDialog";
import { CashSummaryDialog } from "@/components/painel/CashSummaryDialog";
import { CashCloseConfirmDialog } from "@/components/painel/CashCloseConfirmDialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { CashReportTab } from "@/components/painel/CashReportTab";
import { GeneralReportTab } from "@/components/painel/GeneralReportTab";

export const Route = createFileRoute("/pedidos-loja/$storeId")({
  component: PedidosLojaPage,
  beforeLoad: async ({ params }) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw redirect({ to: "/auth" });
    }
    // Permission check via RPC: can_manage_store_orders
    const { data, error } = await supabase.rpc("can_manage_store_orders", {
      _user_id: session.user.id,
      _store_id: params.storeId,
    });
    if (error || !data) {
      throw redirect({ to: "/painel" });
    }
  },
  errorComponent: ({ error }) => (
    <div className="p-6">
      <p className="text-sm text-destructive">Erro: {error.message}</p>
      <Link to="/painel" className="text-sm text-primary underline">
        Voltar
      </Link>
    </div>
  ),
});

function PedidosLojaPage() {
  const { storeId } = Route.useParams();
  const qc = useQueryClient();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("Meus pedidos");
  const [editingOrder, setEditingOrder] = useState<any>(null);
  
  // Cash Register States
  const [cashDialogOpen, setCashDialogOpen] = useState(false);
  const [cashDialogAction, setCashDialogAction] = useState<"open" | "close">("open");
  const [cashMenuOpen, setCashMenuOpen] = useState(false);

  const [transactionDialogOpen, setTransactionDialogOpen] = useState(false);
  const [transactionType, setTransactionType] = useState<"deposit" | "withdrawal">("deposit");
  const [summaryDialogOpen, setSummaryDialogOpen] = useState(false);
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);
  const [entregasOpen, setEntregasOpen] = useState(false);
  const [relatoriosOpen, setRelatoriosOpen] = useState(false);

  const { data: store } = useQuery({
    queryKey: ["pedidos-loja-store", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stores")
        .select("id, name, slug, image_url, emoji")
        .eq("id", storeId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: cashRegister, refetch: refetchCashRegister } = useQuery({
    queryKey: ["cash-register", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cash_registers")
        .select("*")
        .eq("store_id", storeId)
        .order("opened_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) {
        if (error.code === '42P01') return null; // Table does not exist yet
        throw error;
      }
      return data;
    }
  });

  const isCashOpen = cashRegister?.status === "open";

  const getElapsedTime = (dateString?: string) => {
    if (!dateString) return "";
    const start = new Date(dateString).getTime();
    const now = new Date().getTime();
    const diff = now - start;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h${minutes}min`;
  };

  const handleCashAction = async (amount: number) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      if (cashDialogAction === "open") {
        const { error } = await supabase.from("cash_registers").insert({
          store_id: storeId,
          opened_by: user.id,
          opening_balance: amount,
          status: "open"
        });
        if (error) throw error;
        toast.success("Caixa aberto com sucesso!");
      } else {
        const { error } = await supabase.from("cash_registers").update({
          closed_by: user.id,
          closing_balance: amount,
          closed_at: new Date().toISOString(),
          status: "closed"
        }).eq("id", cashRegister!.id);
        if (error) throw error;
        toast.success("Caixa fechado com sucesso!");
      }
      setCashDialogOpen(false);
      qc.invalidateQueries({ queryKey: ["cash-register", storeId] });
    } catch (err: any) {
      toast.error("Erro ao realizar operação: " + err.message);
    }
  };

  const handleCashTransaction = async (amount: number, reason: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      if (!cashRegister) throw new Error("Caixa não está aberto");

      const { error } = await supabase.from("cash_transactions").insert({
        cash_register_id: cashRegister.id,
        user_id: user.id,
        type: transactionType,
        amount,
        reason
      });

      if (error) throw error;
      
      toast.success(transactionType === "deposit" ? "Suprimento registrado com sucesso!" : "Retirada registrada com sucesso!");
      setTransactionDialogOpen(false);
    } catch (err: any) {
      toast.error("Erro ao registrar transação: " + err.message);
    }
  };

  const handleNavClick = (label: string) => {
    if (["Meus pedidos", "Pedidos balcão (PDV)", "Relatório Geral", "Relatório Caixa"].includes(label)) {
      setActiveTab(label);
      if (label === "Meus pedidos" && editingOrder) {
        setEditingOrder(null);
      }
    } else {
      toast.info(`Módulo "${label}" em desenvolvimento.`);
    }
  };

  const NAV_ITEMS = [
    { label: "Meus pedidos", icon: KanbanSquare, badge: 0 },
    { label: "Pedidos balcão (PDV)", icon: PenSquare },
    { label: "Pedidos salão", icon: Armchair, badge: "+" },
    { label: "Gestor de cardápio", icon: MenuSquare, isLink: true, to: `/admin/loja/${storeId}` },
    
  ];

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
      {/* Sidebar Mobile Toggle */}
      <button 
        className="md:hidden fixed bottom-4 right-4 z-50 rounded-full bg-[#4c1554] p-3 text-white shadow-lg"
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
      >
        {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
      </button>

      {/* Sidebar - Youlink Style */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-40 w-[260px] flex-col bg-[#4c1554] text-white transition-transform duration-300 ease-in-out md:relative md:flex md:translate-x-0",
        mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        {/* Logo Area */}
        <div className="flex h-16 items-center border-b border-white/10 px-4 bg-[#4c1554]">
          <div className="flex items-center gap-2 font-bold text-lg">
            {store?.image_url ? (
              <img src={store.image_url} alt="Logo" className="h-8 w-8 rounded object-cover" />
            ) : (
              <div className="h-8 w-8 rounded flex items-center justify-center bg-white/10 text-xl">
                {store?.emoji ?? "🚀"}
              </div>
            )}
            <span className="truncate">{store?.name ?? "Carregando..."}</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          {/* Caixa Status */}
          <div className="p-4 border-b border-white/10 relative">
            {isCashOpen ? (
              <div className="flex flex-col gap-1 relative">
                <div 
                  className="flex items-center gap-3 rounded-lg bg-[#360e3c] p-3 hover:bg-[#280a2c] cursor-pointer transition-colors border border-white/5" 
                  onClick={() => setCashMenuOpen(!cashMenuOpen)}
                >
                  <MonitorSmartphone className="h-5 w-5 opacity-90 text-white" />
                  <div className="flex flex-1 items-center justify-between">
                    <span className="font-semibold text-sm text-white">Caixa</span>
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-[#10b981] px-2 py-0.5 text-xs font-bold text-white shadow-sm">Aberto</span>
                      {cashMenuOpen ? <ChevronUp className="h-4 w-4 text-white/70" /> : <ChevronDown className="h-4 w-4 text-white/70" />}
                    </div>
                  </div>
                </div>
                
                {/* Menu Dropdown do Caixa */}
                {cashMenuOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1 z-10 bg-[#360e3c] border border-white/10 rounded-lg shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2">
                    <div className="px-4 py-3 bg-[#280a2c] border-b border-white/5">
                      <span className="text-xs text-white/70 font-medium">Caixa aberto há: {getElapsedTime(cashRegister?.opened_at)}</span>
                    </div>
                    <div className="flex flex-col">
                      <button 
                        onClick={() => {
                          setCashMenuOpen(false);
                          setSummaryDialogOpen(true);
                        }}
                        className="text-left px-4 py-3 text-sm text-white hover:bg-white/10 border-b border-white/5 transition-colors"
                      >
                        Resumo parcial
                      </button>
                      <button 
                        onClick={() => {
                          setCashMenuOpen(false);
                          setTransactionType("withdrawal");
                          setTransactionDialogOpen(true);
                        }}
                        className="text-left px-4 py-3 text-sm text-white hover:bg-white/10 border-b border-white/5 transition-colors"
                      >
                        Informar retirada
                      </button>
                      <button 
                        onClick={() => {
                          setCashMenuOpen(false);
                          setTransactionType("deposit");
                          setTransactionDialogOpen(true);
                        }}
                        className="text-left px-4 py-3 text-sm text-white hover:bg-white/10 border-b border-white/5 transition-colors"
                      >
                        Informar suprimento
                      </button>
                      <button 
                        onClick={() => {
                          setCashMenuOpen(false);
                          setCloseConfirmOpen(true);
                        }}
                        className="text-left px-4 py-3 text-sm text-white hover:bg-white/10 transition-colors font-medium"
                      >
                        Fechar caixa
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-3 rounded-lg bg-[#360e3c] p-2 hover:bg-[#280a2c] transition-colors text-white">
                <div className="bg-white/10 p-2 rounded-full">
                  <MonitorSmartphone className="h-4 w-4 text-white" />
                </div>
                <div className="flex flex-1 items-center justify-between">
                  <span className="font-bold text-sm">Caixa</span>
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-white/80 text-slate-800 px-2 py-0.5 text-xs font-medium">Fechado</span>
                    <button 
                      className="text-sm font-bold hover:underline"
                      onClick={() => { setCashDialogAction("open"); setCashDialogOpen(true); }}
                    >
                      Abrir
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Search */}
          <div className="px-4 py-3 border-b border-white/10">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/50" />
              <input 
                placeholder="Procurando por algo?"
                className="w-full rounded bg-transparent pl-9 pr-3 py-2 text-sm text-white placeholder:text-white/50 focus:outline-none focus:ring-1 focus:ring-white/30"
              />
            </div>
          </div>

          {/* Nav Area */}
          <div className="p-3">
            <div className="px-3 pb-2 pt-1 text-xs text-white/50">Seu dia a dia</div>
            <nav className="space-y-1">
              {NAV_ITEMS.map((item, idx) => {
                const Icon = item.icon;
                const isActive = activeTab === item.label;
                
                const content = (
                  <>
                    <div className="flex items-center gap-3">
                      <Icon className={cn("h-4 w-4", isActive ? "opacity-100" : "opacity-80")} />
                      <span className="text-sm font-medium">{item.label}</span>
                       {(item as any).isPremium && (
                        <span className="ml-1 flex h-4 w-4 items-center justify-center rounded-full bg-orange-400 text-[10px]">👑</span>
                      )}
                    </div>
                    {item.badge !== undefined && (
                      <span className="rounded bg-black/30 px-1.5 py-0.5 text-xs font-bold">
                        {item.badge}
                      </span>
                    )}
                    {item.isLink && (
                      <span className="text-white/50 text-xs">{">"}</span>
                    )}
                  </>
                );

                const baseClass = cn(
                  "flex items-center justify-between rounded-lg px-3 py-2.5 transition-colors group cursor-pointer",
                  isActive ? "bg-white/20 text-white shadow-sm" : "hover:bg-white/10 text-white/90"
                );

                if (item.isLink && item.to) {
                  return (
                    <Link key={idx} to={item.to} className={baseClass}>
                      {content}
                    </Link>
                  );
                }

                return (
                  <div key={idx} className={baseClass} onClick={() => handleNavClick(item.label)}>
                    {content}
                  </div>
                );
              })}
            </nav>

            {/* Entregas - collapsible purple section */}
            <div className="mt-1 px-0">
              <button
                onClick={() => setEntregasOpen((v) => !v)}
                className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 transition-colors hover:bg-white/10 text-white/90 cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <Truck className="h-4 w-4 opacity-80" />
                  <span className="text-sm font-medium">Entregas</span>
                </div>
                <ChevronDown className={cn("h-4 w-4 text-white/50 transition-transform", entregasOpen && "rotate-180")} />
              </button>
              {entregasOpen && (
                <div className="ml-4 mt-0.5 space-y-0.5 border-l-2 border-purple-400/40 pl-3">
                  {[
                    { to: `/admin/entregas/cadastro`, label: "Cadastro entregadores", icon: UserPlus },
                    { to: `/admin/entregas/relatorio`, label: "Relatório entregadores", icon: FileText },
                    { to: `/admin/entregas/areas`, label: "Áreas de entrega", icon: MapPin },
                  ].map((sub) => {
                    const Icon = sub.icon;
                    return (
                      <Link
                        key={sub.to}
                        to={sub.to}
                        className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-white/80 hover:bg-white/10 transition-colors"
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {sub.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Relatórios - collapsible section */}
            <div className="mt-1 px-0">
              <button
                onClick={() => setRelatoriosOpen((v) => !v)}
                className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 transition-colors hover:bg-white/10 text-white/90 cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <BarChart3 className="h-4 w-4 opacity-80" />
                  <span className="text-sm font-medium">Relatórios</span>
                </div>
                <ChevronDown className={cn("h-4 w-4 text-white/50 transition-transform", relatoriosOpen && "rotate-180")} />
              </button>
              {relatoriosOpen && (
                <div className="ml-4 mt-0.5 space-y-0.5 border-l-2 border-purple-400/40 pl-3">
                  {[
                    { label: "Geral", icon: PieChart },
                    { label: "Caixa", icon: MonitorSmartphone },
                  ].map((sub) => {
                    const Icon = sub.icon;
                    const tabName = `Relatório ${sub.label}`;
                    const isActive = activeTab === tabName;
                    return (
                      <div
                        key={sub.label}
                        onClick={() => handleNavClick(tabName)}
                        className={cn(
                          "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm cursor-pointer transition-colors",
                          isActive ? "bg-white/20 text-white font-semibold" : "text-white/80 hover:bg-white/10"
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {sub.label}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col bg-[#f5f6f8]">
        <header className="flex shrink-0 items-center gap-3 border-b bg-white px-4 py-3 shadow-sm z-10">
          <Button asChild variant="ghost" size="icon" className="h-8 w-8">
            <Link to="/admin/loja/$storeId" params={{ storeId }}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          {store?.image_url ? (
            <img src={store.image_url} alt={store.name} className="h-8 w-8 rounded-full object-cover" />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
              {store?.emoji ?? "🏪"}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-bold text-slate-800">Gestor de Pedidos</h1>
            <p className="truncate text-xs text-muted-foreground">{store?.name}</p>
          </div>
          {store?.slug && (
            <Button asChild variant="outline" size="sm" className="hidden sm:flex">
              <Link to="/loja/$slug" params={{ slug: store.slug }}>
                <ExternalLink className="h-3.5 w-3.5 mr-1" />
                Ver loja
              </Link>
            </Button>
          )}
        </header>
        
        <div className="min-h-0 flex-1 overflow-hidden p-3 md:p-4">
          {activeTab === "Meus pedidos" ? (
            <OrdersManager 
              storeId={storeId} 
              fullScreen 
              onEditOrder={(order, customer) => {
                setEditingOrder({ ...order, customer_profile: customer });
                setActiveTab("Pedidos balcão (PDV)");
              }}
            />
          ) : activeTab === "Pedidos balcão (PDV)" ? (
            <PDVManager 
              storeId={storeId} 
              editingOrder={editingOrder} 
              onClearEdit={() => {
                setEditingOrder(null);
                setActiveTab("Meus pedidos");
              }} 
            />
          ) : activeTab === "Relatório Caixa" ? (
            <CashReportTab storeId={storeId} />
          ) : activeTab === "Relatório Geral" ? (
            <GeneralReportTab storeId={storeId} />
          ) : (
            <div className="flex h-full items-center justify-center rounded-lg border bg-white p-8 text-center shadow-sm">
              <div>
                <h2 className="text-lg font-bold text-slate-800">Módulo {activeTab}</h2>
                <p className="mt-2 text-sm text-muted-foreground">Esta área está sendo desenvolvida e chegará em breve!</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <CashRegisterDialog
        open={cashDialogOpen}
        isOpening={cashDialogAction === "open"}
        onClose={() => setCashDialogOpen(false)}
        onConfirm={handleCashAction}
      />

      <CashTransactionDialog
        open={transactionDialogOpen}
        type={transactionType}
        onClose={() => setTransactionDialogOpen(false)}
        onConfirm={handleCashTransaction}
      />

      <CashSummaryDialog
        open={summaryDialogOpen}
        onClose={() => setSummaryDialogOpen(false)}
        cashRegisterId={cashRegister?.id}
        storeId={storeId}
        openingBalance={Number(cashRegister?.opening_balance || 0)}
        openedAt={cashRegister?.opened_at ?? new Date().toISOString()}
      />

      {cashRegister && (
        <CashCloseConfirmDialog
          open={closeConfirmOpen}
          onClose={() => setCloseConfirmOpen(false)}
          onConfirm={async (amount) => {
            try {
              const { data: { user } } = await supabase.auth.getUser();
              if (!user) throw new Error("Usuário não autenticado");
              const { error } = await supabase.from("cash_registers").update({
                closed_by: user.id,
                closing_balance: amount,
                closed_at: new Date().toISOString(),
                status: "closed"
              }).eq("id", cashRegister.id);
              if (error) throw error;
              toast.success("Caixa fechado com sucesso!");
              setCloseConfirmOpen(false);
              qc.invalidateQueries({ queryKey: ["cash-register", storeId] });
            } catch (err: any) {
              toast.error("Erro ao fechar caixa: " + err.message);
            }
          }}
          cashRegisterId={cashRegister.id}
          storeId={storeId}
          openingBalance={Number(cashRegister.opening_balance || 0)}
          openedAt={cashRegister.opened_at ?? new Date().toISOString()}
        />
      )}
    </div>
  );
}
