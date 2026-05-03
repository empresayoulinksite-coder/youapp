import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/entregas/areas")({
  component: AreasEntrega,
});

function AreasEntrega() {
  return (
    <div>
      <h2 className="text-xl font-bold">Áreas de entrega</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Configure as áreas de entrega disponíveis.
      </p>
    </div>
  );
}
