import { createFileRoute, Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Store, UtensilsCrossed, Ticket, Image as ImageIcon, LogOut, Home, Tags, LayoutGrid, Briefcase, CalendarDays, Users, Upload, Pizza } from "lucide-react";
import { useIsAdmin } from "@/hooks/use-admin";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin")({
  component: AdminLayout,
});

const NAV = [
  { to: "/admin", label: "Lojas", icon: Store, exact: true },
  { to: "/admin/produtos", label: "Produtos", icon: UtensilsCrossed },
  { to: "/admin/importar-cardapio", label: "Importar cardápio", icon: Upload },
  { to: "/admin/servicos", label: "Serviços", icon: Briefcase },
  { to: "/admin/agendamentos", label: "Agendamentos", icon: CalendarDays },
  { to: "/admin/donos", label: "Donos de loja", icon: Users },
  { to: "/admin/categorias-home", label: "Categorias Home", icon: LayoutGrid },
  { to: "/admin/categorias-ecommerce", label: "Categorias E-com", icon: Tags },
  { to: "/admin/cupons", label: "Cupons", icon: Ticket },
  { to: "/admin/stories", label: "Stories", icon: ImageIcon },
];

function AdminLayout() {
  const { isAdmin, loading, user } = useIsAdmin();
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

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
        </nav>
        <main className="flex-1 overflow-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
