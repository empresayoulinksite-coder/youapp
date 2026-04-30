import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { LogOut, Power, LayoutDashboard, Calendar, Scissors, Ticket, Clock3, ArrowLeft, Users, Images, Dumbbell, ListOrdered, ClipboardList } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { OverviewTab } from "@/components/painel/OverviewTab";
import { BookingsTab, type BookingRow, type StoreLite } from "@/components/painel/BookingsTab";
import { ServicesTab } from "@/components/painel/ServicesTab";
import { CouponsTab } from "@/components/painel/CouponsTab";
import { CustomersTab } from "@/components/painel/CustomersTab";
import { StoreHoursEditor } from "@/components/StoreHoursEditor";
import { StoreWhatsappEditor } from "@/components/StoreWhatsappEditor";
import { StoreDeliveryEditor } from "@/components/StoreDeliveryEditor";
import { StoreBenefitsEditor } from "@/components/StoreBenefitsEditor";
import { StoreFeedEditor } from "@/components/StoreFeedEditor";
import { GymTab } from "@/components/painel/GymTab";
import { isGymStore } from "@/lib/gym";


export const Route = createFileRoute("/painel")({
  component: PainelPage,
});

function PainelPage() {
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [storeId, setStoreId] = useState<string | null>(null);
  const [tab, setTab] = useState("overview");
  const [showOrdersManager, setShowOrdersManager] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/auth" });
  }, [authLoading, user, navigate]);

  const { data: stores = [], isLoading: storesLoading } = useQuery({
    queryKey: ["painel", "stores", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_owners")
        .select("stores(id, name, slot_minutes, whatsapp, is_paused, pickup_enabled, store_type, feed_enabled, booking_mode, category)")
        .eq("user_id", user!.id);
      if (error) throw error;
      return ((data ?? [])
        .map((r) => r.stores)
        .filter(Boolean) as unknown as StoreLite[]).sort((a, b) =>
        a.name.localeCompare(b.name),
      );
    },
  });

  useEffect(() => {
    if (!storeId && stores.length) setStoreId(stores[0].id);
  }, [stores, storeId]);

  const currentStore = stores.find((s) => s.id === storeId) ?? null;

  const { data: bookings = [], isLoading: bookingsLoading } = useQuery({
    queryKey: ["painel", "bookings", storeId],
    enabled: !!storeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select(
          "id,status,starts_at,ends_at,total_price,customer_notes,user_id,store_id,service_id,services(name,duration_minutes)",
        )
        .eq("store_id", storeId!)
        .order("starts_at", { ascending: true });
      if (error) throw error;

      const userIds = [...new Set((data ?? []).map((b) => b.user_id))];
      if (userIds.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("user_id, display_name, phone")
          .in("user_id", userIds);
        const map = new Map((profs ?? []).map((p) => [p.user_id, p]));
        return (data ?? []).map((b) => ({
          ...b,
          profiles: map.get(b.user_id) ?? null,
        })) as BookingRow[];
      }
      return (data ?? []) as BookingRow[];
    },
  });

  const togglePause = useMutation({
    mutationFn: async (paused: boolean) => {
      if (!storeId) return;
      const { error } = await supabase
        .from("stores")
        .update({ is_paused: paused })
        .eq("id", storeId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Status da loja atualizado");
      qc.invalidateQueries({ queryKey: ["painel", "stores"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const togglePickup = useMutation({
    mutationFn: async (enabled: boolean) => {
      if (!storeId) return;
      const { error } = await supabase
        .from("stores")
        .update({ pickup_enabled: enabled })
        .eq("id", storeId);
      if (error) throw error;
    },
    onSuccess: (_d, enabled) => {
      toast.success(enabled ? "Retirada no local ativada" : "Retirada no local desativada");
      qc.invalidateQueries({ queryKey: ["painel", "stores"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateBookingMode = useMutation({
    mutationFn: async (mode: "booking" | "quote") => {
      if (!storeId) return;
      const { error } = await supabase
        .from("stores")
        .update({ booking_mode: mode })
        .eq("id", storeId);
      if (error) throw error;
    },
    onSuccess: (_d, mode) => {
      toast.success(
        mode === "quote"
          ? "Modo orçamento ativado — clientes vão direto ao WhatsApp"
          : "Modo agendamento ativado — clientes escolhem data e hora",
      );
      qc.invalidateQueries({ queryKey: ["painel", "stores"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (authLoading || storesLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  if (!user) return null;

  if (!stores.length) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="max-w-sm text-center">
          <h1 className="text-2xl font-bold">Sem painel disponível</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sua conta ({user.email}) ainda não está vinculada a nenhuma loja. Peça ao
            administrador para liberar seu acesso.
          </p>
          <div className="mt-4 flex flex-col gap-2">
            <Link to="/" className="text-sm text-primary underline">
              Voltar para o app
            </Link>
            <button
              onClick={() => signOut().then(() => navigate({ to: "/auth" }))}
              className="text-xs text-muted-foreground underline"
            >
              Sair
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="sticky top-0 z-30 border-b bg-background">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Painel da loja</p>
            <h1 className="truncate text-lg font-bold">{currentStore?.name ?? "—"}</h1>
          </div>
          <div className="flex items-center gap-2">
            {stores.length > 1 && (
              <Select value={storeId ?? ""} onValueChange={setStoreId}>
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {stores.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button variant="outline" size="sm" asChild>
              <Link to="/">
                <ArrowLeft className="h-4 w-4" />
                Voltar ao app
              </Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => signOut().then(() => navigate({ to: "/auth" }))}
            >
              <LogOut className="h-4 w-4" />
              Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-4 px-4 py-6">
        {currentStore && (
          <div className="flex items-center justify-between rounded-lg border bg-card p-4">
            <div>
              <p className="text-sm font-semibold">
                {currentStore.is_paused ? "Loja pausada" : "Recebendo pedidos"}
              </p>
              <p className="text-xs text-muted-foreground">
                Pause para parar de aceitar novos agendamentos.
              </p>
            </div>
            <Button
              variant={currentStore.is_paused ? "default" : "outline"}
              size="sm"
              onClick={() => togglePause.mutate(!currentStore.is_paused)}
              disabled={togglePause.isPending}
            >
              <Power className="h-4 w-4" />
              {currentStore.is_paused ? "Reabrir" : "Pausar"}
            </Button>
          </div>
        )}

        {currentStore && (
          <div className="flex items-center justify-between rounded-lg border bg-card p-4">
            <div>
              <p className="text-sm font-semibold">
                Retirar no local {currentStore.pickup_enabled ? "(ativado)" : "(desativado)"}
              </p>
              <p className="text-xs text-muted-foreground">
                Quando ativado, o cliente pode escolher buscar o pedido na loja.
              </p>
            </div>
            <Button
              variant={currentStore.pickup_enabled ? "outline" : "default"}
              size="sm"
              onClick={() => togglePickup.mutate(!currentStore.pickup_enabled)}
              disabled={togglePickup.isPending}
            >
              {currentStore.pickup_enabled ? "Desativar" : "Ativar"}
            </Button>
          </div>
        )}

        {currentStore?.store_type === "service" && (
          <div className="rounded-lg border bg-card p-4 space-y-3">
            <div>
              <p className="text-sm font-semibold">Como o cliente solicita um serviço?</p>
              <p className="text-xs text-muted-foreground">
                Escolha entre agendamento direto no app ou pedido de orçamento via WhatsApp.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => updateBookingMode.mutate("booking")}
                disabled={updateBookingMode.isPending}
                className={`text-left rounded-lg border p-3 transition-colors ${
                  (currentStore.booking_mode ?? "booking") === "booking"
                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                    : "hover:bg-muted/50"
                }`}
              >
                <p className="text-sm font-semibold">📅 Agendamento direto</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Cliente escolhe data e hora no app. A reserva fica na sua agenda.
                </p>
              </button>
              <button
                type="button"
                onClick={() => updateBookingMode.mutate("quote")}
                disabled={updateBookingMode.isPending || !currentStore.whatsapp}
                className={`text-left rounded-lg border p-3 transition-colors ${
                  currentStore.booking_mode === "quote"
                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                    : "hover:bg-muted/50"
                } ${!currentStore.whatsapp ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                <p className="text-sm font-semibold">💬 Orçamento por WhatsApp</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Cliente revisa o pedido e envia direto para seu WhatsApp.
                </p>
                {!currentStore.whatsapp && (
                  <p className="text-[11px] text-destructive mt-1">
                    Cadastre um WhatsApp abaixo para ativar.
                  </p>
                )}
              </button>
            </div>
          </div>
        )}

        {currentStore && (
          <StoreWhatsappEditor
            storeId={currentStore.id}
            initialWhatsapp={currentStore.whatsapp}
          />
        )}

        {currentStore && currentStore.id && (
          <StoreDeliveryEditor storeId={currentStore.id} />
        )}

        {currentStore && currentStore.id && (
          <StoreBenefitsEditor storeId={currentStore.id} />
        )}

        <Tabs value={tab} onValueChange={setTab}>
          {(() => {
            const isService = currentStore?.store_type === "service";
            const isGym = isGymStore(currentStore?.category);
            const isFoodOrEcom = currentStore?.store_type === "food" || currentStore?.store_type === "ecommerce";
            const cols = 6 + (isService ? 1 : 0) + (isGym ? 1 : 0) + (isFoodOrEcom ? 1 : 0);
            const colsClass: Record<number, string> = { 6: "grid-cols-6", 7: "grid-cols-7", 8: "grid-cols-8", 9: "grid-cols-9" };
            return (
              <TabsList className={`grid w-full ${colsClass[cols] ?? "grid-cols-6"}`}>
                {isFoodOrEcom && (
                  <TabsTrigger value="orders" className="gap-1.5">
                    <ListOrdered className="h-4 w-4" />
                    <span className="hidden sm:inline">Pedidos</span>
                  </TabsTrigger>
                )}
                <TabsTrigger value="overview" className="gap-1.5">
                  <LayoutDashboard className="h-4 w-4" />
                  <span className="hidden sm:inline">Resumo</span>
                </TabsTrigger>
                <TabsTrigger value="bookings" className="gap-1.5">
                  <Calendar className="h-4 w-4" />
                  <span className="hidden sm:inline">Agenda</span>
                </TabsTrigger>
                <TabsTrigger value="customers" className="gap-1.5">
                  <Users className="h-4 w-4" />
                  <span className="hidden sm:inline">Clientes</span>
                </TabsTrigger>
                <TabsTrigger value="services" className="gap-1.5">
                  <Scissors className="h-4 w-4" />
                  <span className="hidden sm:inline">Serviços</span>
                </TabsTrigger>
                <TabsTrigger value="coupons" className="gap-1.5">
                  <Ticket className="h-4 w-4" />
                  <span className="hidden sm:inline">Cupons</span>
                </TabsTrigger>
                <TabsTrigger value="hours" className="gap-1.5">
                  <Clock3 className="h-4 w-4" />
                  <span className="hidden sm:inline">Horários</span>
                </TabsTrigger>
                {isService && (
                  <TabsTrigger value="feed" className="gap-1.5">
                    <Images className="h-4 w-4" />
                    <span className="hidden sm:inline">Feed</span>
                  </TabsTrigger>
                )}
                {isGym && (
                  <TabsTrigger value="gym" className="gap-1.5">
                    <Dumbbell className="h-4 w-4" />
                    <span className="hidden sm:inline">Academia</span>
                  </TabsTrigger>
                )}
              </TabsList>
            );
          })()}

          {storeId && (currentStore?.store_type === "food" || currentStore?.store_type === "ecommerce") && (
            <TabsContent value="orders" className="mt-4">
              <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed bg-card p-10 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                  <ClipboardList className="h-7 w-7 text-primary" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-lg font-semibold">Gestor de Pedidos</h3>
                  <p className="text-sm text-muted-foreground">
                    Acompanhe e gerencie os pedidos da sua loja em tempo real.
                  </p>
                </div>
                <Button asChild>
                  <a
                    href={`/pedidos-loja/${storeId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ClipboardList className="h-4 w-4" />
                    Abrir Gestor de Pedidos
                  </a>
                </Button>
              </div>
            </TabsContent>
          )}

          <TabsContent value="overview" className="mt-4">
            {bookingsLoading ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Carregando...
              </p>
            ) : (
              <OverviewTab bookings={bookings} />
            )}
          </TabsContent>

          <TabsContent value="bookings" className="mt-4">
            {currentStore && (
              <BookingsTab
                store={currentStore}
                bookings={bookings}
                loading={bookingsLoading}
              />
            )}
          </TabsContent>

          <TabsContent value="customers" className="mt-4">
            {storeId && <CustomersTab storeId={storeId} bookings={bookings} />}
          </TabsContent>

          <TabsContent value="services" className="mt-4">
            {storeId && <ServicesTab storeId={storeId} />}
          </TabsContent>

          <TabsContent value="coupons" className="mt-4">
            {storeId && <CouponsTab storeId={storeId} />}
          </TabsContent>

          <TabsContent value="hours" className="mt-4">
            {storeId && (
              <div className="rounded-lg border bg-card p-4">
                <StoreHoursEditor storeId={storeId} />
              </div>
            )}
          </TabsContent>

          {currentStore?.store_type === "service" && storeId && (
            <TabsContent value="feed" className="mt-4">
              <StoreFeedEditor
                storeId={storeId}
                feedEnabled={!!currentStore.feed_enabled}
                onToggleEnabled={async (v) => {
                  const { error } = await supabase
                    .from("stores")
                    .update({ feed_enabled: v })
                    .eq("id", storeId);
                  if (error) toast.error(error.message);
                  else {
                    toast.success(v ? "Feed ativado" : "Feed desativado");
                    qc.invalidateQueries({ queryKey: ["painel", "stores"] });
                  }
                }}
              />
            </TabsContent>
          )}

          {isGymStore(currentStore?.category) && storeId && (
            <TabsContent value="gym" className="mt-4">
              <GymTab storeId={storeId} />
            </TabsContent>
          )}
        </Tabs>
      </main>
    </div>
  );
}
