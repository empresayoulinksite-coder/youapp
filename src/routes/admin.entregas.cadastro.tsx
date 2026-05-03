import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/entregas/cadastro")({
  component: CadastroEntregadores,
});

function CadastroEntregadores() {
  return (
    <div>
      <h2 className="text-xl font-bold">Cadastro de entregadores</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Gerencie os entregadores cadastrados na plataforma.
      </p>
    </div>
  );
}
