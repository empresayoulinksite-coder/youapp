import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer, Monitor, FileText, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/admin/impressao-automatica")({
  component: ImpressaoAutomaticaPage,
  beforeLoad: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw redirect({ to: "/auth" });
    }
  },
});

function ImpressaoAutomaticaPage() {
  const { data: stores = [] } = useQuery({
    queryKey: ["my-stores-for-print"],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return [];
      const { data: ownedIds } = await supabase
        .from("store_owners")
        .select("store_id")
        .eq("user_id", session.user.id);
      const { data: staffIds } = await supabase
        .from("store_staff")
        .select("store_id")
        .eq("user_id", session.user.id)
        .eq("is_active", true);
      const ids = Array.from(
        new Set([
          ...(ownedIds ?? []).map((r) => r.store_id),
          ...(staffIds ?? []).map((r) => r.store_id),
        ]),
      );
      if (ids.length === 0) return [];
      const { data } = await supabase
        .from("stores")
        .select("id, name, emoji")
        .in("id", ids);
      return data ?? [];
    },
  });

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 p-4">
          <Button asChild variant="ghost" size="sm">
            <Link to="/admin">
              <ArrowLeft className="mr-1 h-4 w-4" />
              Admin
            </Link>
          </Button>
          <h1 className="text-lg font-bold">Impressão automática</h1>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 p-6">
        <section className="rounded-xl border bg-card p-5">
          <div className="mb-2 flex items-center gap-2">
            <Printer className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Como funciona</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Um computador da loja fica com o Chrome aberto na página de impressão automática.
            Quando chega um pedido novo, o cupom é impresso sozinho na impressora padrão do Windows
            — <strong>sem instalar programa nenhum</strong> e <strong>sem mostrar o diálogo de impressão</strong>.
          </p>
        </section>

        <section className="rounded-xl border bg-card p-5">
          <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
            <Monitor className="h-4 w-4" />
            Passo 1 — Defina a impressora padrão no Windows
          </h2>
          <ol className="list-inside list-decimal space-y-1 text-sm text-muted-foreground">
            <li>Abra <strong>Configurações → Bluetooth e dispositivos → Impressoras e scanners</strong>.</li>
            <li>Clique na sua impressora térmica.</li>
            <li>Clique em <strong>Definir como padrão</strong>.</li>
          </ol>
        </section>

        <section className="rounded-xl border bg-card p-5">
          <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
            <FileText className="h-4 w-4" />
            Passo 2 — Crie o atalho do Chrome em modo quiosque
          </h2>
          <ol className="list-inside list-decimal space-y-2 text-sm text-muted-foreground">
            <li>Na área de trabalho, clique com o botão direito → <strong>Novo → Atalho</strong>.</li>
            <li>
              No campo de localização, cole exatamente:
              <pre className="mt-2 overflow-x-auto rounded-md bg-muted p-3 text-xs text-foreground">
{`"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" --kiosk-printing --kiosk ${origin}/pedidos-loja/SEU_STORE_ID/impressao`}
              </pre>
            </li>
            <li>
              Substitua <code className="rounded bg-muted px-1">SEU_STORE_ID</code> pelo link de uma das suas lojas abaixo.
            </li>
            <li>Clique <strong>Avançar</strong>, dê um nome (ex: "Imprimir Pedidos") e <strong>Concluir</strong>.</li>
          </ol>

          {stores.length > 0 && (
            <div className="mt-4 rounded-lg border bg-muted/30 p-3">
              <p className="mb-2 text-xs font-semibold text-muted-foreground">Suas lojas:</p>
              <div className="space-y-2">
                {stores.map((s) => {
                  const url = `${origin}/pedidos-loja/${s.id}/impressao`;
                  return (
                    <div key={s.id} className="rounded-md border bg-background p-2">
                      <div className="mb-1 flex items-center gap-2 text-sm font-semibold">
                        <span>{s.emoji ?? "🏪"}</span>
                        {s.name}
                      </div>
                      <code className="block break-all text-[10px] text-muted-foreground">
                        {url}
                      </code>
                      <Button asChild size="sm" variant="outline" className="mt-2">
                        <a href={url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="mr-1 h-3 w-3" />
                          Abrir agora
                        </a>
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        <section className="rounded-xl border bg-card p-5">
          <h2 className="mb-3 text-base font-semibold">Passo 3 — Teste</h2>
          <ol className="list-inside list-decimal space-y-1 text-sm text-muted-foreground">
            <li>Clique duas vezes no atalho que você criou.</li>
            <li>O Chrome abre em tela cheia direto na página de impressão.</li>
            <li>Faça um pedido teste no app.</li>
            <li>O cupom sai na impressora automaticamente.</li>
          </ol>
          <p className="mt-3 rounded-md bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
            💡 <strong>Para sair do modo quiosque</strong>, pressione <kbd>Alt</kbd> + <kbd>F4</kbd>.
          </p>
        </section>

        <section className="rounded-xl border bg-card p-5">
          <h2 className="mb-3 text-base font-semibold">Dúvidas comuns</h2>
          <div className="space-y-3 text-sm">
            <div>
              <p className="font-semibold">Funciona com impressora térmica?</p>
              <p className="text-muted-foreground">
                Sim. Funciona com qualquer impressora instalada no Windows (térmica, jato, laser, USB ou rede).
                O cupom é otimizado para 80mm.
              </p>
            </div>
            <div>
              <p className="font-semibold">Preciso pagar alguma coisa?</p>
              <p className="text-muted-foreground">
                Não. É 100% gratuito. Usa apenas o Chrome (que já vem grátis) e a impressora que você já tem.
              </p>
            </div>
            <div>
              <p className="font-semibold">Funciona se eu fechar o Chrome?</p>
              <p className="text-muted-foreground">
                Não. O Chrome com a página aberta precisa ficar rodando. Recomendamos um PC dedicado no caixa da loja.
              </p>
            </div>
            <div>
              <p className="font-semibold">Posso usar um tablet Android ou celular?</p>
              <p className="text-muted-foreground">
                Não para esse modo automático. O modo quiosque com <code>--kiosk-printing</code> só existe no Chrome desktop (Windows, Mac ou Linux).
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
