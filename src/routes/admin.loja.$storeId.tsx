import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ExternalLink,
  Settings,
  Clock3,
  Phone,
  MapPin,
  Truck,
  ShieldCheck,
  Images,
  Film,
  BookImage,
  UtensilsCrossed,
  Pizza as PizzaIcon,
  Briefcase,
  CalendarDays,
  Ticket,
  Dumbbell,
  ListOrdered,
  Maximize2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { OrdersManager } from "@/components/painel/OrdersManager";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { StoreHoursEditor } from "@/components/StoreHoursEditor";
import { StoreWhatsappEditor } from "@/components/StoreWhatsappEditor";
import { StoreDeliveryEditor } from "@/components/StoreDeliveryEditor";
import { StoreBenefitsEditor } from "@/components/StoreBenefitsEditor";
import { StoreReelsEditor } from "@/components/StoreReelsEditor";
import { StoreFeedEditor } from "@/components/StoreFeedEditor";
import { GymTab } from "@/components/painel/GymTab";
import { isGymStore } from "@/lib/gym";
import { AdminProductsEmbedded } from "./admin.produtos";
import { AdminPizzasEmbedded } from "./admin.pizzas";
import { AdminServicesEmbedded } from "./admin.servicos";
import { AdminBookingsEmbedded } from "./admin.agendamentos";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/admin/loja/$storeId")({
  component: AdminStoreManagePage,
  errorComponent: ({ error }) => (
    <div className="p-6">
      <p className="text-sm text-destructive">Erro: {error.message}</p>
      <Link to="/admin" className="text-sm text-primary underline">
        Voltar
      </Link>
    </div>
  ),
  notFoundComponent: () => (
    <div className="p-6">
      <p className="text-sm">Loja não encontrada.</p>
      <Link to="/admin" className="text-sm text-primary underline">
        Voltar
      </Link>
    </div>
  ),
});

type StoreFull = {
  id: string;
  name: string;
  slug: string;
  category: string;
  store_type: string;
  emoji: string;
  image_url: string | null;
  whatsapp: string | null;
  is_pizzeria: boolean;
  reels_enabled: boolean;
  feed_enabled: boolean;
};

