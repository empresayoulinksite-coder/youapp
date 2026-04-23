import { toast } from "sonner";

/** Normaliza telefone brasileiro para wa.me (apenas dígitos, com 55). */
export function formatWhatsappNumber(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  return digits.startsWith("55") ? digits : `55${digits}`;
}

/**
 * Abre o WhatsApp (wa.me) com a mensagem; se o popup for bloqueado,
 * mostra um toast com botão para abrir web.whatsapp.com manualmente.
 */
export function openWhatsapp(rawPhone: string, message: string) {
  const phone = formatWhatsappNumber(rawPhone);
  // Normaliza para NFC para garantir que emojis compostos (ex.: bandeiras, ZWJ)
  // sejam codificados como uma única sequência UTF-8 válida.
  const normalized = message.normalize("NFC");
  const text = encodeURIComponent(normalized);
  // api.whatsapp.com/send lida melhor com UTF-8/emojis que wa.me em alguns navegadores.
  const primaryUrl = `https://api.whatsapp.com/send?phone=${phone}&text=${text}`;

  // Tenta abrir direto (funciona na maioria dos navegadores desktop e Android).
  window.open(primaryUrl, "_blank", "noopener,noreferrer");

  // Sempre mostra o toast com botão de fallback — em alguns celulares (especialmente
  // iOS/Safari ou navegadores in-app) o redirecionamento direto falha silenciosamente.
  toast.success("Pedido pronto!", {
    description: "Se o WhatsApp não abrir, clique no botão para finalizar o pedido.",
    action: {
      label: "Abrir WhatsApp",
      onClick: () => {
        // Usa a mesma URL api.whatsapp.com/send para preservar a codificação UTF-8
        // dos emojis (wa.me costuma corromper emojis compostos em iOS/Safari).
        window.location.href = primaryUrl;
      },
    },
    duration: 15000,
  });
}
