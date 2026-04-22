import { useStoreDistance } from "@/lib/distance";

type Props = {
  store: {
    lat?: number | null;
    lng?: number | null;
    address?: string | null;
    neighborhood?: string | null;
    city?: string | null;
    cep?: string | null;
    distance?: string | null;
  };
  className?: string;
};

/** Mostra distância em tempo real (usuário → loja). Não renderiza nada se não puder calcular. */
export function StoreDistance({ store, className }: Props) {
  const d = useStoreDistance(store);
  if (!d) return null;
  return <span className={className}>{d}</span>;
}
