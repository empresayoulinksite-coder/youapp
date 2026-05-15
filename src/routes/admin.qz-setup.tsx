import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { useIsAdmin } from "@/hooks/use-admin";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import {
  generateQzCertificate,
  getQzOverrideCrt,
} from "@/lib/qz-cert-generator.functions";
import { Download, Loader2, ShieldCheck, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/admin/qz-setup")({
  component: QzSetupPage,
});

function downloadFile(filename: string, content: string) {
  const blob = new Blob([content], { type: "application/x-x509-ca-cert" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function QzSetupPage() {
  const { isAdmin, loading } = useIsAdmin();
  const navigate = useNavigate();
  const generateFn = useServerFn(generateQzCertificate);
  const getOverrideFn = useServerFn(getQzOverrideCrt);
  const [generating, setGenerating] = useState(false);
  const [downloading, setDownloading] = useState(false);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Acesso restrito</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              Apenas administradores podem acessar essa página.
            </p>
            <Button onClick={() => navigate({ to: "/" })}>Voltar ao início</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  async function handleGenerate() {
    setGenerating(true);
    try {
      const res = await generateFn();
      downloadFile("override.crt", res.overrideCrt);
      toast.success("Certificado gerado! Arquivo override.crt baixado.");
    } catch (err) {
      toast.error(`Erro: ${err instanceof Error ? err.message : "desconhecido"}`);
    } finally {
      setGenerating(false);
    }
  }

  async function handleDownloadAgain() {
    setDownloading(true);
    try {
      const res = await getOverrideFn();
      if (!res.overrideCrt) {
        toast.error("Nenhum certificado encontrado. Gere primeiro.");
        return;
      }
      downloadFile("override.crt", res.overrideCrt);
    } catch (err) {
      toast.error(`Erro: ${err instanceof Error ? err.message : "desconhecido"}`);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="container mx-auto max-w-3xl p-6 space-y-6">
      <Link to="/admin" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Admin
      </Link>

      <div className="flex items-center gap-3">
        <ShieldCheck className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Configurar impressão silenciosa (QZ Tray)</h1>
          <p className="text-muted-foreground text-sm">
            Gere o certificado uma vez e instale o <code>override.crt</code> em cada PC da loja.
            Depois, a impressão acontece sem nenhum prompt.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Passo 1 — Gerar o certificado</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Clique no botão abaixo. O sistema vai gerar um par de chaves seguro,
            guardar a chave privada no servidor e baixar o arquivo{" "}
            <code>override.crt</code> automaticamente.
          </p>
          <div className="flex gap-3 flex-wrap">
            <Button onClick={handleGenerate} disabled={generating}>
              {generating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Gerando...
                </>
              ) : (
                <>
                  <ShieldCheck className="mr-2 h-4 w-4" /> Gerar certificado
                </>
              )}
            </Button>
            <Button variant="outline" onClick={handleDownloadAgain} disabled={downloading}>
              {downloading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              Baixar override.crt de novo
            </Button>
          </div>
          <p className="text-xs text-amber-600 dark:text-amber-500">
            ⚠️ Atenção: gerar de novo invalida o certificado antigo. Você terá que reinstalar o{" "}
            <code>override.crt</code> em todos os PCs da loja.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Passo 2 — Instalar em cada PC da loja</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <ol className="list-decimal pl-5 space-y-2">
            <li>
              Copie o arquivo <code>override.crt</code> que você baixou para a pasta de
              instalação do QZ Tray:
              <br />
              <code className="bg-muted px-2 py-1 rounded">C:\Program Files\QZ Tray\</code>
              <br />
              <span className="text-muted-foreground">
                (Pode pedir permissão de administrador. Clique em "Continuar".)
              </span>
            </li>
            <li>
              Abra a <strong>bandeja do sistema</strong> (cantinho inferior direito do Windows,
              perto do relógio), clique com o botão direito no ícone do{" "}
              <strong>QZ Tray</strong> → <strong>Sair (Exit)</strong>.
            </li>
            <li>
              Abra o QZ Tray de novo pelo menu Iniciar (ele vai recarregar com o certificado).
            </li>
            <li>
              Volte ao painel, clique em imprimir um pedido —{" "}
              <strong>nunca mais vai aparecer aquele prompt "Allow"</strong>. ✅
            </li>
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Como funciona?</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            O QZ Tray exige autorização para imprimir por segurança. Quando você instala o{" "}
            <code>override.crt</code>, está dizendo "confio neste sistema, pode imprimir
            silenciosamente".
          </p>
          <p>
            A chave privada (que prova a identidade do sistema) <strong>fica só no servidor</strong>,
            nunca passa pelo navegador. A cada impressão, o backend assina o pedido com essa
            chave, e o QZ Tray verifica que veio de quem ele confia.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
