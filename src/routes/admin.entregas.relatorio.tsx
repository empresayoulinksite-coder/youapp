import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/entregas/relatorio")({
  component: RelatorioEntregadores,
});

function RelatorioEntregadores() {
  return (
    <div>
      <h2 className="text-xl font-bold">Relatório entregadores</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Visualize relatórios de desempenho dos entregadores.
      </p>
    </div>
  );
}
