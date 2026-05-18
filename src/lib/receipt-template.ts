import {
  ESC,
  concatBytes,
  encodeText,
} from "./thermal-printer";

export type ReceiptOrder = {
  order_number: number | null;
  created_at: string;
  delivery_type: string | null;
  delivery_address: string | null;
  payment_method: string | null;
  customer_notes: string | null;
  customer_cpf?: string | null;
  total: number;
  delivery_fee: number;
  discount: number;
  table_number?: number | null;
  order_items?: ReceiptItem[];
};

export type ReceiptItem = {
  quantity: number;
  name: string;
  unit_price: number;
  notes: string | null;
  selected_size: string | null;
  pizza_size_name: string | null;
  pizza_crust_name: string | null;
  pizza_flavors: unknown;
  pizza_addons: unknown;
  half_two_name: string | null;
};

export type ReceiptStore = {
  name: string;
  whatsapp?: string | null;
};

export type ReceiptCustomer = {
  display_name: string | null;
  phone: string | null;
};

const COLS = 32; // 58mm thermal printer typical width

function brl(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isPickup(o: ReceiptOrder) {
  const t = (o.delivery_type ?? "").toLowerCase();
  return t.includes("retir") || t === "pickup" || !o.delivery_address;
}

function pad(left: string, right: string, width = COLS) {
  const space = Math.max(1, width - left.length - right.length);
  return left + " ".repeat(space) + right;
}

function divider() {
  return "-".repeat(COLS);
}

// Build ESC/POS bytes
export function buildReceiptBytes(
  store: ReceiptStore,
  order: ReceiptOrder,
  customer: ReceiptCustomer | null,
): Uint8Array {
  const parts: Uint8Array[] = [];
  const push = (b: Uint8Array) => parts.push(b);
  const line = (s: string) => push(encodeText(s + "\n"));

  push(ESC.init);

  // Header
  push(ESC.alignCenter);
  push(ESC.boldOn);
  push(ESC.doubleOn);
  line(store.name);
  push(ESC.doubleOff);
  push(ESC.boldOff);
  line(`Pedido #${order.order_number ?? "-"}`);
  line(fmtTime(order.created_at));
  if (order.table_number) {
    line(`Mesa ${order.table_number}`);
  } else {
    line(isPickup(order) ? "RETIRADA" : "DELIVERY");
  }

  push(ESC.alignLeft);
  line(divider());

  // Customer
  if (customer?.display_name || customer?.phone) {
    push(ESC.boldOn);
    line("CLIENTE");
    push(ESC.boldOff);
    if (customer.display_name) line(customer.display_name);
    if (customer.phone) line(`Tel: ${customer.phone}`);
    if (!isPickup(order) && order.delivery_address) {
      line(`End: ${order.delivery_address}`);
    }
    line(divider());
  } else if (!isPickup(order) && order.delivery_address) {
    push(ESC.boldOn);
    line("ENDERECO");
    push(ESC.boldOff);
    line(order.delivery_address);
    line(divider());
  }

  // Items
  push(ESC.boldOn);
  line("ITENS");
  push(ESC.boldOff);

  for (const it of order.order_items ?? []) {
    const lineTotal = brl(it.unit_price * it.quantity);
    line(pad(`${it.quantity}x ${it.name}`, lineTotal));

    if (it.pizza_size_name) {
      line(
        `   Tam: ${it.pizza_size_name}${it.pizza_crust_name ? ` / Borda: ${it.pizza_crust_name}` : ""}`,
      );
    } else if (it.selected_size) {
      line(`   Tam: ${it.selected_size}`);
    }
    if (it.pizza_flavors && Array.isArray(it.pizza_flavors) && it.pizza_flavors.length > 0) {
      line(
        `   Sabores: ${(it.pizza_flavors as { name: string }[]).map((f) => f.name).join(" e ")}`,
      );
    }
    if (it.pizza_addons && Array.isArray(it.pizza_addons) && it.pizza_addons.length > 0) {
      line(
        `   Adicionais: ${(it.pizza_addons as { name: string }[]).map((a) => a.name).join(", ")}`,
      );
    }
    if (it.half_two_name) {
      line(`   2a metade: ${it.half_two_name}`);
    }
    if (it.notes) {
      line(`   Obs: ${it.notes}`);
    }
  }

  line(divider());

  // Totals
  const subtotal = order.total - (order.delivery_fee ?? 0) + (order.discount ?? 0);
  line(pad("Subtotal:", brl(subtotal)));
  if (order.delivery_fee) line(pad("Entrega:", brl(order.delivery_fee)));
  if (order.discount) line(pad("Desconto:", `-${brl(order.discount)}`));

  push(ESC.boldOn);
  line(pad("TOTAL:", brl(order.total)));
  push(ESC.boldOff);

  if (order.payment_method) {
    line("");
    line(`Pagamento: ${order.payment_method}`);
  }

  if (order.customer_notes) {
    line(divider());
    push(ESC.boldOn);
    line("OBSERVACOES");
    push(ESC.boldOff);
    line(order.customer_notes);
  }

  push(ESC.alignCenter);
  line("");
  line("Obrigado!");
  push(ESC.feed(3));
  push(ESC.cut);

  return concatBytes(parts);
}

// HTML version (for browser print fallback)
export function buildReceiptHTML(
  store: ReceiptStore,
  order: ReceiptOrder,
  customer: ReceiptCustomer | null,
): string {
  const itemsHTML = (order.order_items ?? [])
    .map((it) => {
      const extras: string[] = [];
      if (it.pizza_size_name)
        extras.push(`Tam: ${it.pizza_size_name}${it.pizza_crust_name ? ` · Borda: ${it.pizza_crust_name}` : ""}`);
      else if (it.selected_size) extras.push(`Tam: ${it.selected_size}`);
      if (it.pizza_flavors && Array.isArray(it.pizza_flavors) && it.pizza_flavors.length > 0)
        extras.push(`Sabores: ${(it.pizza_flavors as { name: string }[]).map((f) => f.name).join(" e ")}`);
      if (it.pizza_addons && Array.isArray(it.pizza_addons) && it.pizza_addons.length > 0)
        extras.push(`Adicionais: ${(it.pizza_addons as { name: string }[]).map((a) => a.name).join(", ")}`);
      if (it.half_two_name) extras.push(`2ª metade: ${it.half_two_name}`);
      if (it.notes) extras.push(`Obs: ${it.notes}`);
      return `<tr>
        <td style="vertical-align:top">${it.quantity}x</td>
        <td>${it.name}${extras.length ? `<br><small>${extras.join("<br>")}</small>` : ""}</td>
        <td style="text-align:right;vertical-align:top">${brl(it.unit_price * it.quantity)}</td>
      </tr>`;
    })
    .join("");

  const subtotal = order.total - (order.delivery_fee ?? 0) + (order.discount ?? 0);
  const pickup = isPickup(order);

  return `<!doctype html><html><head><meta charset="utf-8">
<title>Pedido #${order.order_number ?? ""}</title>
<style>
  body{font-family:'Courier New',monospace;padding:8px;max-width:300px;font-size:12px;color:#000}
  h1{font-size:14px;margin:2px 0;text-align:center}
  h2{font-size:12px;margin:6px 0 2px;text-transform:uppercase}
  table{width:100%;border-collapse:collapse}
  td{padding:2px 0;font-size:12px}
  hr{border:none;border-top:1px dashed #000;margin:6px 0}
  .center{text-align:center}
  .row{display:flex;justify-content:space-between}
  .bold{font-weight:bold}
  @media print { @page { margin: 4mm; } }
</style></head><body>
<h1 class="bold">${store.name}</h1>
<div class="center">Pedido #${order.order_number ?? "-"}</div>
<div class="center">${fmtTime(order.created_at)}</div>
<div class="center">${order.table_number ? `Mesa ${order.table_number}` : pickup ? "RETIRADA" : "DELIVERY"}</div>
<hr>
${customer?.display_name || customer?.phone ? `
  <h2>Cliente</h2>
  ${customer.display_name ? `<div>${customer.display_name}</div>` : ""}
  ${customer.phone ? `<div>Tel: ${customer.phone}</div>` : ""}
  ${!pickup && order.delivery_address ? `<div>End: ${order.delivery_address}</div>` : ""}
  <hr>
` : (!pickup && order.delivery_address ? `<h2>Endereço</h2><div>${order.delivery_address}</div><hr>` : "")}
<h2>Itens</h2>
<table>${itemsHTML}</table>
<hr>
<div class="row"><span>Subtotal:</span><span>${brl(subtotal)}</span></div>
${order.delivery_fee ? `<div class="row"><span>Entrega:</span><span>${brl(order.delivery_fee)}</span></div>` : ""}
${order.discount ? `<div class="row"><span>Desconto:</span><span>-${brl(order.discount)}</span></div>` : ""}
<div class="row bold"><span>TOTAL:</span><span>${brl(order.total)}</span></div>
${order.payment_method ? `<div style="margin-top:6px">Pagamento: ${order.payment_method}</div>` : ""}
${order.customer_notes ? `<hr><h2>Observações</h2><div>${order.customer_notes}</div>` : ""}
<div class="center" style="margin-top:10px">Obrigado!</div>
</body></html>`;
}
