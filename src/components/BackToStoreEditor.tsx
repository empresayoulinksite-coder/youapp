import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export function BackToStoreEditor({ storeId }: { storeId?: string | null }) {
  if (!storeId) return null;
  return (
    <Button asChild variant="outline" size="sm" className="mb-3">
      <Link to="/admin/loja/$storeId" params={{ storeId }}>
        <ArrowLeft className="h-3.5 w-3.5" />
        Voltar para editor da loja
      </Link>
    </Button>
  );
}
