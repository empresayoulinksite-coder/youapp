import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Phone, MessageSquare, Search, Calendar, ShoppingBag, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { BookingRow } from "./BookingsTab";

type OrderRow = {
  id: string;
  user_id: string;
  total: number;
  created_at: string;
  status: string;
};

type ProfileRow = {
  user_id: string;
  display_name: string | null;
  phone: string | null;
  email: string | null;
  avatar_url: string | null;
};

type CustomerAggregate = {
  user_id: string;
  display_name: string;
  phone: string | null;
  email: string | null;
  avatar_url: string | null;
  bookingsCount: number;
  ordersCount: number;
  totalSpent: number;
  lastInteraction: string | null;
};

function brl(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function onlyDigits(s: string | null | undefined) {
  return (s ?? "").replace(/\D/g, "");
}

export function CustomersTab({
  storeId,
  bookings,
}: {
  storeId: string;
  bookings: BookingRow[];
}) {
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"recent" | "spent" | "orders" | "name">("recent");

  const { data: orders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ["painel", "customers-orders", storeId],
    enabled: !!storeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id,user_id,total,created_at,status")
        .eq("store_id", storeId);
      if (error) throw error;
      return (data ?? []) as OrderRow[];
    },
  });

  const userIds = useMemo(() => {
    const set = new Set<string>();
    for (const b of bookings) set.add(b.user_id);
    for (const o of orders) set.add(o.user_id);
    return Array.from(set);
  }, [bookings, orders]);

  const { data: profiles = [], isLoading: profilesLoading } = useQuery({
    queryKey: ["painel", "customers-profiles", storeId, userIds.sort().join(",")],
    enabled: userIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_order_customers_basic", { p_user_ids: userIds });
      if (error) throw error;
      return ((data ?? []) as any[]) as ProfileRow[];
    },
  });

  const customers = useMemo<CustomerAggregate[]>(() => {
    const map = new Map<string, CustomerAggregate>();
    const profileMap = new Map(profiles.map((p) => [p.user_id, p]));

    const ensure = (uid: string): CustomerAggregate => {
      const existing = map.get(uid);
      if (existing) return existing;
      const p = profileMap.get(uid);
      const c: CustomerAggregate = {
        user_id: uid,
        display_name: p?.display_name ?? "Cliente",
        phone: p?.phone ?? null,
        email: p?.email ?? null,
        avatar_url: p?.avatar_url ?? null,
        bookingsCount: 0,
        ordersCount: 0,
        totalSpent: 0,
        lastInteraction: null,
      };
      map.set(uid, c);
      return c;
    };

    for (const b of bookings) {
      const c = ensure(b.user_id);
      c.bookingsCount += 1;
      if (b.status === "completed") c.totalSpent += Number(b.total_price) || 0;
      if (!c.lastInteraction || b.starts_at > c.lastInteraction) {
        c.lastInteraction = b.starts_at;
      }
    }
    for (const o of orders) {
      const c = ensure(o.user_id);
      c.ordersCount += 1;
      c.totalSpent += Number(o.total) || 0;
      if (!c.lastInteraction || o.created_at > c.lastInteraction) {
        c.lastInteraction = o.created_at;
      }
    }

    return Array.from(map.values());
  }, [bookings, orders, profiles]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = customers;
    if (q) {
      list = list.filter((c) => {
        return (
          c.display_name.toLowerCase().includes(q) ||
          (c.phone ?? "").toLowerCase().includes(q) ||
          (c.email ?? "").toLowerCase().includes(q)
        );
      });
    }
    const sorted = [...list];
    sorted.sort((a, b) => {
      switch (sortBy) {
        case "spent":
          return b.totalSpent - a.totalSpent;
        case "orders":
          return b.ordersCount + b.bookingsCount - (a.ordersCount + a.bookingsCount);
        case "name":
          return a.display_name.localeCompare(b.display_name);
        case "recent":
        default:
          return (b.lastInteraction ?? "").localeCompare(a.lastInteraction ?? "");
      }
    });
    return sorted;
  }, [customers, search, sortBy]);

  const loading = ordersLoading || profilesLoading;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Total de clientes" value={String(customers.length)} icon={User} />
        <StatCard
          label="Receita total"
          value={brl(customers.reduce((s, c) => s + c.totalSpent, 0))}
          icon={ShoppingBag}
          accent="text-success"
        />
        <StatCard
          label="Interações"
          value={String(
            customers.reduce((s, c) => s + c.bookingsCount + c.ordersCount, 0),
          )}
          icon={Calendar}
        />
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, telefone ou e-mail"
            className="pl-9"
          />
        </div>
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="recent">Mais recentes</SelectItem>
            <SelectItem value="spent">Maior gasto</SelectItem>
            <SelectItem value="orders">Mais interações</SelectItem>
            <SelectItem value="name">Nome (A-Z)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Carregando...</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border bg-card py-10 text-center">
          <User className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-2 text-sm font-medium">Nenhum cliente encontrado</p>
          <p className="text-xs text-muted-foreground">
            {customers.length === 0
              ? "Quando alguém fizer um pedido ou agendamento, aparecerá aqui."
              : "Tente ajustar a busca."}
          </p>
        </div>
      ) : (
        <ul className="divide-y rounded-lg border bg-card">
          {filtered.map((c) => {
            const wa = onlyDigits(c.phone);
            const initials = c.display_name
              .split(/\s+/)
              .map((p) => p[0])
              .filter(Boolean)
              .slice(0, 2)
              .join("")
              .toUpperCase();
            return (
              <li
                key={c.user_id}
                className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-center gap-3">
                  {c.avatar_url ? (
                    <img
                      src={c.avatar_url}
                      alt={c.display_name}
                      className="h-10 w-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-sm font-semibold">
                      {initials || "C"}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{c.display_name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {c.phone ?? c.email ?? "Sem contato"}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                      {c.ordersCount > 0 && (
                        <span className="rounded-full bg-muted px-2 py-0.5">
                          {c.ordersCount} pedido{c.ordersCount > 1 ? "s" : ""}
                        </span>
                      )}
                      {c.bookingsCount > 0 && (
                        <span className="rounded-full bg-muted px-2 py-0.5">
                          {c.bookingsCount} agend.
                        </span>
                      )}
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 font-semibold text-primary">
                        {brl(c.totalSpent)}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  {wa && (
                    <Button variant="outline" size="sm" asChild>
                      <a
                        href={`https://wa.me/${wa}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <MessageSquare className="h-4 w-4" />
                        WhatsApp
                      </a>
                    </Button>
                  )}
                  {c.phone && (
                    <Button variant="ghost" size="sm" asChild>
                      <a href={`tel:${c.phone}`}>
                        <Phone className="h-4 w-4" />
                      </a>
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  accent?: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className={`mt-1.5 text-2xl font-bold ${accent ?? ""}`}>{value}</p>
    </div>
  );
}
