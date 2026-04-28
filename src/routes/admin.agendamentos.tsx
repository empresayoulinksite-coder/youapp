import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, X, CheckCircle2, Clock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";

export const Route = createFileRoute("/admin/agendamentos")({
  validateSearch: (search: Record<string, unknown>): { storeId?: string } => ({
    storeId: typeof search.storeId === "string" ? search.storeId : undefined,
  }),
  component: AdminBookingsRoute,
});

function AdminBookingsRoute() {
  const { storeId: presetStoreId } = Route.useSearch();
  return <AdminBookings presetStoreId={presetStoreId} />;
}

export function AdminBookingsEmbedded({ storeId }: { storeId: string }) {
  return <AdminBookings presetStoreId={storeId} embedded />;
}

type BookingRow = {
  id: string;
  status: "pending" | "confirmed" | "cancelled" | "completed";
  starts_at: string;
  ends_at: string;
  total_price: number;
  customer_notes: string | null;
  user_id: string;
  store_id: string;
  service_id: string;
  services: { name: string; duration_minutes: number } | null;
  stores: { name: string } | null;
  profiles?: { display_name: string | null; phone: string | null } | null;
};

const STATUS_LABEL: Record<BookingRow["status"], string> = {
  pending: "Pendente",
  confirmed: "Confirmado",
  cancelled: "Cancelado",
  completed: "Concluído",
};

const STATUS_VARIANT: Record<
  BookingRow["status"],
  "default" | "secondary" | "destructive" | "outline"
> = {
  pending: "outline",
  confirmed: "default",
  completed: "secondary",
  cancelled: "destructive",
};

function AdminBookings({ presetStoreId, embedded = false }: { presetStoreId?: string; embedded?: boolean }) {
  const qc = useQueryClient();
  const [storeFilter, setStoreFilter] = useState<string>(presetStoreId ?? "all");
  const [tab, setTab] = useState<string>("pending");

  const { data: stores = [] } = useQuery({
    queryKey: ["admin", "service-stores"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stores")
        .select("id, name")
        .eq("store_type", "service")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ["admin", "bookings", storeFilter],
    queryFn: async () => {
      let q = supabase
        .from("bookings")
        .select(
          "id,status,starts_at,ends_at,total_price,customer_notes,user_id,store_id,service_id,services(name,duration_minutes),stores(name)",
        )
        .order("starts_at", { ascending: false });
      if (storeFilter !== "all") q = q.eq("store_id", storeFilter);
      const { data, error } = await q;
      if (error) throw error;

      // Buscar profiles dos clientes
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

  const updateStatus = useMutation({
    mutationFn: async ({
      id,
      status,
    }: {
      id: string;
      status: BookingRow["status"];
    }) => {
      const { error } = await supabase
        .from("bookings")
        .update({ status })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      toast.success(`Agendamento ${STATUS_LABEL[vars.status].toLowerCase()}`);
      qc.invalidateQueries({ queryKey: ["admin", "bookings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = bookings.filter((b) =>
    tab === "all" ? true : b.status === tab,
  );

  const counts = {
    pending: bookings.filter((b) => b.status === "pending").length,
    confirmed: bookings.filter((b) => b.status === "confirmed").length,
    completed: bookings.filter((b) => b.status === "completed").length,
    cancelled: bookings.filter((b) => b.status === "cancelled").length,
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Agendamentos</h1>
          <p className="text-sm text-muted-foreground">
            Gerencie os agendamentos das lojas de serviço.
          </p>
        </div>
        <Select value={storeFilter} onValueChange={setStoreFilter}>
          <SelectTrigger className="w-full sm:w-64">
            <SelectValue placeholder="Filtrar por loja" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as lojas</SelectItem>
            {stores.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="pending">
            Pendentes {counts.pending > 0 && `(${counts.pending})`}
          </TabsTrigger>
          <TabsTrigger value="confirmed">
            Confirmados {counts.confirmed > 0 && `(${counts.confirmed})`}
          </TabsTrigger>
          <TabsTrigger value="completed">Concluídos</TabsTrigger>
          <TabsTrigger value="cancelled">Cancelados</TabsTrigger>
          <TabsTrigger value="all">Todos</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          {isLoading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Carregando...
            </p>
          ) : filtered.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              Nenhum agendamento.
            </p>
          ) : (
            <div className="space-y-3">
              {filtered.map((b) => (
                <BookingCard
                  key={b.id}
                  booking={b}
                  onUpdate={(status) =>
                    updateStatus.mutate({ id: b.id, status })
                  }
                  pending={updateStatus.isPending}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function BookingCard({
  booking,
  onUpdate,
  pending,
}: {
  booking: BookingRow;
  onUpdate: (status: BookingRow["status"]) => void;
  pending: boolean;
}) {
  const start = new Date(booking.starts_at);
  const end = new Date(booking.ends_at);
  const dateLabel = start.toLocaleDateString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
  const timeLabel = `${start.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} - ${end.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold">
              {booking.services?.name ?? "Serviço"}
            </h3>
            <Badge variant={STATUS_VARIANT[booking.status]}>
              {STATUS_LABEL[booking.status]}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {booking.stores?.name}
          </p>
          <div className="flex items-center gap-2 text-sm">
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="capitalize">{dateLabel}</span>
            <span className="text-muted-foreground">·</span>
            <span>{timeLabel}</span>
          </div>
          <p className="text-sm">
            <span className="text-muted-foreground">Cliente:</span>{" "}
            {booking.profiles?.display_name ?? "—"}
            {booking.profiles?.phone && (
              <span className="text-muted-foreground">
                {" "}
                · {booking.profiles.phone}
              </span>
            )}
          </p>
          {booking.customer_notes && (
            <p className="text-sm text-muted-foreground">
              Obs: {booking.customer_notes}
            </p>
          )}
          <p className="text-sm font-medium">
            R$ {Number(booking.total_price).toFixed(2).replace(".", ",")}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {booking.status === "pending" && (
            <>
              <Button
                size="sm"
                onClick={() => onUpdate("confirmed")}
                disabled={pending}
              >
                <Check className="h-4 w-4" />
                Confirmar
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => onUpdate("cancelled")}
                disabled={pending}
              >
                <X className="h-4 w-4" />
                Recusar
              </Button>
            </>
          )}
          {booking.status === "confirmed" && (
            <>
              <Button
                size="sm"
                onClick={() => onUpdate("completed")}
                disabled={pending}
              >
                <CheckCircle2 className="h-4 w-4" />
                Concluir
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onUpdate("cancelled")}
                disabled={pending}
              >
                <X className="h-4 w-4" />
                Cancelar
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
