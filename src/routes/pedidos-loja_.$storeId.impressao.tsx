import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { buildReceiptHTML } from "@/lib/receipt-template";
import { CheckCircle2, Printer, Loader2, ArrowLeft, LogIn, ShieldAlert } from "lucide-react";

type OrderRow = {
  id: string;
  order_number: number | null;
  status: string;
  total: number;
  delivery_fee: number;
  discount: number;
  payment_method: string | null;
  delivery_address: string | null;
  delivery_type: string | null;
  customer_notes: string | null;
  store_id: string;
  user_id: string;
  created_at: string;
  table_number: number | null;
};

const PRINTED_KEY_PREFIX = "auto-print:printed:";
const TTL_MS = 24 * 60 * 60 * 1000;

function loadPrinted(storeId: string): Set<string> {
  try {
    const raw = localStorage.getItem(PRINTED_KEY_PREFIX + storeId);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as Array<{ id: string; t: number }>;
    const now = Date.now();
    return new Set(parsed.filter((p) => now - p.t < TTL_MS).map((p) => p.id));
  } catch {
    return new Set();
  }
}

function savePrinted(storeId: string, ids: Set<string>) {
  try {
    const arr = Array.from(ids).map((id) => ({ id, t: Date.now() }));
    localStorage.setItem(PRINTED_KEY_PREFIX + storeId, JSON.stringify(arr));
  } catch {
    // ignore
  }
}

export const Route = createFileRoute("/pedidos-loja_/$storeId/impressao")({
  component: AutoPrintPage,
});

