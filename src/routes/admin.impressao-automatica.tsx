import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer, Monitor, FileText, ExternalLink, Copy, Check, AlertTriangle, Download, Zap, Puzzle } from "lucide-react";

function slugify(s: string) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || "loja";
}

function buildBatFile(origin: string, storeId: string, storeName: string) {
  const url = `${origin}/pedidos-loja/${storeId}/impressao`;
  // .bat usa CRLF; vamos montar com \r\n
  const lines = [
    `@echo off`,
    `REM ===========================================`,
    `REM  Impressao automatica - ${storeName}`,
    `REM  Gerado pelo Youapp`,
    `REM ===========================================`,
    ``,
    `set "URL=${url}"`,
    `set "PROFILE=C:\\YouappPrint"`,
    `set "ARGS=--user-data-dir=%PROFILE% --kiosk-printing --kiosk --no-first-run --no-default-browser-check %URL%"`,
    ``,
    `set "CHROME1=C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"`,
    `set "CHROME2=C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe"`,
    ``,
    `if exist "%CHROME1%" (`,
    `  start "" "%CHROME1%" %ARGS%`,
    `  exit /b`,
    `)`,
    `if exist "%CHROME2%" (`,
    `  start "" "%CHROME2%" %ARGS%`,
    `  exit /b`,
    `)`,
    ``,
    `echo.`,
    `echo Google Chrome nao foi encontrado nos caminhos padrao.`,
    `echo Instale o Chrome em https://www.google.com/chrome/ e rode novamente.`,
    `pause`,
    ``,
  ];
  return lines.join("\r\n");
}

function DownloadBatButton({ origin, storeId, storeName }: { origin: string; storeId: string; storeName: string }) {
  return (
    <Button
      size="sm"
      onClick={() => {
        const content = buildBatFile(origin, storeId, storeName);
        const blob = new Blob([content], { type: "application/bat" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `Imprimir-${slugify(storeName)}.bat`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }}
    >
      <Download className="mr-1 h-3 w-3" />
      Baixar .bat
    </Button>
  );
}

export const Route = createFileRoute("/admin/impressao-automatica")({
  component: ImpressaoAutomaticaPage,
  beforeLoad: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw redirect({ to: "/auth" });
    }
  },
});

