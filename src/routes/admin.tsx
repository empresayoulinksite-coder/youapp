import { createFileRoute, Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Store, LogOut, Home, Tags, LayoutGrid, Users, Upload, Sparkles, Truck, ChevronDown, UserPlus, FileText, MapPin, Printer } from "lucide-react";
import { useIsAdmin } from "@/hooks/use-admin";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin")({
  component: AdminLayout,
});

const NAV = [
  { to: "/admin", label: "Lojas", icon: Store, exact: true },
  { to: "/admin/donos", label: "Donos de loja", icon: Users },
  { to: "/admin/categorias-home", label: "Categorias Home", icon: LayoutGrid },
  { to: "/admin/categorias-ecommerce", label: "Categorias E-com", icon: Tags },
  { to: "/admin/importar-cardapio", label: "Importar cardápio", icon: Upload },
  { to: "/admin/modal-boas-vindas", label: "Modal boas-vindas", icon: Sparkles },
  { to: "/admin/impressao-automatica", label: "Impressão automática", icon: Printer },
];

const ENTREGAS_SUB = [
  { to: "/admin/entregas/cadastro", label: "Cadastro entregadores", icon: UserPlus },
  { to: "/admin/entregas/relatorio", label: "Relatório entregadores", icon: FileText },
  { to: "/admin/entregas/areas", label: "Áreas de entrega", icon: MapPin },
];

function AdminLayout() {
  const { isAdmin, loading, user } = useIsAdmin();
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const isEntregasActive = location.pathname.startsWith("/admin/entregas");
  const [entregasOpen, setEntregasOpen] = useState(isEntregasActive);

  useEffect(() => {
    if (isEntregasActive) setEntregasOpen(true);
  }, [isEntregasActive]);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="max-w-sm text-center">
          <h1 className="text-2xl font-bold">Acesso restrito</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Você não tem permissão para acessar o painel administrativo.
          </p>
          <Link to="/" className="mt-4 inline-block text-sm text-primary underline">
            Voltar para o app
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-muted/30">
      <aside className="hidden w-64 flex-col border-r bg-background md:flex">
        <div className="border-b p-4">
          <h1 className="text-lg font-bold">Admin</h1>
          <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {NAV.map((item) => {
            const active = item.exact
              ? location.pathname === item.to
              : location.pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground hover:bg-accent",
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}

          {/* Entregas - collapsible purple section */}
          <div className="pt-1">
            <button
              onClick={() => setEntregasOpen((v) => !v)}
              className={cn(
                "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isEntregasActive
                  ? "bg-purple-600 text-white"
                  : "bg-purple-50 text-purple-700 hover:bg-purple-100 dark:bg-purple-950 dark:text-purple-300 dark:hover:bg-purple-900",
              )}
            >
              <Truck className="h-4 w-4" />
              Entregas
              <ChevronDown
                className={cn(
                  "ml-auto h-4 w-4 transition-transform",
                  entregasOpen && "rotate-180",
                )}
              />
            </button>
            {entregasOpen && (
              <div className="ml-4 mt-1 space-y-0.5 border-l-2 border-purple-200 pl-3 dark:border-purple-800">
                {ENTREGAS_SUB.map((sub) => {
                  const active = location.pathname === sub.to;
                  const Icon = sub.icon;
                  return (
                    <Link
                      key={sub.to}
                      to={sub.to}
                      className={cn(
                        "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                        active
                          ? "bg-purple-600 text-white"
                          : "text-purple-700 hover:bg-purple-50 dark:text-purple-300 dark:hover:bg-purple-900",
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {sub.label}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </nav>
        <div className="space-y-1 border-t p-3">
          <Link
            to="/"
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent"
          >
            <Home className="h-4 w-4" />
            Ver app
          </Link>
          <button
            onClick={() => signOut().then(() => navigate({ to: "/auth" }))}
            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent"
          >
            <LogOut className="h-4 w-4" />
            Sair
          </button>
        </div>
      </aside>

      {/* Mobile top nav */}
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b bg-background p-3 md:hidden">
          <h1 className="text-base font-bold">Admin</h1>
          <Link to="/" className="text-xs text-primary">App</Link>
        </header>
        <nav className="flex gap-1 overflow-x-auto border-b bg-background p-2 md:hidden">
          {NAV.map((item) => {
            const active = item.exact
              ? location.pathname === item.to
              : location.pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "whitespace-nowrap rounded-full px-3 py-1.5 text-xs",
                  active ? "bg-primary text-primary-foreground" : "bg-muted",
                )}
              >
                {item.label}
              </Link>
            );
          })}
          {ENTREGAS_SUB.map((sub) => {
            const active = location.pathname === sub.to;
            return (
              <Link
                key={sub.to}
                to={sub.to}
                className={cn(
                  "whitespace-nowrap rounded-full px-3 py-1.5 text-xs",
                  active ? "bg-purple-600 text-white" : "bg-purple-50 text-purple-700",
                )}
              >
                {sub.label}
              </Link>
            );
          })}
        </nav>
        <main className="flex-1 overflow-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