function AutoPrintPage() {
  const { storeId } = Route.useParams();
  const { user, loading: authLoading } = useAuth();
  const [permState, setPermState] = useState<"checking" | "allowed" | "denied" | "anon">("checking");

  useEffect(() => {
    if (authLoading) {
      setPermState("checking");
      return;
    }
    if (!user) {
      setPermState("anon");
      return;
    }
    let cancelled = false;
    setPermState("checking");
    supabase
      .rpc("can_manage_store_orders", { _user_id: user.id, _store_id: storeId })
      .then(({ data, error }) => {
        if (cancelled) return;
        setPermState(!error && data ? "allowed" : "denied");
      });
    return () => {
      cancelled = true;
    };
  }, [user, authLoading, storeId]);
  const [storeName, setStoreName] = useState<string>("");
  const [storeWhatsapp, setStoreWhatsapp] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [lastPrinted, setLastPrinted] = useState<{ number: number | null; at: Date } | null>(null);
  const [count, setCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const printedRef = useRef<Set<string>>(new Set());
  const queueRef = useRef<string[]>([]);
  const processingRef = useRef(false);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  // Load store info + previously printed
  useEffect(() => {
    printedRef.current = loadPrinted(storeId);
    setCount(printedRef.current.size);
    void supabase
      .from("stores")
      .select("name, whatsapp")
      .eq("id", storeId)
      .single()
      .then(({ data }) => {
        if (data) {
          setStoreName(data.name);
          setStoreWhatsapp(data.whatsapp);
        }
      });
  }, [storeId]);

  // Print one order via hidden iframe
  async function printOrder(orderId: string) {
    if (!iframeRef.current) return;
    setBusy(true);

    // Fetch order + items + customer
    const { data: order } = await supabase
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .single();
    if (!order) {
      setBusy(false);
      return;
    }
    const o = order as OrderRow;

    // Espera os itens aparecerem (pedido + itens chegam em chamadas separadas)
    let items: any[] = [];
    for (let i = 0; i < 6; i++) {
      const { data } = await supabase
        .from("order_items")
        .select("*")
        .eq("order_id", orderId);
      if (data && data.length > 0) {
        items = data;
        break;
      }
      await new Promise((r) => setTimeout(r, 500));
    }
    if (items.length === 0) {
      setBusy(false);
      throw new Error(`Itens do pedido ${orderId} ainda não chegaram`);
    }
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name, phone")
      .eq("user_id", o.user_id)
      .maybeSingle();

    const html = buildReceiptHTML(
      { name: storeName || "Pedido", whatsapp: storeWhatsapp },
      {
        order_number: o.order_number,
        created_at: o.created_at,
        delivery_type: o.delivery_type,
        delivery_address: o.delivery_address,
        payment_method: o.payment_method,
        customer_notes: o.customer_notes,
        total: Number(o.total) || 0,
        delivery_fee: Number(o.delivery_fee) || 0,
        discount: Number(o.discount) || 0,
        table_number: o.table_number,
        order_items: (items ?? []) as never,
      },
      profile ? { display_name: profile.display_name, phone: profile.phone } : null,
    );

    // Strip the auto window.print() / close from the template (we'll trigger here)
    const cleanHtml = html.replace(
      /<script>[\s\S]*?<\/script>/g,
      "",
    );

    // Electron silent printing (no dialog)
    const electronPrint = (window as unknown as {
      electronPrint?: { print: (html: string) => Promise<{ success: boolean; error?: string }> };
    }).electronPrint;
    if (electronPrint?.print) {
      try {
        const res = await electronPrint.print(cleanHtml);
        if (res?.success) {
          printedRef.current.add(orderId);
          savePrinted(storeId, printedRef.current);
          setLastPrinted({ number: o.order_number, at: new Date() });
          setCount(printedRef.current.size);
          setBusy(false);
          return;
        }
        console.error("Electron silent print failed:", res?.error);
      } catch (e) {
        console.error("Electron print bridge error:", e);
      }
      // fall through to iframe fallback
    }

    const iframe = iframeRef.current;
    await new Promise<void>((resolve) => {
      const onLoad = () => {
        iframe.removeEventListener("load", onLoad);
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch (e) {
          console.error("print error", e);
        }
        // Give the print dialog/kiosk a moment to dispatch
        setTimeout(resolve, 1500);
      };
      iframe.addEventListener("load", onLoad);
      // Use srcdoc for clean reload
      iframe.srcdoc = cleanHtml;
    });

    printedRef.current.add(orderId);
    savePrinted(storeId, printedRef.current);
    setLastPrinted({ number: o.order_number, at: new Date() });
    setCount(printedRef.current.size);
    setBusy(false);
  }

  async function processQueue() {
    if (processingRef.current) return;
    processingRef.current = true;
    while (queueRef.current.length > 0) {
      const next = queueRef.current.shift()!;
      try {
        await printOrder(next);
      } catch (e) {
        console.error("Auto-print failed:", e);
      }
    }
    processingRef.current = false;
  }

  function enqueue(orderId: string) {
    if (printedRef.current.has(orderId)) return;
    if (queueRef.current.includes(orderId)) return;
    queueRef.current.push(orderId);
    void processQueue();
  }

  // Realtime subscription for new orders + catch-up
  useEffect(() => {
    const channel = supabase
      .channel(`auto-print-${storeId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "orders",
          filter: `store_id=eq.${storeId}`,
        },
        (payload) => {
          const id = (payload.new as { id?: string })?.id;
          if (id) enqueue(id);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "orders",
          filter: `store_id=eq.${storeId}`,
        },
        (payload) => {
          const row = payload.new as { id?: string; status?: string };
          if (row?.id && ["em_analise", "em_producao"].includes(row.status ?? "")) enqueue(row.id);
        },
      )
      .subscribe(async (status) => {
        const isConnected = status === "SUBSCRIBED";
        setConnected(isConnected);
        if (isConnected) {
          // Catch-up: imprime pedidos recentes (últimos 30 min) ainda não impressos
          const sinceIso = new Date(Date.now() - 30 * 60_000).toISOString();
          const { data } = await supabase
            .from("orders")
            .select("id")
            .eq("store_id", storeId)
            .in("status", ["em_analise", "em_producao"])
            .gte("created_at", sinceIso)
            .order("created_at", { ascending: true });
          for (const r of data ?? []) {
            if (r?.id) enqueue(r.id);
          }
        }
      });
    return () => {
      supabase.removeChannel(channel);
    };
  }, [storeId, storeName]);

  // Polling de segurança: se o navegador perder um evento realtime, a página ainda encontra o pedido.
  useEffect(() => {
    const timer = window.setInterval(async () => {
      const sinceIso = new Date(Date.now() - 30 * 60_000).toISOString();
      const { data } = await supabase
        .from("orders")
        .select("id")
        .eq("store_id", storeId)
        .in("status", ["em_analise", "em_producao"])
        .gte("created_at", sinceIso)
        .order("created_at", { ascending: true });
      for (const r of data ?? []) {
        if (r?.id) enqueue(r.id);
      }
    }, 15_000);
    return () => window.clearInterval(timer);
  }, [storeId]);

  function handleReprintLast() {
    if (!lastPrinted) return;
    // Re-fetch the most recent order regardless of printed state
    void supabase
      .from("orders")
      .select("id")
      .eq("store_id", storeId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single()
      .then(({ data }) => {
        if (data?.id) {
          printedRef.current.delete(data.id);
          enqueue(data.id);
        }
      });
  }

  function handleClearHistory() {
    printedRef.current.clear();
    savePrinted(storeId, printedRef.current);
    setCount(0);
  }

  if (permState === "checking") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Verificando acesso...</span>
        </div>
      </div>
    );
  }

  if (permState === "anon") {
    const redirectTo = `/pedidos-loja/${storeId}/impressao`;
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="max-w-sm rounded-xl border bg-card p-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <LogIn className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-lg font-bold">Entrar para ativar</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Faça login com a conta da loja para ativar a impressão automática neste computador.
          </p>
          <Button asChild className="mt-4 w-full">
            <a href={`/auth?redirect=${encodeURIComponent(redirectTo)}`}>Fazer login</a>
          </Button>
          <p className="mt-3 text-[11px] text-muted-foreground">
            Dica: marque "continuar conectado" para que o atalho do Chrome em modo quiosque funcione sem pedir login novamente.
          </p>
        </div>
      </div>
    );
  }

  if (permState === "denied") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="max-w-sm rounded-xl border bg-card p-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <ShieldAlert className="h-6 w-6 text-destructive" />
          </div>
          <h1 className="text-lg font-bold">Sem permissão</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Esta conta ({user?.email}) não tem acesso aos pedidos desta loja. Entre com a conta do dono ou de um operador autorizado.
          </p>
          <div className="mt-4 flex flex-col gap-2">
            <Button asChild variant="outline">
              <Link to="/admin/impressao-automatica">Ver minhas lojas</Link>
            </Button>
            <Button
              variant="ghost"
              onClick={async () => {
                await supabase.auth.signOut();
              }}
            >
              Sair desta conta
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="flex items-center justify-between">
          <Button asChild variant="ghost" size="sm">
            <Link to="/pedidos-loja/$storeId" params={{ storeId }}>
              <ArrowLeft className="mr-1 h-4 w-4" />
              Voltar
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/admin/impressao-automatica">Como configurar</Link>
          </Button>
        </div>

        <div className="rounded-xl border bg-card p-6 text-center">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Printer className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">Impressão automática</h1>
          <p className="mt-1 text-sm text-muted-foreground">{storeName || "Carregando..."}</p>

          <div className="mt-4 flex items-center justify-center gap-2">
            {connected ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium text-green-700">
                  Conectado · aguardando pedidos
                </span>
              </>
            ) : (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Conectando...</span>
              </>
            )}
          </div>

          {busy && (
            <div className="mt-3 flex items-center justify-center gap-2 text-sm text-primary">
              <Loader2 className="h-4 w-4 animate-spin" />
              Imprimindo...
            </div>
          )}
        </div>

        <div className="rounded-xl border bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold">Status</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Pedidos impressos hoje:</span>
              <span className="font-semibold">{count}</span>
            </div>
            {lastPrinted && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Último pedido:</span>
                <span className="font-semibold">
                  #{lastPrinted.number ?? "—"} · {lastPrinted.at.toLocaleTimeString("pt-BR")}
                </span>
              </div>
            )}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={handleReprintLast} disabled={busy}>
              Reimprimir último
            </Button>
            <Button size="sm" variant="ghost" onClick={handleClearHistory}>
              Limpar histórico
            </Button>
          </div>
        </div>

        <div className="rounded-xl border bg-amber-50 p-4 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          <strong>⚠️ Mantenha esta página aberta</strong> no computador conectado à impressora.
          Para impressão sem mostrar o diálogo, abra o Chrome com a flag{" "}
          <code className="rounded bg-amber-100 px-1 dark:bg-amber-900/40">
            --kiosk-printing
          </code>
          .{" "}
          <Link
            to="/admin/impressao-automatica"
            className="underline underline-offset-2"
          >
            Ver passo a passo
          </Link>
          .
        </div>

        {/* Hidden iframe for printing */}
        <iframe
          ref={iframeRef}
          title="print-frame"
          style={{
            position: "fixed",
            right: 0,
            bottom: 0,
            width: 0,
            height: 0,
            border: 0,
            visibility: "hidden",
          }}
        />
      </div>
    </div>
  );
}