function buildShortcut(origin: string, storeId: string) {
  // --user-data-dir: perfil dedicado, garante que o login fica salvo e o Chrome
  //   não abre uma janela "anônima" sem sessão.
  // --kiosk-printing: imprime sem mostrar o diálogo.
  // --kiosk: tela cheia.
  // --no-first-run / --no-default-browser-check: pula telas iniciais do Chrome.
  return `"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" --user-data-dir="C:\\YouappPrint" --kiosk-printing --kiosk --no-first-run --no-default-browser-check ${origin}/pedidos-loja/${storeId}/impressao`;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      size="sm"
      variant="outline"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          // ignore
        }
      }}
    >
      {copied ? (
        <>
          <Check className="mr-1 h-3 w-3" /> Copiado
        </>
      ) : (
        <>
          <Copy className="mr-1 h-3 w-3" /> Copiar comando
        </>
      )}
    </Button>
  );
}

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
        <section className="rounded-xl border-2 border-primary bg-primary/5 p-5">
          <div className="mb-2 flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Modo recomendado: Extensão do Chrome</h2>
            <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold uppercase text-primary-foreground">Novo</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Instale a extensão e os pedidos sairem da impressora <strong>em segundo plano</strong>,
            do mesmo jeito que o app do iFood faz. Você pode <strong>fechar a aba de impressão</strong>,
            <strong> mexer na sua loja normalmente</strong> e até minimizar o Chrome — só precisa manter
            o Chrome aberto.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={() => {
                fetch("/youapp-print.zip")
                  .then((res) => {
                    if (!res.ok) throw new Error(`Falha no download: ${res.status}`);
                    return res.blob();
                  })
                  .then((blob) => {
                    const a = document.createElement("a");
                    a.href = URL.createObjectURL(blob);
                    a.download = "youapp-print.zip";
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
                  })
                  .catch((err) => alert(err.message));
              }}
            >
              <Download className="mr-1 h-4 w-4" />
              Baixar extensão (.zip)
            </Button>
          </div>
          <details className="mt-3">
            <summary className="cursor-pointer text-sm font-semibold">
              <Puzzle className="mr-1 inline h-4 w-4" />
              Como instalar (1 vez só)
            </summary>
            <ol className="mt-2 list-inside list-decimal space-y-1 text-sm text-muted-foreground">
              <li>Baixe o <code>.zip</code> acima e <strong>descompacte</strong> em uma pasta (ex.: <code>C:\YouappPrint</code>).</li>
              <li>Abra o Chrome e digite <code>chrome://extensions</code> na barra de endereço.</li>
              <li>No canto superior direito, ative o <strong>Modo desenvolvedor</strong>.</li>
              <li>Clique em <strong>Carregar sem compactação</strong> e selecione a pasta descompactada.</li>
              <li>Clique no ícone 🧩 do Chrome → fixe o ícone <strong>YouApp Print</strong> na barra.</li>
              <li>Clique no ícone, faça <strong>login com a conta da loja</strong> (e-mail e senha) e marque as lojas que essa máquina vai imprimir.</li>
              <li>
                <strong>Importante:</strong> para imprimir sem o diálogo aparecer, abra o Chrome usando o
                {" "}<strong>atalho .bat</strong> (botão abaixo) — ele liga o modo silencioso
                {" "}(<code>--kiosk-printing</code>) sem ativar o modo tela cheia. Pronto, navegue à vontade.
              </li>
            </ol>
            <p className="mt-3 rounded-md bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
              ⚠️ Funciona em Chrome, Edge, Brave e Opera (qualquer Chromium). Não funciona no Firefox/Safari.
              Se você fechar o Chrome, a impressão para — minimizar pode (recomendamos PC dedicado no caixa).
            </p>
          </details>
        </section>

        <section className="rounded-xl border bg-card p-5">
          <div className="mb-2 flex items-center gap-2">
            <Printer className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Modo simples (sem instalar nada)</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Alternativa: deixe um Chrome dedicado aberto na página de impressão. Não pode mexer
            nessa janela, mas funciona sem instalar a extensão. Use o passo a passo abaixo.
          </p>
        </section>

        <section className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
          <div className="mb-1 flex items-center gap-2 font-semibold">
            <AlertTriangle className="h-4 w-4" />
            Importante: feche todas as janelas do Chrome antes de abrir o atalho
          </div>
          <p>
            O comando abaixo cria um <strong>perfil dedicado</strong> só para a impressão (pasta
            {" "}<code className="rounded bg-amber-100 px-1 dark:bg-amber-900/40">C:\YouappPrint</code>).
            Se já houver outro Chrome aberto com outro perfil, o modo quiosque não ativa direito e
            a janela "Imprimir" aparece — foi exatamente isso que aconteceu no seu teste.
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
            Passo 2 — Baixe o atalho da sua loja
          </h2>
          <p className="mb-3 text-sm text-muted-foreground">
            Clique em <strong>"Baixar .bat"</strong> da sua loja, salve o arquivo na <strong>área de trabalho</strong>{" "}
            e dê <strong>dois cliques</strong>. Pronto — o Chrome abre direto no modo de impressão automática,
            sem precisar criar atalho na mão.
          </p>

          {stores.length === 0 ? (
            <div className="mt-4 rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
              Nenhuma loja vinculada à sua conta.
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {stores.map((s) => {
                const url = `${origin}/pedidos-loja/${s.id}/impressao`;
                const cmd = buildShortcut(origin, s.id);
                return (
                  <div key={s.id} className="rounded-lg border bg-muted/20 p-3">
                    <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                      <span>{s.emoji ?? "🏪"}</span>
                      {s.name}
                    </div>
                    <div className="mb-2 flex flex-wrap gap-2">
                      <DownloadBatButton origin={origin} storeId={s.id} storeName={s.name} />
                      <Button asChild size="sm" variant="ghost">
                        <a href={url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="mr-1 h-3 w-3" />
                          Abrir no navegador
                        </a>
                      </Button>
                    </div>
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                        Avançado: criar atalho manualmente (copiar comando)
                      </summary>
                      <pre className="mt-2 max-h-40 overflow-auto rounded-md bg-background p-2 text-[11px] leading-relaxed text-foreground">
{cmd}
                      </pre>
                      <div className="mt-2">
                        <CopyButton text={cmd} />
                      </div>
                    </details>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="rounded-xl border bg-card p-5">
          <h2 className="mb-3 text-base font-semibold">Passo 3 — Faça login uma vez no perfil de impressão</h2>
          <ol className="list-inside list-decimal space-y-1 text-sm text-muted-foreground">
            <li><strong>Feche todas as janelas do Chrome</strong> que estão abertas.</li>
            <li>Clique duas vezes no atalho que você criou.</li>
            <li>
              O Chrome abre em tela cheia. Como é um perfil novo, vai pedir login do Youapp.
              Faça login com a conta da loja e marque "continuar conectado".
            </li>
            <li>
              Depois do login, a tela mostra <strong>"Conectado · aguardando pedidos"</strong>.
              Pronto — pode deixar aberto.
            </li>
          </ol>
          <p className="mt-3 rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
            Da próxima vez que abrir esse atalho, o login já fica salvo nesse perfil
            (<code className="rounded bg-background px-1">C:\YouappPrint</code>) e o Chrome
            vai direto para a tela de impressão.
          </p>
          <p className="mt-2 rounded-md bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
            💡 Para sair do modo quiosque, pressione <kbd>Alt</kbd> + <kbd>F4</kbd>.
          </p>
        </section>

        <section className="rounded-xl border bg-card p-5">
          <h2 className="mb-3 text-base font-semibold">Passo 4 — Teste</h2>
          <ol className="list-inside list-decimal space-y-1 text-sm text-muted-foreground">
            <li>Faça um pedido teste no app.</li>
            <li>O cupom sai na impressora automaticamente, sem mostrar a janela "Imprimir".</li>
          </ol>
          <p className="mt-3 rounded-md bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
            Se a janela "Imprimir" continuar aparecendo, normalmente é porque:
            <br />• Outro Chrome estava aberto quando o atalho rodou (feche tudo e tente de novo).
            <br />• O atalho foi criado sem o trecho <code className="rounded bg-amber-100 px-1 dark:bg-amber-900/40">--kiosk-printing</code> (recopie o comando acima).
            <br />• A página foi aberta clicando em "Abrir no navegador" em vez do atalho — esse modo é só para teste.
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
