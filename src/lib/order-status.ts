// Fluxo de status do gestor de pedidos (lojas Food)
// em_analise → em_producao → pronto → entregue (ou cancelado)

export type OrderStatus =
  | "em_analise"
  | "em_producao"
  | "pronto"
  | "entregue"
  | "cancelado";

export const KANBAN_COLUMNS: {
  id: Exclude<OrderStatus, "cancelado">;
  label: string;
  // Cores no estilo AnotaAI
  headerBg: string;
  columnBg: string;
}[] = [
  {
    id: "em_analise",
    label: "Em análise",
    headerBg: "bg-orange-700",
    columnBg: "bg-orange-500/90",
  },
  {
    id: "em_producao",
    label: "Em produção",
    headerBg: "bg-amber-700",
    columnBg: "bg-amber-500/90",
  },
  {
    id: "pronto",
    label: "Prontos para entrega",
    headerBg: "bg-emerald-700",
    columnBg: "bg-emerald-500/90",
  },
  {
    id: "entregue",
    label: "Entregues",
    headerBg: "bg-slate-700",
    columnBg: "bg-slate-500/90",
  },
];

export const STATUS_LABEL: Record<
  OrderStatus,
  { label: string; cls: string }
> = {
  em_analise: { label: "Em análise", cls: "bg-orange-100 text-orange-700" },
  em_producao: { label: "Em produção", cls: "bg-amber-100 text-amber-700" },
  pronto: { label: "Pronto", cls: "bg-emerald-100 text-emerald-700" },
  entregue: { label: "Entregue", cls: "bg-slate-200 text-slate-700" },
  cancelado: { label: "Cancelado", cls: "bg-destructive/15 text-destructive" },
};

// Mensagem padrão para o cliente quando o status muda
export function whatsappStatusMessage(
  status: OrderStatus,
  storeName: string,
  orderShortId: string,
): string {
  switch (status) {
    case "em_analise":
      return `Olá! Recebemos seu pedido #${orderShortId} na ${storeName}. Já estamos analisando e em breve entraremos em produção. 🧾`;
    case "em_producao":
      return `Boa notícia! Seu pedido #${orderShortId} na ${storeName} já está sendo preparado. 👨‍🍳`;
    case "pronto":
      return `Seu pedido #${orderShortId} da ${storeName} está pronto e a caminho/disponível para retirada! 🛵✨`;
    case "entregue":
      return `Pedido #${orderShortId} da ${storeName} entregue. Muito obrigado pela preferência! 💚 Se puder, deixe sua avaliação.`;
    case "cancelado":
      return `Olá, infelizmente seu pedido #${orderShortId} na ${storeName} foi cancelado. Qualquer dúvida estamos por aqui. 🙏`;
  }
}

export function shortOrderId(id: string) {
  return id.slice(0, 8).toUpperCase();
}
