/**
 * Otimiza URLs de imagens do Supabase Storage usando o transform endpoint.
 * Reduz drasticamente o tamanho do arquivo entregue (largura limitada + qualidade).
 *
 * Se a URL não for do Supabase Storage, retorna a URL original.
 */
export function optimizedImageUrl(
  url: string | null | undefined,
  opts: { width?: number; quality?: number; resize?: "cover" | "contain" } = {},
): string {
  if (!url) return "";
  // Só transforma URLs do storage público do Supabase
  if (!url.includes("/storage/v1/object/public/")) return url;

  const { width = 800, quality = 75, resize = "contain" } = opts;
  const transformed = url.replace(
    "/storage/v1/object/public/",
    "/storage/v1/render/image/public/",
  );
  const params = new URLSearchParams({
    width: String(width),
    quality: String(quality),
    resize,
  });
  return `${transformed}?${params.toString()}`;
}
