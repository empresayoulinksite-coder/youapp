import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { LogOut, Power, LayoutDashboard, Calendar, Scissors, Ticket, Clock3 } from "lucide-react";
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
import { StoreHoursEditor } from "@/components/StoreHoursEditor";
import { StoreWhatsappEditor } from "@/components/StoreWhatsappEditor";
import { StoreDeliveryEditor } from "@/components/StoreDeliveryEditor";
import { StoreBenefitsEditor } from "@/components/StoreBenefitsEditor";

export const Route = createFileRoute("/painel")({
  component: PainelPage,
});

function PainelPage() {
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [storeId, setStoreId] = useState<string | null>(null);
  const [tab, setTab] = useState("overview");

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/auth" });
  }, [authLoading, user, navigate]);

  const { data: stores = [], isLoading: storesLoading } = useQuery({
    queryKey: ["painel", "stores", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_owners")
        .select("stores(id, name, slot_minutes, whatsapp, is_paused, pickup_enabled)")
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
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview" className="gap-1.5">
              <LayoutDashboard className="h-4 w-4" />
              <span className="hidden sm:inline">Resumo</span>
            </TabsTrigger>
            <TabsTrigger value="bookings" className="gap-1.5">
              <Calendar className="h-4 w-4" />
              <span className="hidden sm:inline">Agenda</span>
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
          </TabsList>

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
        </Tabs>
      </main>
    </div>
  );
}