function AdminStoreManagePage() {
  const { storeId } = Route.useParams();
  const router = useRouter();
  const qc = useQueryClient();

  const { data: store, isLoading } = useQuery({
    queryKey: ["admin-manage-store", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stores")
        .select(
          "id, name, slug, category, store_type, emoji, image_url, whatsapp, is_pizzeria, reels_enabled, feed_enabled",
        )
        .eq("id", storeId)
        .maybeSingle();
      if (error) throw error;
      return data as StoreFull | null;
    },
  });

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-sm text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  if (!store) {
    return (
      <div className="p-6">
        <p className="text-sm">Loja não encontrada.</p>
        <Link to="/admin" className="text-sm text-primary underline">
          Voltar
        </Link>
      </div>
    );
  }

  const isFood = store.store_type === "food";
  const isService = store.store_type === "service";
  const isEcom = store.store_type === "ecommerce";
  const isGym = isGymStore(store.category);

  return (
    <div>
      <header className="mb-4 flex items-center gap-3">
        <button
          onClick={() => router.history.back()}
          className="rounded-full p-2 hover:bg-muted"
          aria-label="Voltar"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        {store.image_url ? (
          <img
            src={store.image_url}
            alt={store.name}
            className="h-12 w-12 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-xl">
            {store.emoji}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-bold">{store.name}</h1>
          <p className="truncate text-xs text-muted-foreground">
            {store.category} · /{store.slug}
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/loja/$slug" params={{ slug: store.slug }}>
            <ExternalLink className="h-3.5 w-3.5" />
            Ver loja
          </Link>
        </Button>
      </header>

      <Tabs defaultValue="info">
        <div className="overflow-x-auto">
          <TabsList className="inline-flex w-auto">
            <TabsTrigger value="info" className="gap-1.5">
              <Settings className="h-4 w-4" />
              Informações
            </TabsTrigger>
            <TabsTrigger value="hours" className="gap-1.5">
              <Clock3 className="h-4 w-4" />
              Horários
            </TabsTrigger>
            {(isFood || isEcom) && (
              <TabsTrigger value="orders" className="gap-1.5">
                <ListOrdered className="h-4 w-4" />
                Pedidos
              </TabsTrigger>
            )}
            {(isFood || isEcom) && (
              <TabsTrigger value="catalog" className="gap-1.5">
                <UtensilsCrossed className="h-4 w-4" />
                {isFood ? "Cardápio" : "Produtos"}
              </TabsTrigger>
            )}
            {isFood && (
              <TabsTrigger value="pizzas" className="gap-1.5">
                <PizzaIcon className="h-4 w-4" />
                Pizzas
              </TabsTrigger>
            )}
            {isService && (
              <TabsTrigger value="services" className="gap-1.5">
                <Briefcase className="h-4 w-4" />
                Serviços
              </TabsTrigger>
            )}
            {isService && (
              <TabsTrigger value="bookings" className="gap-1.5">
                <CalendarDays className="h-4 w-4" />
                Agendamentos
              </TabsTrigger>
            )}
            <TabsTrigger value="feed" className="gap-1.5">
              <BookImage className="h-4 w-4" />
              Feed
            </TabsTrigger>
            <TabsTrigger value="youflow" className="gap-1.5">
              <Film className="h-4 w-4" />
              YouFlow
            </TabsTrigger>
            <TabsTrigger value="stories" className="gap-1.5">
              <Images className="h-4 w-4" />
              Stories
            </TabsTrigger>
            <TabsTrigger value="coupons" className="gap-1.5">
              <Ticket className="h-4 w-4" />
              Cupons
            </TabsTrigger>
            {isGym && (
              <TabsTrigger value="gym" className="gap-1.5">
                <Dumbbell className="h-4 w-4" />
                Academia
              </TabsTrigger>
            )}
          </TabsList>
        </div>

        {/* Info: WhatsApp, Localização, Entrega, Benefícios */}
        <TabsContent value="info" className="mt-4 space-y-4">
          <Section title="WhatsApp" icon={<Phone className="h-4 w-4" />}>
            <StoreWhatsappEditor storeId={store.id} initialWhatsapp={store.whatsapp} />
          </Section>

          <Section title="Endereço e localização" icon={<MapPin className="h-4 w-4" />}>
            <p className="text-sm text-muted-foreground">
              Edite o endereço, CEP e o pino no mapa pelo botão <strong>editar (lápis)</strong> no card da loja, na lista de Lojas.
            </p>
            <Button asChild variant="outline" size="sm" className="mt-3">
              <Link to="/admin">
                <ArrowLeft className="h-3.5 w-3.5" />
                Ir para a lista de lojas
              </Link>
            </Button>
          </Section>

          {!isService && (
            <>
              <Section title="Entrega" icon={<Truck className="h-4 w-4" />}>
                <StoreDeliveryEditor storeId={store.id} />
              </Section>

              <Section title="Benefícios" icon={<ShieldCheck className="h-4 w-4" />}>
                <StoreBenefitsEditor storeId={store.id} />
              </Section>
            </>
          )}
        </TabsContent>

        <TabsContent value="hours" className="mt-4">
          <Section title="Horários de funcionamento" icon={<Clock3 className="h-4 w-4" />}>
            <StoreHoursEditor storeId={store.id} />
          </Section>
        </TabsContent>

        {(isFood || isEcom) && (
          <TabsContent value="orders" className="mt-4">
            <Section
              title="Gestor de pedidos"
              icon={<ListOrdered className="h-4 w-4" />}
            >
              <div className="mb-3 flex justify-end">
                <Button asChild variant="outline" size="sm">
                  <Link to="/pedidos-loja/$storeId" params={{ storeId: store.id }}>
                    <Maximize2 className="h-3.5 w-3.5" />
                    Abrir em tela cheia
                  </Link>
                </Button>
              </div>
              <OrdersManager storeId={store.id} />
            </Section>
          </TabsContent>
        )}

        {(isFood || isEcom) && (
          <TabsContent value="catalog" className="mt-4">
            <Section
              title={isFood ? "Cardápio" : "Produtos"}
              icon={<UtensilsCrossed className="h-4 w-4" />}
            >
              <AdminProductsEmbedded storeId={store.id} />
            </Section>
          </TabsContent>
        )}

        {isFood && (
          <TabsContent value="pizzas" className="mt-4">
            <Section title="Pizzas" icon={<PizzaIcon className="h-4 w-4" />}>
              <AdminPizzasEmbedded storeId={store.id} />
            </Section>
          </TabsContent>
        )}

        {isService && (
          <TabsContent value="services" className="mt-4">
            <Section title="Serviços" icon={<Briefcase className="h-4 w-4" />}>
              <AdminServicesEmbedded storeId={store.id} />
            </Section>
          </TabsContent>
        )}

        {isService && (
          <TabsContent value="bookings" className="mt-4">
            <Section
              title="Agendamentos"
              icon={<CalendarDays className="h-4 w-4" />}
            >
              <AdminBookingsEmbedded storeId={store.id} />
            </Section>
          </TabsContent>
        )}

        <TabsContent value="feed" className="mt-4">
          <Section title="Feed da loja" icon={<BookImage className="h-4 w-4" />}>
            <StoreFeedEditor
              storeId={store.id}
              feedEnabled={!!store.feed_enabled}
              onToggleEnabled={async (v) => {
                const { error } = await supabase
                  .from("stores")
                  .update({ feed_enabled: v })
                  .eq("id", store.id);
                if (error) toast.error(error.message);
                else {
                  toast.success(v ? "Feed ativado" : "Feed desativado");
                  qc.invalidateQueries({ queryKey: ["admin-manage-store", store.id] });
                }
              }}
            />
          </Section>
        </TabsContent>

        <TabsContent value="youflow" className="mt-4">
          <Section title="YouFlow (vídeos curtos)" icon={<Film className="h-4 w-4" />}>
            <StoreReelsEditor
              storeId={store.id}
              reelsEnabled={!!store.reels_enabled}
              onToggleEnabled={async (v) => {
                const { error } = await supabase
                  .from("stores")
                  .update({ reels_enabled: v })
                  .eq("id", store.id);
                if (error) toast.error(error.message);
                else {
                  toast.success(v ? "YouFlow ativado" : "YouFlow desativado");
                  qc.invalidateQueries({ queryKey: ["admin-manage-store", store.id] });
                }
              }}
            />
          </Section>
        </TabsContent>

        <TabsContent value="stories" className="mt-4">
          <RedirectCard
            title="Stories"
            description="Crie e gerencie os stories vinculados a esta loja."
            to="/admin/stories"
            search={{ storeId: store.id }}
            icon={<Images className="h-5 w-5" />}
          />
        </TabsContent>

        <TabsContent value="coupons" className="mt-4">
          <RedirectCard
            title="Cupons"
            description="Crie cupons gerais ou específicos desta loja."
            to="/admin/cupons"
            search={{ storeId: store.id }}
            icon={<Ticket className="h-5 w-5" />}
          />
        </TabsContent>

        {isGym && (
          <TabsContent value="gym" className="mt-4 space-y-3">
            <Section title="Academia" icon={<Dumbbell className="h-4 w-4" />}>
              <GymTab storeId={store.id} />
            </Section>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-center gap-2 border-b px-4 py-2.5">
        {icon}
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

type RedirectSearch = { storeId: string };

function RedirectCard({
  title,
  description,
  to,
  search,
  icon,
}: {
  title: string;
  description: string;
  to: "/admin/produtos" | "/admin/servicos" | "/admin/pizzas" | "/admin/agendamentos" | "/admin/stories" | "/admin/cupons";
  search: RedirectSearch;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border bg-card p-6 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        {icon}
      </div>
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{description}</p>
      <Button asChild className="mt-4">
        <Link to={to} search={search as never}>
          Abrir editor
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </Button>
    </div>
  );
}
