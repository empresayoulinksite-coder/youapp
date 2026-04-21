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
  const text = encodeURIComponent(message);
  const primaryUrl = `https://wa.me/${phone}?text=${text}`;
  const fallbackUrl = `https://web.whatsapp.com/send?phone=${phone}&text=${text}`;

  const win = window.open(primaryUrl, "_blank", "noopener,noreferrer");
  const blocked = !win || win.closed || typeof win.closed === "undefined";

  if (blocked) {
    toast.success("Pedido pronto!", {
      description: "Clique para abrir o WhatsApp da loja.",
      action: {
        label: "Abrir WhatsApp",
        onClick: () => window.open(fallbackUrl, "_blank", "noopener,noreferrer"),
      },
      duration: 12000,
    });
  }
}
