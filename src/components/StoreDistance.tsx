import { useStoreDistance } from "@/lib/distance";

type Props = {
  store: { lat?: number | null; lng?: number | null; distance?: string | null };
  className?: string;
};

/** Mostra distância dinâmica (calculada do usuário até a loja) ou fallback. */
export function StoreDistance({ store, className }: Props) {
  const d = useStoreDistance(store);
  if (!d) return null;
  return <span className={className}>{d}</span>;
}
